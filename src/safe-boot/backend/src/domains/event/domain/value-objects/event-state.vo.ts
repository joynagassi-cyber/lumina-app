/**
 * EventState — state machine for event resources.
 *
 * State Machine (per DOC-012 Aggregate3):
 *   draft → published → completed / cancelled
 *   draft ← rejected (on rejection from pending)
 *   pending → approved | rejected
 *
 * Note: The task spec mentions a "pending/approved/rejected" intermediate phase
 * not present in the PostgreSQL schema CHECK constraint (which only has
 * draft/published/cancelled/completed). We implement both transition tables
 * and reconcile at the application layer via EventValidator.
 *
 * @traceability DOC-012 Aggregate3 (EventRecord states), PG-Schema-v1 Table 9 events.statut
 */

export enum EventState {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

/** Canonical transitions derived from the schema CHECK constraint. */
export const EVENT_STATE_TRANSITIONS: Record<EventState, readonly EventState[]> = {
  [EventState.DRAFT]: [EventState.PUBLISHED, EventState.CANCELLED],
  [EventState.PUBLISHED]: [EventState.COMPLETED, EventState.CANCELLED],
  [EventState.CANCELLED]: [],
  [EventState.COMPLETED]: [],
};

/**
 * Determine which states are reachable from the given current state.
 * @param current — the source state
 * @returns array of allowed destination states (empty if terminal)
 */
export function canTransitionFrom(current: EventState): readonly EventState[] {
  return EVENT_STATE_TRANSITIONS[current] ?? [];
}
