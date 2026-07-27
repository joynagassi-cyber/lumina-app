/**
 * JWT Policy — enforces JWT token lifecycle rules per ITS-V1
 *
 * Rules:
 * - Access tokens: short-lived, max 15 minutes
 * - Refresh tokens: long-lived, max 7 days
 * - Rotation on every refresh use
 * - Revocation on logout
 *
 * @traceability DOC-012 IdentityAggregate Policies → ITS-V1 JWT strategy
 *   → API-CONTRACT-002 LoginUser / RefreshAccessToken contracts
 */

const ACCESS_TOKEN_MAX_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_DEFAULT_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;

export interface JwtPolicyParams {
  accessTokenExpiresInMs?: number;
  refreshTokenExpiresInMs?: number;
  maximumAccessTtlMs?: number;
  maximumRefreshTtlMs?: number;
}

export class JwtPolicy {
  private readonly _accessTtl: number;
  private readonly _refreshTtl: number;
  private readonly _maxAccessTtl: number;
  private readonly _maxRefreshTtl: number;

  constructor(params: JwtPolicyParams = {}) {
    const accessTtl = params.accessTokenExpiresInMs ?? ACCESS_TOKEN_DEFAULT_MS;
    const refreshTtl = params.refreshTokenExpiresInMs ?? REFRESH_TOKEN_DEFAULT_MS;

    this._maxAccessTtl = params.maximumAccessTtlMs ?? ACCESS_TOKEN_MAX_MS;
    this._maxRefreshTtl = params.maximumRefreshTtlMs ?? REFRESH_TOKEN_MAX_MS;

    if (accessTtl > this._maxAccessTtl) {
      throw new Error(
        `Access token TTL ${accessTtl}ms exceeds maximum ${this._maxAccessTtl}ms`,
      );
    }
    if (refreshTtl > this._maxRefreshTtl) {
      throw new Error(
        `Refresh token TTL ${refreshTtl}ms exceeds maximum ${this._maxRefreshTtl}ms`,
      );
    }

    this._accessTtl = accessTtl;
    this._refreshTtl = refreshTtl;
  }

  get accessTtlMs(): number { return this._accessTtl; }
  get refreshTtlMs(): number { return this._refreshTtl; }
  get maxAccessTtlMs(): number { return this._maxAccessTtl; }
  get maxRefreshTtlMs(): number { return this._maxRefreshTtl; }

  /** Validate that the requested access token TTL does not exceed policy limits. */
  validateAccessTtl(ttlMs: number): void {
    if (ttlMs <= 0) {
      throw new Error('Access token TTL must be positive');
    }
    if (ttlMs > this._maxAccessTtl) {
      throw new Error(
        `Requested access TTL ${ttlMs}ms exceeds maximum ${this._maxAccessTtl}ms`,
      );
    }
  }

  /** Validate that the requested refresh token TTL does not exceed policy limits. */
  validateRefreshTtl(ttlMs: number): void {
    if (ttlMs <= 0) {
      throw new Error('Refresh token TTL must be positive');
    }
    if (ttlMs > this._maxRefreshTtl) {
      throw new Error(
        `Requested refresh TTL ${ttlMs}ms exceeds maximum ${this._maxRefreshTtl}ms`,
      );
    }
  }
}

export const DEFAULT_JWT_POLICY = new JwtPolicy();
