/**
 * RetentionPeriod — configurable retention for archivable types.
 *
 * @traceability DOC-012 Aggregate11 (LifecycleAggregate) §VO-RetentionPeriod
 *   → BR-LIF-005: Purge date configurable per archivable type
 *   → POSTGRESQL-SCHEMA-PACK-v1 purge_schedules.date_planifiee
 */

export type RetentionPeriodMonths = 1 | 3 | 6 | 12 | 24 | 36 | 60 | 120;

const VALID_RETENTION_PERIODS: ReadonlySet<number> = new Set([
  1, 3, 6, 12, 24, 36, 60, 120,
]);

export interface RetentionPeriodProps {
  readonly months: number;
}

/**
 * Immutable value object representing a retention period in months.
 */
export class RetentionPeriod {
  private constructor(private readonly _months: number) {}

  static create(months: number): RetentionPeriod {
    if (!VALID_RETENTION_PERIODS.has(months)) {
      throw new InvalidRetentionPeriodError(
        `Retention period must be one of [${Array.from(VALID_RETENTION_PERIODS).join(', ')}], got ${months}.`,
      );
    }
    return new RetentionPeriod(months);
  }

  get months(): number {
    return this._months;
  }

  /** Compute the purge-eligible date from now plus this retention period. */
  public computePurgeDate(referenceDate: Date): Date {
    const result = new Date(referenceDate);
    result.setMonth(result.getMonth() + this._months);
    return result;
  }

  /** Compare two retention periods for equality. */
  public equals(other: RetentionPeriod): boolean {
    return this._months === other._months;
  }

  public toString(): string {
    return `${this._months} month${this._months > 1 ? 's' : ''}`;
  }
}

/**
 * Error thrown when an invalid retention period is specified.
 */
export class InvalidRetentionPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRetentionPeriodError';
  }
}
