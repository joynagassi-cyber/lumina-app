/**
 * SettingValidator — domain service for validating setting values.
 *
 * @traceability DOC-012 Aggregate12 §SettingValidator
 */

import { ConfigSettingValue, TypedSettingValue } from '../value-objects/setting-value.vo';

/**
 * Service that validates individual settings and bulk batches.
 * Wraps ConfigSettingValue.validate for explicit error messages.
 */
export class SettingValidator {
  /**
   * Validate a single key/value pair. Throws on validation failure.
   */
  static validate(key: string, value: TypedSettingValue): void {
    ConfigSettingValue.validate(key, value);
  }

  /**
   * Validate a batch of settings. Returns an array of errors (empty if all valid).
   */
  static validateBatch(settings: Array<{ key: string; value: TypedSettingValue }>): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const setting of settings) {
      try {
        ConfigSettingValue.validate(setting.key, setting.value);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(new ValidationError(setting.key, message));
      }
    }
    return errors;
  }

  /**
   * Check if a currency is valid ISO 4217.
   */
  static isValidCurrency(currency: string): boolean {
    return /^[A-Z]{3}$/.test(currency);
  }

  /**
   * Check if a timezone follows IANA format.
   */
  static isValidTimezone(timezone: string): boolean {
    return /^[A-Za-z_]+\/[A-Za-z_]+$/.test(timezone);
  }

  /**
   * Check if a hex color matches the expected pattern.
   */
  static isValidHexColor(hex: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(hex);
  }
}

/**
 * Represents a single validation error for a setting key.
 */
export class ValidationError {
  constructor(
    public readonly key: string,
    public readonly message: string,
  ) {}
}
