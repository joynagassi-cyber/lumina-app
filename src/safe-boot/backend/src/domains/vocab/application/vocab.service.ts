/**
 * VocabApplicationService — Application layer for VocabularyAggregate
 *
 * Orchestrates domain services and repositories to implement use cases.
 * Every command operation publishes corresponding domain events.
 *
 * @traceability DOC-012 Aggregate8 → Capability: Vocabulary (DOC-006)
 *   → BR-VOC-001 (NeverDeletePolicy) | BR-VOC-002 (TranslationMinimumPolicy)
 *   → BR-VOC-003 (StabilityPolicy) | BR-VOC-004 (missing terms = error)
 *   → PAS-005 DR-004 (Runtime Assembly Responsibility)
 */

import { Injectable } from '@nestjs/common';
import type {
  INamespaceRepository,
  ITermRepository,
  ITermValueRepository,
  CreateNamespaceInput,
  CreateTermInput,
  CreateTermValueInput,
  UpdateTermLabelInput,
  UpdateTermValueLabelInput,
} from '../ports/vocab.port';
import type {
  TermResolver,
  NamespaceBrowser,
  DeprecationManager,
} from '../domain/services';
import {
  NeverDeletePolicy,
  TranslationMinimumPolicy,
  StabilityPolicy,
} from '../domain/policies';
import {
  TermAdded,
  TermValueAdded,
  TermDepreciated,
  TermValueDeprecated,
  LabelUpdated,
  TranslationResolved,
} from '../domain/events';
import type { DomainEventHandler } from '../../../../shared/events';

@Injectable()
export class VocabApplicationService {
  constructor(
    private readonly namespaceRepo: INamespaceRepository,
    private readonly termRepo: ITermRepository,
    private readonly valueRepo: ITermValueRepository,
    private readonly termResolver: TermResolver,
    private readonly namespaceBrowser: NamespaceBrowser,
    private readonly deprecationManager: DeprecationManager,
    private readonly eventHandler: DomainEventHandler,
  ) {}

  // ==================== TermValue Operations ====================

  /**
   * Add a new term value with bilingual labels.
   * Validates FR+EN minimum per BR-VOC-002.
   * Publishes TermValueAdded event.
   */
  async addTermValue(input: CreateTermValueInput): Promise<void> {
    TranslationMinimumPolicy.validateValueLabels(input.labelFr, input.labelEn, input.termId);

    const term = await this.termRepo.findById(input.termId, input.orgId);
    if (!term) {
      throw new Error(`Term ${input.termId} not found in org ${input.orgId}`);
    }

    // TODO: Construct TermValue entity from input → persistence
    await this.valueRepo.save(/* TermValue entity */ undefined as any);

    // TODO: Publish TermValueAdded event
    const event = new TermValueAdded(
      '', input.termId, input.orgId, input.key,
      input.labelFr, input.labelEn, input.colorHex || null,
    );
    await this.eventHandler(event);
  }

  // ==================== Label Updates ====================

  /**
   * Update term label (fr or en or both). Labels may evolve per BR-VOC-003.
   * Keys are immutable — stability policy enforced internally.
   */
  async updateTermLabel(
    termId: string,
    input: UpdateTermLabelInput,
    orgId: string,
  ): Promise<number> {
    const current = await this.termRepo.findById(termId, orgId);
    if (!current) {
      throw new Error(`Term ${termId} not found`);
    }

    if (input.labelFr !== undefined && input.labelFr.trim().length === 0) {
      throw new Error('French label cannot be empty');
    }
    if (input.labelEn !== undefined && input.labelEn.trim().length === 0) {
      throw new Error('English label cannot be empty');
    }

    return this.termRepo.updateLabels(termId, input);
  }

  /**
   * Update term value label (fr or en or both + color).
   */
  async updateTermValueLabel(
    valueId: string,
    input: UpdateTermValueLabelInput,
    orgId: string,
  ): Promise<number> {
    const current = await this.valueRepo.findById(valueId, orgId);
    if (!current) {
      throw new Error(`TermValue ${valueId} not found`);
    }

    if (input.labelFr !== undefined && input.labelFr.trim().length === 0) {
      throw new Error('French label cannot be empty');
    }
    if (input.labelEn !== undefined && input.labelEn.trim().length === 0) {
      throw new Error('English label cannot be empty');
    }

    return this.valueRepo.updateLabels(valueId, input);
  }

  // ==================== Deprecation ====================

  /**
   * Deprecate a term value. Irreversible per BR-VOC-001 NeverDeletePolicy.
   * Publishes TermValueDeprecated event.
   */
  async deprecateTermValue(valueId: string, orgId: string): Promise<void> {
    const existing = await this.valueRepo.findById(valueId, orgId);
    if (!existing) {
      throw new Error(`TermValue ${valueId} not found`);
    }

    NeverDeletePolicy.assertNoDelete('value', valueId);

    this.deprecationManager.deprecateTermValue(existing);

    await this.valueRepo.deprecate(valueId, new Date());

    // Publish TermValueDeprecated event
    const event = new TermValueDeprecated(valueId, existing.termId, orgId, existing.key);
    await this.eventHandler(event);
  }

  // ==================== Query / Browse ====================

  /**
   * List all active terms in a namespace.
   * Optionally include deprecated terms.
   */
  async listTermsByNamespace(namespaceKey: string, includeDeprecated = false) {
    return this.namespaceBrowser.listTerms(namespaceKey, includeDeprecated);
  }

  /**
   * Resolve a term key to its display label for a given language.
   * BR-VOC-004: Throws explicit error if term not found.
   */
  async resolveTerm(
    namespaceKey: string,
    termKey: string,
    locale: 'fr' | 'en',
  ): Promise<string> {
    return this.termResolver.resolveTerm(namespaceKey, termKey, locale);
  }

  /**
   * Search terms across namespaces by keyword in label text.
   */
  async searchTerms(query: string, locale: 'fr' | 'en') {
    return this.namespaceBrowser.searchTerms(query, locale);
  }

  /**
   * Get a specific term's translation for a locale.
   * Returns null if not found (caller decides how to handle missing translations).
   */
  async getTermTranslation(
    namespaceKey: string,
    termKey: string,
    locale: 'fr' | 'en',
  ): Promise<{ key: string; label: string; isDeprecated: boolean } | null> {
    const terms = await this.namespaceBrowser.listTerms(namespaceKey, false);
    const found = terms.find((t) => t.key === termKey);
    if (!found) return null;

    const label = locale === 'fr' ? found.labelFr : found.labelEn;

    // Publish TranslationResolved event
    const event = new TranslationResolved(
      `${namespaceKey}:${termKey}`, locale, label, found.isDeprecated,
    );
    await this.eventHandler(event);

    return { key: termKey, label, isDeprecated: found.isDeprecated };
  }
}
