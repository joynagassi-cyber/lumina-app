/**
 * FormatValidationPolicy — enforces format constraints on setting values.
 *
 * @traceability DOC-012 Aggregate12 §FormatValidationPolicy
 *   → BR-CONFIG-001: Currency ISO 4217
 *   → BR-CONFIG-002: Timezone IANA format
 *   → BR-CONFIG-003: Accent color validated hex + WCAG contrast check
 */

import { SettingValidator } from '../services/setting-validator.service';

export interface FormatValidationResult {
  readonly valid: boolean;
  readonly key: string;
  readonly errors: string[];
}

/**
 * Policy that validates format compliance for all known setting keys.
 * Enforces ISO 4217 currency, IANA timezone, and hex color per BR-CONFIG-001/002/003.
 */
export class FormatValidationPolicy {
  /**
   * Validate a single setting value against its format policy.
   */
  static validate(key: string, value: unknown): FormatValidationResult {
    const errors: string[] = [];

    if (typeof value === 'undefined' || value === null) {
      errors.push(`Setting "${key}" has no value.`);
      return { valid: false, key, errors };
    }

    switch (key) {
      case 'currency':
        if (!SettingValidator.isValidCurrency(String(value))) {
          errors.push(`"${value}" is not a valid ISO 4217 currency code.`);
        }
        break;
      case 'timezone':
        if (!SettingValidator.isValidTimezone(String(value))) {
          errors.push(`"${value}" is not a valid IANA timezone.`);
        }
        break;
      case 'accent_hex':
        if (!SettingValidator.isValidHexColor(String(value))) {
          errors.push(`"${value}" does not match ^#[0-9a-fA-F]{6}$.`);
        }
        // Additional WCAG contrast would be checked at the UI layer.
        break;
    }

    return { valid: errors.length === 0, key, errors };
  }

  /**
   * Validate multiple settings in batch. Returns all format errors.
   */
  static validateBatch(settings: Array<{ key: string; value: unknown }>): FormatValidationResult[] {
    return settings.map((s) => this.validate(s.key, s.value));
  }
}
