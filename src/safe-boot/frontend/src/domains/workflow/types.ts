/**
 * Workflow Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 5 (WorkflowAggregate)
 * @traceability DOC-006: Workflow concept
 * @traceability DOC-021: Physical Data Model workflow tables
 * @traceability ASS-001: Application Services for workflow operations
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Workflow type enum per BR-WFK-001 classification.
 */
export type WorkflowType = 'approval' | 'notification' | 'process' | 'custom';

/**
 * Workflow state/lifecycle per BR-WFK transitions.
 */
export type WorkflowState = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

/**
 * Step state in a workflow instance.
 */
export type StepState = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * WorkflowAggregate definition (template).
 * Maps to physical table `workflows` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface WorkflowDefinition {
  /** Universally unique identifier for this workflow definition. */
  readonly id: string;

  /** Organization this workflow belongs to. */
  readonly organizationId: string;

  /** Workflow title. */
  readonly title: string;

  /** Workflow description. */
  readonly description: string;

  /** Workflow type. */
  readonly type: WorkflowType;

  /** Version number (for iterative design). */
  readonly version: number;

  /** Current state of the workflow definition. */
  readonly state: WorkflowState;

  /** Whether this workflow is system-defined. */
  readonly isSystem: boolean;

  /** Creator user ID. */
  readonly createdBy: string;

  /** Version for optimistic locking. */
  readonly versionNumber: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * WorkflowInstance — runtime execution of a workflow definition.
 */
export interface WorkflowInstance {
  /** Universally unique identifier for this workflow instance. */
  readonly id: string;

  /** Reference to the workflow definition ID. */
  readonly workflowDefinitionId: string;

  /** Organization this instance belongs to. */
  readonly organizationId: string;

  /** Context/resource this workflow operates on (e.g., transaction ID, member ID). */
  readonly contextId: string;

  /** Context type (e.g., 'transaction', 'member', 'event'). */
  readonly contextType: string;

  /** Current state of the workflow instance. */
  readonly state: WorkflowState;

  /** Current step index (0-based). */
  readonly currentStep: number;

  /** Total number of steps in the workflow. */
  readonly totalSteps: number;

  /** Start datetime (when instance was created). */
  readonly startedAt: string | null;

  /** End datetime (when instance completed or was cancelled). */
  readonly completedAt: string | null;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * Step in a workflow instance.
 */
export interface WorkflowStep {
  /** Unique identifier for this step. */
  readonly id: string;

  /** Step name/title. */
  readonly name: string;

  /** Step description. */
  readonly description: string;

  /** Step state. */
  readonly state: StepState;

  /** Step index (0-based). */
  readonly index: number;

  /** Assignee user ID (null if unassigned). */
  readonly assignedTo: string | null;

  /** Started datetime (null if pending). */
  readonly startedAt: string | null;

  /** Completed datetime (null if not completed). */
  readonly completedAt: string | null;

  /** Error message (if step failed). */
  readonly error: string | null;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for CreateWorkflowDefinition command.
 */
export interface CreateWorkflowDefinitionInput {
  /** Organization ID (injected from context). */
  readonly organizationId: string;

  /** Workflow title (required). */
  readonly title: string;

  /** Workflow description (optional). */
  readonly description?: string;

  /** Workflow type (required). */
  readonly type: WorkflowType;

  /** Steps array (required, each with name, description, assignee). */
  readonly steps: Array<readonly [string, string, string | null]>;

  /** Version (default: 1). */
  readonly version?: number;

  /** Whether this is a system workflow (default: false). */
  readonly isSystem?: boolean;
}

/**
 * Input for UpdateWorkflowDefinition command.
 */
export interface UpdateWorkflowDefinitionInput {
  /** Workflow definition ID to update. */
  readonly workflowDefinitionId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Workflow title (optional update). */
  readonly title?: string;

  /** Workflow description (optional update). */
  readonly description?: string;

  /** Workflow state transition (triggers lifecycle validation). */
  readonly state?: WorkflowState;

  /** Steps update (optional). */
  readonly steps?: Array<readonly [string, string, string | null]>;
}

/**
 * Input for CreateWorkflowInstance command.
 */
export interface CreateWorkflowInstanceInput {
  /** Workflow definition ID to instantiate. */
  readonly workflowDefinitionId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Context ID this workflow operates on. */
  readonly contextId: string;

  /** Context type (e.g., 'transaction', 'member'). */
  readonly contextType: string;

  /** Initiator user ID. */
  readonly initiatedBy: string;
}

/**
 * Input for ListWorkflowInstances query.
 */
export interface ListWorkflowInstancesInput {
  /** Organization ID. */
  readonly organizationId: string;

  /** Filter by workflow definition ID (optional). */
  readonly workflowDefinitionId?: string;

  /** Filter by context type (optional). */
  readonly contextType?: string;

  /** Filter by state (optional). */
  readonly state?: WorkflowState;

  /** Pagination: page number (default: 1). */
  readonly page?: number;

  /** Pagination: items per page (default: 20, max: 100). */
  readonly limit?: number;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Generic pagination response.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly hasNextPage: boolean;
}

/**
 * Workflow step aggregation with context.
 */
export interface WorkflowStepWithAction {
  /** Step details. */
  readonly step: WorkflowStep;

  /** Action available on this step (e.g., 'complete', 'skip', 'assign'). */
  readonly action?: 'complete' | 'skip' | 'assign' | 'retry';
}

/**
 * Aggregated structure returned by useWorkflows().
 */
export interface WorkflowDomainModel {
  /** List of workflow instances. */
  readonly instances: ReadonlyArray<WorkflowInstance>;

  /** Total count matching filters. */
  readonly totalCount: number;

  /** Currently selected instance (if any). */
  readonly selectedInstance: WorkflowInstance | null;

  /** Steps for the selected instance. */
  readonly steps: ReadonlyArray<WorkflowStep>;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/*  WatermelonDB Attributes                                            */
/* ------------------------------------------------------------------ */

/**
 * Attributes for the WorkflowInstance WatermelonDB model.
 */
export interface WorkflowInstanceAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  workflowDefinitionId: string;
  contextId: string;
  contextType: string;
  state: WorkflowState;
  currentStep: number;
  totalSteps: number;
  startedAt: string | null;
  completedAt: string | null;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Attributes for the WorkflowStep WatermelonDB model.
 */
export interface WorkflowStepAttrs {
  id: string;
  _updatedAt: number;
  workflowInstanceId: string;
  name: string;
  description: string;
  state: StepState;
  index: number;
  assignedTo: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}