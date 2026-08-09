/**
 * ClientServerValidationMatchPolicy Tests
 *
 * Tests that client and server validation results match exactly.
 * @traceability DOC-012 INV-008, BR-FRM-002, ClientServerValidationMatchPolicy
 */

import { ClientServerValidationMatchPolicy, ValidationMismatchError, type ValidationComparisonResult } from '@/domains/form/domain/policies/client-server-validation-match.policy';

describe('ClientServerValidationMatchPolicy', () => {
  describe('assertMatch', () => {
    it('should allow matching validation results', () => {
      const clientResult: ValidationComparisonResult = { valid: true, errorCount: 0, sanitizedValue: 'test' };
      const serverResult: ValidationComparisonResult = { valid: true, errorCount: 0, sanitizedValue: 'test' };

      expect(() => ClientServerValidationMatchPolicy.assertMatch('fieldname', clientResult, serverResult)).not.toThrow();
    });

    it('should throw when valid differs', () => {
      const clientResult: ValidationComparisonResult = { valid: true, errorCount: 0, sanitizedValue: 'test' };
      const serverResult: ValidationComparisonResult = { valid: false, errorCount: 1, sanitizedValue: null };

      expect(() => ClientServerValidationMatchPolicy.assertMatch('fieldname', clientResult, serverResult)).toThrow(ValidationMismatchError);
      expect(() => ClientServerValidationMatchPolicy.assertMatch('fieldname', clientResult, serverResult)).toThrowError('INV-008 violation');
    });

    it('should throw when errorCount differs', () => {
      const clientResult: ValidationComparisonResult = { valid: true, errorCount: 0, sanitizedValue: 'test' };
      const serverResult: ValidationComparisonResult = { valid: true, errorCount: 1, sanitizedValue: null };

      expect(() => ClientServerValidationMatchPolicy.assertMatch('fieldname', clientResult, serverResult)).toThrow(ValidationMismatchError);
    });

    it('should throw when sanitizedValue types differ', () => {
      const clientResult: ValidationComparisonResult = { valid: true, errorCount: 0, sanitizedValue: 'test' };
      const serverResult: ValidationComparisonResult = { valid: true, errorCount: 0, sanitizedValue: 123 };

      expect(() => ClientServerValidationMatchPolicy.assertMatch('fieldname', clientResult, serverResult)).toThrow(ValidationMismatchError);
    });
  });

  describe('computeExpectedResult', () => {
    it('should handle required field with empty input', () => {
      const field = { required: true, name: 'field1', defaultValue: 'default' } as any;
      const result = ClientServerValidationMatchPolicy.computeExpectedResult(field, '');

      expect(result.valid).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.sanitizedValue).toBe('default');
    });

    it('should handle non-required field with empty input', () => {
      const field = { required: false, name: 'field1', defaultValue: null } as any;
      const result = ClientServerValidationMatchPolicy.computeExpectedResult(field, '');

      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.sanitizedValue).toBeNull();
    });

    it('should validate text field with pattern', () => {
      const field = { name: 'field1', type: 'text', pattern: '^\\d{3}-\\d{2}-\\d{4}$', min: 5, max: 12 } as any;
      const result = ClientServerValidationMatchPolicy.computeExpectedResult(field, '123-45-6789');

      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should validate number field with min/max', () => {
      const field = { name: 'field1', type: 'number', min: 1, max: 100 } as any;
      const result = ClientServerValidationMatchPolicy.computeExpectedResult(field, 50);

      expect(result.valid).toBe(true);
      expect(result.sanitizedValue).toBe(50);
    });

    it('should validate date field', () => {
      const field = { name: 'field1', type: 'date' } as any;
      const result = ClientServerValidationMatchPolicy.computeExpectedResult(field, '2026-01-01');

      expect(result.valid).toBe(true);
    });

    it('should validate select field', () => {
      const field = { name: 'field1', type: 'select' } as any;
      const result = ClientServerValidationMatchPolicy.computeExpectedResult(field, 'option1');

      expect(result.valid).toBe(true);
      expect(result.sanitizedValue).toBe('option1');
    });

    it('should validate multiselect field', () => {
      const field = { name: 'field1', type: 'multiselect' } as any;
      const result = ClientServerValidationMatchPolicy.computeExpectedResult(field, ['a', 'b']);

      expect(result.valid).toBe(true);
      expect(result.sanitizedValue).toEqual(['a', 'b']);
    });
  });
});
