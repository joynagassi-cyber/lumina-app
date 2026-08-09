/**
 * EventDatePolicy Tests
 *
 * Tests date validation rules for events.
 * @traceability DOC-012 BR-RES-004, EventDatePolicy
 */

import { EventDatePolicy, EventDatePolicyError } from '@/domains/event/domain/policies/event-date-policy';

describe('EventDatePolicy', () => {
  describe('validate', () => {
    it('should accept valid dates (start before end, both in past)', () => {
      // Arrange - Both dates in the past, start < end
      const start = new Date('2026-01-01T10:00:00Z');
      const end = new Date('2026-01-01T12:00:00Z');

      // Act - Should not throw
      expect(() => EventDatePolicy.validate(start, end)).not.toThrow();
    });

    it('should reject when start equals end', () => {
      // Arrange
      const sameTime = new Date('2026-01-01T10:00:00Z');

      // Act & Assert
      expect(() => EventDatePolicy.validate(sameTime, sameTime)).toThrow(EventDatePolicyError);
      expect(() => EventDatePolicy.validate(sameTime, sameTime)).toThrowError('end must be strictly after start');
    });

    it('should reject when start is after end', () => {
      // Arrange
      const start = new Date('2026-01-01T12:00:00Z');
      const end = new Date('2026-01-01T10:00:00Z');

      // Act & Assert
      expect(() => EventDatePolicy.validate(start, end)).toThrow(EventDatePolicyError);
      expect(() => EventDatePolicy.validate(start, end)).toThrowError('end must be strictly after start');
    });

    it('should reject start date in future', () => {
      // Arrange
      const start = new Date('2030-01-01T10:00:00Z'); // Future
      const end = new Date('2030-01-01T12:00:00Z');   // Also future

      // Act & Assert
      expect(() => EventDatePolicy.validate(start, end)).toThrow(EventDatePolicyError);
      expect(() => EventDatePolicy.validate(start, end)).toThrowError('start date cannot be in the future');
    });

    it('should reject end date in future (even if start is in past)', () => {
      // Arrange
      const start = new Date('2020-01-01T10:00:00Z'); // Past
      const end = new Date('2030-01-01T12:00:00Z');   // Future

      // Act & Assert
      expect(() => EventDatePolicy.validate(start, end)).toThrow(EventDatePolicyError);
      expect(() => EventDatePolicy.validate(start, end)).toThrowError('end date cannot be in the future');
    });

    it('should validate both dates are not in future', () => {
      // Arrange - Both in future
      const start = new Date('2030-01-01T10:00:00Z');
      const end = new Date('2030-01-01T12:00:00Z');

      // Act & Assert - Should fail on start check (first one checked)
      expect(() => EventDatePolicy.validate(start, end)).toThrow(EventDatePolicyError);
    });
  });
});
