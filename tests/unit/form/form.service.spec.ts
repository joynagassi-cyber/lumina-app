/**
 * FormService Unit Tests — Positive Cases
 *
 * Tests form operations: CreateForm, PublishForm, SubmitFormData, GetFormDefinition,
 * RenderForm, ListFormsByOrg, ValidateSingleField.
 * @traceability DOC-012 ASS-001 FormService, BR-FRM-001 through BR-FRM-006
 */

import { FormService, FormNotFoundError, FormDuplicateKeyError, FormVersionConflictError } from '@/domains/form/application/form.service';
import { IFormRepository } from '@/domains/form/ports/form.port';
import { IEventPublicationPort } from '@/domains/form/ports/event-pub.port';
import { IAuthorizationPort } from '@/domains/form/ports/auth.port';
import { FormDefinition } from '@/domains/form/domain/entities/form-definition.entity';
import { FormVersion } from '@/domains/form/domain/value-objects/form-version.vo';

const NOW = new Date('2026-07-27T00:00:00Z');

// Mock implementations
class MockFormRepo implements IFormRepository {
  findByKeyAndVersion = jest.fn().mockResolvedValue(null);
  findById = jest.fn();
  listByOrg = jest.fn().mockResolvedValue([]);
  saveDefinition = jest.fn().mockResolvedValue(undefined);
  updateDefinition = jest.fn().mockResolvedValue(undefined);
  saveSections = jest.fn().mockResolvedValue(undefined);
  saveFields = jest.fn().mockResolvedValue(undefined);
  deleteByDefinitionId = jest.fn().mockResolvedValue(undefined);
}

class MockEventBus implements IEventPublicationPort {
  publish = jest.fn().mockResolvedValue(undefined);
}

class MockAuthorizer implements IAuthorizationPort {
  hasRole = jest.fn().mockResolvedValue(false);
  hasRoleHierarchy = jest.fn().mockResolvedValue(false);
  hasPermission = jest.fn().mockResolvedValue(false);
}

describe('FormService', () => {
  let service: FormService;
  let repoMock: MockFormRepo;
  let eventPubMock: MockEventBus;
  let authorizerMock: MockAuthorizer;

  beforeEach(() => {
    repoMock = new MockFormRepo();
    eventPubMock = new MockEventBus();
    authorizerMock = new MockAuthorizer();

    service = new FormService(
      repoMock as any,
      eventPubMock as any,
      authorizerMock as any,
      { now: jest.fn().mockReturnValue(NOW) } as any,
      { generate: jest.fn().mockReturnValue('uuid-123') } as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
    );
  });

  /** Helper: build a real FormDefinition entity. */
  function makeDefinition(overrides: Partial<ConstructorParameters<typeof FormDefinition>[0]> = {}): FormDefinition {
    return new FormDefinition({
      id: 'def-1',
      orgId: 'org-1',
      key: 'form1',
      modelRef: 'finance_transaction',
      version: new FormVersion('1.0'),
      isPublished: false,
      createdAt: NOW,
      updatedAt: NOW,
      sections: [],
      ...overrides,
    });
  }

  describe('handleCreateForm', () => {
    it('should create form definition successfully (positive)', async () => {
      const input = {
        key: 'registration-form',
        modelRef: 'member_application',
        version: '1.0',
        sections: [
          {
            id: 'sec1',
            titleFr: 'Personal Info',
            titleEn: 'Personal Info',
            order: 0,
            fields: [{ name: 'email', labelFr: 'Email', labelEn: 'Email', type: 'text', required: true }],
          },
        ],
      };

      await service.handleCreateForm(input, 'user-123', 'org-1');

      expect(repoMock.saveDefinition).toHaveBeenCalledWith(expect.any(FormDefinition));
      expect(repoMock.saveSections).toHaveBeenCalledWith(expect.any(Array));
      expect(repoMock.saveFields).toHaveBeenCalledWith(expect.any(Array));
      expect(eventPubMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'FormDefinitionCreated' }),
      );
    });

    it('should reject when form key already exists in org (duplicate)', async () => {
      repoMock.findByKeyAndVersion.mockResolvedValue({ definition: makeDefinition(), sections: [], fields: [] });

      await expect(
        service.handleCreateForm({ key: 'form1', modelRef: 'member_application', version: '1.0', sections: [] }, 'user-123', 'org-1'),
      ).rejects.toThrow(FormDuplicateKeyError);
      expect(repoMock.saveDefinition).not.toHaveBeenCalled();
    });

    it('should enforce first version must be 1.0', async () => {
      await expect(
        service.handleCreateForm({ key: 'form1', modelRef: 'member_application', version: '2.0', sections: [] }, 'user-123', 'org-1'),
      ).rejects.toThrow(FormVersionConflictError);
    });
  });

  describe('handlePublishForm', () => {
    it('should publish form definition (positive)', async () => {
      repoMock.findById.mockResolvedValue({ definition: makeDefinition(), sections: [], fields: [] });

      await service.handlePublishForm({ definitionId: 'def-1', requestOrgId: 'org-1' }, 'publisher-1');

      expect(repoMock.updateDefinition).toHaveBeenCalledWith(expect.any(FormDefinition));
      expect(eventPubMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'FormPublished' }),
      );
    });

    it('should throw FormNotFoundError when definition is missing', async () => {
      repoMock.findById.mockResolvedValue(null);

      await expect(
        service.handlePublishForm({ definitionId: 'missing', requestOrgId: 'org-1' }, 'publisher-1'),
      ).rejects.toThrow(FormNotFoundError);
    });
  });

  describe('handleSubmitForm', () => {
    it('should submit an empty (valid) form and publish FormSubmitted (positive)', async () => {
      repoMock.findById.mockResolvedValue({ definition: makeDefinition(), sections: [], fields: [] });

      const result = await service.handleSubmitForm({
        definitionId: 'def-1',
        requestOrgId: 'org-1',
        formData: {},
        targetModelId: null,
        submittedById: 'user-1',
      });

      expect(result.valid).toBe(true);
      expect(eventPubMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'FormSubmitted' }),
      );
    });
  });

  describe('handleGetFormDefinition', () => {
    it('should retrieve form definition profile (positive)', async () => {
      repoMock.findById.mockResolvedValue({
        definition: makeDefinition({ isPublished: true, publishedBy: 'admin-1', publishedAt: NOW }),
        sections: [],
        fields: [],
      });

      const result = await service.handleGetFormDefinition('def-1', 'org-1');

      expect(result.key).toBe('form1');
      expect(result.isPublished).toBe(true);
      expect(result.version).toBe('1.0');
    });
  });

  describe('handleRenderForm', () => {
    it('should render form definition schema (positive)', async () => {
      repoMock.findById.mockResolvedValue({ definition: makeDefinition(), sections: [], fields: [] });

      const result = await service.handleRenderForm('def-1', 'org-1', 'fr', {});

      expect(result).toBeTruthy();
      expect(result.key).toBe('form1');
      expect(result.sections).toEqual([]);
    });
  });

  describe('handleListFormsByOrg', () => {
    it('should list forms by organization (positive)', async () => {
      repoMock.listByOrg.mockResolvedValue([
        { id: 'f1', cleFormulaire: 'form1', referenceModele: 'member_application', versionSemantique: '1.0', estPublie: true, orgId: 'org-1' },
        { id: 'f2', cleFormulaire: 'form2', referenceModele: 'event_registration', versionSemantique: '1.0', estPublie: false, orgId: 'org-1' },
      ]);

      const result = await service.handleListFormsByOrg('org-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('handleValidateSingleField', () => {
    it('should return FIELD_NOT_FOUND for an unknown field', async () => {
      repoMock.findById.mockResolvedValue({ definition: makeDefinition(), sections: [], fields: [] });

      const result = await service.handleValidateSingleField('def-1', 'unknown-field', 'value', 'org-1');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('FIELD_NOT_FOUND');
    });
  });
});
