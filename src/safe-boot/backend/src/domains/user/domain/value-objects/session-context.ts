/**
 * SessionContext value object — session management aggregate root VO
 *
 * Immutable VO. Bundles all session-related state for a User's login session.
 * Maps to sessions table columns: refresh_token_hash, expires_at, is_active, device_info
 *
 * @traceability DOC-012 VO SessionContext → PG-Schema Table 5
 */

export class SessionContext {
  readonly refreshTokenHash: string;
  readonly expiresAt: Date;
  readonly isActive: boolean;
  readonly deviceInfo: Record<string, unknown>;
  readonly createdAt: Date;
  readonly revokedAt?: Date | null;

  constructor(params: {
    refreshTokenHash: string;
    expiresAt: Date;
    deviceInfo: Record<string, unknown>;
    createdAt?: Date;
    revokedAt?: Date | null;
  }) {
    this.refreshTokenHash = params.refreshTokenHash;
    this.expiresAt = params.expiresAt;
    this.isActive = params.isActive ?? true;
    this.deviceInfo = params.deviceInfo;
    this.createdAt = params.createdAt ?? new Date();
    this.revokedAt = params.revokedAt;
  }

  /** Check if session has expired based on expiration date. */
  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  /** Check if session is currently active (not expired and not revoked). */
  isActiveSession(): boolean {
    return this.isActive && !this.isExpired() && !this.revokedAt;
  }

  static create(params: {
    refreshTokenHash: string;
    expiresAt: Date;
    deviceInfo: Record<string, unknown>;
  }): SessionContext {
    return new SessionContext({ ...params, isActive: true });
  }
}
