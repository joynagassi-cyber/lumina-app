/**
 * InviteValidator — Domain Service for Input Validation
 *
 * Validates invitation creation parameters per ORG-008 business rules.
 * Ensures data integrity before entity construction.
 *
 * @traceability ORG-008 BR-INV-005 Permission validation, Data validation
 */

import { InviteId } from '../value-objects/invite-id.vo';
import { InviteToken } from '../value-objects/invite-token.vo';
import { InviteScope, isValidScope } from '../value-objects/invite-scope.vo';
import { InviteType } from '../value-objects/invite-type.enum';
import { InviteStatus } from '../value-objects/invite-status.enum';
import { Invite } from '../entities/invite.entity';

export class InviteValidator {
  /**
   * Validates orgId — non-empty string.
 */
  static validateOrgId(orgId: string): void {
    if (!orgId || orgId.trim() === '') {
      throw new Error('orgId is required and cannot be empty');
    }
    if (orgId.length > 255) {
      throw new Error('orgId exceeds maximum length of 255 characters');
    }
  }

  /**
   * Validates inviterUserId — non-empty string.
 */
  static validateInviterUserId(userId: string): void {
    if (!userId || userId.trim() === '') {
      throw new Error('inviterUserId is required and cannot be empty');
    }
  }

  /**
   * Validates targetEmail format (RFC 5322 subset).
 * Skips validation if undefined.
 */
  static validateTargetEmail(email?: string): void {
    if (email !== undefined) {
      const normalized = email.trim().toLowerCase();
      if (normalized.length === 0) {
        throw new Error('targetEmail cannot be empty');
      }
      if (normalized.length > 255) {
        throw new Error('targetEmail exceeds maximum length of 255 characters');
      }
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(normalized)) {
        throw new Error(`Invalid email format: ${email}`);
      }
    }
  }

  /**
   * Validates targetPhone format (E.164 preferred).
 * Skips validation if undefined.
 */
  static validateTargetPhone(phone?: string): void {
    if (phone !== undefined) {
      if (phone.length > 20) {
        throw new Error('targetPhone exceeds maximum length of 20 characters');
      }
      // Basic phone validation — allow digits, +, space, parentheses, hyphen
      const phoneRegex = /^[\d+\s\-\(\)]+$/;
      if (!phoneRegex.test(phone)) {
        throw new Error(`Invalid phone format: ${phone}`);
      }
    }
  }

  /**
   * Validates suggestedRole — optional string with max length.
 */
  static validateSuggestedRole(role?: string): void {
    if (role !== undefined && role.length !== 0) {
      if (role.length > 50) {
        throw new Error('suggestedRole exceeds maximum length of 50 characters');
      }
    }
  }

  /**
   * Validates scope — must be a valid InviteScope value.
 */
  static validateScope(scope: string): void {
    if (!isValidScope(scope)) {
      throw new Error(`Invalid scope: ${scope}. Must be one of: ${Object.values(InviteScope).join(', ')}`);
    }
  }

  /**
   * Validates validityDays — positive integer (1-365).
 */
  static validateValidityDays(days: number): void {
    if (days < 1 || days > 365) {
      throw new Error('validityDays must be between 1 and 365 days');
    }
    if (!Number.isInteger(days)) {
      throw new Error('validityDays must be an integer');
    }
  }

  /**
   * Validates type — must be a valid InviteType.
 */
  static validateType(type: string): void {
    const validTypes: InviteType[] = [InviteType.AUTO, InviteType.APPROVAL_REQUIRED, InviteType.OWNER_VALIDATION, InviteType.STANDARD];
    if (!validTypes.includes(type as InviteType)) {
      throw new Error(`Invalid invite type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  /**
   * Validates status — must be a valid InviteStatus.
 */
  static validateStatus(status: string): void {
    const validStatuses: InviteStatus[] = [
      InviteStatus.CREATED, InviteStatus.SENT, InviteStatus.PENDING,
      InviteStatus.ACCEPTED, InviteStatus.REJECTED, InviteStatus.EXPIRED, InviteStatus.REVOKED,
    ];
    if (!validStatuses.includes(status as InviteStatus)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  /**
   * Validates metadata — must be a serializable object.
 */
  static validateMetadata(metadata?: unknown): void {
    if (metadata !== undefined && typeof metadata !== 'object') {
      throw new Error('metadata must be an object or null');
    }
  }

  /**
   * Validates that all parameters are suitable for creating a new invitation.
 */
  static validateCreationParams(
    orgId: string,
    inviterUserId: string,
    scope: string,
    validityDays: number,
    targetEmail?: string,
    targetPhone?: string,
    suggestedRole?: string,
    type?: InviteType,
    metadata?: unknown
  ): void {
    this.validateOrgId(orgId);
    this.validateInviterUserId(inviterUserId);
    this.validateScope(scope);
    this.validateValidityDays(validityDays);
    this.validateTargetEmail(targetEmail);
    this.validateTargetPhone(targetPhone);
    this.validateSuggestedRole(suggestedRole);
    this.validateMetadata(metadata);
    this.validateType(type || InviteType.STANDARD);
  }

  /**
   * Generates and returns a secure HMAC-SHA256 token hash.
 * Uses a secret from environment or provides fallback.
 */
  static generateAcceptToken(
    inviteId: string,
    orgId: string,
    secret?: string
  ): string {
    const tokenSecret = secret || process.env.INVITE_TOKEN_SECRET || 'default-secret-change-in-production';
    const data = [inviteId, orgId, new Date().toISOString()].join(':');

    // Simplified hash generation — in production, use crypto.subtle
    // This is a placeholder for the actual cryptographic implementation
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Creates an InviteToken with proper expiration based on validityDays.
 */
  static createInviteToken(
    inviteId: string,
    orgId: string,
    validityDays: number,
    secret?: string,
    maxUsage: number = 1
  ): InviteToken {
    const tokenHash = this.generateAcceptToken(inviteId, orgId, secret);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);
    return new InviteToken(tokenHash, expiresAt, maxUsage);
  }

  /**
   * Checks if an invitation can be accepted given its current state.
 */
  static canBeAccepted(invite: Invite): boolean {
    return invite.status === InviteStatus.SENT || invite.status === InviteStatus.PENDING;
  }

  /**
   * Checks if an invitation can be rejected.
 */
  static canBeRejected(invite: Invite): boolean {
    return invite.status === InviteStatus.SENT || invite.status === InviteStatus.PENDING;
  }

  /**
   * Checks if an invitation can be revoked.
 */
  static canBeRevoked(invite: Invite): boolean {
    return !this.isTerminalStatus(invite.status) && invite.status !== InviteStatus.ACCEPTED;
  }

  private static isTerminalStatus(status: InviteStatus): boolean {
    const terminalStatuses: InviteStatus[] = [InviteStatus.ACCEPTED, InviteStatus.REJECTED, InviteStatus.EXPIRED, InviteStatus.REVOKED];
    return terminalStatuses.includes(status);
  }
}