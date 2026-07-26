/**
 * VisibilityPolicy
 *
 * Ensures that all data access is strictly scoped to the requesting organization.
 * No data from one org may ever be mixed with or accessible to another org.
 *
 * @traceability DOC-012 Aggregate1 §Policies-VisibilityPolicy
 *   → DOC-023 §8 Multi-tenant isolation
 *   → NB-MT-001, NB-MT-002, NB-MT-003
 */

import { Organization } from '../organization.entity';
import { OrgUnit } from '../org-unit.entity';

export class TenantIsolationError extends Error {
  constructor(context: string) {
    super(`Tenant isolation violation in: ${context}. Requested org_id does not match entity org_id.`);
    this.name = 'TenantIsolationError';
  }
}

export class VisibilityPolicy {
  /**
   * Verify that an entity belongs to the specified org.
   * Throws TenantIsolationError if the org does not match.
   */
  static verifyEntityOrg(entityOrgId: string, requestOrgId: string): void {
    if (entityOrgId !== requestOrgId) {
      throw new TenantIsolationError(
        `Entity org '${entityOrgId}' != request org '${requestOrgId}'`,
      );
    }
  }

  /** Verify Organization aggregate root belongs to the requesting org. */
  static verifyOrganization(org: Organization, requestOrgId: string): void {
    VisibilityPolicy.verifyEntityOrg(org.orgId, requestOrgId);
  }

  /** Verify OrgUnit belongs to the requesting org. */
  static verifyOrgUnit(unit: OrgUnit, requestOrgId: string): void {
    VisibilityPolicy.verifyEntityOrg(unit.orgId, requestOrgId);
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
