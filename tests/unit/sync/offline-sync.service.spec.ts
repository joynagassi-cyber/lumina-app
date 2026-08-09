/**
 * OfflineSyncService Unit Tests
 *
 * Tests sync operations: push, pull, conflict resolution, connectivity check, etc.
 * @traceability DOC-012 UC-SYNC-01 through UC-SYNC-04, OfflineSyncService
 */

import { OfflineSyncService, type ConflictResolutionInput, type ConfirmOperationInput, type PendingOperationInput } from '@/domains/sync/application-service/offline-sync.service';
import { IPendingOperationsPort } from '@/domains/sync/ports/pending-operations-port.interface';
import { ISyncStatusRepositoryPort } from '@/domains/sync/ports/sync-status-repository-port.interface';
import { IRemoteApiPort } from '@/domains/sync/ports/remote-api-port.interface';
import { SyncStatus } from '@/domains/sync/value-objects/sync-status.vo';
import { SyncAction } from '@/domains/sync/value-objects/sync-action.vo';

// Mock implementations
class MockOpsRepo implements IPendingOperationsPort {
  create = jest.fn().mockResolvedValue('record-id-1');
  findById = jest.fn().mockResolvedValue(null);
  findByOrgAndStatus = jest.fn().mockResolvedValue([]);
  updateStatus = jest.fn().mockResolvedValue(undefined);
  updateStatusAndAttempt = jest.fn().mockResolvedValue(undefined);
  markConfirmed = jest.fn().mockResolvedValue(undefined);
  markFailed = jest.fn().mockResolvedValue(undefined);
  findByResourceTypeAndId = jest.fn().mockResolvedValue([]);
}

class MockStatusRepo implements ISyncStatusRepositoryPort {
  getAllForOrg = jest.fn().mockResolvedValue([]);
  findByOrgAndTable = jest.fn().mockResolvedValue(null);
  updateLastPushTimestamp = jest.fn().mockResolvedValue(undefined);
  updateLastPullTimestamp = jest.fn().mockResolvedValue(undefined);
  updateLastSyncTimestamp = jest.fn().mockResolvedValue(undefined);
  updateConnectionState = jest.fn().mockResolvedValue(undefined);
}

class MockApiClient implements IRemoteApiPort {
  pushBatch = jest.fn().mockResolvedValue({ pushed: 0, errors: [], conflicts: [] });
  pullDelta = jest.fn().mockResolvedValue({ changes: [], since: new Date(0) });
}

class MockEventBus {
  publish = jest.fn();
}

describe('OfflineSyncService', () => {
  let service: OfflineSyncService;
  let opsMock: MockOpsRepo;
  let statusMock: MockStatusRepo;
  let apiMock: MockApiClient;
  let eventBusMock: MockEventBus;

  beforeEach(() => {
    opsMock = new MockOpsRepo();
    statusMock = new MockStatusRepo();
    apiMock = new MockApiClient();
    eventBusMock = new MockEventBus();

    service = new OfflineSyncService(opsMock, statusMock, apiMock, eventBusMock);
  });

  describe('pushPendingOperations', () => {
    it('should push pending operations through the internal coordinator (positive)', async () => {
      // Arrange
      opsMock.findByOrgAndStatus.mockResolvedValue([
        { id: 'op-1', statut_sync: SyncStatus.PENDING, resource_id: 'res-1', resource_type: 'member', action: 'create', payload: {}, tentative_num: 0 } as any,
      ]);
      apiMock.pushBatch.mockResolvedValue({ pushed: 1, errors: [], conflicts: [] });

      // Act
      const result = await service.pushPendingOperations('org-1');

      // Assert
      expect(result).toEqual({ pushed: 1, errors: [] });
      expect(opsMock.markConfirmed).toHaveBeenCalledWith('op-1');
    });
  });

  describe('pullRemoteChanges', () => {
    it('should fetch remote changes via pullDelta (positive)', async () => {
      // Arrange
      statusMock.findByOrgAndTable.mockResolvedValue(null); // First sync
      apiMock.pullDelta.mockResolvedValue({
        changes: [
          { resourceType: 'member', resourceId: '00000000-0000-4000-8000-000000000001', action: 'create', payload: { name: 'Jane' }, timestamp: new Date() },
        ],
        since: new Date(0),
      });

      // Act
      const result = await service.pullRemoteChanges('org-1', 'members');

      // Assert
      expect(result.fetched).toBe(1);
      expect(result.errors).toEqual([]);
      expect(statusMock.updateLastPullTimestamp).toHaveBeenCalledWith('org-1', 'members', expect.any(Date));
      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'DeltaReceived' }));
    });

    it('should return zero fetched when remote has no changes', async () => {
      const result = await service.pullRemoteChanges('org-1', 'members');

      expect(result).toEqual({ fetched: 0, errors: [] });
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict using the registered strategy (positive)', async () => {
      // Arrange - transaction without state resolves to IMMUTABLE → local wins
      const input: ConflictResolutionInput = {
        orgId: 'org-1',
        resourceType: 'transaction',
        resourceId: 'txn-1',
        localPayload: { updated_at: '2026-01-01T00:00:00Z', value: 'local' },
        remotePayload: { updated_at: '2026-01-01T00:01:00Z', value: 'remote' },
      };

      // Act
      const result = await service.resolveConflict(input);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        resolution: expect.any(String),
        winningPayload: expect.any(Object),
      }));
    });

    it('should apply LAST_WRITE_WINS for members (remote newer wins)', async () => {
      const input: ConflictResolutionInput = {
        orgId: 'org-1',
        resourceType: 'member',
        resourceId: 'm-1',
        localPayload: { updated_at: '2026-01-01T00:00:00Z', name: 'local' },
        remotePayload: { updated_at: '2026-01-01T00:01:00Z', name: 'remote' },
      };

      const result = await service.resolveConflict(input);

      expect(result.resolution).toBe('remote_wins');
      expect(result.winningPayload).toEqual(expect.objectContaining({ name: 'remote' }));
    });
  });

  describe('markOperationConfirmed', () => {
    it('should mark operation as confirmed (positive)', async () => {
      const input: ConfirmOperationInput = { operationId: 'op-1' };

      await service.markOperationConfirmed(input);

      expect(opsMock.markConfirmed).toHaveBeenCalledWith('op-1');
    });
  });

  describe('createPendingOperation', () => {
    it('should enqueue local operation for sync (positive)', async () => {
      // Arrange
      const input: PendingOperationInput = {
        orgId: 'org-1',
        resourceType: 'transaction',
        resourceId: 'txn-1',
        action: SyncAction.CREATE,
        payload: { value: 100 },
      };

      // Act
      const result = await service.createPendingOperation(input);

      // Assert
      expect(result).toBe('record-id-1');
      expect(opsMock.create).toHaveBeenCalledWith(expect.objectContaining({
        org_id: 'org-1',
        resource_type: 'transaction',
        resource_id: 'txn-1',
        action: SyncAction.CREATE,
        statut_sync: SyncStatus.PENDING,
      }));
    });

    it('should throw error for unknown resource type', async () => {
      // Arrange
      const input: PendingOperationInput = {
        orgId: 'org-1',
        resourceType: 'unknown-resource',
        resourceId: 'res-1',
        action: SyncAction.CREATE,
        payload: {},
      };

      // Act & Assert
      await expect(service.createPendingOperation(input)).rejects.toThrow(
        "OfflineSync: unknown resource type 'unknown-resource' — no sync strategy registered",
      );
      expect(opsMock.create).not.toHaveBeenCalled();
    });
  });

  describe('checkConnectivity', () => {
    it('should report online when all trackers are online', async () => {
      statusMock.getAllForOrg.mockResolvedValue([
        { orgId: 'org-1', connectionState: 'online', lastPushTimestamp: new Date() } as any,
      ]);

      const result = await service.checkConnectivity('org-1');

      expect(result.isConnected).toBe(true);
      expect(result.connectionState).toBe('online');
    });

    it('should report offline when any tracker is offline', async () => {
      statusMock.getAllForOrg.mockResolvedValue([
        { orgId: 'org-1', connectionState: 'offline', lastPushTimestamp: null } as any,
      ]);

      const result = await service.checkConnectivity('org-1');

      expect(result.isConnected).toBe(false);
      expect(result.connectionState).toBe('offline');
    });
  });

  describe('getSyncStatus', () => {
    it('should get sync status for a table (positive)', async () => {
      statusMock.findByOrgAndTable.mockResolvedValue({
        orgId: 'org-1',
        tableName: 'transactions',
        lastSyncTimestamp: new Date(),
        connectionState: 'online',
        lastPushTimestamp: new Date(),
        lastPullTimestamp: new Date(),
      } as any);

      const result = await service.getSyncStatus('org-1', 'transactions');

      expect(result).toBeTruthy();
      expect(result?.lastSyncTimestamp).toBeTruthy();
      expect(result?.connectionState).toBe('online');
    });

    it('should return null when no tracker found', async () => {
      statusMock.findByOrgAndTable.mockResolvedValue(null);

      const result = await service.getSyncStatus('org-1', 'non-existent-table');

      expect(result).toBeNull();
    });
  });

  describe('updateConnectionState', () => {
    it('should publish ConnectionLost/ConnectionRestored events', async () => {
      await service.updateConnectionState('org-1', 'online');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ConnectionRestored' }),
      );

      eventBusMock.publish.mockClear();
      await service.updateConnectionState('org-1', 'offline');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ConnectionLost' }),
      );
    });
  });

  describe('scheduleRetry', () => {
    it('should requeue failed operations with an incremented attempt', async () => {
      // Arrange
      opsMock.findByOrgAndStatus.mockResolvedValue([
        { id: 'op-1', tentative_num: 1 } as any,
        { id: 'op-2', tentative_num: 2 } as any,
      ]);

      // Act
      const result = await service.scheduleRetry('org-1');

      // Assert
      expect(result).toBe(2); // 2 operations retried
      expect(opsMock.updateStatusAndAttempt).toHaveBeenCalledTimes(2);
      expect(opsMock.updateStatusAndAttempt).toHaveBeenCalledWith('op-1', SyncStatus.PENDING, 2);
    });
  });
});
