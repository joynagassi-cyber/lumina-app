/**
 * EventScope — value object representing the scope of an event.
 * Events are always scoped to either an organization or a group (org_unit).
 *
 * @traceability DOC-012 Aggregate3 (BR-RES-005: Scope type mandatory), PG-Schema-v1 events (portee_type implied)
 * @invariant scopeType must be 'org' or 'group'; scopeTargetId required when group-scoped
 */

export enum EventScopeType {
  ORG = 'org',
  GROUP = 'group',
}

export class EventScope {
  constructor(
    public readonly scopeType: EventScopeType,
    public readonly scopeTargetId: string | null,
  ) {
    if (scopeType === EventScopeType.GROUP && !scopeTargetId) {
      throw new Error('EventScope: group scope requires a scopeTargetId');
    }
  }

  /** Create an org-scoped event. */
  static forOrg(): EventScope {
    return new EventScope(EventScopeType.ORG, null);
  }

  /** Create a group-scoped event bound to the given group/org_unit. */
  static forGroup(groupId: string): EventScope {
    return new EventScope(EventScopeType.GROUP, groupId);
  }

  isOrgScoped(): boolean {
    return this.scopeType === EventScopeType.ORG;
  }

  isGroupScoped(): boolean {
    return this.scopeType === EventScopeType.GROUP;
  }
}
