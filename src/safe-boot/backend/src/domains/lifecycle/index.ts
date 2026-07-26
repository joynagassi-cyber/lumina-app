/**
 * LifecycleAggregate — barrel export.
 *
 * @traceability DOC-012 Aggregate11
 */

export { LifecycleService } from './application/lifecycle.service';
export type { ArchiveResourceInput, ArchiveEntryWithEvents } from './application/lifecycle.service';
export { EntryNotFoundError, AlreadyTrashedError, CannotRestoreError, PurgeScheduleNotFoundError } from './application/lifecycle.service';

export { ArchiveEntry } from './domain/entities/archive-entry.entity';
export type { ArchiveEntryProps } from './domain/entities/archive-entry.entity';
export { ResourceArchived, ResourceTrashed, ResourcePurged, ResourceRestoredFromTrash, PurgeScheduled } from './domain/entities/archive-entry.entity';

export { LifecycleState, getValidTransitions, validateTransition, InvalidLifecycleTransitionError } from './domain/value-objects/lifecycle-state.vo';
export { RetentionPeriod, InvalidRetentionPeriodError } from './domain/value-objects/retention-period.vo';
export { ArchiveType, InvalidArchiveTypeError } from './domain/value-objects/archive-type.vo';
export { TagCollection } from './domain/value-objects/tag-collection.vo';
export { CategoryRef, InvalidCategoryRefError } from './domain/value-objects/category-ref.vo';
export { AttachmentUrlList, InvalidAttachmentUrlListError } from './domain/value-objects/attachment-url-list.vo';

export { StateTransitionValidator } from './domain/services/state-transition-validator.service';
export { PurgeScheduler } from './domain/services/purge-scheduler.service';
export type { PurgeCandidate } from './domain/services/purge-scheduler.service';

export { ArchiveRetentionPolicy } from './domain/policies/archive-retention-policy';
export type { ArchivableTypeConfig } from './domain/policies/archive-retention-policy';
export { SoftDeletePolicy } from './domain/policies/soft-delete-policy';
export { IrreversiblePurgePolicy, IrreversiblePurgeViolationError } from './domain/policies/irreversible-purge-policy';

export { PrismaLifecycleRepository } from './infrastructure/adapters/prisma-lifecycle.repository';

export type {
  IArchiveEntryPort,
  IPurgeSchedulePort,
  ArchiveEntryPortRecord,
  IPurgeSchedulePortRecord,
  ArchiveEntryState,
  PurgeEligibleState,
} from './ports/lifecycle.port';

export { LifecycleModule } from './lifecycle.module';
