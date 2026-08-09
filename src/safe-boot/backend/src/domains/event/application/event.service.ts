/**
 * EventService — Application Service for the Event Aggregate.
 * Coordinates domain logic through IEventRepository port, produces domain events,
 * enforces state-machine guards and business rules.
 *
 * Commands:
 *   CreateEvent, UpdateEvent, PublishEvent, CancelEvent, CompleteEvent
 *
 * Domain Events produced:
 *   EventCreated, EventUpdated, EventStateChanged, EventDeleted, EventPublished
 *
 * @traceability DOC-012 Aggregate3 (EventRecord lifecycle), ASS-001 (Application Services)
 */

import { Injectable } from '@nestjs/common';
import type { IEventRepository, EventQueryFilters } from '../ports/event-port.interface';
import { EventFactory, type CreateEventInput } from '../domain/services/event-factory.service';
import { EventValidator, EventValidationError } from '../domain/services/event-validator.service';
import { EventState } from '../domain/value-objects/event-state.vo';
import { ResourceId } from '../../finance/value-objects/resource-id.vo';
import { VersioningPolicy } from '../../finance/domain-policies/versioning-policy';
import { DomainEvent } from '../../../shared/events';
import type { DomainEventPublisher } from './event-publisher.interface';
import type { PaginatedResult } from '../../../shared/types';
import type { EventRecord } from '../domain/entities/event-record.entity';

// ------------------------------------------------------------------- Domain Events

class EventCreatedEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly orgId: string,
    occurredAt = new Date(),
  ) {
    super('EventCreated', occurredAt);
  }
}

class EventUpdatedEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly version: number,
    occurredAt = new Date(),
  ) {
    super('EventUpdated', occurredAt);
  }
}

class EventStateChangedEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly fromState: string,
    public readonly toState: string,
    occurredAt = new Date(),
  ) {
    super('EventStateChanged', occurredAt);
  }
}

class EventDeletedEvent extends DomainEvent {
  constructor(
    public readonly eventId: string,
    occurredAt = new Date(),
  ) {
    super('EventDeleted', occurredAt);
  }
}

// ----------------------------------------------------------------- Injectable

@Injectable()
export class EventService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  // ====================================================================
  // CREATE
  // ====================================================================

  /**
   * Create a new event. The factory validates all business rules
   * (created_by, dates not in future, end > start).
   */
  async create(input: CreateEventInput): Promise<EventRecord> {
    const entity = EventFactory.create(input);
    await this.eventPublisher.publish(
      new EventCreatedEvent(entity.id.toString(), entity.orgId),
    );
    return this.eventRepo.create(entity);
  }

  // ====================================================================
  // READ
  // ====================================================================

  async findById(id: string): Promise<EventRecord | null> {
    return this.eventRepo.findById(new ResourceId(id));
  }

  async findByOrg(
    orgId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<EventRecord>> {
    return this.eventRepo.findByOrg(orgId, page, limit);
  }

  async findByOrgAndState(
    orgId: string,
    state: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<EventRecord>> {
    return this.eventRepo.findByOrgAndState(orgId, state, page, limit);
  }

  async search(
    filters: EventQueryFilters,
  ): Promise<PaginatedResult<EventRecord>> {
    if (filters.state) {
      return this.findByOrgAndState(
        filters.orgId,
        filters.state,
        filters.page,
        filters.limit,
      );
    }
    return this.findByOrg(filters.orgId, filters.page, filters.limit);
  }

  // ====================================================================
  // UPDATE
  // ====================================================================

  async update(
    id: string,
    fields: Partial<{
      title: string;
      eventType: string;
      startAt: Date;
      endAt: Date;
      location: string | null;
      responsibleUserId: string | null;
      description: string | null;
      metadata: Record<string, unknown>;
    }>,
    expectedVersion: number,
  ): Promise<void> {
    const resourceId = new ResourceId(id);
    const existing = await this.eventRepo.findById(resourceId);
    if (!existing) {
      throw new EventNotFoundError(`Event ${id} not found`);
    }

    VersioningPolicy.validate(expectedVersion, existing.version.value);

    // Validate dates if changing
    if (fields.startAt !== undefined || fields.endAt !== undefined) {
      const newStart = fields.startAt ?? existing.startAt;
      const newEnd = fields.endAt ?? existing.endAt;
      EventValidator.validateDates(newStart, newEnd);
    }

    if (fields.title !== undefined) {
      EventValidator.assertTitlePresent(fields.title);
    }

    existing.updateFields({
      title: fields.title,
      eventType: fields.eventType,
      startAt: fields.startAt,
      endAt: fields.endAt,
      location: fields.location,
      responsibleUserId: fields.responsibleUserId,
      description: fields.description,
    });

    await this.eventRepo.update(resourceId, existing, expectedVersion);
    await this.eventPublisher.publish(
      new EventUpdatedEvent(existing.id.toString(), existing.version.value),
    );
  }

  // ====================================================================
  // STATE TRANSITIONS
  // ====================================================================

  /** Publish a draft event → published. */
  async publish(id: string): Promise<void> {
    await this._transition(
      id,
      EventState.DRAFT,
      EventState.PUBLISHED,
      'EventPublished',
    );
  }

  /**
   * Cancel an event from draft or published state.
   */
  async cancel(id: string): Promise<void> {
    const entityId = new ResourceId(id);
    const existing = await this.eventRepo.findById(entityId);
    if (!existing) {
      throw new EventNotFoundError(`Event ${id} not found`);
    }

    switch (existing.state) {
      case EventState.DRAFT:
        await this._transition(
          id,
          EventState.DRAFT,
          EventState.CANCELLED,
          'EventCancelled',
        );
        break;
      case EventState.PUBLISHED:
        await this._transition(
          id,
          EventState.PUBLISHED,
          EventState.CANCELLED,
          'EventCancelled',
        );
        break;
      default:
        throw new EventValidationError(
          'INVALID_TRANSITION',
          `Cannot cancel event in state ${existing.state}`,
        );
    }
  }

  /** Mark a published event as completed (terminal state). */
  async complete(id: string): Promise<void> {
    await this._transition(
      id,
      EventState.PUBLISHED,
      EventState.COMPLETED,
      'EventCompleted',
    );
  }

  // ====================================================================
  // DELETE
  // ====================================================================

  async delete(id: string): Promise<boolean> {
    const resourceId = new ResourceId(id);
    const entity = await this.eventRepo.findById(resourceId);
    if (!entity) {
      throw new EventNotFoundError(`Event ${id} not found`);
    }
    const deleted = await this.eventRepo.delete(resourceId);
    if (deleted) {
      await this.eventPublisher.publish(
        new EventDeletedEvent(entity.id.toString()),
      );
    }
    return deleted;
  }

  // ====================================================================
  // PRIVATE HELPERS
  // ====================================================================

  private async _transition(
    id: string,
    fromState: EventState,
    toState: EventState,
    eventName: string,
  ): Promise<void> {
    const entityId = new ResourceId(id);
    const updated = await this.eventRepo.transitionState(
      entityId,
      fromState,
      toState,
    );
    const eventMap: Record<string, DomainEvent> = {
      EventPublished: new EventStateChangedEvent(
        updated.id.toString(),
        fromState,
        toState,
      ),
      EventCancelled: new EventStateChangedEvent(
        updated.id.toString(),
        fromState,
        toState,
      ),
      EventCompleted: new EventStateChangedEvent(
        updated.id.toString(),
        fromState,
        toState,
      ),
    };
    await this.eventPublisher.publish(eventMap[eventName]);
  }
}

/** Typed error for missing event records. */
export class EventNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventNotFoundError';
  }
}
