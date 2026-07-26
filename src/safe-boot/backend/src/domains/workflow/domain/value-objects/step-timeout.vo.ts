/**
 * StepTimeout Value Object
 *
 * Represents the maximum duration a step can remain in pending/in_progress state.
 * Stored as a days integer, validated against BR-WF-001 (max 30 days).
 * DB column: workflow_steps.timeout_jours CHECK (> 0 AND <= 30).
 *
 * @traceability DOC-012 Aggregate5 §VO-StepTimeout
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps.timeout_jours CHECK (> 0 AND <= 30)
 *   → BR-WF-001 (Timeout max 30 jours)
 */

// ---- Constants (exported first so dependent code can import them) ----

/** Maximum timeout allowed per BR-WF-001 and CC-WF-001. */
export const TIMEOUT_MAX_DAYS = 30;

/** Minimum timeout allowed (steps must have a positive timeout). */
export const TIMEOUT_MIN_DAYS = 1;

// ---- Validation ----

export class InvalidStepTimeoutError extends Error {
  constructor(value: number, reason: string) {
    super(`Invalid step timeout: ${value} days. ${reason}`);
    this.name = 'InvalidStepTimeoutError';
  }
}

/**
 * Assert and normalize a step timeout value.
 * Throws InvalidStepTimeoutError if the value violates BR-WF-001 bounds.
 */
export function assertValidStepTimeout(days: number): number {
  if (!Number.isInteger(days)) {
    throw new InvalidStepTimeoutError(days, 'Must be an integer.');
  }
  if (days < TIMEOUT_MIN_DAYS) {
    throw new InvalidStepTimeoutError(days, `Minimum is ${TIMEOUT_MIN_DAYS} day(s).`);
  }
  if (days > TIMEOUT_MAX_DAYS) {
    throw new InvalidStepTimeoutError(days, `Maximum is ${TIMEOUT_MAX_DAYS} days per BR-WF-001.`);
  }
  return days;
}

/** Convert a step timeout expressed in days to milliseconds. */
export function stepTimeoutToMs(days: number): number {
  return assertValidStepTimeout(days) * 24 * 60 * 60 * 1000;
}
