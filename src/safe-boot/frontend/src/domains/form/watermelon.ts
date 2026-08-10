/**
 * Form Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 6 (FormAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: forms, form_submissions tables
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the forms table.
 */
export function getFormSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'forms',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'title', type: 'text', isIndexed: true },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'code', type: 'text', isIndexed: true },
      { name: 'version', type: 'integer' },
      { name: 'is_active', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'version_number', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'fields_json', type: 'text', isNullable: true }, // Serialized form fields
      ...sqliteColumns,
    ],
  };
}

/**
 * SQLite schema for the form_submissions table.
 */
export function getSubmissionSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'form_submissions',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'form_definition_id', type: 'text', isIndexed: true },
      { name: 'submitted_by', type: 'text', isIndexed: true },
      { name: 'data_json', type: 'text', isNullable: true }, // Serialized submission data
      { name: 'status', type: 'text', isIndexed: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      { name: 'metadata_json', type: 'text', isNullable: true }, // JSON metadata
      ...sqliteColumns,
    ],
  };
}