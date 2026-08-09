/**
 * WorkflowService Unit Tests
 *
 * Tests workflow operations: TriggerWorkflow, ApproveStep, RejectStep, CancelWorkflow,
 * SkipStep, ResubmitForApproval, RequestRevision, getInstance, getSteps.
 * @traceability DOC-012 ASS-WF WorkflowService, BR-WF-001 through BR-WF-006
 */

import { WorkflowService, WorkflowNotRunningError } from '@/domains/workflow/application/workflow.service';
import { WorkflowInstanceStatus } from '@/domains/workflow/domain/entities/workflow-instance.entity';
import { WorkflowStepStatus } from '@/domains/workflow/domain/entities/workflow-step.entity';
import { StepType } from '@/domains/workflow/domain/value-objects/step-type.vo';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let instanceRepo: any;
  let stepRepo: any;
  let logRepo: any;
  let eventBus: any;
  let authorizer: any;
  let clock: any;
  let uuid: any;
  let audit: any;
  let logger: any;
  const NOW = new Date('2026-01-01T00:00:00Z');

  beforeEach(() => {
    instanceRepo = {
      findById: jest.fn(), findByResource: jest.fn(), findRunningInstances: jest.fn(),
      save: jest.fn(), update: jest.fn(),
    };
    stepRepo = {
      findById: jest.fn(), findByInstanceId: jest.fn(), findPendingOrInProgressSteps: jest.fn(),
      save: jest.fn(), update: jest.fn(),
    };
    logRepo = { findByInstanceId: jest.fn(), save: jest.fn() };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined), publishMany: jest.fn() };
    authorizer = { hasRole: jest.fn(), hasRoleHierarchy: jest.fn(), hasPermission: jest.fn() };
    clock = { now: jest.fn(() => NOW) };
    uuid = { generate: jest.fn(() => 'uuid-123') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    service = new WorkflowService(
      instanceRepo,
      stepRepo,
      logRepo,
      eventBus,
      authorizer,
      clock,
      uuid,
      audit,
      logger,
    );
  });

  describe('handleTriggerWorkflow', () => {
    it('should trigger workflow successfully (positive)', async () => {
      // Arrange
      const input = {
        resourceType: 'transaction',
        resourceId: 'txn-1',
        definitionKey: 'payment-approval',
        totalSteps: 3,
        createdBy: 'admin-1',
      };

      // Act
      await service.handleTriggerWorkflow(input, 'org-1');

      // Assert
      expect(instanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WorkflowInstanceStatus.Running }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'WorkflowTriggered' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create' }),
      );
    });
  });

  describe('handleApproveStep', () => {
    it('should approve step successfully (positive)', async () => {
      // Arrange
      const step = {
        id: 'step-1',
        instanceId: 'inst-1',
        order: 0,
        type: StepType.Approval,
        status: WorkflowStepStatus.Pending,
        isTerminal: false,
        executedBy: null,
        complete: jest.fn(),
      };
      const instance = {
        id: 'inst-1',
        orgId: 'org-1',
        resourceType: 'transaction',
        status: 'pending',
        totalSteps: 3,
        currentStepIndex: 0,
        advanceStep: jest.fn(),
        complete: jest.fn(),
      };

      stepRepo.findById.mockResolvedValue(step);
      instanceRepo.findById.mockResolvedValue(instance);
      stepRepo.findByInstanceId.mockResolvedValue([]);
      stepRepo.update.mockResolvedValue(undefined);
      instanceRepo.update.mockResolvedValue(undefined);

      // Act
      await service.handleApproveStep({ stepId: 'step-1', userId: 'user-1' }, 'org-1');

      // Assert
      expect(step.complete).toHaveBeenCalledWith('Approved', expect.any(Date));
      expect(instance.advanceStep).toHaveBeenCalledWith(1);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'StepApproved' }),
      );
    });
  });

  describe('handleRejectStep', () => {
    it('should reject step and mark workflow as failed (positive)', async () => {
      // Arrange
      const step = {
        id: 'step-1', instanceId: 'inst-1', order: 0,
        isTerminal: false, executedBy: null, fail: jest.fn(),
      };
      const instance = { id: 'inst-1', orgId: 'org-1', markFailed: jest.fn() };

      stepRepo.findById.mockResolvedValue(step);
      instanceRepo.findById.mockResolvedValue(instance);
      stepRepo.update.mockResolvedValue(undefined);
      instanceRepo.update.mockResolvedValue(undefined);

      // Act
      await service.handleRejectStep(
        { stepId: 'step-1', userId: 'user-1', reason: 'Not applicable' },
        'org-1',
      );

      // Assert
      expect(step.fail).toHaveBeenCalledWith('Not applicable', expect.any(Date));
      expect(instance.markFailed).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'WorkflowFailed' }),
      );
    });
  });

  describe('handleCancelWorkflow', () => {
    it('should cancel running workflow successfully (positive)', async () => {
      // Arrange
      const instance = { id: 'inst-1', orgId: 'org-1', isRunning: () => true, cancel: jest.fn() };

      instanceRepo.findById.mockResolvedValue(instance);
      instanceRepo.update.mockResolvedValue(undefined);

      // Act
      await service.handleCancelWorkflow({ instanceId: 'inst-1', userId: 'user-1' }, 'org-1');

      // Assert
      expect(instance.cancel).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'WorkflowCancelled' }),
      );
    });

    it('should throw when workflow not running', async () => {
      // Arrange
      const instance = { id: 'inst-1', orgId: 'org-1', isRunning: () => false };

      instanceRepo.findById.mockResolvedValue(instance);

      // Act & Assert
      await expect(
        service.handleCancelWorkflow({ instanceId: 'inst-1', userId: 'user-1' }, 'org-1'),
      ).rejects.toThrow(WorkflowNotRunningError);
    });
  });

  describe('handleSkipStep', () => {
    it('should skip step successfully (positive)', async () => {
      // Arrange
      const step = {
        id: 'step-1', instanceId: 'inst-1', order: 0,
        isTerminal: false, executedBy: null, skip: jest.fn(),
      };
      const instance = { id: 'inst-1', orgId: 'org-1', totalSteps: 1, currentStepIndex: 0, complete: jest.fn() };

      stepRepo.findById.mockResolvedValue(step);
      instanceRepo.findById.mockResolvedValue(instance);
      stepRepo.findByInstanceId.mockResolvedValue([]);
      stepRepo.update.mockResolvedValue(undefined);
      instanceRepo.update.mockResolvedValue(undefined);

      // Act
      await service.handleSkipStep({ stepId: 'step-1', userId: 'user-1', reason: 'N/A' }, 'org-1');

      // Assert
      expect(step.skip).toHaveBeenCalledWith('N/A', expect.any(Date));
      expect(instance.complete).toHaveBeenCalled();
    });
  });

  describe('handleResubmitForApproval', () => {
    it('should resubmit step for approval when user has admin role (positive)', async () => {
      // Arrange
      const step = { id: 'step-1', instanceId: 'inst-1', resetToPending: jest.fn() };
      stepRepo.findById.mockResolvedValue(step);
      stepRepo.update.mockResolvedValue(undefined);
      authorizer.hasRole.mockResolvedValue(true);

      // Act
      await service.handleResubmitForApproval({ stepId: 'step-1', userId: 'user-1' }, 'org-1');

      // Assert
      expect(step.resetToPending).toHaveBeenCalled();
      expect(authorizer.hasRole).toHaveBeenCalledWith('user-1', 'admin');
    });

    it('should throw when user lacks admin role', async () => {
      // Arrange
      const step = { id: 'step-1', instanceId: 'inst-1' };
      stepRepo.findById.mockResolvedValue(step);
      authorizer.hasRole.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.handleResubmitForApproval({ stepId: 'step-1', userId: 'user-1' }, 'org-1'),
      ).rejects.toThrow('Manual resubmit requires admin role');
    });
  });

  describe('handleRequestRevision', () => {
    it('should request revision by resetting current step to pending (positive)', async () => {
      // Arrange
      const instance = { id: 'inst-1', orgId: 'org-1', currentStepIndex: 0 };
      const step = { order: 0, resetToPending: jest.fn() };
      instanceRepo.findById.mockResolvedValue(instance);
      stepRepo.findByInstanceId.mockResolvedValue([step]);
      stepRepo.update.mockResolvedValue(undefined);

      // Act
      await service.handleRequestRevision(
        { instanceId: 'inst-1', userId: 'user-1', reason: 'Update needed' },
        'org-1',
      );

      // Assert
      expect(step.resetToPending).toHaveBeenCalled();
    });
  });

  describe('getInstance', () => {
    it('should retrieve workflow instance successfully (positive)', async () => {
      // Arrange
      const instance = {
        id: 'inst-1', orgId: 'org-1', resourceType: 'txn', resourceId: 't1',
        definitionKey: 'wf1', currentStepIndex: 0, totalSteps: 3,
        status: WorkflowInstanceStatus.Running, createdAt: new Date(),
        completionDate: null, cancellationDate: null, version: 1,
      };
      instanceRepo.findById.mockResolvedValue(instance);

      // Act
      const result = await service.getInstance('inst-1', 'org-1');

      // Assert
      expect(result).toBeTruthy();
      expect(result.id).toBe('inst-1');
    });
  });

  describe('getSteps', () => {
    it('should retrieve steps for workflow instance (positive)', async () => {
      // Arrange
      const steps = [
        { id: 's1', instanceId: 'inst-1', order: 0, type: StepType.Approval, assigneeRole: 'admin', status: WorkflowStepStatus.Pending, timeoutDays: 5, approvalComment: null, rejectionReason: null },
        { id: 's2', instanceId: 'inst-1', order: 1, type: StepType.Auto, assigneeRole: 'system', status: WorkflowStepStatus.Completed, timeoutDays: 5, approvalComment: 'Approved', rejectionReason: null },
      ];
      stepRepo.findByInstanceId.mockResolvedValue(steps);

      // Act
      const result = await service.getSteps('inst-1', 'org-1');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('s1');
      expect(result[1].status).toBe('completed');
    });
  });
});
