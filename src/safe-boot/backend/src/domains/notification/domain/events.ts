/**
 * NotificationDomainEvents — all domain-level events emitted by NotificationAggregate.
 *
 * @traceability DOC-012 Aggregate7 (Domain Events produits)
 *   → NotificationQueued, NotificationSent, NotificationFailed,
 *     NotificationMarkedRead, PreferencesUpdated
 */

import { DomainEvent } from '@shared/events';

export class NotificationQueued extends DomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly orgId: string,
    public readonly recipientUserId: string,
    public readonly channel: string,
    public readonly triggeredBy: string,
  ) {
    super('NotificationQueued');
  }
}

export class NotificationSent extends DomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly orgId: string,
    public readonly channel: string,
    public readonly transportId?: string | null,
  ) {
    super('NotificationSent');
  }
}

export class NotificationFailed extends DomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly orgId: string,
    public readonly channel: string,
    public readonly reason: string,
    public readonly attemptNumber: number,
  ) {
    super('NotificationFailed');
  }
}

export class NotificationMarkedRead extends DomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
  ) {
    super('NotificationMarkedRead');
  }
}

export class PreferencesUpdated extends DomainEvent {
  constructor(
    public readonly preferenceId: string,
    public readonly userId: string,
    public readonly orgId: string,
    public readonly changedFields: string[],
  ) {
    super('PreferencesUpdated');
  }
}
