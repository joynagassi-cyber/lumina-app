/**
 * ReportFormat — value object for export format configuration.
 *
 * @traceability DOC-012 Aggregate9 §VO-ReportFormat
 *   → POSTGRESQL-SCHEMA-PACK-v1 reports.format_export text[]
 */

export type ExportFormatValue = 'pdf' | 'csv' | 'json';

const KNOWN_FORMATS: ReadonlySet<ExportFormatValue> = new Set([
  'pdf',
  'csv',
  'json',
]);

/**
 * Immutable value object representing a single export format.
 */
export class ReportFormat {
  private constructor(public readonly value: ExportFormatValue) {}

  static create(format: string): ReportFormat {
    if (!KNOWN_FORMATS.has(format as ExportFormatValue)) {
      throw new InvalidReportFormatError(
        `Unknown export format "${format}". Must be one of: ${Array.from(KNOWN_FORMATS).join(', ')}.`,
      );
    }
    return new ReportFormat(format as ExportFormatValue);
  }
}

/**
 * Value object holding the complete set of export formats for a report.
 */
export class ReportFormatCollection {
  private constructor(private readonly _formats: ReadonlySet<ExportFormatValue>) {}

  static create(formats: string[]): ReportFormatCollection {
    const validated: ExportFormatValue[] = [];
    for (const f of formats) {
      if (KNOWN_FORMATS.has(f as ExportFormatValue)) {
        validated.push(f as ExportFormatValue);
      } else {
        throw new InvalidReportFormatError(`Invalid export format: "${f}".`);
      }
    }
    return new ReportFormatCollection(new Set(validated));
  }

  has(format: ExportFormatValue): boolean {
    return this._formats.has(format);
  }

  get formats(): ExportFormatValue[] {
    return Array.from(this._formats);
  }
}

/**
 * Error thrown when an invalid report format is specified.
 */
export class InvalidReportFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReportFormatError';
  }
}
