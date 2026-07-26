/**
 * DataScopePolicy — enforces org-scoped data access for reports.
 *
 * @traceability DOC-012 Aggregate9 §DataScopePolicy
 */

import { ReportScopeValue } from '../value-objects/report-scope.vo';

/**
 * Policy that filters report data to the appropriate organizational scope.
 */
export class DataScopePolicy {
  /**
   * Validate that a requested scope is compatible with org isolation.
   * Returns true if the scope is safe for org-scoped queries.
   */
  static isValidScope(scope: ReportScopeValue): boolean {
    return ['org', 'group', 'all'].includes(scope);
  }

  /**
   * Filter transactions to include only those within the specified org scope.
   */
  static filterByOrgScope(
    orgId: string,
    targetOrgId?: string | null,
  ): boolean {
    if (!targetOrgId) return true;
    return orgId === targetOrgId;
  }
}
