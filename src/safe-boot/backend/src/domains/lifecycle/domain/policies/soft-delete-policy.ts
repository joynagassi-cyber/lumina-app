/**
 * SoftDeletePolicy — governs trash vs permanent purge semantics.
 *
 * @traceability DOC-012 Aggregate11 §SoftDeletePolicy
 *   → BR-LIF-006: Trashed entries not visible in normal queries
 */

import { LifecycleState } from '../value-objects/lifecycle-state.vo';

/**
 * Policy that determines whether an entry is soft-deleted (trashed)
 * rather than permanently removed.
 */
export class SoftDeletePolicy {
  /**
   * Check if an entry is in a soft-delete state (trash).
   */
  static isSoftDeleted(state: LifecycleState): boolean {
    return state === LifecycleState.TRASHED;
  }

  /**
   * Check if an entry is fully purged (not soft-deleted anymore).
   */
  static isPurged(state: LifecycleState): boolean {
    return state === LifecycleState.PURGED;
  }

  /**
   * Determine if a soft-deleted entry can be restored.
   * Only trashed entries are restorable.
   */
  static isRestorable(state: LifecycleState): boolean {
    return state === LifecycleState.TRASHED || state === LifecycleState.ARCHIVED;
  }
}
