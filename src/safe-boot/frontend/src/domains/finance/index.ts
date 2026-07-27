/**
 * Finance Domain — barrel exports.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 */

export type {
  AmountInCents,
  Category,
  CompensateTransactionInput,
  CreateTransactionInput,
  GenerateReportInput,
  PeriodType,
  ReportFormat,
  ReportSummary,
  ScopeType,
  TransactionRecord,
  TransactionState,
  TransactionType,
  TransitionTransactionInput,
} from './types';

export {
  financeApi,
  useCompensateTransactionMutation,
  useCreateTransactionMutation,
  useDeleteTransactionMutation,
  useExportTransactionListQuery,
  useGenerateFinancialReportMutation,
  useGenerateReportQuery,
  useGetBalanceSummaryQuery,
  useGetCategoryByIdQuery,
  useGetTransactionByIdQuery,
  useGetTransactionsByStateQuery,
  useGetTransactionsQuery,
  useListCategoriesQuery,
  useSearchTransactionsQuery,
  useTransitionTransactionStateMutation,
  useUpdateTransactionMutation,
} from './api';

export { default as financeReducer } from './store';

export { useApprovedTransactions, useFinance } from './hooks';

export { getTransactionSchema } from './watermelon';

export { TransactionTable } from './components';

