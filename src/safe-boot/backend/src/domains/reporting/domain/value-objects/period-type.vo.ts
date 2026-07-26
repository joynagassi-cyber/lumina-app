/**
 * PeriodType — value object for report period granularity.
 *
 * @traceability DOC-012 Aggregate9 §VO-PeriodType
 *   → POSTGRESQL-SCHEMA-PACK-v1 reports.periode_type CHECK constraint
 */

export type PeriodTypeValue = 'month' | 'quarter' | 'year' | 'custom';

const KNOWN_PERIODS: ReadonlySet<PeriodTypeValue> = new Set([
  'month',
  'quarter',
  'year',
  'custom',
]);

/**
 * Immutable value object representing the period type of a report.
 */
export class PeriodType {
  private constructor(public readonly value: PeriodTypeValue) {}

  static create(type: string): PeriodType {
    if (!KNOWN_PERIODS.has(type as PeriodTypeValue)) {
      throw new InvalidPeriodTypeError(
        `Unknown period type "${type}". Must be one of: ${Array.from(KNOWN_PERIODS).join(', ')}.`,
      );
    }
    return new PeriodType(type as PeriodTypeValue);
  }

  /** Compute period start and end dates from the current date. */
  computeDateRange(referenceDate: Date): { start: Date; end: Date } {
    const end = new Date(referenceDate);
    switch (this.value) {
      case 'month':
        return this.monthRange(end);
      case 'quarter':
        return this.quarterRange(end);
      case 'year':
        return this.yearRange(end);
      case 'custom':
        return { start: new Date(referenceDate), end };
    }
  }

  private monthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    return { start, end: new Date(date) };
  }

  private quarterRange(date: Date): { start: Date; end: Date } {
    const quarter = Math.floor(date.getMonth() / 3);
    const start = new Date(date.getFullYear(), quarter * 3, 1);
    return { start, end: new Date(date) };
  }

  private yearRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), 0, 1);
    return { start, end: new Date(date) };
  }

  public toString(): string {
    return this.value;
  }
}

/**
 * Error thrown when an invalid period type is specified.
 */
export class InvalidPeriodTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPeriodTypeError';
  }
}
