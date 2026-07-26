/**
 * ResourceId — UUID string value object for ResourceAggregate identities.
 *
 * @traceability DOC-012 Aggregate3 (ResourceId), DOC-021 §3 (all resource tables)
 * @invariant  String must be valid UUID v4 format
 */

export class ResourceId {
  private static readonly UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(public readonly value: string) {
    if (!this.constructor.isValid(value)) {
      throw new Error(`ResourceId: invalid UUID format — "${value}"`);
    }
  }

  static isValid(input: string): boolean {
    return this.UUID_V4_REGEX.test(input);
  }

  static generate(): ResourceId {
    return new ResourceId(crypto.randomUUID());
  }

  equals(other: ResourceId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
