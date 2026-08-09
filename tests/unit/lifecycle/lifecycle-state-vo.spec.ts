/**
 * LifecycleState Value Object Tests
 *
 * Tests lifecycle state machine transitions.
 * @traceability DOC-012 VO-LifecycleState, NB-LIF-003
 */

import { LifecycleState, getValidTransitions, validateTransition, InvalidLifecycleTransitionError } from '@/domains/lifecycle/domain/value-objects/lifecycle-state.vo';

describe('LifecycleState', () => {
  it('should define all valid states', () => {
    expect(Object.values(LifecycleState)).toEqual([
      'active',
      'archived',
      'trashed',
      'purged',
    ]);
  });

  describe('getValidTransitions', () => {
    it('should return allowed transitions from active', () => {
      const transitions = getValidTransitions(LifecycleState.ACTIVE);
      expect(transitions).toContain(LifecycleState.ARCHIVED);
      expect(transitions.length).toBe(1);
    });

    it('should return allowed transitions from archived', () => {
      const transitions = getValidTransitions(LifecycleState.ARCHIVED);
      expect(transitions).toContain(LifecycleState.TRASHED);
      expect(transitions).toContain(LifecycleState.ACTIVE);
      expect(transitions.length).toBe(2);
    });

    it('should return allowed transitions from trashed', () => {
      const transitions = getValidTransitions(LifecycleState.TRASHED);
      expect(transitions).toContain(LifecycleState.ACTIVE);
      expect(transitions).toContain(LifecycleState.PURGED);
      expect(transitions.length).toBe(2);
    });

    it('should return empty array from purged (terminal)', () => {
      const transitions = getValidTransitions(LifecycleState.PURGED);
      expect(transitions).toHaveLength(0);
    });
  });

  describe('validateTransition', () => {
    it('should allow valid transition active -> archived', () => {
      expect(() => validateTransition(LifecycleState.ACTIVE, LifecycleState.ARCHIVED)).not.toThrow();
    });

    it('should allow valid transition archived -> trashed', () => {
      expect(() => validateTransition(LifecycleState.ARCHIVED, LifecycleState.TRASHED)).not.toThrow();
    });

    it('should allow valid transition archived -> active (reopen)', () => {
      expect(() => validateTransition(LifecycleState.ARCHIVED, LifecycleState.ACTIVE)).not.toThrow();
    });

    it('should allow valid transition trashed -> active (restore)', () => {
      expect(() => validateTransition(LifecycleState.TRASHED, LifecycleState.ACTIVE)).not.toThrow();
    });

    it('should allow valid transition trashed -> purged', () => {
      expect(() => validateTransition(LifecycleState.TRASHED, LifecycleState.PURGED)).not.toThrow();
    });

    it('should throw for invalid transition active -> trashed', () => {
      expect(() => validateTransition(LifecycleState.ACTIVE, LifecycleState.TRASHED)).toThrow(InvalidLifecycleTransitionError);
    });

    it('should throw for invalid transition archived -> purged', () => {
      expect(() => validateTransition(LifecycleState.ARCHIVED, LifecycleState.PURGED)).toThrow(InvalidLifecycleTransitionError);
    });

    it('should throw for invalid purged -> anything', () => {
      expect(() => validateTransition(LifecycleState.PURGED, LifecycleState.ACTIVE)).toThrow(InvalidLifecycleTransitionError);
    });
  });
});
