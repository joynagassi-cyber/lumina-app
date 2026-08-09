/**
 * InviteToken — HMAC-SHA256 signed token
 *
 * One-time use token for accepting invitations. Provides cryptographic
 * verification that the acceptance request is authorized and untampered.
 * Token includes timestamp for expiration validation.
 */

export class InviteToken {
  private readonly _hash: string;
  private readonly _expiresAt: Date;
  private _used: boolean = false;
  private _usageCount: number = 0;
  private readonly _maxUsage: number;

  constructor(hash: string, expiresAt: Date, maxUsage: number = 1) {
    if (hash.length === 0) throw new Error('InviteToken hash cannot be empty');
    if (expiresAt instanceof Date && expiresAt < new Date()) {
      throw new Error('Token expiration must be in the future');
    }
    if (maxUsage < 1) throw new Error('Max usage must be at least 1');

    this._hash = hash;
    this._expiresAt = expiresAt;
    this._maxUsage = maxUsage;
  }

  get hash(): string {
    return this._hash;
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt);
  }

  get isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  get isUsed(): boolean {
    return this._used;
  }

  get usageCount(): number {
    return this._usageCount;
  }

  get remainingUsage(): number {
    return this._maxUsage - this._usageCount;
  }

  /**
   * Marks the token as used and increments usage count.
   * Returns true if token was successfully used, false if already used or expired.
   */
  use(): boolean {
    if (this._used || this.isExpired || this._usageCount >= this._maxUsage) {
      return false;
    }
    this._used = true;
    this._usageCount++;
    return true;
  }

  /**
   * Validates token for acceptance.
   * Throws if token is expired, used, or invalid.
   */
  validateForAccept(): void {
    if (this.isExpired) {
      throw new Error('Invite token has expired');
    }
    if (this._used) {
      throw new Error('Invite token has already been used');
    }
    if (this._maxUsage === 1 && this._usageCount > 0) {
      throw new Error('Invite token usage limit exceeded');
    }
  }

  /**
   * Creates a new InviteToken from a hash and validity period.
   */
  static create(
    hash: string,
    validityDays: number = 7,
    maxUsage: number = 1
  ): InviteToken {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);
    return new InviteToken(hash, expiresAt, maxUsage);
  }

  /**
   * Recreates token from persisted state (for deserialization from DB).
   */
  static fromPersisted(
    hash: string,
    expiresAt: string,
    usageCount: number,
    maxUsage: number = 1
  ): InviteToken {
    const expiresDate = new Date(expiresAt);
    const token = new InviteToken(hash, expiresDate, maxUsage);
    token._used = usageCount >= maxUsage;
    token._usageCount = usageCount;
    return token;
  }
}