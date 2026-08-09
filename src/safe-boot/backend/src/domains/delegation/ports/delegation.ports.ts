/**
 * Delegation Ports — repository and authorization interfaces for the delegation module.
 *
 * Implements the Ports & Adapters architecture. The domain depends on these
 * abstractions, not on concrete infrastructure implementations.
 *
 * @traceability DOC-012 DelegationAggregate → Port definitions
 */

import type { GrantEntry } from '../domain/entities/grant-entry';
import { GrantId } from '../domain/value-objects/grant-id.vo';
import { GrantStatus } from '../domain/value-objects/grant-status.enum';

/**
 * Repository interface for grant persistence operations.
 */
export interface IGrantRepository {
  /** Create a new grant and return its ID. */
  create(props: GrantEntryProps): Promise<GrantId>;

  /** Find a grant by ID. */
  findById(grantId: string): Promise<GrantEntry | null>;

  /** Find grants by delegatee user ID. */
  findByDelegateeUserId(userId: string): Promise<GrantEntry[]>;

  /** Find grants by delegator user ID. */
  findByDelegatorUserId(userId: string): Promise<GrantEntry[]>;

  /** Find active grants for an organization. */
  findActiveByOrgId(orgId: string): Promise<GrantEntry[]>;

  /** Find all grants (including inactive) for an organization. */
  findAllByOrgId(orgId: string): Promise<GrantEntry[]>;

  /** Update a grant's properties. */
  update(grant: GrantEntry): Promise<void>;

  /** Revokes a grant by ID (sets active=false, revokedAt). */
  revokeById(grantId: string, revokedBy: string): Promise<boolean>;

  /** Approves a grant by ID (if pending). */
  approveById(grantId: string, approvedBy: string): Promise<boolean>;

  /** Expire grants that have passed their expiration date. */
  expireExpiredGrants(): Promise<number>;

  /** Check if a grant exists for the given parameters. */
  exists(params: {
    delegatorId: string;
    delegateeId: string;
    orgId: string;
    grantScope: string;
  }): Promise<boolean>;
}

export interface GrantEntryProps {
  grantId: string;
  delegatorUserId: string;
  delegateeUserId: string;
  orgId: string;
  grantScope: string;
  grantPermissions: string[];
  durationDays: number;
  expiresAt: string; // ISO string
  requiresApproval: boolean;
  approvalStatus: GrantStatus;
  active: boolean;
  createdAt: string;
  revokedAt?: string | null;
}

/**
 * Authorization port — checks if a user has permission to perform an action.
 *
 * This port allows the delegation domain to ask about authorization without
 * knowing the concrete authorization implementation.
 */
export interface IAuthorizationPort {
  /**
   * Check if a user can perform an action within an organization.
   *
   * @param userId — the user attempting the action
   * @param orgId — the organization context
   * @param action — the action being attempted ('create', 'read', 'update', 'delete', 'approve', 'revoke')
   * @param resourceId — optional resource identifier (e.g., grant ID)
   * @returns true if the user is authorized, false otherwise
   */
  canPerformAction(
    userId: string,
    orgId: string,
    action: string,
    resourceId?: string,
  ): Promise<boolean>;

  /**
   * Get the user's role within an organization.
   */
  getUserRole(
    orgId: string,
    userId: string,
  ): Promise<string | null>;

  /**
   * Check if a user is a superadmin.
   */
  isSuperadmin(userId: string): Promise<boolean>;
}

/**
 * Event publisher port — used to emit domain events.
 */
export interface IEventPublisherPort {
  publish(event: unknown): Promise<void>;
}

/**
 * Audit logger port — for auditing every delegation action (BR-DEL-006).
 */
export interface IAuditLogger {
  logAction(
    userId: string,
    orgId: string,
    action: string,
    entity: string,
    entityId: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
}