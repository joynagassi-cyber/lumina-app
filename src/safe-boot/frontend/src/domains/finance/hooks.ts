/**
 * Finance Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability ASS-001: Application Services for finance operations
 */

import { useMemo } from 'react';
import type {
  CreateTransactionInput,
  TransactionRecord,
  TransitionTransactionInput,
} from './types';
import {
  useGetTransactionsQuery,
  useCreateTransactionMutation,
  useTransitionTransactionStateMutation,
  useCompensateTransactionMutation,
  useGenerateFinancialReportMutation,
  useGetBalanceSummaryQuery,
} from './api';

/* ------------------------------------------------------------------ */
/*  useFinance                                                         */
/* ------------------------------------------------------------------ */

export function useFinance(orgId: string | null) {
  const { data: txResponse, isLoading, error } = useGetTransactionsQuery(orgId ?? '', { skip: !orgId });
  const [createTransaction] = useCreateTransactionMutation();
  const [transitionState] = useTransitionTransactionStateMutation();
  const [compensate] = useCompensateTransactionMutation();
  const [generateReport] = useGenerateFinancialReportMutation();
  const { data: balanceData } = useGetBalanceSummaryQuery(orgId ?? '', { skip: !orgId });

  const transactions = (txResponse?.items ?? []) as ReadonlyArray<TransactionRecord>;
  const balance = balanceData as { totalIncome: number; totalExpense: number } | undefined;

  return useMemo(
    () => ({
      transactions,
      isLoading,
      error,
      createTransaction: (input: CreateTransactionInput) =>
        createTransaction(input).unwrap(),
      transitionState: (input: TransitionTransactionInput) =>
        transitionState(input).unwrap(),
      compensate: (args: { originalTransactionId: string; description: string; amount: number; organizationId: string }) =>
        compensate(args).unwrap(),
      generateReport: async (params: {
        periodStart: string;
        periodEnd: string;
        scopeType: string;
        exportFormat: string;
        organizationId: string;
      }) =>
        generateReport({
          ...params,
          periodType: 'custom' as const,
        }).unwrap(),
      totalIncome: balance?.totalIncome ?? 0,
      totalExpense: balance?.totalExpense ?? 0,
      netResult: (balance?.totalIncome ?? 0) - (balance?.totalExpense ?? 0),
    }),
    [transactions, isLoading, error, createTransaction, transitionState, compensate, generateReport, balance],
  );
}

/* ------------------------------------------------------------------ */
/*  useApprovedTransactions                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns only approved (synced and immutable) transactions.
 * Filters to synced=true for report accuracy per OFFLINE-FIRST spec section 6.
 */
export function useApprovedTransactions(orgId: string | null) {
  const { data: txResponse } = useGetTransactionsByStateQuery(
    { orgId: orgId ?? '', state: 'approved' },
    { skip: !orgId },
  );

  const transactions = (txResponse ?? []) as ReadonlyArray<TransactionRecord>;

  return useMemo(() => transactions.filter((t) => t.synced), [transactions]);
}
