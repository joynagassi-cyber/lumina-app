/**
 * EscalationRule Value Object
 *
 * Defines what happens when a workflow step exceeds its timeout threshold.
 * The escalation rule specifies which role(s) to notify and at what severity level.
 *
 * @traceability DOC-012 Aggregate5 §VO-EscalationRule
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps (escalation metadata stored in jsonb or log table)
 */

export interface EscalationRule {
  /** Role(s) to escalate to when the step times out. */
  readonly targetRoles: string[];
  /** Notification severity: info, warning, or critical. Critical bypasses quiet hours per BR-NOT-005. */
  readonly severity: 'info' | 'warning' | 'critical';
  /** Whether the escalation should also notify all upstream roles in the chain. */
  readonly cascadeUpstream: boolean;
  /** Maximum number of escalations before the step is forcibly failed. */
  readonly maxEscalations: number;
}

export class InvalidEscalationRuleError extends Error {
  constructor(reason: string) {
    super(`Invalid EscalationRule: ${reason}`);
    this.name = 'InvalidEscalationRuleError';
  }
}

const VALID_SEVERITIES: readonly EscalationRule['severity'][] = ['info', 'warning', 'critical'];

/**
 * Validate an escalation rule configuration.
 * - Must have at least one target role.
 * - Severity must be valid.
 * - maxEscalations must be a positive integer.
 */
export function assertValidEscalationRule(rule: EscalationRule): void {
  if (!Array.isArray(rule.targetRoles) || rule.targetRoles.length === 0) {
    throw new InvalidEscalationRuleError('Must specify at least one target role.');
  }
  for (const role of rule.targetRoles) {
    if (typeof role !== 'string' || role.trim().length === 0) {
      throw new InvalidEscalationRuleError('Each target role must be a non-empty string.');
    }
  }
  if (!VALID_SEVERITIES.includes(rule.severity)) {
    throw new InvalidEscalationRuleError(
      `Severity must be one of: ${VALID_SEVERITIES.join(', ')}. Got '${rule.severity}'.`,
    );
  }
  if (!Number.isInteger(rule.maxEscalations) || rule.maxEscalations < 1) {
    throw new InvalidEscalationRuleError('maxEscalations must be a positive integer.');
  }
}
