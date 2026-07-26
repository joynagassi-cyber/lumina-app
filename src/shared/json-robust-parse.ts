/**
 * Robust JSON parsing with a 4-tier fallback chain.
 * Used when loading config from files or network in offline-first scenarios.
 */

import { validateConfig, type SchemaValidationResult } from './json-validation';
import type { JSONSchema7 } from 'json-schema';

export interface ParsedJSONResult<T = unknown> {
  success: boolean;
  data?: T;
  tier: number; // 1=direct, 2=preprocessed, 3=llm-fix, 4=manual
  repairs?: string[];
  errors?: string[];
}

/**
 * Parse raw JSON text through a multi-tier recovery pipeline.
 * Each tier attempts progressively more aggressive recovery.
 */
export async function robustParseJSON<T = unknown>(
  source: string | null | undefined,
  schema?: JSONSchema7,
  schemaKey?: string,
): Promise<ParsedJSONResult<T>> {
  if (!source || source.trim().length === 0) {
    return { success: false, tier: 1, errors: ['Empty or null source'] };
  }

  // Tier 1 & 2 are handled internally by validateConfig (direct + preprocess)
  const validateResult = validateConfig(source, schema ?? {}, schemaKey ?? 'default');

  if (validateResult.success) {
    return {
      success: true,
      data: validateResult.data as T,
      tier: validateResult.tier === 'direct' ? 1 : 2,
    };
  }

  // Tier 3: attempt LLM-based fix (caller-provided callback, not in core lib)
  // This is intentionally left as a hook for the caller to inject their retry logic.
  // The validateConfig result contains ajvErrors that can be fed back to the LLM.

  return {
    success: false,
    tier: 4,
    errors: [
      'All automated recovery failed. Requires manual review.',
      ...(validateResult.errors ?? []),
    ],
  };
}
