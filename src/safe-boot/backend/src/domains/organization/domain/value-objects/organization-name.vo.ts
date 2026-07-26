/**
 * OrganizationName Value Object
 *
 * Represents the immutable name of an organization.
 * Non-empty string with global uniqueness enforced at the persistence layer.
 *
 * @traceability DOC-012 Aggregate1 §VO-OrganizationName → CANONICAL-DOMAIN-MODEL.md
 *   → API-CONTRACT-001 CreateOrganization → POSTGRESQL-SCHEMA-PACK-v1 organizations.nom
 *   → CONSTRAINTS-INDEX-SPECIFICATION-v1 CC-ORG-001 (UNIQUE(nom))
 */

export class OrganizationName {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new InvalidOrganizationNameError(
        'Organization name must be a non-empty string.',
      );
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new InvalidOrganizationNameError(
        'Organization name cannot be empty or whitespace-only.',
      );
    }

    if (trimmed.length > 255) {
      throw new InvalidOrganizationNameError(
        'Organization name must not exceed 255 characters.',
      );
    }

    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: OrganizationName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

export class InvalidOrganizationNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrganizationNameError';
  }
}
