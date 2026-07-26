/**
 * VisibilityPolicy — Form-scoped tenant isolation
 *
 * Ensures all form data is strictly scoped to the requesting organization.
 * Re-exports org domain's policy; this file exists as a local convenience for
 * form aggregate consistency (PA-NB-001: all policies belong to their aggregate).
 *
 * @traceability DOC-012 Aggregate6 §Policies-VisibilityPolicy
 *   → DOC-023 §8 Multi-tenant isolation (org_id on ALL methods)
 */

export class TenantIsolationError extends Error {
  constructor(context: string) {
    super(`Tenant isolation violation in FormAggregate: ${context}. Requested org_id does not match entity org_id.`);
    this.name = 'TenantIsolationError';
  }
}

export class VisibilityPolicy {
  /** Verify that an org-scoped resource belongs to the requesting org. */
  static verifyOrg(entityOrgId: string, requestOrgId: string): void {
    if (entityOrgId !== requestOrgId) {
      throw new TenantIsolationError(
        `Entity org '${entityOrgId}' != request org '${requestOrgId}'`,
      );
    }
  }

  /** Alias for form-specific context. */
  static verifyFormOrg(formOrgId: string, requestOrgId: string): void {
    VisibilityPolicy.verifyOrg(formOrgId, requestOrgId);
  }

  /**
   * Filter a list of org-scoped entities by org_id.
   * Used for query results — ensures cross-org leakage is impossible.
   */
  static filterByOrg<T extends { orgId: string }>(
    items: T[],
    requestOrgId: string,
  ): T[] {
    return items.filter(item => item.orgId === requestOrgId);
  }
}
