/**
 * ApprovalChainPolicy
 *
 * Enforces BR-WF-002: approval chain max 5 hierarchical levels.
 * Validates that a workflow step's approval chain configuration is within bounds.
 *
 * @traceability DOC-012 Aggregate5 §Policies-ApprovalChainPolicy
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps.assigne_a_role
 *   → BR-WF-002 (Approval chain max 5 niveaux)
 */

import {
  MAX_APPROVAL_LEVELS,
  type ApprovalChainLevel,
  assertValidApprovalChain,
} from '../value-objects/approval-chain.vo';

export class ApprovalChainExceededError extends Error {
  constructor(levelCount: number) {
    super(
      `Approval chain has ${levelCount} level(s). Maximum allowed is ${MAX_APPROVAL_LEVELS} per BR-WF-002.`,
    );
    this.name = 'ApprovalChainExceededError';
  }
}

export class InvalidApprovalChainRoleError extends Error {
  constructor(role: string) {
    super(`Invalid role in approval chain: "${role}". Role must be a non-empty string.`);
    this.name = 'InvalidApprovalChainRoleError';
  }
}

export class ApprovalChainPolicy {
  /** Maximum number of distinct approval levels (BR-WF-002). */
  static readonly MAX_LEVELS = MAX_APPROVAL_LEVELS;

  /**
   * Validate an approval chain against all constraints.
   * - Total levels <= MAX_APPROVAL_LEVELS (BR-WF-002)
   * - Each level has a valid role string
   * - requireAll is boolean
   * Throws on any violation.
   */
  static validate(levels: ApprovalChainLevel[]): void {
    assertValidApprovalChain(levels);
  }

  /**
   * Check whether the given chain length is within bounds without throwing.
   */
  static isValidLevelCount(count: number): boolean {
    return count >= 1 && count <= MAX_APPROVAL_LEVELS;
  }

  /**
   * Check that all roles in a chain are valid, non-empty strings.
   */
  static validateRoles(levels: ApprovalChainLevel[]): void {
    for (let i = 0; i < levels.length; i++) {
      const role = levels[i].role;
      if (typeof role !== 'string' || role.trim().length === 0) {
        throw new InvalidApprovalChainRoleError(role);
      }
    }
  }

  /**
   * Check that the number of levels does not exceed the maximum.
   */
  static validateLevelCount(levels: ApprovalChainLevel[]): void {
    if (levels.length > MAX_APPROVAL_LEVELS) {
      throw new ApprovalChainExceededError(levels.length);
    }
  }
}
