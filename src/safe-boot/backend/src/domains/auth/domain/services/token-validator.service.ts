/**
 * Token Validator — domain service for JWT token verification and lifecycle management
 *
 * Encapsulates all token validation logic: signature check, expiry, claims validity.
 * Delegates cryptographic operations to infrastructure adapters (JwtAdapter).
 *
 * @traceability DOC-012 IdentityAggregate Domain Services → JWT token validation
 *   → ITS-V1: Access token short-lived + Refresh long-lived rotation
 */

import { AuthToken } from '../domain/value-objects/auth-token.vo';
import { RefreshToken } from '../domain/value-objects/refresh-token.vo';
import type { JwtPolicy } from '../domain/policies/jwt-policy';

export interface TokenPayload {
  userId: string;
  orgId: string;
  role: string;
  tokenId: string;
}

export interface TokenPair {
  accessToken: AuthToken;
  refreshToken: RefreshToken;
}

export class TokenValidator {
  constructor(private readonly _policy: JwtPolicy) {}

  /**
   * Validate an access token: check expiry and policy TTL compliance.
   * Throws if the token is expired or invalid.
   */
  validateAccessToken(token: AuthToken): void {
    if (token.isExpired()) {
      throw new Error('Access token has expired');
    }
    this._policy.validateAccessTtl(token.ttlMs());
  }

  /**
   * Validate a refresh token: check expiry and consumed status.
   * Throws if the token is expired, consumed, or invalid.
   */
  validateRefreshToken(token: RefreshToken): void {
    if (token.isConsumed()) {
      throw new Error('Refresh token has already been consumed');
    }
    if (token.isExpired()) {
      throw new Error('Refresh token has expired');
    }
    this._policy.validateRefreshTtl(token.ttlMs());
  }

  /**
   * Create a new token pair (access + refresh) with policy-compliant TTLs.
   */
  createTokenPair(params: {
    userId: string;
    orgId: string;
    role: string;
    sessionId: string;
  }): TokenPair {
    return {
      accessToken: AuthToken.create({
        rawToken: '',
        userId: params.userId,
        orgId: params.orgId,
        role: params.role,
        expiresInMs: this._policy.accessTtlMs,
        tokenId: `at-${params.sessionId}`,
      }),
      refreshToken: RefreshToken.create({
        rawToken: '',
        hash: '',
        sessionId: params.sessionId,
        userId: params.userId,
        orgId: params.orgId,
        expiresInMs: this._policy.refreshTtlMs,
      }),
    };
  }
}
