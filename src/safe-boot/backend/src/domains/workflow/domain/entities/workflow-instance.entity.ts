/**
 * WorkflowInstance Entity
 *
 * Represents the execution of a workflow definition against a specific resource.
 * Tracks current step index, total steps, and lifecycle status (running → completed/failed/cancelled).
 *
 * @traceability DOC-012 Aggregate5 §Entity-WorkflowInstance
 *   → POSTGRESQL-SCHEMA-PACK-v1 table: workflow_instances
 *   → DOC-023 §5 Workflow approval chain rules
 */

export interface WorkflowInstanceProps {
  readonly id: string;
  readonly orgId: string;
  /** Resource type this workflow operates on (e.g. 'transaction', 'member'). */
  readonly resourceType: string;
  /** UUID of the resource being processed by this workflow. */
  readonly resourceId: string;
  /** Key identifying the workflow definition (from manifest). */
  readonly definitionKey: string;
  /** Index of the current step (zero-based). */
  currentStepIndex: number;
  /** Total number of steps in this workflow instance. */
  readonly totalSteps: number;
  /** Current lifecycle status. */
  status: WorkflowInstanceStatus;
  /** Date when the workflow was created. */
  readonly createdAt: Date;
  /** Optional date when the workflow completed successfully. */
  completionDate?: Date | null;
  /** Optional date when the workflow was cancelled. */
  cancellationDate?: Date | null;
  /** Optional date when the workflow timed out. */
  expirationDate?: Date | null;
  /** Optimistic concurrency version counter. */
  version: number;
}

export enum WorkflowInstanceStatus {
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

const VALID_STATUSES: readonly WorkflowInstanceStatus[] = Object.values(WorkflowInstanceStatus);

export class InvalidWorkflowInstanceStatusError extends Error {
  constructor(value: string) {
    super(`Invalid workflow instance status: "${value}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    this.name = 'InvalidWorkflowInstanceStatusError';
  }
}

export function assertValidWorkflowInstanceStatus(value: string): WorkflowInstanceStatus {
  const typed = value as WorkflowInstanceStatus;
  if (!VALID_STATUSES.includes(typed)) {
    throw new InvalidWorkflowInstanceStatusError(value);
  }
  return typed;
}

export function isValidWorkflowTransition(from: WorkflowInstanceStatus, to: WorkflowInstanceStatus): boolean {
  switch (from) {
    case WorkflowInstanceStatus.Running:
      return (
        to === WorkflowInstanceStatus.Completed ||
        to === WorkflowInstanceStatus.Failed ||
        to === WorkflowInstanceStatus.Cancelled
      );
    default:
      return false;
  }
}

export class WorkflowInstanceNotRunningError extends Error {
  constructor(instanceId: string, expectedStatus: WorkflowInstanceStatus) {
    super(
      `Workflow instance '${instanceId}' is not in status '${expectedStatus}'. ` +
        `Cannot proceed from non-running state.`,
    );
    this.name = 'WorkflowInstanceNotRunningError';
  }
}

export class InvalidCurrentStepIndexError extends Error {
  constructor(index: number, totalSteps: number) {
    super(
      `Current step index ${index} is invalid for workflow with ${totalSteps} steps. ` +
        `Must be between 0 and ${totalSteps - 1}.`,
    );
    this.name = 'InvalidCurrentStepIndexError';
  }
}

/**
 * The WorkflowInstance aggregate root.
 *
 * Manages the lifecycle of a workflow execution: running → completed / failed / cancelled.
 * All transitions are guarded by isValidWorkflowTransition.
 *
 * Business Rules enforced at entity level:
 * - BR-WF-004: state changes must produce audit-ready properties
 * - BR-WF-003: failed workflows set status 'failed' (cannot auto-retry — application layer enforces manual retry)
 */
export class WorkflowInstance {
  private _props: WorkflowInstanceProps;

  constructor(props: WorkflowInstanceProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get orgId(): string { return this._props.orgId; }
  get resourceType(): string { return this._props.resourceType; }
  get resourceId(): string { return this._props.resourceId; }
  get definitionKey(): string { return this._props.definitionKey; }
  get currentStepIndex(): number { return this._props.currentStepIndex; }
  get totalSteps(): number { return this._props.totalSteps; }
  get status(): WorkflowInstanceStatus { return this._props.status; }
  get createdAt(): Date { return this._props.createdAt; }
  get completionDate(): Date | null { return this._props.completionDate ?? null; }
  get cancellationDate(): Date | null { return this._props.cancellationDate ?? null; }
  get expirationDate(): Date | null { return this._props.expirationDate ?? null; }
  get version(): number { return this._props.version; }

  /** Advance to the next step in the workflow. */
  advanceStep(nextIndex: number): void {
    if (this._props.status !== WorkflowInstanceStatus.Running) {
      throw new WorkflowInstanceNotRunningError(this.id, WorkflowInstanceStatus.Running);
    }
    if (nextIndex < 0 || nextIndex >= this._props.totalSteps) {
      throw new InvalidCurrentStepIndexError(nextIndex, this._props.totalSteps);
    }
    this._props.currentStepIndex = nextIndex;
  }

  /** Complete the workflow successfully. All steps finished. */
  complete(now: Date): void {
    if (this._props.status !== WorkflowInstanceStatus.Running) {
      throw new WorkflowInstanceNotRunningError(this.id, WorkflowInstanceStatus.Running);
    }
    this._props.status = WorkflowInstanceStatus.Completed;
    this._props.completionDate = now;
    this._props.version += 1;
  }

  /** Mark the workflow as failed. Per BR-WF-003: failure does NOT auto-retry. */
  markFailed(now: Date): void {
    if (this._props.status !== WorkflowInstanceStatus.Running) {
      throw new WorkflowInstanceNotRunningError(this.id, WorkflowInstanceStatus.Running);
    }
    this._props.status = WorkflowInstanceStatus.Failed;
    this._props.version += 1;
  }

  /** Cancel the workflow explicitly. */
  cancel(now: Date): void {
    if (this._props.status !== WorkflowInstanceStatus.Running) {
      throw new WorkflowInstanceNotRunningError(this.id, WorkflowInstanceStatus.Running);
    }
    this._props.status = WorkflowInstanceStatus.Cancelled;
    this._props.cancellationDate = now;
    this._props.version += 1;
  }

  /** Check if this workflow instance has exceeded its configured timeout duration. */
  hasTimedOut(timeoutInMs: number, now: Date): boolean {
    if (this._props.status !== WorkflowInstanceStatus.Running) return false;
    const elapsed = now.getTime() - this._props.createdAt.getTime();
    return elapsed > timeoutInMs;
  }

  /** Return true if this workflow is still actively executing. */
  isRunning(): boolean {
    return this._props.status === WorkflowInstanceStatus.Running;
  }

  /** Return true if there are remaining steps to execute. */
  hasRemainingSteps(): boolean {
    return this._props.status === WorkflowInstanceStatus.Running &&
           this._props.currentStepIndex < this._props.totalSteps - 1;
  }

  /** Return the step index that should be executed next. */
  nextStepIndex(): number {
    return this._props.currentStepIndex;
  }

  /**
   * Transition to a new status using the canonical state machine.
   * WorkflowInstance: running → completed / failed / cancelled
   */
  transitionTo(newStatus: WorkflowInstanceStatus, now: Date): void {
    if (!isValidWorkflowTransition(this._props.status, newStatus)) {
      throw new InvalidWorkflowInstanceStatusError(
        `Cannot transition from '${this._props.status}' to '${newStatus}'.`,
      );
    }
    this._props.status = newStatus;
    this._props.version += 1;

    if (newStatus === WorkflowInstanceStatus.Completed) {
      this._props.completionDate = now;
    } else if (newStatus === WorkflowInstanceStatus.Cancelled) {
      this._props.cancellationDate = now;
    }
  }

  equals(other: WorkflowInstance): boolean {
    return this._props.id === other._props.id && this._props.orgId === other._props.orgId;
  }
}
