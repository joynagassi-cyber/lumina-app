/**
 * Configuration Application Service — orchestrates org-level settings operations.
 *
 * @traceability DOC-012 Aggregate12 §ConfigurationAggregate Application Service
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 30 (settings)
 */

import { DEFAULT_SETTINGS } from '../domain/entities/setting-entry.entity';
import { ConfigSettingKey } from '../domain/value-objects/setting-key.vo';
import { ConfigSettingValue, TypedSettingValue } from '../domain/value-objects/setting-value.vo';
import { SettingResolver, ISettingStore } from '../domain/services/setting-resolver.service';
import { SettingValidator } from '../domain/services/setting-validator.service';
import { FormatValidationPolicy } from '../domain/policies/format-validation-policy';
import type { ISettingPort, SettingKey, SettingRecord } from '../ports/configuration.port';

export interface UpdateSettingInput {
  orgId: string;
  key: ConfigSettingKey;
  value: TypedSettingValue;
  updatedBy: string;
}

export interface BulkUpdateInput {
  orgId: string;
  updates: Array<{ key: ConfigSettingKey; value: TypedSettingValue }>;
  updatedBy: string;
}

export class ConfigurationService {
  constructor(private readonly settingPort: ISettingPort) {}

  /**
   * Get a single setting value. Falls back to default if not stored.
   */
  async getSetting(
    key: ConfigSettingKey,
    orgId: string,
  ): Promise<TypedSettingValue> {
    const resolver = new SettingResolver(this.createStore(orgId));
    return resolver.resolve(key.value);
  }

  /**
   * Get all settings for an org, merged with defaults.
   */
  async getAllSettings(orgId: string): Promise<Record<string, TypedSettingValue>> {
    const resolver = new SettingResolver(this.createStore(orgId));
    return resolver.resolveAll();
  }

  /**
   * Update a single setting after validation.
   * BR-CONFIG-001/002/003: Format constraints enforced.
   */
  async updateSetting(input: UpdateSettingInput): Promise<void> {
    // Validate format per FormatValidationPolicy
    const validationResult = FormatValidationPolicy.validate(input.key.value, input.value);
    if (!validationResult.valid) {
      throw new SettingValidationError(validationResult.errors.join('; '));
    }

    // Validate typed value
    try {
      ConfigSettingValue.create({ key: input.key.value, rawValue: input.value });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SettingValidationError(message);
    }

    await this.settingPort.update(
      input.key.value,
      input.orgId,
      { value: input.value },
      input.updatedBy,
    );
  }

  /**
   * Bulk update multiple settings in one operation.
   * Validates each before persisting.
   */
  async bulkUpdateSettings(input: BulkUpdateInput): Promise<void> {
    // Validate all first (fail-fast)
    const errors = SettingValidator.validateBatch(
      input.updates.map((u) => ({ key: u.key.value, value: u.value })),
    );
    if (errors.length > 0) {
      throw new SettingValidationError(
        `Validation failed for ${errors.length} setting(s).`,
      );
    }

    const updates = input.updates.map((u) => ({
      key: u.key.value,
      valeur: { value: u.value } as Record<string, unknown>,
    }));

    await this.settingPort.updateAll(input.orgId, updates, input.updatedBy);
  }

  /**
   * Reset all settings to defaults for an org.
   */
  async resetToDefaults(orgId: string, updatedBy: string): Promise<void> {
    await this.settingPort.resetToDefaults(orgId, updatedBy);
  }

  /**
   * Create a store adapter for SettingResolver given an org ID.
   */
  private createStore(orgId: string): ISettingStore {
    return {
      getKey: async (key: string): Promise<TypedSettingValue | undefined> => {
        const record = await this.settingPort.findByKeyAndOrg(key as SettingKey, orgId);
        if (!record) return undefined;
        // Deserialize the JSONB value back to typed value
        const val = record.valeur;
        if (typeof val === 'object' && val !== null && 'value' in val) {
          return (val as { value: TypedSettingValue }).value;
        }
        return val as TypedSettingValue | undefined;
      },
    };
  }
}

/**
 * Error thrown when a setting update fails validation.
 */
export class SettingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingValidationError';
  }
}
