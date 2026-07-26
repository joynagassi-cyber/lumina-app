/**
 * Lumina Backend — Root AppModule
 *
 * Lazy-loading modules per aggregate domain.
 * Implements Ports & Adapters architecture (PAS-v1).
 * Dependency Inversion: Domain → Port Interface ← Infrastructure Adapter
 *
 * @traceability DOC-000 → PAS-003 (Dependency Rules) → Implementation
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // Global config — loaded from env per ITS-V1 NB-TECH-005
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // API rate limiting — RTS-v1 boundary protection
    ThrottlerModule.forRoot([{
      ttl: 60_000,   // 1 minute
      limit: 100,     // 100 requests per minute
    }]),

    // Scheduled jobs — sync reconciliation, purge, notifications
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
