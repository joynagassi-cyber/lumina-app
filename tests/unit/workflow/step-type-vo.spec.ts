/**
 * StepType Value Object Tests
 *
 * Tests workflow step types and validation.
 * @traceability DOC-012 VO-StepType, POSTGRESQL-Schema CHECK constraint
 */

import { StepType, InvalidStepTypeError, assertValidStepType } from '@/domains/workflow/domain/value-objects/step-type.vo';

describe('StepType', () => {
  it('should define all valid step types', () => {
    expect(Object.values(StepType)).toEqual([
      'auto',
      'approval',
      'notification',
      'conditional',
      'delay',
      'parallel',
    ]);
  });

  it('should assert valid step type "auto"', () => {
    const result = assertValidStepType('auto');
    expect(result).toBe(StepType.Auto);
  });

  it('should assert valid step type "approval"', () => {
    const result = assertValidStepType('approval');
    expect(result).toBe(StepType.Approval);
  });

  it('should assert valid step type "notification"', () => {
    const result = assertValidStepType('notification');
    expect(result).toBe(StepType.Notification);
  });

  it('should assert valid step type "conditional"', () => {
    const result = assertValidStepType('conditional');
    expect(result).toBe(StepType.Conditional);
  });

  it('should assert valid step type "delay"', () => {
    const result = assertValidStepType('delay');
    expect(result).toBe(StepType.Delay);
  });

  it('should assert valid step type "parallel"', () => {
    const result = assertValidStepType('parallel');
    expect(result).toBe(StepType.Parallel);
  });

  it('should throw error for invalid step type', () => {
    expect(() => assertValidStepType('invalid')).toThrow(InvalidStepTypeError);
    expect(() => assertValidStepType('invalid')).toThrowError(
      `Invalid step type: "invalid". Must be one of: auto, approval, notification, conditional, delay, parallel`,
    );
  });

  it('should throw error for uppercase step type', () => {
    expect(() => assertValidStepType('Auto')).toThrow(InvalidStepTypeError);
  });

  it('should throw error for empty string', () => {
    expect(() => assertValidStepType('')).toThrow(InvalidStepTypeError);
  });
});
