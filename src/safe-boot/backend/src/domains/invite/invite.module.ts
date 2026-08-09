/**
 * InviteModule — NestJS module wiring for the Invite Aggregate
 *
 * Declares all providers, wires port interfaces to infrastructure adapters.
 * Exports domain-layer types for cross-module use.
 *
 * @traceability ORG-008 InviteModule → INV-Module v1
 */

import { Module, DynamicModule, FactoryProvider, Provider, Inject } from '@nestjs/common';
import { PrismaInvitationRepository } from './infrastructure/adapters/prisma-invite.repository';
import { TokenService } from './infrastructure/adapters/token.service';
import NotificationAdapter from './infrastructure/adapters/notification.adapter';
import { InviteService } from './application/invite-service';
import { IInviteRepository, ITokenService } from './ports';
import type { InviteId } from './domain/value-objects/invite-id.vo';
import type { InviteToken } from './domain/value-objects/invite-token.vo';
import type { InviteStatus } from './domain/value-objects/invite-status.enum';
import type { InviteType } from './domain/value-objects/invite-type.enum';
import type { InviteScope } from './domain/value-objects/invite-scope.vo';
import type { Invite } from './domain/entities/invite.entity';
import type { PrismaClient } from '@prisma/client';

// Export domain types for external use
export { Invite };
export type { InviteId, InviteToken, InviteStatus, InviteType, InviteScope, PrismaInvitationRepository, TokenService, NotificationAdapter };

const PRISMA_CLIENT = 'PRISMA_CLIENT';
const IINVITE_REPOSITORY = 'IInviteRepository';
const ITOKEN_SERVICE = 'ITokenService';
const IIPERMISSION_RESOLVER = 'IPermissionResolver';
const IDOMAIN_EVENT_EMITTER = 'IDomainEventEmitter';

@Module({})
export class InviteModule {
  static forRoot(
    prisma: PrismaClient,
    permissionResolver: { hasPermission: (userId: string, orgId: string, permission: string) => Promise<boolean> },
    eventEmitter: { emit: (event: any) => Promise<void> } | null = null
  ): DynamicModule {
    const providers: Provider[] = [
      // Infrastructure adapters
      {
        provide: PRISMA_CLIENT,
        useValue: prisma,
      },
      {
        provide: PrismaInvitationRepository,
        useFactory: (p: PrismaClient) => new PrismaInvitationRepository(p),
        inject: [PRISMA_CLIENT],
      },
      {
        provide: TokenService,
        useFactory: () => new TokenService(),
      },
      {
        provide: NotificationAdapter,
        useFactory: () => new NotificationAdapter(),
      },
      // Port interface bindings
      {
        provide: IINVITE_REPOSITORY,
        useClass: PrismaInvitationRepository,
      },
      {
        provide: ITOKEN_SERVICE,
        useClass: TokenService,
      },
      // DI tokens for external dependencies
      {
        provide: IIPERMISSION_RESOLVER,
        useValue: permissionResolver,
      },
      {
        provide: IDOMAIN_EVENT_EMITTER,
        useValue: eventEmitter,
      },
      // Application service
      {
        provide: InviteService,
        useFactory: (
          repo: IInviteRepository,
          tokenSvc: ITokenService,
          permResolver: any,
          evtEmitter: any
        ) => new InviteService(repo, tokenSvc, permResolver, evtEmitter),
        inject: [IINVITE_REPOSITORY, ITOKEN_SERVICE, IIPERMISSION_RESOLVER, IDOMAIN_EVENT_EMITTER],
      },
    ];

    return {
      module: InviteModule,
      providers,
      exports: [
        InviteService,
        IINVITE_REPOSITORY,
        ITOKEN_SERVICE,
        PrismaInvitationRepository,
        TokenService,
        NotificationAdapter,
        IIPERMISSION_RESOLVER,
        IDOMAIN_EVENT_EMITTER,
        PRISMA_CLIENT,
        'Invite',
        'InviteId',
        'InviteToken',
        'InviteStatus',
        'InviteType',
        'InviteScope',
      ],
    };
  }
}