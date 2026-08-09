/**
 * PrismaGrantRepository — Infrastructure Adapter implementing IGrantRepository.
 *
 * Provides persistence operations for the delegation grant using Prisma ORM.
 * All queries are scoped to org_id for tenant isolation.
 *
 * @traceability DOC-012 DelegationAggregate → Prisma adapter
 */

import { Injectable, Inject } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { GrantEntry } from '../../domain/entities/grant-entry';
import { GrantId } from '../../domain/value-objects/grant-id.vo';
import { GrantStatus } from '../../domain/value-objects/grant-status.enum';
import type { IGrantRepository, GrantEntryProps } from '../../ports/delegation.ports';

const PRISMA_CLIENT = 'PRISMA_CLIENT';

@Injectable()
export class PrismaGrantRepository implements IGrantRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: any) {}

  async create(props: GrantEntryProps): Promise<GrantId> {
    try {
      const result = await this.prisma.grantEntries.create({
        data: {
          id: props.grantId,
          delegator_id: props.delegatorUserId,
          delegatee_id: props.delegateeUserId,
          org_id: props.orgId,
          grant_scope: props.grantScope,
          grant_permissions: props.grantPermissions,
          duration_days: props.durationDays,
          expires_at: new Date(props.expiresAt),
          requires_approval: props.requiresApproval,
          approval_status: props.approvalStatus,
          active: props.active,
          created_at: new Date(props.createdAt),
          revoked_at: props.revokedAt ? new Date(props.revokedAt) : null,
        },
        return: true,
      });
      return new GrantId(result.id);
    } catch (error) {
      console.error('Error creating grant entry:', error);
      throw new Error('Failed to create grant entry');
    }
  }

  async findById(grantId: string): Promise<GrantEntry | null> {
    try {
      const row = await this.prisma.grantEntries.findUnique({
        where: { id: grantId },
      });
      if (!row) return null;
      return GrantEntry.fromPersistenceRow(row);
    } catch (error) {
      console.error('Error finding grant entry by ID:', error);
      throw new Error('Failed to retrieve grant entry');
    }
  }

  async findByDelegateeUserId(userId: string): Promise<GrantEntry[]> {
    try {
      const rows = await this.prisma.grantEntries.findMany({
        where: { delegatee_user_id: userId },
      });
      return rows.map((row: any) => GrantEntry.fromPersistenceRow(row));
    } catch (error) {
      console.error('Error finding grants by delegatee user ID:', error);
      throw new Error('Failed to retrieve grants');
    }
  }

  async findByDelegatorUserId(userId: string): Promise<GrantEntry[]> {
    try {
      const rows = await this.prisma.grantEntries.findMany({
        where: { delegator_user_id: userId },
      });
      return rows.map((row: any) => GrantEntry.fromPersistenceRow(row));
    } catch (error) {
      console.error('Error finding grants by delegator user ID:', error);
      throw new Error('Failed to retrieve grants');
    }
  }

  async findActiveByOrgId(orgId: string): Promise<GrantEntry[]> {
    try {
      const rows = await this.prisma.grantEntries.findMany({
        where: {
          org_id: orgId,
          active: true,
          approval_status: { in: ['Approved', 'Active'] },
          expires_at: { gt: new Date() },
        },
      });
      return rows.map((row: any) => GrantEntry.fromPersistenceRow(row));
    } catch (error) {
      console.error('Error finding active grants by org ID:', error);
      throw new Error('Failed to retrieve grants');
    }
  }

  async findAllByOrgId(orgId: string): Promise<GrantEntry[]> {
    try {
      const rows = await this.prisma.grantEntries.findMany({
        where: { org_id: orgId },
      });
      return rows.map((row: any) => GrantEntry.fromPersistenceRow(row));
    } catch (error) {
      console.error('Error finding all grants by org ID:', error);
      throw new Error('Failed to retrieve grants');
    }
  }

  async update(grant: GrantEntry): Promise<void> {
    try {
      await this.prisma.grantEntries.update({
        where: { id: grant.grantId.value },
        data: {
          ...grant.toPersistenceRow(),
          updated_at: new Date(),
        },
      });
    } catch (error) {
      console.error('Error updating grant entry:', error);
      throw new Error('Failed to update grant entry');
    }
  }

  async revokeById(grantId: string, revokedBy: string): Promise<boolean> {
    try {
      const result = await this.prisma.grantEntries.update({
        where: { id: grantId },
        data: {
          active: false,
          revoked_at: new Date(),
          approval_status: 'Revoked',
        },
        return: true,
      });
      return !!result;
    } catch (error) {
      console.error('Error revoking grant entry:', error);
      throw new Error('Failed to revoke grant entry');
    }
  }

  async approveById(grantId: string, approvedBy: string): Promise<boolean> {
    try {
      const result = await this.prisma.grantEntries.update({
        where: { id: grantId },
        data: {
          approval_status: 'Active',
          active: true,
        },
        return: true,
      });
      return !!result;
    } catch (error) {
      console.error('Error approving grant entry:', error);
      throw new Error('Failed to approve grant entry');
    }
  }

  async expireExpiredGrants(): Promise<number> {
    try {
      const result = await this.prisma.grantEntries.updateMany({
        where: {
          active: true,
          expires_at: { lte: new Date },
          approval_status: { not: 'Expired' },
        },
        data: {
          active: false,
          approval_status: 'Expired',
        },
      });
      return result.count;
    } catch (error) {
      console.error('Error expiring expired grants:', error);
      throw new Error('Failed to expire grants');
    }
  }

  async exists(params: {
    delegatorId: string;
    delegateeId: string;
    orgId: string;
    grantScope: string;
  }): Promise<boolean> {
    try {
      const count = await this.prisma.grantEntries.count({
        where: {
          delegator_id: params.delegatorId,
          delegatee_id: params.delegateeId,
          org_id: params.orgId,
          grant_scope: params.grantScope,
        },
      });
      return count > 0;
    } catch (error) {
      console.error('Error checking grant existence:', error);
      throw new Error('Failed to check grant existence');
    }
  }
}