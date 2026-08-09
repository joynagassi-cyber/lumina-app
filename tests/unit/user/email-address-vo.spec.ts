/**
 * EmailAddress Value Object Tests
 *
 * Tests validation and behavior of EmailAddress VO (RFC 5322 subset).
 * @traceability DOC-012 BR-ID-003, VO-EmailAddress
 */

import { EmailAddress } from '@/domains/user/domain/value-objects/email-address';

describe('EmailAddress', () => {
  it('should create from valid email address', () => {
    const email = new EmailAddress('user@example.com');
    expect(email.value).toBe('user@example.com');
  });

  it('should normalize to lowercase', () => {
    const email = new EmailAddress('USER@EXAMPLE.COM');
    expect(email.value).toBe('user@example.com');
  });

  it('should trim whitespace', () => {
    const email = new EmailAddress('  user@example.com  ');
    expect(email.value).toBe('user@example.com');
  });

  it('should reject invalid email format', () => {
    expect(() => new EmailAddress('invalid-email')).toThrowError();
    expect(() => new EmailAddress('user-at-example-com')).toThrowError();
  });

  it('should reject empty string', () => {
    expect(() => new EmailAddress('')).toThrowError();
  });

  it('should reject null', () => {
    // @ts-ignore
    expect(() => new EmailAddress(null)).toThrowError();
  });

  it('should exceed character limit (255)', () => {
    const longEmail = 'a'.repeat(260) + '@example.com';
    expect(() => new EmailAddress(longEmail)).toThrowError();
  });

  it('should accept exactly 255 characters', () => {
    // local part (243) + '@example.com' (12) = 255
    const longEmail = 'a'.repeat(243) + '@example.com';
    const email = new EmailAddress(longEmail);
    expect(email.value.length).toBe(255);
  });

  it('should compare equality correctly', () => {
    const email1 = new EmailAddress('user@example.com');
    const email2 = new EmailAddress('user@example.com');
    expect(email1.equals(email2)).toBe(true);

    const email3 = new EmailAddress('other@example.com');
    expect(email1.equals(email3)).toBe(false);
  });

  it('should convert to string correctly', () => {
    const email = new EmailAddress('User@Example.Com');
    expect(email.toString()).toBe('user@example.com');
  });

  it('should create via static method', () => {
    const email = EmailAddress.create('test@example.com');
    expect(email.value).toBe('test@example.com');
  });
});
