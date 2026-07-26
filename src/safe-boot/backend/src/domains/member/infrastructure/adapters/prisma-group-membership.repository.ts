/**
 * PrismaGroupMembershipRepository — Infrastructure adapter for GroupMembership.
 * Maps domain entities to/from the database layer.
 * @traceability DOC-012 §Aggregate 4, POSTGRESQL-SCHEMA-PACK-v1.md Table 11, NB-MT-002
 */

import type { IGroupMembershipRepository } from '../../ports/group-membership.port';
import type { GroupMembership } from '../../domain/entities/group-membership.entity';
import { GroupMembership as GroupMembershipEntity } from '../../domain/entities/group-membership.entity';
import { JoinTimestamp } from '../../domain/value-objects/join-timestamp.vo';

export interface PrismaClientLike {
  groupMembership: {
    findUnique(args: { where: { id: string } }): Promise<unknown | null>;
    findMany(args: { where: { member_uuid?: string; org_id?: string; group_org_unit_uuid?: string } }): Promise<unknown[]>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    delete(args: { where: { id: string } }): Promise<void>;
  };
}

export class PrismaGroupMembershipRepository implements IGroupMembershipRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findById(id: string): Promise<GroupMembership | null> {
    const raw = await this.prisma.groupMembership.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return this._toDomain(raw);
  }

  async findByMemberId(memberUuid: string, orgId: string): Promise<GroupMembership[]> {
    const where: Record<string, unknown> = { member_uuid: memberUuid };
    if (orgId) {
      where.org_id = orgId;
    }
    const rows = await this.prisma.groupMembership.findMany({
      where,
    });
    return (rows as unknown[]).map((r) => this._toDomain(r));
  }

  async findByGroupId(groupOrgUnitUuid: string, orgId: string): Promise<GroupMembership[]> {
    const where: Record<string, unknown> = { group_org_unit_uuid: groupOrgUnitUuid };
    if (orgId) {
      where.org_id = orgId;
    }
    const rows = await this.prisma.groupMembership.findMany({
      where,
    });
    return (rows as unknown[]).map((r) => this._toDomain(r));
  }

  async exists(memberUuid: string, groupOrgUnitUuid: string, orgId: string): Promise<boolean> {
    const where: Record<string, unknown> = {
      member_uuid: memberUuid,
      group_org_unit_uuid: groupOrgUnitUuid,
    };
    if (orgId) {
      where.org_id = orgId;
    }
    const record = await this.prisma.groupMembership.findUnique({ where });
    return record !== null && record !== undefined;
  }

  async create(data: Omit<typeof import('../../domain/entities/group-membership.entity').GroupMembershipData, 'id'>): Promise<GroupMembership> {
    const row = await this.prisma.groupMembership.create({
      data: {
        org_id: data.orgId,
        member_uuid: data.memberUuid,
        group_org_unit_uuid: data.groupOrgUnitUuid,
        join_timestamp: data.joinTimestamp.toISOString(),
        membership_role: data.membershipRole ?? null,
        departure_date: data.departureDate,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      },
    });
    return this._toDomain(row);
  }

  async update(
    id: string,
    partial: Partial<Omit<typeof import('../../domain/entities/group-membership.entity').GroupMembershipData, 'id'>>,
  ): Promise<GroupMembership> {
    const updateData: Record<string, unknown> = {};
    if ('joinTimestamp' in partial) {
      updateData.join_timestamp = (partial.joinTimestamp as JoinTimestamp).toISOString();
    }
    if ('membershipRole' in partial) {
      updateData.membership_role = partial.membershipRole ?? null;
    }
    if ('departureDate' in partial) {
      updateData.departure_date = partial.departureDate ?? null;
    }
    if ('updatedAt' in partial) {
      updateData.updated_at = partial.updatedAt;
    }

    const row = await this.prisma.groupMembership.update({
      where: { id },
      data: updateData,
    });
    return this._toDomain(row);
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.groupMembership.delete({ where: { id } });
  }

  async listByGroup(groupOrgUnitUuid: string, orgId: string): Promise<GroupMembership[]> {
    const where: Record<string, unknown> = { group_org_unit_uuid: groupOrgUnitUuid };
    if (orgId) {
      where.org_id = orgId;
    }
    const rows = await this.prisma.groupMembership.findMany({ where });
    return (rows as unknown[]).map((r) => this._toDomain(r));
  }

  private _toDomain(raw: unknown): GroupMembership {
    const rec = raw as Record<string, unknown>;
    return new GroupMembershipEntity({
      id: String(rec.id),
      orgId: String(rec.org_id ?? rec.orgId),
      memberUuid: String(rec.member_uuid ?? rec.memberUuid),
      groupOrgUnitUuid: String(rec.group_org_unit_uuid ?? rec.groupOrgUnitUuid),
      joinTimestamp: rec.join_timestamp ? JoinTimestamp.from(new Date(rec.join_timestamp)) : JoinTimestamp.now(),
      membershipRole: rec.membership_role ?? rec.membershipRole ?? null,
      departureDate: rec.departure_date ?? rec.departureDate ? new Date(String(rec.departure_date ?? rec.departureDate)) : null,
      createdAt: new Date(String(rec.created_at ?? rec.createdAt)),
      updatedAt: new Date(String(rec.updated_at ?? rec.updatedAt)),
    });
  }
}
