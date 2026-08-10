/**
 * Lifecycle Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 8 (LifecycleAggregate)
 * @traceability ASS-001: Application Services for archive/purge operations
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: archive_entries, purge_schedules tables
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  ArchiveCommandInput,
  ArchiveEntry,
  ArchiveEntryDomainModel,
  ArchiveEntryWithPreview,
  ListArchivesInput,
  PaginatedResponse,
  PurgeSchedule,
  UpdatePurgeScheduleInput,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchLifecycle<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': localStorage.getItem('orgId') || '',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Lifecycle API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const lifecycleApi = createApi({
  reducerPath: 'lifecycleApi',
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
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { error: `API ${response.status}: ${errorBody || response.statusText}` };
    }

    return { data: await response.json() };
  },
  tagTypes: ['ArchiveEntry', 'PurgeSchedule'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    listArchives: builder.query<PaginatedResponse<ArchiveEntryWithPreview>, ListArchivesInput>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.resourceType) params.append('resourceType', args.resourceType);
        if (args.state) params.append('state', args.state);
        if (args.page) params.append('page', args.page.toString());
        if (args.limit) params.append('limit', args.limit.toString());
        return {
          endpoint: `/archives/${args.organizationId}?${params.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (_result, _err, arg) => [{ type: 'ArchiveEntry', id: arg.organizationId }],
    }),

    getArchiveEntry: builder.query<ArchiveEntryDomainModel, string>({
      query: (entryId) => ({ endpoint: `/archives/${entryId}/full`, method: 'GET' }),
      providesTags: (_result, _err, entryId) => [{ type: 'ArchiveEntry', id: entryId }],
    }),

    listPurgeSchedules: builder.query<PaginatedResponse<PurgeSchedule>, string>({
      query: (orgId) => ({ endpoint: `/orgs/${orgId}/schedules`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'PurgeSchedule', id: orgId }],
    }),

    getPurgeSchedule: builder.query<PurgeSchedule, string>({
      query: (scheduleId) => ({ endpoint: `/schedules/${scheduleId}`, method: 'GET' }),
      providesTags: (_result, _err, scheduleId) => [{ type: 'PurgeSchedule', id: scheduleId }],
    }),

    /* ---- Mutations ---- */

    archiveResource: builder.mutation<ArchiveEntry, ArchiveCommandInput>({
      query: (body) => ({ endpoint: '/archives', method: 'POST', body }),
      invalidatesTags: [{ type: 'ArchiveEntry', id: 'LIST' }],
    }),

    purgeArchiveEntry: builder.mutation<void, string>({
      query: (entryId) => ({
        endpoint: `/archives/${entryId}/purge`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'ArchiveEntry', id: 'LIST' }],
    }),

    restoreArchiveEntry: builder.mutation<ArchiveEntry, string>({
      query: (entryId) => ({
        endpoint: `/archives/${entryId}/restore`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, entryId) => [{ type: 'ArchiveEntry', id: entryId }],
    }),

    createPurgeSchedule: builder.mutation<PurgeSchedule, Omit<UpdatePurgeScheduleInput, 'scheduleId' | 'organizationId'>>({
      query: (body) => ({ endpoint: '/schedules', method: 'POST', body }),
      invalidatesTags: [{ type: 'PurgeSchedule', id: 'LIST' }],
    }),

    updatePurgeSchedule: builder.mutation<PurgeSchedule, UpdatePurgeScheduleInput>({
      query: ({ scheduleId, ...body }) => ({
        endpoint: `/schedules/${scheduleId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'PurgeSchedule', id: arg.scheduleId }],
    }),

    triggerPurgeNow: builder.mutation<void, string>({
      query: (scheduleId) => ({
        endpoint: `/schedules/${scheduleId}/now`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'PurgeSchedule', id: 'LIST' }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useListArchivesQuery,
  useGetArchiveEntryQuery,
  useListPurgeSchedulesQuery,
  useGetPurgeScheduleQuery,
  useArchiveResourceMutation,
  usePurgeArchiveEntryMutation,
  useRestoreArchiveEntryMutation,
  useCreatePurgeScheduleMutation,
  useUpdatePurgeScheduleMutation,
  useTriggerPurgeNowMutation,
} = lifecycleApi;

export default lifecycleApi;