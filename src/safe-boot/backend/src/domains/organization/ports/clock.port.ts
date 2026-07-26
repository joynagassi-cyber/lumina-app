/**
 * Clock Port
 *
 * Single source of truth for all timestamps per PAS-005 PA-NB-010 / PAS-003 DR-010.
 * Adapters and domain code MUST NOT call system time directly.
 *
 * @traceability PAS-001 Port-006 (ClockPort)
 *   → PAS-005 PA-NB-010 (TimeDeterminism)
 */

export interface IClockPort {
  now(): Date;
}
