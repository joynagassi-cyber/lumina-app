/**
 * Organization Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 1 (OrganizationAggregate)
 * @traceability DOC-006: Organization + OrgUnit concepts
 * @traceability DOC-021: Physical Data Model tables organization, org_units
 * @traceability ASS-001: Application Services for org operations
 */

import type { ConfigurationAggregate } from '../finance/types';

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Organization type enum per BR-ORG-001.
 * Source: CANONICAL-DOMAIN-MODEL.md OrganizationType VO.
 */
export type OrganizationType = 'church' | 'school' | 'ngo' | 'company' | 'custom';

/**
 * Organization status lifecycle per BR-ORG transitions.
 * Source: CANONICAL-DOMAIN-MODEL.md OrganizationStatus VO.
 */
export type OrganizationStatus = 'active' | 'suspended' | 'archived';

/**
 * Organization name value object — non-empty string wrapped.
 * Enforced by BR-ORG-001 (name non vide).
 */
export interface OrganizationName {
  readonly value: string;
}

/**
 * Hierarchy path string representing the DAG position.
 * Format: "org/chorale/soprano" — depth <= 5 (BR-ORG-002).
 */
export type OrgHierarchyPath = string;

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * OrganizationAggregate root entity.
 * Maps to physical table `organizations` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface OrganizationProfile {
  /** Universally unique identifier for this organization. */
  readonly id: string;

  /** Display name — non-empty per BR-ORG-001. */
  readonly name: string;

  /** Organization type: church/school/ngo/company/custom. */
  readonly type: OrganizationType;

  /** Current lifecycle status. */
  readonly status: OrganizationStatus;

  /** ISO 4217 currency code, e.g. "CDF", "USD" per BR-CONFIG-001. */
  readonly currency: string;

  /** Fiscal year start month (1–12). */
  readonly fiscalYearStart: number;

  /** IANA timezone, e.g. "Africa/Lubumbashi" per BR-CONFIG-002. */
  readonly timezone: string;

  /** Primary language tag (FR or EN). */
  readonly language: 'fr' | 'en';

  /** Hex color for the org accent, validated per BR-CONFIG-003. */
  readonly accentHex: string;

  /** Logo URL (optional). */
  readonly logoUrl: string | null;

  /** Short internal name (e.g. "MOMB" for naming conventions). */
  readonly shortName: string | null;

  /** Depth level within the organizational DAG (0 = root org). */
  readonly depthLevel: number;

  /** Ancestor hierarchy path (empty string at depth 0). */
  readonly hierarchyPath: string;

  /** Parent organization ID (null when root). */
  readonly parentId: string | null;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * Organizational unit within an OrganizationAggregate.
 * Maps to physical table `org_units` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface OrgUnit {
  /** Unique identifier for this org unit. */
  readonly id: string;

  /** Display name of the unit. */
  readonly name: string;

  /** Parent org unit ID (null when top-level under org root). */
  readonly parentId: string | null;

  /** Full hierarchy path for this unit. */
  readonly hierarchyPath: OrgHierarchyPath;

  /** Depth level within this unit's sub-tree (0-indexed). */
  readonly depthLevel: number;

  /** Whether this unit is active or archived. */
  readonly status: 'active' | 'archived';

  /** Organization this unit belongs to (enforced by visibility policy). */
  readonly organizationId: string;

  /** Timestamp of creation. */
  readonly createdAt: string;

  /** Timestamp of last update. */
  readonly updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for CreateOrganization command.
 * Maps to ASS-001 CreateOrganization operation.
 */
export interface CreateOrganizationInput {
  name: string;
  type: OrganizationType;
  currency?: string;
  fiscalYearStart?: number;
  timezone?: string;
  language?: 'fr' | 'en';
  accentHex?: string;
  shortName?: string | null;
  parentId?: string | null;
}

/**
 * Input for UpdateOrganizationSettings command.
 * Maps to ASS-001 UpdateOrgSettings operation.
 */
export interface UpdateOrganizationSettingsInput {
  currency?: string;
  fiscalYearStart?: number;
  timezone?: string;
  language?: 'fr' | 'en';
  accentHex?: string;
  showSkeletonLoading?: boolean;
  optimisticUpdatesEnabled?: boolean;
  animationDurationDefaultMs?: number;
}

/**
 * Input for CreateOrgUnit command.
 * Maps to ASS-001 CreateOrgUnit operation.
 */
export interface CreateOrgUnitInput {
  name: string;
  parentId?: string | null;
  organizationId: string;
}

/**
 * Input for UpdateOrgUnitParent command.
 * Triggers BR-ORG-003 cycle detection before execution.
 */
export interface ChangeOrgUnitParentInput {
  orgUnitId: string;
  newParentId: string | null;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Pagination cursor used across list endpoints.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly hasNextPage: boolean;
}

/**
 * Response shape for hierarchy resolution queries.
 */
export interface OrgHierarchyNode {
  readonly unit: OrgUnit;
  readonly children: ReadonlyArray<OrgHierarchyNode>;
}

/**
 * Aggregated structure returned by useOrganization().
 */
export interface OrganizationDomainModel {
  readonly profile: OrganizationProfile;
  readonly units: ReadonlyArray<OrgUnit>;
  readonly hierarchy: ReadonlyArray<OrgHierarchyNode>;
}
