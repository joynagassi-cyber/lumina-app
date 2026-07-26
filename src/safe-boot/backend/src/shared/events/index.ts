/**
 * Shared domain events — all domain-level CQRS events.
 */

export abstract class DomainEvent {
  constructor(
    public readonly eventType: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
