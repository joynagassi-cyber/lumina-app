/**
 * HotSwapEngine — unit tests (Phase A, AC A-4).
 *
 * Verifies the foundation contract:
 *   register / activate / deactivate / hotSwap / rollback / manifest-driven activation.
 */
import { HotSwapEngine } from '../../../src/shared/feature-hot-swap/engine';
import type { FeatureManifest, FeatureModule } from '../../../src/shared/feature-hot-swap/types';

function makeModule(id: string, opts?: { validate?: () => boolean; mountThrows?: boolean }): FeatureModule {
  const mount = opts?.mountThrows
    ? () => {
        throw new Error(`mount crash ${id}`);
      }
    : () => () => {};
  return {
    id,
    version: '1.0.0',
    toggleKey: `toggle_${id}`,
    validate: opts?.validate ?? (() => true),
    mount,
    unmount: () => {},
  };
}

describe('HotSwapEngine', () => {
  it('registers a module and activates it (mount called, state active)', () => {
    const engine = new HotSwapEngine();
    const module = makeModule('finance_ledger_v1');
    let mounted = 0;
    module.mount = () => {
      mounted++;
      return () => {};
    };

    engine.registerModule(module);
    const ok = engine.activateFeature('finance_ledger_v1');

    expect(ok).toBe(true);
    expect(mounted).toBe(1);
    const status = engine.getStatusSnapshot();
    expect(status).toContainEqual({ id: 'finance_ledger_v1', version: '1.0.0', mounted: true, active: true });
  });

  it('refuses activation of an unregistered feature and reports via onError', () => {
    const errors: Array<{ message: string; recoverable: boolean }> = [];
    const engine = new HotSwapEngine({ onError: (message, recoverable) => errors.push({ message, recoverable }) });

    const ok = engine.activateFeature('ghost');

    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('ghost');
  });

  it('skips activation when module.validate() fails', () => {
    const engine = new HotSwapEngine();
    engine.registerModule(makeModule('broken', { validate: () => false }));

    expect(engine.activateFeature('broken')).toBe(false);
    expect(engine.getStatusSnapshot().find((s) => s.id === 'broken')?.mounted).toBe(false);
  });

  it('deactivates a mounted feature and cleans up', () => {
    const engine = new HotSwapEngine();
    const module = makeModule('groups_v1');
    let unmounted = 0;
    module.unmount = () => {
      unmounted++;
    };
    engine.registerModule(module);
    engine.activateFeature('groups_v1');

    const ok = engine.deactivateFeature('groups_v1');

    expect(ok).toBe(true);
    expect(unmounted).toBe(1);
    expect(engine.getStatusSnapshot().find((s) => s.id === 'groups_v1')).toMatchObject({ mounted: false, active: false });
  });

  it('hot-swaps v1 -> v2 (old unmounted, new mounted)', () => {
    const engine = new HotSwapEngine();
    engine.registerModule(makeModule('finance_ledger_v1'));
    engine.activateFeature('finance_ledger_v1');

    const ok = engine.hotSwap('finance_ledger_v1', makeModule('finance_ledger_v2'));

    expect(ok).toBe(true);
    const ids = engine.getStatusSnapshot().map((s) => s.id);
    expect(ids).toContain('finance_ledger_v2');
    expect(engine.getStatusSnapshot().find((s) => s.id === 'finance_ledger_v1')).toMatchObject({ mounted: false, active: false });
  });

  it('rolls back to previous state when activation crashes', () => {
    const engine = new HotSwapEngine();
    engine.registerModule(makeModule('stable'));
    engine.activateFeature('stable');

    engine.registerModule(makeModule('crashing', { mountThrows: true }));
    const ok = engine.activateFeature('crashing');

    expect(ok).toBe(false);
    // stable must remain mounted after the failed activation
    expect(engine.getStatusSnapshot().find((s) => s.id === 'stable')).toMatchObject({ mounted: true, active: true });
  });

  it('activates only enabled features from a manifest', () => {
    const engine = new HotSwapEngine();
    engine.registerModule(makeModule('on_v1'));
    engine.registerModule(makeModule('off_v1'));

    const manifest: FeatureManifest = {
      version: 1,
      deployedAt: '2026-08-08T00:00:00.000Z',
      features: [
        { id: 'on_v1', version: '1.0.0', toggleKey: 'toggle_on_v1', enabled: true, requiredPermissions: [] },
        { id: 'off_v1', version: '1.0.0', toggleKey: 'toggle_off_v1', enabled: false, requiredPermissions: [] },
      ],
    };

    engine.loadManifest(manifest);
    engine.activateAllFromManifest();

    const status = engine.getStatusSnapshot();
    expect(status.find((s) => s.id === 'on_v1')).toMatchObject({ mounted: true, active: true });
    expect(status.find((s) => s.id === 'off_v1')).toMatchObject({ mounted: false, active: false });
  });

  it('detects added / removed / toggled features between two manifests', () => {
    const engine = new HotSwapEngine();
    const oldManifest: FeatureManifest = {
      version: 1,
      deployedAt: '2026-08-08T00:00:00.000Z',
      features: [
        { id: 'a', version: '1.0.0', toggleKey: 'k_a', enabled: true, requiredPermissions: [] },
        { id: 'b', version: '1.0.0', toggleKey: 'k_b', enabled: true, requiredPermissions: [] },
      ],
    };
    const newManifest: FeatureManifest = {
      version: 2,
      deployedAt: '2026-08-09T00:00:00.000Z',
      features: [
        { id: 'a', version: '1.0.0', toggleKey: 'k_a', enabled: false, requiredPermissions: [] },
        { id: 'c', version: '1.0.0', toggleKey: 'k_c', enabled: true, requiredPermissions: [] },
      ],
    };

    const changes = engine.detectToggleChanges(oldManifest, newManifest);

    expect(changes.removed).toEqual(['b']);
    expect(changes.added).toEqual(['c']);
    expect(changes.toggled).toEqual(['a']);
  });
});
