/**
 * IrreversiblePurgePolicy — enforces that purge is a final, non-reversible state.
 *
 * @traceability DOC-012 Aggregate11 §IrreversiblePurgePolicy
 *   → BR-LIF: purged state has no outgoing transitions
 */

import { LifecycleState } from '../value-objects/lifecycle-state.vo';

/**
 * Policy asserting the irreversible nature of the PURGED state.
 */
export class IrreversiblePurgePolicy {
  /**
   * Assert that the given state is indeed purged (terminal).
   * Throws if the state has not been purged.
   */
  static assertPurged(state: LifecycleState): void {
    if (state !== LifecycleState.PURGED) {
      throw new IrreversiblePurgeViolationError(
        `State "${state}" is not PURGED. Purge is irreversible and must be the final state.`,
      );
    }
  }

  /**
   * Check whether a state can be reverted from.
   * Only states other than PURGED are revertible.
   */
  static canRevert(state: LifecycleState): boolean {
    return state !== LifecycleState.PURGED;
  }

  /**
   * Validate that a transition to PURGED is intentional.
   * Always returns true (no additional guard needed beyond state machine).
   */
  static validatePurgeTransition(from: LifecycleState): boolean {
    return from === LifecycleState.TRASHED || from === LifecycleState.ARCHIVED;
  }
}

/**
 * Error thrown when an attempt is made to reverse a purge operation.
 */
export class IrreversiblePurgeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IrreversiblePurgeViolationError';
  }
}
