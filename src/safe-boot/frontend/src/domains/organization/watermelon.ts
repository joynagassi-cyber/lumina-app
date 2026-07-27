/**
 * Organization Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 1 (OrganizationAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: organizations physical table
 */

import { Table, text, sqliteColumns } from '@nozbe/watermelondb';

/**
 * SQLite schema for the organizations table.
 * Mirrors physical table with WatermelonDB conventions:
 *  - `id` column (required by WatermelonDB)
 *  - `_updatedAt` column (required for sync tracking)
 */
export function getOrganizationSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean }>;
} {
  return {
    name: 'organizations',
    columns: [
      { name: 'name', type: 'text' },
      { name: 'type', type: 'text', isIndexed: true },
      { name: 'status', type: 'text', isIndexed: true },
      { name: 'currency', type: 'text' },
      { name: 'fiscal_year_start', type: 'integer' },
      { name: 'timezone', type: 'text' },
      { name: 'language', type: 'text' },
      { name: 'accent_hex', type: 'text' },
      { name: 'logo_url', type: 'text', isNullable: true },
      { name: 'short_name', type: 'text', isNullable: true },
      { name: 'depth_level', type: 'integer' },
      { name: 'hierarchy_path', type: 'text' },
      { name: 'parent_id', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}
