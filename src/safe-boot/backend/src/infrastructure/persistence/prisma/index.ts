/**
 * Prisma persistence adapter — Port implementation for database access.
 * Wraps the generated PrismaClient (ADR-018) so legacy infrastructure
 * adapters can inject a concrete persistence delegate.
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaPersistenceAdapter extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
