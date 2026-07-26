/**
 * Sync Ports — all port interfaces for the OfflineSync Aggregate.
 */

export type { PendingOperationRecord, IPendingOperationsPort } from './pending-operations-port.interface';
export type {
  ConnectionState,
  SyncStatusRecord,
  ISyncStatusRepositoryPort,
} from './sync-status-repository-port.interface';
export type {
  ConflictRecord,
  ResolvedConflict,
  PushBatchResponse,
  DeltaPullResponse,
  IRemoteApiPort,
} from './remote-api-port.interface';
