/**
 * SyncModule — NestJS module for OfflineSyncAggregate.
 * Registers all domain services, infrastructure adapters, and the scheduler.
 *
 * @traceability DOC-012 Aggregate13, ASS-001 §SERVICE 13, RTS-v1 NeverBreak Rules
 */

import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Ports (interfaces defined in domain)
import type {
  IPendingOperationsPort,
  ISyncStatusRepositoryPort,
} from '@domains/sync/ports';
import type { IRemoteApiPort } from '@domains/sync/ports/remote-api-port.interface';

// DI tokens for port interfaces (interfaces ne peuvent pas être des tokens valeur)
const IPENDING_OPERATIONS_PORT = 'IPendingOperationsPort';
const ISYNC_STATUS_REPOSITORY_PORT = 'ISyncStatusRepositoryPort';
const IREMOTE_API_PORT = 'IRemoteApiPort';

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
      provide: IPENDING_OPERATIONS_PORT,
      useClass: PrismaPendingOperationsRepository,
    },
    {
      provide: ISYNC_STATUS_REPOSITORY_PORT,
      useClass: PrismaSyncStatusRepository,
    },
    {
      provide: IREMOTE_API_PORT,
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
    IPENDING_OPERATIONS_PORT,
    ISYNC_STATUS_REPOSITORY_PORT,
    IREMOTE_API_PORT,
    SyncScheduler,
  ],
})
export class SyncModule {}
