/**
 * Domain events for Auth operations within IdentityAggregate
 *
 * Events produced by Auth login flow, token rotation, session management, MFA.
 * Extends the IdentityAggregate event set from user/domain/events/index.ts.
 *
 * @traceability DOC-012 Aggregate 2 (IdentityAggregate) → SessionCreated, SessionExpired, SessionRevoked, UserLoggedIn, UserLoggedOut
 *   → API-CONTRACT-002 §2.2 Event List: UserLoggedIn, UserLoggedOut, SessionCreated, SessionRevoked
 *   → PG-Schema Table 5 (sessions) lifecycle transitions
 */

import { DomainEvent } from '@shared/events';

export class LoginAttempted extends DomainEvent {
  constructor(
    public readonly email: string,
    public readonly orgId: string,
    public readonly ipAddress?: string,
    occurredAt?: Date,
  ) {
    super('LoginAttempted', occurredAt);
  }
}

export class LoginSucceeded extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly orgId: string,
    public readonly tokenType: 'access' | 'refresh',
    occurredAt?: Date,
  ) {
    super('LoginSucceeded', occurredAt);
  }
}

export class LoginFailed extends DomainEvent {
  constructor(
    public readonly email: string,
    public readonly orgId: string,
    public readonly reason: 'invalid_password' | 'account_locked' | 'user_not_found' | 'mfa_required',
    occurredAt?: Date,
  ) {
    super('LoginFailed', occurredAt);
  }
}

export class TokenRefreshed extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly oldSessionId: string,
    public readonly newSessionId: string,
    public readonly orgId: string,
    occurredAt?: Date,
  ) {
    super('TokenRefreshed', occurredAt);
  }
}

export class SessionRevokedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly revokedBy: string,
    public readonly orgId: string,
    occurredAt?: Date,
  ) {
    super('SessionRevoked', occurredAt);
  }
}

export class MfaEnabled extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly orgId: string,
    public readonly secretKeyId: string,
    occurredAt?: Date,
  ) {
    super('MfaEnabled', occurredAt);
  }
}

export class MfaDisabled extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly orgId: string,
    public readonly secretKeyId: string,
    occurredAt?: Date,
  ) {
    super('MfaDisabled', occurredAt);
  }
}
