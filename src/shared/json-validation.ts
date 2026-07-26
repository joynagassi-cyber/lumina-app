/**
 * End-to-end pipeline: AI generates JSON -> preprocess -> validate against schema -> typed result.
 */

import type { JSONSchema7 } from 'json-schema';
import type { ValidateFunction } from 'ajv';
import { preprocessAIRawJSON } from './json-preprocess';
import { compileValidator } from './ajv-validator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult<T = unknown> {
  success: true;
  data: T;
  tier: 'direct' | 'preprocessed';
  attemptCount: number;
}

export interface ValidationFailure {
  success: false;
  tier: 'parse-failed' | 'schema-failed' | 'all-failed';
  attemptCount: number;
  errors: string[];
  ajvErrors?: ReturnType<ValidateFunction>['errors'];
}

export type SchemaValidationResult<T> = ValidationResult<T> | ValidationFailure;

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Validate a raw JSON string against a JSON Schema.
 *
 * Pipeline:
 *   1. Try direct JSON.parse() + AJV validation
 *   2. If #1 fails, preprocess (strip markdown fences, fix commas, etc.) then retry
 *   3. If both fail, return detailed errors for upstream handling
 *
 * @example
 * const result = validateConfig(myJsonString, manifestSchema, 'manifest');
 * if (result.success) {
 *   // result.data is the parsed + validated object
 * } else {
 *   // result.errors has detailed failure info
 * }
 */
export function validateConfig<T = unknown>(
  rawOutput: string,
  schema: JSONSchema7,
  schemaKey: string = 'default'
): SchemaValidationResult<T> {
  let attemptCount = 0;

  // --- Attempt 1: Direct parse ---
  attemptCount++;
  try {
    const parsed = JSON.parse(rawOutput);
    const validator = compileValidator(schemaKey, schema);
    const valid = validator(parsed);

    if (valid) {
      return { success: true, data: parsed as T, tier: 'direct', attemptCount };
    }

    // Schema validation failed -- return AJV errors for diagnostics
    return {
      success: false,
      tier: 'schema-failed',
      attemptCount,
      errors: ['JSON parsed but failed schema validation'],
      ajvErrors: validator.errors ?? undefined,
    };
  } catch {
    // Not valid JSON -- proceed to preprocessing
  }

  // --- Attempt 2: Preprocess + retry ---
  attemptCount++;
  const cleaned = preprocessAIRawJSON(rawOutput);
  try {
    const parsed = JSON.parse(cleaned);
    const validator = compileValidator(`${schemaKey}-preprocessed`, schema);
    const valid = validator(parsed);

    if (valid) {
      return { success: true, data: parsed as T, tier: 'preprocessed', attemptCount };
    }

    return {
      success: false,
      tier: 'schema-failed',
      attemptCount,
      errors: ['Preprocessed but still fails schema validation'],
      ajvErrors: validator.errors ?? undefined,
    };
  } catch {
    // Still not parseable
  }

  // All attempts exhausted
  return {
    success: false,
    tier: 'all-failed',
    attemptCount,
    errors: ['Failed to parse or validate after all recovery attempts'],
  };
}
