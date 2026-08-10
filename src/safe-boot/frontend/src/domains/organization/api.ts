/**
 * Organization Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 1 (OrganizationAggregate)
 * @traceability ASS-001: Application Services operations for org CRUD
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: organization + org_units tables
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  ChangeOrgUnitParentInput,
  CreateOrganizationInput,
  CreateOrgUnitInput,
  OrgHierarchyNode,
  OrganizationProfile,
  OrganizationStatus,
  OrgUnit,
  PaginatedResponse,
  UpdateOrganizationSettingsInput,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchOrg<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}/organizations${endpoint}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Organization API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const organizationApi = createApi({
  reducerPath: 'organizationApi',
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
  tagTypes: ['Organization', 'OrgUnit'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    getOrganizationProfile: builder.query<OrganizationProfile, string>({
      query: (orgId) => ({ endpoint: `/${orgId}`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'Organization', id: orgId }],
    }),

    listOrganizationUnits: builder.query<PaginatedResponse<OrgUnit>, string>({
      query: (orgId) => ({ endpoint: `/${orgId}/units`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'OrgUnit', id: orgId }],
    }),

    getOrgHierarchy: builder.query<ReadonlyArray<OrgHierarchyNode>, string>({
      query: (orgId) => ({ endpoint: `/${orgId}/hierarchy`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'Organization', id: orgId }],
    }),

    listOrganizations: builder.query<ReadonlyArray<OrganizationProfile>, void>({
      query: () => ({ endpoint: '/', method: 'GET' }),
      providesTags: [{ type: 'Organization', id: 'LIST' }],
    }),

    getOrgByStatus: builder.query<PaginatedResponse<OrganizationProfile>, OrganizationStatus>({
      query: (status) => ({ endpoint: `?status=${status}`, method: 'GET' }),
      providesTags: [{ type: 'Organization', id: 'STATUS_LIST' }],
    }),

    /* ---- Mutations ---- */

    createOrganization: builder.mutation<OrganizationProfile, CreateOrganizationInput>({
      query: (body) => ({ endpoint: '/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Organization', id: 'LIST' }],
    }),

    updateOrganizationSettings: builder.mutation<
      OrganizationProfile,
      UpdateOrganizationSettingsInput
    >({
      query: ({ organizationId, ...settings }) => ({
        endpoint: `/${organizationId}/settings`,
        method: 'PATCH',
        body: settings,
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'Organization', id: arg.organizationId },
      ],
    }),

    createOrgUnit: builder.mutation<OrgUnit, CreateOrgUnitInput>({
      query: (body) => ({ endpoint: '/units', method: 'POST', body }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'OrgUnit', id: arg.organizationId },
      ],
    }),

    updateOrgUnitParent: builder.mutation<
      OrgUnit,
      ChangeOrgUnitParentInput & { organizationId: string }
    >({
      query: ({ organizationId, ...input }) => ({
        endpoint: `/units/${input.orgUnitId}/parent`,
        method: 'PATCH',
        body: { newParentId: input.newParentId },
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'OrgUnit', id: arg.organizationId },
        { type: 'Organization', id: arg.organizationId },
      ],
    }),

    transferOrgUnit: builder.mutation<
      OrgUnit,
      { orgUnitId: string; targetOrgId: string }
    >({
      query: ({ orgUnitId, targetOrgId }) => ({
        endpoint: `/units/${orgUnitId}/transfer`,
        method: 'POST',
        body: { targetOrgId },
      }),
      invalidatesTags: [
        { type: 'Organization', id: 'LIST' },
        { type: 'OrgUnit', id: 'ALL' },
      ],
    }),

    archiveOrganization: builder.mutation<
      OrganizationProfile,
      { organizationId: string }
    >({
      query: ({ organizationId }) => ({
        endpoint: `/${organizationId}/archive`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'Organization', id: arg.organizationId },
      ],
    }),

    suspendOrganization: builder.mutation<
      OrganizationProfile,
      { organizationId: string }
    >({
      query: ({ organizationId }) => ({
        endpoint: `/${organizationId}/suspend`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'Organization', id: arg.organizationId },
      ],
    }),

    mergeOrganizations: builder.mutation<
      OrganizationProfile,
      { sourceOrgId: string; targetOrgId: string }
    >({
      query: ({ sourceOrgId, targetOrgId }) => ({
        endpoint: `/merge`,
        method: 'POST',
        body: { sourceOrgId, targetOrgId },
      }),
      invalidatesTags: [
        { type: 'Organization', id: 'LIST' },
        { type: 'OrgUnit', id: 'ALL' },
      ],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useGetOrganizationProfileQuery,
  useListOrganizationUnitsQuery,
  useGetOrgHierarchyQuery,
  useListOrganizationsQuery,
  useGetOrgByStatusQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationSettingsMutation,
  useCreateOrgUnitMutation,
  useUpdateOrgUnitParentMutation,
  useTransferOrgUnitMutation,
  useArchiveOrganizationMutation,
  useSuspendOrganizationMutation,
  useMergeOrganizationsMutation,
} = organizationApi;

export default organizationApi;
