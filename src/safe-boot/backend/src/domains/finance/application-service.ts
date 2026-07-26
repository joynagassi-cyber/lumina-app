/**
 * FinanceService — Application Service for the ResourceAggregate.
 * Coordinates domain logic through ports, produces domain events, handles audit logging.
 *
 * @traceability DOC-012 Aggregate3 (Application Service), ASS-001 (FinanceService)
 */

import { Injectable } from '@nestjs/common';
import type {
  ITransactionPort,
  IMemberPort,
  IEventPort,
  IArchiveEntryPort,
  INotificationPort,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQueryFilters,
  CreateMemberInput,
  UpdateMemberInput,
  CreateEventInput,
  CreateArchiveEntryInput,
} from './ports/finance-ports';
import type { DomainEventPublisher } from './shared/events/event-publisher.interface';
import { ImmutabilityPolicy } from './domain-policies/immutability-policy';
import { VersioningPolicy } from './domain-policies/versioning-policy';
import { ScopePolicy } from './domain-policies/scope-policy';
import { ResourceValidator } from './domain-services/resource-validator';
import { ResourceFactory } from './domain-services/resource-factory';
import {
  ResourceCreated,
  ResourceUpdated,
  ResourceStateChanged,
  ResourceDeleted,
  TransactionCompensated,
  ApprovalRequested,
  ApprovalGranted,
  ApprovalRejected,
  type DomainEvent,
} from './domain-events';
import { ResourceId } from './value-objects/resource-id.vo';
import { TransactionState } from './value-objects/transaction-state.vo';
import type { PaginatedResult } from '../../shared/types';

@Injectable()
export class FinanceService {
  constructor(
    private readonly transactionPort: ITransactionPort,
    private readonly memberPort: IMemberPort,
    private readonly eventPort: IEventPort,
    private readonly archiveEntryPort: IArchiveEntryPort,
    private readonly notificationPort: INotificationPort,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  // ====== Transaction Commands ======

  async createTransaction(input: CreateTransactionInput): Promise<{ transaction: ReturnType<typeof this.transactionPort.create>; events: DomainEvent[] }> {
    const entity = await this.transactionPort.create(input);
    const events: DomainEvent[] = [new ResourceCreated(entity.id, 'transaction', input.orgId)];
    if (input.compensatesFor) {
      events.push(new ApprovalRequested(entity.id, input.orgId, input.createdBy));
    }
    await this.publishEvents(events);
    return { transaction: entity, events };
  }

  async updateTransaction(id: string, input: UpdateTransactionInput, expectedVersion: number): Promise<void> {
    const resourceId = new ResourceId(id);
    const existing = await this.transactionPort.findById(resourceId);
    if (!existing) throw new Error(`Transaction ${id} not found`);
    VersioningPolicy.validate(expectedVersion, existing.version.value);
    ImmutabilityPolicy.assertMutable(existing);
    await this.transactionPort.update(resourceId, input, existing.version);
    await this.publishEvents([new ResourceUpdated(resourceId, 'transaction', existing.version.next().value)]);
  }

  async requestApproval(id: string): Promise<void> {
    const resourceId = new ResourceId(id);
    const entity = await this.transactionPort.findById(resourceId);
    if (!entity) throw new Error(`Transaction ${id} not found`);
    const updated = await this.transactionPort.transitionState(resourceId, 'draft', 'pending');
    await this.publishEvents([
      new ApprovalRequested(updated.id, updated.orgId, updated.createdBy),
      new ResourceStateChanged(updated.id, 'transaction', 'draft', 'pending'),
    ]);
  }

  async approveTransaction(id: string, approverUserId: string): Promise<void> {
    const resourceId = new ResourceId(id);
    const entity = await this.transactionPort.findById(resourceId);
    if (!entity) throw new Error(`Transaction ${id} not found`);
    const updated = await this.transactionPort.approve(resourceId, approverUserId);
    await this.publishEvents([
      new ApprovalGranted(updated.id, approverUserId, updated.orgId),
      new ResourceStateChanged(updated.id, 'transaction', 'pending', 'approved'),
    ]);
  }

  async rejectTransaction(id: string, reason?: string): Promise<void> {
    const resourceId = new ResourceId(id);
    const entity = await this.transactionPort.findById(resourceId);
    if (!entity) throw new Error(`Transaction ${id} not found`);
    const updated = await this.transactionPort.reject(resourceId);
    await this.publishEvents([
      new ApprovalRejected(updated.id, entity.createdBy, reason ?? null),
      new ResourceStateChanged(updated.id, 'transaction', 'pending', 'rejected'),
    ]);
  }

  async compensateTransaction(originalId: string, compensationData: CreateTransactionInput & { createdBy: string }): Promise<void> {
    const originalResourceId = new ResourceId(originalId);
    const original = await this.transactionPort.findById(originalResourceId);
    if (!original) throw new Error(`Original transaction ${originalId} not found`);
    if (original.state !== TransactionState.APPROVED) {
      throw new Error('Compensation can only be applied to approved transactions (INV-001)');
    }
    const result = await this.transactionPort.compensate(originalResourceId, { ...compensationData, orgId: original.orgId });
    await this.publishEvents([
      new TransactionCompensated(originalResourceId, result.compensation.id, original.orgId),
      new ResourceCreated(result.compensation.id, 'transaction', original.orgId),
    ]);
  }

  async searchTransactions(filters: TransactionQueryFilters): Promise<PaginatedResult<unknown>> {
    return this.transactionPort.findByOrgAndPage(filters);
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const resourceId = new ResourceId(id);
    const entity = await this.transactionPort.findById(resourceId);
    if (!entity) throw new Error(`Transaction ${id} not found`);
    ImmutabilityPolicy.assertMutable(entity);
    const deleted = await this.transactionPort.delete(resourceId);
    if (deleted) {
      await this.publishEvents([new ResourceDeleted(resourceId, 'transaction')]);
    }
    return deleted;
  }

  // ====== Member Commands ======

  async createMember(input: CreateMemberInput): Promise<void> {
    const entity = await this.memberPort.create(input);
    await this.publishEvents([new ResourceCreated(entity.id, 'member', input.orgId)]);
  }

  async updateMember(id: string, input: UpdateMemberInput, expectedVersion: number): Promise<void> {
    const resourceId = new ResourceId(id);
    const existing = await this.memberPort.findById(resourceId);
    if (!existing) throw new Error(`Member ${id} not found`);
    VersioningPolicy.validate(expectedVersion, existing.version.value);
    await this.memberPort.update(resourceId, input, existing.version);
    await this.publishEvents([new ResourceUpdated(resourceId, 'member', existing.version.next().value)]);
  }

  // ====== Event Commands ======

  async createEvent(input: CreateEventInput): Promise<void> {
    const entity = await this.eventPort.create(input);
    await this.publishEvents([new ResourceCreated(entity.id, 'event', input.orgId)]);
  }

  // ====== Archive Entry Commands ======

  async createArchiveEntry(input: CreateArchiveEntryInput): Promise<void> {
    const entity = await this.archiveEntryPort.create(input);
    await this.publishEvents([new ResourceCreated(entity.id, 'archive_entry', input.orgId)]);
  }

  // ====== Private Helpers ======

  private async publishEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }
  }
}
