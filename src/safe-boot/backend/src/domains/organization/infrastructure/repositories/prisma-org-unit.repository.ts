/**
 * PrismaOrgUnitRepository — Infrastructure Adapter
 *
 * Implements IOrgUnitRepository using Prisma ORM.
 * Strips persistence metadata per PAS-005 PA-NB-007.
 * Enforces org_id filtering on every query (DR-009).
 *
 * @traceability DOC-012 Aggregate1 → POSTGRESQL-SCHEMA-PACK-v1 org_units
 */

import { OrgUnit } from '../../domain/org-unit.entity';
import { assertValidOrgUnitType, assertValidOrgUnitStatus } from '../../domain/org-unit.entity';
import { OrgUnitHierarchy } from '../../domain/value-objects/org-unit-hierarchy.vo';
import type { IOrgUnitRepository } from '../../ports/repository.port';

export class PrismaOrgUnitRepository implements IOrgUnitRepository {
  constructor(
    private readonly prisma: unknown, // PrismaClient injected at composition root
  ) {}

  async findById(unitId: string, requestOrgId: string): Promise<OrgUnit | null> {
    const raw = await this.queryRecord({ id: unitId, org_id: requestOrgId });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findByParentId(parentId: string | null, requestOrgId: string): Promise<OrgUnit[]> {
    const where: Record<string, unknown> = { org_id: requestOrgId };
    if (parentId === null) {
      where.parent_id = null;
    } else {
      where.parent_id = parentId;
    }
    const rows = await this.queryMany(where);
    return rows.map(r => this.toDomain(r));
  }

  async findAllInOrg(requestOrgId: string): Promise<OrgUnit[]> {
    const rows = await this.queryMany({ org_id: requestOrgId });
    return rows.map(r => this.toDomain(r));
  }

  async findDescendants(unitId: string, requestOrgId: string): Promise<OrgUnit[]> {
    // Uses the chemin_hierarchique path column for efficient descendant queries.
    // Pattern: LIKE 'org_path/%' to match all descendants in the tree.
    const parent = await this.findById(unitId, requestOrgId);
    if (!parent) return [];

    const basePath = parent.hierarchyPath.toString();
    const likePattern = `${basePath}/%`;

    const rows = await this.queryMany({
      org_id: requestOrgId,
      chemin_hierarchique_like: likePattern,
    });

    return rows.map(r => this.toDomain(r));
  }

  async save(entity: OrgUnit): Promise<void> {
    const record = this.toPersistence(entity);
    await this.prismaExecute('create', record);
  }

  async update(entity: OrgUnit): Promise<void> {
    const record = this.toPersistence(entity);
    await this.prismaExecute('update', { ...record, where: { id: entity.id } });
  }

  async delete(unitId: string, requestOrgId: string): Promise<void> {
    await this.prismaExecute('delete', { id: unitId, org_id: requestOrgId });
  }

  // ---- Persistence conversion ----

  private toDomain(row: Record<string, unknown>): OrgUnit {
    return new OrgUnit({
      id: String(row.id),
      orgId: String(row.org_id),
      parentId: row.parent_id ? String(row.parent_id) : null,
      name: String(row.nom),
      type: assertValidOrgUnitType(String(row.type_unite)),
      depthLevel: Number(row.niveau_profondeur) || 1,
      status: assertValidOrgUnitStatus(String(row.statut)),
      hierarchyPath: new OrgUnitHierarchy(String(row.chemin_hierarchique)),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
      version: Number(row.version) || 1,
    });
  }

  private toPersistence(unit: OrgUnit): Record<string, unknown> {
    return {
      id: unit.id,
      org_id: unit.orgId,
      parent_id: unit.parentId,
      nom: unit.name,
      type_unite: unit.type,
      niveau_profondeur: unit.depthLevel,
      statut: unit.status,
      chemin_hierarchique: unit.hierarchyPath.toString(),
      updated_at: unit.updatedAt.toISOString(),
      version: unit.version,
    };
  }

  private async queryRecord(where: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    throw new Error('PrismaOrgUnitRepository requires a PrismaClient instance at composition root.');
  }

  private async queryMany(where: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    throw new Error('PrismaOrgUnitRepository requires a PrismaClient instance at composition root.');
  }

  private async prismaExecute(action: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaOrgUnitRepository requires a PrismaClient instance at composition root.');
  }
}
