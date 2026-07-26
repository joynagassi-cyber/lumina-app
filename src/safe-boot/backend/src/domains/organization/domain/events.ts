/**
 * Domain Events for OrganizationAggregate
 *
 * All events defined per DOC-014 registry.
 * Each event implements the DomainEvent contract.
 *
 * @traceability DOC-012 Aggregate1 §DomainEvents
 *   → DOC-014 Event Registry → API-CONTRACT-001 → ASS-001 Service 1
 *   → PAS-005 PA-NB-006 (EventConsistency — payloads never modified)
 */

export interface DomainEvent {
  readonly aggregateId: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;
}

// ---- Organization Events ----

export class OrganizationCreated implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'OrganizationCreated';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(organizationId: string, orgId: string, name: string, type: string, timestamp: Date) {
    this.aggregateId = organizationId;
    this.timestamp = timestamp;
    this.payload = { org_id: orgId, name, type };
  }
}

export class OrganizationSuspended implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'OrganizationSuspended';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(organizationId: string, suspendedBy: string, timestamp: Date) {
    this.aggregateId = organizationId;
    this.timestamp = timestamp;
    this.payload = { suspended_by: suspendedBy };
  }
}

export class OrganizationArchived implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'OrganizationArchived';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(organizationId: string, archivedBy: string, timestamp: Date) {
    this.aggregateId = organizationId;
    this.timestamp = timestamp;
    this.payload = { archived_by: archivedBy };
  }
}

// ---- OrgUnit Events ----

export class OrgUnitCreated implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'OrgUnitCreated';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    unitId: string,
    orgId: string,
    parentId: string | null,
    name: string,
    depthLevel: number,
    timestamp: Date,
  ) {
    this.aggregateId = unitId;
    this.timestamp = timestamp;
    this.payload = { org_id: orgId, parent_id: parentId, name, depth_level: depthLevel };
  }
}

export class OrgUnitParentChanged implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'OrgUnitParentChanged';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    unitId: string,
    oldParentId: string | null,
    newParentId: string | null,
    depthLevel: number,
    timestamp: Date,
  ) {
    this.aggregateId = unitId;
    this.timestamp = timestamp;
    this.payload = { old_parent_id: oldParentId, new_parent_id: newParentId, depth_level: depthLevel };
  }
}

// ---- Merge Event ----

export class OrganizationMerged implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'OrgMerged';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(sourceOrgId: string, targetOrgId: string, mergedBy: string, timestamp: Date) {
    this.aggregateId = sourceOrgId;
    this.timestamp = timestamp;
    this.payload = { source_org_id: sourceOrgId, target_org_id: targetOrgId, merged_by: mergedBy };
  }
}
