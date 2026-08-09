/**
 * EventState Value Object Tests
 *
 * Tests the event state machine and transitions.
 * @traceability DOC-012 VO-EventState, State Machine
 */

import { EventState, canTransitionFrom, EVENT_STATE_TRANSITIONS } from '@/domains/event/domain/value-objects/event-state.vo';

describe('EventState', () => {
  it('should define all valid event states', () => {
    expect(Object.values(EventState)).toEqual([
      'draft',
      'published',
      'cancelled',
      'completed',
    ]);
  });

  it('should have correct transition matrix', () => {
    // Draft can go to published or cancelled
    expect(EVENT_STATE_TRANSITIONS[EventState.DRAFT]).toEqual([EventState.PUBLISHED, EventState.CANCELLED]);

    // Published can go to completed or cancelled
    expect(EVENT_STATE_TRANSITIONS[EventState.PUBLISHED]).toEqual([EventState.COMPLETED, EventState.CANCELLED]);

    // Cancelled is terminal (no transitions)
    expect(EVENT_STATE_TRANSITIONS[EventState.CANCELLED]).toEqual([]);

    // Completed is terminal (no transitions)
    expect(EVENT_STATE_TRANSITIONS[EventState.COMPLETED]).toEqual([]);
  });

  describe('canTransitionFrom', () => {
    it('should return allowed transitions from draft state', () => {
      const transitions = canTransitionFrom(EventState.DRAFT);
      expect(transitions).toContain(EventState.PUBLISHED);
      expect(transitions).toContain(EventState.CANCELLED);
      expect(transitions.length).toBe(2);
    });

    it('should return allowed transitions from published state', () => {
      const transitions = canTransitionFrom(EventState.PUBLISHED);
      expect(transitions).toContain(EventState.COMPLETED);
      expect(transitions).toContain(EventState.CANCELLED);
      expect(transitions.length).toBe(2);
    });

    it('should return empty array from terminal states', () => {
      const cancelledTransitions = canTransitionFrom(EventState.CANCELLED);
      expect(cancelledTransitions).toHaveLength(0);

      const completedTransitions = canTransitionFrom(EventState.COMPLETED);
      expect(completedTransitions).toHaveLength(0);
    });

    it('should return empty array for unknown state', () => {
      // @ts-ignore - test invalid state
      const transitions = canTransitionFrom('unknown' as EventState);
      expect(transitions).toHaveLength(0);
    });
  });
});
