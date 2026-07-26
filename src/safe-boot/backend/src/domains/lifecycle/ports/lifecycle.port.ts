/**
 * Lifecycle Ports — interface contracts for the LifecycleAggregate.
 *
 * Consumers depend on these interfaces; infrastructure adapters implement them.
 *
 * @traceability DOC-012 Aggregate11 (LifecycleAggregate), PG-Schema-v1 Table 28/29
 *   → POSTGRESQL-SCHEMA-PACK-v1 archives + purge_schedules
 *   → PAS-005 PA-NB-007 (RepositoryAbstraction)
 */

export type ArchiveEntryState = 'active' | 'archived' | 'trashed' | 'purged';
export type PurgeEligibleState = 'trashed' | 'archived';

export type ResourceOriginalType = 'transaction' | 'member' | 'event' | 'archive_entry';

export interface ArchiveEntryPortRecord {
  id: string;
  org_id: string;
  archive_by?: string | null;
  resource_type_original: ResourceOriginalType;
  resource_id_original: string;
  member_lie_id?: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  category?: string | null;
  attachment_urls: string[];
  etat_lifecycle: ArchiveEntryState;
  archived_at: Date;
  trashed_at?: Date | null;
  purge_date?: Date | null;
  purge_reason?: string | null;
  version: number;
}

export interface IPurgeSchedulePortRecord {
  id: string;
  org_id: string;
  entry_id: string;
  etats_eligibles: PurgeEligibleState;
  programme_par_systeme: boolean;
  date_planifiee: Date;
  executee: boolean;
  execution_date?: Date | null;
  executed_by?: string | null;
}

/**
 * Repository port for archive entries.
 * All operations scoped to org_id per NB-MT-002.
 */
export interface IArchiveEntryPort {
  create(
    record: Omit<ArchiveEntryPortRecord, 'id' | 'version' | 'archived_at'>,
  ): Promise<string>;
  findById(id: string, requestOrgId: string): Promise<ArchiveEntryPortRecord | null>;
  findByResourceId(
    resourceType: ResourceOriginalType,
    resourceId: string,
    requestOrgId: string,
  ): Promise<ArchiveEntryPortRecord | null>;
  findTrashedOnly(requestOrgId: string): Promise<ArchiveEntryPortRecord[]>;
  findAllActive(requestOrgId: string): Promise<ArchiveEntryPortRecord[]>;
  findByTags(tags: string[], requestOrgId: string): Promise<ArchiveEntryPortRecord[]>;
  updateState(id: string, state: ArchiveEntryState): Promise<void>;
  markTrashed(
    id: string,
    reason?: string,
  ): Promise<void>;
  updateMetadata(
    id: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  applyTags(id: string, tags: string[]): Promise<void>;
  removeTags(id: string, tagsToRemove: string[]): Promise<void>;
}

/**
 * Repository port for purge schedules.
 */
export interface IPurgeSchedulePort {
  create(
    record: Omit<IPurgeSchedulePortRecord, 'id' | 'executee'>,
  ): Promise<string>;
  findById(id: string, requestOrgId: string): Promise<IPurgeSchedulePortRecord | null>;
  findPendingByDate(
    maxDate: Date,
    requestOrgId: string,
  ): Promise<IPurgeSchedulePortRecord[]>;
  markExecuted(id: string, executedBy: string): Promise<void>;
  deleteByEntryId(entryId: string, requestOrgId: string): Promise<void>;
}
