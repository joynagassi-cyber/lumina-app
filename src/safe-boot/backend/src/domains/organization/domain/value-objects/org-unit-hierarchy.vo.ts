/**
 * OrgUnitHierarchy Value Object
 *
 * Represents the hierarchical path string for an OrgUnit.
 * Format: "orgUuid/unit1Uuid/unit2Uuid" (slash-delimited UUID path).
 * Used to reconstruct ancestor chain without recursive queries.
 *
 * @traceability DOC-012 Aggregate1 §VO-OrgUnitHierarchy
 *   → POSTGRESQL-SCHEMA-PACK-v1 org_units.chemin_hierarchique varchar(1024)
 */

const MAX_DEPTH = 5;

export class InvalidOrgUnitHierarchyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrgUnitHierarchyError';
  }
}

export class OrgUnitHierarchy {
  private readonly _path: string;

  constructor(path: string) {
    if (!path || typeof path !== 'string') {
      throw new InvalidOrgUnitHierarchyError('Hierarchy path must be a non-empty string.');
    }

    const trimmed = path.trim();
    if (trimmed.length === 0) {
      throw new InvalidOrgUnitHierarchyError('Hierarchy path cannot be empty.');
    }

    if (trimmed.length > 1024) {
      throw new InvalidOrgUnitHierarchyError(
        'Hierarchy path must not exceed 1024 characters.',
      );
    }

    // Validate all segments are valid UUIDs or the root org identifier
    const segments = trimmed.split('/');
    if (segments.length > MAX_DEPTH) {
      throw new InvalidOrgUnitHierarchyError(
        `Organization unit hierarchy exceeds maximum depth of ${MAX_DEPTH}.`,
      );
    }

    this._path = trimmed;
  }

  get path(): string {
    return this._path;
  }

  /** Returns the number of levels in this hierarchy path. */
  get depth(): number {
    if (!this._path) return 0;
    return this._path.split('/').length;
  }

  /** Returns individual segment UUIDs. */
  get segments(): string[] {
    if (!this._path) return [];
    return this._path.split('/').filter(Boolean);
  }

  equals(other: OrgUnitHierarchy): boolean {
    return this._path === other._path;
  }

  toString(): string {
    return this._path;
  }
}
