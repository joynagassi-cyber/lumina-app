/**
 * StateTransitionValidator — domain service that validates lifecycle state transitions.
 *
 * @traceability DOC-012 Aggregate11 §StateTransitionValidator
 *   → BR-LIF-006: Trashed entries not visible in normal queries
 */

import { LifecycleState, validateTransition } from '../value-objects/lifecycle-state.vo';

export class StateTransitionValidator {
  /**
   * Validate whether the given transition is allowed.
   * Throws InvalidLifecycleTransitionError if not permitted.
   */
  static canTransition(from: LifecycleState, to: LifecycleState): boolean {
    try {
      validateTransition(from, to);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a state is terminal (no outgoing transitions).
   * purged is the only terminal state.
   */
  static isTerminal(state: LifecycleState): boolean {
    return state === LifecycleState.PURGED;
  }

  /**
   * Check if an entry is visible in normal queries.
   * trashed entries are excluded per BR-LIF-006.
   */
  static isVisibleInNormalQueries(state: LifecycleState): boolean {
    return state !== LifecycleState.TRASHED && state !== LifecycleState.PURGED;
  }

  /**
   * Check if a state can be restored to active.
   */
  static isRestorable(state: LifecycleState): boolean {
    return state === LifecycleState.TRASHED || state === LifecycleState.ARCHIVED;
  }
}
