/**
 * Workflow Domain — Redux slice for local workflow state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 5 (WorkflowAggregate)
 * @traceability DOC-021: Physical Data Model workflow entities
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStep,
} from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface WorkflowState {
  /** Workflow definitions for current organization. */
  definitions: ReadonlyArray<WorkflowDefinition>;

  /** Workflow instances for current organization. */
  instances: ReadonlyArray<WorkflowInstance>;

  /** Currently selected instance. */
  selectedInstance: WorkflowInstance | null;

  /** Steps for the selected instance. */
  steps: ReadonlyArray<WorkflowStep>;

  /** Current organization ID. */
  organizationId: string | null;

  /** Loading state. */
  isLoading: boolean;

  /** Error message. */
  error: string | null;
}

const initialState: WorkflowState = {
  definitions: [],
  instances: [],
  selectedInstance: null,
  steps: [],
  organizationId: null,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const workflowSlice = createSlice({
  name: 'workflow',
  initialState,
  reducers: {
    setOrganizationId(state, action: PayloadAction<string>) {
      state.organizationId = action.payload;
      state.definitions = [];
      state.instances = [];
      state.selectedInstance = null;
      state.steps = [];
      state.error = null;
    },

    setDefinitions(state, action: PayloadAction<ReadonlyArray<WorkflowDefinition>>) {
      state.definitions = [...action.payload];
    },

    appendDefinition(state, action: PayloadAction<WorkflowDefinition>) {
      state.definitions = [...state.definitions, action.payload];
    },

    setInstances(state, action: PayloadAction<ReadonlyArray<WorkflowInstance>>) {
      state.instances = [...action.payload];
    },

    appendInstance(state, action: PayloadAction<WorkflowInstance>) {
      state.instances = [...state.instances, action.payload];
    },

    setSelectedInstance(state, action: PayloadAction<WorkflowInstance | null>) {
      state.selectedInstance = action.payload;
      state.steps = [];
    },

    clearSelectedInstance(state) {
      state.selectedInstance = null;
      state.steps = [];
    },

    setSteps(state, action: PayloadAction<ReadonlyArray<WorkflowStep>>) {
      state.steps = [...action.payload];
    },

    setWorkflowLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
      state.error = null;
    },

    setWorkflowError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearWorkflowState(state) {
      state.definitions = [];
      state.instances = [];
      state.selectedInstance = null;
      state.steps = [];
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
          state.error = action.payload?.message ?? 'A workflow operation failed';
        },
      );
  },
});

export const {
  setOrganizationId,
  setDefinitions,
  appendDefinition,
  setInstances,
  appendInstance,
  setSelectedInstance,
  clearSelectedInstance,
  setSteps,
  setWorkflowLoading,
  setWorkflowError,
  clearWorkflowState,
} = workflowSlice.actions;

export default workflowSlice.reducer;