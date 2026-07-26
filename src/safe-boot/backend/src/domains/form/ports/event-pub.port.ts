/**
 * Event Publication Port — FormAggregate
 *
 * Contract for publishing Domain Events produced by the FormAggregate.
 * Adapters must preserve exact payload per PAS-005 PA-NB-006.
 *
 * @traceability DOC-012 Aggregate6 §DomainEvents
 *   → PAS-001 Port-002 (EventPublicationPort)
 */

export interface DomainEvent {
  readonly aggregateId: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;
}

export interface IEventPublicationPort {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
}
