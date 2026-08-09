/**
 * RuntimeModule — CompositionRoot des composants runtime custom (ADR-018).
 *
 * Assemble les providers CRT non couverts nativement par Nest :
 * - CRT-012 RetryPolicyService
 * - CRT-013 IdempotencyManager
 * - CRT-014 RuntimeAuditService + AuditInterceptor (global, @Audit)
 * - CRT-015 TenantContextProvider (AsyncLocalStorage)
 * - CRT-007 HealthController (@nestjs/terminus, GET /health)
 * - CRT-004 EventEmitter2DomainEventPublisher (@nestjs/event-emitter)
 *
 * Global : ces providers transverses sont injectables dans tous les modules.
 * Aucune logique métier (RN-001/RN-002) — pure orchestration.
 *
 * @traceability ADR-018 §3.1, §3.4
 */

import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RetryPolicyService } from './retry-policy.service';
import { IdempotencyManager } from './idempotency-manager';
import { TenantContextProvider } from './tenant-context.provider';
import { RuntimeAuditService } from './audit.service';
import { AuditInterceptor } from './audit-interceptor';
import { HealthController } from './health.controller';
import { EventEmitter2DomainEventPublisher } from './event-emitter-publisher';

@Global()
@Module({
  imports: [TerminusModule, PrismaModule],
  controllers: [HealthController],
  providers: [
    RetryPolicyService,
    IdempotencyManager,
    TenantContextProvider,
    RuntimeAuditService,
    EventEmitter2DomainEventPublisher,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [
    RetryPolicyService,
    IdempotencyManager,
    TenantContextProvider,
    RuntimeAuditService,
    EventEmitter2DomainEventPublisher,
  ],
})
export class RuntimeModule {}
