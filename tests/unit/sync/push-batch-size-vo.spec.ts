/**
 * PushBatchSize Value Object Tests
 *
 * Tests batch size validation and clamping for push operations.
 * @traceability DOC-012 BR-SYNC-006, VO-PushBatchSize
 */

import { PushBatchSize } from '@/domains/sync/value-objects/push-batch-size.vo';

describe('PushBatchSize', () => {
  it('should define MAX constant as 50', () => {
    expect(PushBatchSize.MAX).toBe(50);
  });

  it('should create from valid value within range (1-50)', () => {
    const size = new PushBatchSize(10);
    expect(size.value).toBe(10);
  });

  it('should create from exactly MAX value', () => {
    const size = new PushBatchSize(50);
    expect(size.value).toBe(50);
  });

  it('should create from minimum value 1', () => {
    const size = new PushBatchSize(1);
    expect(size.value).toBe(1);
  });

  it('should reject value less than 1', () => {
    expect(() => new PushBatchSize(0)).toThrowError();
    expect(() => new PushBatchSize(-1)).toThrowError();
  });

  it('should reject value greater than MAX', () => {
    expect(() => new PushBatchSize(51)).toThrowError();
    expect(() => new PushBatchSize(100)).toThrowError();
  });

  it('should reject non-integer values', () => {
    expect(() => new PushBatchSize(10.5)).toThrowError();
    expect(() => new PushBatchSize(10.001)).toThrowError();
  });

  it('should reject null/undefined', () => {
    // @ts-ignore
    expect(() => new PushBatchSize(null)).toThrowError();
    // @ts-ignore
    expect(() => new PushBatchSize(undefined)).toThrowError();
  });

  it('should clamp value when create is called with value > MAX', () => {
    const size = PushBatchSize.create(100);
    expect(size.value).toBe(50);
  });

  it('should return original value when create is called with value within range', () => {
    const size = PushBatchSize.create(25);
    expect(size.value).toBe(25);
  });

  it('should toString correctly', () => {
    const size = new PushBatchSize(25);
    expect(size.toString()).toBe('25');
  });

  it('should have correct value after string conversion', () => {
    const size = new PushBatchSize(15);
    const parsed = new PushBatchSize(Number(size.toString()));
    expect(parsed.value).toBe(15);
  });
});
