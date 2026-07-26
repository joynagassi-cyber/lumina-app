/**
 * IOrgUnitLinkRepository — Port for persisting OrgUnitLink entities.
 * Enforces DAG invariants at the repository level (BR-REL-001).
 * @traceability DOC-012 §Aggregate 4, POSTGRESQL-SCHEMA-PACK-v1.md Table 12, DOC-023 §3.4
 */

import type { OrgUnitLink, OrgUnitLinkData } from '../domain/entities/org-unit-link.entity';

export interface IOrgUnitLinkRepository {
  /**
   * Find a single org unit link by its primary key.
   */
  findById(id: string): Promise<OrgUnitLink | null>;

  /**
   * Get the immediate parent of an org unit. Returns null if root.
   */
  findParent(childOrgUnitUuid: string, orgId: string): Promise<OrgUnitLink | null>;

  /**
   * List all direct children of a given parent org unit.
   */
  findChildren(parentOrgUnitUuid: string, orgId: string): Promise<OrgUnitLink[]>;

  /**
   * Check if a child→parent link already exists. Prevents duplicate edges in DAG.
   */
  exists(childOrgUnitUuid: string, parentOrgUnitUuid: string, orgId: string): Promise<boolean>;

  /**
   * Create a new parent-child link between org units.
   */
  create(data: Omit<OrgUnitLinkData, 'id'>): Promise<OrgUnitLink>;

  /**
   * Change the parent of an org unit. Returns the updated link.
   */
  updateParent(
    childOrgUnitUuid: string,
    newParentUuid: string | null,
  ): Promise<OrgUnitLink>;

  /**
   * Remove the parent link for an org unit (resets to root).
   */
  removeParent(childOrgUnitUuid: string): Promise<void>;

  /**
   * Delete a specific link record entirely.
   */
  deleteById(id: string): Promise<void>;

  /**
   * List all links for a given org.
   * Used during transfer operations (BR-REL-003).
   */
  listByOrg(orgId: string): Promise<OrgUnitLink[]>;
}
