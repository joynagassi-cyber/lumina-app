/**
 * MembershipRole — Value Object
 * Optional role a member holds within a group (e.g. "chorister", "treasurer").
 * @traceability DOC-012 §Aggregate 4, POSTGRESQL-SCHEMA-PACK-v1.md Table 11 (role_groupe)
 */

export type MembershipRole = string;

/**
 * Maximum length for a membership role label per DB schema (varchar(100)).
 */
const MAX_ROLE_LENGTH = 100;

/**
 * Validates and constructs a MembershipRole value object.
 * Returns null when the value is empty or too long.
 */
export function tryCreateMembershipRole(role: string | null | undefined): MembershipRole | null {
  if (role === null || role === undefined) {
    return null;
  }
  const trimmed = role.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ROLE_LENGTH) {
    return null;
  }
  return trimmed as MembershipRole;
}

/**
 * Guards against using an unchecked string where MembershipRole is required.
 */
export function assertMembershipRole(
  value: unknown,
): asserts value is MembershipRole {
  if (typeof value !== 'string') {
    throw new TypeError(`MembershipRole must be a string, got ${typeof value}`);
  }
}
