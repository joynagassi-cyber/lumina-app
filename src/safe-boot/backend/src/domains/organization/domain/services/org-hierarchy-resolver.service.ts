/**
 * OrgHierarchyResolver Domain Service
 *
 * Resolves and validates the organizational hierarchy DAG.
 * Detects cycles via Kahn's topological sort before INSERT/UPDATE of parent links.
 * Enforces max depth of 5 levels per BR-ORG-002 / REL-002.
 *
 * @traceability DOC-012 Aggregate1 §DomainService-OrgHierarchyResolver
 *   → DOC-023 §4.2/§4.3 DAG + cycle detection
 *   → PAS-003 DR-001 (Domain Independence — no Port dependencies)
 */

export class CycleDetectedError extends Error {
  constructor(units: string[]) {
    super(`Cycle detected in org unit hierarchy involving units: ${units.join(', ')}.`);
    this.name = 'CycleDetectedError';
  }
}

export class DepthExceededError extends Error {
  constructor(unitId: string, currentDepth: number) {
    super(
      `Organization unit '${unitId}' would exceed maximum depth of ${OrgUnitHierarchyResolver.MAX_DEPTH}. Current depth would be ${currentDepth}.`,
    );
    this.name = 'DepthExceededError';
  }
}

/**
 * Represents a parent-child edge in the org hierarchy.
 */
export interface OrgHierarchyEdge {
  readonly childId: string;
  readonly parentId: string | null;
}

export class OrgUnitAlreadyOwnChildError extends Error {
  constructor(unitId: string) {
    super(`Organization unit '${unitId}' cannot become its own descendant (BR-ORG-003).`);
    this.name = 'OrgUnitAlreadyOwnChildError';
  }
}

export class OrgUnitHierarchyResolver {
  static readonly MAX_DEPTH = 5;

  /**
   * Validate that adding the proposed edges does not create a cycle.
   * Uses Kahn's algorithm for topological sort.
   *
   * @param existingEdges — all current parent-child relationships
   * @param proposedEdges — new or modified edges to validate
   * @throws CycleDetectedError if a cycle is found
   */
  static validateNoCycles(
    existingEdges: OrgHierarchyEdge[],
    proposedEdges: OrgHierarchyEdge[],
  ): void {
    const allEdges = [...existingEdges];

    // Remove edges being replaced (same childId)
    const proposedChildIds = new Set(proposedEdges.map(e => e.childId));
    for (let i = allEdges.length - 1; i >= 0; i--) {
      if (proposedChildIds.has(allEdges[i].childId)) {
        allEdges.splice(i, 1);
      }
    }

    // Add proposed edges
    allEdges.push(...proposedEdges);

    // Kahn's algorithm
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, Set<string>>();

    const allNodeIds = new Set<string>();
    for (const edge of allEdges) {
      allNodeIds.add(edge.childId);
      if (edge.parentId) {
        allNodeIds.add(edge.parentId);
      }
    }

    for (const nodeId of allNodeIds) {
      inDegree.set(nodeId, 0);
      adjacency.set(nodeId, new Set());
    }

    for (const edge of allEdges) {
      if (edge.parentId) {
        inDegree.set(edge.childId, (inDegree.get(edge.childId) || 0) + 1);
        adjacency.get(edge.parentId)?.add(edge.childId);
      }
    }

    const queue: string[] = [];
    for (const [node, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    let processedCount = 0;
    while (queue.length > 0) {
      const node = queue.shift()!;
      processedCount++;

      for (const child of adjacency.get(node) || []) {
        inDegree.set(child, inDegree.get(child)! - 1);
        if (inDegree.get(child) === 0) {
          queue.push(child);
        }
      }
    }

    if (processedCount !== allNodeIds.size) {
      const cycleNodes = Array.from(allNodeIds);
      throw new CycleDetectedError(cycleNodes);
    }
  }

  /**
   * Compute the depth of a given node by traversing up through parent links.
   * Returns the depth (root = 1).
   *
   * @param nodeId — the org unit ID to compute depth for
   * @param lookupFn — function to resolve parent of a given node ID
   * @throws DepthExceededError if depth exceeds MAX_DEPTH
   */
  static computeDepth(
    nodeId: string,
    lookupFn: (id: string) => string | null,
  ): number {
    let depth = 1;
    let current: string | null = nodeId;
    const visited = new Set<string>();

    while (current !== null) {
      if (visited.has(current)) {
        throw new CycleDetectedError([current]);
      }
      visited.add(current);
      current = lookupFn(current);
      depth++;
      if (depth > OrgUnitHierarchyResolver.MAX_DEPTH) {
        throw new DepthExceededError(nodeId, depth);
      }
    }

    return depth;
  }

  /**
   * Check if candidateNode is already an ancestor or descendant of selfId.
   * Used for BR-ORG-003: an OrgUnit cannot become its own parent.
   */
  static isDescendantOrSelf(
    candidateAncestorId: string,
    candidateDescendantId: string,
    lookupFn: (id: string) => string | null,
  ): boolean {
    let current: string | null = candidateDescendantId;
    const visited = new Set<string>();

    while (current !== null && current !== candidateAncestorId) {
      if (visited.has(current)) return false;
      visited.add(current);
      current = lookupFn(current);
    }

    return current === candidateAncestorId;
  }
}
