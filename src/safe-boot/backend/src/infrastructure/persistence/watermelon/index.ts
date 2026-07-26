/**
 * WatermelonDB persistence adapter — offline-first sync port.
 */

import { Injectable } from "@nestjs/common";

@Injectable()
export class WatermelonPersistenceAdapter {
  /**
   * Map Prisma models to Watermelon-compatible change events.
   * RTS-v1 specification for offline-first sync protocol.
   */
  mapChange(_change: unknown): unknown {
    return _change;
  }
}
