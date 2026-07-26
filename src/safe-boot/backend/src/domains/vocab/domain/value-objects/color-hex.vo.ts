/**
 * ColorHex Value Object
 *
 * Validated 7-character hex color code (e.g. "#FF0000").
 * Per POSTGRESQL-SCHEMA-PACK-v1 vocab_values.couleur_hex CHECK constraint:
 *   `couleur IS NULL OR couleur ~ '^#[0-9a-fA-F]{6}$'`
 *
 * @traceability DOC-012 Aggregate8 §VO-ColorHex
 *   → POSTGRESQL-SCHEMA-PACK-v1 vocab_values.couleur_hex
 *   → ConfigurationAggregate BR-CONFIG-003 (hex color validation)
 */

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export class InvalidColorHexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidColorHexError';
  }
}

export class ColorHex {
  private readonly _value: string;

  constructor(value: string | null) {
    if (value === null || value === undefined) {
      this._value = ''; // Empty string represents no color
      return;
    }

    if (typeof value !== 'string') {
      throw new InvalidColorHexError('Color must be a string or null.');
    }

    const trimmed = value.trim();
    if (trimmed.length > 0 && !HEX_PATTERN.test(trimmed)) {
      throw new InvalidColorHexError(
        `Invalid hex color: "${trimmed}". Must match pattern ${HEX_PATTERN.source}.`,
      );
    }

    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  /** Returns true if this ColorHex has an actual value assigned. */
  get isSet(): boolean {
    return this._value.length > 0;
  }

  /** Returns true if no color is set (null/empty). */
  get isEmpty(): boolean {
    return this._value.length === 0;
  }

  equals(other: ColorHex): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
