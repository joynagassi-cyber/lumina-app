/**
 * Member Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability ASS-001: Application Services for member CRUD operations
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: members table
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  CreateMemberInput,
  GroupMembership,
  LinkGroupMembershipInput,
  ListMembersInput,
  MemberProfile,
  MemberState,
  OrgUnitNode,
  PaginatedResponse,
  UpdateMemberInput,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchMembers<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': localStorage.getItem('orgId') || '',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Member API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const memberApi = createApi({
  reducerPath: 'memberApi',
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
  tagTypes: ['Member', 'GroupMembership', 'OrgUnit'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    listMembers: builder.query<PaginatedResponse<MemberProfile>, ListMembersInput>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.state) params.append('state', args.state);
        if (args.search) params.append('search', args.search);
        if (args.page) params.append('page', args.page.toString());
        if (args.limit) params.append('limit', args.limit.toString());
        return {
          endpoint: `/members/${args.organizationId}?${params.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (_result, _err, arg) => [{ type: 'Member', id: arg.organizationId }],
    }),

    getMember: builder.query<MemberProfile, string>({
      query: (memberId) => ({ endpoint: `/members/${memberId}`, method: 'GET' }),
      providesTags: (_result, _err, memberId) => [{ type: 'Member', id: memberId }],
    }),

    listGroupMemberships: builder.query<PaginatedResponse<GroupMembership>, string>({
      query: (orgId) => ({ endpoint: `/orgs/${orgId}/memberships`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'GroupMembership', id: orgId }],
    }),

    getOrgUnitHierarchy: builder.query<OrgUnitNode, string>({
      query: (orgId) => ({ endpoint: `/orgs/${orgId}/hierarchy`, method: 'GET' }),
      providesTags: (_result, _err, orgId) => [{ type: 'OrgUnit', id: orgId }],
    }),

    /* ---- Mutations ---- */

    createMember: builder.mutation<MemberProfile, CreateMemberInput>({
      query: (body) => ({ endpoint: '/members', method: 'POST', body }),
      invalidatesTags: [{ type: 'Member', id: 'LIST' }],
    }),

    updateMember: builder.mutation<MemberProfile, UpdateMemberInput>({
      query: ({ memberId, ...body }) => ({
        endpoint: `/members/${memberId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Member', id: arg.memberId }],
    }),

    changeMemberState: builder.mutation<MemberProfile, { memberId: string; state: MemberState }>({
      query: ({ memberId, state }) => ({
        endpoint: `/members/${memberId}/state`,
        method: 'POST',
        body: { state },
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Member', id: arg.memberId }],
    }),

    linkGroupMembership: builder.mutation<GroupMembership, LinkGroupMembershipInput>({
      query: (body) => ({ endpoint: '/memberships', method: 'POST', body }),
      invalidatesTags: [{ type: 'GroupMembership', id: 'ALL' }],
    }),

    unlinkGroupMembership: builder.mutation<void, string>({
      query: (membershipId) => ({
        endpoint: `/memberships/${membershipId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'GroupMembership', id: 'ALL' }],
    }),

    /* ---- Organization Unit Actions ---- */

    createOrgUnit: builder.mutation<OrgUnitNode, { orgId: string; name: string; parentId?: string }>({
      query: ({ orgId, name, parentId }) => ({
        endpoint: `/orgs/${orgId}/units`,
        method: 'POST',
        body: { name, parentId },
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'OrgUnit', id: arg.orgId }],
    }),

    updateOrgUnitParent: builder.mutation<OrgUnitNode, { orgUnitId: string; parentId: string | null }>({
      query: ({ orgUnitId, parentId }) => ({
        endpoint: `/units/${orgUnitId}/parent`,
        method: 'PATCH',
        body: { parentId },
      }),
      invalidatesTags: [{ type: 'OrgUnit', id: 'ALL' }],
    }),

    transferOrgUnit: builder.mutation<OrgUnitNode, { orgUnitId: string; targetOrgId: string }>({
      query: ({ orgUnitId, targetOrgId }) => ({
        endpoint: `/units/${orgUnitId}/transfer`,
        method: 'POST',
        body: { targetOrgId },
      }),
      invalidatesTags: [{ type: 'OrgUnit', id: 'ALL' }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useListMembersQuery,
  useGetMemberQuery,
  useListGroupMembershipsQuery,
  useGetOrgUnitHierarchyQuery,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useChangeMemberStateMutation,
  useLinkGroupMembershipMutation,
  useUnlinkGroupMembershipMutation,
  useCreateOrgUnitMutation,
  useUpdateOrgUnitParentMutation,
  useTransferOrgUnitMutation,
} = memberApi;

export default memberApi;