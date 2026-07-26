/**
 * WorkflowTrigger Value Object
 *
 * Enumerates the domain events that can trigger a workflow instance.
 * Mapped to workflow definitions in the capability manifest.
 *
 * @traceability DOC-012 Aggregate5 §VO-WorkflowTrigger
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_instances.definition_key references manifest trigger patterns
 */

export enum WorkflowTrigger {
  FinanceTransactionCreated = 'finance:transaction:created',
  FinanceExpenseSubmitted = 'finance:expense:submitted',
  FinancePaymentApproved = 'finance:payment:approved',
  MemberApplicationSubmitted = 'members:application:submitted',
  MemberStatusChanged = 'members:status:changed',
  EventPublished = 'events:published',
  EventCancelled = 'events:cancelled',
  ManualAdminTrigger = 'admin:manual',
}

const VALID_TRIGGERS: readonly WorkflowTrigger[] = Object.values(WorkflowTrigger);

export class InvalidWorkflowTriggerError extends Error {
  constructor(value: string) {
    super(`Invalid workflow trigger: "${value}". Must be one of: ${VALID_TRIGGERS.join(', ')}`);
    this.name = 'InvalidWorkflowTriggerError';
  }
}

export function assertValidWorkflowTrigger(value: string): WorkflowTrigger {
  const typed = value as WorkflowTrigger;
  if (!VALID_TRIGGERS.includes(typed)) {
    throw new InvalidWorkflowTriggerError(value);
  }
  return typed;
}
