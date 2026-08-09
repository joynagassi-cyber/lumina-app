/**
 * CycleDetector — Domain Service
 * Implements Kahn's algorithm for topological sort to detect cycles in the org_unit DAG.
 * Must run BEFORE any insert/update of OrgUnitLink (BR-REL-001).
 * @traceability DOC-012 §Aggregate 4, DOC-023 §3.4, BR-REL-001
 */

import { OrgUnitLink } from '../entities/org-unit-link.entity';

/**
 * Directed graph edge representation for cycle detection.
 */
interface GraphEdge {
  from: string;
  to: string;
}

/**
 * Kahn's algorithm for DAG cycle detection.
 * Returns an empty array when no cycle is found (valid DAG).
 * Returns the cycle path when a cycle is detected.
 *
 * Algorithm: O(V + E) time, O(V + E) space.
 */
export class CycleDetector {
  /**
   * Checks whether adding a new edge (from → to) would create a cycle.
   * `to` is the potential new parent of `from`.
   * A cycle occurs if `to` is already an ancestor of `from`.
   */
  static wouldCreateCycle(
    existingLinks: OrgUnitLink[],
    childUuid: string,
    parentUuid: string,
    orgId: string,
  ): boolean {
    if (childUuid === parentUuid) {
      return true; // An org unit cannot be its own parent (BR-ORG-003).
    }

    const visited = new Set<string>();
    return this._wouldReach(childUuid, parentUuid, existingLinks, visited);
  }

  /**
   * Full DAG validation: returns true if the graph is acyclic.
   * Uses Kahn's algorithm on the provided edges.
   */
  static validateDag(edges: GraphEdge[]): boolean {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const edge of edges) {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, []);
      }
      adjacency.get(edge.from)!.push(edge.to);

      if (!inDegree.has(edge.from)) {
        inDegree.set(edge.from, 0);
      }
      if (!inDegree.has(edge.to)) {
        inDegree.set(edge.to, 0);
      }
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [node, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    let processed = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      processed += 1;

      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return processed === inDegree.size;
  }

  /**
   * DFS helper: can `ancestor` reach `target` following existing parent links?
   * If yes, adding parent → ancestor creates a cycle.
   */
  private static _wouldReach(
    ancestorUuid: string,
    targetUuid: string,
    allLinks: OrgUnitLink[],
    visited: Set<string>,
  ): boolean {
    if (ancestorUuid === targetUuid) {
      return true;
    }

    if (visited.has(ancestorUuid)) {
      return false;
    }
    visited.add(ancestorUuid);

    // Find links where this node IS the child (i.e., current → parent)
    const parentLinks = allLinks.filter(
      (link) => link.childOrgUnitUuid === ancestorUuid,
    );

    for (const link of parentLinks) {
      if (this._wouldReach(link.parentOrgUnitUuid!, targetUuid, allLinks, visited)) {
        return true;
      }
    }

    return false;
  }
}
