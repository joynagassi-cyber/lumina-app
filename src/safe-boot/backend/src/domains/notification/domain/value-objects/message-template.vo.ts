/**
 * MessageTemplate — bilingual notification message with placeholder support.
 *
 * Immutable VO. Maps to PG-Schema Table 19 columns:
 *   sujet_fr, sujet_en, corps_fr, corps_en
 *
 * @traceability DOC-012 Aggregate7 VO MessageTemplate → PG-Schema-v1 Table 19
 */

export class MessageTemplate {
  readonly subjectFr: string;
  readonly subjectEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;

  /**
   * Supported placeholder keys, e.g. ['name', 'amount', 'date'].
   * These will be replaced via string interpolation at delivery time.
   */
  readonly dataPlaceholders: ReadonlyArray<string>;

  constructor(
    subjectFr: string,
    subjectEn: string,
    bodyFr: string,
    bodyEn: string,
    dataPlaceholders: ReadonlyArray<string> = [],
  ) {
    this.subjectFr = subjectFr.trim();
    this.subjectEn = subjectEn.trim();
    this.bodyFr = bodyFr.trim();
    this.bodyEn = bodyEn.trim();
    this.dataPlaceholders = Object.freeze([...dataPlaceholders]);

    if (this.subjectFr.length === 0) {
      throw new Error('MessageTemplate: subject_fr cannot be empty');
    }
    if (this.subjectEn.length === 0) {
      throw new Error('MessageTemplate: subject_en cannot be empty');
    }
    if (this.bodyFr.length === 0) {
      throw new Error('MessageTemplate: body_fr cannot be empty');
    }
    if (this.bodyEn.length === 0) {
      throw new Error('MessageTemplate: body_en cannot be empty');
    }
    if (subjectFr.length > 255) {
      throw new Error('MessageTemplate: subject_fr exceeds 255 characters');
    }
    if (subjectEn.length > 255) {
      throw new Error('MessageTemplate: subject_en exceeds 255 characters');
    }
    if (bodyFr.length > 4096) {
      throw new Error('MessageTemplate: body_fr exceeds 4096 characters');
    }
    if (bodyEn.length > 4096) {
      throw new Error('MessageTemplate: body_en exceeds 4096 characters');
    }
  }

  /** Resolve the subject for a given language code ('fr' | 'en'). */
  resolveSubject(language: string): string {
    return language === 'en' ? this.subjectEn : this.subjectFr;
  }

  /** Resolve the body for a given language code ('fr' | 'en'). */
  resolveBody(language: string): string {
    return language === 'en' ? this.bodyEn : this.bodyFr;
  }

  /** Replace named placeholders in a template string with values from data. */
  static interpolate(
    template: string,
    data: Record<string, string>,
  ): string {
    return template.replace(
      /\{(\w+)\}/g,
      (_match: string, key: string) => data[key] ?? `{${key}}`,
    );
  }

  /** Create an interpolated copy of this template for a specific language and data. */
  applyForUser(
    language: string,
    data: Record<string, string>,
  ): Pick<this, 'subjectFr' | 'subjectEn' | 'bodyFr' | 'bodyEn'> {
    const base = language === 'en'
      ? { fr: this.subjectFr, en: this.subjectEn, bf: this.bodyFr, be: this.bodyEn }
      : { fr: this.subjectFr, en: this.subjectEn, bf: this.bodyFr, be: this.bodyEn };

    return {
      subjectFr: MessageTemplate.interpolate(base.fr, data),
      subjectEn: MessageTemplate.interpolate(base.en, data),
      bodyFr: MessageTemplate.interpolate(base.bf, data),
      bodyEn: MessageTemplate.interpolate(base.be, data),
    };
  }
}
