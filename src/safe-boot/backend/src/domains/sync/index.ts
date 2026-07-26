/**
 * Sync Domain — OfflineSyncAggregate implementation.
 *
 * @traceability DOC-012 Aggregate13, ASS-001 §SERVICE 13, POSTGRESQL-SCHEMA-PACK-v1 §Tables 31-32
 * @invariants SYNC-001, SYNC-002, SYNC-003, SYNC-004 (DOC-015)
 *
 * This module implements the critical offline-first sync aggregate:
 * - Pending operations are queued locally before any remote write (BR-SYNC-001)
 * - Push batches are capped at 50 operations (BR-SYNC-006)
 * - Exponential backoff for retries (1s → 2s → 4s → 8s → 16s, max 5 attempts) (BR-SYNC-006)
 * - Conflict resolution is deterministic per entity type (BR-SYNC-002 through BR-SYNC-005)
 * - No user operation depends on synchronous API call (BR-SYNC-007)
 */

// Value Objects
export { SyncAction } from './value-objects/sync-action.vo';
export { SyncStatus } from './value-objects/sync-status.vo';
export { ConflictStrategy } from './value-objects/conflict-strategy.vo';
export { OperationPayload } from './value-objects/operation-payload.vo';
export { PushBatchSize } from './value-objects/push-batch-size.vo';
export { RetryDelayMs } from './value-objects/retry-delay-ms.vo';

// Ports (interface contracts)
export * from './ports';

// Entities
export { PendingOperation } from './entities/pending-operation.entity';
export type { PendingOperationData } from './entities/pending-operation.entity';
export { SyncStatusTracker } from './entities/sync-status-tracker.entity';
export type { SyncTrackerData } from './entities/sync-status-tracker.entity';

// Policies
export { LocalFirstPolicy } from './policies/local-first-policy';
export { ConflictResolutionPolicy, CONFLICT_RESOLUTION_MATRIX } from './policies/conflict-resolution-policy';
export type { ConflictResolutionEntry } from './policies/conflict-resolution-policy';
export { BatchPolicy } from './policies/batch-policy';

// Domain Services
export {
  PushCoordinator,
  PullCoordinator,
  ConflictResolver,
  Retrier,
} from './domain-services';
export type {
  PushResult,
  EventBus as PushEventBus,
} from './domain-services';
export type {
  PullResult,
} from './domain-services';
export type {
  ConflictInput,
  ConflictOutput,
} from './domain-services';

// Application Service
export { OfflineSyncService } from './application-service/offline-sync.service';
export type {
  PendingOperationInput,
  ConfirmOperationInput,
  ConflictResolutionInput,
  ConnectivityResult,
  EventBus as AppServiceEventBus,
} from './application-service/offline-sync.service';

// Module
export { SyncModule } from './sync.module';

// Scheduler
export { SyncScheduler } from './sync.scheduler';
