/**
 * DelegationModule — NestJS module for the Delegation aggregate.
 *
 * Wires together port interfaces, infrastructure adapters, domain services,
 * and the application service for delegation operations.
 *
 * @traceability DOC-012 DelegationAggregate → NestJS Module wiring
 */

import { Module, DynamicModule, Inject } from '@nestjs/common';
import { DelegationService } from './application/delegation-service';
import { PrismaGrantRepository } from './infrastructure/adapters/prisma-grant.repository';
import { AuthorizationAdapter } from './infrastructure/adapters/authorization.adapter';
import { AuditLoggerAdapter } from './infrastructure/adapters/audit-log.adapter';
import { EventBusAdapter } from './infrastructure/adapters/event-bus.adapter';
import type { IGrantRepository } from '../ports/delegation.ports';
import type { IAuthorizationPort } from '../ports/delegation.ports';
import type { IAuditLogger } from '../ports/delegation.ports';
import type { IEventPublisherPort } from '../ports/delegation.ports';
import type { PrismaClient } from '@prisma/client';

// ---- Injection tokens ----
const PRISMA_CLIENT = 'PRISMA_CLIENT';
const IGRANT_REPOSITORY = 'IGrantRepository';
const IAUTHORIZATION_PORT = 'IAuthorizationPort';
const IAUDIT_LOGGER = 'IAuditLogger';
const IEVENT_PUBLISHER = 'IEventPublisher';

@Module({})
export class DelegationModule {
  /**
   * Configure the DelegationModule with infrastructure dependencies.
   * This static method is the composition root binding point.
   */
  static forRoot(prisma: PrismaClient): DynamicModule {
    return {
      module: DelegationModule,
      providers: [
        // --- Prisma Client provider ---
        {
          provide: PRISMA_CLIENT,
          useValue: prisma,
        },

        // --- Infrastructure Adapters (created with Prisma injection) ---
        {
          provide: PrismaGrantRepository,
          useFactory: (p: PrismaClient) => new PrismaGrantRepository(p),
          inject: [PRISMA_CLIENT],
        },
        {
          provide: AuthorizationAdapter,
          useFactory: (p: PrismaClient) => new AuthorizationAdapter(p),
          inject: [PRISMA_CLIENT],
        },
        {
          provide: AuditLoggerAdapter,
          useFactory: (p: PrismaClient) => new AuditLoggerAdapter(p),
          inject: [PRISMA_CLIENT],
        },
        {
          provide: EventBusAdapter,
          useFactory: () => new EventBusAdapter(),
        },

        // --- Port Interface Bindings (useExisting to reference the factory-created instances) ---
        {
          provide: IGRANT_REPOSITORY,
          useExisting: PrismaGrantRepository,
        },
        {
          provide: IAUTHORIZATION_PORT,
          useExisting: AuthorizationAdapter,
        },
        {
          provide: IAUDIT_LOGGER,
          useExisting: AuditLoggerAdapter,
        },
        {
          provide: IEVENT_PUBLISHER,
          useFactory: () => new EventBusAdapter(),
        },

        // --- Application Service ---
        {
          provide: DelegationService,
          useFactory: (
            grantRepo: IGrantRepository,
            authPort: IAuthorizationPort,
            auditLogger: IAuditLogger,
            eventPublisher: IEventPublisherPort,
          ) => new DelegationService(grantRepo, authPort, auditLogger, eventPublisher),
          inject: [
            IGRANT_REPOSITORY,
            IAUTHORIZATION_PORT,
            IAUDIT_LOGGER,
            IEVENT_PUBLISHER,
          ],
        },
      ],
      exports: [DelegationService, IGRANT_REPOSITORY, IAUTHORIZATION_PORT],
    };
  }
}

// Export domain types for external use
export { GrantEntry } from './domain/entities/grant-entry';
export { GrantId } from './domain/value-objects/grant-id.vo';
export { GrantScope } from './domain/value-objects/grant-scope.vo';
export { GrantPermission } from './domain/value-objects/grant-permission.vo';
export { GrantStatus } from './domain/value-objects/grant-status.enum';
export { GrantCreated, GrantApproved, GrantExpired, GrantRevoked } from './domain/events/grant-events';
export { CircularDelegationError, DurationExceededError, SuperadminDelegationError, NonTransitiveError, CapabilityValidationError } from './domain/policies/delegation-errors';

// Re-export port types
export type { IGrantRepository, IAuthorizationPort, IAuditLogger, IEventPublisherPort, GrantEntryProps } from '../ports/delegation.ports';