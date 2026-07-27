/**
 * Organization Domain — barrel exports.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 1 (OrganizationAggregate)
 */

export type {
  ChangeOrgUnitParentInput,
  CreateOrgUnitInput,
  CreateOrganizationInput,
  OrgHierarchyNode,
  OrganizationDomainModel,
  OrganizationName,
  OrganizationProfile,
  OrganizationStatus,
  OrganizationType,
  OrgHierarchyPath,
  OrgUnit,
  PaginatedResponse,
  UpdateOrganizationSettingsInput,
} from './types';

export {
  organizationApi,
  useCreateOrganizationMutation,
  useCreateOrgUnitMutation,
  useArchiveOrganizationMutation,
  useGetOrgByStatusQuery,
  useGetOrgHierarchyQuery,
  useGetOrganizationProfileQuery,
  useListOrganizationsQuery,
  useListOrganizationUnitsQuery,
  useMergeOrganizationsMutation,
  useSuspendOrganizationMutation,
  useTransferOrgUnitMutation,
  useUpdateOrganizationSettingsMutation,
  useUpdateOrgUnitParentMutation,
} from './api';

export { default as orgReducer } from './store';

export { useActiveUnits, useOrganization } from './hooks';

export { getOrganizationSchema } from './watermelon';

export { OrganizationSettingsForm } from './components';
