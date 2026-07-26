/**
 * MultiMembershipPolicy — Validates that a member can belong to multiple groups.
 * This is an ALLOWED invariant (opposite of single-membership).
 * @traceability DOC-012 §Aggregate 4, BR-REL-003, DOC-023 §3.3
 */

/**
 * Error thrown when multi-membership violates a constraint.
 */
export class MultiMembershipError extends Error {
  constructor(message: string) {
    super(`Multi-membership violation: ${message}`);
    this.name = 'MultiMembershipError';
  }
}

export class MultiMembershipPolicy {
  /**
   * Validates that the maximum number of concurrent memberships is reasonable.
   * The policy ALLOWS multiple memberships (BR-REL-003) but caps at a sane limit.
   */
  static readonly MAX_CONCURRENT_MEMBERSHIPS = 50;

  /**
   * Asserts that a member can join a new group given their current membership count.
   * @throws MultiMembershipError if adding this membership would exceed the cap.
   */
  static assertCanJoin(
    currentMembershipCount: number,
    memberUuid: string,
    groupUuid: string,
  ): void {
    if (currentMembershipCount >= this.MAX_CONCURRENT_MEMBERSHIPS) {
      throw new MultiMembershipError(
        `Member ${memberUuid} already has ${currentMembershipCount} active memberships ` +
        `(max ${this.MAX_CONCURRENT_MEMBERSHIPS}). Cannot add membership to group ${groupUuid}.`,
      );
    }
  }

  /**
   * Checks whether a member has exceeded the concurrent membership limit.
   */
  static exceedsLimit(currentMembershipCount: number): boolean {
    return currentMembershipCount >= this.MAX_CONCURRENT_MEMBERSHIPS;
  }

  /**
   * Returns true if the member still has room for more memberships.
   */
  static hasRoom(currentMembershipCount: number): boolean {
    return currentMembershipCount < this.MAX_CONCURRENT_MEMBERSHIPS;
  }
}
