/**
 * Invite Domain Events — Pure domain-level events for the Invite Aggregate
 *
 * Events are emitted by the Invite aggregate root upon state transitions.
 * They are published via event bus to notification services, audit loggers,
 * and downstream consumers (e.g., membership creation side effects).
 *
 * @traceability ORG-008 BR-INV-003 MembershipCreatedFromInvite event
 */

import { DomainEvent } from '../../../../shared/events';

/**
 * Base class for all invite domain events.
 */
abstract class InviteEvent implements DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;

  constructor(
    public readonly inviteId: string,
    public readonly orgId: string,
    occurredAt?: Date
  ) {
    this.eventType = (this.constructor as any).eventType || 'UnknownInviteEvent';
    this.occurredAt = occurredAt || new Date();
  }
}

/**
 * Event emitted when an invitation is created.
 * Payload contains invitation metadata including target, role, scope, validity.
 */
export class InviteCreated extends InviteEvent {
  static readonly eventType = 'InviteCreated';

  constructor(
    inviteId: string,
    orgId: string,
    public readonly inviterId: string,
    public readonly targetEmail?: string,
    public readonly targetPhone?: string,
    public readonly suggestedRole?: string,
    public readonly scope: string = 'org',
    public readonly validityDays: number = 7,
    public readonly inviteType: string = 'standard',
    public readonly metadata: Record<string, unknown> = {},
    occurredAt?: Date
  ) {
    super(inviteId, orgId, occurredAt);
  }
}

/**
 * Event emitted when an invitation is successfully sent via notification channel.
 */
export class InviteSent extends InviteEvent {
  static readonly eventType = 'InviteSent';

  constructor(
    inviteId: string,
    orgId: string,
    public readonly channel: string, // 'email', 'push', 'sms'
    occurredAt?: Date
  ) {
    super(inviteId, orgId, occurredAt);
  }
}

/**
 * Event emitted when an invitation is accepted using a valid token.
 * Triggers membership creation as a side effect.
 */
export class InviteAccepted extends InviteEvent {
  static readonly eventType = 'InviteAccepted';

  constructor(
    inviteId: string,
    orgId: string,
    public readonly acceptedBy: string, // user_id who accepted
    public readonly fromEmail?: string,
    public readonly ipAddress?: string,
    occurredAt?: Date
  ) {
    super(inviteId, orgId, occurredAt);
  }
}

/**
 * Event emitted when an invitation is explicitly rejected by the target.
 */
export class InviteRejected extends InviteEvent {
  static readonly eventType = 'InviteRejected';

  constructor(
    inviteId: string,
    orgId: string,
    public readonly rejectedBy: string, // user_id who rejected
    public readonly reason?: string,
    occurredAt?: Date
  ) {
    super(inviteId, orgId, occurredAt);
  }
}

/**
 * Event emitted when an invitation expires due to time limit.
 */
export class InviteExpired extends InviteEvent {
  static readonly eventType = 'InviteExpired';

  constructor(
    inviteId: string,
    orgId: string,
    public readonly expiresAt: Date,
    occurredAt?: Date
  ) {
    super(inviteId, orgId, occurredAt);
  }
}

/**
 * Event emitted when an invitation is explicitly revoked by the inviter.
 */
export class InviteRevoked extends InviteEvent {
  static readonly eventType = 'InviteRevoked';

  constructor(
    inviteId: string,
    orgId: string,
    public readonly revokedBy: string, // user_id who revoked
    public readonly reason?: string,
    occurredAt?: Date
  ) {
    super(inviteId, orgId, occurredAt);
  }
}

/**
 * Side-effect event: membership created as a result of accepting an invite.
 * Emitted after InviteAccepted and membership record creation.
 */
export class MembershipCreatedFromInvite extends InviteEvent {
  static readonly eventType = 'MembershipCreatedFromInvite';

  constructor(
    inviteId: string,
    orgId: string,
    public readonly memberId: string,
    public readonly role: string,
    public readonly acceptedAt: Date,
    occurredAt?: Date
  ) {
    super(inviteId, orgId, occurredAt);
  }
}