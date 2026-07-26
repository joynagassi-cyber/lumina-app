/**
 * MaxDepthPolicy
 *
 * Validates that no org unit exceeds the maximum allowed depth in the hierarchy.
 * This constraint is enforced at the domain layer (before reaching the DB)
 * per DOC-023 §4.3. The DB trigger acts as a second line of defense.
 *
 * @traceability DOC-012 Aggregate1 §Policies-MaxDepthPolicy
 *   → POSTGRESQL-SCHEMA-PACK-v1 org_units.niveau_profondeur CHECK BETWEEN 1 AND 5
   → CONSTRAINTS-INDEX-SPECIFICATION-v1 Line 177 (CHECK niveau_profondeur BETWEEN 1 AND 5)
 */

import { OrgUnit } from '../org-unit.entity';

export class MaxDepthExceededError extends Error {
  constructor(unitId: string, depth: number) {
    super(`Organization unit '${unitId}' at depth ${depth} exceeds maximum allowed depth of ${OrgUnit.MAX_DEPTH}.`);
    this.name = 'MaxDepthExceededError';
  }
}

export class MaxDepthPolicy {
  /**
   * Validate that an org unit's depth level is within bounds.
   */
  static validateDepth(unit: OrgUnit): void {
    if (unit.depthLevel < 1) {
      throw new MaxDepthExceededError(unit.id, unit.depthLevel);
    }
    if (unit.depthLevel > OrgUnit.MAX_DEPTH) {
      throw new MaxDepthExceededError(unit.id, unit.depthLevel);
    }
  }

  /**
   * Compute the projected depth for a new child under the given parent.
   * Returns true if the depth would be within bounds.
   */
  static isChildDepthValid(parentDepth: number): boolean {
    return parentDepth + 1 <= OrgUnit.MAX_DEPTH;
  }
}
