/**
 * HealthController — specs CRT-007 (ADR-018).
 */

import { HealthController } from '../../../src/safe-boot/backend/src/core/runtime/health.controller';

function makeHealth(status: 'ok' | 'error', db: 'up' | 'down', cache: 'up' | 'down') {
  return {
    check: jest.fn().mockResolvedValue({
      status,
      details: { database: { status: db }, cache: { status: cache } },
    }),
  };
}

describe('HealthController (CRT-007)', () => {
  it('rend HEALTHY quand tous les indicateurs sont up', async () => {
    const ctrl = new HealthController(
      makeHealth('ok', 'up', 'up') as never,
      { $queryRaw: jest.fn() } as never,
      { sweep: jest.fn() } as never,
    );

    const result = await ctrl.check();
    expect(result.status).toBe('HEALTHY');
  });

  it('rend DEGRADED quand un seul indicateur est down', async () => {
    const ctrl = new HealthController(
      makeHealth('error', 'down', 'up') as never,
      { $queryRaw: jest.fn() } as never,
      { sweep: jest.fn() } as never,
    );

    const result = await ctrl.check();
    expect(result.status).toBe('DEGRADED');
  });

  it('rend UNHEALTHY quand tous les indicateurs sont down', async () => {
    const ctrl = new HealthController(
      makeHealth('error', 'down', 'down') as never,
      { $queryRaw: jest.fn() } as never,
      { sweep: jest.fn() } as never,
    );

    const result = await ctrl.check();
    expect(result.status).toBe('UNHEALTHY');
  });
});
