/**
 * JoinTimestamp — Value Object
 * Immutable timestamp capturing when a member joined a group.
 * @traceability DOC-012 §Aggregate 4, POSTGRESQL-SCHEMA-PACK-v1.md Table 11 (date_adhesion)
 */

export class JoinTimestamp {
  private constructor(private readonly _value: Date) {}

  /**
   * Creates a JoinTimestamp from the current moment.
   */
  static now(): JoinTimestamp {
    return new JoinTimestamp(new Date());
  }

  /**
   * Creates a JoinTimestamp from a specific date.
   */
  static from(date: Date): JoinTimestamp {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new TypeError('JoinTimestamp requires a valid Date');
    }
    return new JoinTimestamp(new Date(date));
  }

  /**
   * Returns the underlying Date (immutable copy).
   */
  get value(): Date {
    return new Date(this._value);
  }

  /**
   * ISO string representation for serialization.
   */
  toISOString(): string {
    return this._value.toISOString();
  }

  /**
   * Checks if this join timestamp precedes another.
   */
  precedes(other: JoinTimestamp): boolean {
    return this._value.getTime() < other._value.getTime();
  }
}
