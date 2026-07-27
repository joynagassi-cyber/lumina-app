/**
 * Session Manager — domain service for session lifecycle operations
 *
 * Orchestrates session creation, revocation, and expiration tracking.
 * Applies session policy constraints (max concurrent sessions).
 *
 * @traceability DOC-012 IdentityAggregate BR-ID-003 → Session lifecycle active/expired/revoked
 *   → PG-Schema Table 5 (sessions)
 *   → API-CONTRACT-002 LogoutUser / RevokeSession contracts
 */

import { AuthSession } from '../entities/auth-session.entity';
import { DEFAULT_SESSION_POLICY, type SessionPolicy, type SessionPolicyParams } from '../policies/session-policy';

export interface ActiveSessionCount {
  count: number;
}

export class SessionManager {
  private readonly _policy: SessionPolicy;

  constructor(policy?: SessionPolicy) {
    this._policy = policy ?? DEFAULT_SESSION_POLICY;
  }

  /**
   * Validate that session creation is allowed under current concurrency limits.
   */
  canCreateSession(userId: string, currentActiveCount: number): boolean {
    this._policy.validateOrgId(userId);
    return this._policy.canCreateSession(currentActiveCount);
  }

  /**
   * Create a new session for the given user within the specified org.
   */
  create(params: {
    userId: string;
    orgId: string;
    refreshTokenHash: string;
    deviceInfo: Record<string, unknown>;
  }): AuthSession {
    this._policy.validateDeviceInfo(params.deviceInfo);
    this._policy.validateOrgId(params.orgId);

    return AuthSession.create({
      userId: params.userId,
      orgId: params.orgId,
      refreshTokenHash: params.refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: params.deviceInfo,
    });
  }

  /**
   * Revoke a session by ID. Returns the revoked session or null.
   */
  revoke(session: AuthSession, revokedBy: string): AuthSession | null {
    try {
      session.revoke(revokedBy);
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Revoke all active sessions for a given user.
   */
  revokeAllForUser(
    sessions: AuthSession[],
    revokedBy: string,
  ): AuthSession[] {
    const revoked: AuthSession[] = [];
    for (const session of sessions) {
      if (session.isActive && !session.revokedAt) {
        try {
          session.revoke(revokedBy);
          revoked.push(session);
        } catch {
          // Skip already-revoked sessions silently
        }
      }
    }
    return revoked;
  }
}
