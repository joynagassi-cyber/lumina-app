/**
 * EventEmitter2DomainEventPublisher — CRT-004 (ADR-018).
 *
 * Publication des événements de domaine APRÈS persistance via
 * @nestjs/event-emitter (EventEmitter2). Implémente l'interface
 * DomainEventPublisher (drop-in pour le finance module et les futurs
 * domaines) : handlers @OnEvent / register, publication séquentielle
 * (emitAsync) — l'échec d'un handler n'isole pas les autres.
 *
 * @traceability ADR-018 §3.1 (CRT-004), PAS-001 (EventPublicationPort)
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent, DomainEventHandler } from '../../shared/events';
import type { DomainEventPublisher } from '../../domains/finance/shared/events/event-publisher.interface';

@Injectable()
export class EventEmitter2DomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly emitter: EventEmitter2) {}

  /** Enregistre un handler pour un type d'événement (équivalent @OnEvent). */
  register<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void {
    this.emitter.on(eventType, (event: T) => {
      // Fire-and-forget : l'échec d'un handler est loggé par EventEmitter2
      // et n'affecte ni la publication ni les autres handlers.
      void handler(event);
    });
  }

  /** Publie un événement après persistance. */
  async publish(event: DomainEvent): Promise<void> {
    await this.emitter.emitAsync(event.eventType, event);
  }

  /** Publie une séquence d'événements (dans l'ordre). */
  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
