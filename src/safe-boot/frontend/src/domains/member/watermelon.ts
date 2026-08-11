/**
 * Member Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: members physical table
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the members table.
 * Mirrors physical table with WatermelonDB conventions:
 *  - `id` column (required by WatermelonDB)
 *  - `_updatedAt` column (required for sync tracking)
 *  - metadata stored as JSON per BR-MEM-009 flexible schema
 */
export function getMemberSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'members',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'first_name', type: 'text', isIndexed: true },
      { name: 'last_name', type: 'text', isIndexed: true },
      { name: 'email', type: 'text', isNullable: true, isIndexed: true },
      { name: 'phone', type: 'text', isNullable: true },
      { name: 'birth_date', type: 'text', isNullable: true },
      { name: 'gender', type: 'text', isNullable: true },
      { name: 'state', type: 'text', isIndexed: true },
      { name: 'member_number', type: 'text', isIndexed: true },
      { name: 'join_date', type: 'text', isIndexed: true },
      { name: 'leave_date', type: 'text', isNullable: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      { name: 'metadata', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}