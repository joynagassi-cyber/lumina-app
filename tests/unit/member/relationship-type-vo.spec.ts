/**
 * RelationshipType Value Object Tests
 *
 * Tests the relationship types defined in the member aggregate.
 * @traceability DOC-012 VO-RelationshipType, BR-REL-000
 */

import { RelationshipType, assertRelationshipType, isRelationshipType } from '@/domains/member/domain/value-objects/relationship-type.vo';

describe('RelationshipType', () => {
  it('should define all valid relationship types', () => {
    expect(Object.values(RelationshipType)).toEqual([
      'belongs_to',
      'has_many',
      'many_to_many',
      'hierarchical',
      'referenced_by',
    ]);
  });

  it('should accept valid relationship type "belongs_to"', () => {
    expect(() => assertRelationshipType('belongs_to')).not.toThrow();
  });

  it('should accept valid relationship type "has_many"', () => {
    expect(() => assertRelationshipType('has_many')).not.toThrow();
  });

  it('should accept valid relationship type "many_to_many"', () => {
    expect(() => assertRelationshipType('many_to_many')).not.toThrow();
  });

  it('should accept valid relationship type "hierarchical"', () => {
    expect(() => assertRelationshipType('hierarchical')).not.toThrow();
  });

  it('should accept valid relationship type "referenced_by"', () => {
    expect(() => assertRelationshipType('referenced_by')).not.toThrow();
  });

  it('should throw error for invalid relationship type', () => {
    expect(() => assertRelationshipType('invalid')).toThrow(TypeError);
    expect(() => assertRelationshipType('invalid')).toThrowError(
      'Invalid RelationshipType: invalid. Expected one of: belongs_to, has_many, many_to_many, hierarchical, referenced_by',
    );
  });

  it('should validate relationship type correctly', () => {
    expect(isRelationshipType('belongs_to')).toBe(true);
    expect(isRelationshipType(RelationshipType.BELONGS_TO)).toBe(true);
    expect(isRelationshipType('invalid')).toBe(false);
    expect(isRelationshipType(123)).toBe(false);
    expect(isRelationshipType(null)).toBe(false);
  });
});
