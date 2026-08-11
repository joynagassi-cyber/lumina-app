/**
 * Lifecycle Domain — barrel exports.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 8 (LifecycleAggregate)
 */

export type {
  ArchiveCommandInput,
  ArchiveEntry,
  ArchiveEntryWithPreview,
  ListArchivesInput,
  PurgeSchedule,
  UpdatePurgeScheduleInput,
  ArchiveState,
  PurgeScheduleStatus,
} from './types';

export {
  lifecycleApi,
  useListArchivesQuery,
  useGetArchiveEntryQuery,
  useListPurgeSchedulesQuery,
  useGetPurgeScheduleQuery,
  useArchiveResourceMutation,
  usePurgeArchiveEntryMutation,
  useRestoreArchiveEntryMutation,
  useCreatePurgeScheduleMutation,
  useUpdatePurgeScheduleMutation,
  useTriggerPurgeNowMutation,
} from './api';

import lifecycleReducer from './store';
export default lifecycleReducer;

export { useArchives, useArchiveEntry, usePurgeSchedule } from './hooks';

export { getArchiveEntrySchema, getPurgeScheduleSchema } from './watermelon';

export { ArchiveList, ArchiveEntryDetail } from './components';