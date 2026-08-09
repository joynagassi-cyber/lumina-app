/**
 * Invite Domain Ports — Abstractions for the Invite Aggregate
 *
 * Implements the Port & Adapter pattern for the Invite domain.
 * Infrastructure adapters implement these interfaces; the domain depends
 * only on these abstractions (Dependency Inversion Principle).
 *
 * @traceability ORG-008 Invite Ports — IInviteRepository, ITokenService
 */

import type { Invite } from '../domain/entities/invite.entity';
import type { InviteId } from '../domain/value-objects/invite-id.vo';
import type { InviteStatus } from '../domain/value-objects/invite-status.enum';
import type { InviteToken } from '../domain/value-objects/invite-token.vo';
import type { DomainEvent } from '../../../shared/events';

/**
 * Repository port for Invitation CRUD operations.
 * All operations are scoped to org_id for tenant isolation.
 */
export interface IInviteRepository {
  /** Find invitation by ID and orgId */
  findById(id: string, orgId: string): Promise<Invite | null>;

  /** Find invitations by target email for an org */
  findByEmail(orgId: string, email: string): Promise<Invite[]>;

  /** Find invitations by target phone for an org */
  findByPhone(orgId: string, phone: string): Promise<Invite[]>;

  /** Find invitations by inviter user for an org */
  findByInviterId(orgId: string, userId: string): Promise<Invite[]>;

  /** Find active (pending/sent) invitations for an org */
  findActiveByOrg(orgId: string, status?: InviteStatus[]): Promise<Invite[]>;

  /** Count invitations by status for an org */
  countByOrgAndStatus(orgId: string, status: InviteStatus): Promise<number>;

  /** Create a new invitation */
  create(invite: Invite): Promise<void>;

  /** Update an invitation */
  update(invite: Invite): Promise<void>;

  /** Find all invitations with pagination for an org */
  findAllByOrg(
    orgId: string,
    page: number,
    limit: number,
    status?: InviteStatus
  ): Promise<{ data: Invite[]; total: number }>;
}

/**
 * Token service port — generation and validation of acceptance tokens.
 * Tokens are cryptographically signed and time-limited.
 */
export interface ITokenService {
  /** Generate a new acceptance token hash */
  generateToken(inviteId: string, orgId: string, validityDays?: number): Promise<string>;

  /** Create an InviteToken object from a hash */
  createToken(hash: string, validityDays?: number): InviteToken;

  /** Validate a token hash against stored value */
  validateToken(token: string, storedHash: string): boolean;

  /** Check if a token is expired */
  isTokenExpired(token: InviteToken): boolean;

  /** Increment token usage count */
  incrementTokenUsage(token: InviteToken): void;
}