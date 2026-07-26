/**
 * EventState — state machine for event resources.
 * Transitions: draft -> published | cancelled; completed is terminal.
 *
 * @traceability DOC-012 Aggregate3 (EventRecord states)
 */

export enum EventState {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export const EVENT_STATE_TRANSITIONS: Record<EventState, readonly EventState[]> = {
  [EventState.DRAFT]: [EventState.PUBLISHED, EventState.CANCELLED],
  [EventState.PUBLISHED]: [EventState.COMPLETED, EventState.CANCELLED],
  [EventState.CANCELLED]: [],
  [EventState.COMPLETED]: [],
};

export function canTransitionFrom(current: EventState): readonly EventState[] {
  return EVENT_STATE_TRANSITIONS[current] ?? [];
}
