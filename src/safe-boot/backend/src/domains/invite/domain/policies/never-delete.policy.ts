/**
 * NeverDeletePolicy — Enforcement of BR-INV-005 (Invitations never deleted)
 *
 * This policy ensures that invitations are never physically deleted from the
 * database. Instead, they are marked as expired or revoked to maintain
 * audit trail and data integrity.
 *
 * @traceability ORG-008 BR-INV-005 — NeverDeletePolicy
 */

import { InviteStatus } from '../value-objects/invite-status.enum';

export class NeverDeletePolicy {
  /**
   * Prevents deletion of an invitation. Only soft deletion (status update) is allowed.
   * @throws Error if deletion is attempted
   */
  static assertNoDelete(inviteId: string, orgId: string): void {
    throw new Error('Invitations cannot be deleted. Use revoke() or expire() instead.');
  }

  /**
   * Validates that an invitation should not be removed from the system.
   * Returns true if the invitation is still auditable (not purged).
   */
  static isAuditable(invitation: any): boolean {
    // All invitations are auditable regardless of status
    return !!invitation;
  }

  /**
   * Ensures the invitation status transition follows the never-delete principle.
 * Validates that any final status is one of the permitted terminal states.
 */
  static ensureValidFinalStatus(status: InviteStatus): void {
    const terminalStatuses: InviteStatus[] = [
      InviteStatus.ACCEPTED,
      InviteStatus.REJECTED,
      InviteStatus.EXPIRED,
      InviteStatus.REVOKED,
    ];

    if (!terminalStatuses.includes(status)) {
      throw new Error(`Invalid terminal status for invitation: ${status}`);
    }
  }
}