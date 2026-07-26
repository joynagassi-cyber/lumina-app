/**
 * TermKey Value Object
 *
 * Immutable key identifying a term within a namespace.
 * Keys are stable forever per BR-VOC-003 — they NEVER change.
 *
 * @traceability DOC-012 Aggregate8 §VO-TermKey
 *   → POSTGRESQL-SCHEMA-PACK-v1 vocab_terms.cle_term
 *   → CONSTRAINTS-INDEX-SPECIFICATION-v1 UNIQUE(cle_term, namespace_id)
 */

export class InvalidTermKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTermKeyError';
  }
}

export class TermKey {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new InvalidTermKeyError('Term key must be a non-empty string.');
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new InvalidTermKeyError(
        'Term key cannot be empty or whitespace-only.',
      );
    }

    if (trimmed.length > 255) {
      throw new InvalidTermKeyError(
        'Term key must not exceed 255 characters.',
      );
    }

    if (!/^[a-z0-9_-]+$/.test(trimmed)) {
      throw new InvalidTermKeyError(
        'Term key must contain only lowercase letters, digits, hyphens, and underscores.',
      );
    }

    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: TermKey): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
