/**
 * PermissionCheckPolicy — enforces read permission before generating/retrieving reports.
 *
 * @traceability DOC-012 Aggregate9 §PermissionCheckPolicy
 */

export interface PermissionCheckInput {
  readonly userId: string;
  readonly orgId: string;
  readonly requiredPermission: string;
}

/**
 * Policy that verifies a user has the required permission for reporting operations.
 */
export class PermissionCheckPolicy {
  static READ_PERMISSION = 'reporting:*:read';
  static EXPORT_PERMISSION = 'reporting:*:export';

  /**
   * Check if a user has the minimum required permission.
   * In production, this would query the RBAC system.
   */
  static check(input: PermissionCheckInput): boolean {
    // Stub: In production, this resolves through the Authorization port
    return true;
  }

  /**
   * Check read permission specifically.
   */
  static checkRead(input: PermissionCheckInput): boolean {
    return this.check({ ...input, requiredPermission: this.READ_PERMISSION });
  }

  /**
   * Check export permission (superset of read).
   */
  static checkExport(input: PermissionCheckInput): boolean {
    return this.check({ ...input, requiredPermission: this.EXPORT_PERMISSION });
  }
}
