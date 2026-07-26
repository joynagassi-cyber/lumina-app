/**
 * Retrier — exponential backoff with max 5 attempts.
 *
 * @traceability DOC-012 Aggregate13, BR-SYNC-006 (exponential backoff)
 */

import { RetryDelayMs } from '../value-objects/retry-delay-ms.vo';

export type AsyncFn<T = void> = () => Promise<T>;

export type RetryConfig = {
  maxAttempts: number;
};

const DEFAULT_MAX_ATTEMPTS = 5;

export class Retrier {
  /**
   * Execute an async function with exponential backoff retry.
   * Delays: 1s -> 2s -> 4s -> 8s -> 16s (max 5 attempts).
   *
   * @throws The last error if all attempts are exhausted.
   */
  static async execute<T>(
    fn: AsyncFn<T>,
    config?: RetryConfig,
  ): Promise<T> {
    const maxAttempts = config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt >= maxAttempts) {
          break;
        }

        const delay = RetryDelayMs.calculate(attempt);
        await this.sleep(delay.value);
      }
    }

    throw lastError ?? new Error('Retrier: unknown failure after max attempts');
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate the delay for a given attempt number.
   * Attempt 1 -> 1000ms, Attempt 2 -> 2000ms, etc.
   */
  static getDelayForAttempt(attempt: number): number {
    return RetryDelayMs.calculate(attempt).value;
  }

  /** Get the maximum total wait time across all retries. */
  static getTotalMaxWaitTime(): number {
    let total = 0;
    for (let i = 1; i <= DEFAULT_MAX_ATTEMPTS; i++) {
      total += this.getDelayForAttempt(i);
    }
    return total;
  }
}
