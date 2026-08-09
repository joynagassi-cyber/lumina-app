/**
 * PullCoordinator — fetches delta changes from remote server since last sync.
 *
 * @traceability DOC-012 Aggregate13 (PullCoordinator), BR-SYNC-004, UC-SYNC-02
 */

import { IRemoteApiPort } from '../ports/remote-api-port.interface';
import { ISyncStatusRepositoryPort } from '../ports/sync-status-repository-port.interface';
import type { IPendingOperationsPort } from '../ports/pending-operations-port.interface';
import { SyncStatus } from '../value-objects/sync-status.vo';
import { ConflictResolutionPolicy } from '../policies/conflict-resolution-policy';
import { ConflictStrategy } from '../value-objects/conflict-strategy.vo';
import { PendingOperation, PendingOperationData } from '../entities/pending-operation.entity';
import { SyncAction } from '../value-objects/sync-action.vo';
import { OperationPayload } from '../value-objects/operation-payload.vo';
import { ResourceId } from '@domains/finance/value-objects/resource-id.vo';

export type PullResult = {
  changesFetched: number;
  changesApplied: number;
  conflictsResolved: number;
  errors: string[];
};

export interface EventBus {
  publish(event: unknown): void;
}

export class PullCoordinator {
  constructor(
    private readonly apiClient: IRemoteApiPort,
    private readonly statusRepo: ISyncStatusRepositoryPort,
    private readonly opsRepo: IPendingOperationsPort,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Fetch remote changes since the last sync and apply them locally.
   * Applies conflict resolution strategy per entity type.
   */
  async execute(orgId: string, tableRef: string): Promise<PullResult> {
    const tracker = await this.statusRepo.findByOrgAndTable(
      orgId,
      tableRef,
    );

    const sinceTimestamp =
      tracker?.lastSyncTimestamp ?? new Date(0);

    const pullResponse = await this.apiClient.pullDelta(orgId, sinceTimestamp);

    let changesApplied = 0;
    let conflictsResolved = 0;
    const errors: string[] = [];

    for (const change of pullResponse.changes) {
      try {
        const existingOps =
          await this.opsRepo.findByResourceTypeAndId(
            change.resourceType,
            change.resourceId,
          );

        const hasPendingLocalChange = existingOps.some(
          (op) => op.statut_sync === SyncStatus.PENDING,
        );

        if (hasPendingLocalChange) {
          const conflictRecord = await this.resolvePullConflict(
            orgId,
            change,
          );
          if (conflictRecord) conflictsResolved++;
          continue;
        }

        await this.applyChange(orgId, change);
        changesApplied++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(message);
      }
    }

    await this.statusRepo.updateLastPullTimestamp(
      orgId,
      tableRef,
      new Date(),
    );
    await this.statusRepo.updateLastSyncTimestamp(
      orgId,
      tableRef,
      new Date(),
    );

    this.eventBus.publish({
      type: 'DeltaReceived' as const,
      orgId,
      changeCount: pullResponse.changes.length,
      sinceTimestamp,
      occurredAt: new Date(),
    });

    return {
      changesFetched: pullResponse.changes.length,
      changesApplied,
      conflictsResolved,
      errors,
    };
  }

  private async applyChange(
    orgId: string,
    change: {
      resourceType: string;
      resourceId: string;
      action: 'create' | 'update' | 'delete';
      payload: Record<string, unknown>;
      timestamp: Date;
    },
  ): Promise<void> {
    const operationData: PendingOperationData = {
      orgId,
      resourceType: change.resourceType,
      resourceId: new ResourceId(change.resourceId),
      action: this.mapAction(change.action),
      payload: new OperationPayload(JSON.stringify(change.payload)),
      status: SyncStatus.CONFIRMED,
      attemptNumber: 1,
      createdAt: change.timestamp,
    };

    const pendingOp = new PendingOperation(operationData);
    pendingOp.markConfirmed();
    await this.opsRepo.create({
      org_id: orgId,
      resource_type: change.resourceType,
      resource_id: change.resourceId,
      action: pendingOp.action,
      payload: JSON.parse(pendingOp.payload.toString()),
      statut_sync: SyncStatus.CONFIRMED,
      tentative_num: 1,
    });
  }

  private async resolvePullConflict(
    orgId: string,
    change: {
      resourceType: string;
      resourceId: string;
      action: 'create' | 'update' | 'delete';
      payload: Record<string, unknown>;
      timestamp: Date;
    },
  ): Promise<boolean> {
    const strategy = ConflictResolutionPolicy.getStrategy(
      change.resourceType,
    );

    this.eventBus.publish({
      type: 'ConflictDetected' as const,
      orgId,
      resourceType: change.resourceType,
      resourceId: change.resourceId,
      localValue: change.payload,
      remoteValue: change.payload,
      occurredAt: new Date(),
    });

    switch (strategy) {
      case ConflictStrategy.LAST_WRITE_WINS: {
        const latest = this.extractLatestRemote(change.payload);
        await this.applyChange(orgId, { ...change, payload: latest });
        break;
      }
      case ConflictStrategy.SERVER_WINS: {
        await this.applyChange(orgId, change);
        break;
      }
      default:
        await this.applyChange(orgId, change);
        break;
    }

    this.eventBus.publish({
      type: 'ConflictResolved' as const,
      orgId,
      resourceType: change.resourceType,
      resourceId: change.resourceId,
      resolution: strategy,
      occurredAt: new Date(),
    });

    return true;
  }

  private extractLatestRemote(payload: Record<string, unknown>): Record<string, unknown> {
    const wrapper = payload as { _remote_copy?: Record<string, unknown> };
    if (wrapper._remote_copy && typeof wrapper._remote_copy === 'object') {
      return wrapper._remote_copy as Record<string, unknown>;
    }
    return payload;
  }

  private mapAction(
    remoteAction: 'create' | 'update' | 'delete',
  ): SyncAction {
    switch (remoteAction) {
      case 'create':
        return SyncAction.CREATE;
      case 'update':
        return SyncAction.UPDATE;
      case 'delete':
        return SyncAction.DELETE;
    }
  }
}
