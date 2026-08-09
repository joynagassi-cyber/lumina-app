/**
 * Member domain-specific domain events.
 * Extends the base DomainEvent from shared/events.
 * @traceability DOC-012 §Aggregate 4 (Domain Events produits)
 */

import { DomainEvent } from '../../../shared/events';

export class MemberJoinedGroup extends DomainEvent {
  constructor(
    public readonly memberUuid: string,
    public readonly groupOrgUnitUuid: string,
    public readonly orgId: string,
    public readonly membershipRole: string | null,
    occurredAt?: Date,
  ) {
    super('MemberJoinedGroup', occurredAt);
  }
}

export class MemberLeftGroup extends DomainEvent {
  constructor(
    public readonly memberUuid: string,
    public readonly groupOrgUnitUuid: string,
    public readonly orgId: string,
    occurredAt?: Date,
  ) {
    super('MemberLeftGroup', occurredAt);
  }
}

export class OrgUnitReparented extends DomainEvent {
  constructor(
    public readonly childOrgUnitUuid: string,
    public readonly oldParentUuid: string | null,
    public readonly newParentUuid: string | null,
    public readonly depth: number,
    public readonly orgId: string,
    occurredAt?: Date,
  ) {
    super('OrgUnitReparented', occurredAt);
  }
}

export class ChildOrgTransferred extends DomainEvent {
  constructor(
    public readonly sourceOrgUnitUuid: string,
    public readonly targetOrgUnitUuid: string,
    public readonly preservedMembershipCount: number,
    public readonly orgId: string,
    occurredAt?: Date,
  ) {
    super('ChildOrgTransferred', occurredAt);
  }
}

export class ChildOrgMerged extends DomainEvent {
  constructor(
    public readonly sourceOrgUnitUuid: string,
    public readonly targetOrgUnitUuid: string,
    public readonly orgId: string,
    occurredAt?: Date,
  ) {
    super('ChildOrgMerged', occurredAt);
  }
}

export class DescendantEnumerationRequested extends DomainEvent {
  constructor(
    public readonly ancestorOrgUnitUuid: string,
    public readonly requesterId: string,
    public readonly orgId: string,
    occurredAt?: Date,
  ) {
    super('DescendantEnumerationRequested', occurredAt);
  }
}
