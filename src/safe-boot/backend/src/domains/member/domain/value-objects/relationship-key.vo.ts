/**
 * RelationshipKey — Value Object
 * Composite key identifying a unique relationship between two entities.
 * Order is (source_entity_id, target_entity_id, relationship_type) — immutable per NB-ID-004.
 * @traceability DOC-023 §2.4 (Identifiants composés), DOC-012 §Aggregate 4
 */

import { RelationshipType } from './relationship-type.vo';

export class RelationshipKey {
  constructor(
    public readonly sourceEntityId: string,
    public readonly targetEntityId: string,
    public readonly type: RelationshipType,
  ) {
    if (!sourceEntityId || !targetEntityId) {
      throw new TypeError('RelationshipKey components must be non-empty strings');
    }
  }

  /**
   * Returns a deterministic composite string for indexing / hashing.
   */
  toCompositeString(): string {
    return [this.sourceEntityId, this.targetEntityId, this.type].join('|');
  }

  /**
   * Checks equality with another RelationshipKey.
   */
  equals(other: RelationshipKey): boolean {
    return (
      this.sourceEntityId === other.sourceEntityId &&
      this.targetEntityId === other.targetEntityId &&
      this.type === other.type
    );
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    const str = this.toCompositeString();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash;
  }

  toString(): string {
    return this.toCompositeString();
  }
}
