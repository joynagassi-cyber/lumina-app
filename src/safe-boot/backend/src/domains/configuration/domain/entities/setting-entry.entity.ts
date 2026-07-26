/**
 * SettingEntry domain entity — Aggregate Root of ConfigurationAggregate.
 *
 * Manages org-level configuration settings with defaults, typed values,
 * and change tracking.
 *
 * @traceability DOC-012 Aggregate12 Entity SettingEntry
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 30 (settings)
 */

import { v4 as uuidv4 } from 'uuid';
import { ConfigSettingKey } from '../value-objects/setting-key.vo';
import { ConfigSettingValue, TypedSettingValue } from '../value-objects/setting-value.vo';

export interface SettingEntryProps {
  id: string;
  orgId: string;
  key: ConfigSettingKey;
  value: ConfigSettingValue;
  updatedBy?: string | null;
  updatedAt: Date;
  defaultValue: TypedSettingValue;
}

/**
 * Default values for all known settings.
 * BR-CONFIG-004: All settings have default values.
 */
export const DEFAULT_SETTINGS: Readonly<Record<string, TypedSettingValue>> = Object.freeze({
  currency: 'USD',
  fiscal_year_start: '01-01',
  language: 'fr',
  timezone: 'Africa/Kinshasa',
  accent_hex: '#2563EB',
  org_logo_url: '',
  short_name: '',
  date_format: 'YYYY-MM-DD',
  number_format: '1.234,56',
  currency_symbol_position: 'after',
  show_skeleton_loading: true,
  optimistic_updates_enabled: false,
  animation_duration_default_ms: 300,
});

export class SettingEntry {
  private readonly _emittedEvents: unknown[] = [];

  private constructor(private readonly props: SettingEntryProps) {}

  static create(params: Omit<SettingEntryProps, 'id' | 'updatedAt'>): SettingEntry {
    return new SettingEntry({
      ...params,
      id: params.id ?? uuidv4(),
      updatedAt: new Date(),
    });
  }

  get id(): string { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get key(): ConfigSettingKey { return this.props.key; }
  get value(): ConfigSettingValue { return this.props.value; }
  get updatedBy(): string | null { return this.props.updatedBy ?? null; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get defaultValue(): TypedSettingValue { return this.props.defaultValue; }

  /**
   * Update the setting value. Emits SettingUpdated event if changed.
   */
  updateValue(newValue: TypedSettingValue, updatedBy: string): void {
    ConfigSettingValue.validate(this.props.key.value, newValue);

    const oldValue = this.props.value.rawValue;
    if (oldValue === newValue) return;

    this.props.value = ConfigSettingValue.create({
      key: this.props.key.value,
      rawValue: newValue,
    });
    this.props.updatedAt = new Date();
    this.props.updatedBy = updatedBy;

    this.emitEvent(new SettingUpdated(
      this.props.id,
      this.props.orgId,
      this.props.key.value,
      oldValue,
      newValue,
      updatedBy,
    ));
  }

  resetToDefault(updatedBy: string): void {
    const defaultValue = DEFAULT_SETTINGS[this.props.key.value];
    if (defaultValue === undefined) return;

    this.updateValue(defaultValue, updatedBy);
  }

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
      cle_parametre: this.props.key.value,
      valeur: this.serializeValue(this.props.value.rawValue),
      mis_a_jour_par: this.props.updatedBy,
      mis_a_jour_le: this.props.updatedAt.toISOString(),
      valeur_defaut: this.serializeValue(this.props.defaultValue),
    };
  }

  private serializeValue(value: TypedSettingValue): string {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }
}

// ---- Domain Events ----

export class SettingUpdated {
  constructor(
    public readonly settingId: string,
    public readonly orgId: string,
    public readonly key: string,
    public readonly oldValue: TypedSettingValue,
    public readonly newValue: TypedSettingValue,
    public readonly updatedBy: string,
  ) {}
}

export class SettingsResetToDefaults {
  constructor(
    public readonly orgId: string,
    public readonly updatedBy: string,
    public readonly keys: string[],
  ) {}
}
