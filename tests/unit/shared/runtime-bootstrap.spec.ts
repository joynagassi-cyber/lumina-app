import { ManifestEngine, ManifestValidationError } from '../../../src/shared/manifest';
import mfeJcManifest from '../../../src/shared/manifest/manifests/mfe-jc.json';
import {
  createLuminaRuntime,
  toFeatureManifest,
  toOfflineManifest,
  inMemoryStores,
} from '../../../src/shared/runtime/runtime-bootstrap';
import type { FeatureModule } from '../../../src/shared/feature-hot-swap/types';

function makeModule(id: string, version = '1.0.0'): FeatureModule {
  const mounted = { count: 0 };
  return {
    id,
    version,
    toggleKey: `feature_${id}`,
    validate: () => true,
    mount: () => {
      mounted.count += 1;
      return () => {
        mounted.count -= 1;
      };
    },
    unmount: () => {},
  };
}

describe('LuminaRuntime bootstrap (B-6)', () => {
  it('compile le manifest réel et assemble tout le graphe de moteurs', () => {
    const runtime = createLuminaRuntime(mfeJcManifest);
    expect(runtime.manifest.orgId).toBe('mfe-jc');
    expect(runtime.vocabulary.lookup('finance_categories', 'dime')).toBe('Dîme');
    expect(runtime.capability.roleCan('admin', 'transaction:approve')).toBe(true);
    expect(runtime.workflow.canTransition('transaction_state_machine', 'draft', 'pending')).toBe(true);
    expect(runtime.hotSwap).toBeDefined();
    expect(runtime.offline).toBeDefined();
  });

  it('lève ManifestValidationError pour un manifest invalide (fail fast)', () => {
    expect(() => createLuminaRuntime({ orgId: 'broken' })).toThrow(ManifestValidationError);
  });

  it('active les features activées qui ont un module enregistré', () => {
    const finance = makeModule('finance');
    const runtime = createLuminaRuntime(mfeJcManifest, { modules: [finance] });
    const status = runtime.hotSwap.getStatusSnapshot();
    const financeStatus = status.find((s) => s.id === 'finance');
    expect(financeStatus?.active).toBe(true);
    expect(financeStatus?.mounted).toBe(true);
  });

  it('na pas active les features sans module enregistré (silencieux, Phase D)', () => {
    const runtime = createLuminaRuntime(mfeJcManifest);
    expect(runtime.hotSwap.getStatusSnapshot()).toEqual([]);
  });

  it('na pas active une feature désactivée par le manifest même avec module', () => {
    const members = makeModule('members_placeholder');
    const runtime = createLuminaRuntime(mfeJcManifest, { modules: [members] });
    // Le module est enregistré (disponible) mais ni monté ni actif
    const status = runtime.hotSwap.getStatusSnapshot();
    expect(status).toHaveLength(1);
    expect(status[0]).toMatchObject({ id: 'members_placeholder', active: false, mounted: false });
  });

  it('un crash dactivation est rollbacké (grâce dégradée)', () => {
    const crashy: FeatureModule = {
      id: 'finance',
      version: '1.0.0',
      toggleKey: 'feature_finance',
      validate: () => true,
      mount: () => {
        throw new Error('boom');
      },
      unmount: () => {},
    };
    const errors: string[] = [];
    const runtime = createLuminaRuntime(mfeJcManifest, {
      modules: [crashy],
      onError: (msg) => errors.push(msg),
    });
    const finance = runtime.hotSwap.getStatusSnapshot().find((s) => s.id === 'finance');
    expect(finance?.active).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/rolled back/);
  });

  it('persistManifest écrit le manifest dans L2 et L3 (démarrage offline)', async () => {
    const stores = inMemoryStores();
    const runtime = createLuminaRuntime(mfeJcManifest, { l2Store: stores.l2, l3Store: stores.l3 });
    await runtime.persistManifest();
    const l2Manifest = await stores.l2.getManifest('mfe-jc');
    expect(l2Manifest?.orgId).toBe('mfe-jc');
    expect(await stores.l3.exists('mfe-jc', 1)).toBe(true);
  });

  it('toFeatureManifest / toOfflineManifest adaptent les shapes', () => {
    const manifest = new ManifestEngine().compile(mfeJcManifest);
    const fm = toFeatureManifest(manifest);
    expect(fm.features.find((f) => f.id === 'finance')?.toggleKey).toBe('feature_finance');
    const om = toOfflineManifest(manifest);
    expect(om.orgId).toBe('mfe-jc');
    expect(om.formSchemas).toHaveLength(1);
    expect(om.workflows).toHaveLength(1);
  });

  it('dispose rollbacke les features (nettoyage propre)', () => {
    const finance = makeModule('finance');
    const runtime = createLuminaRuntime(mfeJcManifest, { modules: [finance] });
    expect(runtime.hotSwap.getStatusSnapshot()[0].active).toBe(true);
    runtime.dispose();
    expect(runtime.hotSwap.getStatusSnapshot()[0].active).toBe(false);
  });
});
