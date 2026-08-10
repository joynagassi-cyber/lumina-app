/**
 * Form Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 6 (FormAggregate)
 * @traceability ASS-001: Application Services for form operations
 */

import { useMemo } from 'react';
import type {
  FormDefinition,
  FormSubmission,
} from './types';
import {
  useListFormsQuery,
  useGetFormQuery,
  useListFormSubmissionsQuery,
  useGetSubmissionQuery,
} from './api';

/* ------------------------------------------------------------------ */
/*  useForms                                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns list of form definitions for an organization.
 */
export function useForms(organizationId: string | null) {
  const { data: formsResponse, isLoading: loadingForms, error: formsError } = useListFormsQuery(
    { organizationId: organizationId ?? '' },
    { skip: !organizationId }
  );

  const forms = formsResponse?.items as FormDefinition[] | [];
  const totalCount = formsResponse?.totalCount || 0;

  return useMemo(() => ({
    forms,
    totalCount,
    selectedForm: null,
    isLoading: loadingForms,
    error: formsError,
    loading: loadingForms,
  }), [forms, totalCount, loadingForms, formsError]);
}

/* ------------------------------------------------------------------ */
/*  useFormDefinition                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns a specific form definition by ID.
 */
export function useFormDefinition(organizationId: string | null, formId: string | null) {
  const { data: form, isLoading: loadingForm, error: formError } = useGetFormQuery(
    formId ?? '',
    { skip: !formId || !organizationId }
  );

  const formDefinition = form as FormDefinition | undefined;

  return useMemo(() => ({
    form: formDefinition ?? null,
    isLoading: loadingForm,
    error: formError,
    loading: loadingForm,
  }), [formDefinition, loadingForm, formError]);
}

/* ------------------------------------------------------------------ */
/*  useFormSubmission                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns a specific form submission by ID with resolved data.
 */
export function useFormSubmission(organizationId: string | null, submissionId: string | null) {
  const { data: submission, isLoading: loadingSubmission, error: submissionError } = useGetSubmissionQuery(
    submissionId ?? '',
    { skip: !submissionId || !organizationId }
  );

  const sub = submission as FormSubmission | undefined;

  // Resolve submission data with field labels (simplified - would need form definition lookup)
  const dataResolved = sub?.data ?? {};

  return useMemo(() => ({
    submission: sub ?? null,
    dataResolved,
    isLoading: loadingSubmission,
    error: submissionError,
    loading: loadingSubmission,
  }), [sub, dataResolved, loadingSubmission, submissionError]);
}

/* ------------------------------------------------------------------ */
/*  useFormRenderer                                                    */
/* ------------------------------------------------------------------ */

/**
 * Returns a form rendering hook for a form definition.
 * Note: This is a placeholder - actual form rendering would be in components.
 */
export function useFormRenderer(form: FormDefinition | null) {
  return useMemo(() => ({
    form,
    fields: form?.fields || [],
    isLoaded: !!form,
  }), [form]);
}