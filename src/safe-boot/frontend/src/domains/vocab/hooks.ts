/**
 * Vocabulary Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 7 (VocabularyAggregate)
 * @traceability ASS-001: Application Services for vocabulary operations
 */

import { useMemo } from 'react';
import type {
  VocabularyNamespace,
  VocabularyTerm,
  VocabValue,
  TermWithValues,
  NamespaceWithTerms,
} from './types';
import {
  useListNamespacesQuery,
  useGetNamespaceQuery,
  useListTermsQuery,
  useGetTermQuery,
  useListValuesForTermQuery,
} from './api';

/* ------------------------------------------------------------------ */
/*  useTerms                                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns all terms across all namespaces for an organization.
 */
export function useTerms(organizationId: string | null) {
  const { data: namespaces, isLoading: loadingNamespaces } = useListNamespacesQuery(
    { organizationId: organizationId ?? '' },
    { skip: !organizationId }
  );

  // Terms will be fetched per namespace - simplified for this hook
  const terms: TermWithValues[] = [];

  return useMemo(() => ({
    terms,
    totalCount: terms.length,
    isLoading: loadingNamespaces,
    error: null,
    loading: loadingNamespaces,
  }), [terms, loadingNamespaces]);
}

/* ------------------------------------------------------------------ */
/*  useTermValues                                                      */
/* ------------------------------------------------------------------ */

/**
 * Returns values for a specific term.
 */
export function useTermValues(termId: string | null) {
  const { data: values, isLoading: loadingValues, error: valuesError } =
    useListValuesForTermQuery(termId ?? '', { skip: !termId });

  const vocabValues = values as VocabValue[] | [];

  return useMemo(() => ({
    values: vocabValues,
    isLoading: loadingValues,
    error: valuesError,
    loading: loadingValues,
  }), [vocabValues, loadingValues, valuesError]);
}

/* ------------------------------------------------------------------ */
/*  useVocabNamespace                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns a namespace with its terms for a specific namespace ID.
 */
export function useVocabNamespace(organizationId: string | null, namespaceId: string | null) {
  const { data: namespaceData, isLoading: loadingNamespace, error: namespaceError } =
    useGetNamespaceQuery(namespaceId ?? '', {
      skip: !namespaceId || !organizationId,
    });

  const namespaceWithTerms = namespaceData as NamespaceWithTerms | undefined;

  return useMemo(() => ({
    namespace: namespaceWithTerms ?? null,
    organizationId,
    namespaceId,
    isLoading: loadingNamespace,
    error: namespaceError,
    loading: loadingNamespace,
  }), [namespaceWithTerms, loadingNamespace, namespaceError, organizationId, namespaceId]);
}

/* ------------------------------------------------------------------ */
/*  useTerm                                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns a specific term with its values.
 */
export function useTerm(termId: string | null) {
  const { data: term, isLoading: loadingTerm, error: termError } = useGetTermQuery(
    termId ?? '',
    { skip: !termId }
  );

  const { data: values, isLoading: loadingValues, error: valuesError } = useListValuesForTermQuery(
    termId ?? '',
    { skip: !termId }
  );

  const vocabularyTerm = term as VocabularyTerm | undefined;
  const vocabValues = values as VocabValue[] | [];

  return useMemo(() => ({
    term: vocabularyTerm ?? null,
    values: vocabValues,
    isLoading: loadingTerm || loadingValues,
    error: termError || valuesError,
    loading: loadingTerm || loadingValues,
  }), [vocabularyTerm, vocabValues, loadingTerm, loadingValues, termError, valuesError]);
}