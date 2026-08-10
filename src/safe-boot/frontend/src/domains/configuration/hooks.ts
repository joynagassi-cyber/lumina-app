/**
 * Configuration Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 9 (ConfigurationAggregate)
 * @traceability ASS-001: Application Services for configuration operations
 */

import { useMemo } from 'react';
import type { OrganizationSettings, SettingEntry, SettingValue } from './types';
import {
  useGetOrganizationSettingsQuery,
  useListSettingsQuery,
  useGetSettingQuery,
  useBulkUpdateSettingsMutation,
} from './api';

/* ------------------------------------------------------------------ */
/*  useSettings                                                        */
/* ------------------------------------------------------------------ */

/**
 * Returns organization settings profile and entries.
 */
export function useSettings(organizationId: string | null) {
  const { data: settings, isLoading: loadingSettings, error: settingsError } =
    useGetOrganizationSettingsQuery(organizationId ?? '', { skip: !organizationId });

  const { data: entries, isLoading: loadingEntries, error: entriesError } = useListSettingsQuery(
    organizationId ?? '',
    { skip: !organizationId }
  );

  const orgSettings = settings as OrganizationSettings | undefined;
  const entryList = entries as SettingEntry[] | [];

  return useMemo(() => ({
    settings: orgSettings ?? null,
    entries: entryList,
    selectedSetting: null,
    isLoading: loadingSettings || loadingEntries,
    error: settingsError || entriesError,
    loading: loadingSettings || loadingEntries,
  }), [orgSettings, entryList, loadingSettings, loadingEntries, settingsError, entriesError]);
}

/* ------------------------------------------------------------------ */
/*  useSetting                                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns a specific setting by ID.
 */
export function useSetting(organizationId: string | null, settingId: string | null) {
  const { data: setting, isLoading: loadingSetting, error: settingError } = useGetSettingQuery(
    settingId ?? '',
    { skip: !settingId || !organizationId }
  );

  const settingEntry = setting as SettingEntry | undefined;

  return useMemo(() => ({
    setting: settingEntry ?? null,
    isLoading: loadingSetting,
    error: settingError,
    loading: loadingSetting,
  }), [settingEntry, loadingSetting, settingError]);
}

/* ------------------------------------------------------------------ */
/*  bulkUpdateSettings                                                 */
/* ------------------------------------------------------------------ */

/**
 * Returns the bulk update settings mutation hook.
 */
export function useBulkUpdateSettings() {
  const [bulkUpdate, { isLoading, error }] = useBulkUpdateSettingsMutation();

  const execute = async (organizationId: string, updates: Record<string, SettingValue>) => {
    if (!organizationId) throw new Error('Organization ID required');
    return await bulkUpdate({ organizationId, updates }).unwrap();
  };

  return useMemo(() => ({
    execute,
    isLoading,
    error,
    loading: isLoading,
  }), [bulkUpdate, isLoading, error]);
}