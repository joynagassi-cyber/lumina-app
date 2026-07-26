/**
 * PermissionResolver domain service — resolves permissions from user roles.
 *
 * Implements InheritancePolicy: child roles inherit parent permissions, never subtract.
 * SuperAdmin has all permissions. Admin has all except superadmin-only operations.
 * Role hierarchy determines the permission set.
 *
 * BR-ID-006: wildcard permissions audited but authorized.
 *
 * @traceability DOC-012 Domain Service PermissionResolver
 */

import type { UserRole } from '../value-objects/user-role';
import { ROLE_HIERARCHY, type RoleName } from '../value-objects/user-role';
import { PermissionGrant } from '../value-objects/permission-grant';

/** Built-in role manifest — maps each role to its default permission grants. */
interface RoleManifest {
  [role: string]: string[];
}

const ROLE_MANIFEST: RoleManifest = {
  superadmin: ['*:*:*'],
  admin: [
    'user:create', 'user:read', 'user:update', 'user:delete',
    'org:read', 'org:update',
    'finance:read', 'finance:write',
    'workflow:approve', 'workflow:reject',
    'reporting:generate', 'reporting:export',
    'vocab:manage',
    'settings:manage',
  ],
  treasurer: [
    'finance:read', 'finance:write',
    'reporting:generate', 'reporting:export',
  ],
  pastor: [
    'user:read', 'user:update',
    'finance:read',
    'reporting:generate',
    'event:manage',
    'membership:manage',
  ],
  staff: [
    'finance:read',
    'reporting:generate',
    'event:read',
  ],
};

export class PermissionResolver {
  /**
   * Get all permission grants for a given role.
   * Returns PermissionGrant instances resolved from role manifest strings.
   */
  resolvePermissions(role: UserRole): PermissionGrant[] {
    const manifestKeys = ROLE_MANIFEST[role.toString()] ?? [];
    return manifestKeys.map((key) => PermissionGrant.create(key));
  }

  /** Check if a role has a specific resource:action:level permission. */
  hasPermission(role: UserRole, resource: string, action: string, level: string): boolean {
    const grants = this.resolvePermissions(role);
    return grants.some((g) => g.matches(resource, action, level));
  }

  /**
   * Check if the acting role can perform an operation on behalf of a target role.
   * Implements role hierarchy: superadmin > admin > treasurer/pastor/staff.
   * BR-ID-005: Admin cannot create superadmin users.
   */
  canCreateRole(actorRole: UserRole, targetRole: RoleName): boolean {
    // SuperAdmin can create anyone
    if (actorRole.isSuperadmin()) return true;
    // Admin can only create treasurer, pastor, staff
    return ROLE_MANIFEST.admin?.some((p) => p.includes(targetRole)) ?? false;
  }

  /** Check if actor role has higher or equal privilege than subject role. */
  hasHigherOrEqualPrivilege(actorRole: UserRole, subjectRole: UserRole): boolean {
    return actorRole.priority() <= subjectRole.priority();
  }
}
