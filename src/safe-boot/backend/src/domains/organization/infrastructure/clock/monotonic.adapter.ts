/**
 * SystemClockAdapter — Infrastructure Adapter for IClockPort
 *
 * Provides the real system clock. Replaced with ControlledClock in tests.
 *
 * @traceability PAS-005 PA-NB-010 (TimeDeterminism)
 *   → PAS-001 Port-006 (ClockPort)
 */

import { IClockPort } from '../../ports/clock.port';

export class SystemClockAdapter implements IClockPort {
  now(): Date {
    return new Date();
  }
}

/**
 * ControlledClock for testing — returns a fixed timestamp.
 * Used by automated tests to achieve deterministic outcomes.
 */
export class ControlledClockAdapter implements IClockPort {
  constructor(private readonly fixedTime: Date) {}

  now(): Date {
    return new Date(this.fixedTime.getTime());
  }
}
