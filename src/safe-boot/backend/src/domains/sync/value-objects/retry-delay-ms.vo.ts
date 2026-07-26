/**
 * RetryDelayMs — exponential backoff delay for failed sync operations.
 * Formula: 1000 * 2^(attempt-1) -> 1000, 2000, 4000, 8000, 16000
 *
 * @traceability DOC-012 Aggregate13 (RetryDelayMs), BR-SYNC-006
 */

export class RetryDelayMs {
  private static readonly BASE_MS = 1_000;
  private static readonly MAX_ATTEMPT = 5;

  constructor(public readonly value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(
        `RetryDelayMs: must be non-negative integer, got ${value}`,
      );
    }
  }

  static calculate(attempt: number): RetryDelayMs {
    const capped = Math.min(Math.max(attempt, 1), this.MAX_ATTEMPT);
    const delay = this.BASE_MS * 2 ** (capped - 1);
    return new RetryDelayMs(delay);
  }

  toString(): string {
    return `${this.value}ms`;
  }
}
