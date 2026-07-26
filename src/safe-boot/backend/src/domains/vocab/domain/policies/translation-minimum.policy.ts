/**
 * TranslationMinimumPolicy — Vocabulary Aggregate
 *
 * Every Term and TermValue MUST have both French (fr) and English (en) labels.
 * No entity can exist with only one language translation.
 *
 * BR-VOC-002: Minimum FR+EN translations.
 *
 * @traceability DOC-012 Aggregate8 §Policies-TranslationMinimum
 *   → POSTGRESQL-SCHEMA-PACK-v1 vocab_terms.label_fr AND label_en NOT NULL
 */

export class MissingRequiredTranslationError extends Error {
  constructor(
    entityType: string,
    missingLocale: string,
    entityId?: string,
  ) {
    const idPart = entityId ? ` (id: ${entityId})` : '';
    super(
      `${entityType}${idPart} is missing required translation for locale "${missingLocale}". ` +
      'Every term/value must have both fr and en per BR-VOC-002.',
    );
    this.name = 'MissingRequiredTranslationError';
  }
}

export class TranslationMinimumPolicy {
  /**
   * Validates that both fr and en labels are non-empty strings.
   * Throws MissingRequiredTranslationError if either is missing.
   */
  static validateTermLabels(
    labelFr: string | null | undefined,
    labelEn: string | null | undefined,
    entityId?: string,
  ): void {
    if (!labelFr || !labelFr.trim()) {
      throw new MissingRequiredTranslationError('Term', 'fr', entityId);
    }
    if (!labelEn || !labelEn.trim()) {
      throw new MissingRequiredTranslationError('Term', 'en', entityId);
    }
  }

  /**
   * Validates that both fr and en labels are non-empty strings for a TermValue.
   * Throws MissingRequiredTranslationError if either is missing.
   */
  static validateValueLabels(
    labelFr: string | null | undefined,
    labelEn: string | null | undefined,
    entityId?: string,
  ): void {
    if (!labelFr || !labelFr.trim()) {
      throw new MissingRequiredTranslationError('TermValue', 'fr', entityId);
    }
    if (!labelEn || !labelEn.trim()) {
      throw new MissingRequiredTranslationError('TermValue', 'en', entityId);
    }
  }

  /**
   * Extracts the minimum required fields after validation. Returns trimmed strings.
   */
  static extractTranslations(
    fr: string,
    en: string,
  ): { labelFr: string; labelEn: string } {
    return {
      labelFr: fr.trim(),
      labelEn: en.trim(),
    };
  }
}
