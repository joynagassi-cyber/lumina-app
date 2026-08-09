/**
 * IdempotencyManager — specs CRT-013 (ADR-018).
 */

import { IdempotencyManager } from '../../../src/safe-boot/backend/src/core/runtime/idempotency-manager';

describe('IdempotencyManager (CRT-013)', () => {
  it('exécute une seule fois et retourne le résultat en cache pour la même clé', async () => {
    const manager = new IdempotencyManager(60_000);
    const op = jest.fn().mockResolvedValue({ id: 'tx-1' });

    const first = await manager.execute('org-1', 'key-1', op);
    const second = await manager.execute('org-1', 'key-1', op);

    expect(first).toEqual({ id: 'tx-1' });
    expect(second).toEqual({ id: 'tx-1' });
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('la clé est org-scoped (INV-004) : même clé, autre org → nouvelle exécution', async () => {
    const manager = new IdempotencyManager(60_000);
    const op = jest.fn().mockResolvedValue('result');

    await manager.execute('org-1', 'key', op);
    await manager.execute('org-2', 'key', op);

    expect(op).toHaveBeenCalledTimes(2);
  });

  it('isDuplicate détecte un doublon non expiré', async () => {
    const manager = new IdempotencyManager(60_000);
    await manager.execute('org-1', 'key', () => Promise.resolve('x'));
    expect(manager.isDuplicate('org-1', 'key')).toBe(true);
    expect(manager.isDuplicate('org-2', 'key')).toBe(false);
  });

  it('une entrée expirée n’est plus un doublon (TTL)', async () => {
    const manager = new IdempotencyManager(40);
    await manager.execute('org-1', 'key', () => Promise.resolve('x'));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(manager.isDuplicate('org-1', 'key')).toBe(false);
  });

  it('sweep purge les entrées expirées', async () => {
    const manager = new IdempotencyManager(30);
    await manager.execute('org-1', 'key', () => Promise.resolve('x'));
    await new Promise((resolve) => setTimeout(resolve, 40));
    manager.sweep();
    expect(manager.isDuplicate('org-1', 'key')).toBe(false);
  });
});
