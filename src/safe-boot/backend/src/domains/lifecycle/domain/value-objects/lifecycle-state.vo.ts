/**
 * Lifecycle State Machine — canonical transition rules.
 *
 * Transitions:
 *   active  -> archived
 *   archived -> trashed | active (reopen)
 *   trashed -> active (restore) | purged
 *   purged  -> N/A (irreversible)
 *
 * @traceability DOC-012 Aggregate11 (LifecycleAggregate), NB-LIF-003
 *   → POSTGRESQL-SCHEMA-PACK-v1 archives.etat_lifecycle CHECK constraint
 */

export enum LifecycleState {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  TRASHED = 'trashed',
  PURGED = 'purged',
}

/**
 * Maps each state to the set of states it can transit to.
 * purged has no outgoing transitions (irreversible).
 */
export const LIFECYCLE_TRANSITIONS: Record<LifecycleState, readonly LifecycleState[]> = {
  [LifecycleState.ACTIVE]: [LifecycleState.ARCHIVED],
  [LifecycleState.ARCHIVED]: [LifecycleState.TRASHED, LifecycleState.ACTIVE],
  [LifecycleState.TRASHED]: [LifecycleState.ACTIVE, LifecycleState.PURGED],
  [LifecycleState.PURGED]: [],
};

/**
 * Returns the list of allowed target states for a given current state.
 */
export function getValidTransitions(
  current: LifecycleState,
): readonly LifecycleState[] {
  return LIFECYCLE_TRANSITIONS[current] ?? [];
}

/**
 * Validates whether a state transition is permitted by the state machine.
 * Throws InvalidLifecycleTransitionError if not allowed.
 */
export function validateTransition(
  from: LifecycleState,
  to: LifecycleState,
): void {
  const allowed = getValidTransitions(from);
  if (!allowed.includes(to)) {
    throw new InvalidLifecycleTransitionError(
      `Cannot transition LifecycleState from "${from}" to "${to}".`,
    );
  }
}

/**
 * Error thrown when an invalid state transition is attempted.
 */
export class InvalidLifecycleTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLifecycleTransitionError';
  }
}
