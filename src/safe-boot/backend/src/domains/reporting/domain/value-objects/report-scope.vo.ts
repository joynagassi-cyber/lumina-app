/**
 * ReportScope — value object for report data scope.
 *
 * @traceability DOC-012 Aggregate9 §VO-ReportScope
 *   → POSTGRESQL-SCHEMA-PACK-v1 report_snapshots.portee CHECK constraint
 */

export type ReportScopeValue = 'org' | 'group' | 'all' | 'partial_consolidation';

const KNOWN_SCOPES: ReadonlySet<ReportScopeValue> = new Set([
  'org',
  'group',
  'all',
  'partial_consolidation',
]);

/**
 * Immutable value object representing the scope of a report.
 */
export class ReportScope {
  private constructor(public readonly value: ReportScopeValue) {}

  static create(scope: string): ReportScope {
    if (!KNOWN_SCOPES.has(scope as ReportScopeValue)) {
      throw new InvalidReportScopeError(
        `Unknown report scope "${scope}". Must be one of: ${Array.from(KNOWN_SCOPES).join(', ')}.`,
      );
    }
    return new ReportScope(scope as ReportScopeValue);
  }

  isOrgScoped(): boolean {
    return this.value === 'org';
  }

  isGroupScoped(): boolean {
    return this.value === 'group';
  }

  isAllScoped(): boolean {
    return this.value === 'all';
  }

  public toString(): string {
    return this.value;
  }

  equals(other: ReportScope): boolean {
    return this.value === other.value;
  }
}

/**
 * Error thrown when an invalid report scope is specified.
 */
export class InvalidReportScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReportScopeError';
  }
}
