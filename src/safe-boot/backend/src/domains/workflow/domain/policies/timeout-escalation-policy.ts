/**
 * TimeoutEscalationPolicy
 *
 * Enforces BR-WF-001: workflow timeout max 30 days.
 * Also enforces mandatory escalation when a step or instance exceeds its timeout.
 *
 * @traceability DOC-012 Aggregate5 §Policies-TimeoutEscalationPolicy
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_instances.date_ecoulement
 *   → CONSTRAINTS-INDEX-SPECIFICATION-v1 CC-WF-001 (timeout_jours <= 30)
 *   → BR-WF-001 (Timeout max 30 jours)
 */

import { TIMEOUT_MAX_DAYS } from '../value-objects/step-timeout.vo';

export class TimeoutExceededError extends Error {
  constructor(entityId: string, entityType: string, daysElapsed: number) {
    super(
      `${entityType} '${entityId}' has been running for ${daysElapsed} day(s). ` +
        `Maximum allowed is ${TIMEOUT_MAX_DAYS}. Escalation is mandatory per TimeoutEscalationPolicy.`,
    );
    this.name = 'TimeoutExceededError';
  }
}

export class MandatoryEscalationRequiredError extends Error {
  constructor(stepId: string) {
    super(
      `Step '${stepId}' has exceeded its timeout. Escalation is mandatory — the step cannot remain in pending/in_progress state indefinitely.`,
    );
    this.name = 'MandatoryEscalationRequiredError';
  }
}

export class TimeoutEscalationPolicy {
  /** Maximum allowed timeout in days (BR-WF-001 / CC-WF-001). */
  static readonly MAX_DAYS = TIMEOUT_MAX_DAYS;

  /**
   * Validate that the configured timeout does not exceed 30 days.
   * Throws TimeoutExceededError if violated.
   */
  static validateTimeout(days: number): void {
    if (days > TIMEOUT_MAX_DAYS) {
      throw new TimeoutExceededError('workflow', 'Workflow', days);
    }
  }

  /**
   * Check whether a step or instance has exceeded its timeout given a start date.
   */
  static hasTimedOut(startDate: Date, now: Date, maxDays: number): boolean {
    const elapsedMs = now.getTime() - startDate.getTime();
    const maxMs = maxDays * 24 * 60 * 60 * 1000;
    return elapsedMs > maxMs;
  }

  /**
   * Determine if escalation is mandatory for a step that has timed out.
   * Returns true if the step is still non-terminal and has exceeded its timeout.
   */
  static isEscalationMandatory(
    createdAt: Date,
    now: Date,
    timeoutDays: number,
    isTerminal: boolean,
  ): boolean {
    if (isTerminal) return false;
    return this.hasTimedOut(createdAt, now, timeoutDays);
  }

  /**
   * Compute the remaining time (in ms) before a step times out.
   * Returns negative value if already expired.
   */
  static remainingTimeMs(createdAt: Date, timeoutDays: number, now: Date): number {
    const maxMs = timeoutDays * 24 * 60 * 60 * 1000;
    const elapsed = now.getTime() - createdAt.getTime();
    return maxMs - elapsed;
  }
}
