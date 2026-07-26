/**
 * Event Domain — ResourceAggregate Event subtype implementation.
 * Complete DDD implementation: ports, entities, VOs, services, policies, application layer, infrastructure, module.
 *
 * @traceability DOC-012 Aggregate3 (EventRecord entity), PG-Schema-v1 Table 9 (events)
 *              API-CONTRACT-003 (Resource/Events endpoints)
 */

// Value Objects
export {
  EventType,
  EventState,
  EVENT_STATE_TRANSITIONS,
  eventCanTransitionFrom as canTransitionFromEventState,
  EventScope,
  EventScopeType,
  EventDates,
  type InvalidEventDateError,
} from './domain/value-objects';

// Domain Entities
export { EventRecord, type EventRecordProps } from './domain/entities';

// Domain Services
export {
  EventValidator,
  type EventValidationError,
  EventFactory,
  type CreateEventInput,
} from './domain/services';

// Domain Policies
export {
  EventScopePolicy,
  type EventScopePolicyError,
  EventDatePolicy,
  type EventDatePolicyError,
} from './domain/policies';

// Application Layer
export { EventService, type EventNotFoundError } from './application';

// Ports
export type { IEventRepository, EventQueryFilters } from './ports';

// Infrastructure
export { PrismaEventRepository } from './infrastructure/adapters';

// NestJS Module
export { EventModule } from './event.module';
