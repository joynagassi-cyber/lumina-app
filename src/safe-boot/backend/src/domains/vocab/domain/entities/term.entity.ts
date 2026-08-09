/**
 * Term Entity
 *
 * A vocabulary term within a namespace, identified by a stable key.
 * Contains bilingual labels (fr + en) and an optional description.
 * Keys NEVER change per BR-VOC-003 (StabilityPolicy).
 *
 * @traceability DOC-012 Aggregate8 §Entity-Term
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 23: vocab_terms
 *   → BR-VOC-003 (keys stable forever)
 */

import { LabelPair, MissingTranslationError } from '../value-objects/label-pair.vo';
import { DeprecatedFlag } from '../value-objects/deprecated-flag.vo';

export interface TermProps {
  readonly id: string;                // uuid PK
  readonly namespaceId: string;        // FK vocab_namespaces
  readonly orgId: string;             // organizations
  readonly key: string;               // cle_term — stable forever
  labelFr: string;                    // mutable
  labelEn: string;                    // mutable
  description?: string | null;
  isDeprecated: boolean;
  deprecatedAt: Date | null;
  readonly createdAt: Date;
  updatedAt: Date;
}

export class InvalidTermLabelUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTermLabelUpdateError';
  }
}

export class Term {
  private _props: TermProps;

  constructor(props: TermProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get namespaceId(): string { return this._props.namespaceId; }
  get orgId(): string { return this._props.orgId; }
  get key(): string { return this._props.key; }
  get labelFr(): string { return this._props.labelFr; }
  get labelEn(): string { return this._props.labelEn; }
  get description(): string | null { return this._props.description || null; }
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

  /**
   * Update the French label. Per BR-VOC-003, keys never change but labels may evolve.
   * Per BR-VOC-002, labels must always be non-empty.
   */
  updateLabelFr(newLabel: string): void {
    if (!newLabel || !newLabel.trim()) {
      throw new InvalidTermLabelUpdateError(
        'French label cannot be empty.',
      );
    }
    if (newLabel.trim().length > 255) {
      throw new InvalidTermLabelUpdateError(
        'French label must not exceed 255 characters.',
      );
    }
    this._props.labelFr = newLabel.trim();
    this._props.updatedAt = new Date();
  }

  /**
   * Update the English label. Per BR-VOC-003, keys never change but labels may evolve.
   * Per BR-VOC-002, labels must always be non-empty.
   */
  updateLabelEn(newLabel: string): void {
    if (!newLabel || !newLabel.trim()) {
      throw new InvalidTermLabelUpdateError(
        'English label cannot be empty.',
      );
    }
    if (newLabel.trim().length > 255) {
      throw new InvalidTermLabelUpdateError(
        'English label must not exceed 255 characters.',
      );
    }
    this._props.labelEn = newLabel.trim();
    this._props.updatedAt = new Date();
  }

  /**
   * Mark this term as deprecated. Irreversible per NeverDeletePolicy.
   * Does NOT delete — the record remains for referential integrity.
   */
  deprecate(deprecatedAt: Date = new Date()): void {
    if (this._props.isDeprecated) {
      throw new AlreadyDeprecatedError('This term is already deprecated.');
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

  /**
   * Update description. Must remain non-empty if fr+en labels are present.
   */
  updateDescription(newDesc: string | null): void {
    this._props.description = newDesc;
    this._props.updatedAt = new Date();
  }
}

export class AlreadyDeprecatedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlreadyDeprecatedError';
  }
}
