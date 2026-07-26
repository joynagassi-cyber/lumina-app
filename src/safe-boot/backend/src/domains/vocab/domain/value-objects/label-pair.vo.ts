/**
 * LabelPair Value Object
 *
 * Enforces minimum translation requirement: every term MUST have both fr and en labels.
 * Per BR-VOC-002 — TranslationMinimumPolicy.
 *
 * @traceability DOC-012 Aggregate8 §VO-LabelPair
 *   → POSTGRESQL-SCHEMA-PACK-v1 vocab_terms.label_fr / label_en
 *                    vocab_values.libelle_fr / libelle_en
 *   → BR-VOC-002 (min FR+EN translations)
 */

export class MissingTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingTranslationError';
  }
}

export class LabelPair {
  private readonly _fr: string;
  private readonly _en: string;

  constructor(frenchLabel: string, englishLabel: string) {
    if (!frenchLabel || typeof frenchLabel !== 'string') {
      throw new MissingTranslationError(
        'French label must be a non-empty string.',
      );
    }
    if (!englishLabel || typeof englishLabel !== 'string') {
      throw new MissingTranslationError(
        'English label must be a non-empty string.',
      );
    }

    const trimmedFr = frenchLabel.trim();
    const trimmedEn = englishLabel.trim();

    if (trimmedFr.length === 0) {
      throw new MissingTranslationError(
        'French label cannot be empty or whitespace-only.',
      );
    }
    if (trimmedEn.length === 0) {
      throw new MissingTranslationError(
        'English label cannot be empty or whitespace-only.',
      );
    }

    if (trimmedFr.length > 255 || trimmedEn.length > 255) {
      throw new MissingTranslationError('Labels must not exceed 255 characters.');
    }

    this._fr = trimmedFr;
    this._en = trimmedEn;
  }

  get fr(): string {
    return this._fr;
  }

  get en(): string {
    return this._en;
  }

  /** Returns the label for the requested locale. Throws if locale is unsupported. */
  forLocale(locale: 'fr' | 'en'): string {
    switch (locale) {
      case 'fr':
        return this._fr;
      case 'en':
        return this._en;
      default: {
        const exhaustive: never = locale;
        throw new MissingTranslationError(`Unsupported locale: ${exhaustive}`);
      }
    }
  }

  equals(other: LabelPair): boolean {
    return this._fr === other._fr && this._en === other._en;
  }
}
