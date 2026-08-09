/**
 * PrismaAdapter for LifecycleAggregate — implements IArchiveEntryPort and IPurgeSchedulePort.
 *
 * @traceability DOC-012 Aggregate11
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 28 (archives) + Table 29 (purge_schedules)
 */

import type {
  IArchiveEntryPort,
  IPurgeSchedulePort,
  ArchiveEntryPortRecord,
  IPurgeSchedulePortRecord,
  ArchiveEntryState,
  PurgeEligibleState,
  ResourceOriginalType,
} from '../../ports/lifecycle.port';

export class PrismaLifecycleRepository implements IArchiveEntryPort, IPurgeSchedulePort {
  constructor(private readonly prisma: unknown) {}

  // ---- IArchiveEntryPort ----

  async create(record: Omit<ArchiveEntryPortRecord, 'id' | 'version' | 'archived_at'>): Promise<string>;
  async create(record: Omit<IPurgeSchedulePortRecord, 'id' | 'executee'>): Promise<string>;
  async create(
    record:
      | Omit<ArchiveEntryPortRecord, 'id' | 'version' | 'archived_at'>
      | Omit<IPurgeSchedulePortRecord, 'id' | 'executee'>,
  ): Promise<string> {
    if ('entry_id' in record) {
      const data = { ...record };
      await this.prismaExecute('create', 'purge_schedules', data);
      return String((data as { id?: string }).id ?? '');
    }
    const query = this.prismaQuery('create', record);
    return String(query.result?.id ?? '');
  }

  async findById(id: string, requestOrgId: string): Promise<ArchiveEntryPortRecord | null>;
  async findById(id: string, requestOrgId: string): Promise<IPurgeSchedulePortRecord | null>;
  async findById(
    id: string,
    requestOrgId: string,
  ): Promise<ArchiveEntryPortRecord | IPurgeSchedulePortRecord | null> {
    const raw = await this.prismaFindOne('archives', { id, org_id: requestOrgId });
    if (raw) return this.toPortRecord(raw);
    const schedule = await this.prismaFindOne('purge_schedules', { id, org_id: requestOrgId });
    if (schedule) return this.toPurgeSchedulePortRecord(schedule);
    return null;
  }

  async findByResourceId(
    resourceType: string,
    resourceId: string,
    requestOrgId: string,
  ): Promise<ArchiveEntryPortRecord | null> {
    const raw = await this.prismaFindOne('archives', {
      resource_type_original: resourceType,
      resource_id_original: resourceId,
      org_id: requestOrgId,
    });
    if (!raw) return null;
    return this.toPortRecord(raw);
  }

  async findTrashedOnly(requestOrgId: string): Promise<ArchiveEntryPortRecord[]> {
    const rows = await this.prismaFindMany('archives', {
      etat_lifecycle: 'trashed',
      org_id: requestOrgId,
    });
    return rows.map(this.toPortRecord.bind(this));
  }

  async findAllActive(requestOrgId: string): Promise<ArchiveEntryPortRecord[]> {
    const rows = await this.prismaFindMany('archives', {
      etat_lifecycle: 'active',
      org_id: requestOrgId,
    });
    return rows.map(this.toPortRecord.bind(this));
  }

  async findByTags(tags: string[], requestOrgId: string): Promise<ArchiveEntryPortRecord[]> {
    const rows = await this.prismaFindMany('archives', { tags, org_id: requestOrgId });
    return rows.map(this.toPortRecord.bind(this));
  }

  async updateState(id: string, state: ArchiveEntryState): Promise<void> {
    await this.prismaUpdate('archives', { id }, { etat_lifecycle: state });
  }

  async markTrashed(id: string, reason?: string): Promise<void> {
    await this.prismaUpdate('archives', { id }, {
      etat_lifecycle: 'trashed',
      date_corbeille: new Date().toISOString(),
      motif_purge: reason ?? null,
    });
  }

  async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<void> {
    await this.prismaUpdate('archives', { id }, { metadonnees_archive: metadata });
  }

  async applyTags(id: string, tags: string[]): Promise<void> {
    await this.prismaRaw(`
      UPDATE archives SET tags = array_cat(tags, $1::text[]) WHERE id = $2
    `, [tags, id]);
  }

  async removeTags(id: string, tagsToRemove: string[]): Promise<void> {
    await this.prismaRaw(`
      UPDATE archives SET tags = array_remove(tags, ANY($1::text[])) WHERE id = $2
    `, [tagsToRemove, id]);
  }

  // ---- IPurgeSchedulePort ----

  async findPendingByDate(maxDate: Date, requestOrgId: string): Promise<IPurgeSchedulePortRecord[]> {
    const raw = await this.prismaFindMany('purge_schedules', {
      executee: false,
      date_planifiee_lte: maxDate.toISOString(),
      org_id: requestOrgId,
    });
    return raw.map(this.toPurgeSchedulePortRecord.bind(this));
  }

  async markExecuted(id: string, executedBy: string): Promise<void> {
    await this.prismaUpdate('purge_schedules', { id }, {
      executee: true,
      execution_date: new Date().toISOString(),
      executee_par: executedBy,
    });
  }

  async deleteByEntryId(entryId: string, requestOrgId: string): Promise<void> {
    await this.prismaDelete('purge_schedules', { entry_id: entryId, org_id: requestOrgId });
  }

  // ---- Conversion helpers ----

  private toPortRecord(row: Record<string, unknown>): ArchiveEntryPortRecord {
    return {
      id: String(row.id),
      org_id: String(row.org_id),
      archive_by: row.archive_by ? String(row.archive_by) : null,
      resource_type_original: String(row.resource_type_original) as ResourceOriginalType,
      resource_id_original: String(row.resource_id_original),
      member_lie_id: row.member_lie_id ? String(row.member_lie_id) : null,
      metadata: this.parseJson(row.metadonnees_archive, {}),
      tags: this.toArray(row.tags),
      category: row.categorie ? String(row.categorie) : null,
      attachment_urls: this.toArray(row.url_pieces_jointes),
      etat_lifecycle: String(row.etat_lifecycle) as ArchiveEntryState,
      archived_at: new Date(String(row.date_archivage)),
      trashed_at: row.date_corbeille ? new Date(String(row.date_corbeille)) : null,
      purge_date: row.date_purge ? new Date(String(row.date_purge)) : null,
      purge_reason: row.motif_purge ? String(row.motif_purge) : null,
      version: Number(row.version) || 1,
    };
  }

  private toPurgeSchedulePortRecord(row: Record<string, unknown>): IPurgeSchedulePortRecord {
    return {
      id: String(row.id),
      org_id: String(row.org_id),
      entry_id: String(row.entry_id),
      etats_eligibles: String(row.etats_eligibles) as PurgeEligibleState,
      programme_par_systeme: Boolean(row.programme_par_systeme),
      date_planifiee: new Date(String(row.date_planifiee)),
      executee: Boolean(row.executee),
      execution_date: row.execution_date ? new Date(String(row.execution_date)) : null,
      executed_by: row.executee_par ? String(row.executee_par) : null,
    };
  }

  private parseJson(value: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return fallback; }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return fallback;
  }

  private toArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return [value];
    return [];
  }

  // ---- Prisma delegation stubs ----
  private async prismaFindOne(table: string, where: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    throw new Error('PrismaLifecycleRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaFindMany(table: string, where: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    throw new Error('PrismaLifecycleRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaUpdate(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaLifecycleRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaDelete(table: string, where: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaLifecycleRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaRaw(sql: string, params: unknown[]): Promise<void> {
    throw new Error('PrismaLifecycleRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaExecute(action: string, table: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaLifecycleRepository requires a PrismaClient instance at composition root.');
  }
  private prismaQuery(action: string, data: Record<string, unknown>): { result?: Record<string, unknown> } {
    return {};
  }
}
