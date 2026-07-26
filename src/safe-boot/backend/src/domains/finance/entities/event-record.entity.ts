/**
 * EventRecord — event entity within ResourceAggregate.
 *
 * @traceability DOC-012 Aggregate3 Entity EventRecord, PG-Schema-v1 Table 9
 */

import { ResourceId } from '../value-objects/resource-id.vo';
import { ResourceVersion } from '../value-objects/resource-version.vo';
import { EventState } from '../value-objects/event-state.vo';
import { ResourceMetadata } from '../value-objects/resource-metadata.vo';

export interface EventRecordProps {
  id: ResourceId;
  orgId: string;
  createdBy: string;
  title: string;
  eventType: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  responsibleUserId: string | null;
  description: string | null;
  state: EventState;
  version: ResourceVersion;
  synced: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: ResourceMetadata;
}

export class EventRecord {
  private constructor(private readonly props: EventRecordProps) {}

  static create(props: Omit<EventRecordProps, 'version' | 'synced' | 'createdAt' | 'updatedAt'>): EventRecord {
    const now = new Date();
    return new EventRecord({
      ...props,
      version: new ResourceVersion(1),
      synced: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): ResourceId { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get createdBy(): string { return this.props.createdBy; }
  get title(): string { return this.props.title; }
  get eventType(): string { return this.props.eventType; }
  get startAt(): Date { return this.props.startAt; }
  get endAt(): Date { return this.props.endAt; }
  get location(): string | null { return this.props.location; }
  get responsibleUserId(): string | null { return this.props.responsibleUserId; }
  get description(): string | null { return this.props.description; }
  get state(): EventState { return this.props.state; }
  get version(): ResourceVersion { return this.props.version; }
  get synced(): boolean { return this.props.synced; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get metadata(): ResourceMetadata { return this.props.metadata; }

  bumpVersion(): void {
    this.props.version = this.props.version.next();
    this.props.updatedAt = new Date();
  }

  changeState(newState: EventState): void {
    this.validateTransition(this.props.state, newState);
    this.props.state = newState;
    this.bumpVersion();
  }

  updateFields(fields: {
    title?: string;
    eventType?: string;
    startAt?: Date;
    endAt?: Date;
    location?: string | null;
    responsibleUserId?: string | null;
    description?: string | null;
    metadata?: ResourceMetadata;
  }): void {
    if (fields.title) this.props.title = fields.title;
    if (fields.eventType) this.props.eventType = fields.eventType;
    if (fields.startAt) this.props.startAt = fields.startAt;
    if (fields.endAt) this.props.endAt = fields.endAt;
    if (fields.location !== undefined) this.props.location = fields.location ?? null;
    if (fields.responsibleUserId !== undefined) this.props.responsibleUserId = fields.responsibleUserId ?? null;
    if (fields.description !== undefined) this.props.description = fields.description ?? null;
    if (fields.metadata) this.props.metadata = fields.metadata;
    this.bumpVersion();
  }

  markSynced(): void {
    this.props.synced = true;
    this.bumpVersion();
  }

  private validateTransition(from: EventState, to: EventState): void {
    const allowed: Record<EventState, EventState[]> = {
      [EventState.DRAFT]: [EventState.PUBLISHED, EventState.CANCELLED],
      [EventState.PUBLISHED]: [EventState.COMPLETED, EventState.CANCELLED],
      [EventState.CANCELLED]: [],
      [EventState.COMPLETED]: [],
    };
    const targets = allowed[from];
    if (!targets || !targets.includes(to)) {
      throw new Error(`EventRecord: invalid transition ${from} -> ${to}`);
    }
  }
}
