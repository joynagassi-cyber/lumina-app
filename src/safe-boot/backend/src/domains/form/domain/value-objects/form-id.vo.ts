/**
 * FormId Value Object
 *
 * Represents a globally unique identifier for a form definition.
 * Format: UUID v7 string (same as all other IDs in Lumina).
 *
 * @traceability DOC-012 Aggregate6 §VO-FormId → POSTGRESQL-SCHEMA-PACK-v1 forms.id
 */

export class InvalidFormIdError extends Error {
  constructor(value: string) {
    super(`Invalid FormId: "${value}". Must be a non-empty string matching UUID format.`);
    this.name = 'InvalidFormIdError';
  }
}

export class FormId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new InvalidFormIdError('null');
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new InvalidFormIdError('empty string');
    }

    // Accept UUID v4 / v7 format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      throw new InvalidFormIdError(trimmed);
    }

    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: FormId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /** Check if this FormId is empty (never used in production, only in tests). */
  isEmpty(): boolean {
    return this._value.length === 0;
  }
}
