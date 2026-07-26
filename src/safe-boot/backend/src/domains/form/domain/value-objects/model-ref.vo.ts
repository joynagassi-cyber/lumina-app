/**
 * ModelRef Value Object
 *
 * Represents the domain entity type that a form definition maps to.
 * E.g., "finance_transaction", "member_application", "event_registration".
 *
 * @traceability DOC-012 Aggregate6 §VO-ModelRef
 *   → POSTGRESQL-SCHEMA-PACK-v1 forms.reference_modele
 */

export class InvalidModelRefError extends Error {
  constructor(value: string) {
    super(`Invalid ModelRef: "${value}". Must be a non-empty lowercase identifier.`);
    this.name = 'InvalidModelRefError';
  }
}

export class ModelRef {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new InvalidModelRefError('null');
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new InvalidModelRefError('empty string');
    }

    if (trimmed.length > 255) {
      throw new InvalidModelRefError(trimmed);
    }

    // Allow camelCase, snake_case, dots for namespacing
    if (!/^[a-zA-Z][a-zA-Z0-9_.]{0,254}$/.test(trimmed)) {
      throw new InvalidModelRefError(trimmed);
    }

    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: ModelRef): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
