/**
 * MemberModule — NestJS module wiring for the RelationshipAggregate.
 * Provides dependency injection for GroupMembership and OrgUnitLink repositories,
 * injecting them into the MemberService application handler.
 * @traceability DOC-012 §Aggregate 4, DOC-023 §NB-RR-001 (ports/adapters separation)
 */

import { Module, DynamicModule } from '@nestjs/common';
import { MemberService } from './application/member.service';
import { PrismaGroupMembershipRepository } from './infrastructure/adapters/prisma-group-membership.repository';
import { PrismaOrgUnitLinkRepository } from './infrastructure/adapters/prisma-org-unit-link.repository';
import type { PrismaClientLike } from './infrastructure/adapters/prisma-group-membership.repository';

/**
 * Dynamic module factory that receives a Prisma client instance.
 * Allows different Prisma clients per org context if needed.
 */
@Module({})
export class MemberModule {
  static forRoot(prisma: PrismaClientLike): DynamicModule {
    const groupMembershipProvider = {
      provide: 'IGroupMembershipRepository',
      useValue: new PrismaGroupMembershipRepository(prisma),
    };

    const orgUnitLinkProvider = {
      provide: 'IOrgUnitLinkRepository',
      useValue: new PrismaOrgUnitLinkRepository(prisma),
    };

    return {
      module: MemberModule,
      providers: [
        groupMembershipProvider,
        orgUnitLinkProvider,
        MemberService,
      ],
      exports: [MemberService],
    };
  }
}
