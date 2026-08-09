/**
 * PushCoordinator Tests
 *
 * Tests push operation coordination, batching, conflict resolution, and event publishing.
 * @traceability DOC-012 BR-SYNC-006, UC-SYNC-01, PushCoordinator
 */

import { PushCoordinator } from '@/domains/sync/domain-services/push-coordinator';
import { SyncStatus } from '@/domains/sync/value-objects/sync-status.vo';
import { ConflictStrategy } from '@/domains/sync/value-objects/conflict-strategy.vo';
import { LocalFirstPolicy } from '@/domains/sync/policies/local-first-policy';

// Mock implementations
class MockOpsRepo {
  findByOrgAndStatus = jest.fn();
  updateStatus = jest.fn();
  updateStatusAndAttempt = jest.fn();
  markConfirmed = jest.fn();
}

class MockStatusRepo {
  updateLastPushTimestamp = jest.fn();
}

class MockApiClient {
  pushBatch = jest.fn();
}

class MockEventBus {
  publish = jest.fn();
}

describe('PushCoordinator', () => {
  let coordinator: PushCoordinator;
  let opsMock: MockOpsRepo;
  let statusMock: MockStatusRepo;
  let apiMock: MockApiClient;
  let eventBusMock: MockEventBus;

  beforeEach(() => {
    opsMock = new MockOpsRepo();
    statusMock = new MockStatusRepo();
    apiMock = new MockApiClient();
    eventBusMock = new MockEventBus();

    coordinator = new PushCoordinator(opsMock, statusMock, apiMock, eventBusMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should return empty result when no pending operations', async () => {
      // Arrange
      opsMock.findByOrgAndStatus.mockResolvedValue([]);

      // Act
      const result = await coordinator.execute('org-1');

      // Assert
      expect(result).toEqual({
        batchCount: 0,
        operationsPushed: 0,
        conflictsResolved: 0,
        conflictsDetected: 0,
        errors: [],
      });
      expect(statusMock.updateLastPushTimestamp).not.toHaveBeenCalled();
    });

    it('should process pending operations and push in batches', async () => {
      // Arrange - 25 pending operations (less than MAX_BATCH of 50)
      const ops = Array.from({ length: 25 }, (_, i) => ({
        id: `op-${i}`,
        statut_sync: SyncStatus.PENDING,
        resource_id: `res-${i}`,
        resource_type: 'transaction',
        action: 'create',
        payload: {},
        tentative_num: 0,
      } as any));

      opsMock.findByOrgAndStatus.mockResolvedValue(ops);
      apiMock.pushBatch.mockResolvedValue({ errors: [], conflicts: [] });
      jest.spyOn(LocalFirstPolicy, 'validateLocalFirst').mockImplementation(() => {});
      statusMock.updateLastPushTimestamp.mockResolvedValue(undefined);
      opsMock.updateStatus.mockResolvedValue(undefined);
      opsMock.markConfirmed.mockResolvedValue(undefined);

      // Act
      const result = await coordinator.execute('org-1');

      // Assert
      expect(result.operationsPushed).toBe(25);
      expect(result.conflictsDetected).toBe(0);
      expect(result.conflictsResolved).toBe(0);
      expect(result.errors).toEqual([]);
      expect(apiMock.pushBatch).toHaveBeenCalledWith('org-1', expect.any(Array));
      expect(statusMock.updateLastPushTimestamp).toHaveBeenCalledWith('org-1', 'pending_operations', expect.any(Date));
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SyncCompleted' }),
      );
    });

    it('should handle conflicts detected during push', async () => {
      // Arrange
      const ops = [{ id: 'op-1', statut_sync: SyncStatus.PENDING, resource_id: 'res-1', resource_type: 'member', action: 'update', payload: {}, tentative_num: 0 } as any];
      const conflict = {
        orgId: 'org-1',
        resourceId: 'res-1',
        resourceType: 'member',
        localPayload: {},
        remotePayload: {},
      };

      opsMock.findByOrgAndStatus.mockResolvedValue(ops);
      apiMock.pushBatch.mockResolvedValue({ errors: [], conflicts: [conflict] });
      jest.spyOn(LocalFirstPolicy, 'validateLocalFirst').mockImplementation(() => {});
      statusMock.updateLastPushTimestamp.mockResolvedValue(undefined);
      opsMock.updateStatus.mockResolvedValue(undefined);
      opsMock.markConfirmed.mockResolvedValue(undefined);
      jest.spyOn(coordinator as any, 'resolveConflict').mockResolvedValue(true);

      // Act
      const result = await coordinator.execute('org-1');

      // Assert
      expect(result.conflictsDetected).toBe(1);
      expect(result.conflictsResolved).toBe(1);
      expect((coordinator as any).resolveConflict).toHaveBeenCalledWith(conflict);
    });

    it('should handle partial failures in batch', async () => {
      // Arrange
      const ops = [
        { id: 'op-1', statut_sync: SyncStatus.PENDING, resource_id: 'res-1', resource_type: 'member', action: 'update', payload: {}, tentative_num: 0 } as any,
        { id: 'op-2', statut_sync: SyncStatus.PENDING, resource_id: 'res-2', resource_type: 'member', action: 'update', payload: {}, tentative_num: 0 } as any,
      ];

      opsMock.findByOrgAndStatus.mockResolvedValue(ops);
      apiMock.pushBatch.mockResolvedValue({
        errors: ['Error on op-2'],
        conflicts: [],
      });
      jest.spyOn(LocalFirstPolicy, 'validateLocalFirst').mockImplementation(() => {});
      opsMock.updateStatusAndAttempt.mockResolvedValue(undefined);
      opsMock.updateStatus.mockResolvedValue(undefined);
      statusMock.updateLastPushTimestamp.mockResolvedValue(undefined);

      // Act
      const result = await coordinator.execute('org-1');

      // Assert - every batch call counts as pushed; remote-reported errors surface in the result
      expect(result.operationsPushed).toBe(2);
      expect(result.errors).toContain('Error on op-2');
      expect(opsMock.updateStatusAndAttempt).toHaveBeenCalledWith(
        expect.any(String),
        SyncStatus.FAILED,
        expect.any(Number),
      );
    });
  });

  describe('applyStrategy', () => {
    it('should apply LWW strategy (remote wins when newer)', () => {
      // Arrange - Test private method directly
      const coordinatorTest = new PushCoordinator(new MockOpsRepo(), new MockStatusRepo(), new MockApiClient(), new MockEventBus());
      const local = { updated_at: '2026-01-01T00:00:00Z', value: 'local' };
      const remote = { updated_at: '2026-01-01T00:01:00Z', value: 'remote' };

      const result = coordinatorTest['applyStrategy'](ConflictStrategy.LAST_WRITE_WINS, local, remote);

      // Assert - remote is newer, should win
      expect(result).toEqual(expect.objectContaining({ value: 'remote' }));
    });

    it('should apply LWW strategy (local wins when newer)', () => {
      const coordinatorTest = new PushCoordinator(new MockOpsRepo(), new MockStatusRepo(), new MockApiClient(), new MockEventBus());
      const local = { updated_at: '2026-01-01T00:02:00Z', value: 'local' };
      const remote = { updated_at: '2026-01-01T00:01:00Z', value: 'remote' };

      const result = coordinatorTest['applyStrategy'](ConflictStrategy.LAST_WRITE_WINS, local, remote);

      expect(result).toEqual(expect.objectContaining({ value: 'local' }));
    });

    it('should apply SERVER_WINS strategy (merge)', () => {
      const coordinatorTest = new PushCoordinator(new MockOpsRepo(), new MockStatusRepo(), new MockApiClient(), new MockEventBus());
      const local = { value: 'local' };
      const remote = { value: 'remote', extra: 'field' };

      const result = coordinatorTest['applyStrategy'](ConflictStrategy.SERVER_WINS, local, remote);

      expect(result).toEqual({ ...local, ...remote });
    });

    it('should return null for IMMUTABLE strategy', () => {
      const coordinatorTest = new PushCoordinator(new MockOpsRepo(), new MockStatusRepo(), new MockApiClient(), new MockEventBus());
      const local = { value: 'local' };
      const remote = { value: 'remote' };

      const result = coordinatorTest['applyStrategy'](ConflictStrategy.IMMUTABLE, local, remote);

      expect(result).toBeNull();
    });
  });
});
