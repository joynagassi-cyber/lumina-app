/**
 * TranslationMinimumPolicy — enforces minimum translation coverage for labels.
 *
 * @traceability DOC-012 Aggregate12 §TranslationMinimumPolicy
 */

export interface TranslationLabel {
  readonly key: string;
  readonly fr?: string | null;
  readonly en?: string | null;
}

/**
 * Policy requiring at least FR and EN translations for any user-facing label.
 */
export class TranslationMinimumPolicy {
  /**
   * Validate that a label has both FR and EN values.
   */
  static validate(label: TranslationLabel): boolean {
    return Boolean(label.fr?.trim().length) && Boolean(label.en?.trim().length);
  }

  /**
   * Check if a label meets the minimum translation requirement.
   * Returns descriptive errors when it does not.
   */
  static validateWithErrors(label: TranslationLabel): string[] {
    const errors: string[] = [];
    if (!label.fr?.trim()) errors.push(`Missing French label for "${label.key}".`);
    if (!label.en?.trim()) errors.push(`Missing English label for "${label.key}".`);
    return errors;
  }
}
