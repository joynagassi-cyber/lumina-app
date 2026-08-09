/**
 * PasswordValidator Tests
 *
 * Tests password complexity validation rules.
 * @traceability DOC-012 BR-ID-003, PasswordValidator domain service
 */

import { PasswordValidator, PasswordComplexityPolicy } from '@/domains/user/domain/services/password-validator';

describe('PasswordValidator', () => {
  let validator: PasswordValidator;

  beforeEach(() => {
    validator = new PasswordValidator();
  });

  it('should use default policy', () => {
    const policy = validator.policy;
    expect(policy.minLength).toBe(8);
    expect(policy.requireUppercase).toBe(true);
    expect(policy.requireLowercase).toBe(true);
    expect(policy.requireDigit).toBe(true);
    expect(policy.requireSpecial).toBe(true);
    expect(policy.maxRetriesBeforeLock).toBe(5);
  });

  // Valid passwords
  it('should accept strong password meeting all criteria', () => {
    const error = validator.validate('Password123!');
    expect(error).toBeNull();
  });

  it('should accept password with 8 chars and all requirements', () => {
    const error = validator.validate('Pass@123');
    expect(error).toBeNull();
  });

  // Invalid passwords - too short
  it('should reject password shorter than min length', () => {
    const error = validator.validate('Pass!');
    expect(error).toContain('must be at least 8 characters');
  });

  it('should reject password with 7 characters', () => {
    const error = validator.validate('Pass1!');
    expect(error).toContain('must be at least 8 characters');
  });

  // Missing uppercase
  it('should reject password without uppercase', () => {
    const error = validator.validate('password123!');
    expect(error).toContain('uppercase letter');
  });

  // Missing lowercase
  it('should reject password without lowercase', () => {
    const error = validator.validate('PASSWORD123!');
    expect(error).toContain('lowercase letter');
  });

  // Missing digit
  it('should reject password without digit', () => {
    const error = validator.validate('Password!!!');
    expect(error).toContain('digit');
  });

  // Missing special character
  it('should reject password without special character', () => {
    const error = validator.validate('Password123');
    expect(error).toContain('special character');
  });

  // Empty password
  it('should reject empty password', () => {
    const error = validator.validate('');
    expect(error).toContain('must be at least 8 characters');
  });

  // Null/undefined handling
  it('should handle empty string properly', () => {
    const error = validator.validate('');
    expect(error).toBeTruthy();
  });

  // Policy customization
  it('should use custom policy when provided', () => {
    const customPolicy: PasswordComplexityPolicy = {
      minLength: 6,
      requireUppercase: false,
      requireLowercase: true,
      requireDigit: true,
      requireSpecial: false,
      maxRetriesBeforeLock: 5,
    };
    const validator = new PasswordValidator(customPolicy);
    const error = validator.validate('Ab1'); // Too short with new min 6
    expect(error).toContain('must be at least 6 characters');

    const validError = validator.validate('Ab1234'); // Meets custom policy
    expect(validError).toBeNull();
  });

  // getDefaultPolicy
  it('should return default policy', () => {
    const policy = PasswordValidator.getDefaultPolicy();
    expect(policy.minLength).toBe(8);
    expect(policy.requireUppercase).toBe(true);
  });
});
