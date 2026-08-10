/**
 * Reporting Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 10 (ReportingAggregate)
 * @traceability ASS-001: Application Services for report generation
 */

import { useMemo } from 'react';
import type {
  GenerateReportInput,
  ListReportInstancesInput,
  ListReportsDefinitionInput,
  ReportDefinition,
  ReportGenerated,
  ReportInstanceWithPreview,
  ReportSnapshot,
  ReportType,
} from './types';
import {
  useListReportDefinitionsQuery,
  useListReportInstancesQuery,
  useListReportSnapshotsQuery,
  useGenerateReportMutation,
} from './api';

/* ------------------------------------------------------------------ */
/*  useReports                                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns reports and report definitions for an organization.
 */
export function useReports(organizationId: string | null, options?: {
  type?: ReportType;
  status?: 'draft' | 'generated' | 'failed' | 'archived';
}) {
  const listInput: ListReportsDefinitionInput = {
    organizationId: organizationId ?? '',
    ...(options?.type ? { type: options.type } : {}),
  };
  const { data: definitions, isLoading: loadingDefinitions } = useListReportDefinitionsQuery(
    listInput,
    { skip: !organizationId }
  );

  const listInstancesInput: ListReportInstancesInput = {
    organizationId: organizationId ?? '',
    ...(options?.status ? { status: options.status } : {}),
  };
  const { data: instancesResponse, isLoading: loadingInstances, error: instancesError } =
    useListReportInstancesQuery(
      listInstancesInput,
      {
        skip: !organizationId,
        ...(options && {
          forceRefetch: {
            tagTypes: ['ReportInstance'],
            minSecondsSinceTimeSynced: 5,
          },
        }),
      }
    );

  const definitionsList = definitions as ReportDefinition[] | [];
  const instances = instancesResponse?.items as ReportInstanceWithPreview[] | [];
  const totalCount = instancesResponse?.totalCount || 0;

  return useMemo(() => ({
    definitions: definitionsList,
    instances,
    totalCount,
    selectedInstance: null,
    isLoading: loadingDefinitions || loadingInstances,
    error: instancesError,
    loading: loadingDefinitions || loadingInstances,
  }), [definitionsList, instances, totalCount, loadingDefinitions, loadingInstances, instancesError]);
}

/* ------------------------------------------------------------------ */
/*  useReportSnapshot                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns the latest report snapshot for an organization.
 */
export function useReportSnapshot(organizationId: string | null) {
  const { data: snapshots, isLoading: loadingSnapshots, error: snapshotsError } =
    useListReportSnapshotsQuery(organizationId ?? '', { skip: !organizationId });

  const snapshotList = snapshots?.items || [];
  const latestSnapshot = snapshotList.length > 0 ? snapshotList[snapshotList.length - 1] : null;

  return useMemo(() => ({
    snapshot: latestSnapshot,
    allSnapshots: snapshotList,
    isLoading: loadingSnapshots,
    error: snapshotsError,
    loading: loadingSnapshots,
  }), [latestSnapshot, snapshotList, loadingSnapshots, snapshotsError]);
}

/* ------------------------------------------------------------------ */
/*  generateReport                                                     */
/* ------------------------------------------------------------------ */

/**
 * Returns the report generation mutation hook.
 */
export function useGenerateReport() {
  const [generate, { isLoading, error }] = useGenerateReportMutation();

  const execute = async (input: GenerateReportInput) => {
    if (!input.reportDefinitionId || !input.organizationId) {
      throw new Error('Required parameters missing');
    }
    return await generate(input).unwrap();
  };

  return useMemo(() => ({
    execute,
    isLoading,
    error,
    loading: isLoading,
  }), [generate, isLoading, error]);
}