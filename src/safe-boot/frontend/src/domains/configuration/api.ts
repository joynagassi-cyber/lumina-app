/**
 * Configuration Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 9 (ConfigurationAggregate)
 * @traceability ASS-001: Application Services for configuration operations
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: organization_settings table
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  BulkUpdateSettingsInput,
  CreateSettingInput,
  GetSettingsInput,
  OrganizationSettings,
  SettingEntry,
  UpdateSettingInput,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchConfig<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': localStorage.getItem('orgId') || '',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Configuration API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const configApi = createApi({
  reducerPath: 'configApi',
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
  tagTypes: ['Setting', 'OrganizationSettings'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    getOrganizationSettings: builder.query<OrganizationSettings, string>({
      query: (orgId) => ({ endpoint: `/orgs/${orgId}/settings/profile`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'OrganizationSettings', id: orgId }],
    }),

    listSettings: builder.query<ReadonlyArray<SettingEntry>, string>({
      query: (orgId) => ({ endpoint: `/orgs/${orgId}/settings`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'Setting', id: orgId }],
    }),

    getSetting: builder.query<SettingEntry, string>({
      query: (settingId) => ({ endpoint: `/settings/${settingId}`, method: 'GET' }),
      providesTags: (_result, _err, settingId) => [{ type: 'Setting', id: settingId }],
    }),

    /* ---- Mutations ---- */

    createSetting: builder.mutation<SettingEntry, CreateSettingInput>({
      query: (body) => ({ endpoint: '/settings', method: 'POST', body }),
      invalidatesTags: [{ type: 'Setting', id: 'LIST' }],
    }),

    updateSetting: builder.mutation<SettingEntry, UpdateSettingInput>({
      query: ({ settingId, ...body }) => ({
        endpoint: `/settings/${settingId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Setting', id: arg.settingId }],
    }),

    bulkUpdateSettings: builder.mutation<OrganizationSettings, BulkUpdateSettingsInput>({
      query: ({ organizationId, ...body }) => ({
        endpoint: `/orgs/${organizationId}/settings/bulk`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'OrganizationSettings', id: arg.organizationId }],
    }),

    deleteSetting: builder.mutation<void, string>({
      query: (settingId) => ({
        endpoint: `/settings/${settingId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Setting', id: 'LIST' }],
    }),

    resetSettings: builder.mutation<OrganizationSettings, string>({
      query: (orgId) => ({
        endpoint: `/orgs/${orgId}/settings/reset`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, orgId) => [{ type: 'OrganizationSettings', id: orgId }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useGetOrganizationSettingsQuery,
  useListSettingsQuery,
  useGetSettingQuery,
  useCreateSettingMutation,
  useUpdateSettingMutation,
  useBulkUpdateSettingsMutation,
  useDeleteSettingMutation,
  useResetSettingsMutation,
} = configApi;

export default configApi;