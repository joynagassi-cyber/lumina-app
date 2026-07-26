/**
 * ArchiveEntry domain entity — Aggregate Root of LifecycleAggregate.
 *
 * Manages the lifecycle state machine, tags, categories, attachments,
 * and purge scheduling for archived resources.
 *
 * @traceability DOC-012 Aggregate11 Entity ArchiveEntry
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 28 (archives)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LifecycleState,
  validateTransition,
  InvalidLifecycleTransitionError,
  TagCollection,
  CategoryRef,
  AttachmentUrlList,
} from '../value-objects/index';

export interface ArchiveEntryProps {
  id: string;
  orgId: string;
  archivedBy: string | null;
  resourceTypeOriginal: string;
  resourceIdOriginal: string;
  linkedMemberId: string | null;
  metadata: Record<string, unknown>;
  tags: TagCollection;
  category: CategoryRef;
  attachmentUrls: AttachmentUrlList;
  state: LifecycleState;
  archivedAt: Date;
  trashedAt: Date | null;
  purgeDate: Date | null;
  purgeReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ArchiveEntry {
  private readonly _emittedEvents: unknown[] = [];

  private constructor(private readonly props: ArchiveEntryProps) {}

  static create(params: Omit<ArchiveEntryProps, 'id' | 'version' | 'createdAt' | 'updatedAt'>): ArchiveEntry {
    const now = new Date();
    return new ArchiveEntry({
      ...params,
      id: params.id ?? uuidv4(),
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): string { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get archivedBy(): string | null { return this.props.archivedBy; }
  get resourceTypeOriginal(): string { return this.props.resourceTypeOriginal; }
  get resourceIdOriginal(): string { return this.props.resourceIdOriginal; }
  get linkedMemberId(): string | null { return this.props.linkedMemberId; }
  get metadata(): Record<string, unknown> { return this.props.metadata; }
  get tags(): TagCollection { return this.props.tags; }
  get category(): CategoryRef { return this.props.category; }
  get attachmentUrls(): AttachmentUrlList { return this.props.attachmentUrls; }
  get state(): LifecycleState { return this.props.state; }
  get archivedAt(): Date { return this.props.archivedAt; }
  get trashedAt(): Date | null { return this.props.trashedAt; }
  get purgeDate(): Date | null { return this.props.purgeDate; }
  get purgeReason(): string | null { return this.props.purgeReason; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * Transition to a new lifecycle state.
   * BR-LIF-006: Trashed entries not visible in normal queries.
   * purged is irreversible.
   */
  transitionTo(newState: LifecycleState): void {
    validateTransition(this.props.state, newState);

    this.props.state = newState;
    this.props.version++;
    this.props.updatedAt = new Date();

    if (newState === LifecycleState.TRASHED) {
      this.props.trashedAt = new Date();
      this.emitEvent(new ResourceTrashed(this.props.id, this.props.orgId, this.props.resourceIdOriginal));
    } else if (newState === LifecycleState.PURGED) {
      this.emitEvent(new ResourcePurged(this.props.id, this.props.orgId, this.props.resourceIdOriginal, this.props.purgeReason));
    } else if (newState === LifecycleState.ACTIVE && this.props.state === LifecycleState.TRASHED) {
      this.emitEvent(new ResourceRestoredFromTrash(this.props.id, this.props.orgId, this.props.resourceIdOriginal));
    } else if (newState === LifecycleState.ARCHIVED) {
      this.emitEvent(new ResourceArchived(this.props.id, this.props.orgId, this.props.resourceTypeOriginal, this.props.resourceIdOriginal));
    }
  }

  applyTags(tags: string[]): void {
    this.props.tags = this.props.tags.addMany(tags);
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  removeTags(tagsToRemove: string[]): void {
    this.props.tags = this.props.tags.removeMany(tagsToRemove);
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  setMetadata(metadata: Record<string, unknown>): void {
    this.props.metadata = metadata;
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  setAttachmentUrls(urls: string[]): void {
    this.props.attachmentUrls = new AttachmentUrlList(urls);
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  setCategory(category: CategoryRef): void {
    this.props.category = category;
    this.props.version++;
    this.props.updatedAt = new Date();
  }

  /** Returns emitted events then clears them for dispatch by the application layer. */
  getAndClearEvents(): unknown[] {
    const events = [...this._emittedEvents];
    this._emittedEvents.length = 0;
    return events;
  }

  private emitEvent(event: unknown): void {
    this._emittedEvents.push(event);
  }

  toPersistenceMap(): Record<string, unknown> {
    return {
      id: this.props.id,
      org_id: this.props.orgId,
      archive_by: this.props.archivedBy,
      resource_type_original: this.props.resourceTypeOriginal,
      resource_id_original: this.props.resourceIdOriginal,
      member_lie_id: this.props.linkedMemberId,
      metadonnees_archive: this.props.metadata,
      tags: this.props.tags.tags,
      categorie: this.props.category.value,
      url_pieces_jointes: this.props.attachmentUrls.urls,
      etat_lifecycle: this.props.state,
      date_archivage: this.props.archivedAt.toISOString(),
      date_corbeille: this.props.trashedAt?.toISOString() ?? null,
      date_purge: this.props.purgeDate?.toISOString() ?? null,
      motif_purge: this.props.purgeReason,
      version: this.props.version,
      updated_at: this.props.updatedAt.toISOString(),
    };
  }
}

// ---- Domain Events ----

export class ResourceArchived {
  constructor(
    public readonly archiveEntryId: string,
    public readonly orgId: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
  ) {}
}

export class ResourceTrashed {
  constructor(
    public readonly archiveEntryId: string,
    public readonly orgId: string,
    public readonly resourceId: string,
  ) {}
}

export class ResourcePurged {
  constructor(
    public readonly archiveEntryId: string,
    public readonly orgId: string,
    public readonly resourceId: string,
    public readonly reason: string | null,
  ) {}
}

export class ResourceRestoredFromTrash {
  constructor(
    public readonly archiveEntryId: string,
    public readonly orgId: string,
    public readonly resourceId: string,
  ) {}
}

export class PurgeScheduled {
  constructor(
    public readonly entryId: string,
    public readonly orgId: string,
    public readonly scheduledDate: Date,
    public readonly eligibleStates: string[],
  ) {}
}
