/**
 * Form Domain — RTK Query API layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 6 (FormAggregate)
 * @traceability ASS-001: Application Services for form operations
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: forms, form_submissions tables
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import type {
  CreateFormInput,
  FormDefinition,
  FormField,
  FormSubmission,
  ListFormsInput,
  PaginatedResponse,
  SubmitFormInput,
  UpdateFormInput,
} from './types';

/* ------------------------------------------------------------------ */
/*  Base query fetcher                                                 */
/* ------------------------------------------------------------------ */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function fetchForms<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': localStorage.getItem('orgId') || '',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Form API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/*  RTK Query API definition                                           */
/* ------------------------------------------------------------------ */

export const formApi = createApi({
  reducerPath: 'formApi',
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
  tagTypes: ['Form', 'Submission'],
  endpoints: (builder) => ({
    /* ---- Queries ---- */

    listForms: builder.query<PaginatedResponse<FormDefinition>, ListFormsInput>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.status) params.append('status', args.status);
        if (args.page) params.append('page', args.page.toString());
        if (args.limit) params.append('limit', args.limit.toString());
        return {
          endpoint: `/forms/${args.organizationId}?${params.toString()}`,
          method: 'GET',
        };
      },
      providesTags: (_result, _err, arg) => [{ type: 'Form', id: arg.organizationId }],
    }),

    getForm: builder.query<FormDefinition, string>({
      query: (formId) => ({ endpoint: `/forms/${formId}`, method: 'GET' }),
      providesTags: (_result, _err, formId) => [{ type: 'Form', id: formId }],
    }),

    listFormSubmissions: builder.query<PaginatedResponse<FormSubmission>, string>({
      query: (formId) => ({ endpoint: `/forms/${formId}/submissions`, method: 'GET' }),
      providesTags: (_result, _err, formId) => [{ type: 'Submission', id: formId }],
    }),

    getSubmission: builder.query<FormSubmission, string>({
      query: (submissionId) => ({ endpoint: `/submissions/${submissionId}`, method: 'GET' }),
      providesTags: (_result, _err, submissionId) => [{ type: 'Submission', id: submissionId }],
    }),

    /* ---- Mutations ---- */

    createForm: builder.mutation<FormDefinition, CreateFormInput>({
      query: (body) => ({ endpoint: '/forms', method: 'POST', body }),
      invalidatesTags: [{ type: 'Form', id: 'LIST' }],
    }),

    updateForm: builder.mutation<FormDefinition, UpdateFormInput>({
      query: ({ formId, ...body }) => ({
        endpoint: `/forms/${formId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Form', id: arg.formId }],
    }),

    deactivateForm: builder.mutation<FormDefinition, string>({
      query: (formId) => ({
        endpoint: `/forms/${formId}/deactivate`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, formId) => [{ type: 'Form', id: formId }],
    }),

    activateForm: builder.mutation<FormDefinition, string>({
      query: (formId) => ({
        endpoint: `/forms/${formId}/activate`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Form', id: 'LIST' }],
    }),

    submitForm: builder.mutation<FormSubmission, SubmitFormInput>({
      query: (body) => ({ endpoint: '/forms/submissions', method: 'POST', body }),
      invalidatesTags: [{ type: 'Submission', id: 'LIST' }],
    }),

    updateSubmissionStatus: builder.mutation<FormSubmission, { submissionId: string; status: FormSubmission['status'] }>({
      query: ({ submissionId, status }) => ({
        endpoint: `/submissions/${submissionId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: 'Submission', id: arg.submissionId }],
    }),

    deleteForm: builder.mutation<void, string>({
      query: (formId) => ({
        endpoint: `/forms/${formId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Form', id: 'LIST' }],
    }),
  }),
});

/* ------------------------------------------------------------------ */
/*  Exported hooks                                                     */
/* ------------------------------------------------------------------ */

export const {
  useListFormsQuery,
  useGetFormQuery,
  useListFormSubmissionsQuery,
  useGetSubmissionQuery,
  useCreateFormMutation,
  useUpdateFormMutation,
  useDeactivateFormMutation,
  useActivateFormMutation,
  useSubmitFormMutation,
  useUpdateSubmissionStatusMutation,
  useDeleteFormMutation,
} = formApi;

export default formApi;