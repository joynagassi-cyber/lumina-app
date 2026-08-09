/**
 * Lumina Backend — Root AppModule
 *
 * Phase C (B1, ADR-018) : migration TypeORM → Prisma. Le conteneur NestJS joue
 * le rôle de CompositionRoot RTS-001 : graphe de modules = DependencyResolver.
 * Modules câblés pour le MVP Jour 1 : Finance, Reporting, Vocab (périmètre
 * grand livre — MVP-JOUR1-SPEC). Les autres domaines (identity/organization…)
 * seront réactivés dans une phase ultérieure.
 *
 * @traceability ADR-018 (NestJS DI ↔ CompositionRoot RTS-001), MVP-JOUR1-SPEC §3 (B1)
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RuntimeModule } from './core/runtime/runtime.module';
import { FinanceModule } from './domains/finance';
import { ReportingModule } from './domains/reporting/reporting.module';
import { VocabModule } from './domains/vocab/vocab.module';
import { TransactionPrismaAdapter } from './infrastructure/adapters/prisma/finance/transaction-prisma-adapter';
import { EventEmitter2DomainEventPublisher } from './core/runtime/event-emitter-publisher';
import {
  MemberPortNotWired,
  EventPortNotWired,
  ArchiveEntryPortNotWired,
  NotificationPortNotWired,
} from './infrastructure/adapters/prisma/finance/not-wired-ports';

/** Publisher d'événements CRT-004 (EventEmitter2, publication après persistance). */
const eventPublisher = new EventEmitter2DomainEventPublisher(new EventEmitter2());

@Module({
  imports: [
    // Foundation modules
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ global: true }),
    RuntimeModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRY || '15m' },
    }),
    PrismaModule,

    // Domain modules — périmètre MVP Jour 1 (grand livre)
    FinanceModule.forRoot(
      new TransactionPrismaAdapter(),
      new MemberPortNotWired(),
      new EventPortNotWired(),
      new ArchiveEntryPortNotWired(),
      new NotificationPortNotWired(),
      eventPublisher,
    ),
    ReportingModule.forRoot(undefined),
    VocabModule.forRoot(undefined, {
      handle: async () => {},
    } as never),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
