/**
 * Finance Domain — Redux slice for local finance state.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability DOC-021: Physical Data Model transaction_record entity
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AmountInCents, TransactionRecord } from './types';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

export interface FinanceState {
  transactions: ReadonlyArray<TransactionRecord>;
  selectedTransactionId: string | null;
  pendingTransactions: ReadonlyArray<TransactionRecord>;
  totalIncome: AmountInCents;
  totalExpense: AmountInCents;
  netResult: AmountInCents;
  isLoading: boolean;
  error: string | null;
}

const initialState: FinanceState = {
  transactions: [],
  selectedTransactionId: null,
  pendingTransactions: [],
  totalIncome: 0,
  totalExpense: 0,
  netResult: 0,
  isLoading: false,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Slice                                                              */
/* ------------------------------------------------------------------ */

const financeSlice = createSlice({
  name: 'finance',
  initialState,
  reducers: {
    setTransactions(state, action: PayloadAction<ReadonlyArray<TransactionRecord>>) {
      state.transactions = action.payload;
    },
    setSelectedTransactionId(state, action: PayloadAction<string | null>) {
      state.selectedTransactionId = action.payload;
    },
    addPendingTransaction(state, action: PayloadAction<TransactionRecord>) {
      state.pendingTransactions = [...state.pendingTransactions, action.payload];
    },
    removePendingTransaction(state, action: PayloadAction<string>) {
      state.pendingTransactions = state.pendingTransactions.filter(
        (t) => t.id !== action.payload,
      );
    },
    setBalanceSummary(
      state,
      action: PayloadAction<{ totalIncome: AmountInCents; totalExpense: AmountInCents }>,
    ) {
      state.totalIncome = action.payload.totalIncome;
      state.totalExpense = action.payload.totalExpense;
      state.netResult = action.payload.totalIncome - action.payload.totalExpense;
    },
    setFinanceLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setFinanceError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearFinanceState(state) {
      state.transactions = [];
      state.selectedTransactionId = null;
      state.pendingTransactions = [];
      state.totalIncome = 0;
      state.totalExpense = 0;
      state.netResult = 0;
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
        (
          state,
          action: { payload?: { message?: string } },
        ) => {
          state.isLoading = false;
          state.error = action.payload?.message ?? 'A finance operation failed';
        },
      );
  },
});

export const {
  setTransactions,
  setSelectedTransactionId,
  addPendingTransaction,
  removePendingTransaction,
  setBalanceSummary,
  setFinanceLoading,
  setFinanceError,
  clearFinanceState,
} = financeSlice.actions;

export default financeSlice.reducer;
