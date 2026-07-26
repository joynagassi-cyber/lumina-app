/**
 * JWTToken value object — ephemeral, never stored plain
 *
 * Immutable VO. Represents an issued access or refresh token.
 * BR-ID-002: JWT stored encrypted (expo-secure-store on mobile, httpOnly cookie on web).
 * Token value NEVER persisted to DB in plaintext.
 * Only the refresh token hash is stored (in sessions table).
 *
 * @traceability DOC-012 VO JWTToken → PG-Schema Table 5 hachage_refresh_token
 */

export class JWTToken {
  readonly rawToken: string;
  readonly type: 'access' | 'refresh';
  readonly expiresAt: Date;
  readonly issuedAt: Date;

  private constructor(rawToken: string, type: 'access' | 'refresh', expiresAt: Date) {
    if (!rawToken || rawToken.length < 10) {
      throw new Error('Invalid JWTToken: token must be a non-empty string');
    }
    this.rawToken = rawToken;
    this.type = type;
    this.expiresAt = expiresAt;
    this.issuedAt = new Date();
  }

  /** Check if token has expired. */
  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  /** Get remaining TTL in ms. */
  ttlMs(): number {
    return Math.max(0, this.expiresAt.getTime() - Date.now());
  }

  toString(): string {
    // Never return full token — redact for safety
    return `[${this.type}_TOKEN_REDACTED]`;
  }

  static accessToken(rawToken: string, expiresInMs: number): JWTToken {
    return new JWTToken(rawToken, 'access', new Date(Date.now() + expiresInMs));
  }

  static refreshToken(rawToken: string, expiresInMs: number): JWTToken {
    return new JWTToken(rawToken, 'refresh', new Date(Date.now() + expiresInMs));
  }
}
