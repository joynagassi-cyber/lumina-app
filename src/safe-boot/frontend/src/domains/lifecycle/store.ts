/**
 * Lifecycle Domain — Redux slice for local lifecycle state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 8 (LifecycleAggregate)
 * @traceability DOC-021: Physical Data Model lifecycle entities
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  ArchiveEntry,
  ArchiveEntryDomainModel,
  ArchiveEntryWithPreview,
  PurgeSchedule,
  PurgeScheduleDomainModel,
} from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface LifecycleState {
  /** Archive entries for current organization. */
  entries: ReadonlyArray<ArchiveEntryWithPreview>;

  /** Currently selected archive entry (full data). */
  selectedEntry: ArchiveEntryDomainModel;

  /** Purge schedules for current organization. */
  schedules: ReadonlyArray<PurgeSchedule>;

  /** Currently selected purge schedule. */
  selectedSchedule: PurgeScheduleDomainModel;

  /** Current organization ID. */
  organizationId: string | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;
}

const initialState: LifecycleState = {
  entries: [],
  selectedEntry: { entry: null, data: null, isLoading: false, error: null },
  schedules: [],
  selectedSchedule: { schedule: null, isLoading: false, error: null },
  organizationId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const lifecycleSlice = createSlice({
  name: 'lifecycle',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
      state.entries = [];
      state.schedules = [];
      state.selectedEntry = { entry: null, data: null, isLoading: false, error: null };
      state.selectedSchedule = { schedule: null, isLoading: false, error: null };
      state.error = null;
    },

    setEntries(state, action: PayloadAction<ReadonlyArray<ArchiveEntryWithPreview>>) {
      state.entries = [...action.payload];
    },

    appendEntry(state, action: PayloadAction<ArchiveEntryWithPreview>) {
      state.entries = [...state.entries, action.payload];
    },

    setSelectedEntry(state, action: PayloadAction<ArchiveEntryDomainModel>) {
      state.selectedEntry = action.payload;
    },

    setSchedules(state, action: PayloadAction<ReadonlyArray<PurgeSchedule>>) {
      state.schedules = [...action.payload];
    },

    appendSchedule(state, action: PayloadAction<PurgeSchedule>) {
      state.schedules = [...state.schedules, action.payload];
    },

    setSelectedSchedule(state, action: PayloadAction<PurgeScheduleDomainModel>) {
      state.selectedSchedule = action.payload;
    },

    setLifecycleLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setLifecycleError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearLifecycleState(state) {
      state.entries = [];
      state.selectedEntry = { entry: null, data: null, isLoading: false, error: null };
      state.schedules = [];
      state.selectedSchedule = { schedule: null, isLoading: false, error: null };
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
          state.error = action.payload?.message ?? 'A lifecycle operation failed';
        },
      );
  },
});

export const {
  setOrganizationId,
  setEntries,
  appendEntry,
  setSelectedEntry,
  setSchedules,
  appendSchedule,
  setSelectedSchedule,
  setLifecycleLoading,
  setLifecycleError,
  clearLifecycleState,
} = lifecycleSlice.actions;

export default lifecycleSlice.reducer;