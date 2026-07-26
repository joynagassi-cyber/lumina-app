/**
 * FormVersion Value Object
 *
 * Semantic version string for form definitions (e.g., "1.0", "2.3").
 * Ensures immutability of old versions — new submissions must target a specific version.
 *
 * @traceability DOC-012 Aggregate6 §VO-FormVersion → POSTGRESQL-SCHEMA-PACK-v1 forms.version_semantique
 *   → BR-FRM-004 (old versions not modifiable)
 */

export class InvalidFormVersionError extends Error {
  constructor(value: string) {
    super(`Invalid FormVersion: "${value}". Must match semantic pattern MAJOR.MINOR.`);
    this.name = 'InvalidFormVersionError';
  }
}

const SEMVER_PATTERN = /^\d{1,10}\.\d{1,10}$/;

export class FormVersion {
  private readonly _major: number;
  private readonly _minor: number;
  private readonly _raw: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new InvalidFormVersionError('null');
    }

    const trimmed = value.trim();
    if (!SEMVER_PATTERN.test(trimmed)) {
      throw new InvalidFormVersionError(trimmed);
    }

    const parts = trimmed.split('.');
    this._major = parseInt(parts[0], 10);
    this._minor = parseInt(parts[1], 10);
    this._raw = trimmed;
  }

  get major(): number { return this._major; }
  get minor(): number { return this._minor; }

  /** Create the next minor version. */
  nextMinor(): FormVersion {
    return new FormVersion(`${this._major}.${this._minor + 1}`);
  }

  /** Create the next major version (resets minor to 0). */
  nextMajor(): FormVersion {
    return new FormVersion(`${this._major + 1}.0`);
  }

  equals(other: FormVersion): boolean {
    return this._raw === other._raw;
  }

  toString(): string {
    return this._raw;
  }

  /** Compare with another version. Returns -1, 0, or 1. */
  compareTo(other: FormVersion): number {
    if (this._major !== other._major) {
      return this._major - other._major;
    }
    return this._minor - other._minor;
  }

  /** Return true if this version is newer than other. */
  isGreaterThan(other: FormVersion): boolean {
    return this.compareTo(other) > 0;
  }

  /** Return true if this version is older than other. */
  isLessThan(other: FormVersion): boolean {
    return this.compareTo(other) < 0;
  }
}
