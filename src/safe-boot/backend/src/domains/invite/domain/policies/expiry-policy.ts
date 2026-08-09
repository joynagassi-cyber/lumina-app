/**
 * ExpiryPolicy — Implements BR-INV-001 (Automatic expiration)
 *
 * Handles automatic expiration of invitations after validityDays period.
 * Policy checks whether an invitation should be expired and performs
 * the state transition when appropriate.
 *
 * @traceability ORG-008 BR-INV-001 — ExpiryPolicy
 */

import { InviteStatus } from '../value-objects/invite-status.enum';
import { Invite } from '../entities/invite.entity';
import { NeverDeletePolicy } from './never-delete.policy';

export class ExpiryPolicy {
  /**
   * Checks if an invitation has expired based on current time and expiresAt.
   * Returns true if the invitation should be considered expired.
 */
  static isExpired(invite: Invite): boolean {
    return new Date() > invite.expiresAt;
  }

  /**
   * Expires an invitation if it is still in a pending state.
 * Emits the InviteExpired event through the aggregate.
 * Ensures compliance with NeverDeletePolicy.
 */
  static async expireIfPastDue(invite: Invite): Promise<void> {
    if (!this.isExpired(invite)) {
      return; // Not expired yet
    }

    // Only expire if not already in a terminal state
    if (invite.status === InviteStatus.ACCEPTED || invite.status === InviteStatus.REJECTED) {
      return; // Already accepted/rejected — no need to expire
    }

    // Apply expiration
    invite.expire();

    // Ensure compliance with never-delete policy
    NeverDeletePolicy.ensureValidFinalStatus(invite.status);
  }

  /**
   * Returns the remaining validity days for an invitation.
 * Negative value means the invitation has expired.
 */
  static getRemainingDays(invite: Invite): number {
    const diff = invite.expiresAt.getTime() - new Date().getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Checks if an invitation is within its validity window.
 */
  static isActive(invite: Invite): boolean {
    return invite.status !== InviteStatus.EXPIRED && this.isExpired(invite) === false;
  }
}