/**
 * Manifest Engine — validation + compilation of an Org Manifest.
 *
 * Per NB-RULE-05: AJV validation (JSON Schema Draft-7) BEFORE any compilation.
 * The compiled manifest is the runtime configuration consumed by Vocabulary,
 * Branding, Capability, Forms and Workflow engines.
 */
import type { ValidateFunction } from 'ajv';
import { compileValidator } from '../ajv-validator';
import type { OrgManifest } from './types';
import orgManifestSchema from './org-manifest.schema.json';

export class ManifestValidationError extends Error {
  readonly errors: NonNullable<ValidateFunction['errors']>;

  constructor(errors: NonNullable<ValidateFunction['errors']>) {
    super(`Manifest invalide: ${errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')}`);
    this.name = 'ManifestValidationError';
    this.errors = errors;
  }
}

export class ManifestEngine {
  /** Schema key used for the AJV compile cache. */
  static readonly SCHEMA_KEY = 'org-manifest-v1';

  /** Validates raw (unknown) data against the org-manifest schema. Throws on failure. */
  validate(raw: unknown): asserts raw is OrgManifest {
    const validate = compileValidator(ManifestEngine.SCHEMA_KEY, orgManifestSchema as Parameters<typeof compileValidator>[1]);
    if (!validate(raw)) {
      throw new ManifestValidationError(validate.errors ?? []);
    }
  }

  /**
   * Validate + compile raw data into a typed OrgManifest.
   * Throws ManifestValidationError when the payload is invalid.
   */
  compile(raw: unknown): OrgManifest {
    this.validate(raw);
    return raw;
  }

  /** Parse + validate a raw JSON string (e.g. fetched from the network). */
  compileFromJson(text: string): OrgManifest {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new ManifestValidationError([
        { instancePath: '', schemaPath: '#', keyword: 'parse', message: `JSON invalide: ${String(err)}`, params: {} },
      ]);
    }
    return this.compile(parsed);
  }
}
