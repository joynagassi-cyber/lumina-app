/**
 * DelegationService — application service for delegation operations.
 *
 * Implements the core use cases:
 * - CreateGrant
 * - ApproveGrant
 * - RevokeGrant
 * - ListActiveGrants
 * - CheckExpiration (background job)
 *
 * @traceability DOC-012 DelegationAggregate → Application service
 */

import { Injectable, Inject } from '@nestjs/common';
import type { IGrantRepository, IAuthorizationPort, IAuditLogger, IEventPublisherPort } from '../ports/delegation.ports';
import { GrantEntry } from '../domain/entities/grant-entry';
import { GrantId } from '../domain/value-objects/grant-id.vo';
import { GrantScope } from '../domain/value-objects/grant-scope.vo';
import { GrantPermission } from '../domain/value-objects/grant-permission.vo';
import { GrantStatus } from '../domain/value-objects/grant-status.enum';
import { GrantValidator } from '../domain/services/grant-validator';
import { IUserRoleService } from '../domain/policies/no-superadmin-delegation';
import { IDelegationQueryService } from '../domain/policies/non-transitive-policy';
import { GrantCreated, GrantApproved, GrantExpired, GrantRevoked } from '../domain/events/grant-events';
import { DelegationError } from '../domain/policies/delegation-errors';

@Injectable()
export class DelegationService {
  constructor(
    @Inject('IGrantRepository') private readonly grantRepository: IGrantRepository,
    @Inject('IAuthorizationPort') private readonly authPort: IAuthorizationPort,
    @Inject('IAuditLogger') private readonly auditLogger: IAuditLogger,
    @Inject('IEventPublisherPort') private readonly eventPublisher: IEventPublisherPort,
  ) {}

  /**
   * Create a new delegation grant.
   *
   * @param params — all required parameters for the grant
   * @returns The created GrantEntry
   * @throws Error if validation fails or user is not authorized
   */
  async createGrant({
    delegatorUserId,
    delegateeUserId,
    orgId,
    grantScope,
    permissions,
    durationDays,
    requiresApproval = false,
  }: {
    delegatorUserId: string;
    delegateeUserId: string;
    orgId: string;
    grantScope: GrantScope;
    permissions: string[];
    durationDays: number;
    requiresApproval?: boolean;
  }): Promise<GrantEntry> {
    // Check authorization: delegator must have permission to create grants
    const isAuthorized = await this.authPort.canPerformAction(
      delegatorUserId,
      orgId,
      'create',
      'delegation',
    );

    if (!isAuthorized) {
      throw new Error('User is not authorized to create grants');
    }

    // Validate all business rules
    const grantPermissionObjects = permissions.map(p => GrantPermission.create(p));
    await GrantValidator.validateCreateGrant(
      delegatorUserId,
      delegateeUserId,
      orgId,
      grantScope,
      grantPermissionObjects,
      durationDays,
      this, // IUserRoleService
      this, // IDelegationQueryService
    );

    // Calculate expiresAt
    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Create the grant entry
    const grant = GrantEntry.create({
      delegatorUserId,
      delegateeUserId,
      orgId,
      grantScope,
      grantPermissions: grantPermissionObjects,
      durationDays,
      expiresAt,
      requiresApproval,
    });

    // Persist the grant — adapter au contrat du port (GrantEntryProps camelCase)
    await this.grantRepository.create({
      grantId: grant.grantId.value,
      delegatorUserId,
      delegateeUserId,
      orgId,
      grantScope: grantScope.value,
      grantPermissions: grantPermissionObjects.map(p => p.toString()),
      durationDays,
      expiresAt: grant.expiresAt.toISOString(),
      requiresApproval,
      approvalStatus: grant.approvalStatus,
      active: grant.active,
      createdAt: grant.createdAt.toISOString(),
      revokedAt: null,
    });

    // Log audit action
    await this.auditLogger.logAction(
      delegatorUserId,
      orgId,
      'delegation.create',
      'GrantEntry',
      grant.grantId.value,
      {
        delegateeUserId,
        grantScope: grantScope.value,
        permissions,
        durationDays,
        requiresApproval,
      },
    );

    // Get and publish emitted events from the grant
    const events = grant.getAndClearEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    return grant;
  }

  /**
   * Approve a pending grant.
   *
   * @param grantId — ID of the grant to approve
   * @param approvedBy — user ID of the person approving
   * @param orgId — organization context
   * @returns The approved GrantEntry
   */
  async approveGrant(
    grantId: string,
    approvedBy: string,
    orgId: string,
  ): Promise<GrantEntry> {
    // Check authorization: approver must have appropriate permissions
    const isAuthorized = await this.authPort.canPerformAction(
      approvedBy,
      orgId,
      'approve',
      grantId,
    );

    if (!isAuthorized) {
      throw new Error('User is not authorized to approve this grant');
    }

    // Find the grant
    const grant = await this.grantRepository.findById(grantId);
    if (!grant) {
      throw new Error(`Grant not found: ${grantId}`);
    }

    // Validate that grant is in pending state
    if (grant.approvalStatus !== GrantStatus.Pending) {
      throw new Error('Grant is not in pending state and cannot be approved');
    }

    // Approve the grant
    grant.approve(approvedBy);

    // Persist changes
    await this.grantRepository.update(grant);

    // Log audit action
    await this.auditLogger.logAction(
      approvedBy,
      orgId,
      'delegation.approve',
      'GrantEntry',
      grant.grantId.value,
      { granteeId: grant.delegateeUserId },
    );

    // Publish domain event
    const events = grant.getAndClearEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    return grant;
  }

  /**
   * Revoke an active grant.
   *
   * @param grantId — ID of the grant to revoke
   * @param revokedBy — user ID of the person revoking
   * @param orgId — organization context
   * @returns The revoked GrantEntry
   */
  async revokeGrant(
    grantId: string,
    revokedBy: string,
    orgId: string,
  ): Promise<GrantEntry> {
    // Check authorization
    const isAuthorized = await this.authPort.canPerformAction(
      revokedBy,
      orgId,
      'revoke',
      grantId,
    );

    if (!isAuthorized) {
      throw new Error('User is not authorized to revoke this grant');
    }

    // Find the grant
    const grant = await this.grantRepository.findById(grantId);
    if (!grant) {
      throw new Error(`Grant not found: ${grantId}`);
    }

    // Validate that grant is active
    GrantValidator.validateRevokeGrant(grant.active);

    // Revoke the grant
    grant.revoke(revokedBy);

    // Persist changes
    await this.grantRepository.update(grant);

    // Log audit action
    await this.auditLogger.logAction(
      revokedBy,
      orgId,
      'delegation.revoke',
      'GrantEntry',
      grant.grantId.value,
    );

    // Publish domain event
    const events = grant.getAndClearEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    return grant;
  }

  /**
   * List all active grants for an organization.
   *
   * @param orgId — organization ID
   * @returns Array of active GrantEntry objects
   */
  async listActiveGrants(orgId: string): Promise<GrantEntry[]> {
    // Check authorization to view grants
    // In practice, we'd get the current user's ID from the request context
    const canRead = await this.authPort.canPerformAction(
      'context-required',
      orgId,
      'read',
      'delegation',
    );

    if (!canRead) {
      throw new Error('User is not authorized to view grants');
    }

    return await this.grantRepository.findActiveByOrgId(orgId);
  }

  /**
   * List all grants (including inactive) for an organization.
   *
   * @param orgId — organization ID
   * @returns Array of all GrantEntry objects
   */
  async listAllGrants(orgId: string): Promise<GrantEntry[]> {
    return await this.grantRepository.findAllByOrgId(orgId);
  }

  /**
   * Background job to check for expired grants and mark them as expired.
   * This is scheduled to run daily per BR-DEL-005.
   *
   * @returns Number of grants that were expired
   */
  async checkExpiration(): Promise<number> {
    // Bulk expiration at database level - efficient for large datasets
    // The repository method updates all expired grants in a single query
    const count = await this.grantRepository.expireExpiredGrants();

    // Log a summary audit action
    try {
      await this.auditLogger.logAction(
        'system',
        'all',
        'delegation.expire.batch',
        'GrantEntry',
        'expiration-check',
        { expiredCount: count },
      );
    } catch (err) {
      console.error('Failed to log expiration audit:', err);
    }

    return count;
  }

  /**
   * IUserRoleService implementation for validator — get user role
   */
  async getUserRole(orgId: string, userId: string): Promise<string | null> {
    return await this.authPort.getUserRole(orgId, userId);
  }

  /**
   * IDelegationQueryService implementation for never-repeat-policy — check delegation path
   */
  async hasDelegationPathFromTo(delegateeId: string, delegatorId: string): Promise<boolean> {
    // Check if there's any delegation path from delegatee to delegator
    // This involves checking the transitive closure of the delegation graph
    const visited = new Set<string>();
    const queue: string[] = [delegateeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === delegatorId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      // Find all grants where current user is the delegatee (meaning they received delegation)
      // and get the delegator from those grants
      const grants = await this.grantRepository.findByDelegateeUserId(current);
      for (const grant of grants) {
        if (!visited.has(grant.delegatorUserId)) {
          queue.push(grant.delegatorUserId);
        }
      }
    }

    return false;
  }

  /**
   * IDelegationQueryService implementation for non-transitive-policy — check if user received delegation
   */
  async hasReceivedDelegation(
    candidateDelegatorId: string,
    orgId: string,
    grantScope: string,
  ): Promise<boolean> {
    const grants = await this.grantRepository.findByDelegateeUserId(candidateDelegatorId);
    return grants.some(
      g => g.orgId === orgId && g.grantScope.value === grantScope && g.active && !g.revokedAt,
    );
  }

  /** Get active grants for a user (for non-transitive check). */
  async getActiveGrantsForUser(userId: string): Promise<{ delegateeId: string; grantScope: string }[]> {
    const grants = await this.grantRepository.findByDelegateeUserId(userId);
    return grants
      .filter(g => g.active && (g.approvalStatus === GrantStatus.Approved || g.approvalStatus === GrantStatus.Active))
      .map(g => ({ delegateeId: g.delegateeUserId, grantScope: g.grantScope.value }));
  }
}