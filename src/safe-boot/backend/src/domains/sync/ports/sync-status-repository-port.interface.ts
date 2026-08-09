/**
 * SyncStatusRepositoryPort — interface for tracking sync timestamps per table.
 *
 * @traceability DOC-012 Aggregate13 (SyncStatusTracker), DOC-023 §Table 32
 */

export type ConnectionState = 'online' | 'offline';

export interface SyncStatusRecord {
  id: string;
  orgId: string;
  tableRef: string;
  lastSyncTimestamp?: Date | null;
  connectionState: ConnectionState;
  lastPushTimestamp?: Date | null;
  lastPullTimestamp?: Date | null;
}

export interface ISyncStatusRepositoryPort {
  findByOrgAndTable(
    orgId: string,
    tableRef: string,
  ): Promise<SyncStatusRecord | null>;
  upsert(record: Omit<SyncStatusRecord, 'id'>): Promise<void>;
  updateConnectionState(orgId: string, state: ConnectionState): Promise<void>;
  getAllForOrg(orgId: string): Promise<SyncStatusRecord[]>;
  updateLastPushTimestamp(orgId: string, tableRef: string, ts: Date): Promise<void>;
  updateLastPullTimestamp(orgId: string, tableRef: string, ts: Date): Promise<void>;
  updateLastSyncTimestamp(
    orgId: string,
    tableRef: string,
    ts: Date,
  ): Promise<void>;
}
