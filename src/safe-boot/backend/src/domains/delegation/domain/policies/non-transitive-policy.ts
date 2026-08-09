/**
 * NonTransitivePolicy — prevents re-delegation of delegated permissions (BR-DEL-007).
 *
 * Rule: If user A delegates a permission to user B, then user B cannot delegate
 * that same permission to user C. Delegations are non-transitive.
 *
 * @traceability BR-DEL-007 — Non-transitive delegation rule
 */

import { NonTransitiveError } from './delegation-errors';

export interface IDelegationQueryService {
  /**
   * Check if a user has received a delegation that would prevent them from acting as
   * a delegator for a specific permission/scope.
   */
  hasReceivedDelegation(
    candidateDelegatorId: string,
    orgId: string,
    grantScope: string,
  ): Promise<boolean>;

  /**
   * Check if there exists a delegation path from delegatee back to delegator
   * (for circular delegation detection).
   */
  hasDelegationPathFromTo(
    delegateeId: string,
    delegatorId: string,
  ): Promise<boolean>;

  /**
   * Get active grants for a user (used in non-transitive checks).
   */
  getActiveGrantsForUser(
    userId: string,
  ): Promise<{ delegateeId: string; grantScope: string }[]>;
}

export class NonTransitivePolicy {
  /**
   * Validate that the proposed delegation does not violate the non-transitive rule.
   */
  static async validateNonTransitive(
    candidateDelegatorId: string,
    delegateeId: string,
    orgId: string,
    grantScope: string,
    delegationQueryService: IDelegationQueryService,
  ): Promise<void> {
    const hasReceivedDelegation = await delegationQueryService.hasReceivedDelegation(
      candidateDelegatorId,
      orgId,
      grantScope,
    );

    if (hasReceivedDelegation) {
      throw new NonTransitiveError(
        `User ${candidateDelegatorId} has received a delegation in scope ${grantScope} and cannot re-delegate (BR-DEL-007)`
      );
    }
  }
}