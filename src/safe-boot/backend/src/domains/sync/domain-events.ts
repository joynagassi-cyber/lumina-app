/**
 * SyncDomainEvents — all domain-level events emitted by OfflineSyncAggregate.
 *
 * @traceability DOC-012 Aggregate13 (Domain Events produits)
 */

import { DomainEvent } from '@shared/events';

export class SyncStarted extends DomainEvent {
  constructor(
    public readonly orgId: string,
    public readonly direction: 'push' | 'pull',
  ) {
    super('SyncStarted');
  }
}

export class BatchPushed extends DomainEvent {
  constructor(
    public readonly orgId: string,
    public readonly batchId: string,
    public readonly operationCount: number,
  ) {
    super('BatchPushed');
  }
}

export class DeltaReceived extends DomainEvent {
  constructor(
    public readonly orgId: string,
    public readonly changeCount: number,
    public readonly sinceTimestamp: Date,
  ) {
    super('DeltaReceived');
  }
}

export class ConflictDetected extends DomainEvent {
  constructor(
    public readonly orgId: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly localValue: unknown,
    public readonly remoteValue: unknown,
  ) {
    super('ConflictDetected');
  }
}

export class ConflictResolved extends DomainEvent {
  constructor(
    public readonly orgId: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly resolution: string,
  ) {
    super('ConflictResolved');
  }
}

export class SyncCompleted extends DomainEvent {
  constructor(
    public readonly orgId: string,
    public readonly direction: 'push' | 'pull',
    public readonly operationsProcessed: number,
  ) {
    super('SyncCompleted');
  }
}

export class ConnectionLost extends DomainEvent {
  constructor(public readonly orgId: string) {
    super('ConnectionLost');
  }
}

export class ConnectionRestored extends DomainEvent {
  constructor(public readonly orgId: string) {
    super('ConnectionRestored');
  }
}
