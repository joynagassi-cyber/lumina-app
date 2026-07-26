/**
 * NamespaceKey Value Object
 *
 * Immutable identifier for a vocabulary namespace (e.g. "finance", "common", "membership").
 * Stable forever per BR-VOC-003.
 *
 * @traceability DOC-012 Aggregate8 §VO-NamespaceKey
 *   → POSTGRESQL-SCHEMA-PACK-v1 vocab_namespaces.cle_namespace
 *   → CONSTRAINTS-INDEX-SPECIFICATION-v1 UNIQUE(cle_namespace, org_id)
 */

export class InvalidNamespaceKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNamespaceKeyError';
  }
}

export class NamespaceKey {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new InvalidNamespaceKeyError(
        'Namespace key must be a non-empty string.',
      );
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new InvalidNamespaceKeyError(
        'Namespace key cannot be empty or whitespace-only.',
      );
    }

    if (trimmed.length > 255) {
      throw new InvalidNamespaceKeyError(
        'Namespace key must not exceed 255 characters.',
      );
    }

    // Keys are stable identifiers — only lowercase letters, digits, hyphens, underscores
    if (!/^[a-z0-9_-]+$/.test(trimmed)) {
      throw new InvalidNamespaceKeyError(
        'Namespace key must contain only lowercase letters, digits, hyphens, and underscores.',
      );
    }

    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: NamespaceKey): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
