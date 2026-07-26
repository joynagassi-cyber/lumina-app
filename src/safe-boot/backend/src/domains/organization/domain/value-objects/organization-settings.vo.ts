/**
 * OrganizationSettings Value Object
 *
 * Organizational configuration: currency, timezone, language, accent color.
 * Stored as JSONB in org_settings table.
 *
 * @traceability DOC-012 Aggregate1 §VO-OrganizationSettings
 *   → POSTGRESQL-SCHEMA-PACK-v1 org_settings.valeur_parametre jsonb
 *   → DOC-012 ConfigurationAggregate §BR-CONFIG-001/002/003/004
 */

export interface OrganizationSettingEntry {
  readonly key: string;
  readonly value: unknown;
}

export class OrganizationSettings {
  private readonly _settings: ReadonlyMap<string, unknown>;

  constructor(entries: OrganizationSettingEntry[]) {
    const map = new Map<string, unknown>();
    for (const entry of entries) {
      if (!entry.key || typeof entry.key !== 'string') {
        throw new InvalidOrganizationSettingsError('Each setting entry must have a non-empty string key.');
      }
      if (map.has(entry.key)) {
        throw new InvalidOrganizationSettingsError(`Duplicate setting key: "${entry.key}".`);
      }
      map.set(entry.key, entry.value);
    }
    this._settings = Object.freeze(map);
  }

  get size(): number {
    return this._settings.size;
  }

  has(key: string): boolean {
    return this._settings.has(key);
  }

  get(key: string): unknown | undefined {
    return this._settings.get(key);
  }

  /** Returns all entries as an array. */
  toEntries(): OrganizationSettingEntry[] {
    return Array.from(this._settings.entries()).map(([key, value]) => ({ key, value }));
  }

  /** Merges new settings, returning a new OrganizationSettings instance. */
  merge(entries: OrganizationSettingEntry[]): OrganizationSettings {
    const merged = new Map<string, unknown>(this._settings);
    for (const entry of entries) {
      merged.set(entry.key, entry.value);
    }
    const result: OrganizationSettingEntry[] = [];
    merged.forEach((value, key) => result.push({ key, value }));
    return new OrganizationSettings(result);
  }
}

export class InvalidOrganizationSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOrganizationSettingsError';
  }
}
