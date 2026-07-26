/**
 * PrismaOrgUnitLinkRepository — Infrastructure adapter for OrgUnitLink.
 * Maps domain entities to/from the database layer.
 * @traceability DOC-012 §Aggregate 4, POSTGRESQL-SCHEMA-PACK-v1.md Table 12, NB-MT-002
 */

import type { IOrgUnitLinkRepository } from '../../ports/org-unit-link.port';
import { OrgUnitLink as OrgUnitLinkEntity } from '../../domain/entities/org-unit-link.entity';
import type { OrgUnitLinkData } from '../../domain/entities/org-unit-link.entity';

export interface PrismaClientLike {
  orgUnitLink: {
    findUnique(args: { where: { id: string } }): Promise<unknown | null>;
    findMany(args: { where: Record<string, unknown> }): Promise<unknown[]>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: { where: { id?: string; child_org_unit_uuid?: string }; data: Record<string, unknown> }): Promise<unknown>;
    delete(args: { where: { id: string } }): Promise<void>;
  };
}

export class PrismaOrgUnitLinkRepository implements IOrgUnitLinkRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async findById(id: string): Promise<OrgUnitLinkEntity | null> {
    const raw = await this.prisma.orgUnitLink.findUnique({
      where: { id },
    });
    if (!raw) return null;
    return this._toDomain(raw);
  }

  async findParent(
    childOrgUnitUuid: string,
    orgId: string,
  ): Promise<OrgUnitLinkEntity | null> {
    const where: Record<string, unknown> = { child_org_unit_uuid: childOrgUnitUuid };
    if (orgId) {
      where.org_id = orgId;
    }
    const rows = await this.prisma.orgUnitLink.findMany({ where });
    const found = (rows as unknown[])[0] as unknown | undefined;
    if (!found) return null;
    return this._toDomain(found as Record<string, unknown>);
  }

  async findChildren(
    parentOrgUnitUuid: string,
    orgId: string,
  ): Promise<OrgUnitLinkEntity[]> {
    const where: Record<string, unknown> = { parent_org_unit_uuid: parentOrgUnitUuid };
    if (orgId) {
      where.org_id = orgId;
    }
    const rows = await this.prisma.orgUnitLink.findMany({ where });
    return (rows as unknown[]).map((r) => this._toDomain(r as Record<string, unknown>));
  }

  async exists(
    childOrgUnitUuid: string,
    parentOrgUnitUuid: string | null,
    orgId: string,
  ): Promise<boolean> {
    const where: Record<string, unknown> = {
      child_org_unit_uuid: childOrgUnitUuid,
      parent_org_unit_uuid: parentOrgUnitUuid ?? null,
    };
    if (orgId) {
      where.org_id = orgId;
    }
    const record = await this.prisma.orgUnitLink.findUnique({ where });
    return record !== null && record !== undefined;
  }

  async create(data: Omit<OrgUnitLinkData, 'id'>): Promise<OrgUnitLinkEntity> {
    const row = await this.prisma.orgUnitLink.create({
      data: {
        org_id: data.orgId,
        child_org_unit_uuid: data.childOrgUnitUuid,
        parent_org_unit_uuid: data.parentOrgUnitUuid,
        depth_level: data.depthLevel,
        updated_at: data.updatedAt,
      },
    });
    return this._toDomain(row as Record<string, unknown>);
  }

  async updateParent(
    childOrgUnitUuid: string,
    newParentUuid: string | null,
  ): Promise<OrgUnitLinkEntity> {
    const where: Record<string, unknown> = { child_org_unit_uuid: childOrgUnitUuid };
    const row = await this.prisma.orgUnitLink.update({
      where,
      data: {
        parent_org_unit_uuid: newParentUuid,
        updated_at: new Date(),
      },
    });
    return this._toDomain(row as Record<string, unknown>);
  }

  async removeParent(childOrgUnitUuid: string): Promise<void> {
    await this.prisma.orgUnitLink.update({
      where: { child_org_unit_uuid: childOrgUnitUuid },
      data: { parent_org_unit_uuid: null },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.orgUnitLink.delete({ where: { id } });
  }

  async listByOrg(orgId: string): Promise<OrgUnitLinkEntity[]> {
    const rows = await this.prisma.orgUnitLink.findMany({
      where: { org_id: orgId },
    });
    return (rows as unknown[]).map((r) => this._toDomain(r as Record<string, unknown>));
  }

  private _toDomain(raw: Record<string, unknown>): OrgUnitLinkEntity {
    return new OrgUnitLinkEntity({
      id: String(raw.id),
      orgId: String(raw.org_id ?? raw.orgId),
      childOrgUnitUuid: String(raw.child_org_unit_uuid ?? raw.childOrgUnitUuid),
      parentOrgUnitUuid: raw.parent_org_unit_uuid != null ? String(raw.parent_org_unit_uuid) : null,
      depthLevel: Number(raw.depth_level ?? raw.depthLevel) || 1,
      updatedAt: new Date(String(raw.updated_at ?? raw.updatedAt)),
    });
  }
}
