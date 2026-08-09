/**
 * SettingResolver — domain service for reading settings with fallback to defaults.
 *
 * @traceability DOC-012 Aggregate12 §SettingResolver
 */

import { DEFAULT_SETTINGS } from '../entities/setting-entry.entity';
import type { TypedSettingValue } from '../value-objects/setting-value.vo';

export interface ISettingStore {
  getKey(key: string): Promise<TypedSettingValue | undefined>;
}

/**
 * Service that resolves setting values, falling back to defaults when overridden values are missing.
 * BR-CONFIG-004: All settings have default values that take effect if not overridden.
 */
export class SettingResolver {
  constructor(private readonly store: ISettingStore) {}

  /** Resolve a single setting value. Falls back to default if not found. */
  async resolve(key: string): Promise<TypedSettingValue> {
    const stored = await this.store.getKey(key);
    if (stored !== undefined) return stored;
    const defaultValue = DEFAULT_SETTINGS[key];
    if (defaultValue !== undefined) return defaultValue;
    throw new UnknownSettingKeyError(`No value or default found for key "${key}".`);
  }

  /** Resolve all settings, merging overrides with defaults. */
  async resolveAll(): Promise<Record<string, TypedSettingValue>> {
    const result: Record<string, TypedSettingValue> = {};
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      const stored = await this.store.getKey(key);
      result[key] = stored !== undefined ? stored : defaultValue;
    }
    return result;
  }

  /** Check if a setting has been explicitly overridden. */
  async isOverridden(key: string): Promise<boolean> {
    return (await this.store.getKey(key)) !== undefined && key in DEFAULT_SETTINGS;
  }
}

export class UnknownSettingKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownSettingKeyError';
  }
}
