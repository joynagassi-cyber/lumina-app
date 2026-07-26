/**
 * Lifecycle Value Objects — barrel export.
 *
 * @traceability DOC-012 Aggregate11
 */

export { LifecycleState, getValidTransitions, validateTransition, InvalidLifecycleTransitionError } from './lifecycle-state.vo';
export type { ResourceOriginalType as LifecycleResourceOriginalType } from './archive-type.vo';
export { RetentionPeriod, InvalidRetentionPeriodError } from './retention-period.vo';
export type { RetentionPeriodProps } from './retention-period.vo';
export { ArchiveType, InvalidArchiveTypeError } from './archive-type.vo';
export type { ArchiveTypeProps, ResourceOriginalType } from './archive-type.vo';
export { TagCollection } from './tag-collection.vo';
export { CategoryRef, InvalidCategoryRefError } from './category-ref.vo';
export { AttachmentUrlList, InvalidAttachmentUrlListError } from './attachment-url-list.vo';
