/**
 * Repository Ports — OrganizationAggregate
 *
 * Defines the contracts for persisting and querying Organization and OrgUnit entities.
 * Consumers depend on these interfaces, infrastructure adapters implement them.
 *
 * @traceability DOC-012 Aggregate1 → POSTGRESQL-SCHEMA-PACK-v1 tables: organizations, org_units
 *   → DOC-023 §8 Multi-tenant isolation (org_id on ALL methods)
 *   → PAS-005 PA-NB-007 (RepositoryAbstraction — persistence metadata stripped at boundary)
 */

import { Organization } from '../domain/organization.entity';
import { OrgUnit, OrgUnitProps } from '../domain/org-unit.entity';

export interface FindOrganizationByIdResult {
  organization: Organization;
}

export interface FindOrganizationByOrgIdResult {
  organization: Organization;
}

/**
 * Repository for the Organization aggregate root.
 * All operations are scoped to a specific org via request_org_id.
 */
export interface IOrganizationRepository {
  findById(organizationId: string, requestOrgId: string): Promise<FindOrganizationByIdResult | null>;
  findByOrgId(orgId: string): Promise<Organization | null>;
  findByName(name: string): Promise<Organization | null>;
  save(entity: Organization): Promise<void>;
  update(entity: Organization): Promise<void>;
}

/**
 * Repository for the OrgUnit entity within the OrganizationAggregate context.
 * All queries MUST include org_id per NB-MT-002.
 */
export interface IOrgUnitRepository {
  findById(unitId: string, requestOrgId: string): Promise<OrgUnit | null>;
  findByParentId(parentId: string | null, requestOrgId: string): Promise<OrgUnit[]>;
  findAllInOrg(requestOrgId: string): Promise<OrgUnit[]>;
  findDescendants(unitId: string, requestOrgId: string): Promise<OrgUnit[]>;
  save(entity: OrgUnit): Promise<void>;
  update(entity: OrgUnit): Promise<void>;
  delete(unitId: string, requestOrgId: string): Promise<void>;
}
