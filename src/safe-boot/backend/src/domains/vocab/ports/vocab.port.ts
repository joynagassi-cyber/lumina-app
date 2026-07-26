/**
 * Repository Ports — VocabularyAggregate
 *
 * Defines the contracts for persisting and querying Namespace, Term, and TermValue.
 * Infrastructure adapters implement these interfaces.
 *
 * @traceability DOC-012 Aggregate8 → POSTGRESQL-SCHEMA-PACK-v1 tables: vocab_namespaces, vocab_terms, vocab_values
 *   → BR-VOC-001 (NeverDeletePolicy — no delete operations on this port)
 *   → DOC-023 §8 Multi-tenant isolation (org_id on ALL methods)
 */

import type { Namespace } from '../domain/entities/namespace.entity';
import type { Term } from '../domain/entities/term.entity';
import type { TermValue } from '../domain/entities/term-value.entity';
import type { PaginatedResult } from '../../../../shared/types';

// ---- Namespace Port ----

export interface CreateNamespaceInput {
  orgId: string;
  key: string;
  description?: string | null;
}

export interface INamespaceRepository {
  findById(id: string, requestOrgId: string): Promise<Namespace | null>;
  findByKey(key: string, requestOrgId: string): Promise<Namespace | null>;
  save(entity: Namespace): Promise<void>;
}

// ---- Term Port ----

export interface CreateTermInput {
  namespaceId: string;
  orgId: string;
  key: string;
  labelFr: string;
  labelEn: string;
  description?: string | null;
  createdBy: string;
}

export interface UpdateTermLabelInput {
  labelFr?: string;
  labelEn?: string;
}

export interface ITermRepository {
  findById(id: string, requestOrgId: string): Promise<Term | null>;
  findByKey(namespaceId: string, key: string, requestOrgId: string): Promise<Term | null>;
  findByNamespace(
    namespaceId: string,
    requestOrgId: string,
    includeDeprecated: boolean,
  ): Promise<Term[]>;
  findWithKeyword(orgId: string, query: string, includeDeprecated: boolean): Promise<Term[]>;
  save(entity: Term): Promise<void>;
  updateLabels(id: string, input: UpdateTermLabelInput, expectedVersion?: number): Promise<number>;
  deprecate(id: string, deprecatedAt: Date): Promise<void>;
}

// ---- TermValue Port ----

export interface CreateTermValueInput {
  termId: string;
  orgId: string;
  key: string;
  labelFr: string;
  labelEn: string;
  colorHex?: string | null;
}

export interface UpdateTermValueLabelInput {
  labelFr?: string;
  labelEn?: string;
  colorHex?: string | null;
}

export interface ITermValueRepository {
  findById(id: string, requestOrgId: string): Promise<TermValue | null>;
  findByKey(termId: string, valueKey: string, requestOrgId: string): Promise<TermValue | null>;
  findByTerm(
    termId: string,
    requestOrgId: string,
    includeDeprecated: boolean,
  ): Promise<TermValue[]>;
  save(entity: TermValue): Promise<void>;
  updateLabels(
    id: string,
    input: UpdateTermValueLabelInput,
    expectedVersion?: number,
  ): Promise<number>;
  deprecate(id: string, deprecatedAt: Date): Promise<void>;
}
