/**
 * Finance Domain Ports — contract interfaces for the ResourceAggregate.
 * Infrastructure adapters implement these; application services depend on them.
 *
 * @traceability DOC-012 Aggregate3 (port boundaries), PAS-v1 (Ports & Adapters)
 */

import { TransactionRecord, TransactionType } from '../entities/transaction-record.entity';
import { MemberRecord } from '../entities/member-record.entity';
import { EventRecord } from '../entities/event-record.entity';
import { ArchiveEntryRecord } from '../entities/archive-entry-record.entity';
import { NotificationRecord } from '../entities/notification-record.entity';
import { AmountInCents } from '../value-objects/amount-in-cents.vo';
import { ResourceId } from '../value-objects/resource-id.vo';
import { ResourceVersion } from '../value-objects/resource-version.vo';
import { ResourceMetadata } from '../value-objects/resource-metadata.vo';
import { ResourceScope } from '../value-objects/resource-scope.vo';
import { TransactionReference } from '../value-objects/transaction-reference.vo';
import type { PaginatedResult } from '../../../shared/types';

// --- Transaction Ports ---

export interface CreateTransactionInput {
  orgId: string;
  createdBy: string;
  amount: AmountInCents;
  type: TransactionType;
  categoryRef: string;
  scope: ResourceScope;
  date: Date;
  description?: string | null;
  compensatesFor?: TransactionReference | null;
  metadata?: ResourceMetadata;
}

export interface UpdateTransactionInput {
  amount?: AmountInCents;
  description?: string | null;
  date?: Date;
  categoryRef?: string;
  scope?: ResourceScope;
  metadata?: ResourceMetadata;
}

export interface TransactionQueryFilters {
  orgId: string;
  state?: string;
  type?: TransactionType;
  categoryRef?: string;
  dateFrom?: Date;
  dateTo?: Date;
  scopeTargetId?: string;
  page?: number;
  limit?: number;
}

// --- Member Ports ---

export interface CreateMemberInput {
  orgId: string;
  createdBy: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
  memberNumber: string;
  joinDate: Date;
  metadata?: ResourceMetadata;
}

export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
  metadata?: ResourceMetadata;
}

// --- Event Ports ---

export interface CreateEventInput {
  orgId: string;
  createdBy: string;
  title: string;
  eventType: string;
  startAt: Date;
  endAt: Date;
  location?: string | null;
  responsibleUserId?: string | null;
  description?: string | null;
  metadata?: ResourceMetadata;
}

// --- Archive Ports ---

export interface CreateArchiveEntryInput {
  orgId: string;
  createdBy: string;
  resourceTypeOriginal: string;
  resourceIdOriginal: string;
  linkedMemberId?: string | null;
  tags?: string[];
  category?: string | null;
  attachmentUrls?: string[];
  metadata?: ResourceMetadata;
}

// --- Port Interfaces ---

export interface ITransactionPort {
  findById(id: ResourceId): Promise<TransactionRecord | null>;
  findByOrgAndPage(filters: TransactionQueryFilters): Promise<PaginatedResult<TransactionRecord>>;
  create(input: CreateTransactionInput): Promise<TransactionRecord>;
  update(id: ResourceId, input: UpdateTransactionInput, expectedVersion: ResourceVersion): Promise<TransactionRecord>;
  transitionState(id: ResourceId, fromState: string, toState: string): Promise<TransactionRecord>;
  approve(id: ResourceId, approverUserId: string): Promise<TransactionRecord>;
  reject(id: ResourceId, reason?: string): Promise<TransactionRecord>;
  compensate(originalId: ResourceId, compensationData: CreateTransactionInput & { createdBy: string }): Promise<{ original: TransactionRecord; compensation: TransactionRecord }>;
  delete(id: ResourceId): Promise<boolean>;
}

export interface IMemberPort {
  findById(id: ResourceId): Promise<MemberRecord | null>;
  findByOrg(orgId: string, page?: number, limit?: number): Promise<PaginatedResult<MemberRecord>>;
  create(input: CreateMemberInput): Promise<MemberRecord>;
  update(id: ResourceId, input: UpdateMemberInput, expectedVersion: ResourceVersion): Promise<MemberRecord>;
  changeState(id: ResourceId, newState: string, expectedVersion: ResourceVersion): Promise<MemberRecord>;
  delete(id: ResourceId): Promise<boolean>;
}

export interface IEventPort {
  findById(id: ResourceId): Promise<EventRecord | null>;
  findByOrg(orgId: string, page?: number, limit?: number): Promise<PaginatedResult<EventRecord>>;
  create(input: CreateEventInput): Promise<EventRecord>;
  update(id: ResourceId, input: Omit<UpdateTransactionInput, 'amount'> & Partial<{ title: string; eventType: string; startAt: Date; endAt: Date; location: string | null; responsibleUserId: string | null; description: string | null; metadata: ResourceMetadata }>, expectedVersion: ResourceVersion): Promise<EventRecord>;
  transitionState(id: ResourceId, fromState: string, toState: string): Promise<EventRecord>;
  delete(id: ResourceId): Promise<boolean>;
}

export interface IArchiveEntryPort {
  findById(id: ResourceId): Promise<ArchiveEntryRecord | null>;
  findByOrg(orgId: string, page?: number, limit?: number): Promise<PaginatedResult<ArchiveEntryRecord>>;
  create(input: CreateArchiveEntryInput): Promise<ArchiveEntryRecord>;
  transitionState(id: ResourceId, fromState: string, toState: string): Promise<ArchiveEntryRecord>;
  applyTags(id: ResourceId, tags: string[]): Promise<ArchiveEntryRecord>;
  removeTags(id: ResourceId, tagsToRemove: string[]): Promise<ArchiveEntryRecord>;
  delete(id: ResourceId): Promise<boolean>;
}

export interface INotificationPort {
  findById(id: ResourceId): Promise<NotificationRecord | null>;
  findByRecipient(userId: string, orgId: string, page?: number, limit?: number): Promise<PaginatedResult<NotificationRecord>>;
  create(input: {
    orgId: string;
    createdBy: string;
    recipientUserId: string;
    subjectFr: string;
    subjectEn: string;
    bodyFr: string;
    bodyEn: string;
    channel: string;
    severity: string;
    triggeredBy?: string | null;
  }): Promise<NotificationRecord>;
  markSent(id: ResourceId): Promise<NotificationRecord>;
  markFailed(id: ResourceId): Promise<NotificationRecord>;
  markRead(id: ResourceId): Promise<NotificationRecord>;
  markRetry(id: ResourceId): Promise<NotificationRecord>;
}
