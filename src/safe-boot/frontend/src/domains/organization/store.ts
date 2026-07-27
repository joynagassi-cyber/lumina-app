/**
 * Organization Domain — Redux slice for local org state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 1 (OrganizationAggregate)
 * @traceability DOC-021: Physical Data Model organization entity
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  OrganizationProfile,
  OrgUnit,
} from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface OrganizationState {
  currentOrg: OrganizationProfile | null;
  orgUnits: ReadonlyArray<OrgUnit>;
  selectedOrgId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: OrganizationState = {
  currentOrg: null,
  orgUnits: [],
  selectedOrgId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const orgSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    setCurrentOrg(state, action: PayloadAction<OrganizationProfile | null>) {
      state.currentOrg = action.payload;
      state.selectedOrgId = action.payload?.id ?? null;
      state.error = null;
    },
    setOrgUnits(state, action: PayloadAction<ReadonlyArray<OrgUnit>>) {
      state.orgUnits = action.payload;
    },
    setSelectedOrgId(state, action: PayloadAction<string>) {
      state.selectedOrgId = action.payload;
    },
    setOrgLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setOrgError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    appendOrgUnit(state, action: PayloadAction<OrgUnit>) {
      state.orgUnits = [...state.orgUnits, action.payload];
    },
    removeOrgUnit(state, action: PayloadAction<string>) {
      state.orgUnits = state.orgUnits.filter((u) => u.id !== action.payload);
    },
    clearOrganizationState(state) {
      state.currentOrg = null;
      state.orgUnits = [];
      state.selectedOrgId = null;
      state.error = null;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        // Any RTK Query pending for org endpoints
        (action): action is { meta: { arg: { endpointName: string } } } =>
          typeof action === 'object' &&
          action !== null &&
          'meta' in action &&
          action.meta &&
          'endpointName' in action.meta &&
          typeof action.meta.endpointName === 'string' &&
          action.meta.endpointName.startsWith('organizationApi.') ||
          false,
      )
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        (state) => {
          state.isLoading = true;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/fulfilled') && !action.type.includes('create'),
        (state) => {
          state.isLoading = false;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action: { payload?: { message?: string }; meta: { rejected?: boolean } }) => {
          state.isLoading = false;
          state.error =
            action.payload?.message ?? 'An unknown organization error occurred';
        },
      );
  },
});

export const {
  setCurrentOrg,
  setOrgUnits,
  setSelectedOrgId,
  setOrgLoading,
  setOrgError,
  appendOrgUnit,
  removeOrgUnit,
  clearOrganizationState,
} = orgSlice.actions;

export default orgSlice.reducer;
