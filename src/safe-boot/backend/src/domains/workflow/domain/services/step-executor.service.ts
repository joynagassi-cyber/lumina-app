/**
 * StepExecutor Domain Service
 *
 * Executes the current step of a WorkflowInstance based on its StepType.
 * Dispatches to the correct execution strategy: auto → direct, approval → delegate,
 * notification → publish, conditional → evaluate, delay → schedule, parallel → fan-out.
 *
 * @traceability DOC-012 Aggregate5 §DomainService-StepExecutor
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps.type_etape
 *   → BR-WF-004 (All execution states logged — calls IAuditPort)
 */

import { StepType } from '../value-objects/step-type.vo';
import { WorkflowStepStatus } from '../domain/entities/workflow-step.entity';
import type { WorkflowStep } from '../domain/entities/workflow-step.entity';

export interface ExecutionResult {
  readonly success: boolean;
  readonly stepStatus: WorkflowStepStatus;
  readonly message?: string;
}

export class StepExecutionError extends Error {
  constructor(stepId: string, stepType: string, reason: string) {
    super(`Failed to execute step '${stepId}' of type '${stepType}': ${reason}`);
    this.name = 'StepExecutionError';
  }
}

/**
 * Port required by StepExecutor to delegate execution per step type.
 */
export interface IStepTypeExecutor {
  executeAuto(step: WorkflowStep): Promise<ExecutionResult>;
  executeApproval(step: WorkflowStep, actorId: string): Promise<ExecutionResult>;
  executeNotification(step: WorkflowStep): Promise<ExecutionResult>;
  executeConditional(step: WorkflowStep): Promise<ExecutionResult>;
  executeDelay(step: WorkflowStep): Promise<ExecutionResult>;
  executeParallel(step: WorkflowStep): Promise<ExecutionResult>;
}

/**
 * The StepExecutor orchestrates step execution by delegating to the appropriate
 * IStepTypeExecutor implementation based on the step's type.
 *
 * This service is stateless and has no direct port dependencies — it receives
 * all cross-cutting concerns (audit, events) via its executor parameter.
 */
export class StepExecutor {
  constructor(
    private readonly typeExecutor: IStepTypeExecutor,
  ) {}

  /**
   * Execute the given step and return the result.
   *
   * Steps must be in 'pending' or 'in_progress' status to be executed.
   * Terminal steps ('completed', 'failed', 'skipped') cannot be re-executed.
   */
  async execute(step: WorkflowStep, actorId?: string): Promise<ExecutionResult> {
    if (step.isTerminal) {
      throw new StepExecutionError(
        step.id,
        step.type,
        `Step is already terminal with status '${step.status}'.`,
      );
    }

    switch (step.type) {
      case StepType.Auto:
        return this.typeExecutor.executeAuto(step);

      case StepType.Approval:
        if (!actorId) {
          throw new StepExecutionError(step.id, 'approval', 'Actor ID is required for approval steps.');
        }
        return this.typeExecutor.executeApproval(step, actorId);

      case StepType.Notification:
        return this.typeExecutor.executeNotification(step);

      case StepType.Conditional:
        return this.typeExecutor.executeConditional(step);

      case StepType.Delay:
        return this.typeExecutor.executeDelay(step);

      case StepType.Parallel:
        return this.typeExecutor.executeParallel(step);

      default: {
        const _exhaustive: never = step.type;
        throw new StepExecutionError(step.id, step.type, `Unknown step type: ${(step.type as string)}`);
      }
    }
  }

  /**
   * Check whether a step should be executed based on its current position
   * and the workflow instance's progress.
   */
  static canExecute(step: WorkflowStep, currentStepIndex: number): boolean {
    return step.order === currentStepIndex && !step.isTerminal;
  }
}
