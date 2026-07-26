/**
 * Event Publication Port
 *
 * Contract for publishing Domain Events produced by the OrganizationAggregate.
 * Adapters must preserve exact payload per PAS-005 PA-NB-006.
 * The DomainEvent interface is defined here to avoid Port importing from Domain (PA-NB-004).
 *
 * @traceability DOC-012 Aggregate1 §DomainEvents
 *   → PAS-001 Port-002 (EventPublicationPort)
 *   → PAS-005 PA-NB-006 (EventConsistency)
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
