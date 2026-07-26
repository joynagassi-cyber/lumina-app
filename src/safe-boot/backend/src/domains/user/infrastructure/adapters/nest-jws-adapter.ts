/**
 * JWT Service adapter — @nestjs/jwt wrapper for token management
 *
 * Implements IJwtServicePort. Uses @nestjs/jwt (jjwt) for JSON Web Token
 * signing and verification. Tokens are ephemeral — never stored in DB.
 * Only the refresh token hash is persisted (session table).
 *
 * BR-ID-002: JWTs are stored encrypted on client (expo-secure-store / httpOnly cookie).
 *
 * @traceability DOC-012 VO JWTToken → NestJS JWT module
 */

import { Injectable, Inject } from '@nestjs/common';
import type { JwtService as NestJwtService } from '@nestjs/jwt';
import type { IJwtServicePort } from '../../ports';
import type { JWTToken } from '../../domain/value-objects';

@Injectable()
export class NestJwsAdapter implements IJwtServicePort {
  constructor(
    @Inject('NEST_JWT_SERVICE') private readonly jwt: NestJwtService,
  ) {}

  signAccessToken(payload: Record<string, unknown>, expiresIn: string): JWTToken {
    const rawToken = this.jwt.sign(payload, { expiresIn });
    return JWTToken.accessToken(rawToken, this.parseExpiryMs(expiresIn));
  }

  async verifyAccessToken(token: string): Promise<Record<string, unknown>> {
    return this.jwt.verifyAsync(token);
  }

  signRefreshToken(payload: Record<string, unknown>, expiresIn: string): JWTToken {
    const rawToken = this.jwt.sign(payload, { expiresIn });
    return JWTToken.refreshToken(rawToken, this.parseExpiryMs(expiresIn));
  }

  async verifyRefreshToken(token: string): Promise<Record<string, unknown>> {
    return this.jwt.verifyAsync(token);
  }

  private parseExpiryMs(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)(ms|s|m|h|d)?$/);
    if (!match) return ACCESS_TOKEN_DEFAULT_MS;

    const [, valueStr, unit] = match;
    const value = parseInt(valueStr, 10);

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value * 60 * 1000;
    }
  }
}

const ACCESS_TOKEN_DEFAULT_MS = 15 * 60 * 1000;
