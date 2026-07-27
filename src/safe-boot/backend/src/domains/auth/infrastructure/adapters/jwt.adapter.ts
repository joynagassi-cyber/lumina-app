/**
 * JWT Infrastructure Adapter — handles token signing, verification, and payload extraction
 *
 * Implements IJwtServicePort interface for cryptographic token operations.
 * Uses @nestjs/jwt for JWS compliance (RFC 7519).
 *
 * @traceability DOC-012 IdentityAggregate VO JWTToken → ITS-V1 JWS short-lived strategy
 */

import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';

export interface JwtSignPayload {
  userId: string;
  orgId: string;
  role: string;
  tokenId: string;
}

export interface JwtVerifyPayload {
  userId: string;
  orgId: string;
  role: string;
  tokenId: string;
  exp: number;
  iat: number;
}

export interface IJwtServicePort {
  /** Sign a new access token with claims. Returns raw JWS string. */
  signAccessToken(payload: JwtSignPayload): Promise<string>;

  /** Sign a new refresh token with claims. Returns raw JWS string. */
  signRefreshToken(payload: JwtSignPayload): Promise<string>;

  /** Verify and decode an access token. Throws on invalid/expired tokens. */
  verifyAccessToken(token: string): Promise<JwtVerifyPayload>;

  /** Verify and decode a refresh token. Throws on invalid/expired tokens. */
  verifyRefreshToken(token: string): Promise<JwtVerifyPayload>;

  /** Extract user claims from token without full verification (for middleware). */
  extractTokenId(token: string): string | null;
}

@Injectable()
export class JwtAdapter implements IJwtServicePort {
  constructor(private readonly _nestJwt: NestJwtService) {}

  async signAccessToken(payload: JwtSignPayload): Promise<string> {
    return this._nestJwt.signAsync(
      { sub: payload.userId, orgId: payload.orgId, role: payload.role, jti: payload.tokenId },
      { expiresIn: '15m', secret: process.env.JWT_SECRET },
    );
  }

  async signRefreshToken(payload: JwtSignPayload): Promise<string> {
    return this._nestJwt.signAsync(
      { sub: payload.userId, orgId: payload.orgId, role: payload.role, jti: payload.tokenId },
      { expiresIn: '7d', secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET },
    );
  }

  async verifyAccessToken(token: string): Promise<JwtVerifyPayload> {
    const payload = await this._nestJwt.verifyAsync(token, {
      secret: process.env.JWT_SECRET,
    });
    return this._toVerifyPayload(payload);
  }

  async verifyRefreshToken(token: string): Promise<JwtVerifyPayload> {
    const payload = await this._nestJwt.verifyAsync(token, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    });
    return this._toVerifyPayload(payload);
  }

  extractTokenId(token: string): string | null {
    try {
      const decoded = this._nestJwt.decode(token) as Record<string, unknown> | null;
      if (!decoded) return null;
      return (decoded.jti as string) ?? null;
    } catch {
      return null;
    }
  }

  private _toVerifyPayload(raw: Record<string, unknown>): JwtVerifyPayload {
    return {
      userId: String(raw.sub ?? ''),
      orgId: String(raw.orgId ?? ''),
      role: String(raw.role ?? ''),
      tokenId: String(raw.jti ?? ''),
      exp: typeof raw.exp === 'number' ? raw.exp : 0,
      iat: typeof raw.iat === 'number' ? raw.iat : 0,
    };
  }
}
