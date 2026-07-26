/**
 * NeverDeletePolicy — Vocabulary Aggregate
 *
 * Values (TermValue and Term) are NEVER deleted from the system.
 * They can only be transitioned to a deprecated state where they remain
 * visible for referential integrity but hidden from new UI selections.
 *
 * BR-VOC-001: Values never deleted (only deprecated).
 *
 * @traceability DOC-012 Aggregate8 §Policies-NeverDelete
 *   → POSTGRESQL-SCHEMA-PACK-v1 vocab_values / vocab_terms (soft deprecation)
 */

export class DeleteForbiddenError extends Error {
  constructor(entityType: string, entityId: string) {
    super(
      `Delete is forbidden for ${entityType} (id: ${entityId}). Values are never deleted, only deprecated per BR-VOC-001.`,
    );
    this.name = 'DeleteForbiddenError';
  }
}

/**
 * Enforces that delete operations throw in favor of deprecation.
 */
export class NeverDeletePolicy {
  /**
   * Validates that no hard delete is attempted. Throws if a delete operation
   * is requested instead of deprecation.
   */
  static assertNoDelete(entityType: string, entityId: string): void {
    throw new DeleteForbiddenError(entityType, entityId);
  }

  /**
   * Records that an entity was deprecated rather than deleted,
   * for audit tracking purposes.
   */
  static recordDeprecation(
    entityType: string,
    entityId: string,
    orgId: string,
    actorId: string,
  ): Record<string, unknown> {
    return {
      action: 'deprecate',
      entity_type: entityType,
      entity_id: entityId,
      org_id: orgId,
      actor_id: actorId,
      reason: 'NeverDeletePolicy — DELETED replaced with deprecated',
    };
  }
}
