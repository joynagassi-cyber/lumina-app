/**
 * NamespaceBrowser Domain Service
 *
 * Lists all terms within a namespace, optionally filtering by deprecation status.
 * Also supports listing values within a specific term.
 *
 * @traceability DOC-012 Aggregate8 §DomainServices-NamespaceBrowser
 */

import type { Term } from '../entities/term.entity';
import type { TermValue } from '../entities/term-value.entity';

export interface BrowserTermDto {
  id: string;
  key: string;
  labelFr: string;
  labelEn: string;
  description: string | null;
  isDeprecated: boolean;
  createdAt: Date;
}

export interface BrowserValueDto {
  id: string;
  termId: string;
  key: string;
  labelFr: string;
  labelEn: string;
  colorHex: string | null;
  isDeprecated: boolean;
  createdAt: Date;
}

export interface NamespaceSummary {
  namespaceKey: string;
  description: string | null;
  orgId: string;
  totalTerms: number;
  deprecatedTerms: number;
}

export class NamespaceBrowser {
  /**
   * List all terms in a namespace, keyed by namespace string.
   * includeDeprecated: when false (default), only active terms are returned.
   */
  async listTerms(
    _namespaceKey: string,
    includeDeprecated = false,
  ): Promise<BrowserTermDto[]> {
    // Infrastructure adapter implements the actual query
    // SELECT id, cle_term, label_fr, label_en, description, est_deprecie, created_at
    // FROM vocab_terms WHERE namespace_id = $1 AND est_deprecie = $2 ORDER BY cle_term
    return [];
  }

  /**
   * List all values within a specific term.
   */
  async listValues(
    _namespaceKey: string,
    _termKey: string,
    includeDeprecated = false,
  ): Promise<BrowserValueDto[]> {
    // Infrastructure adapter implements the actual query
    // SELECT id, term_id, cle_valeur, libelle_fr, libelle_en, couleur_hex,
    //        est_deprecie, created_at
    // FROM vocab_values WHERE term_id = $1 AND est_deprecie = $2
    return [];
  }

  /**
   * Get a summary of a namespace including term counts.
   */
  async getNamespaceSummary(
    _namespaceKey: string,
  ): Promise<NamespaceSummary> {
    return {
      namespaceKey: _namespaceKey,
      description: null,
      orgId: '',
      totalTerms: 0,
      deprecatedTerms: 0,
    };
  }

  /**
   * Search terms across namespaces using a keyword (partial match on labels).
   */
  async searchTerms(
    _query: string,
    _locale: 'fr' | 'en',
    _includeDeprecated = false,
  ): Promise<BrowserTermDto[]> {
    // Infrastructure: SELECT ... FROM vocab_terms WHERE (label_fr ILIKE $1 OR label_en ILIKE $1)
    return [];
  }
}
