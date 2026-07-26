/**
 * Lifecycle Entities — barrel export.
 *
 * @traceability DOC-012 Aggregate11
 */

export { ArchiveEntry } from './archive-entry.entity';
export type { ArchiveEntryProps } from './archive-entry.entity';
export { ResourceArchived, ResourceTrashed, ResourcePurged, ResourceRestoredFromTrash, PurgeScheduled } from './archive-entry.entity';
