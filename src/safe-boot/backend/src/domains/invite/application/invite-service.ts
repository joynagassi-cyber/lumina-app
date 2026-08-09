/**
 * InviteApplicationService — Application Layer for Invite Aggregate
 *
 * Implements use cases for invitation management.
 */

import { Invite } from '../domain/entities/invite.entity';
import { InviteToken } from '../domain/value-objects/invite-token.vo';
import { InviteStatus } from '../domain/value-objects/invite-status.enum';
import { InviteType } from '../domain/value-objects/invite-type.enum';
import {
  InviteCreated,
  InviteSent,
  InviteAccepted,
  InviteRejected,
  InviteExpired,
  InviteRevoked,
  MembershipCreatedFromInvite,
} from '../domain/events/invite-events';
import { IInviteRepository } from '../ports';
import { ITokenService } from '../ports';
import { InviteValidator } from '../domain/services/invite-validator';
import { ExpiryPolicy } from '../domain/policies/expiry-policy';
import { UsageLimitPolicy } from '../domain/policies/usage-limit.policy';
import { NeverDeletePolicy } from '../domain/policies/never-delete.policy';
import { DomainEvent } from '../../../shared/events';

// Permission resolver interface — wired from user module at composition root
export interface IPermissionResolver {
  hasPermission(userId: string, orgId: string, permission: string): Promise<boolean>;
}

// Event emitter interface — wired from event module at composition root
export interface IDomainEventEmitter {
  emit(event: DomainEvent): Promise<void>;
}

export interface CreateInviteCommand {
  orgId: string;
  inviterUserId: string;
  targetEmail?: string;
  targetPhone?: string;
  suggestedRole?: string;
  scope: string;
  validityDays?: number;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface SendInviteCommand {
  inviteId: string;
  orgId: string;
  channel: string;
}

export interface AcceptInviteCommand {
  inviteId: string;
  orgId: string;
  token: string;
  acceptedBy: string;
  fromEmail?: string;
  ipAddress?: string;
}

export interface RejectInviteCommand {
  inviteId: string;
  orgId: string;
  rejectedBy: string;
  reason?: string;
}

export interface RevokeInviteCommand {
  inviteId: string;
  orgId: string;
  revokedBy: string;
  reason?: string;
}

export interface ExpireInviteCommand {
  inviteId: string;
  orgId: string;
}

export interface InviteResult {
  inviteId: string;
  orgId: string;
  status: InviteStatus;
  emittedEvents: DomainEvent[];
}

export class InviteService {
  constructor(
    private readonly repository: IInviteRepository,
    private readonly tokenService: ITokenService,
    private readonly permissionResolver: IPermissionResolver,
    private readonly eventEmitter: IDomainEventEmitter | null = null,
    private readonly DEFAULT_VALIDITY_DAYS = 7,
    private readonly MAX_VALIDITY_DAYS = 365
  ) {}

  async create(command: CreateInviteCommand): Promise<InviteResult> {
    // Validate inputs
    InviteValidator.validateCreationParams(
      command.orgId, command.inviterUserId, command.scope,
      command.validityDays ?? this.DEFAULT_VALIDITY_DAYS,
      command.targetEmail, command.targetPhone, command.suggestedRole,
      command.type as InviteType | undefined, command.metadata
    );

    const validityDays = Math.min(command.validityDays ?? this.DEFAULT_VALIDITY_DAYS, this.MAX_VALIDITY_DAYS);
    const type = command.type || 'standard';
    const scope = command.scope;

    const hasPermission = await this.permissionResolver.hasPermission(
      command.inviterUserId, command.orgId, `member:invite:${scope}`
    );
    if (!hasPermission) throw new Error(`Insufficient permission: member:invite:${scope}`);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);
    const tokenHash = await this.tokenService.generateToken('temp', command.orgId, validityDays);
    const token = new InviteToken(tokenHash, expiresAt, 1);

    const invite = new Invite({
      orgId: command.orgId, inviterUserId: command.inviterUserId,
      targetEmail: command.targetEmail, targetPhone: command.targetPhone,
      suggestedRole: command.suggestedRole, scope, validityDays, expiresAt,
      status: InviteStatus.CREATED, acceptToken: token,
      metadata: command.metadata ?? {}
    });

    await this.repository.create(invite);
    const persisted = await this.repository.findById(invite.id.value, command.orgId);
    if (!persisted) throw new Error('Failed to persist invitation');

    const result: InviteResult = {
      inviteId: persisted.id.value, orgId: command.orgId,
      status: persisted.status, emittedEvents: persisted.getAndClearEvents()
    };

    if (this.eventEmitter) {
      for (const event of result.emittedEvents) await this.eventEmitter.emit(event);
    }
    return result;
  }

  async send(command: SendInviteCommand): Promise<InviteResult> {
    const invite = await this.repository.findById(command.inviteId, command.orgId);
    if (!invite) throw new Error('Invitation not found');
    if (invite.status !== InviteStatus.CREATED)
      throw new Error(`Cannot send invitation in status: ${invite.status}`);

    invite.send(command.channel);
    await this.repository.update(invite);

    const result: InviteResult = {
      inviteId: invite.id.value, orgId: command.orgId,
      status: invite.status, emittedEvents: invite.getAndClearEvents()
    };

    if (this.eventEmitter) {
      for (const event of result.emittedEvents) await this.eventEmitter.emit(event);
    }
    return result;
  }

  async accept(command: AcceptInviteCommand): Promise<InviteResult> {
    const invite = await this.repository.findById(command.inviteId, command.orgId);
    if (!invite) throw new Error('Invitation not found');
    if (invite.status !== InviteStatus.SENT && invite.status !== InviteStatus.PENDING)
      throw new Error(`Cannot accept invitation in status: ${invite.status}`);

    if (!invite.acceptToken) throw new Error('No token available for this invitation');

    UsageLimitPolicy.validateTokenForUsage(invite, command.token);

    invite.accept(command.token, command.acceptedBy, command.ipAddress);
    await this.repository.update(invite);
    await ExpiryPolicy.expireIfPastDue(invite);

    const result: InviteResult = {
      inviteId: invite.id.value, orgId: command.orgId,
      status: invite.status, emittedEvents: invite.getAndClearEvents()
    };

    if (this.eventEmitter) {
      for (const event of result.emittedEvents) await this.eventEmitter.emit(event);
    }
    return result;
  }

  async reject(command: RejectInviteCommand): Promise<InviteResult> {
    const invite = await this.repository.findById(command.inviteId, command.orgId);
    if (!invite) throw new Error('Invitation not found');
    if (!InviteValidator.canBeRejected(invite))
      throw new Error(`Cannot reject invitation in status: ${invite.status}`);

    invite.reject(command.rejectedBy, command.reason);
    await this.repository.update(invite);

    const result: InviteResult = {
      inviteId: invite.id.value, orgId: command.orgId,
      status: invite.status, emittedEvents: invite.getAndClearEvents()
    };

    if (this.eventEmitter) {
      for (const event of result.emittedEvents) await this.eventEmitter.emit(event);
    }
    return result;
  }

  async revoke(command: RevokeInviteCommand): Promise<InviteResult> {
    const invite = await this.repository.findById(command.inviteId, command.orgId);
    if (!invite) throw new Error('Invitation not found');
    if (invite.inviterUserId !== command.revokedBy)
      throw new Error('Only the inviter can revoke an invitation');
    if (!InviteValidator.canBeRevoked(invite))
      throw new Error(`Cannot revoke invitation in status: ${invite.status}`);

    NeverDeletePolicy.ensureValidFinalStatus(invite.status);
    invite.revoke(command.revokedBy, command.reason);
    await this.repository.update(invite);

    const result: InviteResult = {
      inviteId: invite.id.value, orgId: command.orgId,
      status: invite.status, emittedEvents: invite.getAndClearEvents()
    };

    if (this.eventEmitter) {
      for (const event of result.emittedEvents) await this.eventEmitter.emit(event);
    }
    return result;
  }

  async expire(command: ExpireInviteCommand): Promise<InviteResult> {
    const invite = await this.repository.findById(command.inviteId, command.orgId);
    if (!invite) throw new Error('Invitation not found');
    if (invite.status === InviteStatus.ACCEPTED || invite.status === InviteStatus.REJECTED)
      throw new Error('Cannot expire an already accepted or rejected invitation');

    invite.expire();
    await this.repository.update(invite);

    const result: InviteResult = {
      inviteId: invite.id.value, orgId: command.orgId,
      status: invite.status, emittedEvents: invite.getAndClearEvents()
    };

    if (this.eventEmitter) {
      for (const event of result.emittedEvents) await this.eventEmitter.emit(event);
    }
    return result;
  }

  async checkExpiredInvitations(orgId: string): Promise<Invite[]> {
    const invites = await this.repository.findActiveByOrg(orgId);
    return invites.filter(invite => ExpiryPolicy.isExpired(invite));
  }
}