/**
 * Member Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability ASS-001: Application Services for member operations
 */

import { useMemo } from 'react';
import type {
  GroupMembership,
  MemberProfile,
  MemberState,
  OrgUnitNode,
} from './types';
import {
  useListMembersQuery,
  useGetMemberQuery,
  useListGroupMembershipsQuery,
  useGetOrgUnitHierarchyQuery,
} from './api';

/* ------------------------------------------------------------------ */
/*  useMembers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns members list for an organization with filtering capabilities.
 * Maps to BR-MEM-001 visibility rules.
 */
export function useMembers(organizationId: string | null, options?: {
  state?: MemberState;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { data: membersResponse, isLoading: loadingMembers, error: membersError } = useListMembersQuery(
    {
      organizationId: organizationId ?? '',
      ...(options ? {
        state: options.state,
        search: options.search,
        page: options.page,
        limit: options.limit,
      } : {}),
    },
    {
      skip: !organizationId,
      ...(options && {
        forceRefetch: {
          tagTypes: ['Member'],
          minSecondsSinceTimeSynced: 5,
        },
      }),
    }
  );

  const members = membersResponse?.items as MemberProfile[] | [];
  const totalCount = membersResponse?.totalCount || 0;

  return useMemo(() => ({
    members,
    totalCount,
    selectedMember: null,
    isLoading: loadingMembers,
    error: membersError,
    loading: loadingMembers,
  }), [members, totalCount, loadingMembers, membersError]);
}

/* ------------------------------------------------------------------ */
/*  useGroupMemberships                                                */
/* ------------------------------------------------------------------ */

/**
 * Returns group memberships for a member within an organization.
 */
export function useGroupMemberships(organizationId: string | null) {
  const { data: membershipsResponse, isLoading: loadingMemberships, error: membershipsError } =
    useListGroupMembershipsQuery(organizationId ?? '', { skip: !organizationId });

  const memberships = membershipsResponse?.items as GroupMembership[] | [];

  return useMemo(() => ({
    memberships,
    totalCount: memberships.length,
    isLoading: loadingMemberships,
    error: membershipsError,
    loading: loadingMemberships,
  }), [memberships, loadingMemberships, membershipsError]);
}

/* ------------------------------------------------------------------ */
/*  useOrgUnitHierarchy                                                */
/* ------------------------------------------------------------------ */

/**
 * Returns the organizational unit hierarchy tree for an organization.
 */
export function useOrgUnitHierarchy(organizationId: string | null) {
  const { data: hierarchy, isLoading: loadingHierarchy, error: hierarchyError } =
    useGetOrgUnitHierarchyQuery(organizationId ?? '', { skip: !organizationId });

  return useMemo(() => ({
    root: hierarchy || null,
    organizationId,
    isLoading: loadingHierarchy,
    error: hierarchyError,
    loading: loadingHierarchy,
  }), [hierarchy, loadingHierarchy, hierarchyError, organizationId]);
}

/* ------------------------------------------------------------------ */
/*  useMember                                                          */
/* ------------------------------------------------------------------ */

/**
 * Returns a specific member by ID with full profile details.
 */
export function useMember(organizationId: string | null, memberId: string | null) {
  const { data: profile, isLoading: loadingProfile, error: profileError } = useGetMemberQuery(
    memberId ?? '',
    {
      skip: !memberId || !organizationId,
    }
  );

  const memberProfile = profile as MemberProfile | undefined;

  return useMemo(() => ({
    member: memberProfile ?? null,
    isLoading: loadingProfile,
    error: profileError,
    loading: loadingProfile,
  }), [memberProfile, loadingProfile, profileError]);
}