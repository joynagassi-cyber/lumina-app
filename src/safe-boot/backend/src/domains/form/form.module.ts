/**
 * FormModule — NestJS module for FormAggregate
 *
 * Composition root: binds Port interfaces to concrete Infrastructure adapters.
 * All dependencies injected via @Inject() on port interface tokens (PAS-003 DR-004).
 *
 * @traceability DOC-012 Aggregate6 → FormService (UC-FRM-01 through UC-FRM-07)
 *   → PAS-003 DR-004 (Runtime Assembly Responsibility)
 *   → PAS-005 PA-NB-002 (AdapterLooseCoupling)
 */

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { FormService } from './application/form.service';
import { PrismaFormRepository } from './infrastructure/adapters/prisma-form.repository';
import { WebHookEventPublicationAdapter } from '../organization/infrastructure/events/event-bus.adapter';
import { RbacAuthorizationAdapter } from '../organization/infrastructure/auth/rbac.adapter';
import { SystemClockAdapter } from '../organization/infrastructure/clock/monotonic.adapter';
import { UuidV7Adapter } from '../organization/infrastructure/uuid/uuidv7.adapter';
import { AuditLogAdapter } from '../organization/infrastructure/audit/audit-log.adapter';

import type { IFormRepository } from './ports/form.port';
import type { IEventPublicationPort } from './ports/event-pub.port';
import type { IAuthorizationPort } from '../organization/ports/auth.port';
import type { IClockPort } from '../organization/ports/clock.port';
import type { IUuidPort } from '../organization/ports/uuid.port';
import type { IAuditPort } from '../organization/ports/audit.port';

// ---- Injection tokens (interface-based per PA-NB-002) ----

const FORM_REPOSITORY_TOKEN = 'IFormRepository';
const EVENT_PUB_TOKEN = 'IEventPublicationPort';
const AUTH_TOKEN = 'IAuthorizationPort';
const CLOCK_TOKEN = 'IClockPort';
const UUID_TOKEN = 'IUuidPort';
const AUDIT_TOKEN = 'IAuditPort';

@Module({})
export class FormModule {
  /**
   * Configure the FormModule with provided infrastructure dependencies.
   * This static method is the composition root binding point.
   */
  static forRoot(
    prismaClient: unknown,
    eventBusUrl?: string,
  ): DynamicModule {
    const providers: Provider[] = [
      // Repository adapter
      {
        provide: FORM_REPOSITORY_TOKEN,
        useClass: PrismaFormRepository,
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

      // Audit
      {
        provide: AUDIT_TOKEN,
        useFactory: (prisma: unknown) => new AuditLogAdapter(prisma),
        inject: [],
      },

      // Application service — receives all port injections
      {
        provide: FormService,
        useFactory: (
          formRepo: IFormRepository,
          eventPub: IEventPublicationPort,
          authorizer: IAuthorizationPort,
          clock: IClockPort,
          uuid: IUuidPort,
          audit: IAuditPort,
        ) => new FormService(
          formRepo,
          eventPub,
          authorizer,
          clock,
          uuid,
          audit,
        ),
        inject: [
          FORM_REPOSITORY_TOKEN,
          EVENT_PUB_TOKEN,
          AUTH_TOKEN,
          CLOCK_TOKEN,
          UUID_TOKEN,
          AUDIT_TOKEN,
        ],
      },
    ];

    return {
      module: FormModule,
      providers,
      exports: [FormService],
    };
  }
}
