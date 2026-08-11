/**
 * Vocabulary Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 7 (VocabularyAggregate)
 * @traceability DOC-006: Vocabulary concept (terms, values, namespaces)
 * @traceability DOC-021: Physical Data Model vocabulary tables
 * @traceability ASS-001: Application Services for vocabulary operations
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Vocabulary term type.
 */
export type TermType = 'category' | 'attribute' | 'option' | 'flag' | 'custom';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * VocabularyNamespace — a namespace for grouping related terms.
 * Maps to physical table `vocabulary_namespaces` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface VocabularyNamespace {
  /** Universally unique identifier for this namespace. */
  readonly id: string;

  /** Namespace key (e.g., 'countries', 'currencies', 'statuses'). */
  readonly key: string;

  /** Display name for the namespace. */
  readonly label: string;

  /** Description of the namespace. */
  readonly description: string | null;

  /** Organization this namespace belongs to. */
  readonly organizationId: string;

  /** Whether this namespace is system-defined. */
  readonly isSystem: boolean;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * VocabularyTerm — a named term within a namespace.
 * Maps to physical table `vocabulary_terms` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface VocabularyTerm {
  /** Universally unique identifier for this term. */
  readonly id: string;

  /** Reference to the namespace this term belongs to. */
  readonly namespaceId: string;

  /** Term code/key (unique within namespace). */
  readonly code: string;

  /** Term display name. */
  readonly label: string;

  /** Term description. */
  readonly description: string | null;

  /** Term type. */
  readonly type: TermType;

  /** Sort order for the term. */
  readonly sortOrder: number;

  /** Organization this term belongs to. */
  readonly organizationId: string;

  /** Whether this term is system-defined. */
  readonly isSystem: boolean;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * VocabValue — a value associated with a term (for multilingual or extended metadata).
 * Maps to physical table `vocabulary_values` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface VocabValue {
  /** Universally unique identifier for this value record. */
  readonly id: string;

  /** Reference to the term this value belongs to. */
  readonly termId: string;

  /** Language tag (e.g., 'fr', 'en'). */
  readonly language: string;

  /** Value label (display text). */
  readonly label: string;

  /** Value description (optional). */
  readonly description: string | null;

  /** Value code (alternative identifier). */
  readonly code: string | null;

  /** Organization this value belongs to. */
  readonly organizationId: string;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for CreateNamespace command.
 */
export interface CreateNamespaceInput {
  /** Organization ID (injected from context). */
  readonly organizationId: string;

  /** Namespace key (required, unique within org). */
  readonly key: string;

  /** Namespace label (required). */
  readonly label: string;

  /** Namespace description (optional). */
  readonly description?: string | null;

  /** Whether this is a system namespace (default: false). */
  readonly isSystem?: boolean;
}

/**
 * Input for CreateTerm command.
 */
export interface CreateTermInput {
  /** Namespace ID to create term in. */
  readonly namespaceId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Term code (required, unique within namespace). */
  readonly code: string;

  /** Term label (required). */
  readonly label: string;

  /** Term description (optional). */
  readonly description?: string | null;

  /** Term type (default: 'category'). */
  readonly type?: TermType;

  /** Sort order (optional). */
  readonly sortOrder?: number;

  /** Whether this is a system term (default: false). */
  readonly isSystem?: boolean;
}

/**
 * Input for CreateValue command.
 */
export interface CreateValueInput {
  /** Term ID to add value to. */
  readonly termId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Language tag (required). */
  readonly language: string;

  /** Value label (required). */
  readonly label: string;

  /** Value description (optional). */
  readonly description?: string | null;

  /** Value code (optional). */
  readonly code?: string | null;
}

/**
 * Input for ListNamespaces query.
 */
export interface ListNamespacesInput {
  /** Organization ID. */
  readonly organizationId: string;

  /** Filter by system status (optional). */
  readonly systemOnly?: boolean;

  /** Pagination: page number (default: 1). */
  readonly page?: number;

  /** Pagination: items per page (default: 20, max: 100). */
  readonly limit?: number;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Generic pagination response.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly hasNextPage: boolean;
}

/**
 * Term with its values for a specific language.
 */
export interface TermWithValues {
  /** The term. */
  readonly term: VocabularyTerm;

  /** Values for this term, indexed by language. */
  readonly values: Record<string, ReadonlyArray<VocabValue>>;
}

/**
 * Namespace with terms inside it.
 */
export interface NamespaceWithTerms {
  /** The namespace. */
  readonly namespace: VocabularyNamespace;

  /** Terms within this namespace. */
  readonly terms: ReadonlyArray<VocabularyTerm>;
}

/**
 * Aggregated structure returned by useTerms().
 */
export interface TermsDomainModel {
  /** Terms grouped by namespace. */
  readonly terms: ReadonlyArray<TermWithValues>;

  /** Total count. */
  readonly totalCount: number;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 * Aggregated structure returned by useVocabNamespace().
 */
export interface VocabNamespaceDomainModel {
  /** The namespace with its terms. */
  readonly namespace?: NamespaceWithTerms | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/*  WatermelonDB Attributes                                            */
/* ------------------------------------------------------------------ */

/**
 * Attributes for the VocabularyNamespace WatermelonDB model.
 */
export interface NamespaceAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  key: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Attributes for the VocabularyTerm WatermelonDB model.
 */
export interface TermAttrs {
  id: string;
  _updatedAt: number;
  namespaceId: string;
  code: string;
  label: string;
  description: string | null;
  type: TermType;
  sortOrder: number;
  organizationId: string;
  isSystem: boolean;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Attributes for the VocabValue WatermelonDB model.
 */
export interface ValueAttrs {
  id: string;
  _updatedAt: number;
  termId: string;
  language: string;
  label: string;
  description: string | null;
  code: string | null;
  organizationId: string;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}