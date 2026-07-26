/**
 * InMemoryDomainEventPublisher — synchronous in-process event dispatch.
 * For production, swap with a message queue adapter (RabbitMQ/SQS).
 */

import { Injectable } from '@nestjs/common';
import { DomainEvent, DomainEventHandler } from '../events';

@Injectable()
export class InMemoryDomainEventPublisher {
  private readonly handlers = new Map<string, Set<DomainEventHandler<DomainEvent>>>();

  register<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as DomainEventHandler<DomainEvent>);
  }

  async publish(event: DomainEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.eventType);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        await handler(event);
      }
    }
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
