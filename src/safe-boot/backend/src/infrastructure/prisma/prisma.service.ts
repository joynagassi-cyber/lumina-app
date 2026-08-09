/**
 * PrismaService — client Prisma global (ADR-018 : migration TypeORM → Prisma).
 *
 * @traceability ADR-018 (NestJS DI ↔ CompositionRoot RTS-001, TransactionCoordinator = $transaction)
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
