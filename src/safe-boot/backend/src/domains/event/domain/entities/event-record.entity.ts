/**
 * EventRecord — entity for the Event domain aggregate.
 *
 * Lifecycle methods: bumpVersion, changeState (state-machine guarded), updateFields, markSynced.
 *
 * @traceability DOC-012 Aggregate3 Entity EventRecord, PG-Schema-v1 Table 9
 */

import { ResourceId } from '../../../finance/value-objects/resource-id.vo';
import { ResourceVersion } from '../../../finance/value-objects/resource-version.vo';
import { EventState, canTransitionFrom } from '../value-objects/event-state.vo';
import { ResourceMetadata, type MetadataValue } from '../../../finance/value-objects/resource-metadata.vo';

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

  /** Increment version and touch updated timestamp. */
  bumpVersion(): void {
    this.props.version = this.props.version.next();
    this.props.updatedAt = new Date();
  }

  /** Guarded state transition per EVENT_STATE_TRANSITIONS. */
  changeState(newState: EventState): void {
    this._validateTransition(this.props.state, newState);
    this.props.state = newState;
    this.bumpVersion();
  }

  /** Partial field update with version bump. */
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
    if (fields.title !== undefined) this.props.title = fields.title;
    if (fields.eventType !== undefined) this.props.eventType = fields.eventType;
    if (fields.startAt !== undefined) this.props.startAt = fields.startAt;
    if (fields.endAt !== undefined) this.props.endAt = fields.endAt;
    if (fields.location !== undefined) this.props.location = fields.location ?? null;
    if (fields.responsibleUserId !== undefined) this.props.responsibleUserId = fields.responsibleUserId ?? null;
    if (fields.description !== undefined) this.props.description = fields.description ?? null;
    if (fields.metadata !== undefined) this.props.metadata = fields.metadata;
    this.bumpVersion();
  }

  /** Mark the record as successfully synchronized. */
  markSynced(): void {
    this.props.synced = true;
    this.bumpVersion();
  }

  // ------------------------------------------------------------------ private

  private _validateTransition(from: EventState, to: EventState): void {
    const allowed = canTransitionFrom(from);
    if (!allowed.includes(to)) {
      throw new Error(`EventRecord: invalid transition ${from} -> ${to}`);
    }
  }
}
