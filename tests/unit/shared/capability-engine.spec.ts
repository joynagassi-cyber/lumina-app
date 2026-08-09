import { ManifestEngine } from '../../../src/shared/manifest';
import mfeJcManifest from '../../../src/shared/manifest/manifests/mfe-jc.json';
import { CapabilityEngine, CapabilityError } from '../../../src/shared/capability';

describe('CapabilityEngine', () => {
  const manifest = new ManifestEngine().compile(mfeJcManifest);
  const engine = CapabilityEngine.fromManifest(manifest);

  describe('rôles et permissions', () => {
    it('admin (wildcard *) a toutes les permissions', () => {
      expect(engine.roleCan('admin', 'transaction:approve')).toBe(true);
      expect(engine.roleCan('admin', 'member:delete')).toBe(true);
      expect(engine.roleCan('admin', 'anything:at-all')).toBe(true);
    });

    it('trésorier a les permissions finance déclarées', () => {
      expect(engine.roleCan('treasurer', 'transaction:create')).toBe(true);
      expect(engine.roleCan('treasurer', 'transaction:approve')).toBe(true);
      expect(engine.roleCan('treasurer', 'transaction:reject')).toBe(true);
    });

    it('trésorier na pas les permissions non déclarées (fail closed)', () => {
      expect(engine.roleCan('treasurer', 'member:delete')).toBe(false);
      expect(engine.roleCan('treasurer', 'config:write')).toBe(false);
    });

    it('pasteur est limité à la lecture', () => {
      expect(engine.roleCan('pastor', 'transaction:read')).toBe(true);
      expect(engine.roleCan('pastor', 'transaction:create')).toBe(false);
      expect(engine.roleCan('pastor', 'transaction:approve')).toBe(false);
    });

    it('rôle inconnu → aucune permission (fail closed)', () => {
      expect(engine.roleCan('comptable', 'transaction:read')).toBe(false);
    });

    it('hasRole reflète les rôles du manifest', () => {
      expect(engine.hasRole('admin')).toBe(true);
      expect(engine.hasRole('comptable')).toBe(false);
    });
  });

  describe('can() multi-rôles et union', () => {
    it('can() est vrai si au moins un rôle possède la permission', () => {
      expect(engine.can(['pastor', 'treasurer'], 'transaction:approve')).toBe(true);
      expect(engine.can(['pastor'], 'transaction:approve')).toBe(false);
      expect(engine.can([], 'transaction:read')).toBe(false);
    });

    it('can() lève CapabilityError pour un rôle inconnu (problème de config)', () => {
      expect(() => engine.can(['admin', 'fantome'], 'transaction:read')).toThrow(CapabilityError);
    });

    it('requirePermission lève avec message clair en cas de refus', () => {
      expect(() => engine.requirePermission(['pastor'], 'transaction:approve')).toThrow(
        /Permission refusée: "transaction:approve"/,
      );
      expect(() => engine.requirePermission(['pastor'], 'transaction:read')).not.toThrow();
    });

    it('unionPermissions combine les permissions sans doublon', () => {
      const union = engine.unionPermissions(['treasurer', 'pastor']);
      expect(union.has('transaction:read')).toBe(true);
      expect(union.has('transaction:approve')).toBe(true);
      expect(union.has('member:delete')).toBe(false);
    });

    it('unionPermissions retourne le wildcard dès quun rôle est admin', () => {
      expect(engine.unionPermissions(['pastor', 'admin'])).toEqual(
        new Set([CapabilityEngine.WILDCARD]),
      );
    });
  });

  describe('feature toggles', () => {
    it('les features du manifest sont détectées avec leur état', () => {
      expect(engine.isFeatureEnabled('finance')).toBe(true);
      expect(engine.isFeatureEnabled('groups')).toBe(true);
      expect(engine.isFeatureEnabled('members_placeholder')).toBe(false);
      expect(engine.isFeatureEnabled('settings_placeholder')).toBe(false);
      expect(engine.isFeatureEnabled('bogus')).toBe(false);
    });

    it('featureIds liste les features déclarées', () => {
      expect(engine.featureIds()).toEqual(
        expect.arrayContaining(['finance', 'groups', 'members_placeholder', 'settings_placeholder']),
      );
    });

    it('getFeature retourne la définition complète', () => {
      const f = engine.getFeature('finance');
      expect(f?.toggleKey).toBe('feature_finance');
      expect(f?.requiredPermissions).toContain('transaction:approve');
    });
  });

  describe('checkFeatureAccess — toggle × permissions', () => {
    it('finance est accessible au trésorier (toggle + permissions)', () => {
      const access = engine.checkFeatureAccess('finance', ['treasurer']);
      expect(access.available).toBe(true);
      expect(access.reason).toBe('enabled');
    });

    it('finance est inaccessible au pasteur — permissions manquantes', () => {
      const access = engine.checkFeatureAccess('finance', ['pastor']);
      expect(access.available).toBe(false);
      expect(access.reason).toBe('missing-permission');
      expect(access.missingPermissions).toContain('transaction:create');
    });

    it('members_placeholder est indisponible — toggle off', () => {
      const access = engine.checkFeatureAccess('members_placeholder', ['admin']);
      expect(access.available).toBe(false);
      expect(access.reason).toBe('disabled');
    });

    it('feature inconnue → indisponible', () => {
      expect(engine.checkFeatureAccess('bogus', ['admin']).available).toBe(false);
    });

    it('requireFeature lève pour un accès refusé et passe pour un accès accordé', () => {
      expect(() => engine.requireFeature('finance', ['pastor'])).toThrow(CapabilityError);
      expect(() => engine.requireFeature('finance', ['treasurer'])).not.toThrow();
      expect(() => engine.requireFeature('members_placeholder', ['admin'])).toThrow(/indisponible/);
    });
  });
});
