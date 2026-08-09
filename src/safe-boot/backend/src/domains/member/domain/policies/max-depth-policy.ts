/**
 * MaxDepthPolicy — Enforces the maximum hierarchy depth of 5 levels.
 * Domain layer validation occurs BEFORE reaching the database (BR-REL-002).
 * The database also has a CHECK constraint for defense-in-depth.
 * @traceability DOC-012 §Aggregate 4, BR-REL-002, DOC-023 §3.4
 */

export class MaxDepthExceededError extends Error {
  constructor(
    public readonly attemptedDepth: number,
    public readonly maxDepth: number,
    public readonly orgUnitUuid: string,
  ) {
    super(
      `Org unit ${orgUnitUuid} would be at depth ${attemptedDepth}, ` +
      `which exceeds the maximum allowed depth of ${maxDepth}. ` +
      'The domain layer must validate depth before persisting.',
    );
    this.name = 'MaxDepthExceededError';
  }
}

export class MaxDepthPolicy {
  static readonly MAX_DEPTH = 5;

  /**
   * Validates that an org unit can exist at the specified depth.
   * @throws MaxDepthExceededError if depth exceeds the limit.
   */
  static assertValidDepth(depth: number, orgUnitUuid: string): void {
    if (depth < 1 || depth > this.MAX_DEPTH) {
      throw new MaxDepthExceededError(depth, this.MAX_DEPTH, orgUnitUuid);
    }
  }

  /**
   * Calculates the safe depth for a child given its parent's depth.
   * Returns the computed depth or throws if it exceeds the limit.
   */
  static computeChildDepth(parentDepth: number, orgUnitUuid: string): number {
    const childDepth = parentDepth + 1;
    this.assertValidDepth(childDepth, orgUnitUuid);
    return childDepth;
  }

  /**
   * Checks if a parent at the given depth could have a valid child.
   */
  static canHaveChildren(parentDepth: number): boolean {
    return parentDepth < this.MAX_DEPTH;
  }

  /**
   * Returns the remaining depth budget from a given level, clamped to [0, MAX_DEPTH].
   */
  static remainingDepth(currentDepth: number): number {
    const remaining = this.MAX_DEPTH - currentDepth;
    return Math.min(this.MAX_DEPTH, Math.max(remaining, 0));
  }
}
