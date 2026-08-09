/**
 * DeprecationManager Tests
 *
 * Tests deprecation of vocabulary terms and values.
 * @traceability DOC-012 BR-VOC-001, DeprecationManager
 */

import { DeprecationManager, AlreadyDeprecatedError } from '@/domains/vocab/domain/services/deprecation-manager.service';

// Mock entities for testing
class MockTerm {
  constructor(public id: string, public key: string, public isDeprecated = false) {}
  deprecate(deprecatedAt: Date) { this.isDeprecated = true; }
}

class MockValue {
  constructor(public id: string, public key: string, public termId: string, public isDeprecated = false) {}
  deprecate(deprecatedAt: Date) { this.isDeprecated = true; }
}

describe('DeprecationManager', () => {
  let manager: DeprecationManager;

  beforeEach(() => {
    manager = new DeprecationManager();
  });

  describe('deprecateTerm', () => {
    it('should deprecate a term and return result', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const term = new MockTerm('term-1', 'status_key');
      const result = manager.deprecateTerm(term, now);

      expect(result).toEqual({
        entityId: 'term-1',
        entityType: 'term',
        key: 'status_key',
        deprecatedAt: now,
      });
      expect(term.isDeprecated).toBe(true);
    });

    it('should throw if term already deprecated', () => {
      const term = new MockTerm('term-1', 'status_key', true); // already deprecated

      expect(() => manager.deprecateTerm(term)).toThrow(AlreadyDeprecatedError);
      expect(() => manager.deprecateTerm(term)).toThrowError('already deprecated');
    });
  });

  describe('deprecateTermValue', () => {
    it('should deprecate a term value and return result', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const value = new MockValue('value-1', 'active_key', 'term-1');
      const result = manager.deprecateTermValue(value, now);

      expect(result).toEqual({
        entityId: 'value-1',
        entityType: 'value',
        key: 'active_key',
        deprecatedAt: now,
      });
      expect(value.isDeprecated).toBe(true);
    });

    it('should throw if value already deprecated', () => {
      const value = new MockValue('value-1', 'active_key', 'term-1', true);

      expect(() => manager.deprecateTermValue(value)).toThrow(AlreadyDeprecatedError);
    });
  });

  describe('bulkDeprecateValues', () => {
    it('should deprecate multiple values and return results', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const values = [
        new MockValue('v1', 'val1', 't1'),
        new MockValue('v2', 'val2', 't1'),
        new MockValue('v3', 'val3', 't1'),
      ];

      const results = manager.bulkDeprecateValues(values, now);

      expect(results).toHaveLength(3);
      expect(results[0].entityId).toBe('v1');
      expect(results[1].entityId).toBe('v2');
      expect(values.every(v => v.isDeprecated)).toBe(true);
    });
  });

  describe('canDeprecate', () => {
    it('should allow deprecation when not already deprecated', () => {
      expect(manager.canDeprecate(false)).toBe(true);
    });

    it('should not allow deprecation when already deprecated', () => {
      expect(manager.canDeprecate(true)).toBe(false);
    });
  });
});
