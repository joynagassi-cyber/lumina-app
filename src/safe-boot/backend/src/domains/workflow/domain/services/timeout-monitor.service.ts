/**
 * TimeoutMonitor Domain Service
 *
 * Scans workflow steps and instances for those approaching or exceeding their
 * configured timeout thresholds. Returns a report of stale steps requiring action.
 *
 * @traceability DOC-012 Aggregate5 §DomainService-TimeoutMonitor
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps.date_ecoulement
 *   → BR-WF-001 (Timeout max 30 jours)
 */

import { WorkflowStep, WorkflowStepStatus } from '../domain/entities/workflow-step.entity';
import type { WorkflowInstance } from '../domain/entities/workflow-instance.entity';

export interface StaleStepReport {
  /** The step that has timed out or is about to. */
  readonly step: WorkflowStep;
  /** The parent workflow instance. */
  readonly instance: WorkflowInstance;
  /** Milliseconds remaining (negative if already expired). */
  readonly remainingMs: number;
  /** Whether escalation is mandatory. */
  readonly escalateMandatory: boolean;
}

export interface TimedOutStep extends StaleStepReport {
  readonly remainingMs: -1;
  readonly escalateMandatory: true;
}

/**
 * The TimeoutMonitor periodically scans running workflow steps to identify
 * those that have exceeded or are about to exceed their timeout thresholds.
 */
export class TimeoutMonitor {
  /**
   * Scan all steps of a running workflow and return the subset that is stale
   * (approaching or past timeout).
   *
   * @param instance — the running workflow instance
   * @param steps — all steps belonging to this instance
   * @param now — the current timestamp (injected via IClockPort in production)
   * @param warningThresholdMs — steps within this many ms of timeout are flagged as warnings
   */
  static scan(
    instance: WorkflowInstance,
    steps: WorkflowStep[],
    now: Date,
    warningThresholdMs?: number,
  ): StaleStepReport[] {
    if (!instance.isRunning()) {
      return [];
    }

    const reports: StaleStepReport[] = [];

    for (const step of steps) {
      // Only consider non-terminal steps
      if (step.isTerminal) continue;

      const elapsedMs = now.getTime() - step.createdAt.getTime();
      const timeoutMs = step.timeoutDays * 24 * 60 * 60 * 1000;
      const remaining = timeoutMs - elapsedMs;

      // Include steps that are within the warning threshold or already expired
      const threshold = warningThresholdMs ?? timeoutMs * 0.1; // default: warn at 90% usage

      if (remaining <= threshold) {
        reports.push({
          step,
          instance,
          remainingMs: remaining,
          escalateMandatory: remaining <= 0,
        });
      }
    }

    return reports;
  }

  /**
   * Check a single step to see if it has timed out.
   */
  static isTimedOut(step: WorkflowStep, now: Date): boolean {
    if (step.isTerminal) return false;
    const elapsedMs = now.getTime() - step.createdAt.getTime();
    const timeoutMs = step.timeoutDays * 24 * 60 * 60 * 1000;
    return elapsedMs > timeoutMs;
  }

  /**
   * Compute the time remaining in milliseconds for a step before timeout.
   * Returns a negative value if already expired.
   */
  static remainingTimeMs(step: WorkflowStep, now: Date): number {
    const timeoutMs = step.timeoutDays * 24 * 60 * 60 * 1000;
    const elapsedMs = now.getTime() - step.createdAt.getTime();
    return timeoutMs - elapsedMs;
  }
}
