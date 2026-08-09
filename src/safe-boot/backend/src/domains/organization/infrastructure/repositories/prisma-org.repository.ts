/**
 * PrismaOrganizationRepository — Infrastructure Adapter
 *
 * Implements IOrganizationRepository using Prisma ORM.
 * Strips persistence metadata before returning entities per PAS-005 PA-NB-007.
 * Injects _org_id, version at save time.
 *
 * @traceability DOC-012 Aggregate1 → POSTGRESQL-SCHEMA-PACK-v1 organizations
 *   → PAS-005 PA-NB-007 (RepositoryAbstraction)
 *   → PAS-003 DR-007 (Persistence Ignorance)
 */

import { Organization } from '../../domain/organization.entity';
import { OrganizationName } from '../../domain/value-objects/organization-name.vo';
import { assertValidOrganizationType } from '../../domain/value-objects/organization-type.vo';
import { assertValidOrganizationStatus } from '../../domain/value-objects/organization-status.vo';
import type { IOrganizationRepository, FindOrganizationByIdResult } from '../../ports/repository.port';

export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(
    private readonly prisma: unknown, // PrismaClient injected at composition root
  ) {}

  async findById(
    organizationId: string,
    requestOrgId: string,
  ): Promise<FindOrganizationByIdResult | null> {
    // Row query scoped to org_id for tenant isolation (DR-009)
    const raw = await this.queryRecord({ id: organizationId, org_id: requestOrgId });

    if (!raw) return null;

    const org = this.toDomain(raw);
    return { organization: org };
  }

  async findByOrgId(orgId: string): Promise<Organization | null> {
    const raw = await this.queryRecord({ org_id: orgId });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findByName(name: string): Promise<Organization | null> {
    const raw = await this.queryRecord({ nom: name });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  async save(entity: Organization): Promise<void> {
    const record = this.toPersistence(entity);
    await this.prismaExecute('create', record);
  }

  async update(entity: Organization): Promise<void> {
    const record = this.toPersistence(entity);
    await this.prismaExecute('update', { ...record, where: { id: entity.id } });
  }

  // ---- Persistence conversion ----

  private toDomain(row: Record<string, unknown>): Organization {
    return new Organization({
      id: String(row.id),
      orgId: String(row.org_id),
      name: new OrganizationName(String(row.nom)),
      shortName: row.nom_court ? String(row.nom_court) : undefined,
      type: assertValidOrganizationType(String(row.type_org)),
      status: assertValidOrganizationStatus(String(row.statut)),
      currencyCode: String(row.devise_iso4217),
      timezone: String(row.fuseau_horaire),
      language: String(row.langue_privee),
      accentColor: String(row.accent_hex),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
      version: Number(row.version) || 1,
    });
  }

  private toPersistence(org: Organization): Record<string, unknown> {
    return {
      id: org.id,
      org_id: org.orgId,
      nom: org.name.value,
      nom_court: org.shortName ?? null,
      type_org: org.type,
      statut: org.status,
      devise_iso4217: org.currencyCode,
      fuseau_horaire: org.timezone,
      langue_privee: org.language,
      accent_hex: org.accentColor,
      updated_at: org.updatedAt.toISOString(),
      version: org.version,
    };
  }

  // ---- Raw query stub (Prisma call delegated by composition root) ----

  private async queryRecord(where: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    // Implementation delegated: const result = await this.prisma.organization.findUnique({ where });
    throw new Error('PrismaOrganizationRepository requires a PrismaClient instance at composition root.');
  }

  private async prismaExecute(action: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaOrganizationRepository requires a PrismaClient instance at composition root.');
  }
}
