/**
 * VersioningPolicy — enforces INV-010: every resource change increments version.
 * Optimistic locking at the domain level before reaching persistence.
 *
 * @traceability DOC-012 Aggregate3 (VersioningPolicy), INV-010, BR-RES-003, DOC-023 §5
 */

export class VersionConflictError extends Error {
  constructor(expectedVersion: number, actualVersion: number) {
    super(`VersioningPolicy: optimistic lock conflict — expected v${expectedVersion}, got v${actualVersion}`);
    this.name = 'VersionConflictError';
  }
}

export class VersioningPolicy {
  /** Validate that the provided version matches the current persisted version. */
  static validate(expectedVersion: number, actualVersion: number): void {
    if (expectedVersion !== actualVersion) {
      throw new VersionConflictError(expectedVersion, actualVersion);
    }
  }

  /** Compute the next version number. */
  static nextVersion(currentVersion: number): number {
    return currentVersion + 1;
  }
}
