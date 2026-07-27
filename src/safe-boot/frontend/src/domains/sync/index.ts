/**
 * Sync Domain — barrel exports.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 13 (OfflineSyncAggregate)
 */

export type {
  BASE_RETRY_DELAY_MS,
  ConflictStrategy,
  ConflictStrategyMap,
  ConnectionState,
  MAX_RETRY_ATTEMPTS,
  PendingOperation,
  PullDeltaInput,
  PushBatchSize,
  PushPendingOpsInput,
  ResolveConflictInput,
  SyncAction,
  SyncStatus,
  SyncStatusTracker,
} from './types';

export { DEFAULT_CONFLICT_STRATEGIES, PUSH_BATCH_SIZE } from './types';

export {
  syncApi,
  useClearSyncStatusMutation,
  useGetConnectionStateQuery,
  useGetConflictStrategiesQuery,
  useGetPendingOperationsQuery,
  useGetSyncStatusTrackerQuery,
  useMarkOperationConfirmedMutation,
  usePullDeltaMutation,
  usePushPendingOpsMutation,
  useResolveConflictMutation,
  useScheduleRetryMutation,
} from './api';

export { default as syncReducer } from './store';

export { useConflictStrategies, usePendingCount, useSync } from './hooks';

export { getPendingOperationSchema } from './watermelon';

export { SyncStatusIndicator } from './components';

