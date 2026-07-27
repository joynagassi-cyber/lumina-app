/**
 * Sync Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 13 (OfflineSyncAggregate)
 * @traceability ASS-001: Application Services for sync operations
 * @traceability OFFLINE-FIRST-SPEC: Push/Pull delta cycle + batch policy
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  ConflictStrategyMap,
  PendingOperation,
  PullDeltaInput,
  PushPendingOpsInput,
  ResolveConflictInput,
  SyncStatus,
  SyncStatusTracker,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const syncApi = createApi({
  reducerPath: 'syncApi',
  baseQuery: async ({
    endpoint,
    method,
    body,
  }: {
    endpoint: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
  }) => {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      return { error: `Sync API error: ${response.status} ${response.statusText}` };
    }

    return { data: await response.json() };
  },
  tagTypes: ['Sync'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    getPendingOperations: builder.query<ReadonlyArray<PendingOperation>, string>({
      query: (orgId) => ({
        endpoint: `/sync/pending?org_id=${orgId}`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Sync', id: 'PENDING' }],
    }),

    getSyncStatusTracker: builder.query<SyncStatusTracker, string>({
      query: (orgId) => ({
        endpoint: `/sync/status?org_id=${orgId}`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Sync', id: 'TRACKER' }],
    }),

    getConflictStrategies: builder.query<ConflictStrategyMap, void>({
      query: () => ({ endpoint: '/sync/strategies', method: 'GET' }),
      providesTags: [{ type: 'Sync', id: 'STRATEGIES' }],
    }),

    getConnectionState: builder.query<{ state: 'online' | 'offline' }, void>({
      query: () => ({ endpoint: '/sync/connection', method: 'GET' }),
    }),

    /* ---- Mutations ---- */

    pushPendingOps: builder.mutation<
      { pushed: number; confirmed: number; conflicts: ReadonlyArray<string> },
      PushPendingOpsInput
    >({
      query: (body) => ({ endpoint: '/sync/push', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Sync', id: 'PENDING' },
        { type: 'Sync', id: 'TRACKER' },
      ],
    }),

    pullDelta: builder.mutation<
      { changes: ReadonlyArray<{ resource: string; id: string; updated_at: string }>; conflicts: ReadonlyArray<string> },
      PullDeltaInput
    >({
      query: (body) => ({ endpoint: '/sync/pull', method: 'POST', body }),
      invalidatesTags: (result) =>
        result?.changes.map((c) => ({ type: 'Sync' as const, id: `${c.resource}:${c.id}` })) ??
        [],
    }),

    resolveConflict: builder.mutation<void, ResolveConflictInput>({
      query: (body) => ({ endpoint: '/sync/conflicts/resolve', method: 'POST', body }),
      invalidatesTags: [{ type: 'Sync', id: 'PENDING' }],
    }),

    markOperationConfirmed: builder.mutation<void, { operationId: string }>({
      query: ({ operationId }) => ({
        endpoint: `/sync/operations/${operationId}/confirm`,
        method: 'PATCH',
      }),
      invalidatesTags: [{ type: 'Sync', id: 'PENDING' }],
    }),

    scheduleRetry: builder.mutation<void, { operationId: string; delayMs: number }>({
      query: ({ operationId, delayMs }) => ({
        endpoint: `/sync/operations/${operationId}/retry`,
        method: 'POST',
        body: { delayMs },
      }),
    }),

    clearSyncStatus: builder.mutation<void, { organizationId: string }>({
      query: ({ organizationId }) => ({
        endpoint: `/sync/clear`,
        method: 'POST',
        body: { organizationId },
      }),
      invalidatesTags: [
        { type: 'Sync', id: 'PENDING' },
        { type: 'Sync', id: 'TRACKER' },
      ],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useGetPendingOperationsQuery,
  useGetSyncStatusTrackerQuery,
  useGetConflictStrategiesQuery,
  useGetConnectionStateQuery,
  usePushPendingOpsMutation,
  usePullDeltaMutation,
  useResolveConflictMutation,
  useMarkOperationConfirmedMutation,
  useScheduleRetryMutation,
  useClearSyncStatusMutation,
} = syncApi;

export default syncApi;
