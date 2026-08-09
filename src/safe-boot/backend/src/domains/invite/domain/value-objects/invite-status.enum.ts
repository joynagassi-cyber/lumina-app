/**
 * InviteStatus — State machine enumeration for invitation lifecycle
 *
 * States:
 *   created   → Invitation created but not yet sent
 *   sent      → Invitation delivered via notification channel
 *   pending   → Accepted, awaiting confirmation
 * accepted    → Invitation accepted, membership created
 * rejected    → Invitation explicitly rejected by target
 * expired     → Invitation expired due to time limit
 * revoked     → Invitation explicitly revoked by inviter
 */

export const InviteStatus = {
  CREATED: 'created',
  SENT: 'sent',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;

export type InviteStatus = typeof InviteStatus[keyof typeof InviteStatus];

/**
 * Validates if a status transition is permitted.
 * Implements the state machine defined in BR-INV-001.
 */
export function isValidStatusTransition(
  from: InviteStatus,
  to: InviteStatus
): boolean {
  const transitions: Record<InviteStatus, InviteStatus[]> = {
    [InviteStatus.CREATED]: [InviteStatus.SENT],
    [InviteStatus.SENT]: [InviteStatus.PENDING, InviteStatus.EXPIRED, InviteStatus.REVOKED],
    [InviteStatus.PENDING]: [InviteStatus.ACCEPTED, InviteStatus.REJECTED, InviteStatus.EXPIRED, InviteStatus.REVOKED],
    [InviteStatus.ACCEPTED]: [],
    [InviteStatus.REJECTED]: [],
    [InviteStatus.EXPIRED]: [],
    [InviteStatus.REVOKED]: [],
  };

  return (transitions[from] || []).includes(to);
}