/**
 * SyncStatusTracker — tracks last sync timestamps and connection state per table.
 *
 * @traceability DOC-012 Aggregate13 (SyncStatusTracker entity)
 */

export type ConnectionState = 'online' | 'offline';

export type SyncTrackerData = {
  id?: string;
  orgId: string;
  tableReference: string;
  lastSyncTimestamp?: Date | null;
  connectionState: ConnectionState;
  lastPushTimestamp?: Date | null;
  lastPullTimestamp?: Date | null;
};

export class SyncStatusTracker {
  readonly id: string;
  readonly orgId: string;
  readonly tableReference: string;
  lastSyncTimestamp: Date | null;
  connectionState: ConnectionState;
  lastPushTimestamp: Date | null;
  lastPullTimestamp: Date | null;

  constructor(data: SyncTrackerData) {
    this.id = data.id ?? crypto.randomUUID();
    this.orgId = data.orgId;
    this.tableReference = data.tableReference;
    this.lastSyncTimestamp = data.lastSyncTimestamp ?? null;
    this.connectionState = data.connectionState;
    this.lastPushTimestamp = data.lastPushTimestamp ?? null;
    this.lastPullTimestamp = data.lastPullTimestamp ?? null;
  }

  setOnline(): void {
    this.connectionState = 'online';
  }

  setOffline(): void {
    this.connectionState = 'offline';
  }

  recordPush(ts?: Date): void {
    this.lastPushTimestamp = ts ?? new Date();
  }

  recordPull(ts?: Date): void {
    this.lastPullTimestamp = ts ?? new Date();
  }

  recordSync(timestamp?: Date): void {
    this.lastSyncTimestamp = timestamp ?? new Date();
  }
}
