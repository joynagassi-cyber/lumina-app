/**
 * Lifecycle Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 8 (LifecycleAggregate)
 * @traceability DOC-006: Lifecycle concept (archiving, purging)
 * @traceability DOC-021: Physical Data Model archive tables
 * @traceability ASS-001: Application Services for lifecycle operations
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Archive state.
 */
export type ArchiveState = 'pending' | 'archived' | 'purged' | 'restored';

/**
 * Purge schedule status.
 */
export type PurgeScheduleStatus = 'active' | 'paused' | 'completed';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * ArchiveEntry — a record of an archived resource.
 * Maps to physical table `archive_entries` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface ArchiveEntry {
  /** Universally unique identifier for this archive entry. */
  readonly id: string;

  /** Resource type being archived (e.g., 'transaction', 'member', 'event'). */
  readonly resourceType: string;

  /** Resource ID within that type. */
  readonly resourceId: string;

  /** Organization this entry belongs to. */
  readonly organizationId: string;

  /** Original data (JSON snapshot). */
  readonly data: Record<string, unknown>;

  /** Archive state. */
  readonly state: ArchiveState;

  /** Archive reason (optional). */
  readonly reason: string | null;

  /** Archiving user ID. */
  readonly archivedBy: string;

  /** Timestamp when archiving was initiated. */
  readonly archivedAt: string;

  /** Timestamp when purged (if applicable). */
  readonly purgedAt: string | null;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * PurgeSchedule — schedule for automatic archive purging.
 */
export interface PurgeSchedule {
  /** Universally unique identifier for this schedule. */
  readonly id: string;

  /** Organization this schedule belongs to. */
  readonly organizationId: string;

  /** Schedule name (e.g., 'monthly-archive-purge'). */
  readonly name: string;

  /** Schedule description. */
  readonly description: string | null;

  /** Cron expression for schedule. */
  readonly cronExpression: string;

  /** Retention days before purge. */
  readonly retentionDays: number;

  /** Current schedule status. */
  readonly status: PurgeScheduleStatus;

  /** Next scheduled run (UTC ISO 8601). */
  readonly nextRun: string;

  /** Last executed run (UTC ISO 8601). */
  readonly lastRun: string | null;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for CreateArchiveEntry command.
 */
export interface CreateArchiveEntryInput {
  /** Organization ID (injected from context). */
  readonly organizationId: string;

  /** Resource type (required). */
  readonly resourceType: string;

  /** Resource ID (required). */
  readonly resourceId: string;

  /** Original data snapshot (required). */
  readonly data: Record<string, unknown>;

  /** Archive reason (optional). */
  readonly reason?: string | null;

  /** Archiving user ID (optional, defaults to current user). */
  readonly archivedBy?: string;
}

/**
 Input for Archive command (triggers archive entry creation).
 */
export interface ArchiveCommandInput {
  /** Organization ID. */
  readonly organizationId: string;

  /** Resource type. */
  readonly resourceType: string;

  /** Resource ID to archive. */
  readonly resourceId: string;

  /** Reason for archiving. */
  readonly reason: string;
}

/**
 Input for ListArchives query.
 */
export interface ListArchivesInput {
  /** Organization ID. */
  readonly organizationId: string;

  /** Filter by resource type (optional). */
  readonly resourceType?: string;

  /** Filter by state (optional). */
  readonly state?: ArchiveState;

  /** Pagination: page number (default: 1). */
  readonly page?: number;

  /** Pagination: items per page (default: 20, max: 100). */
  readonly limit?: number;
}

/**
 Input for UpdatePurgeSchedule command.
 */
export interface UpdatePurgeScheduleInput {
  /** Schedule ID to update. */
  readonly scheduleId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Schedule name (optional update). */
  readonly name?: string;

  /** Description (optional update). */
  readonly description?: string | null;

  /** Cron expression (optional update). */
  readonly cronExpression?: string;

  /** Retention days (optional update). */
  readonly retentionDays?: number;

  /** Schedule status (optional update). */
  readonly status?: PurgeScheduleStatus;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Generic pagination response.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly hasNextPage: boolean;
}

/**
 Archive entry with resource preview.
 */
export interface ArchiveEntryWithPreview {
  /** The archive entry. */
  readonly entry: ArchiveEntry;

  /** Preview of the archived resource (first 500 chars of data). */
  readonly preview: string;
}

/**
 Aggregated structure returned by useArchives().
 */
export interface ArchivesDomainModel {
  /** Archive entries. */
  readonly entries: ReadonlyArray<ArchiveEntryWithPreview>;

  /** Total count matching filters. */
  readonly totalCount: number;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 Aggregated structure returned by useArchiveEntry().
 */
export interface ArchiveEntryDomainModel {
  /** The archive entry. */
  readonly entry: ArchiveEntry | null;

  /** Full data (unlimited). */
  readonly data: Record<string, unknown> | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 Aggregated structure returned by usePurgeSchedule().
 */
export interface PurgeScheduleDomainModel {
  /** The purge schedule. */
  readonly schedule: PurgeSchedule | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/*  WatermelonDB Attributes                                            */
/* ------------------------------------------------------------------ */

/**
 * Attributes for the ArchiveEntry WatermelonDB model.
 */
export interface ArchiveEntryAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  resourceType: string;
  resourceId: string;
  data: string; // JSON serialized
  state: ArchiveState;
  reason: string | null;
  archivedBy: string;
  archivedAt: string;
  purgedAt: string | null;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Attributes for the PurgeSchedule WatermelonDB model.
 */
export interface PurgeScheduleAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  name: string;
  description: string | null;
  cronExpression: string;
  retentionDays: number;
  status: PurgeScheduleStatus;
  nextRun: string;
  lastRun: string | null;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}