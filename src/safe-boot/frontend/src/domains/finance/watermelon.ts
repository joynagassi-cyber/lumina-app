/**
 * Finance Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: transaction_record physical table
 */

import { Table, text, num, sqliteColumns } from '@nozbe/watermelondb';

/**
 * SQLite schema for the transactions table.
 * Mirrors physical table with WatermelonDB conventions:
 *  - `id` column (required by WatermelonDB)
 *  - `_updatedAt` column (required for sync tracking)
 *  - amount stored as integer (BIGINT equivalent) per BR-RES-008
 */
export function getTransactionSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean }>;
} {
  return {
    name: 'transactions',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'type', type: 'text', isIndexed: true },
      { name: 'description', type: 'text' },
      { name: 'amount', type: 'integer' },
      { name: 'category_id', type: 'text', isNullable: true },
      { name: 'transaction_date', type: 'text' },
      { name: 'state', type: 'text', isIndexed: true },
      { name: 'scope_type', type: 'text', isIndexed: true },
      { name: 'scope_target', type: 'text', isNullable: true },
      { name: 'compensates_for', type: 'text', isNullable: true },
      { name: 'created_by', type: 'text' },
      { name: 'updated_by', type: 'text', isNullable: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'metadata_json', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}
