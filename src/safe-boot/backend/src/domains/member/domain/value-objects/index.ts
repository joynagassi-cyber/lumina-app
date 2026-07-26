/**
 * Barrel export for member domain value objects.
 * @traceability DOC-012 §Aggregate 4
 */

export { RelationshipType, isRelationshipType, assertRelationshipType } from './relationship-type.vo';
export type { MembershipRole } from './membership-role.vo';
export { tryCreateMembershipRole, assertMembershipRole } from './membership-role.vo';
export { JoinTimestamp } from './join-timestamp.vo';
export { RelationshipKey } from './relationship-key.vo';
