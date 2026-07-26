/**
 * EventScopePolicy — enforces BR-RES-005: scope_type must be 'org' or 'group'.
 * For group-scoped events, a valid scopeTarget (org_unit FK) is mandatory.
 *
 * @traceability DOC-012 Aggregate3 (ScopePolicy), BR-RES-005, PG-Schema-v1 Table 9 implied portee_type
 */

export class EventScopePolicyError extends Error {
  constructor(message: string) {
    super(`EventScopePolicy: ${message}`);
    this.name = 'EventScopePolicyError';
  }
}

export class EventScopePolicy {
  private static readonly VALID_SCOPE_TYPES = new Set(['org', 'group']);

  /** Validate that the given scope type is allowed by the event domain model. */
  static validateScopeType(scopeType: string): void {
    if (!this.VALID_SCOPE_TYPES.has(scopeType)) {
      throw new EventScopePolicyError(
        `invalid scope_type "${scopeType}" for events — must be one of: org, group`,
      );
    }
  }

  /** Assert that a group-scoped event has a valid scope target ID. */
  static assertGroupTargetPresent(scopeTargetId: string | null): void {
    if (!scopeTargetId) {
      throw new EventScopePolicyError('group-scoped events require a scope_target (org_unit_id)');
    }
  }
}
