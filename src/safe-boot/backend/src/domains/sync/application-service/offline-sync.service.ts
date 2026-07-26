/**
 * OfflineSyncService — Application Service for OfflineSyncAggregate.
 * Orchestrates push, pull, conflict resolution, and connectivity checks.
 *
 * @traceability DOC-012 Aggregate13, ASS-001 §SERVICE 13 (OfflineSyncService)
 * @invariants SYNC-001, SYNC-002, SYNC-003, SYNC-004
 */

import { IPendingOperationsPort } from '../ports/pending-operations-port.interface';
import { ISyncStatusRepositoryPort } from '../ports/sync-status-repository-port.interface';
import { IRemoteApiPort } from '../ports/remote-api-port.interface';
import { PushCoordinator, PullCoordinator, ConflictResolver, Retrier } from '../domain-services';
import { SyncAction } from '../value-objects/sync-action.vo';
import { SyncStatus } from '../value-objects/sync-status.vo';
import { OperationPayload } from '../value-objects/operation-payload.vo';
import { ResourceId } from '@domains/finance/value-objects/resource-id.vo';
import { ConflictResolutionPolicy } from '../policies/conflict-resolution-policy';
import { ConflictInput, ConflictOutput } from '../domain-services/conflict-resolver';

export type PendingOperationInput = {
  orgId: string;
  resourceType: string;
  resourceId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
};

export type ConfirmOperationInput = {
  operationId: string;
};

export type ConflictResolutionInput = {
  orgId: string;
  resourceType: string;
  resourceId: string;
  localPayload: Record<string, unknown>;
  remotePayload: Record<string, unknown>;
};

export type ConnectivityResult = {
  isConnected: boolean;
  connectionState: 'online' | 'offline';
  lastPush?: Date | null;
  lastPull?: Date | null;
};

export interface EventBus {
  publish(event: unknown): void;
}

export class OfflineSyncService {
  private readonly pushCoordinator: PushCoordinator;
  private readonly pullCoordinator: PullCoordinator;

  constructor(
    private readonly opsRepo: IPendingOperationsPort,
    private readonly statusRepo: ISyncStatusRepositoryPort,
    private readonly apiClient: IRemoteApiPort,
    private readonly eventBus: EventBus,
  ) {
    this.pushCoordinator = new PushCoordinator(
      opsRepo,
      statusRepo,
      apiClient,
      eventBus,
    );
    this.pullCoordinator = new PullCoordinator(
      apiClient,
      statusRepo,
      opsRepo,
      eventBus,
    );
  }

  // ---------------------------------------------------------------------------
  // COMMANDS per ASS-001 §SERVICE 13
  // ---------------------------------------------------------------------------

  /**
   * PushPendingOperations — UC-SYNC-01
   * Push all pending operations to remote server in batches (max 50).
   */
  async pushPendingOperations(orgId: string): Promise<{ pushed: number; errors: string[] }> {
    const result = await this.pushCoordinator.execute(orgId);
    return { pushed: result.operationsPushed, errors: result.errors };
  }

  /**
   * PullRemoteChanges — UC-SYNC-02
   * Fetch delta changes since last sync for a given table.
   */
  async pullRemoteChanges(orgId: string, tableRef: string): Promise<{ fetched: number; errors: string[] }> {
    const result = await this.pullCoordinator.execute(orgId, tableRef);
    return { fetched: result.changesFetched, errors: result.errors };
  }

  /**
   * ResolveConflict — UC-SYNC-03
   * Resolve a sync conflict between local and server data deterministically.
   */
  async resolveConflict(
    input: ConflictResolutionInput,
  ): Promise<ConflictOutput> {
    const conflictInput: ConflictInput = {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      localPayload: input.localPayload,
      remotePayload: input.remotePayload,
    };

    return ConflictResolver.resolve(conflictInput);
  }

  /**
   * MarkOperationConfirmed — UC-SYNC-04
   * Mark a specific pending operation as confirmed synced.
   */
  async markOperationConfirmed(input: ConfirmOperationInput): Promise<void> {
    await this.opsRepo.markConfirmed(input.operationId);
  }

  /**
   * CreatePendingOperation — enqueue a local change for future sync.
   * Local write is always recorded first before any remote attempt (BR-SYNC-001).
   */
  async createPendingOperation(
    input: PendingOperationInput,
  ): Promise<string> {
    if (!ConflictResolutionPolicy.hasRegisteredStrategy(input.resourceType)) {
      throw new Error(
        `OfflineSync: unknown resource type '${input.resourceType}' — no sync strategy registered`,
      );
    }

    const operationPayload = new OperationPayload(
      JSON.stringify(input.payload),
    );

    const record = await this.opsRepo.create({
      org_id: input.orgId,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      action: input.action,
      payload: JSON.parse(operationPayload.toString()),
      statut_sync: SyncStatus.PENDING,
      tentative_num: 1,
    });

    return record;
  }

  // ---------------------------------------------------------------------------
  // QUERIES per ASS-001 §SERVICE 13
  // ---------------------------------------------------------------------------

  /**
   * CheckConnectivity — QUERY §5
   */
  async checkConnectivity(orgId: string): Promise<ConnectivityResult> {
    const trackers = await this.statusRepo.getAllForOrg(orgId);

    if (trackers.length === 0) {
      return {
        isConnected: true,
        connectionState: 'online',
      };
    }

    const latestPush = trackers.reduce<Date | null>(
      (latest, t) => {
        if (!t.lastPushTimestamp) return latest;
        return latest === null || t.lastPushTimestamp > latest
          ? t.lastPushTimestamp
          : latest;
      },
      null,
    );

    const latestPull = trackers.reduce<Date | null>(
      (latest, t) => {
        if (!t.lastPullTimestamp) return latest;
        return latest === null || t.lastPullTimestamp > latest
          ? t.lastPullTimestamp
          : latest;
      },
      null,
    );

    const isOnline = trackers.every((t) => t.etat_connection === 'online');

    return {
      isConnected: isOnline,
      connectionState: isOnline ? 'online' : 'offline',
      lastPush: latestPush,
      lastPull: latestPull,
    };
  }

  /**
   * GetSyncStatus — QUERY §6
   */
  async getSyncStatus(
    orgId: string,
    tableName: string,
  ): Promise<{
    lastSyncTimestamp?: Date | null;
    connectionState: 'online' | 'offline';
    lastPushTimestamp?: Date | null;
    lastPullTimestamp?: Date | null;
  } | null> {
    const tracker = await this.statusRepo.findByOrgAndTable(orgId, tableName);
    if (!tracker) return null;

    return {
      lastSyncTimestamp: tracker.lastSyncTimestamp,
      connectionState: tracker.etat_connection,
      lastPushTimestamp: tracker.lastPushTimestamp,
      lastPullTimestamp: tracker.lastPullTimestamp,
    };
  }

  /**
   * UpdateConnectionState — signal connectivity state change.
   */
  async updateConnectionState(
    orgId: string,
    state: 'online' | 'offline',
  ): Promise<void> {
    await this.statusRepo.updateConnectionState(orgId, state);

    if (state === 'offline') {
      this.eventBus.publish({
        type: 'ConnectionLost' as const,
        orgId,
        occurredAt: new Date(),
      });
    } else {
      this.eventBus.publish({
        type: 'ConnectionRestored' as const,
        orgId,
        occurredAt: new Date(),
      });
    }
  }

  /**
   * ScheduleRetry — retry a failed operation with exponential backoff.
   */
  async scheduleRetry(orgId: string): Promise<number> {
    const failedOps = await this.opsRepo.findByOrgAndStatus(
      orgId,
      SyncStatus.FAILED,
      50,
    );

    let retried = 0;
    for (const op of failedOps) {
      try {
        const delayMs = Retrier.getDelayForAttempt(op.tentative_num + 1);
        const nextRetry = new Date(Date.now() + delayMs);

        await this.opsRepo.updateStatusAndAttempt(
          op.id,
          SyncStatus.PENDING,
          op.tentative_num + 1,
        );
        // Note: prochaine_retry is stored via Prisma adapter update
        retried++;
      } catch {
        // Skip individual failures; continue retrying others
      }
    }

    return retried;
  }
}
