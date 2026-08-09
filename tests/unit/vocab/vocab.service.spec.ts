/**
 * VocabApplicationService Unit Tests
 *
 * Tests vocabulary operations: addTermValue, updateTermLabel, updateTermValueLabel,
 * deprecateTermValue, listTermsByNamespace, resolveTerm, searchTerms, getTermTranslation.
 * @traceability DOC-012 ASS-VOC VocabApplicationService, BR-VOC-001 through BR-VOC-004
 */

import { VocabApplicationService } from '@/domains/vocab/application/vocab.service';
import { TranslationMinimumPolicy } from '@/domains/vocab/domain/policies';
import { DeprecationManager } from '@/domains/vocab/domain/services/deprecation-manager.service';

describe('VocabApplicationService', () => {
  let service: VocabApplicationService;
  let namespaceRepo: any;
  let termRepo: any;
  let valueRepo: any;
  let termResolver: any;
  let namespaceBrowser: any;
  let eventHandler: jest.Mock;

  beforeEach(() => {
    namespaceRepo = { findById: jest.fn(), findByKey: jest.fn(), save: jest.fn() };
    termRepo = {
      findById: jest.fn(), findByKey: jest.fn(), findByNamespace: jest.fn(),
      findWithKeyword: jest.fn(), save: jest.fn(), updateLabels: jest.fn(), deprecate: jest.fn(),
    };
    valueRepo = {
      findById: jest.fn(), findByKey: jest.fn(), findByTerm: jest.fn(),
      save: jest.fn(), updateLabels: jest.fn(), deprecate: jest.fn(),
    };
    termResolver = { resolveTerm: jest.fn() };
    namespaceBrowser = { listTerms: jest.fn(), searchTerms: jest.fn() };
    eventHandler = jest.fn();

    service = new VocabApplicationService(
      namespaceRepo,
      termRepo,
      valueRepo,
      termResolver,
      namespaceBrowser,
      new DeprecationManager(),
      eventHandler,
    );
  });

  describe('addTermValue', () => {
    it('should add term value with bilingual labels (positive)', async () => {
      // Arrange - translation policy validation passes
      jest.spyOn(TranslationMinimumPolicy, 'validateValueLabels').mockImplementation(() => {});
      termRepo.findById.mockResolvedValue({ id: 't1', key: 'status' });
      valueRepo.save.mockResolvedValue(undefined);

      // Act
      await service.addTermValue({
        termId: 't1',
        orgId: 'org-1',
        key: 'active',
        labelFr: 'Actif',
        labelEn: 'Active',
        colorHex: '#FF0000',
      });

      // Assert
      expect(valueRepo.save).toHaveBeenCalled();
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'TermValueAdded' }),
      );
    });

    it('should throw when translation policy validation fails', async () => {
      // Arrange
      jest.spyOn(TranslationMinimumPolicy, 'validateValueLabels').mockImplementation(() => {
        throw new Error('Missing translation');
      });

      // Act & Assert
      await expect(
        service.addTermValue({ termId: 't1', orgId: 'org-1', key: 'active', labelFr: '', labelEn: 'Active' }),
      ).rejects.toThrow('Missing translation');
    });
  });

  describe('updateTermLabel', () => {
    it('should update term labels (positive)', async () => {
      // Arrange
      termRepo.findById.mockResolvedValue({ id: 't1', key: 'status' });
      termRepo.updateLabels.mockResolvedValue(1);

      // Act
      const result = await service.updateTermLabel('t1', { labelFr: 'Nouveau', labelEn: 'New' }, 'org-1');

      // Assert
      expect(result).toBe(1);
      expect(termRepo.updateLabels).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ labelFr: 'Nouveau', labelEn: 'New' }),
      );
    });

    it('should reject empty French label', async () => {
      // Arrange
      termRepo.findById.mockResolvedValue({ id: 't1' });

      // Act & Assert
      await expect(
        service.updateTermLabel('t1', { labelFr: '', labelEn: 'New' }, 'org-1'),
      ).rejects.toThrow('French label cannot be empty');
    });
  });

  describe('updateTermValueLabel', () => {
    it('should update term value labels (positive)', async () => {
      // Arrange
      valueRepo.findById.mockResolvedValue({ id: 'v1', termId: 't1' });
      valueRepo.updateLabels.mockResolvedValue(1);

      // Act
      const result = await service.updateTermValueLabel('v1', { labelFr: 'LibelleFR', labelEn: 'LabelEN' }, 'org-1');

      // Assert
      expect(result).toBe(1);
    });
  });

  describe('deprecateTermValue', () => {
    it('should deprecate a term value (positive)', async () => {
      // Arrange
      const value = {
        id: 'v1', termId: 't1', key: 'active',
        isDeprecated: false, deprecate: jest.fn(),
      };
      valueRepo.findById.mockResolvedValue(value);
      valueRepo.deprecate.mockResolvedValue(undefined);

      // Act
      await service.deprecateTermValue('v1', 'org-1');

      // Assert
      expect(value.deprecate).toHaveBeenCalled();
      expect(valueRepo.deprecate).toHaveBeenCalledWith('v1', expect.any(Date));
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'TermValueDeprecated' }),
      );
    });

    it('should throw if value not found', async () => {
      // Arrange
      valueRepo.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.deprecateTermValue('non-existent', 'org-1'),
      ).rejects.toThrow('not found');
    });
  });

  describe('listTermsByNamespace', () => {
    it('should list terms by namespace (positive)', async () => {
      // Arrange
      namespaceBrowser.listTerms.mockResolvedValue([
        { key: 'status', labelFr: 'Status', labelEn: 'Status', isDeprecated: false },
      ]);

      // Act
      const terms = await service.listTermsByNamespace('my-namespace');

      // Assert
      expect(terms).toHaveLength(1);
      expect(namespaceBrowser.listTerms).toHaveBeenCalledWith('my-namespace', false);
    });
  });

  describe('resolveTerm', () => {
    it('should resolve term label for locale (positive)', async () => {
      // Arrange
      termResolver.resolveTerm.mockResolvedValue('Active');

      // Act
      const label = await service.resolveTerm('my-namespace', 'status', 'en');

      // Assert
      expect(label).toBe('Active');
      expect(termResolver.resolveTerm).toHaveBeenCalledWith('my-namespace', 'status', 'en');
    });
  });

  describe('searchTerms', () => {
    it('should search terms by keyword (positive)', async () => {
      // Arrange
      namespaceBrowser.searchTerms.mockResolvedValue([]);

      // Act
      await service.searchTerms('status', 'fr');

      // Assert
      expect(namespaceBrowser.searchTerms).toHaveBeenCalledWith('status', 'fr');
    });
  });

  describe('getTermTranslation', () => {
    it('should get term translation for locale (positive)', async () => {
      // Arrange
      namespaceBrowser.listTerms.mockResolvedValue([
        { key: 'status', labelFr: 'Statut', labelEn: 'Status', isDeprecated: false },
      ]);

      // Act
      const result = await service.getTermTranslation('my-namespace', 'status', 'fr');

      // Assert
      expect(result).toEqual({
        key: 'status',
        label: 'Statut',
        isDeprecated: false,
      });
    });

    it('should return null when term not found', async () => {
      // Arrange
      namespaceBrowser.listTerms.mockResolvedValue([]);

      // Act
      const result = await service.getTermTranslation('my-namespace', 'unknown-key', 'fr');

      // Assert
      expect(result).toBeNull();
    });
  });
});
