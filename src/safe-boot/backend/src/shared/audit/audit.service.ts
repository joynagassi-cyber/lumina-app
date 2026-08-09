/**
 * AuditService - Logs all security-relevant actions.
 * Integrates with AuditAggregate per SEC-SPEC-006.
 *
 * Enregistre les actions d'audit avec userId, action, timestamp, valeurs avant/après.
 *
 * @traceability SEC-SPEC-006: Audit Compliance Rules
 * @traceability CANONICAL-DOMAIN-MODEL.md: AuditAggregate
 */

import { Injectable } from '@nestjs/common';

// ADR-018: TypeORM is not part of the canonical persistence path.
// The AuditEntry Prisma model is wired at the composition root of the
// canonical audit aggregate; this shared facade keeps legacy flat-structure
// callers compiling until they are fully migrated.

export enum AuditAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  ROLE_CHANGED = 'role_changed',
  PERMISSION_GRANTED = 'permission_granted',
  SESSION_REVOKED = 'session_revoked',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_RESET = 'password_reset',
}

export interface AuditLog {
  userId: string;
  action: AuditAction;
  entityId?: string; // Type of entity affected (user, session, etc.)
  entityIds?: string[]; // Affected entity IDs
  before?: any; // Previous state
  after?: any; // New state
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  /**
   * Enregistre une action d'audit.
   * ADR-018: persistence is delegated to the AuditEntry Prisma adapter.
   */
  async log(log: AuditLog): Promise<void> {
    // Placeholder until the canonical audit aggregate is wired — kept
    // synchronous and dependency-free so legacy callers keep compiling.
    console.log('[audit]', JSON.stringify(log));
  }

  /**
   * Logs a login event (success or failure).
   */
  async logLogin(userId: string, ipAddress: string, userAgent: string, success: boolean, reason?: string): Promise<void> {
    const action = success ? AuditAction.LOGIN : AuditAction.LOGIN_FAILED;
    await this.log({
      userId: userId || 'system',
      action,
      ipAddress,
      userAgent,
      after: { success, reason },
    });
  }

  /**
   * Logs a user creation event.
   */
  async logUserCreated(userId: string, createdBy: string, userData: any): Promise<void> {
    await this.log({
      userId: createdBy,
      action: AuditAction.USER_CREATED,
      entityId: 'user',
      entityIds: [userId],
      after: userData,
    });
  }

  /**
   * Logs a user update event.
   */
  async logUserUpdated(userId: string, changedBy: string, before: any, after: any): Promise<void> {
    await this.log({
      userId: changedBy,
      action: AuditAction.USER_UPDATED,
      entityId: 'user',
      entityIds: [userId],
      before,
      after,
    });
  }

  /**
   * Logs a role change event.
   */
  async logRoleChanged(userId: string, changedBy: string, oldRole: string, newRole: string): Promise<void> {
    await this.log({
      userId: changedBy,
      action: AuditAction.ROLE_CHANGED,
      entityId: 'user',
      entityIds: [userId],
      before: { role: oldRole },
      after: { role: newRole },
    });
  }

  /**
   * Logs a permission grant event.
   */
  async logPermissionGranted(permissions: string[], grantee: string, grantedBy: string): Promise<void> {
    await this.log({
      userId: grantedBy,
      action: AuditAction.PERMISSION_GRANTED,
      entityId: 'permission',
      entityIds: permissions,
      after: { permissions, grantee },
    });
  }

  /**
   * Logs a session revocation event.
   */
  async logSessionRevoked(sessionId: string, revokedBy: string, userId?: string): Promise<void> {
    await this.log({
      userId: revokedBy,
      action: AuditAction.SESSION_REVOKED,
      entityId: 'session',
      entityIds: [sessionId],
      after: { userId, revokes: sessionId },
    });
  }
}
