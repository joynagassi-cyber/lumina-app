/**
 * ArchiveEntryState — state machine for archive lifecycle.
 * Transitions: draft -> active -> archived -> trashed -> purged
 *              trashed -> active (restore)
 *              archived -> active (reopen)
 *              purged is irreversible.
 *
 * @traceability DOC-012 Aggregate3, DOC-012 §2.11 (LifecycleAggregate), NB-LIF-003
 */

export enum ArchiveEntryState {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  TRASHED = 'trashed',
  PURGED = 'purged',
}

export const ARCHIVE_STATE_TRANSITIONS: Record<ArchiveEntryState, readonly ArchiveEntryState[]> = {
  [ArchiveEntryState.DRAFT]: [ArchiveEntryState.ACTIVE],
  [ArchiveEntryState.ACTIVE]: [ArchiveEntryState.ARCHIVED],
  [ArchiveEntryState.ARCHIVED]: [ArchiveEntryState.TRASHED, ArchiveEntryState.ACTIVE],
  [ArchiveEntryState.TRASHED]: [ArchiveEntryState.ACTIVE, ArchiveEntryState.PURGED],
  [ArchiveEntryState.PURGED]: [],
};

export function canTransitionFrom(current: ArchiveEntryState): readonly ArchiveEntryState[] {
  return ARCHIVE_STATE_TRANSITIONS[current] ?? [];
}
