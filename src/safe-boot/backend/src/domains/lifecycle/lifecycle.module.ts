/**
 * LifecycleModule — NestJS module wiring for LifecycleAggregate.
 *
 * @traceability DOC-012 Aggregate11, PAS-005 DR-004 (Runtime Assembly Responsibility)
 */

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { LifecycleService } from '../application/lifecycle.service';
import { PrismaLifecycleRepository } from './infrastructure/adapters/prisma-lifecycle.repository';
import type { IArchiveEntryPort, IPurgeSchedulePort } from '../ports/lifecycle.port';

const ArchiveEntryPortToken = 'IArchiveEntryPort' as const;
const PurgeSchedulePortToken = 'IPurgeSchedulePort' as const;

@Module({})
export class LifecycleModule {
  static forRoot(
    prismaClient: unknown,
  ): DynamicModule {
    return {
      module: LifecycleModule,
      providers: [
        { provide: ArchiveEntryPortToken, useClass: PrismaLifecycleRepository },
        {
          provide: PurgeSchedulePortToken,
          useFactory: (repo: PrismaLifecycleRepository) => repo,
          inject: [ArchiveEntryPortToken],
        },
        {
          provide: LifecycleService,
          useFactory: (
            archivePort: IArchiveEntryPort,
            purgePort: IPurgeSchedulePort,
          ) => new LifecycleService(archivePort, purgePort),
          inject: [ArchiveEntryPortToken, PurgeSchedulePortToken],
        },
      ],
      exports: [LifecycleService],
    };
  }
}
