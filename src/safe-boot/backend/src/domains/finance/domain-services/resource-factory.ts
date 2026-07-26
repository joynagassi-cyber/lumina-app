/**
 * ResourceFactory — creates new typed resources with defaults and validation.
 *
 * @traceability DOC-012 Aggregate3 (ResourceFactory domain service)
 */

import { ResourceId } from '../value-objects/resource-id.vo';
import { AmountInCents } from '../value-objects/amount-in-cents.vo';
import { TransactionState, TransactionType } from '../value-objects/index';
import { ResourceScope } from '../value-objects/resource-scope.vo';
import { ResourceMetadata } from '../value-objects/resource-metadata.vo';
import { TransactionRecord, TransactionRecordProps } from '../entities/transaction-record.entity';
import { MemberRecord, MemberRecordProps } from '../entities/member-record.entity';
import { EventRecord, EventRecordProps } from '../entities/event-record.entity';
import { ArchiveEntryRecord, ArchiveEntryRecordProps } from '../entities/archive-entry-record.entity';
import { NotificationRecord, NotificationRecordProps, NotificationChannel, NotificationSeverity, NotificationDeliveryStatus } from '../entities/notification-record.entity';

export class ResourceFactory {
  static createTransaction(props: Omit<TransactionRecordProps, 'id'>): TransactionRecord {
    return TransactionRecord.create({
      ...props,
      id: ResourceId.generate(),
    });
  }

  static createMember(props: Omit<MemberRecordProps, 'id'>): MemberRecord {
    return MemberRecord.create({
      ...props,
      id: ResourceId.generate(),
    });
  }

  static createEvent(props: Omit<EventRecordProps, 'id'>): EventRecord {
    return EventRecord.create({
      ...props,
      id: ResourceId.generate(),
    });
  }

  static createArchiveEntry(props: Omit<ArchiveEntryRecordProps, 'id'>): ArchiveEntryRecord {
    return ArchiveEntryRecord.create({
      ...props,
      id: ResourceId.generate(),
    });
  }

  static createNotification(props: Omit<NotificationRecordProps, 'id'>): NotificationRecord {
    return NotificationRecord.create({
      ...props,
      id: ResourceId.generate(),
    });
  }

  /**
   * Create a compensating transaction for an approved one (INV-001).
   * The compensation has opposite amount and type semantics.
   */
  static createCompensation(
    originalTxn: {
      amount: AmountInCents;
      orgId: string;
      createdBy: string;
      categoryRef: string;
      scope: ResourceScope;
      date: Date;
      description: string | null;
    },
    compensatorUserId: string,
  ): TransactionRecord {
    // Compensations use the same type but opposite sign is NOT done at AmountInCents level
    // (amounts are always positive per BR-RES-001); instead the compensator records
    // a separate entry with compensates_for linking back.
    return this.createTransaction({
      orgId: originalTxn.orgId,
      createdBy: compensatorUserId,
      amount: originalTxn.amount,
      type: originalTxn.type,
      state: TransactionState.DRAFT,
      categoryRef: originalTxn.categoryRef,
      scope: originalTxn.scope,
      date: originalTxn.date,
      description: `Compensation for original transaction — INV-001`,
      compensatesFor: null, // set by the application service after persisting the link
      metadata: new ResourceMetadata({ compensationTargetId: null }),
    });
  }
}
