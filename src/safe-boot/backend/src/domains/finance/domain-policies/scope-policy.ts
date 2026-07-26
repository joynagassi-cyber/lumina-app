/**
 * ScopePolicy — enforces BR-RES-005: scope_type must be 'org' or 'group'.
 * For 'group' scope, a valid scopeTarget (org_unit FK) is mandatory.
 *
 * @traceability DOC-012 Aggregate3 (ScopePolicy), BR-RES-005, PG-Schema-v1 transactions.portee_type
 */

export class ScopePolicyError extends Error {
  constructor(message: string) {
    super(`ScopePolicy: ${message}`);
    this.name = 'ScopePolicyError';
  }
}

export class ScopePolicy {
  private static readonly VALID_SCOPE_TYPES = new Set(['org', 'group']);

  /** Validate that the given scope type is allowed by the domain model. */
  static validateScopeType(scopeType: string): void {
    if (!this.VALID_SCOPE_TYPES.has(scopeType)) {
      throw new ScopePolicyError(
        `invalid scope_type "${scopeType}" — must be one of: ${[...this.VALID_SCOPE_TYPES].join(', ')}`,
      );
    }
  }

  /** Assert that a group-scoped resource has a valid scope target ID. */
  static assertGroupTargetPresent(groupId: string | null): void {
    if (!groupId) {
      throw new ScopePolicyError('group-scoped resources require a scope_target (org_unit_id)');
    }
  }

  /** Determine whether consolidation should flag internal transfers. */
  static determinesConsolidationFlag(
    sourceOrgId: string,
    targetOrgId: string | null,
  ): boolean {
    return targetOrgId !== null && targetOrgId !== sourceOrgId;
  }
}
