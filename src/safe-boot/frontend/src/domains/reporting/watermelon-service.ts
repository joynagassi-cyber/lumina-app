/**
 * WatermelonDB Reporting Service - Initialize database and sync reporting data offline
 * @traceability CANONICAL-DOMAIN-MODEL.md: OfflineSyncAggregate + ReportingAggregate integration
 */

import { Database, Model, Q } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

/* ------------------------------------------------------------------ */
/*  Reporting Models (WatermelonDB)                                    */
/* ------------------------------------------------------------------ */

class ReportTemplate extends Model {
  static table = 'report_templates' as const;

  @field('organization_id') organization_id!: string;
  @field('user_id') user_id!: string;
  @field('name') name!: string;
  @field('description') description!: string;
  @field('data_source_type') data_source_type!: string;
  @json('query', sanitizeJson) query!: unknown;
  @field('is_public') is_public!: number;
  @field('created_at') created_at!: string;
  @field('updated_at') updated_at!: string;
  @field('created_by') created_by!: string;
  @field('last_modified_by') last_modified_by!: string;
}

class ReportInstance extends Model {
  static table = 'report_instances' as const;

  @field('organization_id') organization_id!: string;
  @field('report_definition_id') report_definition_id!: string;
  @field('period_start') period_start!: string;
  @field('period_end') period_end!: string;
  @field('period') period!: string;
  @field('type') type!: string;
  @json('data', sanitizeJson) data!: unknown;
  @field('status') status!: string;
  @field('generated_by') generated_by!: string;
  @field('generated_at') generated_at!: string;
  @field('expires_at') expires_at!: string;
  @field('version') version!: number;
  @field('synced') synced!: number;
  @field('created_at') created_at!: string;
  @field('created_by') created_by!: string;
  @field('updated_at') updated_at!: string;
  @field('updated_by') updated_by!: string;
}

class ReportSnapshot extends Model {
  static table = 'report_snapshots' as const;

  @field('organization_id') organization_id!: string;
  @field('snapshot_date') snapshot_date!: string;
  @json('metrics', sanitizeJson) metrics!: unknown;
  @field('currency') currency!: string;
  @field('version') version!: number;
  @field('synced') synced!: number;
  @field('created_by') created_by!: string;
  @field('updated_by') updated_by!: string;
}

/** JSON sanitizer used by the @json decorator. */
function sanitizeJson(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

/* ------------------------------------------------------------------ */
/*  Row shapes for create payloads                                     */
/* ------------------------------------------------------------------ */

interface ReportTemplateRow {
  id?: string;
  organization_id: string;
  user_id: string;
  name: string;
  description?: string;
  data_source_type: string;
  query?: unknown;
  is_public?: boolean;
  created_by: string;
  last_modified_by?: string;
}

interface ReportInstanceRow {
  id?: string;
  organization_id: string;
  report_definition_id: string;
  period_start: string;
  period_end: string;
  period: string;
  type: string;
  data?: unknown;
  status: string;
  generated_by: string;
  generated_at: string;
  expires_at?: string;
  version?: number;
  synced?: boolean;
  created_by: string;
  updated_by?: string;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class ReportingWatermelonService {
  private database: Database;

  constructor(adapter: SQLiteAdapter) {
    this.database = new Database({
      adapter,
      modelClasses: [ReportTemplate, ReportInstance, ReportSnapshot],
    });
  }

  /** Get template by ID */
  async getTemplateById(id: string): Promise<ReportTemplate | null> {
    try {
      return await this.database.get<ReportTemplate>('report_templates').find(id);
    } catch {
      return null;
    }
  }

  /** Save or update template */
  async saveTemplate(template: ReportTemplateRow): Promise<ReportTemplate> {
    return await this.database.write(async () => {
      const now = new Date().toISOString();
      const collection = this.database.get<ReportTemplate>('report_templates');
      if (template.id) {
        const existing = await this.getTemplateById(template.id);
        if (existing) {
          return await existing.update((model) => {
            model.name = template.name;
            model.description = template.description ?? model.description;
            model.data_source_type = template.data_source_type;
            model.query = template.query ?? model.query;
            model.is_public = template.is_public ? 1 : 0;
            model.last_modified_by = template.last_modified_by ?? template.created_by;
            model.updated_at = now;
          });
        }
      }
      return await collection.create((model) => {
        model.organization_id = template.organization_id;
        model.user_id = template.user_id;
        model.name = template.name;
        model.description = template.description ?? '';
        model.data_source_type = template.data_source_type;
        model.query = template.query;
        model.is_public = template.is_public ? 1 : 0;
        model.created_at = now;
        model.updated_at = now;
        model.created_by = template.created_by;
        model.last_modified_by = template.last_modified_by ?? template.created_by;
      });
    });
  }

  /** List templates for organization */
  async listTemplates(orgId: string, userId: string, publicOnly = false): Promise<ReportTemplate[]> {
    const collection = this.database.get<ReportTemplate>('report_templates');
    let query = collection.query();
    query = query.extend(Q.where('organization_id', orgId));
    if (publicOnly) {
      query = query.extend(Q.where('is_public', 1));
    } else {
      query = query.extend(Q.where('user_id', userId));
    }
    return await query.fetch();
  }

  /** Delete template */
  async deleteTemplate(id: string): Promise<void> {
    await this.database.write(async () => {
      const record = await this.getTemplateById(id);
      if (record) {
        await record.destroyPermanently();
      }
    });
  }

  /** Get instance by ID */
  async getInstanceById(id: string): Promise<ReportInstance | null> {
    try {
      return await this.database.get<ReportInstance>('report_instances').find(id);
    } catch {
      return null;
    }
  }

  /** Save instance */
  async saveInstance(instance: ReportInstanceRow): Promise<ReportInstance> {
    return await this.database.write(async () => {
      const now = new Date().toISOString();
      const collection = this.database.get<ReportInstance>('report_instances');
      return await collection.create((model) => {
        model.organization_id = instance.organization_id;
        model.report_definition_id = instance.report_definition_id;
        model.period_start = instance.period_start;
        model.period_end = instance.period_end;
        model.period = instance.period;
        model.type = instance.type;
        model.data = instance.data;
        model.status = instance.status;
        model.generated_by = instance.generated_by;
        model.generated_at = instance.generated_at;
        model.expires_at = instance.expires_at ?? '';
        model.version = instance.version ?? 1;
        model.synced = instance.synced ? 1 : 0;
        model.created_by = instance.created_by;
        model.updated_by = instance.updated_by ?? instance.created_by;
        model.created_at = now;
        model.updated_at = now;
      });
    });
  }

  /** List instances */
  async listInstances(
    orgId: string,
    options: { status?: string; type?: string; from?: string; to?: string }
  ): Promise<ReportInstance[]> {
    const collection = this.database.get<ReportInstance>('report_instances');
    let query = collection.query();
    query = query.extend(Q.where('organization_id', orgId));
    if (options.status) query = query.extend(Q.where('status', options.status));
    if (options.type) query = query.extend(Q.where('type', options.type));
    if (options.from) query = query.extend(Q.where('period_start', options.from));
    if (options.to) query = query.extend(Q.where('period_end', options.to));
    return await query.fetch();
  }
}

// Export the service as singleton
let instance: ReportingWatermelonService | null = null;

export function getReportingWatermelonService(adapter: SQLiteAdapter): ReportingWatermelonService {
  if (!instance) {
    instance = new ReportingWatermelonService(adapter);
  }
  return instance;
}

export type { ReportTemplate, ReportInstance, ReportSnapshot };
export default ReportingWatermelonService;
