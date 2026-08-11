/**
 * Reporting Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 10 (ReportingAggregate)
 * @traceability ASS-001: Application Services for report generation
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: report_templates, report_instances, report_snapshots tables
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  GenerateReportInput,
  ListReportsDefinitionInput,
  ListReportInstancesInput,
  PaginatedResponse,
  ReportDefinition,
  ReportGenerated,
  ReportInstanceWithPreview,
  ReportSnapshot,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchReporting<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': localStorage.getItem('orgId') || '',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Reporting API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const reportingApi = createApi({
  reducerPath: 'reportingApi',
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
  tagTypes: ['ReportDefinition', 'ReportInstance', 'ReportSnapshot'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    listReportDefinitions: builder.query<ReadonlyArray<ReportDefinition>, ListReportsDefinitionInput>({
      query: (args) => ({
        endpoint: `/reports/definitions/${args.organizationId}`,
        method: 'GET',
      }),
      providesTags: (_result, _err, arg) => [{ type: 'ReportDefinition', id: arg.organizationId }],
    }),

    getReportDefinition: builder.query<ReportDefinition, string>({
      query: (definitionId) => ({ endpoint: `/definitions/${definitionId}`, method: 'GET' }),
      providesTags: (_result, _err, definitionId) => [{ type: 'ReportDefinition', id: definitionId }],
    }),

    listReportInstances: builder.query<PaginatedResponse<ReportInstanceWithPreview>, ListReportInstancesInput>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.type) params.append('type', args.type);
        if (args.status) params.append('status', args.status);
        if (args.dateFrom) params.append('dateFrom', args.dateFrom);
        if (args.dateTo) params.append('dateTo', args.dateTo);
        if (args.page) params.append('page', args.page.toString());
        if (args.limit) params.append('limit', args.limit.toString());
        return {
          endpoint: `/instances/${args.organizationId}?${params.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (_result, _err, arg) => [{ type: 'ReportInstance', id: arg.organizationId }],
    }),

    getReportInstance: builder.query<ReportGenerated, string>({
      query: (instanceId) => ({ endpoint: `/instances/${instanceId}`, method: 'GET' }),
      providesTags: (_result, _err, instanceId) => [{ type: 'ReportInstance', id: instanceId }],
    }),

    getReportSnapshot: builder.query<ReportSnapshot, string>({
      query: (snapshotId) => ({ endpoint: `/snapshots/${snapshotId}`, method: 'GET' }),
      providesTags: (_result, _err, snapshotId) => [{ type: 'ReportSnapshot', id: snapshotId }],
    }),

    listReportSnapshots: builder.query<PaginatedResponse<ReportSnapshot>, string>({
      query: (orgId) => ({ endpoint: `/orgs/${orgId}/snapshots`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'ReportSnapshot', id: orgId }],
    }),

    /* ---- Mutations ---- */

    generateReport: builder.mutation<ReportGenerated, GenerateReportInput>({
      query: (body) => ({ endpoint: '/reports/generate', method: 'POST', body }),
      invalidatesTags: [{ type: 'ReportInstance', id: 'LIST' }],
    }),

    downloadReport: builder.mutation<{ readonly url: string; readonly filename: string }, string>({
      query: (instanceId) => ({
        endpoint: `/instances/${instanceId}/download`,
        method: 'GET',
      }),
      invalidatesTags: [{ type: 'ReportInstance', id: 'LIST' }],
    }),

    updateReportInstanceStatus: builder.mutation<ReportGenerated, { instanceId: string; status: ReportGenerated['status'] }>({
      query: ({ instanceId, status }) => ({
        endpoint: `/instances/${instanceId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'ReportInstance', id: arg.instanceId }],
    }),

    deleteReportInstance: builder.mutation<void, string>({
      query: (instanceId) => ({
        endpoint: `/instances/${instanceId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'ReportInstance', id: 'LIST' }],
    }),

    createSnapshot: builder.mutation<ReportSnapshot, string>({
      query: (orgId) => ({
        endpoint: `/orgs/${orgId}/snapshots`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'ReportSnapshot', id: 'LIST' }],
    }),

    purgeReportInstance: builder.mutation<void, string>({
      query: (instanceId) => ({
        endpoint: `/instances/${instanceId}/purge`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'ReportInstance', id: 'LIST' }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useListReportDefinitionsQuery,
  useGetReportDefinitionQuery,
  useListReportInstancesQuery,
  useGetReportInstanceQuery,
  useGetReportSnapshotQuery,
  useListReportSnapshotsQuery,
  useGenerateReportMutation,
  useDownloadReportMutation,
  useUpdateReportInstanceStatusMutation,
  useDeleteReportInstanceMutation,
  useCreateSnapshotMutation,
  usePurgeReportInstanceMutation,
} = reportingApi;

export default reportingApi;