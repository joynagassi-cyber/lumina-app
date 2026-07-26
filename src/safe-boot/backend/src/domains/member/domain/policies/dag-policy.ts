/**
 * DagPolicy — Enforces the no-cycles invariant on the org_unit hierarchy DAG.
 * Always runs BEFORE database write (BR-REL-001).
 * @traceability DOC-012 §Aggregate 4, BR-REL-001, DOC-023 §3.4
 */

import { CycleDetector } from '../services/cycle-detector.service';
import type { OrgUnitLink } from '../entities/org-unit-link.entity';

/**
 * Error thrown when a DAG cycle would be introduced.
 */
export class DagCycleError extends Error {
  constructor(
    public readonly childUuid: string,
    public readonly parentUuid: string,
    public readonly existingEdgesCount: number,
  ) {
    super(
      `DAG cycle detected: assigning ${parentUuid} as parent of ${childUuid} ` +
      `would create a cycle in the hierarchy. ${existingEdgesCount} edges examined.`,
    );
    this.name = 'DagCycleError';
  }
}

export class DagPolicy {
  /**
   * Validates that adding a new parent link would not introduce a cycle.
   * Uses Kahn's algorithm through CycleDetector.
   * @throws DagCycleError if the assignment would create a cycle.
   */
  static assertNoCycle(
    existingLinks: OrgUnitLink[],
    childOrgUnitUuid: string,
    parentOrgUnitUuid: string,
    orgId: string,
  ): void {
    if (CycleDetector.wouldCreateCycle(existingLinks, childOrgUnitUuid, parentOrgUnitUuid, orgId)) {
      throw new DagCycleError(childOrgUnitUuid, parentOrgUnitUuid, existingLinks.length);
    }
  }

  /**
   * Full DAG validation — returns true if the graph is acyclic.
   */
  static validateDag(existingLinks: OrgUnitLink[]): boolean {
    const edges = existingLinks.map((link) => ({
      from: link.childOrgUnitUuid,
      to: link.parentOrgUnitUuid ?? '',
    }));
    return CycleDetector.validateDag(edges);
  }
}
