/**
 * SyncModule — NestJS module for OfflineSyncAggregate.
 * Registers all domain services, infrastructure adapters, and the scheduler.
 *
 * @traceability DOC-012 Aggregate13, ASS-001 §SERVICE 13, RTS-v1 NeverBreak Rules
 */

import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Ports (interfaces defined in domain)
import {
  IPendingOperationsPort,
  ISyncStatusRepositoryPort,
} from '@domains/sync/ports';
import { IRemoteApiPort } from '@domains/sync/ports/remote-api-port.interface';

// Application Service
import { OfflineSyncService } from './application-service/offline-sync.service';

// Domain Services
import {
  PushCoordinator,
  PullCoordinator,
  ConflictResolver,
  Retrier,
} from './domain-services';

// Infrastructure Adapters
import {
  PrismaPendingOperationsRepository,
  PrismaSyncStatusRepository,
  HttpRemoteApiClient,
} from '@infrastructure/adapters/sync';

// Persistence
import { PrismaPersistenceAdapter } from '@infrastructure/persistence/prisma';

// Scheduler for automatic sync
import { SyncScheduler } from './sync.scheduler';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    // Persistence layer
    PrismaPersistenceAdapter,

    // Infrastructure adapters
    {
      provide: IPendingOperationsPort,
      useClass: PrismaPendingOperationsRepository,
    },
    {
      provide: ISyncStatusRepositoryPort,
      useClass: PrismaSyncStatusRepository,
    },
    {
      provide: IRemoteApiPort,
      useClass: HttpRemoteApiClient,
    },

    // Domain services
    PushCoordinator,
    PullCoordinator,
    ConflictResolver,
    Retrier,

    // Application service
    OfflineSyncService,

    // Scheduler — triggers sync on interval
    SyncScheduler,
  ],
  exports: [
    OfflineSyncService,
    IPendingOperationsPort,
    ISyncStatusRepositoryPort,
    IRemoteApiPort,
    SyncScheduler,
  ],
})
export class SyncModule {}
