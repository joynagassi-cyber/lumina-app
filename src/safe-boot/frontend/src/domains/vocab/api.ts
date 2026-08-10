/**
 * Vocabulary Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 7 (VocabularyAggregate)
 * @traceability ASS-001: Application Services for vocabulary operations
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: vocabulary_namespaces, vocabulary_terms, vocabulary_values tables
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  CreateNamespaceInput,
  CreateTermInput,
  CreateValueInput,
  ListNamespacesInput,
  NamespaceWithTerms,
  PaginatedResponse,
  TermWithValues,
  VocabularyNamespace,
  VocabularyTerm,
  VocabValue,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchVocab<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': localStorage.getItem('orgId') || '',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Vocabulary API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const vocabApi = createApi({
  reducerPath: 'vocabApi',
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
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { error: `API ${response.status}: ${errorBody || response.statusText}` };
    }

    return { data: await response.json() };
  },
  tagTypes: ['Namespace', 'Term', 'Value'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    listNamespaces: builder.query<PaginatedResponse<VocabularyNamespace>, ListNamespacesInput>({
      query: (args) => ({
        endpoint: `/namespaces/${args.organizationId}`,
        method: 'GET',
      }),
      providesTags: (_result, _err, arg) => [{ type: 'Namespace', id: arg.organizationId }],
    }),

    getNamespace: builder.query<NamespaceWithTerms, string>({
      query: (namespaceId) => ({ endpoint: `/namespaces/${namespaceId}/with-terms`, method: 'GET' }),
      providesTags: (_result, _err, namespaceId) => [{ type: 'Namespace', id: namespaceId }],
    }),

    listTerms: builder.query<TermWithValues, string>({
      query: (namespaceId) => ({ endpoint: `/namespaces/${namespaceId}/terms`, method: 'GET' }),
      providesTags: (_result, _err, namespaceId) => [{ type: 'Term', id: namespaceId }],
    }),

    getTerm: builder.query<VocabularyTerm, string>({
      query: (termId) => ({ endpoint: `/terms/${termId}`, method: 'GET' }),
      providesTags: (_result, _err, termId) => [{ type: 'Term', id: termId }],
    }),

    listValuesForTerm: builder.query<ReadonlyArray<VocabValue>, string>({
      query: (termId) => ({ endpoint: `/terms/${termId}/values`, method: 'GET' }),
      providesTags: (_result, _err, termId) => [{ type: 'Value', id: termId }],
    }),

    /* ---- Mutations ---- */

    createNamespace: builder.mutation<VocabularyNamespace, CreateNamespaceInput>({
      query: (body) => ({ endpoint: '/namespaces', method: 'POST', body }),
      invalidatesTags: [{ type: 'Namespace', id: 'LIST' }],
    }),

    updateNamespace: builder.mutation<VocabularyNamespace, { namespaceId: string; label: string; description: string | null }>({
      query: ({ namespaceId, ...body }) => ({
        endpoint: `/namespaces/${namespaceId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Namespace', id: arg.namespaceId }],
    }),

    deleteNamespace: builder.mutation<void, string>({
      query: (namespaceId) => ({
        endpoint: `/namespaces/${namespaceId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Namespace', id: 'LIST' }],
    }),

    createTerm: builder.mutation<VocabularyTerm, CreateTermInput>({
      query: (body) => ({ endpoint: '/terms', method: 'POST', body }),
      invalidatesTags: [{ type: 'Term', id: 'LIST' }],
    }),

    updateTerm: builder.mutation<VocabularyTerm, { termId: string; label: string; description: string | null }>({
      query: ({ termId, ...body }) => ({
        endpoint: `/terms/${termId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Term', id: arg.termId }],
    }),

    deleteTerm: builder.mutation<void, string>({
      query: (termId) => ({
        endpoint: `/terms/${termId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Term', id: 'LIST' }],
    }),

    createValue: builder.mutation<VocabValue, CreateValueInput>({
      query: (body) => ({ endpoint: '/values', method: 'POST', body }),
      invalidatesTags: [{ type: 'Value', id: 'LIST' }],
    }),

    updateValue: builder.mutation<VocabValue, { valueId: string; label: string; description: string | null }>({
      query: ({ valueId, ...body }) => ({
        endpoint: `/values/${valueId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Value', id: arg.valueId }],
    }),

    deleteValue: builder.mutation<void, string>({
      query: (valueId) => ({
        endpoint: `/values/${valueId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Value', id: 'LIST' }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useListNamespacesQuery,
  useGetNamespaceQuery,
  useListTermsQuery,
  useGetTermQuery,
  useListValuesForTermQuery,
  useCreateNamespaceMutation,
  useUpdateNamespaceMutation,
  useDeleteNamespaceMutation,
  useCreateTermMutation,
  useUpdateTermMutation,
  useDeleteTermMutation,
  useCreateValueMutation,
  useUpdateValueMutation,
  useDeleteValueMutation,
} = vocabApi;

export default vocabApi;