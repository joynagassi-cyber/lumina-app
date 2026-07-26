/**
 * Messaging infrastructure — event bus / message queue skeleton.
 */

import { Injectable } from "@nestjs/common";

@Injectable()
export class MessageBusAdapter {
  publish(_topic: string, _payload: unknown): Promise<void> {
    return Promise.resolve();
  }

  subscribe(_topic: string, _handler: (payload: unknown) => void): void {
    // TODO: Implement domain event subscription
  }
}
