/**
 * PasswordValidator domain service — password complexity validation.
 *
 * Validates passwords BEFORE hashing. Ensures minimum complexity
 * per organization policy (configurable, with sensible defaults).
 * Never logs or stores plain text passwords.
 *
 * @traceability DOC-012 Domain Service PasswordValidator
 */

export interface PasswordComplexityPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
  specialCharPattern?: string;
  maxRetriesBeforeLock: number;
}

const DEFAULT_POLICY: PasswordComplexityPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  specialCharPattern: '[!@#$%^&*()_+\\-=\\[\\]{}|;:,.<>?]',
  maxRetriesBeforeLock: 5,
};

export class PasswordValidator {
  private readonly _policy: PasswordComplexityPolicy;

  constructor(policy?: Partial<PasswordComplexityPolicy>) {
    this._policy = { ...DEFAULT_POLICY, ...(policy ?? {}) };
  }

  /** Validate a plain-text password against complexity policy. Returns error message or null. */
  validate(plainPassword: string): string | null {
    if (plainPassword.length < this._policy.minLength) {
      return `Password must be at least ${this._policy.minLength} characters long`;
    }
    if (this._policy.requireUppercase && !/[A-Z]/.test(plainPassword)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (this._policy.requireLowercase && !/[a-z]/.test(plainPassword)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (this._policy.requireDigit && !/\d/.test(plainPassword)) {
      return 'Password must contain at least one digit';
    }
    if (this._policy.requireSpecial) {
      const pattern = this._policy.specialCharPattern ?? '[!@#$%^&*()]';
      if (!new RegExp(pattern).test(plainPassword)) {
        return 'Password must contain at least one special character';
      }
    }
    return null; // valid
  }

  get policy(): Readonly<PasswordComplexityPolicy> {
    return this._policy;
  }

  static getDefaultPolicy(): PasswordComplexityPolicy {
    return { ...DEFAULT_POLICY };
  }
}
