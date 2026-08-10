/**
 * Sync Domain — WatermelonDB model for pending operations queue.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 13 (OfflineSyncAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability OFFLINE-FIRST-SPEC: .pending_operations table concept
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the pending_operations table.
 * Mirrors the conceptual `.pending_operations` queue from OFFLINE-FIRST spec.
 * WatermelonDB conventions applied: `id` and `_updatedAt` required columns.
 */
export function getPendingOperationSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'pending_operations',
    columns: [
      { name: 'resource_type', type: 'text', isIndexed: true },
      { name: 'resource_id', type: 'text', isIndexed: true },
      { name: 'action', type: 'text', isIndexed: true },
      { name: 'payload_json', type: 'text' },
      { name: 'sync_status', type: 'text', isIndexed: true },
      { name: 'retry_count', type: 'integer' },
      { name: 'error_message', type: 'text', isNullable: true },
      { name: 'client_timestamp', type: 'text' },
      { name: 'server_timestamp', type: 'text', isNullable: true },
      { name: 'organization_id', type: 'text', isIndexed: true },
      ...sqliteColumns,
    ],
  };
}
