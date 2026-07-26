/**
 * DomainEventPublisher interface — contract for publishing event domain events.
 * Mirrors the shared pattern but scoped to Event aggregate.
 *
 * @traceability DOC-012 Aggregate3 (domain event production)
 */

import { DomainEvent } from '../../../shared/events';

export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
