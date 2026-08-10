/**
 * Vocabulary Domain — WatermelonDB model.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 7 (VocabularyAggregate)
 * @traceability ADR-003: WatermelonDB schema convention (id, _updatedAt columns)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md: vocabulary_namespaces, vocabulary_terms, vocabulary_values tables
 */

import { sqliteColumns } from '../watermelon-common';

/**
 * SQLite schema for the vocabulary_namespaces table.
 */
export function getNamespaceSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'vocabulary_namespaces',
    columns: [
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'key', type: 'text', isIndexed: true },
      { name: 'label', type: 'text', isIndexed: true },
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

/**
 * SQLite schema for the vocabulary_terms table.
 */
export function getTermSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'vocabulary_terms',
    columns: [
      { name: 'namespace_id', type: 'text', isIndexed: true },
      { name: 'code', type: 'text', isIndexed: true },
      { name: 'label', type: 'text', isIndexed: true },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'type', type: 'text', isIndexed: true },
      { name: 'sort_order', type: 'integer' },
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'is_system', type: 'integer' },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}

/**
 * SQLite schema for the vocabulary_values table.
 */
export function getValueSchema(): {
  name: string;
  columns: Array<{ name: string; type: string; isIndexed?: boolean; isNullable?: boolean }>;
} {
  return {
    name: 'vocabulary_values',
    columns: [
      { name: 'term_id', type: 'text', isIndexed: true },
      { name: 'language', type: 'text', isIndexed: true },
      { name: 'label', type: 'text', isIndexed: true },
      { name: 'description', type: 'text', isNullable: true },
      { name: 'code', type: 'text', isNullable: true, isIndexed: true },
      { name: 'organization_id', type: 'text', isIndexed: true },
      { name: 'version', type: 'integer' },
      { name: 'synced', type: 'integer' },
      { name: 'created_by', type: 'text', isIndexed: true },
      { name: 'updated_by', type: 'text', isNullable: true },
      ...sqliteColumns,
    ],
  };
}