/**
 * Lifecycle Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 8 (LifecycleAggregate)
 * @traceability ASS-001: Application Services for archive/purge operations
 */

import { useMemo } from 'react';
import type {
  ArchiveEntryWithPreview,
  ArchiveState,
  PurgeSchedule,
} from './types';
import {
  useListArchivesQuery,
  useListPurgeSchedulesQuery,
  useGetArchiveEntryQuery,
} from './api';

/* ------------------------------------------------------------------ */
/*  useArchives                                                        */
/* ------------------------------------------------------------------ */

/**
 * Returns archive entries for an organization with filtering.
 */
export function useArchives(organizationId: string | null, options?: {
  resourceType?: string;
  state?: ArchiveState;
}) {
  const { data: archivesResponse, isLoading: loadingArchives, error: archivesError } =
    useListArchivesQuery(
      {
        organizationId: organizationId ?? '',
        ...(options ? {
          resourceType: options.resourceType,
          state: options.state,
        } : {}),
      },
      {
        skip: !organizationId,
        ...(options && {
          forceRefetch: {
            tagTypes: ['ArchiveEntry'],
            minSecondsSinceTimeSynced: 5,
          },
        }),
      }
    );

  const entries = archivesResponse?.items as ArchiveEntryWithPreview[] | [];
  const totalCount = archivesResponse?.totalCount || 0;

  return useMemo(() => ({
    entries,
    totalCount,
    isLoading: loadingArchives,
    error: archivesError,
    loading: loadingArchives,
  }), [entries, totalCount, loadingArchives, archivesError]);
}

/* ------------------------------------------------------------------ */
/*  useArchiveEntry                                                    */
/* ------------------------------------------------------------------ */

/**
 * Returns a specific archive entry with full data.
 */
export function useArchiveEntry(organizationId: string | null, entryId: string | null) {
  const { data: entryData, isLoading: loadingEntry, error: entryError } =
    useGetArchiveEntryQuery(entryId ?? '', {
      skip: !entryId || !organizationId,
    });

  return useMemo(() => ({
    entry: entryData,
    isLoading: loadingEntry,
    error: entryError,
    loading: loadingEntry,
  }), [entryData, loadingEntry, entryError]);
}

/* ------------------------------------------------------------------ */
/*  usePurgeSchedule                                                   */
/* ------------------------------------------------------------------ */

/**
 * Returns purge schedule for an organization.
 */
export function usePurgeSchedule(organizationId: string | null) {
  const { data: schedules, isLoading: loadingSchedules, error: schedulesError } =
    useListPurgeSchedulesQuery(organizationId ?? '', { skip: !organizationId });

  const primarySchedule = schedules?.items?.find(s => s.name === 'primary') || schedules?.items?.[0];

  return useMemo(() => ({
    schedule: primarySchedule || null,
    allSchedules: schedules?.items || [],
    isLoading: loadingSchedules,
    error: schedulesError,
    loading: loadingSchedules,
  }), [primarySchedule, schedules?.items, loadingSchedules, schedulesError]);
}