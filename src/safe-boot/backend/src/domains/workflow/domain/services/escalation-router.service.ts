/**
 * EscalationRouter Domain Service
 *
 * Routes escalations when a workflow step has exceeded its timeout.
 * Consults the EscalationRule configuration and determines the target role(s)
 * for the escalation notification.
 *
 * @traceability DOC-012 Aggregate5 §DomainService-EscalationRouter
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps (escalation metadata in jsonb)
 *   → BR-WF-002 (Escalation follows approval chain up to max 5 levels)
 */

import type { EscalationRule } from '../value-objects/escalation-rule.vo';
import type { WorkflowStep } from '../entities/workflow-step.entity';
import type { WorkflowInstance } from '../entities/workflow-instance.entity';

export interface EscalationTarget {
  /** Role(s) to escalate to. */
  readonly targetRoles: string[];
  /** Severity of the escalation notification. */
  readonly severity: 'info' | 'warning' | 'critical';
  /** Whether to also notify upstream roles. */
  readonly cascadeUpstream: boolean;
}

export class EscalationRoutingError extends Error {
  constructor(reason: string) {
    super(`Escalation routing error: ${reason}`);
    this.name = 'EscalationRoutingError';
  }
}

/**
 * The EscalationRouter evaluates whether a timed-out step requires escalation,
 * and if so, routes it to the appropriate role(s) based on the configured rule.
 */
export class EscalationRouter {
  /**
   * Determine the escalation target for a timed-out step.
   *
   * @param step — the step that has timed out
   * @param instance — the parent workflow instance
   * @param rule — the escalation rule configured for this step
   * @param escalationCount — how many times this step has already been escalated
   * @returns the resolved escalation target, or null if no escalation is needed
   * @throws EscalationRoutingError if escalation would exceed maxEscalations
   */
  static resolveTarget(
    step: WorkflowStep,
    _instance: WorkflowInstance,
    rule: EscalationRule,
    escalationCount: number,
  ): EscalationTarget | null {
    // No escalation needed if step is terminal
    if (step.isTerminal) return null;

    // Check max escalations
    if (escalationCount >= rule.maxEscalations) {
      throw new EscalationRoutingError(
        `Step '${step.id}' has reached max escalations (${rule.maxEscalations}). ` +
          `The step will be forcibly failed.`,
      );
    }

    return {
      targetRoles: rule.targetRoles,
      severity: rule.severity,
      cascadeUpstream: rule.cascadeUpstream,
    };
  }

  /**
   * Build the default escalation rule for a given assignee role.
   * Escalates to the next higher role with warning severity.
   */
  static buildDefaultRule(assigneeRole: string, nextRole?: string): EscalationRule {
    const targetRoles = nextRole ? [assigneeRole, nextRole] : [assigneeRole];
    return {
      targetRoles,
      severity: 'warning',
      cascadeUpstream: false,
      maxEscalations: 3,
    };
  }

  /**
   * Generate an escalation message template based on the step and rule.
   */
  static escalationMessage(
    stepId: string,
    stepOrder: number,
    targetRoles: string[],
    severity: string,
  ): string {
    return (
      `[${severity.toUpperCase()}] Step #${stepOrder + 1} (id: ${stepId}) has timed out. ` +
      `Action required by role(s): ${targetRoles.join(', ')}.`
    );
  }
}
