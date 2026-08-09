/**
 * WorkflowService — Application Service for WorkflowAggregate
 *
 * Orchestrates all 8 commands defined in DOC-012 Aggregate5:
 *   TriggerWorkflow, ApproveStep, RejectStep, CancelWorkflow,
 *   SkipStep, ResubmitForApproval, RequestRevision
 *
 * @traceability DOC-012 Aggregate5 → ASS-WF (Application Service Workflow)
 *   → DOC-023 §5 (Workflow approval chain rules)
 *   → BR-WF-001 through BR-WF-006
 */

import { WorkflowInstance, WorkflowInstanceStatus } from '../domain/entities/workflow-instance.entity';
import { WorkflowStep, WorkflowStepStatus } from '../domain/entities/workflow-step.entity';
import { StepType } from '../domain/value-objects/step-type.vo';
import { TIMEOUT_MAX_DAYS } from '../domain/value-objects/step-timeout.vo';
import { MaxStepsPolicy } from '../domain/policies/max-steps-policy';
import { TimeoutEscalationPolicy } from '../domain/policies/timeout-escalation-policy';
import { NoFinancialModificationPolicy } from '../domain/policies/no-financial-modification-policy';
import type { IWorkflowInstanceRepository, IWorkflowStepRepository, IWorkflowLogRepository } from '../ports/repository.port';
import type { DomainEvent, IEventPublicationPort } from '../../organization/ports/event-pub.port';
import type { IAuthorizationPort, RoleType } from '../../organization/ports/auth.port';
import type { IClockPort } from '../../organization/ports/clock.port';
import type { IUuidPort } from '../../organization/ports/uuid.port';
import type { IAuditPort, AuditPayload } from '../../organization/ports/audit.port';
import type { ILoggerPort } from '../../organization/ports/logging.port';

import {
  WorkflowTriggered,
  StepExecuted,
  StepApproved,
  StepRejected,
  StepEscalated,
  WorkflowCompleted,
  WorkflowFailed,
  WorkflowCancelled,
} from '../domain/events';

// ===========================================================================
// Input / Output DTOs
// ===========================================================================

export interface TriggerWorkflowInput {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly definitionKey: string;
  readonly totalSteps: number;
  readonly createdBy: string;
}

export interface ApproveStepInput {
  readonly stepId: string;
  readonly userId: string;
  readonly comment?: string;
}

export interface RejectStepInput {
  readonly stepId: string;
  readonly userId: string;
  readonly reason: string;
}

export interface CancelWorkflowInput {
  readonly instanceId: string;
  readonly userId: string;
  readonly reason?: string;
}

export interface SkipStepInput {
  readonly stepId: string;
  readonly userId: string;
  readonly reason?: string;
}

export interface ResubmitForApprovalInput {
  readonly stepId: string;
  readonly userId: string;
}

export interface RequestRevisionInput {
  readonly instanceId: string;
  readonly userId: string;
  readonly reason: string;
}

export interface WorkflowInstanceDto {
  readonly id: string;
  readonly orgId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly definitionKey: string;
  readonly currentStepIndex: number;
  readonly totalSteps: number;
  readonly status: string;
  readonly createdAt: Date;
  readonly completionDate?: Date | null;
  readonly cancellationDate?: Date | null;
  readonly version: number;
}

export interface WorkflowStepDto {
  readonly id: string;
  readonly instanceId: string;
  readonly order: number;
  readonly type: string;
  readonly assigneeRole: string;
  readonly status: string;
  readonly timeoutDays: number;
  readonly approvalComment?: string | null;
  readonly rejectionReason?: string | null;
}

// ===========================================================================
// Exceptions
// ===========================================================================

export class WorkflowInstanceNotFoundError extends Error {
  constructor(id: string) {
    super(`Workflow instance not found: ${id}`);
    this.name = 'WorkflowInstanceNotFoundError';
  }
}

export class WorkflowStepNotFoundError extends Error {
  constructor(id: string) {
    super(`Workflow step not found: ${id}`);
    this.name = 'WorkflowStepNotFoundError';
  }
}

export class WorkflowNotRunningError extends Error {
  constructor(instanceId: string) {
    super(`Workflow instance '${instanceId}' is not running (status: running expected).`);
    this.name = 'WorkflowNotRunningError';
  }
}

export class StepNotExecutableError extends Error {
  constructor(stepId: string, currentStatus: string) {
    super(
      `Step '${stepId}' cannot be executed in status '${currentStatus}'. ` +
        `Only 'pending' or 'in_progress' steps are executable.`,
    );
    this.name = 'StepNotExecutableError';
  }
}

export class FinancialModificationViolationError extends Error {
  constructor(transactionId: string, attemptedAction: string) {
    super(
      `Workflow attempted to ${attemptedAction} on approved transaction '${transactionId}'. ` +
        `Per BR-WF-005, financial workflows cannot modify approved transactions directly.`,
    );
    this.name = 'FinancialModificationViolationError';
  }
}

// ===========================================================================
// Application Service
// ===========================================================================

export class WorkflowService {
  constructor(
    private readonly instanceRepo: IWorkflowInstanceRepository,
    private readonly stepRepo: IWorkflowStepRepository,
    private readonly logRepo: IWorkflowLogRepository,
    private readonly eventBus: IEventPublicationPort,
    private readonly authorizer: IAuthorizationPort,
    private readonly clock: IClockPort,
    private readonly uuid: IUuidPort,
    private readonly audit: IAuditPort,
    private readonly logger: ILoggerPort,
  ) {}

  // =======================================================================
  // COMMAND 1: TriggerWorkflow (UC-WF-01)
  // =======================================================================

  /**
   * Create and start a new workflow instance with its steps.
   * Invariants: BR-WF-004 (all states logged), BR-WF-006 (no new capabilities).
   */
  async handleTriggerWorkflow(
    input: TriggerWorkflowInput,
    requestOrgId: string,
  ): Promise<void> {
    const now = this.clock.now();

    // BR-WF-006: Validate step count against max steps policy
    MaxStepsPolicy.validate(input.totalSteps);

    // BR-WF-006: Workflows cannot create new capabilities
    // (capability manifest check enforced by the caller / orchestrator)

    const instanceId = this.uuid.generate();

    const instance = new WorkflowInstance({
      id: instanceId,
      orgId: requestOrgId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      definitionKey: input.definitionKey,
      currentStepIndex: 0,
      totalSteps: input.totalSteps,
      status: WorkflowInstanceStatus.Running,
      createdAt: now,
      completionDate: null,
      cancellationDate: null,
      expirationDate: null,
      version: 1,
    });

    await this.instanceRepo.save(instance);

    // Publish trigger event (BR-WF-004)
    await this.eventBus.publish(
      new WorkflowTriggered(
        instanceId, requestOrgId, input.resourceType, input.resourceId,
        input.definitionKey, now,
      ),
    );

    // Audit log
    await this.audit.log({
      entityType: 'WorkflowInstance',
      entityId: instanceId,
      action: 'create',
      userId: input.createdBy,
      after: {
        resource_type: input.resourceType,
        definition_key: input.definitionKey,
        total_steps: input.totalSteps,
      },
    });

    this.logger.log(
      `Workflow triggered: id=${instanceId}, resource=${input.resourceType}:${input.resourceId}`,
    );
  }

  // =======================================================================
  // COMMAND 2: ApproveStep (UC-WF-02)
  // =======================================================================

  /**
   * Approve a pending/in_progress approval-type step.
   * Invariants: BR-WF-002 (max 5 approval levels), BR-WF-004 (audit log).
   */
  async handleApproveStep(
    input: ApproveStepInput,
    requestOrgId: string,
  ): Promise<void> {
    const now = this.clock.now();

    const step = await this.findStep(input.stepId, requestOrgId);

    if (step.isTerminal) {
      throw new StepNotExecutableError(step.id, step.status);
    }

    // Step must be in 'pending' or 'in_progress' to be approved
    if (step.status !== WorkflowStepStatus.Pending && step.status !== WorkflowStepStatus.InProgress) {
      throw new StepNotExecutableError(step.id, step.status);
    }

    // Find the parent instance
    const instance = await this.findInstance(
      step.instanceId,
      requestOrgId,
    );

    // BR-WF-005: Check for financial modification violations
    NoFinancialModificationPolicy.validate(
      instance.resourceType,
      instance.status,
      `approve step on resource ${instance.resourceType}`,
    );

    // Mark step as completed with approval comment
    step.complete(input.comment ?? 'Approved', now);
    await this.stepRepo.update(step);

    // Advance workflow to next step or complete
    await this._advanceToNextOrComplete(instance, step, now);

    // Events + audit
    await this.eventBus.publish(
      new StepApproved(step.id, instance.id, input.userId, input.comment ?? '', now),
    );

    await this.audit.log({
      entityType: 'WorkflowStep',
      entityId: step.id,
      action: 'approve',
      userId: input.userId,
      before: { status: step.status },
      after: { status: WorkflowStepStatus.Completed, comment: input.comment },
    });
  }

  // =======================================================================
  // COMMAND 3: RejectStep (UC-WF-03)
  // =======================================================================

  /**
   * Reject a pending/in_progress approval-type step.
   * Per BR-WF-003: rejection does NOT auto-retry — the workflow moves to failed.
   */
  async handleRejectStep(
    input: RejectStepInput,
    requestOrgId: string,
  ): Promise<void> {
    const now = this.clock.now();

    const step = await this.findStep(input.stepId, requestOrgId);
    const instance = await this.findInstance(step.instanceId, requestOrgId);

    if (!step.isTerminal) {
      step.fail(input.reason, now);
      await this.stepRepo.update(step);
    }

    // Rejecting an approval step fails the workflow (no automatic retry per BR-WF-003)
    instance.markFailed(now);
    await this.instanceRepo.update(instance);

    await this.eventBus.publish(
      new StepRejected(step.id, instance.id, input.userId, input.reason, now),
    );
    await this.eventBus.publish(
      new WorkflowFailed(instance.id, `Step rejected: ${input.reason}`, step.order, now),
    );

    await this.audit.log({
      entityType: 'WorkflowStep',
      entityId: step.id,
      action: 'reject',
      userId: input.userId,
      after: { reason: input.reason },
    });
  }

  // =======================================================================
  // COMMAND 4: CancelWorkflow (UC-WF-04)
  // =======================================================================

  /**
   * Cancel a running workflow instance.
   */
  async handleCancelWorkflow(
    input: CancelWorkflowInput,
    requestOrgId: string,
  ): Promise<void> {
    const now = this.clock.now();

    const instance = await this.findInstance(input.instanceId, requestOrgId);
    if (!instance.isRunning()) {
      throw new WorkflowNotRunningError(input.instanceId);
    }

    instance.cancel(now);
    await this.instanceRepo.update(instance);

    await this.eventBus.publish(
      new WorkflowCancelled(input.instanceId, input.userId, input.reason, now),
    );

    await this.audit.log({
      entityType: 'WorkflowInstance',
      entityId: input.instanceId,
      action: 'delete',
      userId: input.userId,
      after: { reason: input.reason },
    });
  }

  // =======================================================================
  // COMMAND 5: SkipStep (UC-WF-05)
  // =======================================================================

  /**
   * Skip a pending step (e.g. conditional branch not applicable).
   */
  async handleSkipStep(
    input: SkipStepInput,
    requestOrgId: string,
  ): Promise<void> {
    const now = this.clock.now();

    const step = await this.findStep(input.stepId, requestOrgId);
    const instance = await this.findInstance(step.instanceId, requestOrgId);

    step.skip(input.reason, now);
    await this.stepRepo.update(step);

    await this._advanceToNextOrComplete(instance, step, now);
  }

  // =======================================================================
  // COMMAND 6: ResubmitForApproval (UC-WF-06)
  // =======================================================================

  /**
   * Reset a rejected step back to pending so it can be resubmitted.
   * Per BR-WF-003: only MANUAL resubmission is allowed.
   */
  async handleResubmitForApproval(
    input: ResubmitForApprovalInput,
    requestOrgId: string,
  ): Promise<void> {
    const now = this.clock.now();

    const step = await this.findStep(input.stepId, requestOrgId);

    // BR-WF-003: Manual retry only — check user has appropriate role
    const isAuthorized = await this.authorizer.hasRole(
      input.userId,
      'admin' as RoleType,
    );
    if (!isAuthorized) {
      throw new Error(
        `Manual resubmit requires admin role per BR-WF-003. User '${input.userId}' lacks authorization.`,
      );
    }

    // Reset the step to pending (BR-WF-003: manual only)
    step.resetToPending(now);
    await this.stepRepo.update(step);
  }

  // =======================================================================
  // COMMAND 7: RequestRevision (UC-WF-07)
  // =======================================================================

  /**
   * Request a revision on the resource that this workflow operates on.
   * Reverts the current step to pending so the resource can be updated.
   */
  async handleRequestRevision(
    input: RequestRevisionInput,
    requestOrgId: string,
  ): Promise<void> {
    const now = this.clock.now();

    const instance = await this.findInstance(input.instanceId, requestOrgId);
    const steps = await this.stepRepo.findByInstanceId(instance.id, requestOrgId);

    const currentStep = steps.find(s => s.order === instance.currentStepIndex);
    if (currentStep) {
      currentStep.resetToPending(now);
      await this.stepRepo.update(currentStep);
    }

    await this.audit.log({
      entityType: 'WorkflowInstance',
      entityId: instance.id,
      action: 'update',
      userId: input.userId,
      after: { reason: input.reason },
    });
  }

  // =======================================================================
  // QUERIES
  // =======================================================================

  /** Get a workflow instance by ID with its steps. */
  async getInstance(
    instanceId: string,
    requestOrgId: string,
  ): Promise<WorkflowInstanceDto> {
    const instance = await this.findInstance(instanceId, requestOrgId);

    return {
      id: instance.id,
      orgId: instance.orgId,
      resourceType: instance.resourceType,
      resourceId: instance.resourceId,
      definitionKey: instance.definitionKey,
      currentStepIndex: instance.currentStepIndex,
      totalSteps: instance.totalSteps,
      status: instance.status,
      createdAt: instance.createdAt,
      completionDate: instance.completionDate,
      cancellationDate: instance.cancellationDate,
      version: instance.version,
    };
  }

  /** Get all steps for a workflow instance. */
  getSteps(
    instanceId: string,
    requestOrgId: string,
  ): Promise<WorkflowStepDto[]> {
    return this.stepRepo.findByInstanceId(instanceId, requestOrgId).then(steps =>
      steps.map(s => ({
        id: s.id,
        instanceId: s.instanceId,
        order: s.order,
        type: s.type,
        assigneeRole: s.assigneeRole,
        status: s.status,
        timeoutDays: s.timeoutDays,
        approvalComment: s.approvalComment,
        rejectionReason: s.rejectionReason,
      })),
    );
  }

  // =======================================================================
  // PRIVATE HELPERS
  // =======================================================================

  private async findInstance(
    instanceId: string,
    requestOrgId: string,
  ): Promise<WorkflowInstance> {
    const instance = await this.instanceRepo.findById(instanceId, requestOrgId);
    if (!instance) throw new WorkflowInstanceNotFoundError(instanceId);
    return instance;
  }

  private async findStep(
    stepId: string,
    requestOrgId: string,
  ): Promise<WorkflowStep> {
    const step = await this.stepRepo.findById(stepId, requestOrgId);
    if (!step) throw new WorkflowStepNotFoundError(stepId);
    return step;
  }

  /**
   * Advance the workflow to the next step or mark it complete.
   */
  private async _advanceToNextOrComplete(
    instance: WorkflowInstance,
    currentStep: WorkflowStep,
    now: Date,
  ): Promise<void> {
    const steps = await this.stepRepo.findByInstanceId(instance.id, instance.orgId);
    const nextIndex = currentStep.order + 1;

    if (nextIndex >= instance.totalSteps) {
      // All steps done
      instance.complete(now);
      await this.instanceRepo.update(instance);

      await this.eventBus.publish(
        new WorkflowCompleted(instance.id, instance.totalSteps, currentStep.executedBy ?? 'system', now),
      );

      await this.audit.log({
        entityType: 'WorkflowInstance',
        entityId: instance.id,
        action: 'approve',
        userId: currentStep.executedBy ?? 'system',
        after: { status: WorkflowInstanceStatus.Completed },
      });
    } else {
      // Move to next step
      instance.advanceStep(nextIndex);
      await this.instanceRepo.update(instance);

      const nextStep = steps.find(s => s.order === nextIndex);
      if (nextStep) {
        nextStep.startExecuting('system', now);
        await this.stepRepo.update(nextStep);

        await this.eventBus.publish(
          new StepExecuted(
            nextStep.id, instance.id, nextStep.type, nextStep.order, 'system', now,
          ),
        );

        await this.audit.log({
          entityType: 'WorkflowStep',
          entityId: nextStep.id,
          action: 'notify',
          userId: 'system',
          after: { status: WorkflowStepStatus.InProgress },
        });
      }
    }
  }
}
