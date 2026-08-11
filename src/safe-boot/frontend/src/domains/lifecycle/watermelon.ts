/**
 * Lifecycle Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 8 (LifecycleAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: archive_entries, purge_schedules tables
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the archive_entries table.
 */
export function getArchiveEntrySchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'archive_entries',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'resource_type', type: 'text', isIndexed: true },
      { name: 'resource_id', type: 'text', isIndexed: true },
      { name: 'data', type: 'text', isNullable: true }, // JSON serialized
      { name: 'state', type: 'text', isIndexed: true },
      { name: 'reason', type: 'text', isNullable: true },
      { name: 'archived_by', type: 'text', isIndexed: true },
      { name: 'archived_at', type: 'text', isIndexed: true },
      { name: 'purged_at', type: 'text', isNullable: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}

/**
 * SQLite schema for the purge_schedules table.
 */
export function getPurgeScheduleSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'purge_schedules',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'name', type: 'text', isIndexed: true },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'cron_expression', type: 'text' },
      { name: 'retention_days', type: 'integer' },
      { name: 'status', type: 'text', isIndexed: true },
      { name: 'next_run', type: 'text', isIndexed: true },
      { name: 'last_run', type: 'text', isNullable: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}