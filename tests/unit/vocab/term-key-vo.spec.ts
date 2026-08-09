/**
 * TermKey Value Object Tests
 *
 * Tests term key validation and immutability.
 * @traceability DOC-012 BR-VOC-003, VO-TermKey
 */

import { TermKey, InvalidTermKeyError } from '@/domains/vocab/domain/value-objects/term-key.vo';

describe('TermKey', () => {
  it('should create valid term key', () => {
    const key = new TermKey('user_status');
    expect(key.value).toBe('user_status');
  });

  it('should accept alphanumeric with hyphens and underscores', () => {
    const key1 = new TermKey('status-123');
    const key2 = new TermKey('my_custom_key');
    expect(key1.value).toBe('status-123');
    expect(key2.value).toBe('my_custom_key');
  });

  it('should reject empty string', () => {
    expect(() => new TermKey('')).toThrow(InvalidTermKeyError);
  });

  it('should reject whitespace-only string', () => {
    expect(() => new TermKey('   ')).toThrow(InvalidTermKeyError);
  });

  it('should reject null', () => {
    // @ts-ignore
    expect(() => new TermKey(null)).toThrow(InvalidTermKeyError);
  });

  it('should reject exceeding max length (255 chars)', () => {
    const longKey = 'a'.repeat(256);
    expect(() => new TermKey(longKey)).toThrow(InvalidTermKeyError);
  });

  it('should accept exactly 255 characters', () => {
    const longKey = 'a'.repeat(255);
    const key = new TermKey(longKey);
    expect(key.value.length).toBe(255);
  });

  it('should reject uppercase letters', () => {
    expect(() => new TermKey('UserStatus')).toThrow(InvalidTermKeyError);
  });

  it('should reject special characters', () => {
    expect(() => new TermKey('user status')).toThrow(InvalidTermKeyError); // space
    expect(() => new TermKey('user@status')).toThrow(InvalidTermKeyError); // @
  });

  it('should trim whitespace from input', () => {
    const key = new TermKey('  user_status  ');
    expect(key.value).toBe('user_status');
  });

  it('should compare equality correctly', () => {
    const key1 = new TermKey('user_status');
    const key2 = new TermKey('user_status');
    const key3 = new TermKey('different_key');

    expect(key1.equals(key2)).toBe(true);
    expect(key1.equals(key3)).toBe(false);
  });

  it('should convert to string correctly', () => {
    const key = new TermKey('user_status');
    expect(key.toString()).toBe('user_status');
  });
});
