/**
 * AuthToken value object — represents an issued access token payload
 *
 * Immutable VO. Contains decoded JWT claims used after signature verification.
 * BR-ID-002: JWT stored encrypted on client side; never persisted in plaintext.
 *
 * @traceability DOC-012 VO JWTToken → PG-Schema Table 5 → ITS-V1 JWT short-lived strategy
 */

export class AuthToken {
  readonly rawToken: string;
  readonly userId: string;
  readonly orgId: string;
  readonly role: string;
  readonly expiresAt: Date;
  readonly issuedAt: Date;
  readonly tokenId: string;
  private readonly _claims: Record<string, unknown>;

  private constructor(params: {
    rawToken: string;
    userId: string;
    orgId: string;
    role: string;
    expiresAt: Date;
    issuedAt: Date;
    tokenId: string;
    claims?: Record<string, unknown>;
  }) {
    this.rawToken = params.rawToken;
    this.userId = params.userId;
    this.orgId = params.orgId;
    this.role = params.role;
    this.expiresAt = params.expiresAt;
    this.issuedAt = params.issuedAt;
    this.tokenId = params.tokenId;
    this._claims = params.claims ?? {};
  }

  /** Check if token has expired. */
  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  /** Get remaining TTL in ms. */
  ttlMs(): number {
    return Math.max(0, this.expiresAt.getTime() - Date.now());
  }

  /** Return a redacted representation for logging. */
  toString(): string {
    return `[${this.constructor.name} userId=${this.userId} exp=${this.expiresAt.toISOString()}]`;
  }

  static create(params: {
    rawToken: string;
    userId: string;
    orgId: string;
    role: string;
    expiresInMs: number;
    tokenId: string;
  }): AuthToken {
    const now = new Date();
    return new AuthToken({
      ...params,
      expiresAt: new Date(now.getTime() + params.expiresInMs),
      issuedAt: now,
    });
  }
}
