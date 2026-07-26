/**
 * Authorization Port
 *
 * Contract for checking RBAC permissions within Application Services.
 * Used to enforce BR-ORG-005 (superadmin validation for merge).
 *
 * @traceability DOC-012 Aggregate1 → ASS-001 Service 1
 *   → PAS-001 Port-004 (AuthorizationPort)
 */

export type RoleType = 'superadmin' | 'admin' | 'treasurer' | 'pastor' | 'staff';

export interface IAuthorizationPort {
  /** Check if a user has a specific role. */
  hasRole(userId: string, requiredRole: RoleType): Promise<boolean>;

  /** Check if a user has permission above or equal to the required role in the hierarchy. */
  hasRoleHierarchy(userId: string, minimumRole: RoleType): Promise<boolean>;

  /** Check a specific permission grant string (resource:action:level format). */
  hasPermission(userId: string, permission: string): Promise<boolean>;
}
