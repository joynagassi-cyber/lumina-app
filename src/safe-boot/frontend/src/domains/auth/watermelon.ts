/**
 * Authentication Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: user_sessions, mfa_configurations tables
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the user_sessions table.
 * Note: Tokens are stored encrypted/hashed in practice.
 */
export function getAuthSessionSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'user_sessions',
    columns: [
      { name: 'user_id', type: 'text', isIndexed: true },
      { name: 'organization_id', type: 'text', isIndexed: true, isNullable: true },
      { name: 'access_token', type: 'text', isNullable: true }, // Encrypted/hashed
      { name: 'refresh_token_hash', type: 'text' },
      { name: 'expires_at', type: 'text', isIndexed: true },
      { name: 'device_info', type: 'text' }, // JSON serialized
      { name: 'ip_address', type: 'text', isNullable: true },
      { name: 'user_agent', type: 'text', isNullable: true },
      { name: 'state', type: 'text', isIndexed: true },
      { name: 'requires_mfa', type: 'integer' },
      { name: 'last_activity_at', type: 'text', isIndexed: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}

/**
 * SQLite schema for the mfa_configurations table.
 */
export function getMFASetupSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'mfa_configurations',
    columns: [
      { name: 'user_id', type: 'text', isIndexed: true },
      { name: 'method', type: 'text', isIndexed: true },
      { name: 'is_enabled', type: 'integer' },
      { name: 'status', type: 'text', isIndexed: true },
      { name: 'qr_code', type: 'text', isNullable: true },
      { name: 'recovery_codes', type: 'text' }, // JSON serialized
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}