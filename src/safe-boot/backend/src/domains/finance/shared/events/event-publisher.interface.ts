/**
 * DomainEventPublisher interface — contract for publishing domain events to listeners/queues.
 *
 * @traceability DOC-012 Aggregate3 (domain event production)
 */

import { DomainEvent } from '../../../../shared/events';

export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
