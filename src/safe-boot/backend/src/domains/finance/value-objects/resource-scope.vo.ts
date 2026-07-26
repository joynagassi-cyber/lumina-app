/**
 * ResourceScope — scope_type and scope_target for cross-organization consolidation.
 *
 * @traceability DOC-012 Aggregate3 (BR-RES-005), PG-Schema-v1 transactions.portee_type
 * @invariant scopeType must be 'org' or 'group'; scopeTarget only valid for 'group'
 */

export enum ResourceScopeType {
  ORG = 'org',
  GROUP = 'group',
}

export class ResourceScope {
  constructor(
    public readonly scopeType: ResourceScopeType,
    public readonly scopeTargetId: string | null,
  ) {
    if (scopeType === ResourceScopeType.GROUP && !scopeTargetId) {
      throw new Error('ResourceScope: group scope requires a scopeTargetId');
    }
  }

  static forOrg(orgScopeOnly = true): ResourceScope {
    return new ResourceScope(ResourceScopeType.ORG, null);
  }

  static forGroup(groupId: string): ResourceScope {
    return new ResourceScope(ResourceScopeType.GROUP, groupId);
  }

  isOrgScoped(): boolean {
    return this.scopeType === ResourceScopeType.ORG;
  }

  isGroupScoped(): boolean {
    return this.scopeType === ResourceScopeType.GROUP;
  }
}
