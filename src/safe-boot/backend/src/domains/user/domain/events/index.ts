/**
 * Domain events for IdentityAggregate (IdentityAggregate)
 *
 * These events are produced by domain operations and published to the event bus.
 * DO NOT confuse with infrastructure notifications — these are PURE domain events.
 *
 * Events list from DOC-012 Aggregate 2:
 *   UserCreated, UserUpdated, UserRoleChanged, PasswordResetRequested
 *   UserLoggedIn, UserLoggedOut, SessionCreated, SessionExpired, SessionRevoked
 *
 * @traceability DOC-012 §Aggregate2 DomainEvents
 */

import { DomainEvent } from '@shared/events';

export class UserCreated extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly orgId: string,
    public readonly email: string,
    public readonly role: string,
    occurredAt?: Date,
  ) {
    super('UserCreated', occurredAt);
  }
}

export class UserUpdated extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly changes: Record<string, unknown>,
    occurredAt?: Date,
  ) {
    super('UserUpdated', occurredAt);
  }
}

export class UserRoleChanged extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly previousRole: string,
    public readonly newRole: string,
    occurredAt?: Date,
  ) {
    super('UserRoleChanged', occurredAt);
  }
}

export class PasswordResetRequested extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly requestId: string,
    occurredAt?: Date,
  ) {
    super('PasswordResetRequested', occurredAt);
  }
}

export class UserLoggedIn extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly ipAddress?: string,
    occurredAt?: Date,
  ) {
    super('UserLoggedIn', occurredAt);
  }
}

export class UserLoggedOut extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId?: string,
    occurredAt?: Date,
  ) {
    super('UserLoggedOut', occurredAt);
  }
}

export class SessionCreated extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly expiresAt: Date,
    public readonly deviceInfo: Record<string, unknown>,
    occurredAt?: Date,
  ) {
    super('SessionCreated', occurredAt);
  }
}

export class SessionExpired extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    occurredAt?: Date,
  ) {
    super('SessionExpired', occurredAt);
  }
}

export class SessionRevoked extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly revokedBy: string,
    occurredAt?: Date,
  ) {
    super('SessionRevoked', occurredAt);
  }
}
