/**
 * Reporting Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 10 (ReportingAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: report_templates, report_instances, report_snapshots tables
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the report_instances table.
 */
export function getReportInstanceSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'report_instances',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'report_definition_id', type: 'text', isIndexed: true },
      { name: 'period_start', type: 'text', isIndexed: true },
      { name: 'period_end', type: 'text', isIndexed: true },
      { name: 'period', type: 'text', isIndexed: true },
      { name: 'type', type: 'text', isIndexed: true },
      { name: 'data', type: 'text', isNullable: true }, // JSON serialized
      { name: 'status', type: 'text', isIndexed: true },
      { name: 'generated_by', type: 'text', isIndexed: true },
      { name: 'generated_at', type: 'text', isIndexed: true },
      { name: 'expires_at', type: 'text', isNullable: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}

/**
 * SQLite schema for the report_snapshots table.
 */
export function getReportSnapshotSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'report_snapshots',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'snapshot_date', type: 'text', isIndexed: true },
      { name: 'metrics', type: 'text', isNullable: true }, // JSON serialized
      { name: 'currency', type: 'text' },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}

/**
 * SQLite schema for the report_templates table.
 */
export function getReportDefinitionSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'report_templates',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'code', type: 'text', isIndexed: true },
      { name: 'title', type: 'text', isIndexed: true },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'type', type: 'text', isIndexed: true },
      { name: 'default_period', type: 'text' },
      { name: 'is_system', type: 'integer' },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}