/**
 * AuthorizationAdapter — Implements IAuthorizationPort using role-based access control.
 *
 * Checks if a user can perform actions on delegation grants based on their
 * role and existing permissions within an organization.
 *
 * @traceability BR-DEL-005 — Permission checks for delegation operations
 */

import { Injectable, Inject } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { IAuthorizationPort } from '../../ports/delegation.ports';

const PRISMA_CLIENT = 'PRISMA_CLIENT';

@Injectable()
export class AuthorizationAdapter implements IAuthorizationPort {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: any,
    private readonly userOrgResolver?: (userId: string) => Promise<{ orgId: string | null }>,
  ) {}

  /**
   * Check if a user can perform an action within an organization.
   *
   * @param userId — the user attempting the action (or 'context-required' for current user)
   * @param orgId — the organization context
   * @param action — the action being attempted ('create', 'read', 'update', 'delete', 'approve', 'revoke')
   * @param resourceId — optional resource identifier (e.g., grant ID)
   */
  async canPerformAction(
    userId: string,
    orgId: string,
    action: string,
    resourceId?: string,
  ): Promise<boolean> {
    // If user is 'context-required', try to get from context (not implemented here)
    if (userId === 'context-required') {
      // In a real implementation, this would resolve from request context
      // For now, return false until proper context is available
      return false;
    }

    // Get user's role in the organization
    const role = await this.getUserRole(orgId, userId);
    if (!role) return false;

    // Special check for superadmin — can do everything
    if (role === 'superadmin') {
      return true;
    }

    // Admin-level operations
    switch (action) {
      case 'create':
        // Admin can create grants, staff may have limited permissions
        return role === 'admin' || role === 'treasurer' || role === 'pastor';

      case 'read':
        // Anyone with read access to delegation can list grants
        return role === 'admin' || role === 'treasurer' || role === 'pastor' || role === 'staff';

      case 'update':
      case 'delete':
        return role === 'admin';

      case 'approve':
        // Only admin or the delegator can approve
        if (resourceId) {
          // Check if this user is the delegator of the grant
          const grant = await this.getGrantById(resourceId);
          if (grant && grant.delegatorUserId === userId) {
            return true;
          }
        }
        return role === 'admin';

      case 'revoke':
        // Only admin or the delegator can revoke
        if (resourceId) {
          const grant = await this.getGrantById(resourceId);
          if (grant && (grant.delegatorUserId === userId || role === 'admin')) {
            return true;
          }
        }
        return role === 'admin';

      default:
        return false;
    }
  }

  /** Get the user's role within an organization. */
  async getUserRole(orgId: string, userId: string): Promise<string | null> {
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: userId, org_id: orgId },
        select: { role_utilisateur: true },
      });
      return user ? user.role_utilisateur : null;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }

  /** Check if a user is a superadmin. */
  async isSuperadmin(userId: string): Promise<boolean> {
    // In a multi-org system, check if user is superadmin in any org
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { role_utilisateur: true },
      });
      return user ? user.role_utilisateur === 'superadmin' : false;
    } catch (error) {
      console.error('Error checking superadmin status:', error);
      return false;
    }
  }

  /** Helper to get a grant by ID (for authorization checks). */
  async getGrantById(grantId: string): Promise<any> {
    try {
      return await this.prisma.grantEntries.findUnique({
        where: { id: grantId },
      });
    } catch (error) {
      console.error('Error fetching grant:', error);
      return null;
    }
  }
}