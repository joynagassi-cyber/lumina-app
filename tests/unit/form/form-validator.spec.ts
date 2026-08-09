/**
 * FormValidator Tests
 *
 * Tests server-side form validation matching client-side validation exactly.
 * @traceability DOC-012 BR-FRM-002, FormValidator
 */

import { FormValidator } from '@/domains/form/domain/services/form-validator.service';
import { FieldDef } from '@/domains/form/domain/value-objects/field-def.vo';

// Mock dependencies
class MockVocabPort {
  resolveVocabularyTerms = jest.fn().mockResolvedValue([]);
}

describe('FormValidator', () => {
  let validator: FormValidator;
  const mockPort = new MockVocabPort();

  beforeEach(() => {
    validator = new FormValidator(
      mockPort as any,
      { id: 'def-1', key: 'test-form', sections: [] } as any,
    );
  });

  /** Helper: build a real FieldDef for testing. */
  function makeField(overrides: Partial<ConstructorParameters<typeof FieldDef>[0]> = {}): FieldDef {
    return new FieldDef({
      name: 'field1',
      labelFr: 'Champ',
      labelEn: 'Field',
      type: 'text',
      ...overrides,
    });
  }

  describe('validateSingleField', () => {
    it('should validate required field empty', async () => {
      const field = makeField({ name: 'email', required: true });

      const errors = await validator.validateSingleField(field, '', {});

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toContain('REQUIRED_EMAIL');
    });

    it('should validate non-required field empty without error', async () => {
      const field = makeField({ name: 'email', required: false });

      const errors = await validator.validateSingleField(field, '', {});

      expect(errors).toHaveLength(0);
    });

    it('should validate text field pattern', async () => {
      const field = makeField({ name: 'phone', type: 'text', pattern: '^\\d{3}-\\d{3}-\\d{4}$' });

      const errors = await validator.validateSingleField(field, '123-456-7890', {});

      expect(errors).toHaveLength(0);
    });

    it('should validate text field pattern mismatch', async () => {
      const field = makeField({ name: 'phone', type: 'text', pattern: '^\\d{3}-\\d{3}-\\d{4}$' });

      const errors = await validator.validateSingleField(field, 'invalid', {});

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toContain('PATTERN_PHONE');
    });

    it('should validate number field min', async () => {
      const field = makeField({ name: 'age', type: 'number', min: 18 });

      const errors = await validator.validateSingleField(field, 15, {});

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toContain('MIN_VALUE_AGE');
    });

    it('should validate number field max', async () => {
      const field = makeField({ name: 'quantity', type: 'number', max: 100 });

      const errors = await validator.validateSingleField(field, 150, {});

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toContain('MAX_VALUE_QUANTITY');
    });

    it('should validate date field', async () => {
      const field = makeField({ name: 'birthdate', type: 'date' });

      const errors = await validator.validateSingleField(field, '2026-01-01', {});
      expect(errors).toHaveLength(0);

      const errors2 = await validator.validateSingleField(field, 'not-a-date', {});
      expect(errors2).toHaveLength(1);
      expect(errors2[0].code).toContain('INVALID_DATE_BIRTHDATE');
    });

    it('should flag an empty required select value (REQUIRED)', async () => {
      const field = makeField({ name: 'country', type: 'select', sourceVocabulary: 'countries', required: true });

      const errors = await validator.validateSingleField(field, '', {});

      expect(errors.some((e) => e.code.includes('REQUIRED_COUNTRY'))).toBe(true);
    });
  });
});
