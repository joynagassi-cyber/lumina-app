/**
 * ArchiveType — configurable archivable type from manifest lifecycle.types[].
 *
 * @traceability DOC-012 Aggregate11 §BR-LIF-001 (configurable per org via manifest)
 */

export type ResourceOriginalType = 'transaction' | 'member' | 'event' | 'archive_entry';

const KNOWN_RESOURCE_TYPES: ReadonlySet<ResourceOriginalType> = new Set([
  'transaction',
  'member',
  'event',
  'archive_entry',
]);

export interface ArchiveTypeProps {
  readonly key: string;
  readonly resourceType: ResourceOriginalType;
}

/**
 * Value object representing a configurable archive type.
 * The `key` is the org-level manifest string; `resourceType` maps to the FK target.
 */
export class ArchiveType {
  private constructor(
    public readonly key: string,
    public readonly resourceType: ResourceOriginalType,
  ) {}

  static create(key: string, resourceType: ResourceOriginalType): ArchiveType {
    if (!KNOWN_RESOURCE_TYPES.has(resourceType)) {
      throw new InvalidArchiveTypeError(
        `Unknown resource type "${resourceType}". Must be one of: ${Array.from(KNOWN_RESOURCE_TYPES).join(', ')}.`,
      );
    }
    return new ArchiveType(key, resourceType);
  }

  matchesResourceType(expected: ResourceOriginalType): boolean {
    return this.resourceType === expected;
  }

  public toString(): string {
    return `${this.key} (${this.resourceType})`;
  }
}

/**
 * Error thrown when an invalid archive type is specified.
 */
export class InvalidArchiveTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArchiveTypeError';
  }
}
