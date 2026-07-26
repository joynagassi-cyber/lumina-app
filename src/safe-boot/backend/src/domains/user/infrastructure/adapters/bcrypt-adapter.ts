/**
 * BcryptAdapter — BR-ID-001 enforcement at infrastructure level
 *
 * Wraps bcrypt for password hashing and verification.
 * Hash is NEVER stored in plaintext, NEVER logged.
 *
 * @traceability DOC-012 BR-ID-001 → bcrypt algorithm
 */

import { hash, compare, genSalt } from 'bcrypt';
import { Injectable } from '@nestjs/common';

const DEFAULT_SALT_ROUNDS = 12;

@Injectable()
export class BcryptAdapter {
  /** Hash a plain-text password. Returns bcrypt $2b$ formatted string. */
  async hash(plainPassword: string): Promise<string> {
    const salt = await genSalt(DEFAULT_SALT_ROUNDS);
    return hash(plainPassword, salt);
  }

  /** Verify a plain-text password against a stored hash. */
  async verify(plainPassword: string, storedHash: string): Promise<boolean> {
    try {
      return await compare(plainPassword, storedHash);
    } catch {
      return false;
    }
  }
}
