/**
 * WorkflowStep Entity
 *
 * Represents an individual step within a WorkflowInstance execution.
 * Each step has a type (auto/approval/notification/conditional/delay/parallel),
 * a status, and a timeout configuration.
 *
 * @traceability DOC-012 Aggregate5 §Entity-WorkflowStep
 *   → POSTGRESQL-SCHEMA-PACK-v1 table: workflow_steps
 *   → CONSTRAINTS-INDEX-SPECIFICATION-v1 CC-WF-001 (timeout_jours <= 30)
 */

import { StepType } from '../value-objects/step-type.vo';

export interface WorkflowStepProps {
  readonly id: string;
  /** FK to the workflow instance this step belongs to. */
  readonly instanceId: string;
  /** Execution order within the workflow (zero-based). */
  readonly order: number;
  /** Type of this step. */
  readonly type: StepType;
  /** Role assigned to approve or execute this step. */
  readonly assigneeRole: string;
  /** Current lifecycle status of the step. */
  status: WorkflowStepStatus;
  /** Timeout in days (checked at domain layer, enforced by DB CHECK ≤ 30 per BR-WF-001). */
  readonly timeoutDays: number;
  /** Approval comment if the step was approved. */
  approvalComment?: string | null;
  /** Rejection reason if the step was rejected. */
  rejectionReason?: string | null;
  /** Optional date when the step expired / timed out. */
  expirationDate?: Date | null;
  /** UUID of the user who last acted on this step. */
  executedBy?: string | null;
  readonly createdAt: Date;
  updatedAt: Date;
}

export enum WorkflowStepStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
}

const VALID_STATUSES: readonly WorkflowStepStatus[] = Object.values(WorkflowStepStatus);

export class InvalidWorkflowStepStatusError extends Error {
  constructor(value: string) {
    super(`Invalid workflow step status: "${value}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    this.name = 'InvalidWorkflowStepStatusError';
  }
}

export function assertValidWorkflowStepStatus(value: string): WorkflowStepStatus {
  const typed = value as WorkflowStepStatus;
  if (!VALID_STATUSES.includes(typed)) {
    throw new InvalidWorkflowStepStatusError(value);
  }
  return typed;
}

export function isValidWorkflowStepTransition(from: WorkflowStepStatus, to: WorkflowStepStatus): boolean {
  switch (from) {
    case WorkflowStepStatus.Pending:
      return to === WorkflowStepStatus.InProgress || to === WorkflowStepStatus.Skipped;
    case WorkflowStepStatus.InProgress:
      return (
        to === WorkflowStepStatus.Completed ||
        to === WorkflowStepStatus.Failed ||
        to === WorkflowStepStatus.Skipped
      );
    default:
      return false; // completed, failed, skipped are terminal
  }
}

export class WorkflowStepTimeoutExceededError extends Error {
  constructor(stepId: string, timeoutDays: number) {
    super(
      `Step '${stepId}' with timeout of ${timeoutDays} day(s) has been exceeded. ` +
        `Escalation is mandatory per TimeoutEscalationPolicy.`,
    );
    this.name = 'WorkflowStepTimeoutExceededError';
  }
}

/**
 * The WorkflowStep entity.
 *
 * State machine: pending → in_progress → completed / failed / skipped
 *
 * Business Rules:
 * - BR-WF-001: timeout max 30 days (enforced via CHECK constraint + domain validation)
 * - BR-WF-004: All transitions logged via AuditLogger (enforced at application layer)
 */
export class WorkflowStep {
  private _props: WorkflowStepProps;

  constructor(props: WorkflowStepProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get instanceId(): string { return this._props.instanceId; }
  get order(): number { return this._props.order; }
  get type(): StepType { return this._props.type; }
  get assigneeRole(): string { return this._props.assigneeRole; }
  get status(): WorkflowStepStatus { return this._props.status; }
  get timeoutDays(): number { return this._props.timeoutDays; }
  get approvalComment(): string | null { return this._props.approvalComment ?? null; }
  get rejectionReason(): string | null { return this._props.rejectionReason ?? null; }
  get expirationDate(): Date | null { return this._props.expirationDate ?? null; }
  get executedBy(): string | null { return this._props.executedBy ?? null; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._props.updatedAt; }
  get isTerminal(): boolean {
    return (
      this._props.status === WorkflowStepStatus.Completed ||
      this._props.status === WorkflowStepStatus.Failed ||
      this._props.status === WorkflowStepStatus.Skipped
    );
  }

  /** Transition the step to in_progress. */
  startExecuting(actorId: string, now: Date): void {
    if (this._props.status !== WorkflowStepStatus.Pending) {
      throw new InvalidWorkflowStepStatusError(
        `Cannot start a step that is not in 'pending' status. Current: '${this._props.status}'.`,
      );
    }
    this._props.status = WorkflowStepStatus.InProgress;
    this._props.executedBy = actorId;
    this._props.updatedAt = now;
  }

  /** Mark the step as completed successfully. */
  complete(comment?: string | null, now?: Date): void {
    const stamp = now || new Date();
    if (!this.isTransitionValid(WorkflowStepStatus.Completed)) {
      throw new InvalidWorkflowStepStatusError(
        `Cannot mark step '${this.id}' as completed from status '${this._props.status}'.`,
      );
    }
    this._props.status = WorkflowStepStatus.Completed;
    this._props.approvalComment = comment ?? null;
    this._props.updatedAt = stamp;
  }

  /** Mark the step as failed. Per BR-WF-003, failure does not auto-retry. */
  fail(reason?: string | null, now?: Date): void {
    const stamp = now || new Date();
    if (!this.isTransitionValid(WorkflowStepStatus.Failed)) {
      throw new InvalidWorkflowStepStatusError(
        `Cannot mark step '${this.id}' as failed from status '${this._props.status}'.`,
      );
    }
    this._props.status = WorkflowStepStatus.Failed;
    this._props.rejectionReason = reason ?? null;
    this._props.updatedAt = stamp;
  }

  /** Skip this step (e.g. conditional branch not taken, or approval delegate). */
  skip(reason?: string | null, now?: Date): void {
    const stamp = now || new Date();
    if (!this.isTransitionValid(WorkflowStepStatus.Skipped)) {
      throw new InvalidWorkflowStepStatusError(
        `Cannot skip step '${this.id}' from status '${this._props.status}'.`,
      );
    }
    this._props.status = WorkflowStepStatus.Skipped;
    this._props.rejectionReason = reason ?? null;
    this._props.updatedAt = stamp;
  }

  /** Approve this step (approval-type steps only). */
  approve(comment: string, userId: string, now?: Date): void {
    if (this._props.type !== StepType.Approval) {
      throw new Error(`Cannot approve a non-approval step of type '${this._props.type}'.`);
    }
    this.complete(comment, now);
  }

  /** Reject this step (approval-type steps only). */
  reject(reason: string, userId: string, now?: Date): void {
    if (this._props.type !== StepType.Approval) {
      throw new Error(`Cannot reject a non-approval step of type '${this._props.type}'.`);
    }
    this.fail(reason, now);
  }

  /**
   * Reset the step to pending status.
   * Used by BR-WF-003 manual retry flow after rejection.
   */
  resetToPending(now?: Date): void {
    const stamp = now || new Date();
    this._props.status = WorkflowStepStatus.Pending;
    this._props.approvalComment = null;
    this._props.rejectionReason = null;
    this._props.updatedAt = stamp;
  }

  /** Check whether this step has timed out based on its configured timeout. */
  hasTimedOut(now: Date): boolean {
    if (this._props.status === WorkflowStepStatus.Pending || this._props.status === WorkflowStepStatus.InProgress) {
      const elapsedMs = now.getTime() - this._props.createdAt.getTime();
      const timeoutMs = this._props.timeoutDays * 24 * 60 * 60 * 1000;
      return elapsedMs > timeoutMs;
    }
    return false;
  }

  /** Validate that a transition from current status to target status is allowed. */
  private isTransitionValid(target: WorkflowStepStatus): boolean {
    return isValidWorkflowStepTransition(this._props.status, target);
  }

  equals(other: WorkflowStep): boolean {
    return this._props.id === other._props.id && this._props.instanceId === other._props.instanceId;
  }
}
