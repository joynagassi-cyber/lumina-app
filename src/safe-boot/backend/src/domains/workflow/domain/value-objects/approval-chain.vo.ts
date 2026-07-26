/**
 * ApprovalChain Value Object
 *
 * Represents an ordered list of role-based approval levels within a workflow step.
 * Enforces BR-WF-002: maximum 5 hierarchical levels.
 *
 * @traceability DOC-012 Aggregate5 §VO-ApprovalChain
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps.assigne_a_role
 *   → BR-WF-002 (Approval chain max 5 niveaux)
 */

export class InvalidApprovalChainError extends Error {
  constructor(reason: string) {
    super(`Invalid approval chain: ${reason}`);
    this.name = 'InvalidApprovalChainError';
  }
}

export class ApprovalChainLevelExceededError extends Error {
  constructor(levelCount: number) {
    super(
      `Approval chain has ${levelCount} level(s). Maximum allowed is ${MAX_APPROVAL_LEVELS} per BR-WF-002.`,
    );
    this.name = 'ApprovalChainLevelExceededError';
  }
}

/**
 * A single level in the approval chain, identified by the required role.
 */
export interface ApprovalChainLevel {
  /** Role that must approve at this level (e.g. 'treasurer', 'pastor'). */
  readonly role: string;
  /** If true, ALL roles in this level must approve; if false, ANY suffices. */
  requireAll: boolean;
}

/**
 * The number of distinct approval levels allowed per BR-WF-002.
 */
export const MAX_APPROVAL_LEVELS = 5;

/**
 * Validate that the approval chain does not exceed the maximum level count.
 * Throws ApprovalChainLevelExceededError if violated.
 */
export function assertValidApprovalChain(levels: ApprovalChainLevel[]): void {
  if (!Array.isArray(levels)) {
    throw new InvalidApprovalChainError('Levels must be an array.');
  }
  if (levels.length === 0) {
    throw new InvalidApprovalChainError('Approval chain must have at least one level.');
  }
  if (levels.length > MAX_APPROVAL_LEVELS) {
    throw new ApprovalChainLevelExceededError(levels.length);
  }
  for (let i = 0; i < levels.length; i++) {
    if (!levels[i].role || typeof levels[i].role !== 'string') {
      throw new InvalidApprovalChainError(`Level ${i + 1} has no valid role.`);
    }
    if (typeof levels[i].requireAll !== 'boolean') {
      throw new InvalidApprovalChainError(`Level ${i + 1} requireAll must be boolean.`);
    }
  }
}

/**
 * Build an approval chain with validation.
 * Returns the validated chain or throws InvalidApprovalChainError.
 */
export function createApprovalChain(levels: ApprovalChainLevel[]): ApprovalChainLevel[] {
  assertValidApprovalChain(levels);
  return [...levels];
}
