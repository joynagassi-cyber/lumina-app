/**
 * Configuration Domain — barrel exports.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 9 (ConfigurationAggregate)
 */

export type {
  BulkUpdateSettingsInput,
  CreateSettingInput,
  GetSettingsInput,
  OrganizationSettings,
  SettingEntry,
  SettingType,
  SettingValue,
  UpdateSettingInput,
} from './types';

export {
  configApi,
  useGetOrganizationSettingsQuery,
  useListSettingsQuery,
  useGetSettingQuery,
  useCreateSettingMutation,
  useUpdateSettingMutation,
  useBulkUpdateSettingsMutation,
  useDeleteSettingMutation,
  useResetSettingsMutation,
} from './api';

import configReducer from './store';
export default configReducer;

export { useSettings, useSetting, useBulkUpdateSettings } from './hooks';

export { getSettingEntrySchema } from './watermelon';

export { SettingsForm, SettingEditor } from './components';