/**
 * RefreshToken value object — long-lived token used for rotation
 *
 * Immutable VO. The token VALUE is never stored. Only its cryptographic hash
 * is persisted in the sessions table (hachage_refresh_token column).
 *
 * BR-ID-002: JWT stored encrypted (expo-secure-store / httpOnly cookie).
 * ITS-V1: Refresh tokens are long-lived and rotated on each use.
 *
 * @traceability DOC-012 VO SessionContext.refreshTokenHash → PG-Schema Table 5 hachage_refresh_token
 *   → API-CONTRACT-002 RefreshAccessToken contract
 */

export class RefreshToken {
  readonly rawToken: string;
  readonly hash: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly orgId: string;
  readonly expiresAt: Date;
  readonly issuedAt: Date;
  readonly consumedAt?: Date | null;

  private constructor(params: {
    rawToken: string;
    hash: string;
    sessionId: string;
    userId: string;
    orgId: string;
    expiresAt: Date;
    issuedAt: Date;
    consumedAt?: Date | null;
  }) {
    this.rawToken = params.rawToken;
    this.hash = params.hash;
    this.sessionId = params.sessionId;
    this.userId = params.userId;
    this.orgId = params.orgId;
    this.expiresAt = params.expiresAt;
    this.issuedAt = params.issuedAt;
    this.consumedAt = params.consumedAt;
  }

  /** Check if refresh token has expired. */
  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  /** Check if this token has already been consumed (rotated). */
  isConsumed(): boolean {
    return !!this.consumedAt;
  }

  toString(): string {
    return `[${this.constructor.name} REDACTED]`;
  }

  static create(params: {
    rawToken: string;
    hash: string;
    sessionId: string;
    userId: string;
    orgId: string;
    expiresInMs: number;
  }): RefreshToken {
    const now = new Date();
    return new RefreshToken({
      ...params,
      expiresAt: new Date(now.getTime() + params.expiresInMs),
      issuedAt: now,
    });
  }
}
