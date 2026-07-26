/**
 * IGroupMembershipRepository — Port for persisting GroupMembership entities.
 * Implements Dependency Inversion: the domain depends on this interface, not on Prisma.
 * @traceability DOC-012 §Aggregate 4, POSTGRESQL-SCHEMA-PACK-v1.md Table 11, NB-RR-001
 */

import type { GroupMembership, GroupMembershipData } from '../domain/entities/group-membership.entity';

export interface IGroupMembershipRepository {
  /**
   * Find a single group membership by its primary key.
   */
  findById(id: string): Promise<GroupMembership | null>;

  /**
   * Find all memberships for a specific member across all groups.
   * Supports bidirectional visibility (BR-REL-004).
   */
  findByMemberId(memberUuid: string, orgId: string): Promise<GroupMembership[]>;

  /**
   * Find all members belonging to a specific group/org_unit.
   * Supports bidirectional visibility (BR-REL-004).
   */
  findByGroupId(groupOrgUnitUuid: string, orgId: string): Promise<GroupMembership[]>;

  /**
   * Check whether a (member, group) pair already exists — prevents duplicates.
   * Enforces UNIQUE(membre_id, groupe_id) per CC-MEM-GRP-002.
   */
  exists(memberUuid: string, groupOrgUnitUuid: string, orgId: string): Promise<boolean>;

  /**
   * Create a new group membership record.
   */
  create(data: Omit<GroupMembershipData, 'id'>): Promise<GroupMembership>;

  /**
   * Update an existing group membership record.
   */
  update(id: string, data: Partial<Omit<GroupMembershipData, 'id'>>): Promise<GroupMembership>;

  /**
   * Delete (soft-tombstone via departure date) a group membership.
   */
  deleteById(id: string): Promise<void>;

  /**
   * List all memberships for a given org unit within an org.
   * Used during transfer/merge operations.
   */
  listByGroup(groupOrgUnitUuid: string, orgId: string): Promise<GroupMembership[]>;
}
