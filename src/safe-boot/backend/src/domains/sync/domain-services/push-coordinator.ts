/**
 * PushCoordinator — batches and sends pending operations to the remote server.
 *
 * @traceability DOC-012 Aggregate13 (PushCoordinator), BR-SYNC-006, UC-SYNC-01
 */

import { PendingOperationRecord } from '../ports/pending-operations-port.interface';
import { IRemoteApiPort, ConflictRecord } from '../ports/remote-api-port.interface';
import type { IPendingOperationsPort } from '../ports/pending-operations-port.interface';
import type { ISyncStatusRepositoryPort } from '../ports/sync-status-repository-port.interface';
import { BatchPolicy } from '../policies/batch-policy';
import { LocalFirstPolicy } from '../policies/local-first-policy';
import { SyncStatus } from '../value-objects/sync-status.vo';
import { ConflictResolutionPolicy } from '../policies/conflict-resolution-policy';
import { ConflictStrategy } from '../value-objects/conflict-strategy.vo';

const MAX_BATCH = 50;

export type PushResult = {
  batchCount: number;
  operationsPushed: number;
  conflictsResolved: number;
  conflictsDetected: number;
  errors: string[];
};

export interface EventBus {
  publish(event: unknown): void;
}

export class PushCoordinator {
  constructor(
    private readonly opsRepo: IPendingOperationsPort,
    private readonly statusRepo: ISyncStatusRepositoryPort,
    private readonly apiClient: IRemoteApiPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(orgId: string): Promise<PushResult> {
    const pendingOps = await this.opsRepo.findByOrgAndStatus(
      orgId,
      SyncStatus.PENDING,
      MAX_BATCH,
    );

    if (pendingOps.length === 0) {
      return this.emptyResult();
    }

    const batches = BatchPolicy.splitIntoBatches(pendingOps);
    let totalPushed = 0;
    let totalConflictsResolved = 0;
    let totalConflictsDetected = 0;
    const errors: string[] = [];

    for (const batch of batches) {
      const batchResult = await this.pushBatch(orgId, batch);
      totalPushed += batchResult.operationsPushed;
      totalConflictsResolved += batchResult.conflictsResolved;
      totalConflictsDetected += batchResult.conflictsDetected;
      errors.push(...batchResult.errors);
    }

    await this.statusRepo.updateLastPushTimestamp(
      orgId,
      'pending_operations',
      new Date(),
    );

    this.eventBus.publish({
      type: 'SyncCompleted' as const,
      orgId,
      direction: 'push' as const,
      operationsProcessed: totalPushed,
      occurredAt: new Date(),
    });

    return {
      batchCount: batches.length,
      operationsPushed: totalPushed,
      conflictsResolved: totalConflictsResolved,
      conflictsDetected: totalConflictsDetected,
      errors,
    };
  }

  private emptyResult(): PushResult {
    return {
      batchCount: 0,
      operationsPushed: 0,
      conflictsResolved: 0,
      conflictsDetected: 0,
      errors: [],
    };
  }

  private async pushBatch(
    orgId: string,
    batch: PendingOperationRecord[],
  ): Promise<Omit<PushResult, 'batchCount'>> {
    let operationsPushed = 0;
    let conflictsResolved = 0;
    let conflictsDetected = 0;
    const errors: string[] = [];

    for (const op of batch) {
      try {
        LocalFirstPolicy.validateLocalFirst(op);

        const pushPayload = {
          resource_id: op.resource_id,
          resource_type: op.resource_type,
          action: op.action,
          payload: op.payload,
        };

        await this.opsRepo.updateStatus(op.id, SyncStatus.SENT);

        const response = await this.apiClient.pushBatch(orgId, [pushPayload]);

        operationsPushed++;

        if (response.errors.length > 0) {
          errors.push(...response.errors);
          await this.opsRepo.updateStatusAndAttempt(
            op.id,
            SyncStatus.FAILED,
            op.tentative_num,
          );
          continue;
        }

        if (response.conflicts.length > 0) {
          conflictsDetected += response.conflicts.length;
          for (const conflict of response.conflicts) {
            const resolved = await this.resolveConflict(conflict);
            if (resolved) conflictsResolved++;
          }
        }

        await this.opsRepo.markConfirmed(op.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(message);
        await this.opsRepo.updateStatus(op.id, SyncStatus.FAILED);
      }
    }

    return {
      operationsPushed,
      conflictsResolved,
      conflictsDetected,
      errors,
    };
  }

  private async resolveConflict(
    conflict: ConflictRecord,
  ): Promise<boolean> {
    this.eventBus.publish({
      type: 'ConflictDetected' as const,
      orgId: conflict.orgId,
      resourceType: conflict.resourceType,
      resourceId: conflict.resourceId,
      localValue: conflict.localPayload,
      remoteValue: conflict.remotePayload,
      occurredAt: new Date(),
    });

    const strategy = ConflictResolutionPolicy.getStrategy(
      conflict.resourceType,
    );

    const resolvedPayload = this.applyStrategy(
      strategy,
      conflict.localPayload,
      conflict.remotePayload,
    );

    this.eventBus.publish({
      type: 'ConflictResolved' as const,
      orgId: conflict.orgId,
      resourceType: conflict.resourceType,
      resourceId: conflict.resourceId,
      resolution: strategy,
      occurredAt: new Date(),
    });

    return resolvedPayload !== null;
  }

  private applyStrategy(
    strategy: ConflictStrategy,
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
  ): Record<string, unknown> | null {
    switch (strategy) {
      case ConflictStrategy.LAST_WRITE_WINS:
        return this.resolveLWW(local, remote);
      case ConflictStrategy.SERVER_WINS:
        return { ...local, ...remote };
      case ConflictStrategy.UUID_DEDUP:
        return this.resolveUuidDedup(local, remote);
      case ConflictStrategy.IMMUTABLE:
        return null;
      default:
        return remote;
    }
  }

  private resolveLWW(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
  ): Record<string, unknown> {
    const localTs = this.extractTimestamp(local);
    const remoteTs = this.extractTimestamp(remote);
    return remoteTs >= localTs ? { ...local, ...remote } : local;
  }

  private resolveUuidDedup(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
  ): Record<string, unknown> {
    const localId = local.id as string | undefined;
    const remoteId = remote.id as string | undefined;
    if (localId && remoteId && localId !== remoteId) {
      return {
        ...local,
        _conflict_mode: 'side_by_side',
        _remote_copy: remote,
      };
    }
    return local;
  }

  private extractTimestamp(obj: Record<string, unknown>): number {
    const candidates = ['updated_at', 'synced_at', 'timestamp'];
    for (const key of candidates) {
      const val = obj[key];
      if (val && typeof val === 'string') {
        const ts = new Date(val).getTime();
        if (!Number.isNaN(ts)) return ts;
      }
    }
    return 0;
  }
}
