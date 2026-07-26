/**
 * EventDatePolicy — enforces date validation rules for events.
 *
 * Rules:
 *   - Date never in the future (BR-RES-004)
 *   - end > start (PG CHECK constraint at DB level, validated at domain level too)
 *
 * @traceability DOC-012 Aggregate3 (BR-RES-004), PG-Schema-v1 Table 9 CHECK(date_fin > date_debut)
 */

export class EventDatePolicyError extends Error {
  constructor(message: string) {
    super(`EventDatePolicy: ${message}`);
    this.name = 'EventDatePolicyError';
  }
}

const NOW = new Date();

export class EventDatePolicy {
  /** Assert both dates are not in the future and end is strictly after start. */
  static validate(start: Date, end: Date): void {
    if (start >= end) {
      throw new EventDatePolicyError('end must be strictly after start');
    }
    if (start.getTime() > NOW.getTime()) {
      throw new EventDatePolicyError('start date cannot be in the future');
    }
    if (end.getTime() > NOW.getTime()) {
      throw new EventDatePolicyError('end date cannot be in the future');
    }
  }
}
