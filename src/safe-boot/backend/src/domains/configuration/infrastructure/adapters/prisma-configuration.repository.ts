/**
 * PrismaAdapter for ConfigurationAggregate — implements ISettingPort.
 *
 * @traceability DOC-012 Aggregate12
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 30 (settings)
 */

import type {
  ISettingPort,
  SettingRecord,
} from '../ports/configuration.port';
import { DEFAULT_SETTINGS } from '../domain/entities/setting-entry.entity';

export class PrismaConfigurationRepository implements ISettingPort {
  constructor(private readonly prisma: unknown) {}

  async create(record: Omit<SettingRecord, 'id' | 'mis_a_jour_le'>): Promise<string> {
    const data = { ...record };
    await this.prismaExecute('create', 'settings', data);
    return String(data.id ?? '');
  }

  async findByKeyAndOrg(
    key: string,
    orgId: string,
  ): Promise<SettingRecord | null> {
    const raw = await this.prismaFindOne('settings', {
      cle_parametre: key,
      org_id: orgId,
    });
    if (!raw) return null;
    return this.toPortRecord(raw);
  }

  async findAllByOrg(orgId: string): Promise<SettingRecord[]> {
    const rows = await this.prismaFindMany('settings', { org_id: orgId });
    return rows.map(this.toPortRecord.bind(this));
  }

  async update(
    key: string,
    orgId: string,
    valeur: Record<string, unknown>,
    updatedBy: string,
  ): Promise<void> {
    await this.prismaUpdate('settings', { cle_parametre: key, org_id: orgId }, {
      valeur,
      mis_a_jour_par: updatedBy,
      mis_a_jour_le: new Date().toISOString(),
    });
  }

  async updateAll(
    orgId: string,
    updates: Array<{ key: string; valeur: Record<string, unknown> }>,
    updatedBy: string,
  ): Promise<void> {
    for (const update of updates) {
      await this.update(update.key, orgId, update.valeur, updatedBy);
    }
  }

  async resetToDefaults(orgId: string, updatedBy: string): Promise<void> {
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      await this.update(key, orgId, { value: defaultValue }, updatedBy);
    }
  }

  async getAllDefaults(): Promise<Record<string, Record<string, unknown>>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      result[key] = { value };
    }
    return result;
  }

  // ---- Conversion helpers ----

  private toPortRecord(row: Record<string, unknown>): SettingRecord {
    return {
      id: String(row.id),
      org_id: String(row.org_id),
      cle_parametre: String(row.cle_parametre) as SettingRecord['cle_parametre'],
      valeur: this.parseJson(row.valeur, {}),
      mis_a_jour_par: row.mis_a_jour_par ? String(row.mis_a_jour_par) : null,
      mis_a_jour_le: new Date(String(row.mis_a_jour_le)),
      valeur_defaut: this.parseJson(row.valeur_defaut, {}),
    };
  }

  private parseJson(value: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return fallback; }
    }
    if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
    return fallback;
  }

  // ---- Prisma delegation stubs ----
  private async prismaFindOne(table: string, where: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    throw new Error('PrismaConfigurationRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaFindMany(table: string, where: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    throw new Error('PrismaConfigurationRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaUpdate(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaConfigurationRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaExecute(action: string, table: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaConfigurationRepository requires a PrismaClient instance at composition root.');
  }
}
