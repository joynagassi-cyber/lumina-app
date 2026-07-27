/**
 * Finance Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability ASS-001: Application Services for finance CRUD
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: transaction_record table
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  CompensateTransactionInput,
  CreateTransactionInput,
  GenerateReportInput,
  PaginatedResponse,
  ReportSummary,
  TransactionRecord,
  TransitionTransactionInput,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const financeApi = createApi({
  reducerPath: 'financeApi',
  baseQuery: async ({
    endpoint,
    method,
    body,
  }: {
    endpoint: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
  }) => {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      return { error: `Finance API error: ${response.status} ${response.statusText}` };
    }

    return { data: await response.json() };
  },
  tagTypes: ['Transaction', 'Category', 'Report'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    getTransactions: builder.query<PaginatedResponse<TransactionRecord>, string>({
      query: (orgId) => ({
        endpoint: `/transactions?org_id=${orgId}`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Transaction', id: 'LIST' }],
    }),

    getTransactionById: builder.query<TransactionRecord, { orgId: string; txId: string }>({
      query: ({ orgId, txId }) => ({
        endpoint: `/transactions/${txId}?org_id=${orgId}`,
        method: 'GET',
      }),
      providesTags: (_result, _err, arg) => [{ type: 'Transaction', id: arg.txId }],
    }),

    getTransactionsByState: builder.query<ReadonlyArray<TransactionRecord>, { orgId: string; state: string }>({
      query: ({ orgId, state }) => ({
        endpoint: `/transactions?org_id=${orgId}&state=${state}`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Transaction', id: 'STATE_LIST' }],
    }),

    searchTransactions: builder.query<ReadonlyArray<TransactionRecord>, { orgId: string; query: string }>({
      query: ({ orgId, query }) => ({
        endpoint: `/transactions/search?org_id=${orgId}&q=${encodeURIComponent(query)}`,
        method: 'GET',
      }),
    }),

    getCategoryById: builder.query<{ id: string; namespace: string; labelFr: string; labelEn: string; colorHex: string; isDeprecated: boolean }, string>({
      query: (catId) => ({ endpoint: `/categories/${catId}`, method: 'GET' }),
      providesTags: [{ type: 'Category', id: 'LIST' }],
    }),

    listCategories: builder.query<ReadonlyArray<{ id: string; namespace: string; labelFr: string; labelEn: string; colorHex: string; isDeprecated: boolean }>, string>({
      query: (orgId) => ({
        endpoint: `/categories?org_id=${orgId}`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Category', id: 'LIST' }],
    }),

    generateReport: builder.query<ReportSummary, string>({
      query: (reportId) => ({ endpoint: `/reports/${reportId}`, method: 'GET' }),
      providesTags: [{ type: 'Report', id: 'LIST' }],
    }),

    getBalanceSummary: builder.query<
      { totalIncome: number; totalExpense: number; netResult: number },
      string
    >({
      query: (orgId) => ({
        endpoint: `/transactions/balance?org_id=${orgId}`,
        method: 'GET',
      }),
      providesTags: [{ type: 'Report', id: 'BALANCE' }],
    }),

    exportTransactionList: builder.query<Blob, string>({
      query: (orgId) => ({
        endpoint: `/transactions/export?org_id=${orgId}`,
        method: 'GET',
      }),
      transformResponse: (raw: unknown) => raw as Blob,
    }),

    /* ---- Mutations ---- */

    createTransaction: builder.mutation<TransactionRecord, CreateTransactionInput>({
      query: (body) => ({ endpoint: '/transactions', method: 'POST', body }),
      invalidatesTags: [{ type: 'Transaction', id: 'LIST' }],
    }),

    updateTransaction: builder.mutation<
      TransactionRecord,
      { transactionId: string; organizationId: string } & Partial<CreateTransactionInput>
    >({
      query: ({ transactionId, ...body }) => ({
        endpoint: `/transactions/${transactionId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'Transaction', id: arg.transactionId },
      ],
    }),

    transitionTransactionState: builder.mutation<
      TransactionRecord,
      TransitionTransactionInput
    >({
      query: ({ organizationId, ...input }) => ({
        endpoint: `/transactions/${input.transactionId}/transition`,
        method: 'PATCH',
        body: { newState: input.newState, organizationId },
      }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'Transaction', id: arg.transactionId },
      ],
    }),

    compensateTransaction: builder.mutation<
      TransactionRecord,
      CompensateTransactionInput
    >({
      query: (body) => ({
        endpoint: '/transactions/compensate',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Transaction', id: 'LIST' }],
    }),

    deleteTransaction: builder.mutation<void, { transactionId: string; organizationId: string }>({
      query: ({ transactionId }) => ({
        endpoint: `/transactions/${transactionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Transaction', id: 'LIST' }],
    }),

    generateFinancialReport: builder.mutation<ReportSummary, GenerateReportInput>({
      query: (body) => ({
        endpoint: '/reports/generate',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Report', id: 'LIST' }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useGetTransactionsQuery,
  useGetTransactionByIdQuery,
  useGetTransactionsByStateQuery,
  useSearchTransactionsQuery,
  useGetCategoryByIdQuery,
  useListCategoriesQuery,
  useGenerateReportQuery,
  useGetBalanceSummaryQuery,
  useExportTransactionListQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useTransitionTransactionStateMutation,
  useCompensateTransactionMutation,
  useDeleteTransactionMutation,
  useGenerateFinancialReportMutation,
} = financeApi;

export default financeApi;
