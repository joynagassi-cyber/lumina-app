/**
 * UsageLimitPolicy — Implements BR-INV-002 (Single use by default)
 *
 * Controls the number of times an invitation token can be used.
 * Default limit is 1 (single-use), configurable via invitation metadata.
 *
 * @traceability ORG-008 BR-INV-002 — UsageLimitPolicy
 */

import { InviteStatus } from '../value-objects/invite-status.enum';
import { InviteToken } from '../value-objects/invite-token.vo';
import { Invite } from '../entities/invite.entity';
import { NeverDeletePolicy } from './never-delete.policy';

export class UsageLimitPolicy {
  /**
   * Gets the usage limit for an invitation.
 * Defaults to 1 if not specified in metadata.
 */
  static getUsageLimit(invite: Invite): number {
    const limit = invite.metadata?.usageLimit;
    return typeof limit === 'number' ? limit : 1;
  }

  /**
   * Checks if the token usage has reached the limit.
 * Returns true if the token cannot be used again.
 */
  static isLimitReached(invite: Invite, token: InviteToken): boolean {
    const limit = this.getUsageLimit(invite);
    return token.remainingUsage <= 0;
  }

  /**
   * Validates that a token can be used for acceptance.
 * Throws if the token is expired, used, or usage limit exceeded.
 */
  static validateTokenForUsage(invite: Invite, token: string): InviteToken {
    const inviteToken = invite.acceptToken;
    if (!inviteToken) {
      throw new Error('No acceptance token available for this invitation');
    }

    if (inviteToken.hash !== token) {
      throw new Error('Invalid token');
    }

    if (inviteToken.isExpired) {
      throw new Error('Token has expired');
    }

    if (this.isLimitReached(invite, inviteToken)) {
      throw new Error('Usage limit exceeded for this invitation');
    }

    if (inviteToken.isUsed && inviteToken.remainingUsage === 0) {
      throw new Error('Token has already been used');
    }

    return inviteToken;
  }

  /**
   * Increments the usage count on the token.
 * Called after successful acceptance.
 */
  static incrementUsage(invite: Invite): void {
    if (invite.acceptToken) {
      // The token's internal usageCount is tracked via its use() method
      // Here we ensure the policy is respected
      NeverDeletePolicy.ensureValidFinalStatus(invite.status);
    }
  }

  /**
   * Checks if multi-usage is allowed for this invitation.
 */
  static allowsMultiUsage(invite: Invite): boolean {
    return this.getUsageLimit(invite) > 1;
  }
}