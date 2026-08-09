/**
 * TranslationMinimumPolicy Tests
 *
 * Tests that all terms and values have both fr and en labels.
 * @traceability DOC-012 BR-VOC-002, TranslationMinimumPolicy
 */

import { TranslationMinimumPolicy, MissingRequiredTranslationError } from '@/domains/vocab/domain/policies/translation-minimum.policy';

describe('TranslationMinimumPolicy', () => {
  describe('validateTermLabels', () => {
    it('should accept valid labels (both fr and en present)', () => {
      expect(() => TranslationMinimumPolicy.validateTermLabels('Statut', 'Status')).not.toThrow();
      expect(() => TranslationMinimumPolicy.validateTermLabels('  Statut  ', '  Status  ')).not.toThrow(); // trim handles this
    });

    it('should throw when fr label is missing', () => {
      expect(() => TranslationMinimumPolicy.validateTermLabels('', 'Status')).toThrow(MissingRequiredTranslationError);
      expect(() => TranslationMinimumPolicy.validateTermLabels(null, 'Status')).toThrow(MissingRequiredTranslationError);
      expect(() => TranslationMinimumPolicy.validateTermLabels(undefined, 'Status')).toThrow(MissingRequiredTranslationError);
    });

    it('should throw when en label is missing', () => {
      expect(() => TranslationMinimumPolicy.validateTermLabels('Statut', '')).toThrow(MissingRequiredTranslationError);
      expect(() => TranslationMinimumPolicy.validateTermLabels('Statut', null)).toThrow(MissingRequiredTranslationError);
      expect(() => TranslationMinimumPolicy.validateTermLabels('Statut', undefined)).toThrow(MissingRequiredTranslationError);
    });

    it('should throw when both labels are missing', () => {
      expect(() => TranslationMinimumPolicy.validateTermLabels('', '')).toThrow(MissingRequiredTranslationError);
    });

    it('should throw when fr label is whitespace-only', () => {
      expect(() => TranslationMinimumPolicy.validateTermLabels('   ', 'Status')).toThrow(MissingRequiredTranslationError);
    });

    it('should include entity ID in error when provided', () => {
      try {
        TranslationMinimumPolicy.validateTermLabels('', 'Status', 'term-123');
      } catch (err) {
        expect(err).toBeInstanceOf(MissingRequiredTranslationError);
        expect((err as MissingRequiredTranslationError).message).toContain('term-123');
      }
    });
  });

  describe('validateValueLabels', () => {
    it('should work identically to validateTermLabels', () => {
      expect(() => TranslationMinimumPolicy.validateValueLabels('Label FR', 'Label EN')).not.toThrow();
      expect(() => TranslationMinimumPolicy.validateValueLabels('', 'Label EN')).toThrow(MissingRequiredTranslationError);
    });
  });

  describe('extractTranslations', () => {
    it('should return trimmed translations', () => {
      const result = TranslationMinimumPolicy.extractTranslations('  Label Fr  ', '  Label En  ');
      expect(result.labelFr).toBe('Label Fr');
      expect(result.labelEn).toBe('Label En');
    });
  });
});
