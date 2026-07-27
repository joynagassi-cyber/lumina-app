/**
 * Sync Domain — custom React hooks for synchronization management.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 13 (OfflineSyncAggregate)
 * @traceability OFFLINE-FIRST-SPEC: Push/Pull delta cycle
 */

import { useCallback, useMemo } from 'react';
import type { ConflictStrategyMap, PendingOperation, PushBatchSize } from './types';
import {
  useGetPendingOperationsQuery,
  usePushPendingOpsMutation,
  usePullDeltaMutation,
  useGetConnectionStateQuery,
  useGetSyncStatusTrackerQuery,
} from './api';

/* ------------------------------------------------------------------ */
/*  useSync                                                            */
/* ------------------------------------------------------------------ */

export function useSync(orgId: string | null) {
  const { data: pendingOps } = useGetPendingOperationsQuery(orgId ?? '', { skip: !orgId });
  const [pushOps] = usePushPendingOpsMutation();
  const [pullDelta] = usePullDeltaMutation();
  const { data: connState } = useGetConnectionStateQuery(undefined, { skip: false });
  const { data: tracker } = useGetSyncStatusTrackerQuery(orgId ?? '', { skip: !orgId });

  const operations = (pendingOps?.items ?? []) as ReadonlyArray<PendingOperation>;

  return useMemo(
    () => ({
      pendingOperations: operations,
      connectionState: connState?.state ?? 'online',
      isOnline: connState?.state === 'online',
      lastSyncTimestamp: tracker?.last_sync_timestamp ?? null,
      totalPushed: tracker?.total_pushed ?? 0,
      totalConfirmed: tracker?.total_confirmed ?? 0,
      conflictsDetected: tracker?.conflicts_detected ?? 0,
      pushPendingOps: async () =>
        pushOps({ organizationId: orgId!, operations: operations.map((op) => ({
          resourceType: op.resourceType,
          resourceId: op.resourceId,
          action: op.action,
          payload: JSON.parse(op.payload),
        })) }).unwrap(),
      pullRemoteChanges: async () =>
        pullDelta({ organizationId: orgId!, sinceTimestamp: tracker?.last_sync_timestamp }).unwrap(),
      doFullSync: async () => {
        await pushOps({
          organizationId: orgId!,
          operations: operations.map((op) => ({
            resourceType: op.resourceType,
            resourceId: op.resourceId,
            action: op.action,
            payload: JSON.parse(op.payload),
          })),
        }).unwrap();
        return pullDelta({ organizationId: orgId!, sinceTimestamp: tracker?.last_sync_timestamp }).unwrap();
      },
    }),
    [operations, connState?.state, tracker?.last_sync_timestamp, tracker?.total_pushed, tracker?.total_confirmed, tracker?.conflicts_detected, orgId, pushOps, pullDelta],
  );
}

/* ------------------------------------------------------------------ */
/*  useConflictStrategies                                              */
/* ------------------------------------------------------------------ */

/**
 * Returns the conflict resolution strategy map.
 * Falls back to DEFAULT_CONFLICT_STRATEGIES from types.ts if API unavailable.
 */
export function useConflictStrategies(): ConflictStrategyMap | null {
  const { data } = useGetConflictStrategiesQuery(undefined, { skip: false });
  return (data as ConflictStrategyMap | null) ?? null;
}

/* ------------------------------------------------------------------ */
/*  usePendingCount                                                    */
/* ------------------------------------------------------------------ */

/**
 * Returns the number of pending (unsynced) operations.
 * Useful for UI badges and sync indicators.
 */
export function usePendingCount(orgId: string | null): number {
  const { data: pendingOps } = useGetPendingOperationsQuery(orgId ?? '', { skip: !orgId });
  const ops = (pendingOps?.items ?? []) as ReadonlyArray<PendingOperation>;
  return useMemo(
    () => ops.filter((op) => op.syncStatus === 'pending').length,
    [ops],
  );
}
