/**
 * PermissionResolver Tests
 *
 * Tests permission resolution and RBAC hierarchy rules against the canonical API.
 * @traceability DOC-012 BR-ID-006, PermissionResolver domain service
 */

import { PermissionResolver } from '@/domains/user/domain/services/permission-resolver';
import { PermissionGrant } from '@/domains/user/domain/value-objects/permission-grant';
import { UserRole } from '@/domains/user/domain/value-objects/user-role';

describe('PermissionResolver', () => {
  let resolver: PermissionResolver;

  beforeEach(() => {
    resolver = new PermissionResolver();
  });

  // ======================================================================
  // resolvePermissions
  // ======================================================================
  describe('resolvePermissions', () => {
    it('should return a full wildcard grant for superadmin', () => {
      const grants = resolver.resolvePermissions(UserRole.create('superadmin'));
      expect(grants).toHaveLength(1);
      expect(grants[0].isFullWildcard()).toBe(true);
      expect(grants[0].toString()).toBe('*:*:*');
    });

    it('should resolve admin role manifest permissions', () => {
      const grants = resolver.resolvePermissions(UserRole.create('admin'));
      const strings = grants.map((g) => g.toString());
      expect(strings).toContain('finance:read:*');
      expect(strings).toContain('finance:write:*');
      expect(strings).toContain('user:create:*');
      expect(strings).not.toContain('*:*:*');
    });

    it('should resolve staff role manifest permissions', () => {
      const grants = resolver.resolvePermissions(UserRole.create('staff'));
      const strings = grants.map((g) => g.toString());
      expect(strings).toContain('finance:read:*');
      expect(strings).toContain('event:read:*');
      expect(strings).not.toContain('finance:write:*');
    });

    it('should return empty grants for unknown role string', () => {
      const role = { toString: () => 'unknown-role' } as unknown as UserRole;
      expect(resolver.resolvePermissions(role)).toEqual([]);
    });
  });

  // ======================================================================
  // hasPermission
  // ======================================================================
  describe('hasPermission', () => {
    it('should allow superadmin for any resource/action/level', () => {
      const superadmin = UserRole.create('superadmin');
      expect(resolver.hasPermission(superadmin, 'transaction', 'create', 'high')).toBe(true);
      expect(resolver.hasPermission(superadmin, 'anything', 'anything', '*')).toBe(true);
    });

    it('should allow admin finance read but not write by staff', () => {
      const admin = UserRole.create('admin');
      const staff = UserRole.create('staff');
      expect(resolver.hasPermission(admin, 'finance', 'read', '*')).toBe(true);
      expect(resolver.hasPermission(admin, 'finance', 'write', '*')).toBe(true);
      expect(resolver.hasPermission(staff, 'finance', 'read', '*')).toBe(true);
      expect(resolver.hasPermission(staff, 'finance', 'write', '*')).toBe(false);
    });

    it('should deny permission not present in the role manifest', () => {
      const pastor = UserRole.create('pastor');
      expect(resolver.hasPermission(pastor, 'settings', 'manage', '*')).toBe(false);
    });
  });

  // ======================================================================
  // canCreateRole
  // ======================================================================
  describe('canCreateRole', () => {
    it('should let superadmin create any role', () => {
      const superadmin = UserRole.create('superadmin');
      expect(resolver.canCreateRole(superadmin, 'superadmin')).toBe(true);
      expect(resolver.canCreateRole(superadmin, 'admin')).toBe(true);
      expect(resolver.canCreateRole(superadmin, 'staff')).toBe(true);
    });

    it('should let admin create treasurer, pastor and staff', () => {
      const admin = UserRole.create('admin');
      expect(resolver.canCreateRole(admin, 'treasurer')).toBe(true);
      expect(resolver.canCreateRole(admin, 'pastor')).toBe(true);
      expect(resolver.canCreateRole(admin, 'staff')).toBe(true);
    });

    it('should prevent admin from creating superadmin (BR-ID-005)', () => {
      const admin = UserRole.create('admin');
      expect(resolver.canCreateRole(admin, 'superadmin')).toBe(false);
      expect(resolver.canCreateRole(admin, 'admin')).toBe(false);
    });

    it('should prevent staff from creating roles', () => {
      const staff = UserRole.create('staff');
      expect(resolver.canCreateRole(staff, 'treasurer')).toBe(false);
    });
  });

  // ======================================================================
  // hasHigherOrEqualPrivilege
  // ======================================================================
  describe('hasHigherOrEqualPrivilege', () => {
    it('should rank superadmin above admin', () => {
      const superadmin = UserRole.create('superadmin');
      const admin = UserRole.create('admin');
      expect(resolver.hasHigherOrEqualPrivilege(superadmin, admin)).toBe(true);
      expect(resolver.hasHigherOrEqualPrivilege(admin, superadmin)).toBe(false);
    });

    it('should treat equal roles as having equal privilege', () => {
      const admin1 = UserRole.create('admin');
      const admin2 = UserRole.create('admin');
      expect(resolver.hasHigherOrEqualPrivilege(admin1, admin2)).toBe(true);
    });

    it('should rank treasurer above staff', () => {
      const treasurer = UserRole.create('treasurer');
      const staff = UserRole.create('staff');
      expect(resolver.hasHigherOrEqualPrivilege(treasurer, staff)).toBe(true);
      expect(resolver.hasHigherOrEqualPrivilege(staff, treasurer)).toBe(false);
    });
  });

  // ======================================================================
  // PermissionGrant value object behavior
  // ======================================================================
  describe('PermissionGrant', () => {
    it('should parse resource:action:level format', () => {
      const grant = PermissionGrant.create('finance:read:high');
      expect(grant.resource).toBe('finance');
      expect(grant.action).toBe('read');
      expect(grant.level).toBe('high');
    });

    it('should match wildcard resource', () => {
      const grant = PermissionGrant.create('*:read:*');
      expect(grant.matches('finance', 'read', 'low')).toBe(true);
      expect(grant.matches('transaction', 'read', 'low')).toBe(true);
    });

    it('should match exact grant only', () => {
      const grant = PermissionGrant.create('transaction:create:*');
      expect(grant.matches('transaction', 'create', 'high')).toBe(true);
      expect(grant.matches('transaction', 'read', 'high')).toBe(false);
    });

    it('should reject malformed permission strings', () => {
      expect(() => PermissionGrant.create('malformed')).toThrow();
      expect(() => PermissionGrant.create('a:b')).toThrow();
    });
  });
});
