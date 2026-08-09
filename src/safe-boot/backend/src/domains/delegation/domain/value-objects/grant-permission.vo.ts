/**
 * GrantPermission — represents a permission in the format "resource:action:level".
 *
 * Examples: "transaction:write:high", "event:read:low", "member:delete:medium"
 *
 * The permission format is validated at creation time. Per BR-DEL-001, each
 * permission must be validated against the capability manifest to ensure
 * only existing capabilities are delegated.
 *
 * @traceability BR-DEL-001, DOC-012 DelegationAggregate → GrantPermission VO
 */

export class GrantPermission {
  /**
   * Parse a permission string into its components.
   * Format: resource:action:level
   */
  static parse(input: string): { resource: string; action: string; level: string } {
    const parts = input.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid permission format. Expected "resource:action:level"');
    }
    return {
      resource: parts[0].trim(),
      action: parts[1].trim(),
      level: parts[2].trim(),
    };
  }

  constructor(
    public readonly resource: string,
    public readonly action: string,
    public readonly level: string,
  ) {
    if (!resource || !action || !level) {
      throw new Error('Permission components cannot be empty');
    }
  }

  /** Create a GrantPermission from a string representation. */
  static create(permissionString: string): GrantPermission {
    const parsed = GrantPermission.parse(permissionString);
    return new GrantPermission(parsed.resource, parsed.action, parsed.level);
  }

  /** String representation: resource:action:level */
  toString(): string {
    return `${this.resource}:${this.action}:${this.level}`;
  }

  equals(other: GrantPermission): boolean {
    return (
      this.resource === other.resource &&
      this.action === other.action &&
      this.level === other.level
    );
  }
}