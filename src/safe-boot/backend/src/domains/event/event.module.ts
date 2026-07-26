/**
 * EventModule — NestJS module for the Event Aggregate.
 *
 * Composition root: binds IEventRepository port to PrismaEventRepository,
 * wires EventService (application layer), and exports domain types for cross-module use.
 *
 * Provider binding chain:
 *   IEventRepository ← PrismaEventRepository
 *   EventService (application coordinator)
 *
 * @traceability DOC-012 Aggregate3 (EventRecord), PAS-v1 DR-004, ITS-V1 module registration
 */

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { EventService } from '../application/event.service';
import { PrismaEventRepository } from './infrastructure/adapters/prisma-event.repository';
import type { IEventRepository } from './ports/event-port.interface';
import type { DomainEventPublisher } from '../application/event-publisher.interface';

const EVENT_REPOSITORY_TOKEN = 'IEventRepository' as const;
const EVENT_PUBLISHER_TOKEN = 'IEventPublisher' as const;

@Module({})
export class EventModule {
  /**
   * Dynamic module factory -- the composition root for the Event aggregate.
   * Call from AppModule.forRoot() with resolved infrastructure dependencies.
   */
  static forRoot(
    prismaClient: unknown,
    eventPublisher: DomainEventPublisher,
  ): DynamicModule {
    const providers: Provider[] = [
      // Repository adapter bound to port interface token
      {
        provide: EVENT_REPOSITORY_TOKEN,
        useClass: PrismaEventRepository,
      },
      // Event publisher
      {
        provide: EVENT_PUBLISHER_TOKEN,
        useValue: eventPublisher,
      },
      // Application service receives injected ports
      {
        provide: EventService,
        useFactory: (
          repo: IEventRepository,
          publisher: DomainEventPublisher,
        ) => new EventService(repo, publisher),
        inject: [EVENT_REPOSITORY_TOKEN, EVENT_PUBLISHER_TOKEN],
      },
    ];

    return {
      module: EventModule,
      providers,
      exports: [
        EventService,
        EVENT_REPOSITORY_TOKEN,
        EVENT_PUBLISHER_TOKEN,
        PrismaEventRepository,
      ],
    };
  }
}
