/**
 * CapabilityManifestPolicy — validates permissions against the capability manifest (BR-DEL-001).
 *
 * Rule: Cannot create new capabilities via delegation. Each permission must be
 * validated against the known capability manifest to ensure only existing
 * capabilities are delegated.
 *
 * @traceability BR-DEL-001 — Cannot create new capabilities via delegation
 */

import { CapabilityValidationError } from './delegation-errors';

/**
 * The capability manifest defines all valid resource:action:level combinations
 * that can be delegated. This is a system-wide policy that ensures no new
 * capabilities can be created through delegation.
 */
export class CapabilityManifest {
  /**
   * Valid capability patterns. In a real system, this would be loaded from
   * a configuration or database. The format is "resource:action:level".
   *
   * This manifest should be defined in the system configuration and cannot
 * be extended via delegation.
   */
  static readonly MANIFEST = new Set<string>([
    // Transaction capabilities
    'transaction:read:low',
    'transaction:write:medium',
    'transaction:approve:high',
    'transaction:delete:high',

    // Event capabilities
    'event:read:low',
    'event:write:medium',
    'event:approve:high',
    'event:delete:high',

    // Member capabilities
    'member:read:low',
    'member:write:medium',
    'member:approve:high',
    'member:delete:high',

    // Organization capabilities
    'org:read:low',
    'org:write:medium',
    'org:manage:high',

    // Group capabilities
    'group:read:low',
    'group:write:medium',
    'group:manage:high',

    // Vocab capabilities
    'vocab:read:low',
    'vocab:write:medium',

    // Form capabilities
    'form:read:low',
    'form:write:medium',
    'form:approve:high',

    // Report capabilities
    'report:read:low',
    'report:generate:medium',

    // Notification capabilities
    'notification:read:low',
    'notification:write:medium',

    // Archive capabilities
    'archive:read:low',
    'archive:write:medium',
    'archive:delete:high',

    // Audit capabilities
    'audit:read:low',

    // Delegation capabilities (limited)
    'delegation:read:low',
    'delegation:write:medium',
  ]);

  /**
   * Validate that a permission string exists in the capability manifest.
   * Throws CapabilityValidationError if the permission is not in the manifest.
   */
  static validatePermission(permission: string): void {
    if (!CapabilityManifest.MANIFEST.has(permission)) {
      throw new CapabilityValidationError(permission, `Permission "${permission}" is not in the capability manifest`);
    }
  }

  /**
   * Validate multiple permissions. Returns array of invalid permissions.
   */
  static validatePermissions(permissions: string[]): string[] {
    return permissions.filter(p => !CapabilityManifest.MANIFEST.has(p));
  }

  /** Check if all permissions are valid. */
  static isValid(permissions: string[]): boolean {
    return this.validatePermissions(permissions).length === 0;
  }
}