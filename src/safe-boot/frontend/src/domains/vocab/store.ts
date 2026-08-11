/**
 * Vocabulary Domain — Redux slice for local vocabulary state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 7 (VocabularyAggregate)
 * @traceability DOC-021: Physical Data Model vocabulary entities
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { castDraft } from 'immer';
import type {
  VocabularyNamespace,
  VocabularyTerm,
  VocabValue,
  TermWithValues,
  NamespaceWithTerms,
} from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface VocabState {
  /** Namespaces for current organization. */
  namespaces: ReadonlyArray<VocabularyNamespace>;

  /** Terms grouped by namespace. */
  terms: ReadonlyArray<TermWithValues>;

  /** Currently selected namespace. */
  selectedNamespace: NamespaceWithTerms | null;

  /** Current organization ID. */
  organizationId: string | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;
}

const initialState: VocabState = {
  namespaces: [],
  terms: [],
  selectedNamespace: null,
  organizationId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const vocabSlice = createSlice({
  name: 'vocab',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
      state.namespaces = [];
      state.terms = [];
      state.selectedNamespace = null;
      state.error = null;
    },

    setNamespaces(state, action: PayloadAction<ReadonlyArray<VocabularyNamespace>>) {
      state.namespaces = [...action.payload];
    },

    appendNamespace(state, action: PayloadAction<VocabularyNamespace>) {
      state.namespaces = [...state.namespaces, action.payload];
    },

    setTerms(state, action: PayloadAction<ReadonlyArray<TermWithValues>>) {
      state.terms = [...castDraft(action.payload)];
    },

    appendTerm(state, action: PayloadAction<TermWithValues>) {
      state.terms = [...state.terms, castDraft(action.payload)];
    },

    setSelectedNamespace(state, action: PayloadAction<NamespaceWithTerms | null>) {
      state.selectedNamespace = castDraft(action.payload);
    },

    clearSelectedNamespace(state) {
      state.selectedNamespace = null;
    },

    setVocabLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setVocabError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearVocabState(state) {
      state.namespaces = [];
      state.terms = [];
      state.selectedNamespace = null;
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
          state.error = action.payload?.message ?? 'A vocabulary operation failed';
        },
      );
  },
});

export const {
  setOrganizationId,
  setNamespaces,
  appendNamespace,
  setTerms,
  appendTerm,
  setSelectedNamespace,
  clearSelectedNamespace,
  setVocabLoading,
  setVocabError,
  clearVocabState,
} = vocabSlice.actions;

export default vocabSlice.reducer;