/**
 * SyncStatus — enum tracking the lifecycle of a pending operation.
 *
 * @traceability DOC-012 Aggregate13 (SyncStatus enum)
 * @invariant Must be one of: pending, sent, confirmed, failed
 */

export enum SyncStatus {
  PENDING = 'pending',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}
