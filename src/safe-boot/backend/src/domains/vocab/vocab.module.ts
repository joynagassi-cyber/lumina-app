/**
 * VocabModule — NestJS module for VocabularyAggregate
 *
 * Composition root: binds Port interfaces to concrete Infrastructure adapters
 * and injects domain services + application service.
 * All dependencies injected via @Inject() on port interface tokens (PAS-003 DR-004).
 *
 * @traceability DOC-012 Aggregate8 → Capability: Vocabulary (DOC-006)
 *   → PAS-003 DR-004 (Runtime Assembly Responsibility)
 *   → PAS-005 PA-NB-002 (AdapterLooseCoupling)
 */

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { VocabApplicationService } from './application/vocab.service';
import { CategoriesController } from './vocab.controller';
import { PrismaNamespaceRepository, PrismaTermRepository, PrismaTermValueRepository } from './infrastructure/adapters/prisma-vocab.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TermResolver, NamespaceBrowser, DeprecationManager } from './domain/services';
import type { INamespaceRepository, ITermRepository, ITermValueRepository } from './ports/vocab.port';
import type { DomainEventHandler } from '../../shared/events';

// ---- Injection tokens (interface-based per PA-NB-002) ----

const NAMESPACE_REPOSITORY_TOKEN = 'INamespaceRepository';
const TERM_REPOSITORY_TOKEN = 'ITermRepository';
const TERM_VALUE_REPOSITORY_TOKEN = 'ITermValueRepository';
const EVENT_HANDLER_TOKEN = 'IDomainEventHandler';

@Module({})
export class VocabModule {
  /**
   * Configure the VocabModule with provided infrastructure dependencies.
   * This static method is the composition root binding point.
   */
  static forRoot(
    prismaClient: unknown,
    domainEventHandler: DomainEventHandler,
  ): DynamicModule {
    const providers: Provider[] = [
      // Prisma client (consommé par les repositories via @Inject('PRISMA_CLIENT'))
      {
        provide: 'PRISMA_CLIENT',
        useExisting: PrismaService,
      },

      // Repository adapters — implement port interfaces
      {
        provide: NAMESPACE_REPOSITORY_TOKEN,
        useClass: PrismaNamespaceRepository,
      },
      {
        provide: TERM_REPOSITORY_TOKEN,
        useClass: PrismaTermRepository,
      },
      {
        provide: TERM_VALUE_REPOSITORY_TOKEN,
        useClass: PrismaTermValueRepository,
      },

      // Domain services
      {
        provide: NamespaceBrowser,
        useFactory: (
          namespaceRepo: INamespaceRepository,
          termRepo: ITermRepository,
          valueRepo: ITermValueRepository,
        ) => new NamespaceBrowser(),
        inject: [NAMESPACE_REPOSITORY_TOKEN, TERM_REPOSITORY_TOKEN, TERM_VALUE_REPOSITORY_TOKEN],
      },
      {
        provide: DeprecationManager,
        useFactory: () => new DeprecationManager(),
        inject: [],
      },
      {
        provide: TermResolver,
        useFactory: (browser: NamespaceBrowser) => new TermResolver(browser),
        inject: [NamespaceBrowser],
      },

      // Event handler
      {
        provide: EVENT_HANDLER_TOKEN,
        useValue: domainEventHandler,
      },

      // Application service — receives all port injections
      {
        provide: VocabApplicationService,
        useFactory: (
          nsRepo: INamespaceRepository,
          termRepo: ITermRepository,
          valRepo: ITermValueRepository,
          resolver: TermResolver,
          browser: NamespaceBrowser,
          deprecationMgr: DeprecationManager,
          handler: DomainEventHandler,
        ) => new VocabApplicationService(
          nsRepo,
          termRepo,
          valRepo,
          resolver,
          browser,
          deprecationMgr,
          handler,
        ),
        inject: [
          NAMESPACE_REPOSITORY_TOKEN,
          TERM_REPOSITORY_TOKEN,
          TERM_VALUE_REPOSITORY_TOKEN,
          TermResolver,
          NamespaceBrowser,
          DeprecationManager,
          EVENT_HANDLER_TOKEN,
        ],
      },
    ];

    return {
      module: VocabModule,
      controllers: [CategoriesController],
      providers,
      exports: [VocabApplicationService],
    };
  }
}
