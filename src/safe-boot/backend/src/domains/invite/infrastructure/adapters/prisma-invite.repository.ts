/**
 * PrismaInvitationRepository — Infrastructure Adapter implementing IInviteRepository
 *
 * Provides persistence operations for the Invite aggregate using Prisma ORM.
 * All queries are scoped to org_id for tenant isolation.
 *
 * @traceability ORG-008 PrismaInvitationRepository → INV-Infrastructure v1
 */

import { Injectable, Inject } from '@nestjs/common';
import type { PrismaClient, Prisma } from '@prisma/client';
import { Invite } from '../../domain/entities/invite.entity';
import { InviteStatus } from '../../domain/value-objects/invite-status.enum';
import { IInviteRepository } from '../../ports';

const PRISMA_CLIENT = 'PRISMA_CLIENT';

@Injectable()
export class PrismaInvitationRepository implements IInviteRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findById(id: string, orgId: string): Promise<Invite | null> {
    try {
      const invitation = await this.prisma.invitation.findUnique({
        where: { id, org_id: orgId },
      });

      if (!invitation) return null;

      return this.toDomain(invitation);
    } catch (error) {
      console.error('Error finding invitation by ID:', error);
      throw new Error('Failed to retrieve invitation');
    }
  }

  async findByEmail(orgId: string, email: string): Promise<Invite[]> {
    try {
      const invitations = await this.prisma.invitation.findMany({
        where: { org_id: orgId, target_email: email.trim().toLowerCase() },
      });
      return invitations.map(inv => this.toDomain(inv));
    } catch (error) {
      console.error('Error finding invitations by email:', error);
      throw new Error('Failed to retrieve invitations');
    }
  }

  async findByPhone(orgId: string, phone: string): Promise<Invite[]> {
    try {
      const invitations = await this.prisma.invitation.findMany({
        where: { org_id: orgId, target_phone: phone },
      });
      return invitations.map(inv => this.toDomain(inv));
    } catch (error) {
      console.error('Error finding invitations by phone:', error);
      throw new Error('Failed to retrieve invitations');
    }
  }

  async findByInviterId(orgId: string, userId: string): Promise<Invite[]> {
    try {
      const invitations = await this.prisma.invitation.findMany({
        where: { org_id: orgId, inviter_user_id: userId },
      });
      return invitations.map(inv => this.toDomain(inv));
    } catch (error) {
      console.error('Error finding invitations by inviter:', error);
      throw new Error('Failed to retrieve invitations');
    }
  }

  async findActiveByOrg(orgId: string, status?: InviteStatus[]): Promise<Invite[]> {
    try {
      const where: any = { org_id: orgId };
      if (status && status.length > 0) {
        where.status = { in: status };
      } else {
        where.status = { in: ['sent', 'pending'] };
      }

      const invitations = await this.prisma.invitation.findMany({ where });
      return invitations.map(inv => this.toDomain(inv));
    } catch (error) {
      console.error('Error finding active invitations:', error);
      throw new Error('Failed to retrieve invitations');
    }
  }

  async countByOrgAndStatus(orgId: string, status: InviteStatus): Promise<number> {
    try {
      const count = await this.prisma.invitation.count({
        where: { org_id: orgId, status },
      });
      return count;
    } catch (error) {
      console.error('Error counting invitations:', error);
      throw new Error('Failed to count invitations');
    }
  }

  async create(invite: Invite): Promise<void> {
    try {
      const data = invite.toPersistenceColumnMap() as unknown as Prisma.InvitationCreateInput;
      await this.prisma.invitation.create({ data });
    } catch (error) {
      console.error('Error creating invitation:', error);
      throw new Error('Failed to create invitation');
    }
  }

  async update(invite: Invite): Promise<void> {
    try {
      const data = invite.toPersistenceColumnMap() as unknown as Prisma.InvitationUpdateInput;
      await this.prisma.invitation.update({
        where: { id: invite.id.value },
        data: { ...data, updated_at: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Error updating invitation:', error);
      throw new Error('Failed to update invitation');
    }
  }

  async findAllByOrg(
    orgId: string,
    page: number,
    limit: number,
    status?: InviteStatus
  ): Promise<{ data: Invite[]; total: number }> {
    try {
      const where: any = { org_id: orgId };
      if (status) {
        where.status = status;
      }

      const skip = (page - 1) * limit;

      const [invitations, total] = await Promise.all([
        this.prisma.invitation.findMany({ where, take: limit, skip }),
        this.prisma.invitation.count({ where }),
      ]);

      return {
        data: invitations.map(inv => this.toDomain(inv)),
        total,
      };
    } catch (error) {
      console.error('Error fetching invitations:', error);
      throw new Error('Failed to retrieve invitations');
    }
  }

  /**
   * Convert Prisma model to Invite domain entity.
 */
  private toDomain(prismaInvitation: any): Invite {
    return Invite.fromPersistence(prismaInvitation, prismaInvitation.inviter_user_id);
  }
}