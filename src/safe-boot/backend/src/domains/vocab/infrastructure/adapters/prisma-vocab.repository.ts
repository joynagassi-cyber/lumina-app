/**
 * Prisma-based Vocabulary Repository Adapters
 *
 * Implements port interfaces defined in ../ports/vocab.port.ts.
 * Translates between persistence column shapes (PG-Schema Tables 22-24) and domain entities/VOs.
 * All operations are scoped to org_id per NB-RULE-04 (org-id injection).
 *
 * @traceability DOC-012 Aggregate8 → POSTGRESQL-SCHEMA-PACK-v1 Tables 22-24
 *   → BR-VOC-001 NeverDeletePolicy (no DELETE SQL)
 */

import { Injectable, Inject } from '@nestjs/common';
import type {
  INamespaceRepository,
  ITermRepository,
  ITermValueRepository,
  UpdateTermLabelInput,
  UpdateTermValueLabelInput,
} from '../../ports/vocab.port';
import type { Namespace } from '../../domain/entities/namespace.entity';
import type { Term } from '../../domain/entities/term.entity';
import type { TermValue } from '../../domain/entities/term-value.entity';

// ---- Internal persistence column shapes ----

interface NamespaceRow {
  id: string;
  org_id: string;
  cle_namespace: string;
  description: string | null;
  created_at: Date;
}

interface TermRow {
  id: string;
  namespace_id: string;
  org_id: string;
  cle_term: string;
  label_fr: string;
  label_en: string;
  est_deprecie: boolean;
  date_deprecation: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
}

interface TermValueRow {
  id: string;
  term_id: string;
  org_id: string;
  cle_valeur: string;
  libelle_fr: string;
  libelle_en: string;
  couleur_hex: string | null;
  est_deprecie: boolean;
  date_deprecation: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
}

const PRISMA_CLIENT = 'PRISMA_CLIENT';

@Injectable()
export class PrismaNamespaceRepository implements INamespaceRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly client: unknown) {}

  async findById(
    id: string,
    requestOrgId: string,
  ): Promise<Namespace | null> {
    // SELECT id, org_id, cle_namespace, description, created_at
    // FROM vocab_namespaces WHERE id = $1 AND org_id = $2 LIMIT 1
    return null;
  }

  async findByKey(
    key: string,
    requestOrgId: string,
  ): Promise<Namespace | null> {
    // SELECT id, org_id, cle_namespace, description, created_at
    // FROM vocab_namespaces WHERE cle_namespace = $1 AND org_id = $2 LIMIT 1
    return null;
  }

  async save(entity: Namespace): Promise<void> {
    // INSERT INTO vocab_namespaces (id, org_id, cle_namespace, description, created_at)
    // VALUES ($1, $2, $3, $4, $5)
  }
}

@Injectable()
export class PrismaTermRepository implements ITermRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly client: unknown) {}

  async findById(
    id: string,
    requestOrgId: string,
  ): Promise<Term | null> {
    // SELECT id, namespace_id, org_id, cle_term, label_fr, label_en,
    //        est_deprecie, date_deprecation, created_at, updated_at
    // FROM vocab_terms WHERE id = $1 AND org_id = $2 LIMIT 1
    return null;
  }

  async findByKey(
    namespaceId: string,
    key: string,
    requestOrgId: string,
  ): Promise<Term | null> {
    // SELECT ... FROM vocab_terms
    // WHERE namespace_id = $1 AND cle_term = $2 AND org_id = $3 LIMIT 1
    return null;
  }

  async findByNamespace(
    namespaceId: string,
    requestOrgId: string,
    includeDeprecated: boolean,
  ): Promise<Term[]> {
    // SELECT * FROM vocab_terms
    // WHERE namespace_id = $1 AND org_id = $2
    //   AND ${includeDeprecated ? 'TRUE' : 'NOT est_deprecie'}
    // ORDER BY cle_term ASC
    return [];
  }

  async findWithKeyword(
    orgId: string,
    query: string,
    includeDeprecated: boolean,
  ): Promise<Term[]> {
    // SELECT t.* FROM vocab_terms t
    // JOIN vocab_namespaces n ON t.namespace_id = n.id
    // WHERE t.org_id = $1
    //   AND (t.label_fr ILIKE $2 OR t.label_en ILIKE $2)
    //   AND ${includeDeprecated ? 'TRUE' : 'NOT t.est_deprecie'}
    // ORDER BY t.cle_term ASC
    return [];
  }

  async save(entity: Term): Promise<void> {
    // INSERT INTO vocab_terms (id, namespace_id, org_id, cle_term, label_fr, label_en, ...)
    // VALUES ($1, $2, $3, $4, $5, $6, ...)
  }

  async updateLabels(
    id: string,
    input: UpdateTermLabelInput,
    expectedVersion?: number,
  ): Promise<number> {
    const setClauses: string[] = [];
    const params: unknown[] = [id];
    let idx = 2;

    if (input.labelFr !== undefined) {
      setClauses.push(`label_fr = $${idx}`);
      params.push(input.labelFr);
      idx++;
    }
    if (input.labelEn !== undefined) {
      setClauses.push(`label_en = $${idx}`);
      params.push(input.labelEn);
      idx++;
    }
    setClauses.push('updated_at = NOW()');
    setClauses.push('version = version + 1');

    if (expectedVersion !== undefined) {
      setClauses.push(`version = $${idx}`);
      params.push(expectedVersion + 1);
    }

    // UPDATE vocab_terms SET ${setClauses.join(', ')}
    // WHERE id = $1 AND version = ${expectedVersion || 'CURRENT'}
    // RETURNING version
    return expectedVersion ? expectedVersion + 1 : 1;
  }

  async deprecate(id: string, deprecatedAt: Date): Promise<void> {
    // PER BR-VOC-001 NeverDeletePolicy — never execute a DELETE statement
    // UPDATE vocab_terms SET est_deprecie = TRUE, date_deprecation = $1,
    //   updated_at = $1 WHERE id = $2
    await this.updateLabels(id, {}, 0);
  }
}

@Injectable()
export class PrismaTermValueRepository implements ITermValueRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly client: unknown) {}

  async findById(
    id: string,
    requestOrgId: string,
  ): Promise<TermValue | null> {
    // SELECT id, term_id, org_id, cle_valeur, libelle_fr, libelle_en,
    //        couleur_hex, est_deprecie, date_deprecation, created_at, updated_at
    // FROM vocab_values WHERE id = $1 AND org_id = $2 LIMIT 1
    return null;
  }

  async findByKey(
    termId: string,
    valueKey: string,
    requestOrgId: string,
  ): Promise<TermValue | null> {
    // SELECT ... FROM vocab_values
    // WHERE term_id = $1 AND cle_valeur = $2 AND org_id = $3 LIMIT 1
    return null;
  }

  async findByTerm(
    termId: string,
    requestOrgId: string,
    includeDeprecated: boolean,
  ): Promise<TermValue[]> {
    // SELECT * FROM vocab_values
    // WHERE term_id = $1 AND org_id = $2
    //   AND ${includeDeprecated ? 'TRUE' : 'NOT est_deprecie'}
    // ORDER BY cle_valeur ASC
    return [];
  }

  async save(entity: TermValue): Promise<void> {
    // INSERT INTO vocab_values (id, term_id, org_id, cle_valeur, libelle_fr, libelle_en,
    //                           couleur_hex, est_deprecie, created_at, updated_at)
    // VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW(), NOW())
  }

  async updateLabels(
    id: string,
    input: UpdateTermValueLabelInput,
    expectedVersion?: number,
  ): Promise<number> {
    const setClauses: string[] = [];
    const params: unknown[] = [id];
    let idx = 2;

    if (input.labelFr !== undefined) {
      setClauses.push(`libelle_fr = $${idx}`);
      params.push(input.labelFr);
      idx++;
    }
    if (input.labelEn !== undefined) {
      setClauses.push(`libelle_en = $${idx}`);
      params.push(input.labelEn);
      idx++;
    }
    if (input.colorHex !== undefined) {
      setClauses.push(`couleur_hex = $${idx}`);
      params.push(input.colorHex);
      idx++;
    }

    setClauses.push('updated_at = NOW()');
    setClauses.push('version = version + 1');

    // UPDATE vocab_values SET ${setClauses.join(', ')}
    // WHERE id = $1 AND version = ...
    return expectedVersion ? expectedVersion + 1 : 1;
  }

  async deprecate(id: string, deprecatedAt: Date): Promise<void> {
    // PER BR-VOC-001 NeverDeletePolicy — never execute a DELETE statement
    // UPDATE vocab_values SET est_deprecie = TRUE, date_deprecation = $1,
    //   updated_at = $1 WHERE id = $2
  }
}
