/**
 * RateLimitConfig — throttling configuration to prevent notification spam.
 *
 * Immutable VO. Maps to PG-Schema Table 20 limite_taux_max (integer, default 100).
 *
 * BR-NOT-002: Rate limit configurable per user/org.
 *
 * @traceability DOC-012 Aggregate7 VO RateLimitConfig → PG-Schema-v1 Table 20 limite_taux_max
 */

export class RateLimitConfig {
  /** Maximum number of notifications allowed per hour for the user/org scope. */
  readonly maxPerHour: number;

  constructor(maxPerHour: number) {
    if (!Number.isInteger(maxPerHour) || maxPerHour < 1) {
      throw new Error(
        `RateLimitConfig: max_per_hour must be a positive integer, got ${maxPerHour}`,
      );
    }
    if (maxPerHour > 1000) {
      throw new Error(
        `RateLimitConfig: max_per_hour exceeds maximum allowed value of 1000, got ${maxPerHour}`,
      );
    }
    this.maxPerHour = maxPerHour;
  }

  /** Create a rate limit config from an integer value. */
  static create(maxPerHour: number): RateLimitConfig {
    return new RateLimitConfig(maxPerHour);
  }

  /** Default rate limit: 100 notifications per hour. */
  static default(): RateLimitConfig {
    return new RateLimitConfig(100);
  }

  equals(other: RateLimitConfig): boolean {
    return this.maxPerHour === other.maxPerHour;
  }
}
