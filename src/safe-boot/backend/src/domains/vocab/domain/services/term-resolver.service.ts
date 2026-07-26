/**
 * TermResolver Domain Service
 *
 * Resolves a term_key (or value_key) to its display_label for a given language.
 * Returns null for deprecated items unless forceDeprecated is true.
 * Throws explicit error if the term does not exist (BR-VOC-004).
 *
 * @traceability DOC-012 Aggregate8 §DomainServices-TermResolver
 *   → BR-VOC-004 (missing terms = explicit error)
 *   → BR-VOC-002 (TranslationMinimumPolicy — fr+en always available)
 */

import { NotFoundError } from '../../../../shared/errors';
import type { NamespaceBrowser } from './namespace-browser.service';

export interface TermLookupResult {
  id: string;
  namespaceId: string;
  key: string;
  labelFr: string;
  labelEn: string;
  isDeprecated: boolean;
}

export interface ValueLookupResult {
  id: string;
  termId: string;
  key: string;
  labelFr: string;
  labelEn: string;
  colorHex: string | null;
  isDeprecated: boolean;
}

export class TermNotFoundError extends NotFoundError {
  constructor(entityType: 'term' | 'value', key: string, namespaceKey: string) {
    super(
      entityType,
      `${namespaceKey}:${key}`,
    );
    this.name = 'TermNotFoundError';
  }
}

export class TermResolver {
  constructor(private readonly browser: NamespaceBrowser) {}

  /**
   * Resolve a term to its display label for the requested locale.
   * BR-VOC-004: Throws TermNotFoundError if the term does not exist.
   * Skips deprecated terms by default.
   */
  async resolveTerm(
    namespaceKey: string,
    termKey: string,
    locale: 'fr' | 'en',
    includeDeprecated = false,
  ): Promise<string> {
    const result = await this.lookupTerm(namespaceKey, termKey, includeDeprecated);
    if (!result) {
      throw new TermNotFoundError('term', termKey, namespaceKey);
    }
    return locale === 'fr' ? result.labelFr : result.labelEn;
  }

  /**
   * Resolve a term value to its display label for the requested locale.
   * BR-VOC-004: Throws TermNotFoundError if the value does not exist.
   * Skips deprecated values by default.
   */
  async resolveValue(
    namespaceKey: string,
    termKey: string,
    valueKey: string,
    locale: 'fr' | 'en',
    includeDeprecated = false,
  ): Promise<string> {
    const result = await this.lookupValue(
      namespaceKey,
      termKey,
      valueKey,
      includeDeprecated,
    );
    if (!result) {
      throw new TermNotFoundError('value', `${termKey}:${valueKey}`, namespaceKey);
    }
    return locale === 'fr' ? result.labelFr : result.labelEn;
  }

  /** Lookup a term by namespace + key, returning full data. */
  private async lookupTerm(
    namespaceKey: string,
    termKey: string,
    includeDeprecated: boolean,
  ): Promise<TermLookupResult | null> {
    // Implementation delegated through browser
    const terms = await this.browser.listTerms(namespaceKey, includeDeprecated);
    return terms.find((t) => t.key === termKey) || null;
  }

  /** Lookup a value by namespace + term + value key, returning full data. */
  private async lookupValue(
    namespaceKey: string,
    termKey: string,
    valueKey: string,
    includeDeprecated: boolean,
  ): Promise<ValueLookupResult | null> {
    const terms = await this.browser.listValues(namespaceKey, termKey, includeDeprecated);
    return terms.find((v) => v.key === valueKey) || null;
  }
}
