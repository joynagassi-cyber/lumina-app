/**
 * DeprecatedFlag Value Object
 *
 * Represents the irredeemable deprecation state of a Term or TermValue.
 * Per BR-VOC-001: values are never deleted, only deprecated.
 * Transition: active → deprecated (irreversible).
 *
 * @traceability DOC-012 Aggregate8 §VO-DeprecatedFlag
 *   → POSTGRESQL-SCHEMA-PACK-v1 vocab_terms.est_deprecie / est_deprecie (vocab_values)
 *   → BR-VOC-001 (NeverDeletePolicy)
 */

export class DeprecatedFlag {
  private readonly _value: boolean;
  private readonly _deprecatedAt: Date | null;

  constructor(isDeprecated: boolean, deprecatedAt?: Date | null) {
    this._value = isDeprecated;
    this._deprecatedAt = isDeprecated ? deprecatedAt || new Date() : null;
  }

  get value(): boolean {
    return this._value;
  }

  /** Returns when the entity was deprecated, or null if still active. */
  get deprecatedAt(): Date | null {
    return this._deprecatedAt;
  }

  get isActive(): boolean {
    return !this._value;
  }

  get isDeprecated(): boolean {
    return this._value;
  }

  /**
   * Transition from active to deprecated. This is IRREVERSIBLE per BR-VOC-001.
   * Throws if already deprecated.
   */
  deprecated(deprecatedAt: Date = new Date()): DeprecatedFlag {
    if (this._value) {
      throw new DeprecatedAlreadyError('This entity is already deprecated. Deprecation is irreversible.');
    }
    return new DeprecatedFlag(true, deprecatedAt);
  }

  equals(other: DeprecatedFlag): boolean {
    return this._value === other._value &&
           this._deprecatedAt?.getTime() === other._deprecatedAt?.getTime();
  }
}

export class DeprecatedAlreadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeprecatedAlreadyError';
  }
}
