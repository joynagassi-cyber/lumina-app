/**
 * Lifecycle Policies — barrel export.
 *
 * @traceability DOC-012 Aggregate11
 */

export { ArchiveRetentionPolicy } from './archive-retention-policy';
export type { ArchivableTypeConfig } from './archive-retention-policy';
export { SoftDeletePolicy } from './soft-delete-policy';
export { IrreversiblePurgePolicy, IrreversiblePurgeViolationError } from './irreversible-purge-policy';
