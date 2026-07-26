/**
 * EventDates — value object encapsulating start/end date pair with validation.
 *
 * Business Rules enforced:
 *   - end must be strictly after start (BR-RES derived from PG CHECK constraint)
 *   - dates must never be in the future (BR-RES-004, "Date never in future")
 *
 * @traceability DOC-012 Aggregate3 (EventRecord startAt/endAt), PG-Schema-v1 Table 9 events.date_debut/date_fin
 *              CHECK (date_fin > date_debut), BR-RES-004
 */

export class InvalidEventDateError extends Error {
  constructor(message: string) {
    super(`EventDates: ${message}`);
    this.name = 'InvalidEventDateError';
  }
}

const NOW = new Date();

export class EventDates {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
  ) {
    if (start >= end) {
      throw new InvalidEventDateError('end date must be strictly after start date');
    }
    if (start.getTime() > NOW.getTime()) {
      throw new InvalidEventDateError('event start date cannot be in the future');
    }
    if (end.getTime() > NOW.getTime()) {
      throw new InvalidEventDateError('event end date cannot be in the future');
    }
  }

  /**
   * Create and validate an EventDates instance.
   * @throws InvalidEventDateError on violation of business rules
   */
  static create(start: Date, end: Date): EventDates {
    return new EventDates(start, end);
  }

  /** Duration in whole milliseconds between start and end. */
  durationMs(): number {
    return this.end.getTime() - this.start.getTime();
  }

  /** Duration in human-readable hours. */
  durationHours(): number {
    return this.durationMs() / (1000 * 60 * 60);
  }

  /** Check whether a given date falls within [start, end]. */
  contains(date: Date): boolean {
    return date.getTime() >= this.start.getTime() && date.getTime() <= this.end.getTime();
  }
}
