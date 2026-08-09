/**
 * StepExecutor Tests
 *
 * Tests step execution dispatching and validation.
 * @traceability DOC-012 DomainService-StepExecutor, BR-WF-004
 */

import { StepExecutor, StepExecutionError, type ExecutionResult } from '@/domains/workflow/domain/services/step-executor.service';
import { StepType } from '@/domains/workflow/domain/value-objects/step-type.vo';
import { WorkflowStepStatus } from '@/domains/workflow/domain/entities/workflow-step.entity';

// Mock implementations
class MockTypeExecutor implements any {
  executeAuto = jest.fn().mockResolvedValue({ success: true, stepStatus: WorkflowStepStatus.Completed });
  executeApproval = jest.fn().mockResolvedValue({ success: true, stepStatus: WorkflowStepStatus.Completed });
  executeNotification = jest.fn().mockResolvedValue({ success: true, stepStatus: WorkflowStepStatus.Completed });
  executeConditional = jest.fn().mockResolvedValue({ success: true, stepStatus: WorkflowStepStatus.Completed });
  executeDelay = jest.fn().mockResolvedValue({ success: true, stepStatus: WorkflowStepStatus.Completed });
  executeParallel = jest.fn().mockResolvedValue({ success: true, stepStatus: WorkflowStepStatus.Completed });
}

describe('StepExecutor', () => {
  let executor: StepExecutor;
  let mockExecutor: MockTypeExecutor;

  beforeEach(() => {
    mockExecutor = new MockTypeExecutor();
    executor = new StepExecutor(mockExecutor as any);
  });

  describe('execute', () => {
    it('should execute auto step successfully (positive)', async () => {
      // Arrange
      const step = { id: 'step-1', type: StepType.Auto, status: WorkflowStepStatus.Pending, isTerminal: false } as any;

      // Act
      const result = await executor.execute(step);

      // Assert
      expect(result.success).toBe(true);
      expect(mockExecutor.executeAuto).toHaveBeenCalledWith(step);
    });

    it('should execute approval step with actor ID (positive)', async () => {
      // Arrange
      const step = { id: 'step-1', type: StepType.Approval, status: WorkflowStepStatus.Pending, isTerminal: false } as any;

      // Act
      const result = await executor.execute(step, 'user-123');

      // Assert
      expect(mockExecutor.executeApproval).toHaveBeenCalledWith(step, 'user-123');
    });

    it('should throw error when actor ID missing for approval step', async () => {
      // Arrange
      const step = { id: 'step-1', type: StepType.Approval, status: WorkflowStepStatus.Pending, isTerminal: false } as any;

      // Act & Assert
      await expect(executor.execute(step)).rejects.toThrow(StepExecutionError);
      await expect(executor.execute(step)).rejects.toThrow('Actor ID is required for approval steps');
    });

    it('should execute notification step successfully', async () => {
      // Arrange
      const step = { id: 'step-1', type: StepType.Notification, status: WorkflowStepStatus.Pending, isTerminal: false } as any;

      // Act
      const result = await executor.execute(step);

      // Assert
      expect(mockExecutor.executeNotification).toHaveBeenCalledWith(step);
    });

    it('should execute conditional step successfully', async () => {
      // Arrange
      const step = { id: 'step-1', type: StepType.Conditional, status: WorkflowStepStatus.Pending, isTerminal: false } as any;

      // Act
      const result = await executor.execute(step);

      // Assert
      expect(mockExecutor.executeConditional).toHaveBeenCalledWith(step);
    });

    it('should execute delay step successfully', async () => {
      // Arrange
      const step = { id: 'step-1', type: StepType.Delay, status: WorkflowStepStatus.Pending, isTerminal: false } as any;

      // Act
      const result = await executor.execute(step);

      // Assert
      expect(mockExecutor.executeDelay).toHaveBeenCalledWith(step);
    });

    it('should execute parallel step successfully', async () => {
      // Arrange
      const step = { id: 'step-1', type: StepType.Parallel, status: WorkflowStepStatus.Pending, isTerminal: false } as any;

      // Act
      const result = await executor.execute(step);

      // Assert
      expect(mockExecutor.executeParallel).toHaveBeenCalledWith(step);
    });

    it('should throw error for unknown step type', async () => {
      // Arrange
      const step = { id: 'step-1', type: 'unknown' as any, status: WorkflowStepStatus.Pending, isTerminal: false } as any;

      // Act & Assert
      await expect(executor.execute(step)).rejects.toThrow(StepExecutionError);
      await expect(executor.execute(step)).rejects.toThrow('Unknown step type');
    });

    it('should throw error when trying to execute terminal step', async () => {
      // Arrange
      const step = { id: 'step-1', type: StepType.Auto, status: WorkflowStepStatus.Completed, isTerminal: true } as any;

      // Act & Assert
      await expect(executor.execute(step)).rejects.toThrow(StepExecutionError);
      await expect(executor.execute(step)).rejects.toThrow('Step is already terminal');
    });
  });

  describe('canExecute', () => {
    it('should allow execution when step order matches current index and step is not terminal', () => {
      const step = { order: 1, isTerminal: false } as any;
      const result = StepExecutor.canExecute(step, 1);
      expect(result).toBe(true);
    });

    it('should not execute when step order does not match current index', () => {
      const step = { order: 2, isTerminal: false } as any;
      const result = StepExecutor.canExecute(step, 1);
      expect(result).toBe(false);
    });

    it('should not execute terminal steps', () => {
      const step = { order: 1, isTerminal: true } as any;
      const result = StepExecutor.canExecute(step, 1);
      expect(result).toBe(false);
    });
  });
});
