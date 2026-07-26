/**
 * Credential entity — tracks authentication metadata per user
 *
 * Stored in credentials table (PG-Schema Table 6).
 * Contains password hash, lockout state, last login tracking.
 * Never stores plain text password.
 *
 * @traceability DOC-012 Aggregate2 → PG-Schema Table 6
 */

import { v4 as uuidv4 } from 'uuid';
import type { PasswordHash } from '../value-objects/password-hash';

export interface CredentialParams {
  id?: string;
  userId: string;
  orgId: string;
  passwordHash: PasswordHash;
  failedAttempts?: number;
  isLocked?: boolean;
  lastLoginAt?: Date | null;
}

export class Credential {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _orgId: string;
  private readonly _passwordHash: PasswordHash;
  private _failedAttempts: number;
  private _isLocked: boolean;
  private _lastLoginAt: Date | null;
  private _createdAt: Date;

  constructor(params: CredentialParams) {
    this._id = params.id ?? uuidv4();
    this._userId = params.userId;
    this._orgId = params.orgId;
    this._passwordHash = params.passwordHash;
    this._failedAttempts = params.failedAttempts ?? 0;
    this._isLocked = params.isLocked ?? false;
    this._lastLoginAt = params.lastLoginAt ?? null;
    this._createdAt = new Date();
  }

  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get orgId(): string { return this._orgId; }
  get passwordHash(): PasswordHash { return this._passwordHash; }
  get failedAttempts(): number { return this._failedAttempts; }
  get isLocked(): boolean { return this._isLocked; }
  get lastLoginAt(): Date | null { return this._lastLoginAt; }

  recordFailedAttempt(): void {
    this._failedAttempts += 1;
    if (this._failedAttempts >= 5) {
      this._isLocked = true;
    }
  }

  recordSuccessfulLogin(): void {
    this._failedAttempts = 0;
    this._isLocked = false;
    this._lastLoginAt = new Date();
  }

  /** Hash value never revealed. */
  toString(): string {
    return `[Credential userId=${this._userId} locked=${this._isLocked}]`;
  }
}
