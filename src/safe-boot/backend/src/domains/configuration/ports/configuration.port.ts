/**
 * Configuration Ports — interface contracts for the ConfigurationAggregate.
 *
 * @traceability DOC-012 Aggregate12 (ConfigurationAggregate), PG-Schema-v1 Table 30
 *   → POSTGRESQL-SCHEMA-PACK-v1 settings
 */

export type SettingKey =
  | 'currency'
  | 'fiscal_year_start'
  | 'language'
  | 'timezone'
  | 'accent_hex'
  | 'org_logo_url'
  | 'short_name'
  | 'date_format'
  | 'number_format'
  | 'currency_symbol_position'
  | 'show_skeleton_loading'
  | 'optimistic_updates_enabled'
  | 'animation_duration_default_ms';

export type SettingValueTyped = string | number | boolean | Record<string, unknown>;

export interface SettingRecord {
  id: string;
  org_id: string;
  cle_parametre: SettingKey;
  valeur: Record<string, unknown>;
  mis_a_jour_par?: string | null;
  mis_a_jour_le: Date;
  valeur_defaut: Record<string, unknown>;
}

export interface ISettingPort {
  create(
    record: Omit<SettingRecord, 'id' | 'mis_a_jour_le'>,
  ): Promise<string>;
  findByKeyAndOrg(
    key: SettingKey,
    orgId: string,
  ): Promise<SettingRecord | null>;
  findAllByOrg(orgId: string): Promise<SettingRecord[]>;
  update(
    key: SettingKey,
    orgId: string,
    valeur: Record<string, unknown>,
    updatedBy: string,
  ): Promise<void>;
  updateAll(
    orgId: string,
    updates: Array<{ key: SettingKey; valeur: Record<string, unknown> }>,
    updatedBy: string,
  ): Promise<void>;
  resetToDefaults(orgId: string, updatedBy: string): Promise<void>;
  getAllDefaults(orgId: string): Promise<Record<string, Record<string, unknown>>>;
}
