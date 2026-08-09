/**
 * DurationPolicy — enforces maximum delegation duration per BR-DEL-002.
 *
 * Rule: Maximum 90 days for any delegation grant.
 *
 * @traceability BR-DEL-002 — Maximum duration of 90 days
 */

import { DurationExceededError } from './delegation-errors';

export class DurationPolicy {
  static readonly MAX_DAYS = 90;

  /**
   * Validate that the requested duration does not exceed the maximum.
   * Throws DurationExceededError if validation fails.
   */
  static validateDuration(durationDays: number): void {
    if (durationDays <= 0) {
      throw new Error('Duration must be positive');
    }
    if (durationDays > DurationPolicy.MAX_DAYS) {
      throw new DurationExceededError(durationDays, DurationPolicy.MAX_DAYS);
    }
  }

  /** Check if duration is valid without throwing. */
  static isValidDuration(durationDays: number): boolean {
    return durationDays > 0 && durationDays <= DurationPolicy.MAX_DAYS;
  }
}