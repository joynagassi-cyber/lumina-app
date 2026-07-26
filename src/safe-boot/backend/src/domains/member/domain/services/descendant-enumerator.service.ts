/**
 * DescendantEnumerator — Domain Service
 * DFS traversal of the hierarchical org_unit tree to enumerate all descendants.
 * Used for reporting, transfer operations (BR-REL-003), and merge.
 * @traceability DOC-012 §Aggregate 4, BR-REL-003, BR-REL-004
 */

import { OrgUnitLink } from '../entities/org-unit-link.entity';

/**
 * Represents a descendant in the enumeration result.
 */
export interface DescendantNode {
  /** The org unit UUID. */
  uuid: string;
  /** Depth relative to the queried ancestor (1 = direct child). */
  depth: number;
  /** The parent link connecting this node. */
  link: OrgUnitLink;
}

/**
 * DFS-based descendant enumeration service.
 * Returns all descendants up to MAX_DEPTH level from the source.
 */
export class DescendantEnumerator {
  private static readonly MAX_DEPTH = 5;

  /**
   * Enumerates all descendants of a given org unit.
   * Traverses the DAG using DFS with cycle protection via visited set.
   * Supports bidirectional visibility (BR-REL-004).
   */
  static enumerate(
    rootUuid: string,
    allLinks: OrgUnitLink[],
  ): DescendantNode[] {
    const results: DescendantNode[] = [];
    const visited = new Set<string>();

    this._dfs(rootUuid, allLinks, results, visited, 0);

    return results;
  }

  /**
   * Gets the depth of an org unit in the hierarchy (distance from root).
   */
  static getDepth(
    targetUuid: string,
    allLinks: OrgUnitLink[],
  ): number {
    if (!allLinks.length) {
      return 1;
    }
    return this._walkUp(targetUuid, allLinks, 1);
  }

  /**
   * Collects all ancestors of an org unit up to the root.
   * Returns empty array if root reached.
   */
  static collectAncestors(
    targetUuid: string,
    allLinks: OrgUnitLink[],
  ): string[] {
    const ancestors: string[] = [];
    let current = targetUuid;
    const visited = new Set<string>();

    while (current !== null && !visited.has(current)) {
      visited.add(current);
      const parentLink = allLinks.find(
        (link) => link.childOrgUnitUuid === current && link.parentOrgUnitUuid !== null,
      );
      if (parentLink?.parentOrgUnitUuid) {
        ancestors.push(parentLink.parentOrgUnitUuid);
        current = parentLink.parentOrgUnitUuid;
      } else {
        break;
      }
    }

    return ancestors;
  }

  private static _dfs(
    currentUuid: string,
    allLinks: OrgUnitLink[],
    results: DescendantNode[],
    visited: Set<string>,
    depth: number,
  ): void {
    if (depth > this.MAX_DEPTH) {
      return;
    }

    if (visited.has(currentUuid)) {
      return; // Prevent infinite loop on corrupted graph
    }
    visited.add(currentUuid);

    const directChildren = allLinks.filter(
      (link) => link.parentOrgUnitUuid === currentUuid,
    );

    for (const childLink of directChildren) {
      results.push({
        uuid: childLink.childOrgUnitUuid,
        depth: depth + 1,
        link: childLink,
      });

      this._dfs(
        childLink.childOrgUnitUuid,
        allLinks,
        results,
        visited,
        depth + 1,
      );
    }
  }

  private static _walkUp(
    uuid: string,
    allLinks: OrgUnitLink[],
    currentDepth: number,
  ): number {
    const parentLink = allLinks.find(
      (link) => link.childOrgUnitUuid === uuid && link.parentOrgUnitUuid !== null,
    );
    if (!parentLink?.parentOrgUnitUuid) {
      return currentDepth;
    }
    return this._walkUp(parentLink.parentOrgUnitUuid, allLinks, currentDepth + 1);
  }
}
