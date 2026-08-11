/**
 * User/Auth Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: users physical table
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the users table.
 * Mirrors physical table with WatermelonDB conventions:
 *  - `id` column (required by WatermelonDB)
 *  - `_updatedAt` column (required for sync tracking)
 */
export function getUserSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'users',
    columns: [
      { name: 'first_name', type: 'text' },
      { name: 'last_name', type: 'text' },
      { name: 'email', type: 'text', isIndexed: true },
      { name: 'phone', type: 'text', isNullable: true },
      { name: 'role', type: 'text', isIndexed: true },
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'avatar_url', type: 'text', isNullable: true },
      { name: 'is_verified', type: 'integer' },
      { name: 'last_login_at', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}
