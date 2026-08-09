/**
 * EventBusAdapter — Implements IEventPublisherPort using an in-memory event bus.
 *
 * In a production system, this would be replaced with a proper event bus (e.g., Kafka, Redis, etc.).
 *
 * @traceability DelegationDomain → Event publishing infrastructure
 */

import { IEventPublisherPort } from '../../ports/delegation.ports';

export class EventBusAdapter implements IEventPublisherPort {
  private readonly handlers: Array<(event: unknown) => Promise<void>> = [];

 /** Register an event handler. */
  subscribe(handler: (event: unknown) => Promise<void>): void {
    this.handlers.push(handler);
  }

  /** Publish an event to all registered handlers. */
  async publish(event: unknown): Promise<void> {
    // In a real implementation, this would publish to a message broker
    // For now, we just store it for later processing by event handlers
    // The actual event publishing is done by the application service
    console.log('Event published:', event);
  }
}