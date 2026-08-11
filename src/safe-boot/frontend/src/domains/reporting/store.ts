/**
 * Reporting Domain — Redux slice for local reporting state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 10 (ReportingAggregate)
 * @traceability DOC-021: Physical Data Model reporting entities
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  ReportDefinition,
  ReportGenerated,
  ReportInstanceWithPreview,
  ReportSnapshot,
} from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface ReportingState {
  /** Report definitions for current organization. */
  definitions: ReadonlyArray<ReportDefinition>;

  /** Generated report instances for current organization. */
  instances: ReadonlyArray<ReportInstanceWithPreview>;

  /** Report snapshots for current organization. */
  snapshots: ReadonlyArray<ReportSnapshot>;

  /** Currently selected report instance. */
  selectedInstance: ReportGenerated | null;

  /** Currently selected snapshot. */
  selectedSnapshot: ReportSnapshot | null;

  /** Current organization ID. */
  organizationId: string | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;
}

const initialState: ReportingState = {
  definitions: [],
  instances: [],
  snapshots: [],
  selectedInstance: null,
  selectedSnapshot: null,
  organizationId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const reportingSlice = createSlice({
  name: 'reporting',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
      state.definitions = [];
      state.instances = [];
      state.snapshots = [];
      state.selectedInstance = null;
      state.selectedSnapshot = null;
      state.error = null;
    },

    setDefinitions(state, action: PayloadAction<ReadonlyArray<ReportDefinition>>) {
      state.definitions = [...action.payload];
    },

    setInstances(state, action: PayloadAction<ReadonlyArray<ReportInstanceWithPreview>>) {
      state.instances = [...action.payload];
    },

    appendInstance(state, action: PayloadAction<ReportInstanceWithPreview>) {
      state.instances = [...state.instances, action.payload];
    },

    setSnapshots(state, action: PayloadAction<ReadonlyArray<ReportSnapshot>>) {
      state.snapshots = [...action.payload];
    },

    setSelectedInstance(state, action: PayloadAction<ReportGenerated | null>) {
      state.selectedInstance = action.payload;
    },

    setSelectedSnapshot(state, action: PayloadAction<ReportSnapshot | null>) {
      state.selectedSnapshot = action.payload;
    },

    clearSelection(state) {
      state.selectedInstance = null;
      state.selectedSnapshot = null;
    },

    setReportingLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setReportingError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearReportingState(state) {
      state.definitions = [];
      state.instances = [];
      state.snapshots = [];
      state.selectedInstance = null;
      state.selectedSnapshot = null;
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
          state.error = action.payload?.message ?? 'A reporting operation failed';
        },
      );
  },
});

export const {
  setOrganizationId,
  setDefinitions,
  setInstances,
  appendInstance,
  setSnapshots,
  setSelectedInstance,
  setSelectedSnapshot,
  clearSelection,
  setReportingLoading,
  setReportingError,
  clearReportingState,
} = reportingSlice.actions;

export default reportingSlice.reducer;