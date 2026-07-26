/**
 * TagCollection — a set of tags for searching/filtering archives.
 *
 * @traceability DOC-012 Aggregate11 §VO-TagCollection
 *   → POSTGRESQL-SCHEMA-PACK-v1 archives.tags text[]
 *   → BR-LIF-004: Tags + categories for flexible organization
 */

export interface TagCollectionProps {
  readonly tags: string[];
}

/**
 * Immutable value object representing a deduplicated, sorted tag collection.
 */
export class TagCollection {
  private readonly _tags: ReadonlySet<string>;

  constructor(tags?: string[]) {
    const deduped = new Set<string>();
    (tags ?? []).forEach((t) => {
      const trimmed = t.trim().toLowerCase();
      if (trimmed.length > 0) {
        deduped.add(trimmed);
      }
    });
    this._tags = Object.freeze(deduped);
  }

  /** Returns all tags as a sorted array. */
  get tags(): string[] {
    return Array.from(this._tags).sort();
  }

  get size(): number {
    return this._tags.size;
  }

  has(tag: string): boolean {
    return this._tags.has(tag.trim().toLowerCase());
  }

  add(tag: string): TagCollection {
    const next = new Set<string>(this._tags);
    next.add(tag.trim().toLowerCase());
    return new TagCollection(Array.from(next));
  }

  remove(tag: string): TagCollection {
    const filtered = Array.from(this._tags).filter(
      (t) => t !== tag.trim().toLowerCase(),
    );
    return new TagCollection(filtered);
  }

  /** Merge another TagCollection into a new one. */
  union(other: TagCollection): TagCollection {
    const merged = new Set<string>(this._tags);
    other._tags.forEach((t) => merged.add(t));
    return new TagCollection(Array.from(merged));
  }

  intersects(other: TagCollection): boolean {
    for (const tag of this._tags) {
      if (other._tags.has(tag)) return true;
    }
    return false;
  }

  public toString(): string {
    return `[${this.tags.join(', ')}]`;
  }
}
