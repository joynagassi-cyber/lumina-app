/**
 * VisibilityPolicy Tests
 *
 * Tests multi-tenant isolation and visibility rules for organization data.
 * @traceability DOC-012 NB-MT-001, NB-MT-002, NB-MT-003
 */

import { VisibilityPolicy, TenantIsolationError } from '@/domains/organization/domain/policies/visibility-policy';
import { Organization } from '@/domains/organization/domain/organization.entity';
import { OrgUnit } from '@/domains/organization/domain/org-unit.entity';

describe('VisibilityPolicy', () => {
  describe('verifyEntityOrg', () => {
    it('should allow when entityOrgId matches requestOrgId', () => {
      // Arrange
      const entityOrgId = 'org-1';
      const requestOrgId = 'org-1';

      // Act - Should not throw
      expect(() => VisibilityPolicy.verifyEntityOrg(entityOrgId, requestOrgId)).not.toThrow();
    });

    it('should reject when entityOrgId differs from requestOrgId', () => {
      // Arrange
      const entityOrgId = 'org-1';
      const requestOrgId = 'org-2';

      // Act & Assert - Should throw TenantIsolationError
      expect(() => VisibilityPolicy.verifyEntityOrg(entityOrgId, requestOrgId)).toThrow(TenantIsolationError);
      expect(() => VisibilityPolicy.verifyEntityOrg(entityOrgId, requestOrgId)).toThrow(
        `Entity org 'org-1' != request org 'org-2'`,
      );
    });
  });

  describe('verifyOrganization', () => {
    it('should allow when organization belongs to request org', () => {
      // Arrange
      const org = new Organization({
        id: 'org-id-1',
        orgId: 'org-1',
        name: { value: 'Test Org' },
        shortName: undefined,
        type: 'church',
        status: 'active',
        currencyCode: 'USD',
        timezone: 'UTC',
        language: 'fr',
        accentColor: '#4F46E5',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      });
      const requestOrgId = 'org-1';

      // Act - Should not throw
      expect(() => VisibilityPolicy.verifyOrganization(org, requestOrgId)).not.toThrow();
    });

    it('should reject when organization belongs to different org', () => {
      // Arrange
      const org = new Organization({
        id: 'org-id-1',
        orgId: 'org-2',
        name: { value: 'Test Org' },
        shortName: undefined,
        type: 'church',
        status: 'active',
        currencyCode: 'USD',
        timezone: 'UTC',
        language: 'fr',
        accentColor: '#4F46E5',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      });
      const requestOrgId = 'org-1';

      // Act & Assert - Should throw TenantIsolationError
      expect(() => VisibilityPolicy.verifyOrganization(org, requestOrgId)).toThrow(TenantIsolationError);
    });
  });

  describe('verifyOrgUnit', () => {
    it('should allow when org unit belongs to request org', () => {
      // Arrange
      const unit = {
        id: 'unit-1',
        orgId: 'org-1',
        parentId: null,
        name: 'Test Unit',
        type: 'department',
        depthLevel: 1,
        status: 'active',
        hierarchyPath: { toString: () => 'org-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      } as OrgUnit;
      const requestOrgId = 'org-1';

      // Act - Should not throw
      expect(() => VisibilityPolicy.verifyOrgUnit(unit, requestOrgId)).not.toThrow();
    });

    it('should reject when org unit belongs to different org', () => {
      // Arrange
      const unit = {
        id: 'unit-1',
        orgId: 'org-2',
        parentId: null,
        name: 'Test Unit',
        type: 'department',
        depthLevel: 1,
        status: 'active',
        hierarchyPath: { toString: () => 'org-2' },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      } as OrgUnit;
      const requestOrgId = 'org-1';

      // Act & Assert - Should throw TenantIsolationError
      expect(() => VisibilityPolicy.verifyOrgUnit(unit, requestOrgId)).toThrow(TenantIsolationError);
    });
  });

  describe('filterByOrg', () => {
    it('should filter items to match requestOrgId', () => {
      // Arrange
      const items = [
        { id: '1', orgId: 'org-1', name: 'Item 1' },
        { id: '2', orgId: 'org-2', name: 'Item 2' },
        { id: '3', orgId: 'org-1', name: 'Item 3' },
      ] as Array<{ id: string; orgId: string; name: string }>;
      const requestOrgId = 'org-1';

      // Act
      const result = VisibilityPolicy.filterByOrg(items, requestOrgId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([
        { id: '1', orgId: 'org-1', name: 'Item 1' },
        { id: '3', orgId: 'org-1', name: 'Item 3' },
      ]));
    });

    it('should return empty array when no items match requestOrgId', () => {
      // Arrange
      const items = [
        { id: '1', orgId: 'org-2', name: 'Item 1' },
        { id: '2', orgId: 'org-3', name: 'Item 2' },
      ] as Array<{ id: string; orgId: string; name: string }>;
      const requestOrgId = 'org-1';

      // Act
      const result = VisibilityPolicy.filterByOrg(items, requestOrgId);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should return empty array when input is empty', () => {
      // Arrange
      const items = [] as Array<{ id: string; orgId: string; name: string }>;
      const requestOrgId = 'org-1';

      // Act
      const result = VisibilityPolicy.filterByOrg(items, requestOrgId);

      // Assert
      expect(result).toHaveLength(0);
    });
  });
});
