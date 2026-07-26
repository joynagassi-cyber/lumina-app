/**
 * WorkflowModule — NestJS module for WorkflowAggregate
 *
 * Composition root: binds Port interfaces to concrete Infrastructure adapters.
 * All dependencies injected via @Inject() on port interface tokens (PAS-003 DR-004).
 *
 * @traceability DOC-012 Aggregate5 → WorkflowService (8 commands + 2 queries)
 *   → POSTGRESQL-SCHEMA-PACK-v1 tables: workflow_instances, workflow_steps, workflow_logs
 *   → PAS-003 DR-004 (Runtime Assembly Responsibility)
 *   → PAS-005 PA-NB-002 (AdapterLooseCoupling)
 */

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { WorkflowService } from '../application/workflow.service';
import {
  PrismaWorkflowInstanceRepository,
  PrismaWorkflowStepRepository,
  PrismaWorkflowLogRepository,
} from './repositories/prisma-workflow.repository';

import type {
  IWorkflowInstanceRepository,
  IWorkflowStepRepository,
  IWorkflowLogRepository,
} from '../ports/repository.port';
import type { IEventPublicationPort } from '../ports/event-pub.port';
import type { IAuthorizationPort } from '../ports/auth.port';
import type { IClockPort } from '../ports/clock.port';
import type { IUuidPort } from '../ports/uuid.port';
import type { IAuditPort } from '../ports/audit.port';
import type { ILoggerPort } from '../ports/logging.port';

// ---- Injection tokens (interface-based per PA-NB-002) ----

const INSTANCE_REPO_TOKEN = 'IWorkflowInstanceRepository';
const STEP_REPO_TOKEN = 'IWorkflowStepRepository';
const LOG_REPO_TOKEN = 'IWorkflowLogRepository';
const EVENT_PUB_TOKEN = 'IEventPublicationPort';
const AUTH_TOKEN = 'IAuthorizationPort';
const CLOCK_TOKEN = 'IClockPort';
const UUID_TOKEN = 'IUuidPort';
const AUDIT_TOKEN = 'IAuditPort';
const LOG_TOKEN = 'ILoggerPort';

@Module({})
export class WorkflowModule {
  /**
   * Configure the WorkflowModule with provided infrastructure dependencies.
   * This static method is the composition root binding point.
   */
  static forRoot(prismaClient: unknown): DynamicModule {
    const providers: Provider[] = [
      // Repository adapters
      {
        provide: INSTANCE_REPO_TOKEN,
        useClass: PrismaWorkflowInstanceRepository,
      },
      {
        provide: STEP_REPO_TOKEN,
        useClass: PrismaWorkflowStepRepository,
      },
      {
        provide: LOG_REPO_TOKEN,
        useClass: PrismaWorkflowLogRepository,
      },

      // Event bus adapter
      {
        provide: EVENT_PUB_TOKEN,
        useFactory: () => null as unknown as IEventPublicationPort,
        inject: [],
      },

      // Authorization adapter
      {
        provide: AUTH_TOKEN,
        useFactory: () => null as unknown as IAuthorizationPort,
        inject: [],
      },

      // Clock
      {
        provide: CLOCK_TOKEN,
        useFactory: () => null as unknown as IClockPort,
        inject: [],
      },

      // UUID
      {
        provide: UUID_TOKEN,
        useFactory: () => null as unknown as IUuidPort,
        inject: [],
      },

      // Audit adapter (inject Prisma client if needed)
      {
        provide: AUDIT_TOKEN,
        useFactory: () => null as unknown as IAuditPort,
        inject: [],
      },

      // Logging adapter
      {
        provide: LOG_TOKEN,
        useFactory: () => null as unknown as ILoggerPort,
        inject: [],
      },

      // Application service
      {
        provide: WorkflowService,
        useFactory: (
          instanceRepo: IWorkflowInstanceRepository,
          stepRepo: IWorkflowStepRepository,
          logRepo: IWorkflowLogRepository,
          eventPub: IEventPublicationPort,
          authorizer: IAuthorizationPort,
          clock: IClockPort,
          uuid: IUuidPort,
          audit: IAuditPort,
          logger: ILoggerPort,
        ) => new WorkflowService(
          instanceRepo,
          stepRepo,
          logRepo,
          eventPub,
          authorizer,
          clock,
          uuid,
          audit,
          logger,
        ),
        inject: [
          INSTANCE_REPO_TOKEN,
          STEP_REPO_TOKEN,
          LOG_REPO_TOKEN,
          EVENT_PUB_TOKEN,
          AUTH_TOKEN,
          CLOCK_TOKEN,
          UUID_TOKEN,
          AUDIT_TOKEN,
          LOG_TOKEN,
        ],
      },
    ];

    return {
      module: WorkflowModule,
      providers,
      exports: [WorkflowService],
    };
  }
}
