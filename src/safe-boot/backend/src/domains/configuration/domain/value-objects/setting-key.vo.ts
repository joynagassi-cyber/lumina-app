/**
 * SettingKey Value Object — strongly-typed setting key with format validation.
 *
 * @traceability DOC-012 Aggregate12 §VO-SettingKey
 *   → BR-CONFIG-001: Currency ISO 4217
 *   → BR-CONFIG-002: Timezone IANA format
 *   → BR-CONFIG-003: Accent color validated hex + WCAG contrast check
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

const KNOWN_KEYS: ReadonlySet<SettingKey> = new Set([
  'currency',
  'fiscal_year_start',
  'language',
  'timezone',
  'accent_hex',
  'org_logo_url',
  'short_name',
  'date_format',
  'number_format',
  'currency_symbol_position',
  'show_skeleton_loading',
  'optimistic_updates_enabled',
  'animation_duration_default_ms',
]);

/**
 * Immutable value object for a typed setting key.
 */
export class ConfigSettingKey {
  private constructor(public readonly value: SettingKey) {}

  static create(key: string): ConfigSettingKey {
    if (!KNOWN_KEYS.has(key as SettingKey)) {
      throw new InvalidSettingKeyError(
        `Unknown setting key "${key}". Known keys: ${Array.from(KNOWN_KEYS).join(', ')}.`,
      );
    }
    return new ConfigSettingKey(key as SettingKey);
  }

  isCurrency(): boolean {
    return this.value === 'currency';
  }

  isTimezone(): boolean {
    return this.value === 'timezone';
  }

  isAccentHex(): boolean {
    return this.value === 'accent_hex';
  }

  public toString(): string {
    return this.value;
  }

  equals(other: ConfigSettingKey): boolean {
    return this.value === other.value;
  }
}

/**
 * Error thrown when an unknown setting key is used.
 */
export class InvalidSettingKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSettingKeyError';
  }
}
