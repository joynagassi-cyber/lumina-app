/**
 * Member Domain — Redux slice for local member state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability DOC-021: Physical Data Model members entity
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { castDraft } from 'immer';
import type { MemberProfile, GroupMembership, OrgUnitNode } from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface MemberState {
  /** Members list for current organization. */
  members: ReadonlyArray<MemberProfile>;

  /** Currently selected member. */
  selectedMember: MemberProfile | null;

  /** Member's group memberships. */
  memberships: ReadonlyArray<GroupMembership>;

  /** Organization unit hierarchy tree. */
  orgUnitHierarchy: OrgUnitNode | null;

  /** Current organization ID. */
  organizationId: string | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;
}

const initialState: MemberState = {
  members: [],
  selectedMember: null,
  memberships: [],
  orgUnitHierarchy: null,
  organizationId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const memberSlice = createSlice({
  name: 'member',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
      state.members = [];
      state.selectedMember = null;
      state.memberships = [];
      state.orgUnitHierarchy = null;
      state.error = null;
    },

    setMembers(state, action: PayloadAction<ReadonlyArray<MemberProfile>>) {
      state.members = [...action.payload];
    },

    appendMember(state, action: PayloadAction<MemberProfile>) {
      state.members = [...state.members, action.payload];
    },

    setSelectedMember(state, action: PayloadAction<MemberProfile | null>) {
      state.selectedMember = action.payload;
    },

    clearSelectedMember(state) {
      state.selectedMember = null;
    },

    setMemberships(state, action: PayloadAction<ReadonlyArray<GroupMembership>>) {
      state.memberships = [...action.payload];
    },

    appendMembership(state, action: PayloadAction<GroupMembership>) {
      state.memberships = [...state.memberships, action.payload];
    },

    removeMembership(state, action: PayloadAction<string>) {
      state.memberships = state.memberships.filter((m) => m.id !== action.payload);
    },

    setOrgUnitHierarchy(state, action: PayloadAction<OrgUnitNode | null>) {
      state.orgUnitHierarchy = castDraft(action.payload);
    },

    setMemberLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setMemberError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearMemberState(state) {
      state.members = [];
      state.selectedMember = null;
      state.memberships = [];
      state.orgUnitHierarchy = null;
      state.organizationId = null;
      state.isLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        (state) => {
          state.isLoading = true;
          state.error = null;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/fulfilled'),
        (state) => {
          state.isLoading = false;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action: { payload?: { message?: string } }) => {
          state.isLoading = false;
          state.error = action.payload?.message ?? 'A member operation failed';
        },
      );
  },
});

export const {
  setOrganizationId,
  setMembers,
  appendMember,
  setSelectedMember,
  clearSelectedMember,
  setMemberships,
  appendMembership,
  removeMembership,
  setOrgUnitHierarchy,
  setMemberLoading,
  setMemberError,
  clearMemberState,
} = memberSlice.actions;

export default memberSlice.reducer;