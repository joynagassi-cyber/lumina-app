/**
 * StabilityPolicy — Vocabulary Aggregate
 *
 * Keys are stable forever. Once assigned, a term key or value key cannot change.
 * Only labels (display text) may evolve over time.
 *
 * BR-VOC-003: Keys stable forever, labels may evolve.
 *
 * @traceability DOC-012 Aggregate8 §Policies-Stability
 *   → POSTGRESQL-SCHEMA-PACK-v1 vocab_terms.cle_term NOT NULL (immutable logical)
 *                     vocab_values.cle_valeur NOT NULL (immutable logical)
 */

export class KeyChangeForbiddenError extends Error {
  constructor(entityType: string, entityId: string) {
    super(
      `Key change is forbidden for ${entityType} (id: ${entityId}). ` +
      'Keys are stable forever per BR-VOC-003.',
    );
    this.name = 'KeyChangeForbiddenError';
  }
}

export class StabilityPolicy {
  /**
   * Validates that the proposed new key matches the existing key.
   * Throws if any attempt to change a key is detected.
   */
  static assertKeyStable(
    entityType: 'term' | 'value',
    existingKey: string,
    proposedKey: string,
    entityId?: string,
  ): void {
    if (existingKey !== proposedKey) {
      const idPart = entityId ? ` (id: ${entityId})` : '';
      throw new KeyChangeForbiddenError(
        `${entityType}${idPart}`,
      );
    }
  }

  /**
   * Returns true if a key conforms to the stable-key format.
   * Keys must be lowercase alphanumeric with hyphens/underscores only.
   */
  static validateKeyFormat(key: string): boolean {
    if (!key || key.length > 255) return false;
    return /^[a-z0-9_-]+$/.test(key);
  }

  /**
   * Creates an audit record indicating a label-only update.
   * Labels are allowed to evolve; keys are not.
   */
  static recordLabelUpdate(
    entityType: 'term' | 'value',
    entityId: string,
    oldLabelFr: string,
    newLabelFr: string,
    oldLabelEn: string,
    newLabelEn: string,
  ): Record<string, unknown> {
    return {
      action: 'label_update',
      entity_type: entityType,
      entity_id: entityId,
      old_label_fr: oldLabelFr,
      new_label_fr: newLabelFr,
      old_label_en: oldLabelEn,
      new_label_en: newLabelEn,
      key_unchanged: true,
    };
  }
}
