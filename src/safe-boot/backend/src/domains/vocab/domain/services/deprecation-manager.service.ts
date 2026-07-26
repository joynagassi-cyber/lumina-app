/**
 * DeprecationManager Domain Service
 *
 * Handles deprecation of terms and term values per NeverDeletePolicy.
 * BR-VOC-001: Values are never deleted, only deprecated.
 * Deprecation is IRREVERSIBLE.
 *
 * @traceability DOC-012 Aggregate8 §DomainServices-DeprecationManager
 *   → BR-VOC-001 (NeverDeletePolicy — irreversible)
 */

import type { Term } from '../entities/term.entity';
import type { TermValue } from '../entities/term-value.entity';

export interface DeprecationResult {
  entityId: string;
  entityType: 'term' | 'value';
  key: string;
  deprecatedAt: Date;
}

export class DeprecationManager {
  /**
   * Deprecate a term. Checks that it is not already deprecated.
   * Returns the deprecation result for event publishing.
   */
  deprecateTerm(term: Term, deprecatedAt: Date = new Date()): DeprecationResult {
    if (term.isDeprecated) {
      throw new AlreadyDeprecatedError('Term is already deprecated. Deprecation is irreversible.');
    }

    term.deprecate(deprecatedAt);

    return {
      entityId: term.id,
      entityType: 'term',
      key: term.key,
      deprecatedAt,
    };
  }

  /**
   * Deprecate a term value. Checks that it is not already deprecated.
   * Returns the deprecation result for event publishing.
   */
  deprecateTermValue(
    value: TermValue,
    deprecatedAt: Date = new Date(),
  ): DeprecationResult {
    if (value.isDeprecated) {
      throw new AlreadyDeprecatedError('TermValue is already deprecated. Deprecation is irreversible.');
    }

    value.deprecate(deprecatedAt);

    return {
      entityId: value.id,
      entityType: 'value',
      key: value.key,
      deprecatedAt,
    };
  }

  /**
   * Bulk-deprecate multiple term values at once.
   * Returns results for all successfully deprecated items.
   */
  bulkDeprecateValues(
    values: TermValue[],
    deprecatedAt: Date = new Date(),
  ): DeprecationResult[] {
    return values.map((v) => this.deprecateTermValue(v, deprecatedAt));
  }

  /**
   * Pre-check whether an entity can be deprecated (for UI confirmation dialogs).
   */
  canDeprecate(isAlreadyDeprecated: boolean): boolean {
    return !isAlreadyDeprecated;
  }
}

export class AlreadyDeprecatedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlreadyDeprecatedError';
  }
}
