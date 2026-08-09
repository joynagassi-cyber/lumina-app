/**
 * FinanceService Unit Tests — Positive Cases
 *
 * Tests all major operations of FinanceService (transaction, member, event, archive entry commands).
 * @traceability DOC-012 ASS-001 FinanceService, API-CONTRACT-001
 */

import { FinanceService } from '@/domains/finance/application-service';
import { ITransactionPort, IMemberPort, IEventPort, IArchiveEntryPort, INotificationPort, CreateTransactionInput, UpdateTransactionInput, TransactionQueryFilters, CreateMemberInput, UpdateMemberInput, CreateEventInput, CreateArchiveEntryInput } from '@/domains/finance/ports/finance-ports';
import { DomainEventPublisher } from '@/domains/finance/shared/events/event-publisher.interface';
import { ResourceId } from '@/domains/finance/value-objects/resource-id.vo';
import { TransactionState } from '@/domains/finance/value-objects/transaction-state.vo';
import { TransactionType } from '@/domains/finance/entities/transaction-record.entity';
import { ResourceScopeType } from '@/domains/finance/value-objects/resource-scope.vo';
import { AmountInCents } from '@/domains/finance/value-objects/amount-in-cents.vo';

// Mock implementations
class MockTransactionPort implements ITransactionPort {
  create = jest.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001', orgId: 'org-1', state: TransactionState.DRAFT });
  update = jest.fn().mockResolvedValue(undefined);
  findById = jest.fn().mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), orgId: 'org-1', state: TransactionState.DRAFT, version: { value: 1, next: () => ({ value: 2 }) } });
  findByOrgAndPage = jest.fn().mockResolvedValue({ data: [], count: 0 });
  transitionState = jest.fn().mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), orgId: 'org-1', createdBy: 'user-1', state: TransactionState.PENDING });
  approve = jest.fn().mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), state: TransactionState.APPROVED });
  reject = jest.fn().mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), state: TransactionState.REJECTED });
  compensate = jest.fn().mockResolvedValue({ compensation: { id: 'comp-txn-1' } });
  delete = jest.fn().mockResolvedValue(true);
}

class MockMemberPort implements IMemberPort {
  create = jest.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000002' });
  findById = jest.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000002', version: { value: 1, next: () => ({ value: 2 }) } });
  update = jest.fn().mockResolvedValue(undefined);
}

class MockEventPort implements IEventPort {
  create = jest.fn().mockResolvedValue({ id: 'evt-1' });
}

class MockArchiveEntryPort implements IArchiveEntryPort {
  create = jest.fn().mockResolvedValue({ id: 'arch-1' });
}

class MockNotificationPort implements INotificationPort {}

class MockEventBus implements DomainEventPublisher {
  publish = jest.fn().mockResolvedValue(undefined);
  publishMany = jest.fn().mockResolvedValue(undefined);
}

describe('FinanceService', () => {
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

    // Construction directe (le domaine est agnostique du conteneur Nest — ADR-018)
    service = new FinanceService(txPortMock, memberPortMock, eventPortMock, archivePortMock, notifPortMock, eventBusMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ======================================================================
  // Transaction Commands
  // ======================================================================
  describe('createTransaction', () => {
    it('should create transaction successfully and publish ResourceCreated (positive)', async () => {
      // Arrange
      const input: CreateTransactionInput = {
        amount: new AmountInCents(100),
        type: TransactionType.EXPENSE,
        state: TransactionState.DRAFT,
        scopeType: ResourceScopeType.ORG,
        scopeTargetId: 'org-1',
        date: new Date(),
        categoryRef: 'cat-1',
        createdBy: 'user-1',
        orgId: 'org-1',
      };

      // Act
      const result = await service.createTransaction(input);

      // Assert
      expect(result.transaction).toBeTruthy();
      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ResourceCreated' }));
      expect(txPortMock.create).toHaveBeenCalledWith(input);
    });

    it('should create compensating transaction with approval request', async () => {
      // Arrange
      const input: CreateTransactionInput = {
        amount: new AmountInCents(50),
        type: TransactionType.COMPENSATION,
        state: TransactionState.DRAFT,
        scopeType: ResourceScopeType.ORG,
        scopeTargetId: 'org-1',
        date: new Date(),
        categoryRef: 'cat-1',
        createdBy: 'user-1',
        orgId: 'org-1',
        compensatesFor: 'original-txn-1',
      };

      // Act
      const result = await service.createTransaction(input);

      // Assert - Should also publish ApprovalRequested
      expect(eventBusMock.publish).toHaveBeenCalledTimes(2);
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('ApprovalRequested');
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction with optimistic locking (positive)', async () => {
      // Arrange
      const input: UpdateTransactionInput = { amount: new AmountInCents(200) };
      txPortMock.findById.mockResolvedValue({
        id: new ResourceId('00000000-0000-4000-8000-000000000001'),
        orgId: 'org-1',
        state: TransactionState.DRAFT,
        version: { value: 1, next: () => ({ value: 2 }) },
      });

      // Act
      await service.updateTransaction('00000000-0000-4000-8000-000000000001', input, 1);

      // Assert - le service transmet la version courante lue (verrou optimiste, TOCTOU-safe :
      // le port revalide à l'écriture), pas la version suivante
      expect(txPortMock.update).toHaveBeenCalledWith(
        new ResourceId('00000000-0000-4000-8000-000000000001'),
        input,
        expect.objectContaining({ value: 1, next: expect.any(Function) }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ResourceUpdated' }));
    });

    it('should throw VersionConflictError on version mismatch', async () => {
      // Arrange
      const input: UpdateTransactionInput = { amount: new AmountInCents(200) };
      txPortMock.findById.mockResolvedValue({
        id: new ResourceId('00000000-0000-4000-8000-000000000001'),
        orgId: 'org-1',
        state: TransactionState.DRAFT,
        version: { value: 5, next: () => ({ value: 6 }) },
      });

      // Act & Assert - Expected version is 1 but actual is 5
      await expect(service.updateTransaction('00000000-0000-4000-8000-000000000001', input, 1)).rejects.toThrow();
    });

    it('should throw ImmutabilityPolicyViolationError on approved transaction', async () => {
      // Arrange
      const input: UpdateTransactionInput = { amount: new AmountInCents(200) };
      txPortMock.findById.mockResolvedValue({
        id: new ResourceId('00000000-0000-4000-8000-000000000001'),
        orgId: 'org-1',
        state: TransactionState.APPROVED,
        version: { value: 1, next: () => ({ value: 2 }) },
      });

      // Act & Assert
      await expect(service.updateTransaction('00000000-0000-4000-8000-000000000001', input, 1)).rejects.toThrow();
    });
  });

  describe('requestApproval', () => {
    it('should request approval and publish events (positive)', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), orgId: 'org-1', createdBy: 'user-1', state: TransactionState.DRAFT });
      txPortMock.transitionState.mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), orgId: 'org-1', createdBy: 'user-1', state: TransactionState.PENDING });

      // Act
      await service.requestApproval('00000000-0000-4000-8000-000000000001');

      // Assert
      expect(eventBusMock.publish).toHaveBeenCalledTimes(2);
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('ApprovalRequested');
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('ResourceStateChanged');
    });
  });

  describe('approveTransaction', () => {
    it('should approve transaction and publish events (positive)', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), orgId: 'org-1', createdBy: 'user-1', state: TransactionState.PENDING });
      txPortMock.approve.mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), state: TransactionState.APPROVED });

      // Act
      await service.approveTransaction('00000000-0000-4000-8000-000000000001', 'approver-1');

      // Assert
      expect(eventBusMock.publish).toHaveBeenCalledTimes(2);
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('ApprovalGranted');
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('ResourceStateChanged');
    });
  });

  describe('rejectTransaction', () => {
    it('should reject transaction and publish events (positive)', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), orgId: 'org-1', createdBy: 'user-1', state: TransactionState.PENDING });
      txPortMock.reject.mockResolvedValue({ id: new ResourceId('00000000-0000-4000-8000-000000000001'), state: TransactionState.REJECTED });

      // Act
      await service.rejectTransaction('00000000-0000-4000-8000-000000000001', 'Reason');

      // Assert
      expect(eventBusMock.publish).toHaveBeenCalledTimes(2);
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('ApprovalRejected');
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('ResourceStateChanged');
    });
  });

  describe('compensateTransaction', () => {
    it('should create compensating transaction for approved original (positive)', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue({
        id: new ResourceId('00000000-0000-4000-8000-000000000003'),
        orgId: 'org-1',
        state: TransactionState.APPROVED,
      });
      txPortMock.compensate.mockResolvedValue({
        compensation: { id: 'comp-1', orgId: 'org-1' },
      });

      // Act
      await service.compensateTransaction('00000000-0000-4000-8000-000000000003', {
        amount: new AmountInCents(100),
        type: TransactionType.COMPENSATION,
        state: TransactionState.DRAFT,
        scopeType: ResourceScopeType.ORG,
        scopeTargetId: 'org-1',
        date: new Date(),
        categoryRef: 'cat-1',
        createdBy: 'user-1',
      });

      // Assert
      expect(eventBusMock.publish).toHaveBeenCalledTimes(2);
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('TransactionCompensated');
      expect(eventBusMock.publish.mock.calls.map((c) => c[0].eventType)).toContain('ResourceCreated');
    });

    it('should throw error when compensating non-approved transaction', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue({
        id: new ResourceId('00000000-0000-4000-8000-000000000003'),
        orgId: 'org-1',
        state: TransactionState.DRAFT,
      });

      // Act & Assert
      await expect(
        service.compensateTransaction('00000000-0000-4000-8000-000000000003', { amount: new AmountInCents(100), type: TransactionType.EXPENSE, state: TransactionState.DRAFT, scopeType: ResourceScopeType.ORG, scopeTargetId: 'org-1', date: new Date(), categoryRef: 'cat-1', createdBy: 'user-1' }),
      ).rejects.toThrow('Compensation can only be applied to approved transactions');
    });
  });

  describe('searchTransactions', () => {
    it('should search transactions by filters (positive)', async () => {
      // Arrange
      const filters: TransactionQueryFilters = { orgId: 'org-1', page: 1, limit: 10 };
      txPortMock.findByOrgAndPage.mockResolvedValue({ data: [], count: 0 });

      // Act
      const result = await service.searchTransactions(filters);

      // Assert
      expect(result).toBeTruthy();
      expect(txPortMock.findByOrgAndPage).toHaveBeenCalledWith(filters);
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction successfully (positive)', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue({
        id: new ResourceId('00000000-0000-4000-8000-000000000001'),
        orgId: 'org-1',
        state: TransactionState.DRAFT,
      });
      txPortMock.delete.mockResolvedValue(true);

      // Act
      const result = await service.deleteTransaction('00000000-0000-4000-8000-000000000001');

      // Assert
      expect(result).toBe(true);
      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ResourceDeleted' }));
    });

    it('should throw ImmutabilityPolicyViolationError on approved transaction', async () => {
      // Arrange
      txPortMock.findById.mockResolvedValue({
        id: new ResourceId('00000000-0000-4000-8000-000000000001'),
        orgId: 'org-1',
        state: TransactionState.APPROVED,
      });

      // Act & Assert
      await expect(service.deleteTransaction('00000000-0000-4000-8000-000000000001')).rejects.toThrow();
    });
  });

  // ======================================================================
  // Member Commands
  // ======================================================================
  describe('createMember', () => {
    it('should create member and publish ResourceCreated (positive)', async () => {
      // Arrange
      const input: CreateMemberInput = { orgId: 'org-1', email: 'user@example.com', firstName: 'John', lastName: 'Doe', role: 'staff' };

      // Act
      await service.createMember(input);

      // Assert
      expect(memberPortMock.create).toHaveBeenCalledWith(input);
      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ResourceCreated' }));
    });
  });

  describe('updateMember', () => {
    it('should update member with optimistic locking (positive)', async () => {
      // Arrange
      const input: UpdateMemberInput = { firstName: 'Jane' };
      memberPortMock.findById.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000002', version: { value: 1, next: () => ({ value: 2 }) } });

      // Act
      await service.updateMember('00000000-0000-4000-8000-000000000002', input, 1);

      // Assert - même contrat que pour les transactions : version courante lue transmise au port
      expect(memberPortMock.update).toHaveBeenCalledWith(
        new ResourceId('00000000-0000-4000-8000-000000000002'),
        input,
        expect.objectContaining({ value: 1, next: expect.any(Function) }),
      );
      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ResourceUpdated' }));
    });
  });

  // ======================================================================
  // Event Commands
  // ======================================================================
  describe('createEvent', () => {
    it('should create event and publish ResourceCreated (positive)', async () => {
      // Arrange
      const input: CreateEventInput = { orgId: 'org-1', title: 'Test Event', date: new Date() };

      // Act
      await service.createEvent(input);

      // Assert
      expect(eventPortMock.create).toHaveBeenCalledWith(input);
      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ResourceCreated' }));
    });
  });

  // ======================================================================
  // Archive Entry Commands
  // ======================================================================
  describe('createArchiveEntry', () => {
    it('should create archive entry and publish ResourceCreated (positive)', async () => {
      // Arrange
      const input: CreateArchiveEntryInput = { orgId: 'org-1', recordType: 'transaction', recordId: '00000000-0000-4000-8000-000000000001' };

      // Act
      await service.createArchiveEntry(input);

      // Assert
      expect(archivePortMock.create).toHaveBeenCalledWith(input);
      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ResourceCreated' }));
    });
  });
});
