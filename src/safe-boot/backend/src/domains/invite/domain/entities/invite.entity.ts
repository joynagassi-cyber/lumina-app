/**
 * Invite Entity — Aggregate Root for the Invitation Domain
 *
 * Manages the complete invitation lifecycle with state transitions,
 * token management, and event emission. Implements BR-INV-001 through BR-INV-005.
 *
 * Lifecycle States:
 *   created → sent → pending → accepted (membership created)
 *   created → sent → pending → rejected
 *   created → sent → pending → expired (auto)
 *   created → sent → pending → revoked
 *
 * @traceability ORG-008 Invite Aggregate Root → INV-Entity v1
 */

import { InviteId } from '../value-objects/invite-id.vo';
import { InviteToken } from '../value-objects/invite-token.vo';
import { InviteScope } from '../value-objects/invite-scope.vo';
import { InviteType } from '../value-objects/invite-type.enum';
import { InviteStatus, isValidStatusTransition } from '../value-objects/invite-status.enum';
import {
  InviteCreated,
  InviteSent,
  InviteAccepted,
  InviteRejected,
  InviteExpired,
  InviteRevoked,
  MembershipCreatedFromInvite,
} from '../events';
import { DomainEvent } from '../../../../shared/events';

export class Invite {
  private readonly _id: InviteId;
  private readonly _orgId: string;
  private readonly _inviterUserId: string;
  private _targetEmail?: string;
  private _targetPhone?: string;
  private _suggestedRole?: string;
  private _scope: string;
  private _validityDays: number;
  private _expiresAt: Date;
  private _status: InviteStatus;
  private _acceptToken?: InviteToken;
  private _metadata: Record<string, unknown>;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _acceptedAt?: Date;
  private _revokedAt?: Date;
  private readonly _emittedEvents: DomainEvent[] = [];

  constructor(
    params: {
      id?: InviteId;
      orgId: string;
      inviterUserId: string;
      targetEmail?: string;
      targetPhone?: string;
      suggestedRole?: string;
      scope: string;
      validityDays: number;
      expiresAt: Date;
      status: InviteStatus;
      acceptToken?: InviteToken;
      metadata?: Record<string, unknown>;
      createdAt?: Date;
      updatedAt?: Date;
      acceptedAt?: Date;
      revokedAt?: Date;
    }
  ) {
    this._id = params.id ?? InviteId.create();
    this._orgId = params.orgId;
    this._inviterUserId = params.inviterUserId;
    this._targetEmail = params.targetEmail;
    this._targetPhone = params.targetPhone;
    this._suggestedRole = params.suggestedRole;
    this._scope = params.scope;
    this._validityDays = params.validityDays;
    this._expiresAt = new Date(params.expiresAt);
    this._status = params.status;
    this._acceptToken = params.acceptToken;
    this._metadata = params.metadata ?? {};
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
    this._acceptedAt = params.acceptedAt;
    this._revokedAt = params.revokedAt;

    // Emit creation event
    this.emit(new InviteCreated(
      this._id.value,
      this._orgId,
      this._inviterUserId,
      this._targetEmail,
      this._targetPhone,
      this._suggestedRole,
      this._scope,
      this._validityDays,
      this._inviteType(),
      this._metadata
    ));
  }

  /** Getters */
  get id(): InviteId { return this._id; }
  get orgId(): string { return this._orgId; }
  get inviterUserId(): string { return this._inviterUserId; }
  get targetEmail(): string | undefined { return this._targetEmail; }
  get targetPhone(): string | undefined { return this._targetPhone; }
  get suggestedRole(): string | undefined { return this._suggestedRole; }
  get scope(): string { return this._scope; }
  get validityDays(): number { return this._validityDays; }
  get expiresAt(): Date { return new Date(this._expiresAt); }
  get status(): InviteStatus { return this._status; }
  get acceptToken(): InviteToken | undefined { return this._acceptToken; }
  get metadata(): Record<string, unknown> { return this._metadata; }
  get createdAt(): Date { return new Date(this._createdAt); }
  get updatedAt(): Date { return new Date(this._updatedAt); }
  get acceptedAt(): Date | undefined { return this._acceptedAt ? new Date(this._acceptedAt) : undefined; }
  get revokedAt(): Date | undefined { return this._revokedAt ? new Date(this._revokedAt) : undefined; }

  private _inviteType(): InviteType {
    // Determine type based on scope and metadata
    if (this._scope === 'org') return InviteType.STANDARD;
    if (this._scope === 'group') return InviteType.AUTO;
    return InviteType.STANDARD;
  }

  /**
   * Accept the invitation using a valid token.
 * Emits InviteAccepted and MembershipCreatedFromInvite events.
 */
  accept(token: string, acceptedBy: string, ipAddress?: string): void {
    if (!this._acceptToken) {
      throw new Error('No token set for this invitation');
    }

    if (this._acceptToken.hash !== token) {
      throw new Error('Invalid acceptance token');
    }

    this._acceptToken.validateForAccept();

    const oldStatus = this._status;
    this._status = InviteStatus.ACCEPTED;
    this._acceptedAt = new Date();
    this._updatedAt = new Date();

    this._acceptToken.use(); // Mark token as used

    this.emit(new InviteAccepted(
      this._id.value,
      this._orgId,
      acceptedBy,
      this._targetEmail,
      ipAddress
    ));

    this.emit(new MembershipCreatedFromInvite(
      this._id.value,
      this._orgId,
      `${this._orgId}_${this._id.value}`, // memberId placeholder
      this._suggestedRole || InviteStatus.ACCEPTED,
      this._acceptedAt!
    ));
  }

  /**
   * Reject the invitation.
 * Emits InviteRejected event.
 */
  reject(rejectedBy: string, reason?: string): void {
    const oldStatus = this._status;

    if (this._status !== InviteStatus.PENDING && this._status !== InviteStatus.SENT) {
      throw new Error(`Cannot reject invitation in status: ${this._status}`);
    }

    this._status = InviteStatus.REJECTED;
    this._updatedAt = new Date();

    this.emit(new InviteRejected(
      this._id.value,
      this._orgId,
      rejectedBy,
      reason
    ));
  }

  /**
   * Revoke the invitation (inviter-initiated).
 * Emits InviteRevoked event.
 */
  revoke(invokerUserId: string, reason?: string): void {
    if (this._status === InviteStatus.ACCEPTED) {
      throw new Error('Cannot revoke an already accepted invitation');
    }

    const oldStatus = this._status;
    this._status = InviteStatus.REVOKED;
    this._revokedAt = new Date();
    this._updatedAt = new Date();

    this._acceptToken = undefined; // Invalidate token

    this.emit(new InviteRevoked(
      this._id.value,
      this._orgId,
      invokerUserId,
      reason
    ));
  }

  /**
   * Expire the invitation (auto-expiration).
 * Emits InviteExpired event.
 */
  expire(): void {
    if (this._status === InviteStatus.ACCEPTED || this._status === InviteStatus.REJECTED) {
      return; // Already terminal state
    }

    const oldStatus = this._status;
    this._status = InviteStatus.EXPIRED;
    this._updatedAt = new Date();

    this._acceptToken = undefined; // Invalidate token

    this.emit(new InviteExpired(
      this._id.value,
      this._orgId,
      this._expiresAt
    ));
  }

  /**
   * Send the invitation via a notification channel.
 * Emits InviteSent event.
 * Transitions from CREATED to SENT.
 */
  send(channel: string): void {
    if (this._status !== InviteStatus.CREATED) {
      throw new Error('Only CREATED invitations can be sent');
    }

    this._status = InviteStatus.SENT;
    this._updatedAt = new Date();

    this.emit(new InviteSent(
      this._id.value,
      this._orgId,
      channel
    ));
  }

  /**
   * Update the acceptance token (regenerate).
 */
  regenerateToken(token: InviteToken): void {
    this._acceptToken = token;
    this._updatedAt = new Date();
    // No event emitted on token regeneration — it's an internal operation
  }

  /**
   * Set metadata for the invitation.
 */
  setMetadata(key: string, value: unknown): void {
    this._metadata[key] = value;
    this._updatedAt = new Date();
  }

  /**
   * Emit a domain event to the internal event buffer.
 */
  private emit(event: DomainEvent): void {
    this._emittedEvents.push(event);
  }

  /**
   * Get and clear all emitted domain events.
 */
  getAndClearEvents(): DomainEvent[] {
    const events = [...this._emittedEvents];
    this._emittedEvents.length = 0;
    return events;
  }

  /**
   * Persist map — convert entity to column-compatible format for database.
 */
  toPersistenceColumnMap(): Record<string, unknown> {
    return {
      id: this._id.value,
      org_id: this._orgId,
      inviter_user_id: this._inviterUserId,
      target_email: this._targetEmail,
      target_phone: this._targetPhone,
      suggested_role: this._suggestedRole,
      scope: this._scope,
      validity_days: this._validityDays,
      expires_at: this._expiresAt.toISOString(),
      usage_limit: this._metadata?.usageLimit ?? 1,
      usage_count: this._acceptToken ? this._acceptToken.usageCount : 0,
      type: this._inviteType(),
      status: this._status,
      accept_token_hash: this._acceptToken ? this._acceptToken.hash : null,
      metadata: this._metadata,
      created_at: this._createdAt.toISOString(),
      accepted_at: this._acceptedAt ? this._acceptedAt.toISOString() : null,
      revoked_at: this._revokedAt ? this._revokedAt.toISOString() : null,
      updated_at: this._updatedAt.toISOString(),
    };
  }

  /**
   * Rehydrate Invite entity from persistence map.
 */
  static fromPersistence(
    map: Record<string, unknown>,
    inviterUserId: string,
    validityDays?: number,
    scope?: string
  ): Invite {
    const invite = new Invite({
      id: InviteId.from(map.id as string),
      orgId: map.org_id as string,
      inviterUserId,
      targetEmail: map.target_email as string | undefined,
      targetPhone: map.target_phone as string | undefined,
      suggestedRole: map.suggested_role as string | undefined,
      scope: (map.scope as string | undefined) ?? scope ?? 'org',
      validityDays: (map.validity_days as number | undefined) ?? validityDays ?? 7,
      expiresAt: new Date(map.expires_at as string),
      status: map.status as InviteStatus,
      acceptToken: map.accept_token_hash
        ? new InviteToken(map.accept_token_hash as string, new Date(map.expires_at as string))
        : undefined,
      metadata: (map.metadata as Record<string, unknown> | undefined) ?? {},
      createdAt: new Date(map.created_at as string),
      updatedAt: new Date(map.updated_at as string),
      acceptedAt: map.accepted_at ? new Date(map.accepted_at as string) : undefined,
      revokedAt: map.revoked_at ? new Date(map.revoked_at as string) : undefined,
    });

    // Restore internal state
    invite._createdAt = new Date(map.created_at as string);
    invite._updatedAt = new Date(map.updated_at as string);
    invite._acceptedAt = map.accepted_at ? new Date(map.accepted_at as string) : undefined;
    invite._revokedAt = map.revoked_at ? new Date(map.revoked_at as string) : undefined;

    return invite;
  }
}