/**
 * RelationshipType — Value Object
 * Defines the kind of relationship between domain entities.
 * @traceability DOC-012 §Aggregate 4 (RelationshipAggregate), DOC-023 §3.3
 */

export enum RelationshipType {
  BELONGS_TO = 'belongs_to',
  HAS_MANY = 'has_many',
  MANY_TO_MANY = 'many_to_many',
  HIERARCHICAL = 'hierarchical',
  REFERENCED_BY = 'referenced_by',
}

/**
 * Validates that a string maps to a known RelationshipType.
 * Returns true when the value is a valid enum member.
 */
export function isRelationshipType(value: unknown): value is RelationshipType {
  return typeof value === 'string' && Object.values(RelationshipType).includes(value as RelationshipType);
}

/**
 * Guards against using an unchecked raw string where RelationshipType is required.
 */
export function assertRelationshipType(
  value: unknown,
): asserts value is RelationshipType {
  if (!isRelationshipType(value)) {
    throw new TypeError(
      `Invalid RelationshipType: ${String(value)}. Expected one of: ${Object.values(RelationshipType).join(', ')}`,
    );
  }
}
