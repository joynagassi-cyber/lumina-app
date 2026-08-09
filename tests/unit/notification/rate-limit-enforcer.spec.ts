/**
 * RateLimitEnforcer Tests
 *
 * Tests notification rate limiting enforcement (domain dry-gate contract).
 * @traceability DOC-012 BR-NOT-002, RateLimitEnforcer
 */

import { RateLimitEnforcer, RateLimitExceededError } from '@/domains/notification/domain/services/rate-limit-enforcer.service';
import { RateLimitConfig } from '@/domains/notification/domain/value-objects/rate-limit-config.vo';

class MockNotificationRepository {
  countDeliveriesWithinWindow = jest.fn().mockResolvedValue(0);
  recordDelivery = jest.fn().mockResolvedValue(undefined);
}

describe('RateLimitEnforcer', () => {
  let service: RateLimitEnforcer;
  let repoMock: MockNotificationRepository;

  beforeEach(() => {
    repoMock = new MockNotificationRepository();
    service = new RateLimitEnforcer(repoMock as any);
  });

  describe('allow', () => {
    it('should accept when maxPerHour is positive (dry-gate, no throw)', async () => {
      const config = RateLimitConfig.create(10);

      await expect(service.allow('user-1', config)).resolves.toBeUndefined();
    });

    it('should throw RateLimitExceededError when maxPerHour is <= 0', async () => {
      const config = { maxPerHour: 0 } as any;

      await expect(service.allow('user-1', config)).rejects.toThrow(RateLimitExceededError);
      await expect(service.allow('user-1', config)).rejects.toThrow(/rate limit exceeded/i);
    });
  });

  describe('recordSent', () => {
    it('should be a no-op at the domain level (infrastructure counts)', async () => {
      await expect(service.recordSent('user-1')).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should be a no-op at the domain level (infrastructure clears counters)', async () => {
      await expect(service.reset('user-1')).resolves.toBeUndefined();
    });
  });

  describe('enforce', () => {
    it('should return true when a preference with a positive rate limit exists', async () => {
      const preference = { rateLimit: RateLimitConfig.create(100) };

      const result = await service.enforce('user-1', 'org-1', preference as any);

      expect(result).toBe(true);
    });

    it('should return true when no preference is configured (default limit)', async () => {
      const result = await service.enforce('user-1', 'org-1', null);

      expect(result).toBe(true);
    });
  });
});
