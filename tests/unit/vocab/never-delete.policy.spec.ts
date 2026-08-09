/**
 * NeverDeletePolicy Tests
 *
 * Tests that vocabulary entities are never hard-deleted, only deprecated.
 * @traceability DOC-012 BR-VOC-001, NeverDeletePolicy
 */

import { NeverDeletePolicy, DeleteForbiddenError } from '@/domains/vocab/domain/policies/never-delete.policy';

describe('NeverDeletePolicy', () => {
  describe('assertNoDelete', () => {
    it('should throw DeleteForbiddenError when delete is attempted', () => {
      // Act & Assert
      expect(() => NeverDeletePolicy.assertNoDelete('term', 'term-123')).toThrow(DeleteForbiddenError);
      expect(() => NeverDeletePolicy.assertNoDelete('term-value', 'value-456')).toThrow(DeleteForbiddenError);

      // Assert error message includes entity type and id
      expect(() => NeverDeletePolicy.assertNoDelete('term', 'term-123')).toThrowError('term (id: term-123)');
      expect(() => NeverDeletePolicy.assertNoDelete('term-value', 'value-456')).toThrowError('value (id: value-456)');
    });
  });

  describe('recordDeprecation', () => {
    it('should return deprecation audit record', () => {
      const result = NeverDeletePolicy.recordDeprecation('term', 'term-123', 'org-1', 'admin-1');

      expect(result).toEqual({
        action: 'deprecate',
        entity_type: 'term',
        entity_id: 'term-123',
        org_id: 'org-1',
        actor_id: 'admin-1',
        reason: 'NeverDeletePolicy — DELETED replaced with deprecated',
      });
    });
  });
});
