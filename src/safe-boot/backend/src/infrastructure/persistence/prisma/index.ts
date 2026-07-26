/**
 * Prisma persistence adapter — Port implementation for database access.
 */

import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class PrismaPersistenceAdapter implements OnModuleInit {
  async onModuleInit() {
    // Prisma client initialization happens in AppModule
  }
}
