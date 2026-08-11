/**
 * Event Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 4 (EventAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: event_record physical table
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the events table.
 * Mirrors physical table with WatermelonDB conventions:
 *  - `id` column (required by WatermelonDB)
 *  - `_updatedAt` column (required for sync tracking)
 *  - recurrence rule stored as JSON per BR-EVT-005
 */
export function getEventSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'events',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'title', type: 'text', isIndexed: true },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'type', type: 'text', isIndexed: true },
      { name: 'start_datetime', type: 'text', isIndexed: true },
      { name: 'end_datetime', type: 'text', isIndexed: true },
      { name: 'location', type: 'text', isNullable: true },
      { name: 'capacity', type: 'integer', isNullable: true },
      { name: 'registered_count', type: 'integer' },
      { name: 'state', type: 'text', isIndexed: true },
      { name: 'scope', type: 'text', isIndexed: true },
      { name: 'organizer_id', type: 'text', isIndexed: true },
      { name: 'is_recurring', type: 'integer' },
      { name: 'recurrence_rule', type: 'text', isNullable: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}