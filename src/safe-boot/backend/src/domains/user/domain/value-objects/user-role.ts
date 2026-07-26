/**
 * UserRole value object — RBAC hierarchy enforcement
 *
 * Immutable VO. Represents a user's role within their organization.
 * BR-ID-004: SuperAdmin can create ALL roles.
 * BR-ID-005: Admin can only create treasurer/pastor/staff (not superadmin).
 *
 * @traceability DOC-012 VO UserRole → PG-Schema Table 4 role_utilisateur
 */

export type RoleName = 'superadmin' | 'admin' | 'treasurer' | 'pastor' | 'staff';

/**
 * Role hierarchy: lower index = higher privilege.
 * Index 0 (superadmin) > Index 1 (admin) > ... > Index 4 (staff)
 */
export const ROLE_HIERARCHY: ReadonlyMap<RoleName, number> = new Map<RoleName, number>([
  ['superadmin', 0],
  ['admin', 1],
  ['treasurer', 2],
  ['pastor', 3],
  ['staff', 4],
]);

/** Roles that an Admin (non-superadmin) is authorized to create. */
export const ADMIN_CREATEABLE_ROLES: ReadonlySet<RoleName> = new Set<RoleName>([
  'treasurer',
  'pastor',
  'staff',
]);

export class UserRole {
  readonly roleName: RoleName;

  private constructor(role: string) {
    if (!ROLE_HIERARCHY.has(role as RoleName)) {
      throw new Error(`Invalid UserRole: "${role}". Must be one of: ${Array.from(ROLE_HIERARCHY.keys()).join(', ')}`);
    }
    this.roleName = role as RoleName;
  }

  /** Returns numeric priority (0 = highest). Lower = more powerful. */
  priority(): number {
    return ROLE_HIERARCHY.get(this.roleName) ?? -1;
  }

  /** Check if this role has strictly higher privilege than `other`. */
  isMorePrivilegedThan(other: UserRole): boolean {
    return this.priority() < other.priority();
  }

  /** Check if this role is a superadmin. */
  isSuperadmin(): boolean {
    return this.roleName === 'superadmin';
  }

  /** Check if this role is an admin (but not superadmin). */
  isAdmin(): boolean {
    return this.roleName === 'admin';
  }

  toString(): string {
    return this.roleName;
  }

  static create(role: string): UserRole {
    return new UserRole(role);
  }

  static fromPriority(priority: number): RoleName | null {
    for (const [role, p] of ROLE_HIERARCHY) {
      if (p === priority) return role;
    }
    return null;
  }
}
