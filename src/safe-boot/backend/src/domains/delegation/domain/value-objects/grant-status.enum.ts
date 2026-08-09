/**
 * Grant status enumeration for the delegation system.
 *
 * Lifecycle states:
 * - created: grant just created, pending approval if required
 * - pending: awaiting approval (requiresApproval = true)
 * - approved: grant is active and effective
 * - active: grant is currently active (alternative to approved for direct grants)
 * - expired: grant has passed its expiresAt date
 * - revoked: grant was manually revoked
 *
 * @traceability BR-DEL-001 to BR-DEL-007 — Grant lifecycle states
 */

export enum GrantStatus {
  Created = 'created',
  Pending = 'pending',
  Approved = 'approved',
  Active = 'active',
  Expired = 'expired',
  Revoked = 'revoked',
}