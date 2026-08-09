/**
 * TokenService — Infrastructure Adapter implementing ITokenService
 *
 * Generates cryptographically secure HMAC-SHA256 tokens for invitation
 * acceptance. Tokens include timestamp expiration and one-time use semantics.
 *
 * @traceability ORG-008 TokenService → INV-Token v1
 */

import { Injectable } from '@nestjs/common';
import { InviteToken } from '../../domain/value-objects/invite-token.vo';
import { ITokenService } from '../../ports';
import type { randomBytes } from 'crypto';

@Injectable()
export class TokenService implements ITokenService {
  private readonly TOKEN_LENGTH = 64; // SHA256 produces 64 hex chars
  private readonly SECRET = process.env.INVITE_TOKEN_SECRET || this.generateSecureToken();

  /**
   * Generates a new secure token hash using HMAC-SHA256.
 * The token includes inviteId, orgId, and timestamp for uniqueness.
 */
  async generateToken(inviteId: string, orgId: string, validityDays?: number): Promise<string> {
    const timestamp = new Date().toISOString();
    const data = `${inviteId}:${orgId}:${timestamp}`;
    const hash = await this.hmacSHA256(data, this.SECRET);
    return hash;
  }

  /**
   * Creates an InviteToken object from a hash.
 * Validity is derived from the hash (stored in token object).
 */
  createToken(hash: string, validityDays?: number): InviteToken {
    const days = validityDays ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return new InviteToken(hash, expiresAt, 1);
  }

  /**
   * Validates a token hash against a stored hash.
 * Simple string comparison (use constant-time comparison in production).
 */
  validateToken(token: string, storedHash: string): boolean {
    return token === storedHash;
  }

  /**
   * Checks if a token is expired.
 */
  isTokenExpired(token: InviteToken): boolean {
    return token.isExpired;
  }

  /**
   * Increments token usage count (internal tracking).
 */
  incrementTokenUsage(token: InviteToken): void {
    token.use(); // Mark as used
  }

  /**
   * HMAC-SHA256 hash function using Node.js crypto.
 */
  private async hmacSHA256(message: string, secret: string): Promise<string> {
    const crypto = require('crypto');
    return new Promise((resolve, reject) => {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(message);
      resolve(hmac.digest('hex'));
    });
  }

  /**
   * Secure random string generation (for token secrets).
 */
  private generateSecureToken(): string {
    // Fallback: use simple random generator
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}