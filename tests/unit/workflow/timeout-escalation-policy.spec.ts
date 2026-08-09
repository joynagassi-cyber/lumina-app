/**
 * TimeoutEscalationPolicy Tests
 *
 * Tests workflow timeout validation and escalation logic.
 * @traceability DOC-012 BR-WF-001, TimeoutEscalationPolicy
 */

import { TimeoutEscalationPolicy, TimeoutExceededError, MandatoryEscalationRequiredError } from '@/domains/workflow/domain/policies/timeout-escalation-policy';

describe('TimeoutEscalationPolicy', () => {
  it('should define MAX_DAYS as 30', () => {
    expect(TimeoutEscalationPolicy.MAX_DAYS).toBe(30);
  });

  describe('validateTimeout', () => {
    it('should accept timeout within limit (30 days)', () => {
      expect(() => TimeoutEscalationPolicy.validateTimeout(30)).not.toThrow();
      expect(() => TimeoutEscalationPolicy.validateTimeout(15)).not.toThrow();
      expect(() => TimeoutEscalationPolicy.validateTimeout(1)).not.toThrow();
    });

    it('should throw when timeout exceeds maximum (31 days)', () => {
      expect(() => TimeoutEscalationPolicy.validateTimeout(31)).toThrow(TimeoutExceededError);
      expect(() => TimeoutEscalationPolicy.validateTimeout(31)).toThrowError('Maximum allowed is 30');
    });

    it('should throw error with correct message format', () => {
      expect(() => TimeoutEscalationPolicy.validateTimeout(45)).toThrowError(/45 day\(s\)/);
      expect(() => TimeoutEscalationPolicy.validateTimeout(45)).toThrowError(/Maximum allowed is 30/);
    });
  });

  describe('hasTimedOut', () => {
    it('should detect timeout when elapsed time exceeds maxDays', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-02-01T00:00:00Z'); // 31 days later
      const result = TimeoutEscalationPolicy.hasTimedOut(start, now, 30);
      expect(result).toBe(true);
    });

    it('should not detect timeout when within limit', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-01-30T00:00:00Z'); // Exactly 30 days
      const result = TimeoutEscalationPolicy.hasTimedOut(start, now, 30);
      expect(result).toBe(false); // Not exceeding (elapsedMs > maxMs check)
    });

    it('should return false for negative elapsed', () => {
      const start = new Date('2030-01-01T00:00:00Z'); // Future start
      const now = new Date('2026-01-01T00:00:00Z');
      const result = TimeoutEscalationPolicy.hasTimedOut(start, now, 30);
      expect(result).toBe(false);
    });
  });

  describe('isEscalationMandatory', () => {
    it('should require escalation when timed out and not terminal', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-02-01T00:00:00Z');
      const result = TimeoutEscalationPolicy.isEscalationMandatory(start, now, 30, false);
      expect(result).toBe(true);
    });

    it('should not require escalation if step is terminal', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-02-01T00:00:00Z');
      const result = TimeoutEscalationPolicy.isEscalationMandatory(start, now, 30, true);
      expect(result).toBe(false);
    });

    it('should not require escalation before timeout', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-01-15T00:00:00Z');
      const result = TimeoutEscalationPolicy.isEscalationMandatory(start, now, 30, false);
      expect(result).toBe(false);
    });
  });

  describe('remainingTimeMs', () => {
    it('should calculate remaining time correctly', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-01-10T00:00:00Z'); // 9 days elapsed
      const result = TimeoutEscalationPolicy.remainingTimeMs(start, 30, now);
      const expected = (30 - 9) * 24 * 60 * 60 * 1000;
      expect(result).toBe(expected);
    });

    it('should return negative value when already expired', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-02-10T00:00:00Z'); // 40 days elapsed, 30 day limit
      const result = TimeoutEscalationPolicy.remainingTimeMs(start, 30, now);
      expect(result).toBeLessThan(0);
    });
  });
});
