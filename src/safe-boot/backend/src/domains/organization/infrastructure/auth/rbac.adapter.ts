/**
 * RbacAuthorizationAdapter — Infrastructure Adapter for IAuthorizationPort
 *
 * Resolves RBAC permissions from a user's role and permission grants.
 *
 * @traceability DOC-012 IdentityAggregate §UserRole
 *   → PAS-001 Port-004 (AuthorizationPort)
 */

import type { IAuthorizationPort, RoleType } from '../../ports/auth.port';

export class RbacAuthorizationAdapter implements IAuthorizationPort {
  constructor(
    private readonly lookupRole: (userId: string) => Promise<RoleType | null>,
    private readonly lookupPermission: (userId: string, permission: string) => Promise<boolean>,
  ) {}

  async hasRole(userId: string, requiredRole: RoleType): Promise<boolean> {
    const userRole = await this.lookupRole(userId);
    if (!userRole) return false;
    return this.isRoleEqualOrAbove(userRole, requiredRole);
  }

  async hasRoleHierarchy(
    userId: string,
    minimumRole: RoleType,
  ): Promise<boolean> {
    const userRole = await this.lookupRole(userId);
    if (!userRole) return false;
    return this.isRoleEqualOrAbove(userRole, minimumRole);
  }

  async hasPermission(
    userId: string,
    permission: string,
  ): Promise<boolean> {
    return this.lookupPermission(userId, permission);
  }

  /**
   * Role hierarchy (higher index = more privilege):
   * staff(0) < pastor(1) < treasurer(2) < admin(3) < superadmin(4)
   */
  private isRoleEqualOrAbove(actual: RoleType, minimum: RoleType): boolean {
    const hierarchy: RoleType[] = ['staff', 'pastor', 'treasurer', 'admin', 'superadmin'];
    const actualIndex = hierarchy.indexOf(actual);
    const minIndex = hierarchy.indexOf(minimum);
    return actualIndex >= minIndex;
  }
}
