/**
 * OrganizationModule — NestJS module for OrganizationAggregate
 *
 * Composition root: binds Port interfaces to concrete Infrastructure adapters.
 * All dependencies injected via @Inject() on port interface tokens (PAS-003 DR-004).
 *
 * @traceability DOC-012 Aggregate1 → OrganizationService (10 ops)
 *   → PAS-003 DR-004 (Runtime Assembly Responsibility)
 *   → PAS-005 PA-NB-002 (AdapterLooseCoupling)
 */

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { OrganizationService } from './application/organization.service';
import { PrismaOrganizationRepository } from './infrastructure/repositories/prisma-org.repository';
import { PrismaOrgUnitRepository } from './infrastructure/repositories/prisma-org-unit.repository';
import { WebHookEventPublicationAdapter } from './infrastructure/events/event-bus.adapter';
import { RbacAuthorizationAdapter } from './infrastructure/auth/rbac.adapter';
import { SystemClockAdapter } from './infrastructure/clock/monotonic.adapter';
import { UuidV7Adapter } from './infrastructure/uuid/uuidv7.adapter';
import { ConfigSnapshotAdapter } from './infrastructure/config/config-snapshot.adapter';
import { LoggerAdapter } from './infrastructure/logging/logger.adapter';
import { AuditLogAdapter } from './infrastructure/audit/audit-log.adapter';
import { LruCacheAdapter } from './infrastructure/cache/lru.adapter';

import type { IOrganizationRepository, IOrgUnitRepository } from './ports/repository.port';
import type { IEventPublicationPort } from './ports/event-pub.port';
import type { IAuthorizationPort } from './ports/auth.port';
import type { IClockPort } from './ports/clock.port';
import type { IUuidPort } from './ports/uuid.port';
import type { IConfigurationPort } from './ports/config.port';
import type { IAuditPort } from './ports/audit.port';
import type { ICachePort } from './ports/cache.port';
import type { ILoggerPort } from './ports/logging.port';

// ---- Injection tokens (interface-based per PA-NB-002) ----

const ORG_REPOSITORY_TOKEN = 'IOrganizationRepository';
const UNIT_REPOSITORY_TOKEN = 'IOrgUnitRepository';
const EVENT_PUB_TOKEN = 'IEventPublicationPort';
const AUTH_TOKEN = 'IAuthorizationPort';
const CLOCK_TOKEN = 'IClockPort';
const UUID_TOKEN = 'IUuidPort';
const CONFIG_TOKEN = 'IConfigurationPort';
const LOG_TOKEN = 'ILoggerPort';
const AUDIT_TOKEN = 'IAuditPort';
const CACHE_TOKEN = 'ICachePort';

@Module({})
export class OrganizationModule {
  /**
   * Configure the OrganizationModule with provided infrastructure dependencies.
   * This static method is the composition root binding point.
   */
  static forRoot(
    prismaClient: unknown,
    eventBusUrl?: string,
  ): DynamicModule {
    const providers: Provider[] = [
      // Repository adapters
      {
        provide: ORG_REPOSITORY_TOKEN,
        useClass: PrismaOrganizationRepository,
      },
      {
        provide: UNIT_REPOSITORY_TOKEN,
        useClass: PrismaOrgUnitRepository,
      },

      // Event bus adapter
      {
        provide: EVENT_PUB_TOKEN,
        useFactory: (url?: string) =>
          new WebHookEventPublicationAdapter(url || ''),
        inject: [],
      },

      // Authorization adapter
      {
        provide: AUTH_TOKEN,
        useClass: RbacAuthorizationAdapter,
      },

      // Clock
      {
        provide: CLOCK_TOKEN,
        useClass: SystemClockAdapter,
      },

      // UUID
      {
        provide: UUID_TOKEN,
        useClass: UuidV7Adapter,
      },

      // Config
      {
        provide: CONFIG_TOKEN,
        useClass: ConfigSnapshotAdapter,
      },

      // Logging
      {
        provide: LOG_TOKEN,
        useFactory: () => new LoggerAdapter('Organization'),
      },

      // Audit
      {
        provide: AUDIT_TOKEN,
        useFactory: (prisma: unknown) => new AuditLogAdapter(prisma),
        inject: [],
      },

      // Cache
      {
        provide: CACHE_TOKEN,
        useClass: LruCacheAdapter,
      },

      // Application service — receives all port injections
      {
        provide: OrganizationService,
        useFactory: (
          orgRepo: IOrganizationRepository,
          unitRepo: IOrgUnitRepository,
          eventPub: IEventPublicationPort,
          authorizer: IAuthorizationPort,
          clock: IClockPort,
          uuid: IUuidPort,
          audit: IAuditPort,
        ) => new OrganizationService(
          orgRepo,
          unitRepo,
          eventPub,
          authorizer,
          clock,
          uuid,
          audit,
        ),
        inject: [
          ORG_REPOSITORY_TOKEN,
          UNIT_REPOSITORY_TOKEN,
          EVENT_PUB_TOKEN,
          AUTH_TOKEN,
          CLOCK_TOKEN,
          UUID_TOKEN,
          AUDIT_TOKEN,
        ],
      },
    ];

    return {
      module: OrganizationModule,
      providers,
      exports: [OrganizationService],
    };
  }
}
