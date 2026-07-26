/**
 * ConditionExpression Value Object
 *
 * Represents a JSONata expression used for conditional step evaluation.
 * Stored as a string; evaluated at runtime by a JSONata engine.
 * Used by StepType.Conditional to determine whether a step should proceed.
 *
 * @traceability DOC-012 Aggregate5 §VO-ConditionExpression
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps (condition stored in metadata jsonb)
 */

export class InvalidConditionExpressionError extends Error {
  constructor(expression: string, reason: string) {
    super(`Invalid ConditionExpression: "${expression.substring(0, 80)}${expression.length > 80 ? '...' : ''}". ${reason}`);
    this.name = 'InvalidConditionExpressionError';
  }
}

/**
 * Assert that the condition expression is a non-empty string of maximum length.
 * Full JSONata validation (syntax check) is deferred to the evaluation engine.
 */
export function assertValidConditionExpression(expr: string): string {
  if (typeof expr !== 'string') {
    throw new InvalidConditionExpressionError(String(expr), 'Must be a string.');
  }
  if (expr.trim().length === 0) {
    throw new InvalidConditionExpressionError(expr, 'Cannot be empty or whitespace-only.');
  }
  if (expr.length > 4096) {
    throw new InvalidConditionExpressionError(expr, 'Maximum length is 4096 characters.');
  }
  return expr.trim();
}
