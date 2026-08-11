/**
 * Configuration Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 9 (ConfigurationAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: organization_settings table
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the organization_settings table.
 */
export function getSettingEntrySchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'organization_settings',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'key', type: 'text', isIndexed: true },
      { name: 'label', type: 'text', isIndexed: true },
      { name: 'type', type: 'text', isIndexed: true },
      { name: 'value', type: 'text', isNullable: true }, // JSON serialized
      { name: 'description', type: 'text', isNullable: true },
      { name: 'is_system', type: 'integer' },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}