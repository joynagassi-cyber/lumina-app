/**
 * Workflow Domain — Barrel exports (ITS-V1 compliance)
 *
 * All domain types, application service, ports, and infrastructure adapters
 * are re-exported from this single index for clean consumer imports.
 *
 * @traceability DOC-012 Aggregate5 → all canonical sources
 */

// ---- Value Objects ----
export {
  WorkflowTrigger,
  assertValidWorkflowTrigger,
  InvalidWorkflowTriggerError,
} from './domain/value-objects/workflow-trigger.vo';

export {
  StepType,
  assertValidStepType,
  InvalidStepTypeError,
} from './domain/value-objects/step-type.vo';

export {
  TIMEOUT_MAX_DAYS,
  TIMEOUT_MIN_DAYS,
  assertValidStepTimeout,
  stepTimeoutToMs,
  InvalidStepTimeoutError,
} from './domain/value-objects/step-timeout.vo';

export {
  MAX_APPROVAL_LEVELS,
  type ApprovalChainLevel,
  assertValidApprovalChain,
  createApprovalChain,
  InvalidApprovalChainError,
  ApprovalChainLevelExceededError,
} from './domain/value-objects/approval-chain.vo';

export {
  assertValidConditionExpression,
  InvalidConditionExpressionError,
} from './domain/value-objects/condition-expression.vo';

export {
  type EscalationRule,
  assertValidEscalationRule,
  InvalidEscalationRuleError,
} from './domain/value-objects/escalation-rule.vo';

// ---- Entities ----
export {
  WorkflowInstance,
  WorkflowInstanceStatus,
  isValidWorkflowTransition,
  assertValidWorkflowInstanceStatus,
  InvalidWorkflowInstanceStatusError,
  WorkflowInstanceNotRunningError,
  InvalidCurrentStepIndexError,
} from './domain/entities/workflow-instance.entity';

export {
  WorkflowStep,
  WorkflowStepStatus,
  isValidWorkflowStepTransition,
  assertValidWorkflowStepStatus,
  InvalidWorkflowStepStatusError,
  WorkflowStepTimeoutExceededError,
} from './domain/entities/workflow-step.entity';

// ---- Domain Services ----
export {
  StepExecutor,
  type ExecutionResult,
  type IStepTypeExecutor,
  StepExecutionError,
} from './domain/services/step-executor.service';

export {
  TimeoutMonitor,
  type StaleStepReport,
} from './domain/services/timeout-monitor.service';

export {
  EscalationRouter,
  type EscalationTarget,
  EscalationRoutingError,
} from './domain/services/escalation-router.service';

// ---- Policies ----
export {
  MaxStepsPolicy,
  MAX_ALLOWED_STEPS,
  MaxStepsExceededError,
} from './domain/policies/max-steps-policy';

export {
  TimeoutEscalationPolicy,
  TimeoutExceededError,
  MandatoryEscalationRequiredError,
} from './domain/policies/timeout-escalation-policy';

export {
  ApprovalChainPolicy,
  ApprovalChainExceededError,
  InvalidApprovalChainRoleError,
} from './domain/policies/approval-chain-policy';

export {
  NoFinancialModificationPolicy,
  FinancialModificationForbiddenError,
} from './domain/policies/no-financial-modification-policy';

// ---- Domain Events ----
export {
  type DomainEvent,
  WorkflowTriggered,
  StepExecuted,
  StepApproved,
  StepRejected,
  StepEscalated,
  WorkflowCompleted,
  WorkflowFailed,
  WorkflowCancelled,
} from './domain/events';

// ---- Ports ----
export type {
  IWorkflowInstanceRepository,
  IWorkflowStepRepository,
  IWorkflowLogRepository,
  FindInstancesByResourceResult,
  FindStepsByInstanceResult,
  WorkflowLogEntry,
  FindLogsByInstanceResult,
} from './ports/repository.port';
export type { IEventPublicationPort, DomainEvent as EventPubDomainEvent } from './ports/event-pub.port';
export type { IAuthorizationPort, RoleType } from './ports/auth.port';
export type { IClockPort } from './ports/clock.port';
export type { IUuidPort } from './ports/uuid.port';
export type { IAuditPort, AuditPayload } from './ports/audit.port';
export type { ILoggerPort } from './ports/logging.port';

// ---- Application Service ----
export {
  WorkflowService,
  WorkflowInstanceNotFoundError,
  WorkflowStepNotFoundError,
  WorkflowNotRunningError,
  StepNotExecutableError,
  FinancialModificationViolationError,
  type TriggerWorkflowInput,
  type ApproveStepInput,
  type RejectStepInput,
  type CancelWorkflowInput,
  type SkipStepInput,
  type ResubmitForApprovalInput,
  type RequestRevisionInput,
  type WorkflowInstanceDto,
  type WorkflowStepDto,
} from './application/workflow.service';
