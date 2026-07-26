/**
 * PasswordHash value object — BR-ID-001 enforcement
 *
 * Immutable VO. Represents a hashed password.
 * NEVER stores or logs plain text.
 * Storage format: bcrypt ($2b$) or argon2 ($argon2id$).
 *
 * @traceability DOC-012 VO PasswordHash → PG-Schema Table 6 hachage_mot_de_passe (varchar(60))
 */

export class PasswordHash {
  readonly hash: string;

  private constructor(hash: string) {
    // Validate it looks like a bcrypt or argon2 hash
    const isBcrypt = hash.startsWith('$2') && hash.length === 60;
    const isArgon2 = hash.startsWith('$argon2');
    if (!isBcrypt && !isArgon2) {
      throw new Error('Invalid PasswordHash format: must be bcrypt ($2b$, $2a$, $2y$) or argon2 ($argon2id$)');
    }
    this.hash = hash;
  }

  /** Hash is never revealed — only comparison against input */
  toString(): string {
    return '[PASSWORD_HASH_REDACTED]';
  }

  static create(hash: string): PasswordHash {
    return new PasswordHash(hash);
  }
}
