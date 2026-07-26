/**
 * PermissionGrant value object — RBAC resource:action:level format
 *
 * Immutable VO. Represents a granular permission grant tied to a user's role.
 * BR-ID-006: wildcard permissions ["*"] are audited but authorized.
 *
 * @traceability DOC-012 VO PermissionGrant
 */

export class PermissionGrant {
  readonly resource: string;
  readonly action: string;
  readonly level: string;

  constructor(resource: string, action: string, level: string) {
    this.resource = resource.toLowerCase();
    this.action = action.toLowerCase();
    this.level = level.toLowerCase();
  }

  /** Check if this grant is a full wildcard. */
  isFullWildcard(): boolean {
    return this.resource === '*' && this.action === '*' && this.level === '*';
  }

  /** Check if this grant matches a specific resource/action/level. */
  matches(resource: string, action: string, level: string): boolean {
    const matchesResource = this.resource === '*' || this.resource === resource;
    const matchesAction = this.action === '*' || this.action === action;
    const matchesLevel = this.level === '*' || this.level === level;
    return matchesResource && matchesAction && matchesLevel;
  }

  toString(): string {
    return `${this.resource}:${this.action}:${this.level}`;
  }

  static create(permissionString: string): PermissionGrant {
    const parts = permissionString.split(':');
    if (parts.length !== 3) {
      throw new Error(`Invalid PermissionGrant format: "${permissionString}". Expected "resource:action:level"`);
    }
    const [resource, action, level] = parts;
    return new PermissionGrant(resource, action, level);
  }
}
