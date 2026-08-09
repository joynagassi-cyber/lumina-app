/**
 * RetryPolicyService — CRT-012 (ADR-018).
 *
 * Retry avec backoff exponentiel + jitter, max 5 retries (BR-SYNC-003).
 * Les erreurs de domaine (DomainError) ne sont JAMAIS retryées : elles
 * représentent un état métier invalide, pas une panne transitoire.
 *
 * Aucune logique métier ici (RN-001/RN-002) : pure orchestration.
 *
 * @traceability ADR-018 §3.1 (CRT-012), BR-SYNC-003 (max 5 retries)
 */

import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../shared/errors';

export interface RetryPolicyOptions {
  /** Nombre maximal de retries (BR-SYNC-003 : 5). Défaut : 5. */
  maxRetries?: number;
  /** Délai de base en ms pour le backoff exponentiel. Défaut : 200. */
  baseDelayMs?: number;
  /** Prédicat de retryabilité. Défaut : jamais pour les DomainError. */
  retryable?: (error: unknown) => boolean;
  /** Callback appelé après chaque échec retryable (logging, métriques). */
  onRetry?: (error: unknown, attempt: number) => void;
}

@Injectable()
export class RetryPolicyService {
  private readonly logger = new Logger(RetryPolicyService.name);

  /**
   * Exécute une opération avec retry.
   * - maxRetries retries maximum (tentative initiale + retries)
   * - backoff exponentiel : base * 2^(attempt-1), jitter ±20 %
   * - DomainError (ou erreur non retryable) → relancée immédiatement
   */
  async execute<T>(operation: () => Promise<T>, options: RetryPolicyOptions = {}): Promise<T> {
    const maxRetries = options.maxRetries ?? 5;
    const baseDelayMs = options.baseDelayMs ?? 200;
    const retryable = options.retryable ?? ((error: unknown) => !(error instanceof DomainError));

    let attempt = 0;
    for (;;) {
      try {
        return await operation();
      } catch (error) {
        if (attempt >= maxRetries || !retryable(error)) {
          throw error;
        }
        attempt += 1;
        const delay = this.backoffDelay(baseDelayMs, attempt);
        this.logger.warn(
          `Retry ${attempt}/${maxRetries} dans ${delay}ms — ${this.errorMessage(error)}`,
        );
        options.onRetry?.(error, attempt);
        await this.sleep(delay);
      }
    }
  }

  /** Backoff exponentiel avec jitter (±20 %) — évite l'effet thundering herd. */
  private backoffDelay(baseDelayMs: number, attempt: number): number {
    const exponential = baseDelayMs * 2 ** (attempt - 1);
    const jitter = exponential * 0.2 * Math.random();
    return Math.round(exponential + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
