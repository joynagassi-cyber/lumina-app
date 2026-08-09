/**
 * NeverRepeatPolicy — prevents circular delegations.
 *
 * Ensures that a user cannot delegate to someone who has previously delegated
 * to them, creating a circular delegation pattern.
 *
 * @traceability Delegation integrity invariant — cycle prevention
 */

import { CircularDelegationError } from './delegation-errors';
import { IDelegationQueryService } from './non-transitive-policy'; // Unified interface

export class NeverRepeatPolicy {
  /**
   * Validate that creating a delegation from delegator to delegatee does not
   * create a circular delegation pattern.
   *
   * @param delegatorId — the user who is delegating
   * @param delegateeId — the user who is receiving the delegation
   * @param delegationService — service to check existing delegation paths
   * @throws CircularDelegationError if circular delegation would be created
   */
  static async validateNoCircularDelegation(
    delegatorId: string,
    delegateeId: string,
    delegationService: IDelegationQueryService,
  ): Promise<void> {
    // Prevent self-delegation
    if (delegatorId === delegateeId) {
      throw new CircularDelegationError('A user cannot delegate to themselves');
    }

    // Check if delegatee already has a delegation path to delegator (circular)
    const hasReverseDelegation = await delegationService.hasDelegationPathFromTo(
      delegateeId,
      delegatorId,
    );

    if (hasReverseDelegation) {
      throw new CircularDelegationError(
        'Circular delegation detected: delegatee has a path to delegator'
      );
    }
  }
}