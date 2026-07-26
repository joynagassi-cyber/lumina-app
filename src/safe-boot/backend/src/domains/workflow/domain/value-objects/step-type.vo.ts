/**
 * StepType Value Object
 *
 * Enumerates the possible types of a workflow step.
 * Each type determines how the StepExecutor handles it.
 *
 * @traceability DOC-012 Aggregate5 §VO-StepType
 *   → POSTGRESQL-SCHEMA-PACK-v1 workflow_steps.type_etape CHECK IN (...)
 */

export enum StepType {
  Auto = 'auto',
  Approval = 'approval',
  Notification = 'notification',
  Conditional = 'conditional',
  Delay = 'delay',
  Parallel = 'parallel',
}

const VALID_TYPES: readonly StepType[] = Object.values(StepType);

export class InvalidStepTypeError extends Error {
  constructor(value: string) {
    super(`Invalid step type: "${value}". Must be one of: ${VALID_TYPES.join(', ')}`);
    this.name = 'InvalidStepTypeError';
  }
}

export function assertValidStepType(value: string): StepType {
  const typed = value as StepType;
  if (!VALID_TYPES.includes(typed)) {
    throw new InvalidStepTypeError(value);
  }
  return typed;
}
