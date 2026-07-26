/**
 * Ajv validator factory -- compiled once, reused everywhere.
 * Wraps AJV with sensible defaults for Lumina's config validation.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema7 } from 'json-schema';

let _cached: Ajv | null = null;

export function getAjvInstance(): Ajv {
  if (!_cached) {
    _cached = new Ajv({
      allErrors: true,     // Return ALL errors, not just first
      verbose: true,       // Include full schema in error messages
      strict: true,        // Warn on unused $defs / refs
      coerceTypes: false,  // Strict mode -- no automatic type coercion
    });
    addFormats(_cached);   // Adds email, uri, date, datetime, etc.
  }
  return _cached;
}

/** Compile and cache a validator for the given schema key. */
const _validatorCache = new Map<string, Ajv.ValidateFunction>();

export function compileValidator(
  key: string,
  schema: JSONSchema7
): Ajv.ValidateFunction {
  const existing = _validatorCache.get(key);
  if (existing) return existing;

  const ajv = getAjvInstance();
  const validator = ajv.compile(schema);
  _validatorCache.set(key, validator);
  return validator;
}
