/**
 * Workflow Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 5 (WorkflowAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: workflows, workflow_instances, workflow_steps tables
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the workflow_instances table.
 */
export function getWorkflowInstanceSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'workflow_instances',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'workflow_definition_id', type: 'text', isIndexed: true },
      { name: 'context_id', type: 'text', isIndexed: true },
      { name: 'context_type', type: 'text', isIndexed: true },
      { name: 'state', type: 'text', isIndexed: true },
      { name: 'current_step', type: 'integer' },
      { name: 'total_steps', type: 'integer' },
      { name: 'started_at', type: 'text', isNullable: true },
      { name: 'completed_at', type: 'text', isNullable: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}

/**
 * SQLite schema for the workflow_steps table.
 */
export function getWorkflowStepSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'workflow_steps',
    columns: [
      { name: 'workflow_instance_id', type: 'text', isIndexed: true },
      { name: 'name', type: 'text' },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'state', type: 'text', isIndexed: true },
      { name: 'index', type: 'integer', isIndexed: true },
      { name: 'assigned_to', type: 'text', isIndexed: true, isNullable: true },
      { name: 'started_at', type: 'text', isNullable: true },
      { name: 'completed_at', type: 'text', isNullable: true },
      { name: 'error', type: 'text', isNullable: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}

/**
 * SQLite schema for the workflow_definitions table.
 */
export function getWorkflowDefinitionSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'workflow_definitions',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'title', type: 'text', isIndexed: true },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'type', type: 'text', isIndexed: true },
      { name: 'version', type: 'integer' },
      { name: 'state', type: 'text', isIndexed: true },
      { name: 'is_system', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      { name: 'steps_json', type: 'text', isNullable: true }, // Serialized step definitions
      ...sqliteColumns,
    ],
  };
}