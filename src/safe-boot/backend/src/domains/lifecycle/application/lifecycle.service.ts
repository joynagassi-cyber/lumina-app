/**
 * Lifecycle Application Service — orchestrates archive lifecycle operations.
 *
 * @traceability DOC-012 Aggregate11 §LifecycleAggregate Application Service
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 28 (archives) + Table 29 (purge_schedules)
 */

import {
  ArchiveEntry,
  ResourceArchived,
  ResourceTrashed,
  ResourcePurged,
  ResourceRestoredFromTrash,
  PurgeScheduled,
} from '../domain/entities/index';
import { LifecycleState } from '../domain/value-objects/lifecycle-state.vo';
import { RetentionPeriod } from '../domain/value-objects/retention-period.vo';
import { TagCollection } from '../domain/value-objects/tag-collection.vo';
import { CategoryRef } from '../domain/value-objects/category-ref.vo';
import { AttachmentUrlList } from '../domain/value-objects/attachment-url-list.vo';
import { StateTransitionValidator } from '../domain/services/state-transition-validator.service';
import { PurgeScheduler } from '../domain/services/purge-scheduler.service';
import {
  IArchiveEntryPort,
  IPurgeSchedulePort,
  ArchiveEntryPortRecord,
  ArchiveEntryState,
  PurgeEligibleState,
  ResourceOriginalType,
} from '../ports/lifecycle.port';
import { SoftDeletePolicy } from '../domain/policies/soft-delete-policy';

export interface ArchiveResourceInput {
  orgId: string;
  archivedBy: string | null;
  resourceTypeOriginal: string;
  resourceIdOriginal: string;
  linkedMemberId: string | null;
  metadata?: Record<string, unknown>;
  tags?: string[];
  category?: string;
  attachmentUrls?: string[];
}

export interface ArchiveEntryWithEvents {
  readonly entry: ArchiveEntry;
  readonly events: unknown[];
}

export class LifecycleService {
  constructor(
    private readonly archivePort: IArchiveEntryPort,
    private readonly purgeSchedulePort: IPurgeSchedulePort,
  ) {}

  /**
   * Archive a resource. Creates a new ArchiveEntry and persists it.
   * BR-LIF-001: States configurable per org via manifest.lifecycle.types[]
   * BR-LIF-002: Archive linked to original resource
   */
  async archiveResource(input: ArchiveResourceInput): Promise<ArchiveEntryWithEvents> {
    const entry = ArchiveEntry.create({
      ...input,
      state: LifecycleState.ACTIVE,
      archivedAt: new Date(),
      trashedAt: null,
      purgeDate: null,
      purgeReason: null,
      metadata: input.metadata ?? {},
      tags: new TagCollection(input.tags),
      category: CategoryRef.create(input.category ?? ''),
      attachmentUrls: new AttachmentUrlList(input.attachmentUrls),
    });

    // Persist via port
    await this.archivePort.create({
      org_id: entry.orgId,
      archive_by: entry.archivedBy,
      resource_type_original: entry.resourceTypeOriginal as ResourceOriginalType,
      resource_id_original: entry.resourceIdOriginal,
      member_lie_id: entry.linkedMemberId,
      metadata: entry.metadata,
      tags: entry.tags.tags,
      category: entry.category.value || null,
      attachment_urls: [...entry.attachmentUrls.urls],
      etat_lifecycle: this.toPortState(LifecycleState.ACTIVE),
    });

    return { entry, events: entry.getAndClearEvents() };
  }

  /**
   * Trash an existing archive entry.
   * BR-LIF-006: Trashed entries not visible in normal queries.
   */
  async trashResource(entryId: string, requestOrgId: string): Promise<ArchiveEntryWithEvents> {
    const existing = await this.archivePort.findById(entryId, requestOrgId);
    if (!existing) throw new EntryNotFoundError(entryId);

    if (existing.etat_lifecycle === 'trashed') {
      throw new AlreadyTrashedError(entryId);
    }

    await this.archivePort.updateState(entryId, 'trashed');
    const updated = await this.archivePort.findById(entryId, requestOrgId);
    if (!updated) throw new EntryNotFoundError(entryId);

    return this.reconstructEntry(updated, [new ResourceTrashed(entryId, requestOrgId, updated.resource_id_original)]);
  }

  /**
   * Restore a trashed or archived entry back to active.
   * Transitions: trashed → active | archived → active
   */
  async restoreResource(entryId: string, requestOrgId: string): Promise<ArchiveEntryWithEvents> {
    const existing = await this.archivePort.findById(entryId, requestOrgId);
    if (!existing) throw new EntryNotFoundError(entryId);

    if (!StateTransitionValidator.isRestorable(existing.etat_lifecycle as LifecycleState)) {
      throw new CannotRestoreError(entryId, existing.etat_lifecycle);
    }

    await this.archivePort.updateState(entryId, 'active');
    const updated = await this.archivePort.findById(entryId, requestOrgId);
    if (!updated) throw new EntryNotFoundError(entryId);

    return this.reconstructEntry(updated, [
      new ResourceRestoredFromTrash(entryId, requestOrgId, updated.resource_id_original),
    ]);
  }

  /**
   * Schedule a purge for an eligible entry.
   * BR-LIF-005: Purge date configurable per archivable type
   */
  async schedulePurge(
    entryId: string,
    orgId: string,
    retentionMonths: number,
  ): Promise<PurgeScheduled> {
    const retention = RetentionPeriod.create(retentionMonths);
    const eligibleDate = PurgeScheduler.computeEligibilityDate(new Date(), retention);

    const entry = await this.archivePort.findById(entryId, orgId);
    if (!entry) throw new EntryNotFoundError(entryId);

    const scheduleId = await this.purgeSchedulePort.create({
      org_id: orgId,
      entry_id: entryId,
      etats_eligibles: entry.etat_lifecycle as PurgeEligibleState,
      programme_par_systeme: true,
      date_planifiee: eligibleDate,
    });

    return new PurgeScheduled(entryId, orgId, eligibleDate, [entry.etat_lifecycle]);
  }

  /**
   * Execute purge on an eligible entry.
   * BR-LIF-006: purged is irreversible.
   */
  async executePurge(
    scheduleId: string,
    orgId: string,
    executedBy: string,
    reason: string,
  ): Promise<void> {
    const schedule = await this.purgeSchedulePort.findById(scheduleId, orgId);
    if (!schedule) throw new PurgeScheduleNotFoundError(scheduleId);

    const entry = await this.archivePort.findById(schedule.entry_id, orgId);
    if (!entry) throw new EntryNotFoundError(schedule.entry_id);

    await this.archivePort.markTrashed(schedule.entry_id, reason);
    await this.purgeSchedulePort.markExecuted(scheduleId, executedBy);
  }

  /**
   * List all purge-eligible candidates for the given org.
   */
  async findPurgeEligible(orgId: string, asOfDate?: Date): Promise<{ entryId: string; eligibilityDate: Date }[]> {
    const schedules = await this.purgeSchedulePort.findPendingByDate(asOfDate ?? new Date(), orgId);
    return schedules.map((s) => ({ entryId: s.entry_id, eligibilityDate: s.date_planifiee }));
  }

  // ---- Helpers ----

  private toPortState(domainState: LifecycleState): ArchiveEntryState {
    return domainState;
  }

  private reconstructEntry(
    record: ArchiveEntryPortRecord,
    events: unknown[],
  ): ArchiveEntryWithEvents {
    const entry = ArchiveEntry.create({
      id: record.id,
      orgId: record.org_id,
      archivedBy: record.archive_by ?? null,
      resourceTypeOriginal: record.resource_type_original,
      resourceIdOriginal: record.resource_id_original,
      linkedMemberId: record.member_lie_id ?? null,
      metadata: record.metadata,
      tags: new TagCollection(record.tags),
      category: CategoryRef.create(record.category ?? ''),
      attachmentUrls: new AttachmentUrlList(record.attachment_urls),
      state: record.etat_lifecycle as LifecycleState,
      archivedAt: record.archived_at,
      trashedAt: record.trashed_at ?? null,
      purgeDate: record.purge_date ?? null,
      purgeReason: record.purge_reason ?? null,
    });
    // Replay events onto the entry
    for (const event of events) {
      (entry as unknown as { _emittedEvents: unknown[] })._emittedEvents.push(event);
    }
    return { entry, events };
  }
}

// ---- Application Errors ----

export class EntryNotFoundError extends Error {
  constructor(id: string) {
    super(`Archive entry not found: ${id}`);
    this.name = 'EntryNotFoundError';
  }
}

export class AlreadyTrashedError extends Error {
  constructor(id: string) {
    super(`Archive entry already trashed: ${id}`);
    this.name = 'AlreadyTrashedError';
  }
}

export class CannotRestoreError extends Error {
  constructor(id: string, currentState: string) {
    super(`Cannot restore entry "${id}" from state "${currentState}".`);
    this.name = 'CannotRestoreError';
  }
}

export class PurgeScheduleNotFoundError extends Error {
  constructor(id: string) {
    super(`Purge schedule not found: ${id}`);
    this.name = 'PurgeScheduleNotFoundError';
  }
}
