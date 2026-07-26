/**
 * SettingValue — typed value wrapper for configuration settings.
 *
 * @traceability DOC-012 Aggregate12 §VO-SettingValue
 *   → POSTGRESQL-SCHEMA-PACK-v1 settings.valeur jsonb
 */

export type TypedSettingValue = string | number | boolean | Record<string, unknown>;

export interface SettingValueProps {
  readonly key: string;
  readonly rawValue: TypedSettingValue;
}

const KNOWN_KEYS: ReadonlySet<string> = new Set([
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
 * Immutable value object representing a typed setting value.
 * Enforces type-specific constraints per BR-CONFIG-001/002/003.
 */
export class ConfigSettingValue {
  private constructor(private readonly props: SettingValueProps) {}

  static create(props: SettingValueProps): ConfigSettingValue {
    if (!KNOWN_KEYS.has(props.key)) {
      throw new InvalidSettingValueError(`Unknown setting key: "${props.key}".`);
    }
    return new ConfigSettingValue(props);
  }

  /** Validate type compliance for the given key/value pair. */
  static validate(key: string, value: TypedSettingValue): void {
    switch (key) {
      case 'currency':
        if (typeof value !== 'string') throw new InvalidSettingValueError('Currency must be a string.');
        if (!/^[A-Z]{3}$/.test(value)) {
          throw new InvalidSettingValueError(`Currency "${value}" is not valid ISO 4217.`);
        }
        break;
      case 'timezone':
        if (typeof value !== 'string') throw new InvalidSettingValueError('Timezone must be a string.');
        if (!/^[A-Za-z_]+\/[A-Za-z_]+$/.test(value)) {
          throw new InvalidSettingValueError(`Timezone "${value}" is not valid IANA format.`);
        }
        break;
      case 'accent_hex':
        if (typeof value !== 'string') throw new InvalidSettingValueError('Accent color must be a string.');
        if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
          throw new InvalidSettingValueError(`Hex color "${value}" does not match ^#[0-9a-fA-F]{6}$.`);
        }
        break;
      case 'fiscal_year_start':
        if (typeof value !== 'string' && typeof value !== 'number') {
          throw new InvalidSettingValueError('Fiscal year start must be a string or number.');
        }
        break;
      case 'language':
        if (typeof value !== 'string') throw new InvalidSettingValueError('Language must be a string.');
        if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(value)) {
          throw new InvalidSettingValueError(`Language "${value}" is not valid BCP-47 short form.`);
        }
        break;
      case 'show_skeleton_loading':
      case 'optimistic_updates_enabled':
        if (typeof value !== 'boolean') throw new InvalidSettingValueError(`${key} must be a boolean.`);
        break;
      case 'animation_duration_default_ms':
        if (typeof value !== 'number' || value < 0) {
          throw new InvalidSettingValueError('Animation duration must be a non-negative number.');
        }
        break;
    }
  }

  get key(): string {
    return this.props.key;
  }

  get rawValue(): TypedSettingValue {
    return this.props.rawValue;
  }

  public toString(): string {
    return `${this.props.key}=${String(this.props.rawValue)}`;
  }
}

/**
 * Error thrown when a setting value fails validation.
 */
export class InvalidSettingValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSettingValueError';
  }
}
