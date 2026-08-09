/**
 * EventFactory — domain service for creating new EventRecord instances.
 * Ensures all defaults and invariant preconditions are applied at creation time.
 *
 * Domain events produced on create: EventCreated, EventPublished (if directly published).
 *
 * @traceability DOC-012 Aggregate3 (ResourceFactory), BR-RES-007 (created_by mandatory)
 */

import { EventRecord } from '../entities/event-record.entity';
import type { EventRecordProps } from '../entities/event-record.entity';
import { ResourceId } from '../../../finance/value-objects/resource-id.vo';
import { ResourceMetadata } from '../../../finance/value-objects/resource-metadata.vo';
import { EventState } from '../value-objects/event-state.vo';
import { EventValidator } from './event-validator.service';

export interface CreateEventInput {
  orgId: string;
  createdBy: string;
  title: string;
  eventType: string;
  startAt: Date;
  endAt: Date;
  location?: string | null;
  responsibleUserId?: string | null;
  description?: string | null;
  metadata?: ResourceMetadata;
}

export class EventFactory {
  /**
   * Create a new EventRecord in the 'draft' state with all business-rule validation.
   * @throws EventValidationError on any rule violation
   */
  static create(input: CreateEventInput): EventRecord {
    EventValidator.validateCreate({
      createdBy: input.createdBy,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
    });

    const props: Omit<EventRecordProps, 'version' | 'synced' | 'createdAt' | 'updatedAt'> = {
      id: ResourceId.generate(),
      orgId: input.orgId,
      createdBy: input.createdBy,
      title: input.title.trim(),
      eventType: input.eventType,
      startAt: input.startAt,
      endAt: input.endAt,
      location: input.location ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
      description: input.description ?? null,
      state: EventState.DRAFT,
      metadata: input.metadata ?? new ResourceMetadata({}),
    };

    return EventRecord.create(props);
  }
}
