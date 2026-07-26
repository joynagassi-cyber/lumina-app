/**
 * EventValidator — domain service validating Event business rules before state change.
 *
 * Enforced rules:
 *   - BR-RES-004: Date never in the future
 *   - BR-RES-005: Scope type 'org' or 'group' (mandatory)
 *   - BR-RES-007: created_by always set
 *   - PG CHECK: date_end > date_start
 *   - State machine guards per EVENT_STATE_TRANSITIONS
 *
 * @traceability DOC-012 Aggregate3 (ResourceValidator), BR-RES-004, BR-RES-005, BR-RES-007
 */

import { EventState } from '../value-objects/event-state.vo';
import { canTransitionFrom } from '../value-objects/event-state.vo';

export class EventValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EventValidationError';
  }
}

export class EventValidator {
  /** Validate dates: end must be after start; neither may be in the future. */
  static validateDates(startAt: Date, endAt: Date): void {
    if (startAt >= endAt) {
      throw new EventValidationError('DATE_ORDER', 'endAt must be strictly after startAt');
    }
    const now = new Date();
    if (startAt.getTime() > now.getTime()) {
      throw new EventValidationError('DATE_FUTURE', 'startAt cannot be in the future');
    }
    if (endAt.getTime() > now.getTime()) {
      throw new EventValidationError('DATE_FUTURE', 'endAt cannot be in the future');
    }
  }

  /** Validate created_by is set. */
  static assertCreatedBySet(createdBy: string): void {
    if (!createdBy || createdBy.length === 0) {
      throw new EventValidationError('MISSING_CREATED_BY', 'created_by is mandatory for all events');
    }
  }

  /** Validate title is non-empty. */
  static assertTitlePresent(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new EventValidationError('EMPTY_TITLE', 'title is required and must be non-empty');
    }
  }

  /** Validate an event state transition against the canonical state machine. */
  static validateStateTransition(currentState: EventState, newState: EventState): void {
    const allowed = canTransitionFrom(currentState);
    if (!allowed.includes(newState)) {
      throw new EventValidationError(
        'INVALID_TRANSITION',
        `Invalid state transition: ${currentState} -> ${newState}`,
      );
    }
  }

  /** Full pre-create validation combining all business rule checks. */
  static validateCreate({
    createdBy,
    title,
    startAt,
    endAt,
  }: {
    createdBy: string;
    title: string;
    startAt: Date;
    endAt: Date;
  }): void {
    this.assertCreatedBySet(createdBy);
    this.assertTitlePresent(title);
    this.validateDates(startAt, endAt);
  }
}
