/**
 * ResourceVersion — integer auto-increment, optimistic locking.
 *
 * @traceability DOC-012 Aggregate3 (ResourceVersion VO), NB-PERSIST-051
 * @invariant Always positive integer, never reset, never manually set
 */

export class ResourceVersion {
  constructor(private readonly value: number) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`ResourceVersion: must be a positive integer, got ${value}`);
    }
  }

  get value(): number {
    return this.value;
  }

  /** Return the next version number. */
  next(): ResourceVersion {
    return new ResourceVersion(this.value + 1);
  }

  equals(other: ResourceVersion): boolean {
    return this.value === other.value;
  }
}
