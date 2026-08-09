/**
 * EventValidator Tests
 *
 * Tests validation of event business rules.
 * @traceability DOC-012 BR-RES-004 through BR-RES-007, EventValidator
 */

import { EventValidator, EventValidationError } from '@/domains/event/domain/services/event-validator.service';
import { EventState } from '@/domains/event/domain/value-objects/event-state.vo';

/** Assert that fn() throws an EventValidationError carrying the given machine code. */
function expectErrorCode(fn: () => void, code: string): void {
  try {
    fn();
    throw new Error(`Expected EventValidationError with code ${code}`);
  } catch (e) {
    expect(e).toBeInstanceOf(EventValidationError);
    expect((e as EventValidationError).code).toBe(code);
  }
}

describe('EventValidator', () => {
  describe('validateDates', () => {
    it('should accept valid date range (start before end, both not in future)', () => {
      const start = new Date('2026-01-01T10:00:00Z');
      const end = new Date('2026-01-01T12:00:00Z');

      expect(() => EventValidator.validateDates(start, end)).not.toThrow();
    });

    it('should throw when start is after end', () => {
      const start = new Date('2026-01-01T12:00:00Z');
      const end = new Date('2026-01-01T10:00:00Z');

      expect(() => EventValidator.validateDates(start, end)).toThrow(EventValidationError);
      expectErrorCode(() => EventValidator.validateDates(start, end), 'DATE_ORDER');
    });

    it('should throw when start is in future', () => {
      const start = new Date('2030-01-01T10:00:00Z');
      const end = new Date('2030-01-01T12:00:00Z');

      expect(() => EventValidator.validateDates(start, end)).toThrow(EventValidationError);
      expectErrorCode(() => EventValidator.validateDates(start, end), 'DATE_FUTURE');
    });

    it('should throw when end is in future', () => {
      const start = new Date('2020-01-01T10:00:00Z');
      const end = new Date('2030-01-01T12:00:00Z');

      expect(() => EventValidator.validateDates(start, end)).toThrow(EventValidationError);
      expectErrorCode(() => EventValidator.validateDates(start, end), 'DATE_FUTURE');
    });
  });

  describe('assertCreatedBySet', () => {
    it('should accept non-empty createdBy', () => {
      expect(() => EventValidator.assertCreatedBySet('user-1')).not.toThrow();
    });

    it('should throw when createdBy is empty string', () => {
      expect(() => EventValidator.assertCreatedBySet('')).toThrow(EventValidationError);
      expectErrorCode(() => EventValidator.assertCreatedBySet(''), 'MISSING_CREATED_BY');
    });

    it('should throw when createdBy is null/undefined (as string)', () => {
      // @ts-ignore
      expect(() => EventValidator.assertCreatedBySet(null)).toThrow(EventValidationError);
    });

    it('should throw when createdBy is whitespace-only', () => {
      expect(() => EventValidator.assertCreatedBySet('   ')).toThrow(EventValidationError);
      expectErrorCode(() => EventValidator.assertCreatedBySet('   '), 'MISSING_CREATED_BY');
    });
  });

  describe('assertTitlePresent', () => {
    it('should accept non-empty title', () => {
      expect(() => EventValidator.assertTitlePresent('Event Title')).not.toThrow();
    });

    it('should throw when title is empty', () => {
      expect(() => EventValidator.assertTitlePresent('')).toThrow(EventValidationError);
      expectErrorCode(() => EventValidator.assertTitlePresent(''), 'EMPTY_TITLE');
    });

    it('should throw when title is whitespace-only', () => {
      expect(() => EventValidator.assertTitlePresent('   ')).toThrow(EventValidationError);
      expectErrorCode(() => EventValidator.assertTitlePresent('   '), 'EMPTY_TITLE');
    });
  });

  describe('validateStateTransition', () => {
    it('should allow valid transition (draft -> published)', () => {
      expect(() => EventValidator.validateStateTransition(EventState.DRAFT, EventState.PUBLISHED)).not.toThrow();
    });

    it('should allow valid transition (draft -> cancelled)', () => {
      expect(() => EventValidator.validateStateTransition(EventState.DRAFT, EventState.CANCELLED)).not.toThrow();
    });

    it('should allow valid transition (published -> completed)', () => {
      expect(() => EventValidator.validateStateTransition(EventState.PUBLISHED, EventState.COMPLETED)).not.toThrow();
    });

    it('should allow valid transition (published -> cancelled)', () => {
      expect(() => EventValidator.validateStateTransition(EventState.PUBLISHED, EventState.CANCELLED)).not.toThrow();
    });

    it('should throw invalid transition (published -> draft)', () => {
      expect(() => EventValidator.validateStateTransition(EventState.PUBLISHED, EventState.DRAFT)).toThrow(EventValidationError);
      expectErrorCode(() => EventValidator.validateStateTransition(EventState.PUBLISHED, EventState.DRAFT), 'INVALID_TRANSITION');
    });

    it('should throw invalid transition (cancelled -> published)', () => {
      expect(() => EventValidator.validateStateTransition(EventState.CANCELLED, EventState.PUBLISHED)).toThrow(EventValidationError);
    });

    it('should throw invalid transition (completed -> anything)', () => {
      expect(() => EventValidator.validateStateTransition(EventState.COMPLETED, EventState.PUBLISHED)).toThrow(EventValidationError);
    });
  });

  describe('validateCreate', () => {
    it('should accept valid create input', () => {
      expect(() => EventValidator.validateCreate({
        createdBy: 'user-1',
        title: 'Test Event',
        startAt: new Date('2026-01-01T10:00:00Z'),
        endAt: new Date('2026-01-01T12:00:00Z'),
      })).not.toThrow();
    });

    it('should throw when createdBy is missing', () => {
      // @ts-ignore
      expect(() => EventValidator.validateCreate({ title: 'Test Event', startAt: new Date(), endAt: new Date() })).toThrow(EventValidationError);
    });

    it('should throw when title is empty', () => {
      expect(() => EventValidator.validateCreate({
        createdBy: 'user-1',
        title: '',
        startAt: new Date(),
        endAt: new Date(),
      })).toThrow(EventValidationError);
    });

    it('should throw when dates are invalid (start > end)', () => {
      expect(() => EventValidator.validateCreate({
        createdBy: 'user-1',
        title: 'Test Event',
        startAt: new Date('2026-01-01T12:00:00Z'),
        endAt: new Date('2026-01-01T10:00:00Z'),
      })).toThrow(EventValidationError);
    });
  });
});
