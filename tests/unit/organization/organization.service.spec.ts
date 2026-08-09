/**
 * OrganizationService Unit Tests — Positive Cases
 *
 * Tests all 10 operations of the canonical OrganizationService
 * (7 commands + 2 queries + transfer helper).
 * @traceability DOC-012 ASS-001 Service 1, API-CONTRACT-001
 */

import { OrganizationService, OrganizationNotFoundError, OrgUnitNotFoundError } from '@/domains/organization/application/organization.service';
import { IOrganizationRepository, IOrgUnitRepository } from '@/domains/organization/ports/repository.port';
import { IEventPublicationPort } from '@/domains/organization/ports/event-pub.port';
import { IAuthorizationPort } from '@/domains/organization/ports/auth.port';
import { IClockPort } from '@/domains/organization/ports/clock.port';
import { IUuidPort } from '@/domains/organization/ports/uuid.port';
import { IAuditPort } from '@/domains/organization/ports/audit.port';
import { Organization } from '@/domains/organization/domain/organization.entity';
import { OrgUnit } from '@/domains/organization/domain/org-unit.entity';
import { OrganizationName } from '@/domains/organization/domain/value-objects/organization-name.vo';
import { OrganizationStatus as OrgStatus } from '@/domains/organization/domain/value-objects/organization-status.vo';
import { OrganizationType } from '@/domains/organization/domain/value-objects/organization-type.vo';
import { OrgUnitHierarchy } from '@/domains/organization/domain/value-objects/org-unit-hierarchy.vo';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let orgRepo: jest.Mocked<IOrganizationRepository>;
  let unitRepo: jest.Mocked<IOrgUnitRepository>;
  let eventBus: jest.Mocked<IEventPublicationPort>;
  let authorizer: jest.Mocked<IAuthorizationPort>;
  let clock: jest.Mocked<IClockPort>;
  let uuid: jest.Mocked<IUuidPort>;
  let audit: jest.Mocked<IAuditPort>;

  const NOW = new Date('2026-07-27T00:00:00Z');

  beforeEach(() => {
    orgRepo = {
      findById: jest.fn(),
      findByOrgId: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;
    unitRepo = {
      findById: jest.fn(),
      findByParentId: jest.fn(),
      findAllInOrg: jest.fn(),
      findDescendants: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;
    eventBus = {
      publish: jest.fn(),
      publishMany: jest.fn(),
    } as any;
    authorizer = {
      hasRole: jest.fn(),
      hasRoleHierarchy: jest.fn(),
      hasPermission: jest.fn(),
    } as any;
    clock = { now: jest.fn() } as any;
    uuid = { generate: jest.fn() } as any;
    audit = { log: jest.fn() } as any;

    clock.now.mockReturnValue(NOW);

    service = new OrganizationService(orgRepo, unitRepo, eventBus, authorizer, clock, uuid, audit);
  });

  function makeOrg(overrides: Partial<ConstructorParameters<typeof Organization>[0]> = {}): Organization {
    return new Organization({
      id: 'org-id-1',
      orgId: 'org-1',
      name: new OrganizationName('Test Org'),
      shortName: 'TestOrg',
      type: OrganizationType.Church,
      status: OrgStatus.Active,
      currencyCode: 'USD',
      timezone: 'UTC',
      language: 'fr',
      accentColor: '#4F46E5',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      ...overrides,
    });
  }

  function makeUnit(overrides: Partial<ConstructorParameters<typeof OrgUnit>[0]> = {}): OrgUnit {
    return new OrgUnit({
      id: 'unit-1',
      orgId: 'org-1',
      parentId: null,
      name: 'Unit 1',
      type: 'department' as any,
      depthLevel: 1,
      status: 'active' as any,
      hierarchyPath: new OrgUnitHierarchy('org-1'),
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      ...overrides,
    });
  }

  // ======================================================================
  // COMMAND 1: handleCreateOrganization
  // ======================================================================
  describe('handleCreateOrganization', () => {
    it('should create organization with inherited defaults (positive)', async () => {
      // Arrange
      uuid.generate.mockReturnValueOnce('organization-id-1').mockReturnValueOnce('org-id-1');

      const input = {
        name: 'Test Organization',
        shortName: 'TestOrg',
        type: 'church',
        currencyCode: 'USD',
        timezone: 'UTC',
        language: 'fr',
        accentColor: '#4F46E5',
      };

      // Act
      await service.handleCreateOrganization(input, 'superadmin-1');

      // Assert
      expect(orgRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'organization-id-1',
          orgId: 'org-id-1',
          name: expect.any(OrganizationName),
          type: OrganizationType.Church,
          status: OrgStatus.Active,
          version: 1,
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrganizationCreated' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', userId: 'superadmin-1' }),
      );
    });

    it('should reject invalid organization type', async () => {
      await expect(
        service.handleCreateOrganization({ name: 'Test Org', type: 'not-a-type' }, 'user-1'),
      ).rejects.toThrow(/Invalid organization type/);
      expect(orgRepo.save).not.toHaveBeenCalled();
    });

    it('should reject empty organization name', async () => {
      await expect(
        service.handleCreateOrganization({ name: '   ', type: 'church' }, 'user-1'),
      ).rejects.toThrow(/Organization name/);
    });
  });

  // ======================================================================
  // COMMAND 2: handleUpdateSettings
  // ======================================================================
  describe('handleUpdateSettings', () => {
    it('should update organization settings successfully (positive)', async () => {
      // Arrange
      orgRepo.findById.mockResolvedValue({ organization: makeOrg() });

      // Act
      await service.handleUpdateSettings(
        { organizationId: 'org-1', settings: { accentColor: '#FF5722' } },
        'org-1',
        'admin-1',
      );

      // Assert
      expect(orgRepo.update).toHaveBeenCalledWith(expect.any(Organization));
      expect(eventBus.publish).not.toHaveBeenCalled(); // No event on update settings
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'update', userId: 'admin-1' }));
    });

    it('should reject when organization is suspended', async () => {
      orgRepo.findById.mockResolvedValue({ organization: makeOrg({ status: OrgStatus.Suspended }) });

      await expect(
        service.handleUpdateSettings({ organizationId: 'org-1', settings: {} }, 'org-1', 'user-1'),
      ).rejects.toThrow(/Organization 'org-id-1' is suspended\. Write operations are not allowed/);
    });

    it('should reject when organization is archived', async () => {
      orgRepo.findById.mockResolvedValue({ organization: makeOrg({ status: OrgStatus.Archived }) });

      await expect(
        service.handleUpdateSettings({ organizationId: 'org-1', settings: {} }, 'org-1', 'user-1'),
      ).rejects.toThrow(/Organization 'org-id-1' is archived\. No writes allowed/);
    });

    it('should validate accent color format (hex #XXXXXX)', async () => {
      orgRepo.findById.mockResolvedValue({ organization: makeOrg() });

      await expect(
        service.handleUpdateSettings({ organizationId: 'org-1', settings: { accentColor: 'not-a-color' } }, 'org-1', 'user-1'),
      ).rejects.toThrow(/Invalid accent color format/);
    });

    it('should throw OrganizationNotFoundError when org is missing', async () => {
      orgRepo.findById.mockResolvedValue(null);

      await expect(
        service.handleUpdateSettings({ organizationId: 'non-existent', settings: {} }, 'org-1', 'user-1'),
      ).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  // ======================================================================
  // COMMAND 3: handleCreateOrgUnit
  // ======================================================================
  describe('handleCreateOrgUnit', () => {
    it('should create top-level org unit successfully (positive)', async () => {
      uuid.generate.mockReturnValue('unit-1');

      await service.handleCreateOrgUnit(
        { parentId: null, name: 'Main Unit', type: 'department' },
        'org-1',
        'user-1',
      );

      expect(unitRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'unit-1',
          orgId: 'org-1',
          parentId: null,
          name: 'Main Unit',
          depthLevel: 1,
        }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrgUnitCreated' }),
      );
    });

    it('should create child org unit under parent successfully (positive)', async () => {
      uuid.generate.mockReturnValue('unit-2');
      const parent = makeUnit({ id: 'parent-1', depthLevel: 1 });
      unitRepo.findById.mockResolvedValue(parent);

      await service.handleCreateOrgUnit(
        { parentId: 'parent-1', name: 'Child Unit', type: 'group' },
        'org-1',
        'user-1',
      );

      expect(unitRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          depthLevel: 2,
          hierarchyPath: expect.any(Object),
        }),
      );
    });

    it('should reject when parent unit not found', async () => {
      unitRepo.findById.mockResolvedValue(null);

      await expect(
        service.handleCreateOrgUnit({ parentId: 'non-existent', name: 'Test', type: 'department' }, 'org-1', 'user-1'),
      ).rejects.toThrow(OrgUnitNotFoundError);
    });

    it('should validate depth before creating child', async () => {
      const deepParent = makeUnit({ id: 'parent-1', depthLevel: 5 });
      unitRepo.findById.mockResolvedValue(deepParent);

      await expect(
        service.handleCreateOrgUnit({ parentId: 'parent-1', name: 'Test', type: 'department' }, 'org-1', 'user-1'),
      ).rejects.toThrow(/Cannot create child under unit at depth 5/);
    });
  });

  // ======================================================================
  // COMMAND 4: handleUpdateOrgUnitParent
  // ======================================================================
  describe('handleUpdateOrgUnitParent', () => {
    it('should change org unit parent to top level (positive)', async () => {
      // Arrange
      const unit = makeUnit({ parentId: 'parent-1', depthLevel: 2, hierarchyPath: new OrgUnitHierarchy('org-1/parent-1') });
      const parent = makeUnit({ id: 'parent-1', depthLevel: 1 });
      unitRepo.findById.mockResolvedValue(unit);
      unitRepo.findAllInOrg.mockResolvedValue([unit, parent]);

      // Act
      await service.handleUpdateOrgUnitParent(
        { unitId: 'unit-1', newParentId: null },
        'org-1',
        'user-1',
      );

      // Assert
      expect(unitRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null, depthLevel: 1 }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrgUnitParentChanged' }),
      );
    });

    it('should reject when unit not found', async () => {
      unitRepo.findById.mockResolvedValue(null);

      await expect(
        service.handleUpdateOrgUnitParent({ unitId: 'non-existent', newParentId: 'parent-1' }, 'org-1', 'user-1'),
      ).rejects.toThrow(OrgUnitNotFoundError);
    });
  });

  // ======================================================================
  // COMMAND 5: handleTransferChildOrg (delegates to reparenting)
  // ======================================================================
  describe('handleTransferChildOrg', () => {
    it('should delegate to parent update logic (positive)', async () => {
      const unit = makeUnit({ parentId: 'parent-1', depthLevel: 2, hierarchyPath: new OrgUnitHierarchy('org-1/parent-1') });
      const parent = makeUnit({ id: 'parent-1', depthLevel: 1 });
      unitRepo.findById.mockResolvedValue(unit);
      unitRepo.findAllInOrg.mockResolvedValue([unit, parent]);

      await service.handleTransferChildOrg('unit-1', null, 'org-1', 'user-1');

      expect(unitRepo.update).toHaveBeenCalledWith(expect.objectContaining({ parentId: null }));
    });
  });

  // ======================================================================
  // COMMAND 6: handleMergeOrganizations
  // ======================================================================
  describe('handleMergeOrganizations', () => {
    it('should merge two organizations when user is superadmin (positive)', async () => {
      // Arrange
      authorizer.hasRole.mockResolvedValue(true);
      const source = makeOrg({ id: 'org-id-1', orgId: 'source-org-1' });
      const target = makeOrg({ id: 'org-id-2', orgId: 'target-org-1' });
      orgRepo.findByOrgId.mockImplementation(async (orgId) => (orgId === 'source-org-1' ? source : target));

      // Act
      await service.handleMergeOrganizations({ sourceOrgId: 'source-org-1', targetOrgId: 'target-org-1' }, 'superadmin-1');

      // Assert
      expect(orgRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrgStatus.Archived }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrgMerged' }),
      );
    });

    it('should reject merge when user is not superadmin (BR-ORG-005)', async () => {
      authorizer.hasRole.mockResolvedValue(false);

      await expect(
        service.handleMergeOrganizations({ sourceOrgId: 'org-1', targetOrgId: 'org-2' }, 'admin-1'),
      ).rejects.toThrow(/Merge requires superadmin validation/);
    });

    it('should reject when source org not found', async () => {
      authorizer.hasRole.mockResolvedValue(true);
      orgRepo.findByOrgId.mockResolvedValue(null);

      await expect(
        service.handleMergeOrganizations({ sourceOrgId: 'missing', targetOrgId: 'target' }, 'superadmin-1'),
      ).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  // ======================================================================
  // COMMAND 7: handleArchiveOrganization
  // ======================================================================
  describe('handleArchiveOrganization', () => {
    it('should archive organization successfully (positive)', async () => {
      orgRepo.findById.mockResolvedValue({ organization: makeOrg() });

      await service.handleArchiveOrganization({ organizationId: 'org-1' }, 'org-1', 'admin-1');

      expect(orgRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrgStatus.Archived, version: 2 }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrganizationArchived' }),
      );
    });
  });

  // ======================================================================
  // COMMAND 8: handleSuspendOrganization
  // ======================================================================
  describe('handleSuspendOrganization', () => {
    it('should suspend organization successfully (positive)', async () => {
      orgRepo.findById.mockResolvedValue({ organization: makeOrg() });

      await service.handleSuspendOrganization({ organizationId: 'org-1' }, 'org-1', 'admin-1');

      expect(orgRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrgStatus.Suspended, version: 2 }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrganizationSuspended' }),
      );
    });
  });

  // ======================================================================
  // QUERY 9: handleGetOrganizationProfile
  // ======================================================================
  describe('handleGetOrganizationProfile', () => {
    it('should return organization profile successfully (positive)', async () => {
      orgRepo.findById.mockResolvedValue({ organization: makeOrg() });

      const result = await service.handleGetOrganizationProfile('org-1', 'org-1');

      expect(result).toEqual(expect.objectContaining({
        id: 'org-id-1',
        orgId: 'org-1',
        name: 'Test Org',
        shortName: 'TestOrg',
        type: 'church',
        status: 'active',
        currencyCode: 'USD',
        version: 1,
      }));
    });

    it('should throw when organization not found', async () => {
      orgRepo.findById.mockResolvedValue(null);

      await expect(service.handleGetOrganizationProfile('non-existent', 'org-1')).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  // ======================================================================
  // QUERY 10: handleGetDescendantUnits
  // ======================================================================
  describe('handleGetDescendantUnits', () => {
    it('should return descendant units successfully (positive)', async () => {
      unitRepo.findDescendants.mockResolvedValue([
        makeUnit({ id: 'child-1', depthLevel: 2, hierarchyPath: new OrgUnitHierarchy('org-1/root-1/child-1') }),
        makeUnit({ id: 'grandchild-1', depthLevel: 3, hierarchyPath: new OrgUnitHierarchy('org-1/root-1/child-1/grandchild-1') }),
      ]);

      const result = await service.handleGetDescendantUnits({ rootUnitId: 'root-1' }, 'org-1');

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'child-1', depthLevel: 2 }),
        expect.objectContaining({ id: 'grandchild-1', depthLevel: 3 }),
      ]));
    });

    it('should return empty array when no descendants', async () => {
      unitRepo.findDescendants.mockResolvedValue([]);

      const result = await service.handleGetDescendantUnits({ rootUnitId: 'root-1' }, 'org-1');

      expect(result).toHaveLength(0);
    });
  });
});
