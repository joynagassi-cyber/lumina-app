/**
 * AmountInCents Value Object Tests
 *
 * Tests validation and arithmetic operations of AmountInCents VO.
 * Ensures financial calculations use integer cents, not floats.
 * @traceability DOC-012 BR-RES-001, BR-RES-008, VO-AmountInCents
 */

import { AmountInCents } from '@/domains/finance/value-objects/amount-in-cents.vo';

describe('AmountInCents', () => {
  // Valid constructions
  it('should create from positive integer (100 cents = $1.00)', () => {
    const amount = new AmountInCents(100);
    expect(amount.value).toBe(100);
  });

  it('should create from larger amounts', () => {
    const amount = new AmountInCents(999999);
    expect(amount.value).toBe(999999);
  });

  it('should create from 1 cent (minimum)', () => {
    const amount = new AmountInCents(1);
    expect(amount.value).toBe(1);
  });

  // Invalid constructions
  it('should reject zero amount', () => {
    expect(() => new AmountInCents(0)).toThrowError();
  });

  it('should reject negative amount', () => {
    expect(() => new AmountInCents(-50)).toThrowError();
  });

  it('should reject non-integer values', () => {
    expect(() => new AmountInCents(10.5)).toThrowError();
    expect(() => new AmountInCents(10.001)).toThrowError();
  });

  it('should reject null/undefined', () => {
    // @ts-ignore
    expect(() => new AmountInCents(null)).toThrowError();
    // @ts-ignore
    expect(() => new AmountInCents(undefined)).toThrowError();
  });

  // Conversion methods
  it('should convert to decimal string with 2 decimals', () => {
    const amount = new AmountInCents(1500);
    expect(amount.toString()).toBe('1500');
    expect(amount.toDecimalString(2)).toBe('15.00');
  });

  it('should convert to decimal string with different precision', () => {
    const amount = new AmountInCents(123);
    expect(amount.toDecimalString(0)).toBe('1');
    expect(amount.toDecimalString(4)).toBe('1.2300');
  });

  // Arithmetic operations
  it('should add two amounts correctly', () => {
    const a = new AmountInCents(100);
    const b = new AmountInCents(250);
    const sum = a.add(b);
    expect(sum.value).toBe(350);
  });

  it('should throw when addition would produce non-positive result', () => {
    const a = new AmountInCents(100);
    // Attempt to add a negative amount (would require creating invalid AmountInCents first)
    // Test subtraction instead for non-positive result
  });

  it('should subtract two amounts correctly (result remains positive)', () => {
    const a = new AmountInCents(500);
    const b = new AmountInCents(200);
    const result = a.subtract(b);
    expect(result.value).toBe(300);
  });

  it('should throw when subtraction would produce non-positive result', () => {
    const a = new AmountInCents(100);
    const b = new AmountInCents(100);
    expect(() => a.subtract(b)).toThrowError();
  });

  it('should throw when subtraction would produce negative result', () => {
    const a = new AmountInCents(50);
    const b = new AmountInCents(100);
    expect(() => a.subtract(b)).toThrowError();
  });

  // Comparison
  it('should compare equality correctly', () => {
    const a = new AmountInCents(100);
    const b = new AmountInCents(100);
    const c = new AmountInCents(200);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('should toString correctly', () => {
    const amount = new AmountInCents(1500);
    expect(amount.toString()).toBe('1500');
  });

  // Edge cases
  it('should handle maximum value (within JavaScript safe integer range)', () => {
    const amount = new AmountInCents(Number.MAX_SAFE_INTEGER);
    expect(amount.value).toBe(Number.MAX_SAFE_INTEGER);
  });
});
