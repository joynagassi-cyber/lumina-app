/**
 * MaxStepsPolicy
 *
 * Enforces BR-WF-006 equivalent: a workflow definition cannot exceed 7 steps,
 * beyond which the capability must implement the logic natively instead of relying
 * on the generic approval workflow engine.
 *
 * @traceability DOC-012 Aggregate5 §Policies-MaxStepsPolicy
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_instances.total_etapes
 *   → DOC-023 §5 Workflow step limits
 */

export class MaxStepsExceededError extends Error {
  constructor(stepCount: number) {
    super(
      `Workflow definition has ${stepCount} step(s). Maximum allowed is ${MAX_ALLOWED_STEPS}. ` +
        `Capabilities with more steps must implement logic natively (BR-WF-006).`,
    );
    this.name = 'MaxStepsExceededError';
  }
}

/** Maximum number of steps allowed in a workflow definition. */
export const MAX_ALLOWED_STEPS = 7;

export class MaxStepsPolicy {
  /**
   * Validate that the total step count does not exceed the maximum.
   * Throws MaxStepsExceededError if violated.
   */
  static validate(totalSteps: number): void {
    if (totalSteps > MAX_ALLOWED_STEPS) {
      throw new MaxStepsExceededError(totalSteps);
    }
  }

  /**
   * Check whether the given step count is within bounds.
   */
  static isValid(totalSteps: number): boolean {
    return totalSteps >= 1 && totalSteps <= MAX_ALLOWED_STEPS;
  }

  /**
   * Compute the recommended maximum total steps for a given workflow complexity tier.
   * Simple workflows: max 3 steps. Complex workflows: up to MAX_ALLOWED_STEPS.
   */
  static recommendedMaxForTier(tier: 'simple' | 'moderate' | 'complex'): number {
    switch (tier) {
      case 'simple':
        return 3;
      case 'moderate':
        return 5;
      case 'complex':
        return MAX_ALLOWED_STEPS;
      default:
        return MAX_ALLOWED_STEPS;
    }
  }
}
