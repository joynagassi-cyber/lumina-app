/**
 * TermValue Entity
 *
 * A specific value within a vocabulary term. Each term can have multiple values
 * (e.g., a "transaction_type" term may have values: "income", "expense", "transfer").
 * Values are NEVER deleted — only deprecated per BR-VOC-001.
 *
 * @traceability DOC-012 Aggregate8 §Entity-TermValue
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 24: vocab_values
 *   → BR-VOC-001 (NeverDeletePolicy)
 *   → BR-VOC-002 (TranslationMinimumPolicy)
 */

import { DeprecatedFlag } from '../value-objects/deprecated-flag.vo';
import { ColorHex, InvalidColorHexError } from '../value-objects/color-hex.vo';
import { LabelPair, MissingTranslationError } from '../value-objects/label-pair.vo';

export interface TermValueProps {
  readonly id: string;                // uuid PK
  readonly termId: string;            // FK vocab_terms
  readonly orgId: string;             // organizations
  readonly key: string;               // cle_valeur — stable forever
  labelFr: string;                    // mutable
  labelEn: string;                    // mutable
  colorHex: string | null;           // nullable hex color
  isDeprecated: boolean;
  deprecatedAt: Date | null;
  readonly createdAt: Date;
  updatedAt: Date;
}

export class TermValue {
  private _props: TermValueProps;

  constructor(props: TermValueProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get termId(): string { return this._props.termId; }
  get orgId(): string { return this._props.orgId; }
  get key(): string { return this._props.key; }
  get labelFr(): string { return this._props.labelFr; }
  get labelEn(): string { return this._props.labelEn; }
  get colorHex(): string | null { return this._props.colorHex; }
  get isDeprecated(): boolean { return this._props.isDeprecated; }
  get deprecatedAt(): Date | null { return this._props.deprecatedAt; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._props.updatedAt; }

  /** Returns a LabelPair for bilingual access. Validates both languages exist. */
  get labels(): LabelPair {
    return new LabelPair(this._props.labelFr, this._props.labelEn);
  }

  /** Returns the label for the requested locale. */
  labelFor(locale: 'fr' | 'en'): string {
    const pair = this.labels;
    return pair.forLocale(locale);
  }

  /** Returns the validated ColorHex VO. */
  get color(): ColorHex {
    return new ColorHex(this._props.colorHex);
  }

  /**
   * Update the French label for this value. Per BR-VOC-002, both fr+en required.
   */
  updateLabelFr(newLabel: string): void {
    if (!newLabel || !newLabel.trim()) {
      throw new InvalidTermValueLabelError('French label cannot be empty.');
    }
    if (newLabel.trim().length > 255) {
      throw new InvalidTermValueLabelError(
        'French label must not exceed 255 characters.',
      );
    }
    this._props.labelFr = newLabel.trim();
    this._props.updatedAt = new Date();
  }

  /**
   * Update the English label for this value. Per BR-VOC-002, both fr+en required.
   */
  updateLabelEn(newLabel: string): void {
    if (!newLabel || !newLabel.trim()) {
      throw new InvalidTermValueLabelError('English label cannot be empty.');
    }
    if (newLabel.trim().length > 255) {
      throw new InvalidTermValueLabelError(
        'English label must not exceed 255 characters.',
      );
    }
    this._props.labelEn = newLabel.trim();
    this._props.updatedAt = new Date();
  }

  /**
   * Update the color hex for this value. Null clears the color.
   */
  updateColor(hex: string | null): void {
    // Validation via ColorHex constructor (will throw on invalid)
    new ColorHex(hex);
    this._props.colorHex = hex;
    this._props.updatedAt = new Date();
  }

  /**
   * Mark this term value as deprecated. Irreversible per NeverDeletePolicy (BR-VOC-001).
   */
  deprecate(deprecatedAt: Date = new Date()): void {
    if (this._props.isDeprecated) {
      throw new AlreadyDeprecatedError('This term value is already deprecated.');
    }
    this._props.isDeprecated = true;
    this._props.deprecatedAt = deprecatedAt;
    this._props.updatedAt = deprecatedAt;
  }

  /** Returns a DeprecatedFlag snapshot for persistence. */
  toDeprecatedFlag(): DeprecatedFlag {
    return new DeprecatedFlag(
      this._props.isDeprecated,
      this._props.deprecatedAt,
    );
  }

  equals(other: TermValue): boolean {
    return this._props.id === other._props.id &&
           this._props.termId === other._props.termId;
  }
}

export class InvalidTermValueLabelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTermValueLabelError';
  }
}

export class AlreadyDeprecatedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlreadyDeprecatedError';
  }
}
