/**
 * ArchiveEntryRecord — archive/lifecycle entity within ResourceAggregate.
 *
 * @traceability DOC-012 Aggregate3, DOC-012 §11 (LifecycleAggregate)
 */

import { ResourceId } from '../value-objects/resource-id.vo';
import { ResourceVersion } from '../value-objects/resource-version.vo';
import { ArchiveEntryState } from '../value-objects/archive-entry-state.vo';
import { ResourceMetadata } from '../value-objects/resource-metadata.vo';

export interface ArchiveEntryRecordProps {
  id: ResourceId;
  orgId: string;
  createdBy: string;
  archivedBy: string | null;
  resourceTypeOriginal: string;
  resourceIdOriginal: string;
  linkedMemberId: string | null;
  metadata: ResourceMetadata;
  tags: string[];
  category: string | null;
  attachmentUrls: string[];
  state: ArchiveEntryState;
  archivedAt: Date;
  trashedAt: Date | null;
  purgeDate: Date | null;
  purgeReason: string | null;
  version: ResourceVersion;
  createdAt: Date;
  updatedAt: Date;
}

export class ArchiveEntryRecord {
  private constructor(private readonly props: ArchiveEntryRecordProps) {}

  static create(props: Omit<ArchiveEntryRecordProps, 'version' | 'createdAt' | 'updatedAt'>): ArchiveEntryRecord {
    const now = new Date();
    return new ArchiveEntryRecord({
      ...props,
      version: new ResourceVersion(1),
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): ResourceId { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get createdBy(): string { return this.props.createdBy; }
  get archivedBy(): string | null { return this.props.archivedBy; }
  get resourceTypeOriginal(): string { return this.props.resourceTypeOriginal; }
  get resourceIdOriginal(): string { return this.props.resourceIdOriginal; }
  get linkedMemberId(): string | null { return this.props.linkedMemberId; }
  get metadata(): ResourceMetadata { return this.props.metadata; }
  get tags(): string[] { return this.props.tags; }
  get category(): string | null { return this.props.category; }
  get attachmentUrls(): string[] { return this.props.attachmentUrls; }
  get state(): ArchiveEntryState { return this.props.state; }
  get archivedAt(): Date { return this.props.archivedAt; }
  get trashedAt(): Date | null { return this.props.trashedAt; }
  get purgeDate(): Date | null { return this.props.purgeDate; }
  get purgeReason(): string | null { return this.props.purgeReason; }
  get version(): ResourceVersion { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  bumpVersion(): void {
    this.props.version = this.props.version.next();
    this.props.updatedAt = new Date();
  }

  changeState(newState: ArchiveEntryState): void {
    this.validateTransition(this.props.state, newState);
    this.props.state = newState;
    if (newState === ArchiveEntryState.TRASHED) this.props.trashedAt = new Date();
    if (newState === ArchiveEntryState.PURGED) this.props.purgeDate = new Date();
    this.bumpVersion();
  }

  applyTags(tags: string[]): void {
    this.props.tags = [...new Set([...this.props.tags, ...tags])];
    this.bumpVersion();
  }

  removeTags(tagsToRemove: string[]): void {
    this.props.tags = this.props.tags.filter((t) => !tagsToRemove.includes(t));
    this.bumpVersion();
  }

  markPurge(reason: string): void {
    this.props.purgeReason = reason;
    this.bumpVersion();
  }

  private validateTransition(from: ArchiveEntryState, to: ArchiveEntryState): void {
    const allowed: Record<ArchiveEntryState, ArchiveEntryState[]> = {
      [ArchiveEntryState.DRAFT]: [ArchiveEntryState.ACTIVE],
      [ArchiveEntryState.ACTIVE]: [ArchiveEntryState.ARCHIVED],
      [ArchiveEntryState.ARCHIVED]: [ArchiveEntryState.TRASHED, ArchiveEntryState.ACTIVE],
      [ArchiveEntryState.TRASHED]: [ArchiveEntryState.ACTIVE, ArchiveEntryState.PURGED],
      [ArchiveEntryState.PURGED]: [],
    };
    const targets = allowed[from];
    if (!targets || !targets.includes(to)) {
      throw new Error(`ArchiveEntryRecord: invalid transition ${from} -> ${to}`);
    }
  }
}
