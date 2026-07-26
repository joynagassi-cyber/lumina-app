/**
 * ResourceScopeResolver — resolves scope_type and scope_target for consolidation.
 *
 * @traceability DOC-012 Aggregate3 (ResourceScopeResolver domain service)
 */

import { ResourceScope, ResourceScopeType } from '../value-objects/resource-scope.vo';

export interface ScopeResolutionResult {
  scopeType: ResourceScopeType;
  scopeTargetId: string | null;
  isOrgScoped: boolean;
  isGroupScoped: boolean;
  needsConsolidation: boolean;
  groupDescendants: string[];
}

export class ResourceScopeResolver {
  /**
   * Resolve a resource's scope for reporting/consolidation.
   * For 'org' scope: all transactions in the org are included directly.
   * For 'group' scope: must traverse the org_unit hierarchy to include descendants.
   */
  static resolve(scope: ResourceScope, orgId: string): ScopeResolutionResult {
    return {
      scopeType: scope.scopeType,
      scopeTargetId: scope.scopeTargetId,
      isOrgScoped: scope.scopeType === ResourceScopeType.ORG,
      isGroupScoped: scope.scopeType === ResourceScopeType.GROUP,
      needsConsolidation: scope.scopeType === ResourceScopeType.GROUP,
      groupDescendants: [], // populated by infrastructure layer with actual descendant IDs
    };
  }

  /**
   * Build the effective scope list for a group-scoped query.
   * Includes the target group and all its descendants (recursive traversal).
   */
  static buildEffectiveScope(
    targetGroupId: string,
    descendantIds: string[],
  ): string[] {
    return [targetGroupId, ...descendantIds];
  }
}
