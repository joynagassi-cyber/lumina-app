/**
 * ConflictResolutionPolicy — maps resource types to conflict resolution strategies.
 *
 * @traceability DOC-012 Aggregate13 (ConflictStrategy per entity type)
 */

import { ConflictStrategy } from '../value-objects/conflict-strategy.vo';

export interface ConflictResolutionEntry {
  resourceType: string;
  strategy: ConflictStrategy;
}

/**
 * Deterministic matrix mapping each resource type to its conflict resolution strategy.
 * See BR-SYNC-002 through BR-SYNC-005 for justification.
 */
export const CONFLICT_RESOLUTION_MATRIX: Readonly<ConflictResolutionEntry[]> = [
  { resourceType: 'transaction', strategy: ConflictStrategy.IMMUTABLE },
  { resourceType: 'member', strategy: ConflictStrategy.LAST_WRITE_WINS },
  { resourceType: 'event', strategy: ConflictStrategy.LAST_WRITE_WINS },
  { resourceType: 'archive_entry', strategy: ConflictStrategy.SERVER_WINS },
] as const;

export class ConflictResolutionPolicy {
  /**
   * Determine the appropriate conflict strategy for a given resource type.
   * Draft transactions are handled separately with uuid_dedup + side_by_side.
   */
  static getStrategy(
    resourceType: string,
    transactionState?: string,
  ): ConflictStrategy {
    if (
      resourceType === 'transaction' &&
      transactionState === 'draft'
    ) {
      return ConflictStrategy.UUID_DEDUP;
    }

    const entry = CONFLICT_RESOLUTION_MATRIX.find(
      (e) => e.resourceType === resourceType,
    );

    return entry?.strategy ?? ConflictStrategy.SERVER_WINS;
  }

  /**
   * Check if an approved transaction is being mutated (violates immutability).
   * Returns true if this would be an illegal mutation attempt.
   */
  static isImmutableViolation(
    resourceType: string,
    state: string | undefined,
  ): boolean {
    return (
      resourceType === 'transaction' &&
      state !== undefined &&
      state !== 'draft'
    );
  }

  /**
   * Validate that a resource type has a known strategy in the matrix.
   */
  static hasRegisteredStrategy(resourceType: string): boolean {
    return (
      resourceType === 'transaction' ||
      resourceType === 'member' ||
      resourceType === 'event' ||
      resourceType === 'archive_entry'
    );
  }
}
