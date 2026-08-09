/**
 * FinanceService Unit Tests — Exception/Fail Cases
 *
 * Tests error handling and failure scenarios for FinanceService operations.
 * @traceability DOC-012 BR-RES-001 through BR-RES-008
 */

import { FinanceService } from '@/domains/finance/application-service';
import { ITransactionPort, IMemberPort, IEventPort, IArchiveEntryPort, INotificationPort } from '@/domains/finance/ports/finance-ports';
import { DomainEventPublisher } from '@/domains/finance/shared/events/event-publisher.interface';
import { ResourceId } from '@/domains/finance/value-objects/resource-id.vo';
import { TransactionState } from '@/domains/finance/value-objects/transaction-state.vo';
import { TransactionType } from '@/domains/finance/entities/transaction-record.entity';
import { ResourceScopeType } from '@/domains/finance/value-objects/resource-scope.vo';
import { AmountInCents } from '@/domains/finance/value-objects/amount-in-cents.vo';

// Mock implementations
class MockTransactionPort implements any {
  create = jest.fn();
  update = jest.fn();
  findById = jest.fn();
  findByOrgAndPage = jest.fn();
  transitionState = jest.fn();
  approve = jest.fn();
  reject = jest.fn();
  compensate = jest.fn();
  delete = jest.fn();
}

class MockMemberPort implements any {
  create = jest.fn();
  findById = jest.fn();
  update = jest.fn();
}

class MockEventPort implements any {
  create = jest.fn();
}

class MockArchiveEntryPort implements any {
  create = jest.fn();
}

class MockNotificationPort implements any {}

class MockEventBus implements DomainEventPublisher {
  publish = jest.fn().mockResolvedValue(undefined);
}

describe('FinanceService — Exception Cases', () => {
  let service: FinanceService;
  let txPortMock: MockTransactionPort;
  let memberPortMock: MockMemberPort;
  let eventPortMock: MockEventPort;
  let archivePortMock: MockArchiveEntryPort;
  let notifPortMock: MockNotificationPort;
  let eventBusMock: MockEventBus;

  beforeEach(async () => {
    jest.restoreAllMocks();

    txPortMock = new MockTransactionPort();
    memberPortMock = new MockMemberPort();
    eventPortMock = new MockEventPort();
    archivePortMock = new MockArchiveEntryPort();
    notifPortMock = new MockNotificationPort();
    eventBusMock = new MockEventBus();

    // Setup default mocks
    txPortMock.create.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001' });
    memberPortMock.create.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000002' });
    eventPortMock.create.mockResolvedValue({ id: 'evt-1' });
    archivePortMock.create.mockResolvedValue({ id: 'arch-1' });

    // Construction directe (le domaine est agnostique du conteneur Nest — ADR-018)
    service = new FinanceService(txPortMock, memberPortMock, eventPortMock, archivePortMock, notifPortMock, eventBusMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ======================================================================
  // createTransaction — Exceptions
  // ======================================================================
  describe('createTransaction — Exception Cases', () => {
    it('should propagate errors from transaction port', async () => {
      // Arrange
      txPortMock.create.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(
        service.createTransaction({
          amount: new AmountInCents(100),
          type: TransactionType.EXPENSE,
          state: TransactionState.DRAFT,
          scopeType: ResourceScopeType.ORG,
          scopeTargetId: 'org-1',
          date: new Date(),
          categoryRef: 'cat-1',
          createdBy: 'user-1',
          orgId: 'org-1',
        }),
      ).rejects.toThrow('DB error');
    });
  });

  // ======================================================================
  // updateTransaction — Exceptions
  // ======================================================================
  describe('updateTransaction — Exception Cases', () => {
    it('should handle transaction not found', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateTransaction('00000000-0000-4000-8000-000000000099', {}, 1)).rejects.toThrow('Transaction 00000000-0000-4000-8000-000000000099 not found');
    });
  });

  // ======================================================================
  // requestApproval — Exceptions
  // ======================================================================
  describe('requestApproval — Exception Cases', () => {
    it('should throw when transaction not found', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.requestApproval('00000000-0000-4000-8000-000000000099')).rejects.toThrow('Transaction 00000000-0000-4000-8000-000000000099 not found');
    });
  });

  // ======================================================================
  // approveTransaction — Exceptions
  // ======================================================================
  describe('approveTransaction — Exception Cases', () => {
    it('should throw when transaction not found', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(approveTransaction('00000000-0000-4000-8000-000000000099', 'user-1')).rejects.toThrow('Transaction 00000000-0000-4000-8000-000000000099 not found');
    });
  });

  // Helper to fix typo above
  async function approveTransaction(id: string, approverUserId: string) {
    return service.approveTransaction(id, approverUserId);
  }

  // ======================================================================
  // rejectTransaction — Exceptions
  // ======================================================================
  describe('rejectTransaction — Exception Cases', () => {
    it('should throw when transaction not found', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.rejectTransaction('00000000-0000-4000-8000-000000000099')).rejects.toThrow('Transaction 00000000-0000-4000-8000-000000000099 not found');
    });
  });

  // ======================================================================
  // compensateTransaction — Exceptions
  // ======================================================================
  describe('compensateTransaction — Exception Cases', () => {
    it('should throw when original transaction not found', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.compensateTransaction('00000000-0000-4000-8000-000000000003', { amount: new AmountInCents(100), type: TransactionType.COMPENSATION, state: TransactionState.DRAFT, scopeType: ResourceScopeType.ORG, scopeTargetId: 'org-1', date: new Date(), categoryRef: 'cat-1', createdBy: 'user-1' }),
      ).rejects.toThrow('Original transaction 00000000-0000-4000-8000-000000000003 not found');
    });
  });

  // ======================================================================
  // searchTransactions — Exceptions
  // ======================================================================
  describe('searchTransactions — Exception Cases', () => {
    it('should propagate errors from transaction port', async () => {
      // Arrange
      txPortMock.findByOrgAndPage.mockRejectedValue(new Error('Search failed'));

      // Act & Assert
      await expect(service.searchTransactions({ orgId: 'org-1', page: 1, limit: 10 })).rejects.toThrow('Search failed');
    });
  });

  // ======================================================================
  // deleteTransaction — Exceptions
  // ======================================================================
  describe('deleteTransaction — Exception Cases', () => {
    it('should handle transaction not found', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteTransaction('00000000-0000-4000-8000-000000000099')).rejects.toThrow('Transaction 00000000-0000-4000-8000-000000000099 not found');
    });
  });

  // ======================================================================
  // createMember — Exceptions
  // ======================================================================
  describe('createMember — Exception Cases', () => {
    it('should propagate errors from member port', async () => {
      // Arrange
      memberPortMock.create.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.createMember({ orgId: 'org-1', email: 'user@example.com', firstName: 'John', lastName: 'Doe', role: 'staff' })).rejects.toThrow('DB error');
    });
  });

  // ======================================================================
  // updateMember — Exceptions
  // ======================================================================
  describe('updateMember — Exception Cases', () => {
    it('should handle member not found', async () => {
      // Arrange
      memberPortMock.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateMember('00000000-0000-4000-8000-000000000098', {}, 1)).rejects.toThrow('Member 00000000-0000-4000-8000-000000000098 not found');
    });
  });

  // ======================================================================
  // createEvent — Exceptions
  // ======================================================================
  describe('createEvent — Exception Cases', () => {
    it('should propagate errors from event port', async () => {
      // Arrange
      eventPortMock.create.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.createEvent({ orgId: 'org-1', title: 'Test Event', date: new Date() })).rejects.toThrow('DB error');
    });
  });

  // ======================================================================
  // createArchiveEntry — Exceptions
  // ======================================================================
  describe('createArchiveEntry — Exception Cases', () => {
    it('should propagate errors from archive port', async () => {
      // Arrange
      archivePortMock.create.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.createArchiveEntry({ orgId: 'org-1', recordType: 'transaction', recordId: '00000000-0000-4000-8000-000000000001' })).rejects.toThrow('DB error');
    });
  });

  // Edge case: publishEvents failure
  describe('Publishing Events — Exception Cases', () => {
    it('should handle event publication error gracefully (propagates)', async () => {
      // Arrange - Test a command that publishes events
      txPortMock.findById.mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), orgId: 'org-1', createdBy: 'user-1', state: TransactionState.DRAFT });
      txPortMock.transitionState.mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), orgId: 'org-1', createdBy: 'user-1', state: TransactionState.PENDING });
      eventBusMock.publish.mockRejectedValue(new Error('Event bus down'));

      // Act & Assert - requestApproval should propagate the error
      await expect(service.requestApproval('00000000-0000-4000-8000-000000000001')).rejects.toThrow('Event bus down');
    });
  });
});
