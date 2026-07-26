/**
 * Finance domain-level events. Extends the shared DomainEvent base class.
 *
 * @traceability DOC-012 Aggregate3 (Domain Events list)
 */

import { DomainEvent, type DomainEventHandler } from '../../shared/events';

export type { DomainEvent, DomainEventHandler };

export class ResourceCreated extends DomainEvent {
  constructor(
    public readonly resourceId: { toString(): string },
    public readonly resourceType: string,
    public readonly orgId: string,
    occurredAt = new Date(),
  ) {
    super('ResourceCreated', occurredAt);
  }
}

export class ResourceUpdated extends DomainEvent {
  constructor(
    public readonly resourceId: { toString(): string },
    public readonly resourceType: string,
    public readonly version: number,
    occurredAt = new Date(),
  ) {
    super('ResourceUpdated', occurredAt);
  }
}

export class ResourceStateChanged extends DomainEvent {
  constructor(
    public readonly resourceId: { toString(): string },
    public readonly resourceType: string,
    public readonly fromState: string,
    public readonly toState: string,
    occurredAt = new Date(),
  ) {
    super('ResourceStateChanged', occurredAt);
  }
}

export class ResourceDeleted extends DomainEvent {
  constructor(
    public readonly resourceId: { toString(): string },
    public readonly resourceType: string,
    occurredAt = new Date(),
  ) {
    super('ResourceDeleted', occurredAt);
  }
}

export class TransactionCompensated extends DomainEvent {
  constructor(
    public readonly originalTransactionId: { toString(): string },
    public readonly compensationTransactionId: { toString(): string },
    public readonly orgId: string,
    occurredAt = new Date(),
  ) {
    super('TransactionCompensated', occurredAt);
  }
}

export class ApprovalRequested extends DomainEvent {
  constructor(
    public readonly transactionId: { toString(): string },
    public readonly orgId: string,
    public readonly requestedBy: string,
    occurredAt = new Date(),
  ) {
    super('ApprovalRequested', occurredAt);
  }
}

export class ApprovalGranted extends DomainEvent {
  constructor(
    public readonly transactionId: { toString(): string },
    public readonly grantedBy: string,
    public readonly orgId: string,
    occurredAt = new Date(),
  ) {
    super('ApprovalGranted', occurredAt);
  }
}

export class ApprovalRejected extends DomainEvent {
  constructor(
    public readonly transactionId: { toString(): string },
    public readonly rejectedBy: string,
    public readonly reason: string | null,
    occurredAt = new Date(),
  ) {
    super('ApprovalRejected', occurredAt);
  }
}
