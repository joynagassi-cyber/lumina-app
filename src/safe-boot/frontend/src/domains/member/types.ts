/**
 * Member Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate) - MemberRecord entity
 * @traceability DOC-006: Resource concept including members
 * @traceability DOC-021: Physical Data Model table members
 * @traceability ASS-001: Application Services for member operations
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Member state machine per BR-MEM-001 lifecycle transitions.
 * Source: CANONICAL-DOMAIN-MODEL.md MemberState VO.
 */
export type MemberState = 'active' | 'inactive' | 'deceased' | 'transferred';

/**
 * Member membership type within a group.
 */
export type MembershipType = 'member' | 'observer' | 'leader';

/**
 * Organization unit role for a member.
 */
export type OrgUnitRole = 'admin' | 'member' | 'guest';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * MemberAggregate root entity — member profile within an organization.
 * Maps to physical table `members` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface MemberProfile {
  /** Universally unique identifier for this member. */
  readonly id: string;

  /** Organization this member belongs to. */
  readonly organizationId: string;

  /** First name of the member. */
  readonly firstName: string;

  /** Last name of the member. */
  readonly lastName: string;

  /** Full name computed from firstName + lastName. */
  readonly fullName: string;

  /** Email address (optional). */
  readonly email: string | null;

  /** Phone number (optional). */
  readonly phone: string | null;

  /** Birth date (optional). */
  readonly birthDate: string | null;

  /** Gender (optional). */
  readonly gender: string | null;

  /** Current membership state. */
  readonly state: MemberState;

  /** Unique member number assigned by the organization. */
  readonly memberNumber: string;

  /** Date the member joined the organization. */
  readonly joinDate: string;

  /** Date the member left (null if still active). */
  readonly leaveDate: string | null;

  /** Transfer certificate documentation (optional). */
  readonly transferCertificate: Record<string, unknown> | null;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;

  /** Metadata attached to the member (custom fields). */
  readonly metadata: Record<string, unknown>;
}

/**
 * Group membership record for a member.
 */
export interface GroupMembership {
  /** Unique identifier for this membership record. */
  readonly id: string;

  /** Group ID the member belongs to. */
  readonly groupId: string;

  /** Member ID referenced. */
  readonly memberId: string;

  /** Role within the group. */
  readonly role: MembershipType;

  /** Date the membership was created. */
  readonly createdAt: string;

  /** Date the membership ended (null if active). */
  readonly endDate: string | null;

  /** Current membership status. */
  readonly status: 'active' | 'inactive' | 'pending';
}

/**
 * Organizational unit hierarchy node.
 */
export interface OrgUnitNode {
  /** Unique identifier for the unit. */
  readonly id: string;

  /** Display name of the unit. */
  readonly name: string;

  /** Parent unit ID (null for root). */
  readonly parentId: string | null;

  /** Full hierarchy path. */
  readonly hierarchyPath: string;

  /** Depth level in the hierarchy. */
  readonly depthLevel: number;

  /** Unit status (active or archived). */
  readonly status: 'active' | 'archived';

  /** Children nodes (recursive). */
  readonly children: ReadonlyArray<OrgUnitNode>;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for CreateMember command.
 * Maps to ASS-001 CreateMember operation.
 */
export interface CreateMemberInput {
  /** Organization ID (injected from context). */
  readonly organizationId: string;

  /** First name (required, per BR-MEM-001). */
  readonly firstName: string;

  /** Last name (required, per BR-MEM-001). */
  readonly lastName: string;

  /** Email (optional, unique per org per BR-MEM-002). */
  readonly email?: string;

  /** Phone number (optional). */
  readonly phone?: string;

  /** Birth date (optional). */
  readonly birthDate?: string;

  /** Gender (optional). */
  readonly gender?: string;

  /** Member number (optional, auto-generated if not provided). */
  readonly memberNumber?: string;

  /** Initial state (default: 'active'). */
  readonly state?: MemberState;

  /** Metadata/custom fields. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Input for UpdateMember command.
 */
export interface UpdateMemberInput {
  /** Member ID to update. */
  readonly memberId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** First name (optional update). */
  readonly firstName?: string;

  /** Last name (optional update). */
  readonly lastName?: string;

  /** Email (optional update). */
  readonly email?: string;

  /** Phone (optional update). */
  readonly phone?: string;

  /** Birth date (optional update). */
  readonly birthDate?: string;

  /** Gender (optional update). */
  readonly gender?: string;

  /** State transition (triggers lifecycle validation). */
  readonly state?: MemberState;

  /** Metadata update. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Input for ListMembers query.
 */
export interface ListMembersInput {
  /** Organization ID. */
  readonly organizationId: string;

  /** Filter by state (optional). */
  readonly state?: MemberState;

  /** Search query (by name, email, memberNumber). */
  readonly search?: string;

  /** Pagination: page number (default: 1). */
  readonly page?: number;

  /** Pagination: items per page (default: 20, max: 100). */
  readonly limit?: number;
}

/**
 * Input for LinkGroupMembership command.
 */
export interface LinkGroupMembershipInput {
  /** Member ID to link. */
  readonly memberId: string;

  /** Group ID to link to. */
  readonly groupId: string;

  /** Role within the group (default: 'member'). */
  readonly role?: MembershipType;
}

/**
 * Input for UnlinkGroupMembership command.
 */
export interface UnlinkGroupMembershipInput {
  /** Membership ID to remove. */
  readonly membershipId: string;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Generic pagination response used across list endpoints.
 */
export interface PaginatedResponse<T> {
  /** Items in the current page. */
  readonly items: ReadonlyArray<T>;

  /** Total count of items matching the query. */
  readonly totalCount: number;

  /** Whether there is a next page. */
  readonly hasNextPage: boolean;
}

/**
 * Aggregated structure returned by useMembers().
 */
export interface MemberDomainModel {
  /** List of members for the organization. */
  readonly members: ReadonlyArray<MemberProfile>;

  /** Total count matching filters. */
  readonly totalCount: number;

  /** Currently selected member (if any). */
  readonly selectedMember: MemberProfile | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 * Group membership aggregation.
 */
export interface GroupMembershipDomainModel {
  /** Member's group memberships. */
  readonly memberships: ReadonlyArray<GroupMembership>;

  /** Total count. */
  readonly totalCount: number;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 * Organization unit hierarchy aggregation.
 */
export interface OrgUnitHierarchyDomainModel {
  /** Root node of the hierarchy tree. */
  readonly root: OrgUnitNode | null;

  /** Organization ID the hierarchy belongs to. */
  readonly organizationId: string | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/*  WatermelonDB Attributes                                            */
/* ------------------------------------------------------------------ */

/**
 * Attributes for the Member WatermelonDB model.
 */
export interface MemberAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  state: MemberState;
  memberNumber: string;
  joinDate: string;
  leaveDate: string | null;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: string; // JSON serialized
}