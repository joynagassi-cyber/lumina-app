/**
 * HierarchyPolicy
 *
 * Enforces DAG invariants on the organizational hierarchy:
 * - No cycles (enforced via OrgHierarchyResolver with Kahn's algorithm)
 * - Maximum depth of 5 levels (BR-ORG-002 / REL-002)
 * - An org unit cannot be its own parent or descendant (BR-ORG-003)
 *
 * @traceability DOC-012 Aggregate1 §Policies-HierarchyPolicy
 *   → DOC-023 §4.2/§4.3 (DAG, cycle detection, max depth)
 *   → DOC-012 RelationshipAggregate §BR-REL-001/BR-REL-002
 */

import {
  CycleDetectedError,
  DepthExceededError,
  OrgUnitHierarchyResolver,
  OrgUnitAlreadyOwnChildError,
} from '../services/org-hierarchy-resolver.service';
import type { OrgHierarchyEdge } from '../services/org-hierarchy-resolver.service';

export class HierarchyValidationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(`Hierarchy validation failed: ${message}`);
    this.name = 'HierarchyValidationError';
  }
}

export class HierarchyPolicy {
  /**
   * Validate all constraints for a set of proposed hierarchy edges.
   * Calls OrgHierarchyResolver internally.
   *
   * @param existingEdges — current edges in the DAG
   * @param proposedEdges — new or modified edges
   * @param lookupFn — function to resolve parent of a given node
   */
  static validate(
    existingEdges: OrgHierarchyEdge[],
    proposedEdges: OrgHierarchyEdge[],
    lookupFn: (id: string) => string | null,
  ): void {
    // BR-ORG-003: Each child must not already contain itself as ancestor/descendant
    for (const edge of proposedEdges) {
      if (edge.parentId === edge.childId) {
        throw new OrgUnitAlreadyOwnChildError(edge.childId);
      }
      if (OrgUnitHierarchyResolver.isDescendantOrSelf(edge.parentId!, edge.childId, lookupFn)) {
        throw new OrgUnitAlreadyOwnChildError(edge.childId);
      }
    }

    // REL-001: Kahn's algorithm cycle detection
    try {
      OrgUnitHierarchyResolver.validateNoCycles(existingEdges, proposedEdges);
    } catch (err) {
      if (err instanceof CycleDetectedError) {
        throw new HierarchyValidationError('Cycle detected in proposed hierarchy.', err);
      }
      throw err;
    }

    // REL-002 / BR-ORG-002: Depth check for each proposed node
    for (const edge of proposedEdges) {
      try {
        OrgUnitHierarchyResolver.computeDepth(edge.childId, lookupFn);
      } catch (err) {
        if (err instanceof DepthExceededError) {
          throw new HierarchyValidationError(
            `Depth exceeded for '${edge.childId}'.`,
            err,
          );
        }
        throw err;
      }
    }
  }
}
