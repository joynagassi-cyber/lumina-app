/**
 * Configuration Domain — Redux slice for local configuration state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 9 (ConfigurationAggregate)
 * @traceability DOC-021: Physical Data Model organization_settings entity
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OrganizationSettings, SettingEntry } from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface ConfigurationState {
  /** Organization settings profile. */
  settings: OrganizationSettings | null;

  /** Setting entries list. */
  entries: ReadonlyArray<SettingEntry>;

  /** Currently selected setting. */
  selectedSetting: SettingEntry | null;

  /** Current organization ID. */
  organizationId: string | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;
}

const initialState: ConfigurationState = {
  settings: null,
  entries: [],
  selectedSetting: null,
  organizationId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const configSlice = createSlice({
  name: 'configuration',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
      state.settings = null;
      state.entries = [];
      state.selectedSetting = null;
      state.error = null;
    },

    setSettings(state, action: PayloadAction<OrganizationSettings>) {
      state.settings = action.payload;
    },

    setEntries(state, action: PayloadAction<ReadonlyArray<SettingEntry>>) {
      state.entries = [...action.payload];
    },

    appendEntry(state, action: PayloadAction<SettingEntry>) {
      state.entries = [...state.entries, action.payload];
    },

    setSelectedSetting(state, action: PayloadAction<SettingEntry | null>) {
      state.selectedSetting = action.payload;
    },

    clearSelectedSetting(state) {
      state.selectedSetting = null;
    },

    setConfigLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setConfigError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearConfigState(state) {
      state.settings = null;
      state.entries = [];
      state.selectedSetting = null;
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
          state.error = action.payload?.message ?? 'A configuration operation failed';
        },
      );
  },
});

export const {
  setOrganizationId,
  setSettings,
  setEntries,
  appendEntry,
  setSelectedSetting,
  clearSelectedSetting,
  setConfigLoading,
  setConfigError,
  clearConfigState,
} = configSlice.actions;

export default configSlice.reducer;