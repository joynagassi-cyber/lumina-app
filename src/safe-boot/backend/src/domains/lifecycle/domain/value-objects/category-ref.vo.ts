/**
 * CategoryRef — configurable category reference for archive entries.
 *
 * @traceability DOC-012 Aggregate11 §VO-CategoryRef
 *   → POSTGRESQL-SCHEMA-PACK-v1 archives.categorie varchar(255)
 *   → BR-LIF-004: Tags + categories for flexible organization
 */

export interface CategoryRefProps {
  readonly value: string;
}

/**
 * Immutable value object for a single archive category reference.
 */
export class CategoryRef {
  private constructor(public readonly value: string) {}

  static create(value: string): CategoryRef {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return new CategoryRef('');
    }
    if (trimmed.length > 255) {
      throw new InvalidCategoryRefError('Category ref must be at most 255 characters.');
    }
    return new CategoryRef(trimmed);
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  equals(other: CategoryRef): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value || '(unnamed)';
  }
}

/**
 * Error thrown when a category ref exceeds allowed length or is malformed.
 */
export class InvalidCategoryRefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCategoryRefError';
  }
}
