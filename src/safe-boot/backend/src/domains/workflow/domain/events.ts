/**
 * Domain Events — WorkflowAggregate
 *
 * All events defined per DOC-012 Aggregate5 §DomainEvents produced by the workflow lifecycle.
 * Each event implements the DomainEvent contract defined in the EventPublicationPort.
 *
 * @traceability DOC-012 Aggregate5 §DomainEvents
 *   → DOC-023 §5 (Workflow approval chain rules and audit requirements)
 *   → PAS-005 PA-NB-006 (EventConsistency — payloads never modified)
 */

export interface DomainEvent {
  readonly aggregateId: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;
}

// ===================================================================
// Workflow Instance Events
// ===================================================================

export class WorkflowTriggered implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'WorkflowTriggered';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    instanceId: string,
    orgId: string,
    resourceType: string,
    resourceId: string,
    definitionKey: string,
    timestamp: Date,
  ) {
    this.aggregateId = instanceId;
    this.timestamp = timestamp;
    this.payload = {
      org_id: orgId,
      resource_type: resourceType,
      resource_id: resourceId,
      definition_key: definitionKey,
    };
  }
}

export class WorkflowCompleted implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'WorkflowCompleted';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(instanceId: string, totalSteps: number, completedBy: string, timestamp: Date) {
    this.aggregateId = instanceId;
    this.timestamp = timestamp;
    this.payload = { total_steps: totalSteps, completed_by: completedBy };
  }
}

export class WorkflowFailed implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'WorkflowFailed';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    instanceId: string,
    failureReason: string,
    failedAtStepIndex: number,
    timestamp: Date,
  ) {
    this.aggregateId = instanceId;
    this.timestamp = timestamp;
    this.payload = {
      failure_reason: failureReason,
      failed_at_step_index: failedAtStepIndex,
    };
  }
}

export class WorkflowCancelled implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'WorkflowCancelled';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(instanceId: string, cancelledBy: string, reason?: string, timestamp?: Date) {
    this.aggregateId = instanceId;
    this.timestamp = timestamp || new Date();
    this.payload = { cancelled_by: cancelledBy, ...(reason ? { reason } : {}) };
  }
}

// ===================================================================
// Workflow Step Events
// ===================================================================

export class StepExecuted implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'StepExecuted';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    stepId: string,
    instanceId: string,
    stepType: string,
    stepOrder: number,
    executedBy: string,
    timestamp: Date,
  ) {
    this.aggregateId = stepId;
    this.timestamp = timestamp;
    this.payload = {
      instance_id: instanceId,
      step_type: stepType,
      step_order: stepOrder,
      executed_by: executedBy,
    };
  }
}

export class StepApproved implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'StepApproved';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    stepId: string,
    instanceId: string,
    approverId: string,
    comment: string,
    timestamp: Date,
  ) {
    this.aggregateId = stepId;
    this.timestamp = timestamp;
    this.payload = {
      instance_id: instanceId,
      approver_id: approverId,
      comment,
    };
  }
}

export class StepRejected implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'StepRejected';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    stepId: string,
    instanceId: string,
    rejecterId: string,
    reason: string,
    timestamp: Date,
  ) {
    this.aggregateId = stepId;
    this.timestamp = timestamp;
    this.payload = {
      instance_id: instanceId,
      rejecter_id: rejecterId,
      reason,
    };
  }
}

export class StepEscalated implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'StepEscalated';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    stepId: string,
    instanceId: string,
    escalationRule: Record<string, unknown>,
    timestamp: Date,
  ) {
    this.aggregateId = stepId;
    this.timestamp = timestamp;
    this.payload = { instance_id: instanceId, escalation_rule: escalationRule };
  }
}
