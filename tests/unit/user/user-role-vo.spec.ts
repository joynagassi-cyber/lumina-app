/**
 * UserRole Value Object Tests
 *
 * Tests validation and behavior of UserRole VO with RBAC hierarchy.
 * @traceability DOC-012 BR-ID-004, BR-ID-005, VO-UserRole
 */

import { UserRole, ROLE_HIERARCHY, ADMIN_CREATEABLE_ROLES, RoleName } from '@/domains/user/domain/value-objects/user-role';

describe('UserRole', () => {
  // Valid role creation
  it('should create superadmin role', () => {
    const role = UserRole.create('superadmin');
    expect(role.roleName).toBe('superadmin');
    expect(role.isSuperadmin()).toBe(true);
    expect(role.priority()).toBe(0);
  });

  it('should create admin role', () => {
    const role = UserRole.create('admin');
    expect(role.roleName).toBe('admin');
    expect(role.isAdmin()).toBe(true);
    expect(role.isSuperadmin()).toBe(false);
    expect(role.priority()).toBe(1);
  });

  it('should create treasurer role', () => {
    const role = UserRole.create('treasurer');
    expect(role.roleName).toBe('treasurer');
    expect(role.priority()).toBe(2);
  });

  it('should create pastor role', () => {
    const role = UserRole.create('pastor');
    expect(role.roleName).toBe('pastor');
    expect(role.priority()).toBe(3);
  });

  it('should create staff role', () => {
    const role = UserRole.create('staff');
    expect(role.roleName).toBe('staff');
    expect(role.priority()).toBe(4);
  });

  // Invalid role creation
  it('should reject invalid role name', () => {
    expect(() => UserRole.create('invalid')).toThrowError();
    expect(() => UserRole.create('superadmin-extra')).toThrowError();
  });

  it('should reject empty string as role', () => {
    expect(() => UserRole.create('')).toThrowError();
  });

  it('should reject null as role', () => {
    // @ts-ignore
    expect(() => UserRole.create(null)).toThrowError();
  });

  // Priority and hierarchy
  it('should have correct priority values from ROLE_HIERARCHY', () => {
    expect(ROLE_HIERARCHY.get('superadmin')).toBe(0);
    expect(ROLE_HIERARCHY.get('admin')).toBe(1);
    expect(ROLE_HIERARCHY.get('treasurer')).toBe(2);
    expect(ROLE_HIERARCHY.get('pastor')).toBe(3);
    expect(ROLE_HIERARCHY.get('staff')).toBe(4);
  });

  it('should determine isMorePrivilegedThan correctly', () => {
    const superadmin = UserRole.create('superadmin');
    const admin = UserRole.create('admin');
    const staff = UserRole.create('staff');

    expect(superadmin.isMorePrivilegedThan(admin)).toBe(true);
    expect(admin.isMorePrivilegedThan(staff)).toBe(true);
    expect(superadmin.isMorePrivilegedThan(staff)).toBe(true);
    expect(admin.isMorePrivilegedThan(superadmin)).toBe(false);
    expect(staff.isMorePrivilegedThan(admin)).toBe(false);
  });

  // toString and fromPriority
  it('should toString correctly', () => {
    const role = UserRole.create('admin');
    expect(role.toString()).toBe('admin');
  });

  it('should return null for invalid priority', () => {
    expect(UserRole.fromPriority(-1)).toBeNull();
    expect(UserRole.fromPriority(5)).toBeNull();
  });

  it('should convert priority to role correctly', () => {
    expect(UserRole.fromPriority(0)).toBe('superadmin');
    expect(UserRole.fromPriority(1)).toBe('admin');
    expect(UserRole.fromPriority(2)).toBe('treasurer');
    expect(UserRole.fromPriority(3)).toBe('pastor');
    expect(UserRole.fromPriority(4)).toBe('staff');
  });

  // ADMIN_CREATEABLE_ROLES
  it('should contain valid admin-creatable roles', () => {
    expect(ADMIN_CREATEABLE_ROLES.has('treasurer')).toBe(true);
    expect(ADMIN_CREATEABLE_ROLES.has('pastor')).toBe(true);
    expect(ADMIN_CREATEABLE_ROLES.has('staff')).toBe(true);
    expect(ADMIN_CREATEABLE_ROLES.has('superadmin')).toBe(false);
    expect(ADMIN_CREATEABLE_ROLES.has('admin')).toBe(false);
  });
});
