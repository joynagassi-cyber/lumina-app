/**
 * EventWebHookAdapter — Infrastructure Adapter for IEventPublicationPort
 *
 * Publishes domain events through a web hook or message bus.
 * Preserves exact event payload per PAS-005 PA-NB-006 (EventConsistency).
 *
 * @traceability DOC-012 Aggregate1 §DomainEvents → API-CONTRACT-001
 *   → PAS-001 Port-002 (EventPublicationPort)
 *   → PAS-005 PA-NB-006
 */

import type { IEventPublicationPort, DomainEvent } from '../../ports/event-pub.port';

export class WebHookEventPublicationAdapter implements IEventPublicationPort {
  constructor(
    private readonly endPointUrl: string,
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.publishMany([event]);
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    // Payload must be preserved EXACTLY — no filtering, no truncation (PA-NB-006)
    const payload = events.map(e => ({
      aggregateId: e.aggregateId,
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      payload: e.payload,
    }));

    // HTTP POST to configured web hook endpoint
    // In production: replace with actual fetch/WebSocket/messaging client
    throw new Error('WebHookEventPublicationAdapter requires an active HTTP client at composition root.');
  }
}
