/**
 * Sync Domain — Redux slice for local sync state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 13 (OfflineSyncAggregate)
 * @traceability OFFLINE-FIRST-SPEC: Pending operation queue + conflict resolution
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ConnectionState, PendingOperation, PushBatchSize } from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface SyncState {
  pendingOperations: ReadonlyArray<PendingOperation>;
  isSyncing: boolean;
  lastSyncTimestamp: string | null;
  connectionState: ConnectionState;
  totalPushed: number;
  totalConfirmed: number;
  conflictsDetected: number;
  pushBatchSize: PushBatchSize;
  error: string | null;
}

const initialState: SyncState = {
  pendingOperations: [],
  isSyncing: false,
  lastSyncTimestamp: null,
  connectionState: 'online',
  totalPushed: 0,
  totalConfirmed: 0,
  conflictsDetected: 0,
  pushBatchSize: 50,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    addPendingOperation(state, action: PayloadAction<PendingOperation>) {
      state.pendingOperations = [...state.pendingOperations, action.payload];
    },
    removePendingOperation(state, action: PayloadAction<string>) {
      state.pendingOperations = state.pendingOperations.filter(
        (op) => op.id !== action.payload,
      );
    },
    updatePendingOperationStatus(
      state,
      action: PayloadAction<{ id: string; status: PendingOperation['syncStatus'] }>,
    ) {
      const { id, status } = action.payload;
      state.pendingOperations = state.pendingOperations.map((op) =>
        op.id === id ? { ...op, syncStatus: status } : op,
      );
    },
    setConnectionState(state, action: PayloadAction<ConnectionState>) {
      state.connectionState = action.payload;
    },
    setLastSyncTimestamp(state, action: PayloadAction<string | null>) {
      state.lastSyncTimestamp = action.payload;
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
    incrementPushed(state) {
      state.totalPushed += 1;
    },
    incrementConfirmed(state) {
      state.totalConfirmed += 1;
    },
    incrementConflictsDetected(state) {
      state.conflictsDetected += 1;
    },
    clearPendingOperations(state) {
      state.pendingOperations = [];
    },
    setSyncError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        (state) => {
          state.isSyncing = true;
          state.error = null;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/fulfilled'),
        (state) => {
          state.isSyncing = false;
        },
      )
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (
          state,
          action: { payload?: { message?: string } },
        ) => {
          state.isSyncing = false;
          state.error = action.payload?.message ?? 'Sync operation failed';
        },
      );
  },
});

export const {
  addPendingOperation,
  removePendingOperation,
  updatePendingOperationStatus,
  setConnectionState,
  setLastSyncTimestamp,
  setSyncing,
  incrementPushed,
  incrementConfirmed,
  incrementConflictsDetected,
  clearPendingOperations,
  setSyncError,
} = syncSlice.actions;

export default syncSlice.reducer;
