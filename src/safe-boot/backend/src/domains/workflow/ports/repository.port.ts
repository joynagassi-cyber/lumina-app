/**
 * Repository Ports — WorkflowAggregate
 *
 * Defines the contracts for persisting and querying WorkflowInstance,
 * WorkflowStep, and WorkflowLog entities.
 * Consumers depend on these interfaces; infrastructure adapters implement them.
 *
 * @traceability DOC-012 Aggregate5 → POSTGRESQL-SCHEMA-PACK-v1 tables: workflow_instances, workflow_steps, workflow_logs
 *   → DOC-023 §5 (Workflow approval chain rules)
 *   → PAS-005 PA-NB-007 (RepositoryAbstraction — persistence metadata stripped at boundary)
 */

import { WorkflowInstance } from '../../domain/entities/workflow-instance.entity';
import { WorkflowStep } from '../../domain/entities/workflow-step.entity';

// ---- Results ----

export interface FindInstancesByResourceResult {
  instances: WorkflowInstance[];
}

export interface FindStepsByInstanceResult {
  steps: WorkflowStep[];
}

export interface WorkflowLogEntry {
  readonly id: string;
  readonly instanceId: string;
  readonly stepId?: string | null;
  readonly action: string;
  readonly executedBy: string;
  readonly comment?: string | null;
  readonly occurredAt: Date;
}

export interface FindLogsByInstanceResult {
  logs: WorkflowLogEntry[];
}

// ---- Workflow Instance Repository ----

/**
 * Repository for the WorkflowInstance aggregate root.
 * All operations MUST include org_id per NB-MT-002 multi-tenant isolation.
 */
export interface IWorkflowInstanceRepository {
  findById(instanceId: string, requestOrgId: string): Promise<WorkflowInstance | null>;
  findByResource(resourceType: string, resourceId: string, requestOrgId: string): Promise<WorkflowInstance[]>;
  findRunningInstances(requestOrgId: string): Promise<WorkflowInstance[]>;
  save(entity: WorkflowInstance): Promise<void>;
  update(entity: WorkflowInstance): Promise<void>;
}

// ---- Workflow Step Repository ----

/**
 * Repository for workflow steps within a WorkflowInstance.
 */
export interface IWorkflowStepRepository {
  findById(stepId: string, requestOrgId: string): Promise<WorkflowStep | null>;
  findByInstanceId(instanceId: string, requestOrgId: string): Promise<WorkflowStep[]>;
  findPendingOrInProgressSteps(requestOrgId: string): Promise<WorkflowStep[]>;
  save(entity: WorkflowStep): Promise<void>;
  update(entity: WorkflowStep): Promise<void>;
}

// ---- Workflow Log Repository ----

/**
 * Repository for workflow execution audit logs.
 * Append-only — only save is supported.
 */
export interface IWorkflowLogRepository {
  findByInstanceId(instanceId: string, requestOrgId: string): Promise<WorkflowLogEntry[]>;
  save(entry: Omit<WorkflowLogEntry, 'id'> & { id?: string }): Promise<string>; // returns log id
}
