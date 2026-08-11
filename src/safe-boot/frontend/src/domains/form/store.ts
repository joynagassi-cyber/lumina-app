/**
 * Form Domain — Redux slice for local form state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 6 (FormAggregate)
 * @traceability DOC-021: Physical Data Model form entities
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { castDraft } from 'immer';
import type {
  FormDefinition,
  FormSubmission,
  FormField,
} from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface FormState {
  /** Form definitions for current organization. */
  forms: ReadonlyArray<FormDefinition>;

  /** Currently selected form. */
  selectedForm: FormDefinition | null;

  /** Submissions for the selected form. */
  submissions: ReadonlyArray<FormSubmission>;

  /** Current organization ID. */
  organizationId: string | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;
}

const initialState: FormState = {
  forms: [],
  selectedForm: null,
  submissions: [],
  organizationId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const formSlice = createSlice({
  name: 'form',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
      state.forms = [];
      state.selectedForm = null;
      state.submissions = [];
      state.error = null;
    },

    setForms(state, action: PayloadAction<ReadonlyArray<FormDefinition>>) {
      state.forms = [...castDraft(action.payload)];
    },

    appendForm(state, action: PayloadAction<FormDefinition>) {
      state.forms = [...state.forms, castDraft(action.payload)];
    },

    setSelectedForm(state, action: PayloadAction<FormDefinition | null>) {
      state.selectedForm = castDraft(action.payload);
      state.submissions = [];
    },

    clearSelectedForm(state) {
      state.selectedForm = null;
      state.submissions = [];
    },

    setSubmissions(state, action: PayloadAction<ReadonlyArray<FormSubmission>>) {
      state.submissions = [...action.payload];
    },

    appendSubmission(state, action: PayloadAction<FormSubmission>) {
      state.submissions = [...state.submissions, action.payload];
    },

    setFormLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setFormError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearFormState(state) {
      state.forms = [];
      state.selectedForm = null;
      state.submissions = [];
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
          state.error = action.payload?.message ?? 'A form operation failed';
        },
      );
  },
});

export const {
  setOrganizationId,
  setForms,
  appendForm,
  setSelectedForm,
  clearSelectedForm,
  setSubmissions,
  appendSubmission,
  setFormLoading,
  setFormError,
  clearFormState,
} = formSlice.actions;

export default formSlice.reducer;