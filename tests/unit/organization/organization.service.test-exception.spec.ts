/**
 * OrganizationService Unit Tests — Exception/Fail Cases
 *
 * Tests error handling and failure scenarios for OrganizationService operations.
 * @traceability DOC-012 BR-ORG-001 through BR-ORG-006
 */

import { OrganizationService, OrganizationNotFoundError, OrgUnitNotFoundError } from '@/domains/organization/application/organization.service';
import { IOrganizationRepository, IOrgUnitRepository } from '@/domains/organization/ports/repository.port';
import { IEventPublicationPort } from '@/domains/organization/ports/event-pub.port';
import { IAuthorizationPort } from '@/domains/organization/ports/auth.port';
import { IClockPort } from '@/domains/organization/ports/clock.port';
import { IUuidPort } from '@/domains/organization/ports/uuid.port';
import { IAuditPort } from '@/domains/organization/ports/audit.port';
import { Organization } from '@/domains/organization/domain/organization.entity';
import { OrganizationName } from '@/domains/organization/domain/value-objects/organization-name.vo';
import { OrganizationStatus as OrgStatus } from '@/domains/organization/domain/value-objects/organization-status.vo';
import { OrganizationType } from '@/domains/organization/domain/value-objects/organization-type.vo';

describe('OrganizationService — Exception Cases', () => {
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
      shortName: undefined,
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

  // ======================================================================
  // handleCreateOrganization — Exceptions
  // ======================================================================
  describe('handleCreateOrganization — Exception Cases', () => {
    it('should reject an invalid organization type', async () => {
      await expect(
        service.handleCreateOrganization({ name: 'Test Org', type: 'alien' }, 'user-1'),
      ).rejects.toThrow(/Invalid organization type/);
      expect(orgRepo.save).not.toHaveBeenCalled();
    });

    it('should reject an empty name', async () => {
      await expect(
        service.handleCreateOrganization({ name: '', type: 'church' }, 'user-1'),
      ).rejects.toThrow(/Organization name/);
    });
  });

  // ======================================================================
  // handleUpdateSettings — Exceptions
  // ======================================================================
  describe('handleUpdateSettings — Exception Cases', () => {
    it('should throw OrganizationNotFoundError when organization is missing', async () => {
      orgRepo.findById.mockResolvedValue(null);

      await expect(
        service.handleUpdateSettings({ organizationId: 'non-existent', settings: {} }, 'org-1', 'user-1'),
      ).rejects.toThrow(OrganizationNotFoundError);
    });

    it('should throw when organization is suspended', async () => {
      orgRepo.findById.mockResolvedValue({ organization: makeOrg({ status: OrgStatus.Suspended }) });

      await expect(
        service.handleUpdateSettings({ organizationId: 'org-1', settings: {} }, 'org-1', 'user-1'),
      ).rejects.toThrow(/is suspended\. Write operations are not allowed/);
    });

    it('should throw when organization is archived', async () => {
      orgRepo.findById.mockResolvedValue({ organization: makeOrg({ status: OrgStatus.Archived }) });

      await expect(
        service.handleUpdateSettings({ organizationId: 'org-1', settings: {} }, 'org-1', 'user-1'),
      ).rejects.toThrow(/is archived\. No writes allowed/);
    });
  });

  // ======================================================================
  // handleCreateOrgUnit — Exceptions
  // ======================================================================
  describe('handleCreateOrgUnit — Exception Cases', () => {
    it('should throw OrgUnitNotFoundError when parent is missing', async () => {
      unitRepo.findById.mockResolvedValue(null);

      await expect(
        service.handleCreateOrgUnit({ parentId: 'non-existent', name: 'Test', type: 'department' }, 'org-1', 'user-1'),
      ).rejects.toThrow(OrgUnitNotFoundError);
    });

    it('should throw when parent is at max depth', async () => {
      unitRepo.findById.mockResolvedValue({
        id: 'deep-parent',
        orgId: 'org-1',
        depthLevel: 5,
      } as any);

      await expect(
        service.handleCreateOrgUnit({ parentId: 'deep-parent', name: 'Test', type: 'department' }, 'org-1', 'user-1'),
      ).rejects.toThrow(/Cannot create child under unit at depth 5/);
    });
  });

  // ======================================================================
  // handleUpdateOrgUnitParent — Exceptions
  // ======================================================================
  describe('handleUpdateOrgUnitParent — Exception Cases', () => {
    it('should throw OrgUnitNotFoundError when unit is missing', async () => {
      unitRepo.findById.mockResolvedValue(null);

      await expect(
        service.handleUpdateOrgUnitParent({ unitId: 'non-existent', newParentId: null }, 'org-1', 'user-1'),
      ).rejects.toThrow(OrgUnitNotFoundError);
    });
  });

  // ======================================================================
  // handleMergeOrganizations — Exceptions
  // ======================================================================
  describe('handleMergeOrganizations — Exception Cases', () => {
    it('should throw when user is not superadmin', async () => {
      authorizer.hasRole.mockResolvedValue(false);

      await expect(
        service.handleMergeOrganizations({ sourceOrgId: 'org-1', targetOrgId: 'org-2' }, 'admin-1'),
      ).rejects.toThrow(/Merge requires superadmin validation/);
    });

    it('should throw when source org not found', async () => {
      authorizer.hasRole.mockResolvedValue(true);
      orgRepo.findByOrgId.mockResolvedValue(null);

      await expect(
        service.handleMergeOrganizations({ sourceOrgId: 'missing', targetOrgId: 'target' }, 'superadmin-1'),
      ).rejects.toThrow(OrganizationNotFoundError);
    });

    it('should throw when target org not found', async () => {
      authorizer.hasRole.mockResolvedValue(true);
      orgRepo.findByOrgId.mockImplementation(async (orgId) => (orgId === 'source' ? makeOrg() : null));

      await expect(
        service.handleMergeOrganizations({ sourceOrgId: 'source', targetOrgId: 'missing' }, 'superadmin-1'),
      ).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  // ======================================================================
  // handleGetOrganizationProfile — Exceptions
  // ======================================================================
  describe('handleGetOrganizationProfile — Exception Cases', () => {
    it('should throw OrganizationNotFoundError for unknown org', async () => {
      orgRepo.findById.mockResolvedValue(null);

      await expect(service.handleGetOrganizationProfile('non-existent', 'org-1')).rejects.toThrow(OrganizationNotFoundError);
    });
  });
});
