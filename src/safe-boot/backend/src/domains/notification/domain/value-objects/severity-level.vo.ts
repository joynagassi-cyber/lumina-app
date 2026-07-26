/**
 * SeverityLevel — priority classification for a notification.
 *
 * Immutable VO. Maps to PG-Schema Table 19 severite CHECK constraint:
 *   CHECK (severite IN ('info','warning','critical'))
 *
 * BR-NOT-005: Critical severity bypasses quiet hours.
 *
 * @traceability DOC-012 Aggregate7 VO SeverityLevel → PG-Schema-v1 Table 19 severite
 */

export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/** Numeric priority: higher value = more urgent. */
export const SEVERITY_PRIORITY: ReadonlyMap<SeverityLevel, number> = new Map<
  SeverityLevel,
  number
>([
  [SeverityLevel.INFO, 0],
  [SeverityLevel.WARNING, 1],
  [SeverityLevel.CRITICAL, 2],
]);

/** Returns true when severity is critical (bypasses quiet hours per BR-NOT-005). */
export function isCritical(severity: SeverityLevel): boolean {
  return severity === SeverityLevel.CRITICAL;
}

/** Order two severity levels from lowest to highest urgency. */
export function severityRank(a: SeverityLevel, b: SeverityLevel): number {
  return (SEVERITY_PRIORITY.get(a) ?? 0) - (SEVERITY_PRIORITY.get(b) ?? 0);
}
