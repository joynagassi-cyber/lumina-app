import { ManifestEngine } from '../../../src/shared/manifest';
import mfeJcManifest from '../../../src/shared/manifest/manifests/mfe-jc.json';
import { VocabularyEngine, VocabularyError } from '../../../src/shared/vocabulary';

describe('VocabularyEngine', () => {
  const manifest = new ManifestEngine().compile(mfeJcManifest);
  const engine = VocabularyEngine.fromManifest(manifest);

  describe('lookup — traductions FR/EN', () => {
    it('traduit un terme en français (locale par défaut du manifest)', () => {
      expect(engine.lookup('finance_categories', 'dime')).toBe('Dîme');
    });

    it('traduit un terme en anglais quand la locale est demandée', () => {
      expect(engine.lookup('finance_categories', 'dime', 'en')).toBe('Tithe');
    });

    it('traduit les états de transaction', () => {
      expect(engine.lookup('transaction_states', 'pending', 'fr')).toBe('En attente');
      expect(engine.lookup('transaction_states', 'approved', 'en')).toBe('Approved');
    });
  });

  describe('fallback chain', () => {
    it('retombe sur la locale par défaut du manifest quand la locale demandée est absente', () => {
      // 'offrande' n'a pas de clé 'de' → retombe sur 'fr' (locale par défaut)
      expect(engine.lookup('finance_categories', 'offrande', 'de')).toBe('Offrande');
    });

    it('retombe sur la première langue disponible si la locale par défaut manque aussi', () => {
      const sparse = new VocabularyEngine(
        new ManifestEngine().compile({
          ...mfeJcManifest,
          configuration: { ...mfeJcManifest.configuration, locale: 'xx' },
          vocabulary: [
            {
              id: 'sparse',
              terms: [{ key: 'only_en', label: { en: 'Only English' } }],
            },
          ],
        }),
      );
      expect(sparse.lookup('sparse', 'only_en', 'fr')).toBe('Only English');
    });

    it('retombe sur la clé elle-même si aucun label nest disponible (défense, hors schéma)', () => {
      // Le schéma impose minProperties:1 sur label — ce cas est donc une défense
      // en profondeur : on construit l\'engine directement, sans validation AJV.
      const empty = new VocabularyEngine({
        ...mfeJcManifest,
        vocabulary: [{ id: 'empty', terms: [{ key: 'bare_key', label: {} }] }],
      } as typeof mfeJcManifest);
      expect(empty.lookup('empty', 'bare_key')).toBe('bare_key');
    });
  });

  describe('labels()', () => {
    it('liste toutes les catégories financières traduites', () => {
      const labels = engine.labels('finance_categories', 'fr');
      expect(labels).toHaveLength(8);
      expect(labels[0]).toEqual({ key: 'dime', label: 'Dîme' });
      expect(labels.map((l) => l.key)).toContain('autre');
    });

    it('liste en anglais quand demandé', () => {
      const labels = engine.labels('finance_categories', 'en');
      expect(labels.find((l) => l.key === 'dime')?.label).toBe('Tithe');
    });
  });

  describe('aliases', () => {
    it('résout un alias non sensible à la casse', () => {
      const withAliases = new VocabularyEngine(
        new ManifestEngine().compile({
          ...mfeJcManifest,
          vocabulary: [
            {
              id: 'aliased',
              terms: [
                { key: 'dime', label: { fr: 'Dîme', en: 'Tithe' }, aliases: ['dixieme', 'tenth'] },
              ],
            },
          ],
        }),
      );
      expect(withAliases.resolveAlias('aliased', 'DIXIEME')?.key).toBe('dime');
      expect(withAliases.resolveAlias('aliased', 'tenth')?.key).toBe('dime');
      expect(withAliases.resolveAlias('aliased', 'dime')?.key).toBe('dime');
    });

    it('retourne undefined pour un alias inconnu', () => {
      expect(engine.resolveAlias('finance_categories', 'tithing')).toBeUndefined();
    });
  });

  describe('erreurs et garde-fous', () => {
    it('lève VocabularyError pour un namespace inconnu', () => {
      expect(() => engine.lookup('inexistant', 'x')).toThrow(VocabularyError);
      expect(() => engine.lookup('inexistant', 'x')).toThrow(/inconnu/);
    });

    it('lève VocabularyError pour un terme inconnu dans un namespace existant', () => {
      expect(() => engine.lookup('finance_categories', 'crypto')).toThrow(VocabularyError);
    });

    it('lookupOrNull ne lève jamais — undefined pour namespace/terme inconnu', () => {
      expect(engine.lookupOrNull('inexistant', 'x')).toBeUndefined();
      expect(engine.lookupOrNull('finance_categories', 'crypto')).toBeUndefined();
      expect(engine.lookupOrNull('finance_categories', 'dime')).toBe('Dîme');
    });

    it('hasNamespace / hasTerm / namespaces() reflètent le manifest', () => {
      expect(engine.hasNamespace('finance_categories')).toBe(true);
      expect(engine.hasNamespace('bogus')).toBe(false);
      expect(engine.hasTerm('finance_categories', 'dime')).toBe(true);
      expect(engine.hasTerm('finance_categories', 'crypto')).toBe(false);
      expect(engine.namespaceIds()).toEqual(
        expect.arrayContaining(['finance_categories', 'transaction_types', 'transaction_states', 'group_types']),
      );
    });
  });
});
