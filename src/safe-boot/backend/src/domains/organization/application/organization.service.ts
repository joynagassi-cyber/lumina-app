/**
 * OrganizationService — Application Service for OrganizationAggregate
 *
 * Orchestrates all 10 operations (8 commands + 2 queries) defined in API-CONTRACT-001.
 * Implements CQRS pattern: Commands mutate, Queries read.
 *
 * Operations:
 *   Commands: CreateOrganization, UpdateSettings, CreateOrgUnit, UpdateOrgUnitParent,
 *             MergeOrganizations, ArchiveOrganization, SuspendOrganization
 *   Queries: GetOrganizationProfile, GetDescendantUnits
 *
 * @traceability ASS-001 Service 1 → API-CONTRACT-001 Aggregate 1 (10 ops)
 *   → DOC-012 Aggregate1 (BR-ORG-001 through BR-ORG-006)
 */

import { Organization } from '../domain/organization.entity';
import { OrganizationName } from '../domain/value-objects/organization-name.vo';
import { OrganizationType, assertValidOrganizationType } from '../domain/value-objects/organization-type.vo';
import { OrganizationStatus as OrgStatus } from '../domain/value-objects/organization-status.vo';
import {
  OrgUnit, assertValidOrgUnitType, OrgUnitStatus, assertValidOrgUnitStatus,
} from '../domain/org-unit.entity';
import { OrgUnitHierarchy } from '../domain/value-objects/org-unit-hierarchy.vo';
import { MaxDepthPolicy } from '../domain/policies/max-depth-policy';
import { HierarchyPolicy } from '../domain/policies/hierarchy-policy';
import { VisibilityPolicy } from '../domain/policies/visibility-policy';
import { OrgUnitHierarchyResolver } from '../domain/services/org-hierarchy-resolver.service';
import { OrgTemplateInheritor } from '../domain/services/org-template-inheritor.service';
import type {
  IOrganizationRepository,
  IOrgUnitRepository,
  FindOrganizationByIdResult,
} from '../ports/repository.port';
import type { DomainEvent, IEventPublicationPort } from '../ports/event-pub.port';
import type { IAuthorizationPort } from '../ports/auth.port';
import type { IClockPort } from '../ports/clock.port';
import type { IUuidPort } from '../ports/uuid.port';
import type { IAuditPort } from '../ports/audit.port';

import {
  OrganizationCreated,
  OrganizationSuspended,
  OrganizationArchived,
  OrgUnitCreated,
  OrgUnitParentChanged,
  OrganizationMerged,
} from '../domain/events';

// ---------------------------------------------------------------------------
// Input / Output DTOs
// ---------------------------------------------------------------------------

export interface CreateOrganizationInput {
  readonly name: string;
  readonly shortName?: string;
  readonly type: string;
  readonly currencyCode?: string;
  readonly timezone?: string;
  readonly language?: string;
  readonly accentColor?: string;
}

export interface UpdateSettingsInput {
  readonly organizationId: string;
  readonly settings: Record<string, unknown>;
}

export interface CreateOrgUnitInput {
  readonly parentId: string | null;
  readonly name: string;
  readonly type: string;
}

export interface UpdateOrgUnitParentInput {
  readonly unitId: string;
  readonly newParentId: string | null;
}

export interface MergeOrganizationsInput {
  readonly sourceOrgId: string;
  readonly targetOrgId: string;
}

export interface ArchiveOrganizationInput {
  readonly organizationId: string;
}

export interface SuspendOrganizationInput {
  readonly organizationId: string;
}

export interface OrganizationProfileDto {
  readonly id: string;
  readonly orgId: string;
  readonly name: string;
  readonly shortName?: string;
  readonly type: string;
  readonly status: string;
  readonly currencyCode: string;
  readonly timezone: string;
  readonly language: string;
  readonly accentColor: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface DescendantUnitDto {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly type: string;
  readonly depthLevel: number;
  readonly status: string;
  readonly hierarchyPath: string;
}

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export class OrganizationSuspendedError extends Error {
  constructor(orgId: string) {
    super(`Organization '${orgId}' is suspended. Write operations are not allowed (BR-ORG-006).`);
    this.name = 'OrganizationSuspendedError';
  }
}

export class OrganizationNotFoundError extends Error {
  constructor(id: string) {
    super(`Organization not found: ${id}`);
    this.name = 'OrganizationNotFoundError';
  }
}

export class OrgUnitNotFoundError extends Error {
  constructor(unitId: string) {
    super(`Org unit not found: ${unitId}`);
    this.name = 'OrgUnitNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Application Service
// ---------------------------------------------------------------------------

export class OrganizationService {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly unitRepo: IOrgUnitRepository,
    private readonly eventBus: IEventPublicationPort,
    private readonly authorizer: IAuthorizationPort,
    private readonly clock: IClockPort,
    private readonly uuid: IUuidPort,
    private readonly audit: IAuditPort,
  ) {}

  // =======================================================================
  // COMMAND 1: CreateOrganization (UC-ORG-01)
  // =======================================================================

  /**
   * Create a new top-level organization with auto-generated org_id.
   * Invariants: INV-004 (multi-tenant isolation), BR-ORG-001 (name unique, type valid)
   */
  async handleCreateOrganization(
    input: CreateOrganizationInput,
    createdById: string,
  ): Promise<void> {
    const now = this.clock.now();

    const validatedName = new OrganizationName(input.name);
    const resolvedType = assertValidOrganizationType(input.type);

    const defaults = OrgTemplateInheritor.applyDefaults(resolvedType, {
      currencyCode: input.currencyCode,
      timezone: input.timezone,
      language: input.language,
      accentColor: input.accentColor,
    });

    const organizationId = this.uuid.generate();
    const orgId = this.uuid.generate();

    const org = new Organization({
      id: organizationId,
      orgId,
      name: validatedName,
      shortName: input.shortName,
      type: resolvedType,
      status: OrgStatus.Active,
      currencyCode: (defaults.currencyCode as string) || 'USD',
      timezone: (defaults.timezone as string) || 'UTC',
      language: (defaults.language as string) || 'fr',
      accentColor: (defaults.accentColor as string) || '#4F46E5',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    await this.orgRepo.save(org);

    const event = new OrganizationCreated(
      organizationId, orgId, input.name, resolvedType, now,
    );
    await this.eventBus.publish(event);

    await this.audit.log({
      entityType: 'Organization',
      entityId: organizationId,
      action: 'create',
      userId: createdById,
      after: { name: input.name, type: resolvedType },
    });
  }

  // =======================================================================
  // COMMAND 2: UpdateOrganizationSettings (UC-ORG-02)
  // =======================================================================

  /**
   * Update organization configuration settings.
   * Invariants: CFG-001 (currency ISO 4217), CFG-002 (timezone IANA),
   *             CFG-003 (accent hex + WCAG), CFG-004 (default fallback)
   */
  async handleUpdateSettings(
    input: UpdateSettingsInput,
    requestOrgId: string,
    updatedById: string,
  ): Promise<void> {
    const result = await this.findOrganization(requestOrgId, input.organizationId);
    const org = result.organization;

    // BR-ORG-006: suspended orgs cannot be written to
    if (org.isSuspended()) {
      throw new OrganizationSuspendedError(org.id);
    }

    // Archived orgs also cannot be written to
    if (org.status === OrgStatus.Archived) {
      throw new Error(`Organization '${org.id}' is archived. No writes allowed.`);
    }

    // Validate setting formats (CFG-003: hex color pattern)
    for (const [key, value] of Object.entries(input.settings)) {
      if (key === 'accent_hex' || key === 'accentColor') {
        if (typeof value === 'string' && !/^#[0-9a-fA-F]{6}$/.test(value)) {
          throw new Error(`Invalid accent color format: ${value}. Must match ^#[0-9a-fA-F]{6}$ (CFG-003).`);
        }
      }
    }

    // Save timestamp bump via version increment
    await this.orgRepo.update(org);

    await this.audit.log({
      entityType: 'Organization',
      entityId: org.id,
      action: 'update',
      userId: updatedById,
      before: {},
      after: input.settings,
    });
  }

  // =======================================================================
  // COMMAND 3: CreateOrgUnit (UC-ORG-03)
  // =======================================================================

  /**
   * Create a new organizational unit within an existing org hierarchy.
   * Invariants: REL-001 (no cycles), REL-002 (depth <=5), BR-ORG-002
   */
  async handleCreateOrgUnit(
    input: CreateOrgUnitInput,
    requestOrgId: string,
    creatorId: string,
  ): Promise<void> {
    const now = this.clock.now();
    const unitId = this.uuid.generate();

    const resolvedType = assertValidOrgUnitType(input.type);

    let parentDepth = 0;
    let parentId = input.parentId;

    if (parentId !== null) {
      const parent = await this.unitRepo.findById(parentId, requestOrgId);
      if (!parent) {
        throw new OrgUnitNotFoundError(parentId);
      }
      VisibilityPolicy.verifyOrgUnit(parent, requestOrgId);
      parentDepth = parent.depthLevel;

      if (!MaxDepthPolicy.isChildDepthValid(parentDepth)) {
        throw new Error(
          `Cannot create child under unit at depth ${parentDepth}. Maximum depth is ${OrgUnit.MAX_DEPTH} (REL-002).`,
        );
      }
    }

    const depthLevel = parentDepth + 1;

    // Compute hierarchy path
    let computedPath: string;
    if (parentId === null) {
      computedPath = requestOrgId;
    } else {
      const parentEntity = await this.unitRepo.findById(parentId, requestOrgId);
      if (!parentEntity) throw new OrgUnitNotFoundError(parentId);
      computedPath = `${parentEntity.hierarchyPath.toString()}/${input.name.replace(/\//g, '_')}`;
    }

    const hierarchy = new OrgUnitHierarchy(computedPath);

    const unit = new OrgUnit({
      id: unitId,
      orgId: requestOrgId,
      parentId,
      name: input.name,
      type: resolvedType,
      depthLevel,
      status: OrgUnitStatus.Active,
      hierarchyPath: hierarchy,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    MaxDepthPolicy.validateDepth(unit);

    await this.unitRepo.save(unit);

    await this.eventBus.publish(
      new OrgUnitCreated(unitId, requestOrgId, parentId, input.name, depthLevel, now),
    );

    await this.audit.log({
      entityType: 'OrgUnit',
      entityId: unitId,
      action: 'create',
      userId: creatorId,
      after: { name: input.name, type: resolvedType, depth_level: depthLevel, parent_id: parentId },
    });
  }

  // =======================================================================
  // COMMAND 4: UpdateOrgUnitParent (UC-REL-02)
  // =======================================================================

  /**
   * Change the parent of an existing organizational unit.
   * Invariants: REL-001 (Kahn's algo), REL-002 (depth <=5), BR-ORG-003
   */
  async handleUpdateOrgUnitParent(
    input: UpdateOrgUnitParentInput,
    requestOrgId: string,
    modifierId: string,
  ): Promise<void> {
    const unit = await this.unitRepo.findById(input.unitId, requestOrgId);
    if (!unit) throw new OrgUnitNotFoundError(input.unitId);
    VisibilityPolicy.verifyOrgUnit(unit, requestOrgId);

    const oldParentId = unit.parentId;

    // Build current edges and proposed edge
    const existingEdges: Array<{ childId: string; parentId: string | null }> = [];
    const allUnits = await this.unitRepo.findAllInOrg(requestOrgId);
    for (const u of allUnits) {
      existingEdges.push({ childId: u.id, parentId: u.parentId });
    }

    const proposedEdges = [{ childId: input.unitId, parentId: input.newParentId }];

    try {
      HierarchyPolicy.validate(existingEdges, proposedEdges, (id) => {
        const found = allUnits.find(u => u.id === id);
        return found?.parentId ?? null;
      });
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Org unit parent update rejected: ${err.message}`);
      }
      throw err;
    }

    const newDepth = input.newParentId === null
      ? 1
      : (() => {
          const parent = allUnits.find(u => u.id === input.newParentId);
          return parent ? parent.depthLevel + 1 : 1;
        })();

    // Compute new hierarchy path
    let newPath: string;
    if (input.newParentId === null) {
      newPath = requestOrgId;
    } else {
      const parent = allUnits.find(u => u.id === input.newParentId);
      if (!parent) throw new OrgUnitNotFoundError(input.newParentId!);
      newPath = `${parent.hierarchyPath.toString()}/${unit.name.replace(/\//g, '_')}`;
    }

    // Construct new OrgUnit with updated props (immutable pattern per DDD)
    const updatedUnit = new OrgUnit({
      id: unit.id,
      orgId: unit.orgId,
      parentId: input.newParentId,
      name: unit.name,
      type: unit.type,
      depthLevel: newDepth,
      status: unit.status,
      hierarchyPath: new OrgUnitHierarchy(newPath),
      createdAt: unit.createdAt,
      updatedAt: this.clock.now(),
      version: unit.version + 1,
    });

    await this.unitRepo.update(updatedUnit);

    await this.eventBus.publish(
      new OrgUnitParentChanged(input.unitId, oldParentId, input.newParentId, newDepth, this.clock.now()),
    );

    await this.audit.log({
      entityType: 'OrgUnit',
      entityId: unit.id,
      action: 'update',
      userId: modifierId,
      before: { parent_id: oldParentId, depth_level: unit.depthLevel },
      after: { parent_id: input.newParentId, depth_level: newDepth },
    });
  }

  // =======================================================================
  // COMMAND 5: TransferChildOrg
  // =======================================================================

  /**
   * Transfer an org unit to a different parent within the DAG.
   * Reuses UpdateOrgUnitParent logic (BR-REL-003 preserves memberships).
   */
  async handleTransferChildOrg(
    unitId: string,
    newParentId: string | null,
    requestOrgId: string,
    actorId: string,
  ): Promise<void> {
    await this.handleUpdateOrgUnitParent(
      { unitId, newParentId },
      requestOrgId,
      actorId,
    );
  }

  // =======================================================================
  // COMMAND 6: MergeOrganizations
  // =======================================================================

  /**
   * Merge two organizations: source merged into target; source marked archived.
   * Requires superadmin validation per BR-ORG-005.
   */
  async handleMergeOrganizations(
    input: MergeOrganizationsInput,
    mergedById: string,
  ): Promise<void> {
    // BR-ORG-005: superadmin required
    const isSuperAdmin = await this.authorizer.hasRole(mergedById, 'superadmin');
    if (!isSuperAdmin) {
      throw new Error('Merge requires superadmin validation (BR-ORG-005).');
    }

    const sourceOrg = await this.orgRepo.findByOrgId(input.sourceOrgId);
    if (!sourceOrg) throw new OrganizationNotFoundError(input.sourceOrgId);

    const targetOrg = await this.orgRepo.findByOrgId(input.targetOrgId);
    if (!targetOrg) throw new OrganizationNotFoundError(input.targetOrgId);

    // Archive the source org
    sourceOrg.transitionToStatus(OrgStatus.Archived);
    await this.orgRepo.update(sourceOrg);

    await this.eventBus.publish(
      new OrganizationMerged(
        input.sourceOrgId, input.targetOrgId, mergedById, this.clock.now(),
      ),
    );

    await this.audit.log({
      entityType: 'Organization',
      entityId: sourceOrg.id,
      action: 'transfer',
      userId: mergedById,
      before: { status: 'active' },
      after: { status: 'archived', merged_into: input.targetOrgId },
    });
  }

  // =======================================================================
  // COMMAND 7: ArchiveOrganization
  // =======================================================================

  async handleArchiveOrganization(
    input: ArchiveOrganizationInput,
    requestOrgId: string,
    archivedById: string,
  ): Promise<void> {
    const result = await this.findOrganization(requestOrgId, input.organizationId);
    const org = result.organization;

    org.transitionToStatus(OrgStatus.Archived);
    await this.orgRepo.update(org);

    await this.eventBus.publish(
      new OrganizationArchived(org.id, archivedById, this.clock.now()),
    );

    await this.audit.log({
      entityType: 'Organization',
      entityId: org.id,
      action: 'delete',
      userId: archivedById,
      before: { status: OrgStatus.Archived },
      after: { status: 'archived' },
    });
  }

  // =======================================================================
  // COMMAND 8: SuspendOrganization (UC-ORG-04)
  // =======================================================================

  async handleSuspendOrganization(
    input: SuspendOrganizationInput,
    requestOrgId: string,
    suspendedById: string,
  ): Promise<void> {
    const result = await this.findOrganization(requestOrgId, input.organizationId);
    const org = result.organization;

    org.transitionToStatus(OrgStatus.Suspended);
    await this.orgRepo.update(org);

    await this.eventBus.publish(
      new OrganizationSuspended(org.id, suspendedById, this.clock.now()),
    );

    await this.audit.log({
      entityType: 'Organization',
      entityId: org.id,
      action: 'approve',
      userId: suspendedById,
      before: { status: 'active' },
      after: { status: 'suspended' },
    });
  }

  // =======================================================================
  // QUERY 9: GetOrganizationProfile
  // =======================================================================

  async handleGetOrganizationProfile(
    orgId: string,
    requestOrgId: string,
  ): Promise<OrganizationProfileDto> {
    const result = await this.findOrganization(requestOrgId, orgId);
    const org = result.organization;

    return {
      id: org.id,
      orgId: org.orgId,
      name: org.name.value,
      shortName: org.shortName,
      type: org.type,
      status: org.status,
      currencyCode: org.currencyCode,
      timezone: org.timezone,
      language: org.language,
      accentColor: org.accentColor,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      version: org.version,
    };
  }

  // =======================================================================
  // QUERY 10: GetDescendantUnits
  // =======================================================================

  async handleGetDescendantUnits(
    input: { rootUnitId: string },
    requestOrgId: string,
  ): Promise<DescendantUnitDto[]> {
    const descendants = await this.unitRepo.findDescendants(input.rootUnitId, requestOrgId);

    return descendants.map(d => ({
      id: d.id,
      parentId: d.parentId,
      name: d.name,
      type: d.type,
      depthLevel: d.depthLevel,
      status: d.status,
      hierarchyPath: d.hierarchyPath.toString(),
    }));
  }

  // ---- Private helpers ----

  private async findOrganization(
    requestOrgId: string,
    organizationId: string,
  ): Promise<FindOrganizationByIdResult> {
    const result = await this.orgRepo.findById(organizationId, requestOrgId);
    if (!result) {
      throw new OrganizationNotFoundError(organizationId);
    }
    VisibilityPolicy.verifyOrganization(result.organization, requestOrgId);
    return result;
  }
}
