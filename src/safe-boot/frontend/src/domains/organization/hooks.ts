/**
 * Organization Domain — custom React hooks.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 1 (OrganizationAggregate)
 * @traceability ASS-001: Application Services for org operations
 */

import { useCallback, useMemo } from 'react';
import type { OrganizationProfile, OrgUnit, UpdateOrganizationSettingsInput } from './types';
import {
  useGetOrganizationProfileQuery,
  useListOrganizationUnitsQuery,
  useUpdateOrganizationSettingsMutation,
  useCreateOrgUnitMutation,
  useSuspendOrganizationMutation,
  useArchiveOrganizationMutation,
} from './api';

/* ------------------------------------------------------------------ */
/*  useOrganization                                                    */
/* ------------------------------------------------------------------ */

export function useOrganization(orgId: string | null) {
  const { data: profile, isLoading: loadingProfile, error: profileError } = useGetOrganizationProfileQuery(orgId!, { skip: !orgId });
  const { data: unitsResponse, isLoading: loadingUnits } = useListOrganizationUnitsQuery(orgId ?? '', { skip: !orgId });
  const [updateSettings] = useUpdateOrganizationSettingsMutation();
  const [createUnit] = useCreateOrgUnitMutation();
  const [suspend] = useSuspendOrganizationMutation();
  const [archive] = useArchiveOrganizationMutation();

  const profileData = profile as OrganizationProfile | undefined;
  const unitsData = unitsResponse?.items as OrgUnit[] | undefined;

  return useMemo(
    () => ({
      profile: profileData ?? null,
      units: unitsData ?? [],
      isLoading: loadingProfile || loadingUnits,
      error: profileError,
      updateSettings: (settings: UpdateOrganizationSettingsInput) =>
        updateSettings({ ...settings, organizationId: orgId! }),
      createUnit: (name: string) =>
        createUnit({ name, organizationId: orgId! }),
      suspend: () =>
        suspend({ organizationId: orgId! }),
      archive: () =>
        archive({ organizationId: orgId! }),
    }),
    [profileData, unitsData, loadingProfile, loadingUnits, profileError, orgId, updateSettings, createUnit, suspend, archive],
  );
}

/* ------------------------------------------------------------------ */
/*  useActiveUnits                                                     */
/* ------------------------------------------------------------------ */

/**
 * Returns only active (non-archived) org units.
 * Maps to BR-ORG visibility policy for org units.
 */
export function useActiveUnits(orgId: string | null) {
  const { data: unitsResponse } = useListOrganizationUnitsQuery(orgId ?? '', { skip: !orgId });
  const units = (unitsResponse?.items ?? []) as ReadonlyArray<OrgUnit>;

  return useMemo(() => units.filter((u) => u.status === 'active'), [units]);
}
