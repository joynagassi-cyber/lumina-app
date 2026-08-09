/**
 * Domain events for delegation operations.
 *
 * Events emitted by GrantEntry aggregate root when state transitions occur.
 * These events can be published to event handlers for auditing, notifications,
 * or cross-domain effects.
 *
 * @traceability BR-DEL-006 — Every action audited via domain events
 */

import { DomainEvent } from '@shared/events';
import { GrantId } from '../value-objects/grant-id.vo';
import { GrantScope } from '../value-objects/grant-scope.vo';
import type { GrantPermission } from '../value-objects/grant-permission.vo';
import { GrantStatus } from '../value-objects/grant-status.enum';

export class GrantCreated extends DomainEvent {
  constructor(
    public readonly grantId: string,
    public readonly delegatorUserId: string,
    public readonly delegateeUserId: string,
    public readonly orgId: string,
    public readonly approvalStatus: GrantStatus,
    public readonly permissions: string[], // permission strings
    public readonly durationDays: number,
    public readonly grantScope: string,
    occurredAt?: Date,
  ) {
    super('GrantCreated', occurredAt);
  }
}

export class GrantApproved extends DomainEvent {
  constructor(
    public readonly grantId: string,
    public readonly delegateeUserId: string,
    public readonly orgId: string,
    public readonly approvedBy: string,
    occurredAt?: Date,
  ) {
    super('GrantApproved', occurredAt);
  }
}

export class GrantExpired extends DomainEvent {
  constructor(
    public readonly grantId: string,
    public readonly delegateeUserId: string,
    public readonly orgId: string,
    occurredAt?: Date,
  ) {
    super('GrantExpired', occurredAt);
  }
}

export class GrantRevoked extends DomainEvent {
  constructor(
    public readonly grantId: string,
    public readonly delegateeUserId: string,
    public readonly orgId: string,
    public readonly revokedBy: string,
    occurredAt?: Date,
  ) {
    super('GrantRevoked', occurredAt);
  }
}