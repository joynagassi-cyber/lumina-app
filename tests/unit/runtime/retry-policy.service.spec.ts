/**
 * RetryPolicyService — specs CRT-012 (ADR-018).
 */

import { RetryPolicyService } from '../../../src/safe-boot/backend/src/core/runtime/retry-policy.service';
import { DomainError } from '../../../src/safe-boot/backend/src/shared/errors';

describe('RetryPolicyService (CRT-012)', () => {
  const service = new RetryPolicyService();

  it('réussit au premier essai sans retry', async () => {
    const op = jest.fn().mockResolvedValue('ok');
    await expect(service.execute(op)).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retente et réussit après des échecs transitoires', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('recovered');
    const onRetry = jest.fn();
    await expect(
      service.execute(op, { maxRetries: 3, baseDelayMs: 1, onRetry }),
    ).resolves.toBe('recovered');
    expect(op).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('abandonne après maxRetries et relance la dernière erreur', async () => {
    const op = jest.fn().mockRejectedValue(new Error('persistent'));
    await expect(service.execute(op, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow(
      'persistent',
    );
    // 1 tentative initiale + 2 retries
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('ne retente JAMAIS une DomainError (erreur métier = état invalide)', async () => {
    const domainError = new DomainError('CONFLICT', 'état métier invalide');
    const op = jest.fn().mockRejectedValue(domainError);
    await expect(service.execute(op, { maxRetries: 5, baseDelayMs: 1 })).rejects.toBe(
      domainError,
    );
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('respecte un prédicat retryable custom', async () => {
    const op = jest.fn().mockRejectedValue(new Error('nope'));
    await expect(
      service.execute(op, { maxRetries: 3, baseDelayMs: 1, retryable: () => false }),
    ).rejects.toThrow('nope');
    expect(op).toHaveBeenCalledTimes(1);
  });
});
