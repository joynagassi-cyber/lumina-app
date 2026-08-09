import { ManifestEngine } from '../../../src/shared/manifest';
import mfeJcManifest from '../../../src/shared/manifest/manifests/mfe-jc.json';
import { VocabularyEngine } from '../../../src/shared/vocabulary';
import { FormModel, DEFAULT_MESSAGES } from '../../../src/shared/forms/forms-engine';

describe('FormsEngine — core', () => {
  const manifest = new ManifestEngine().compile(mfeJcManifest);
  const vocab = VocabularyEngine.fromManifest(manifest);
  const form = manifest.forms.find((f) => f.id === 'transaction_create')!;
  const model = new FormModel(form);

  it('FormModel construit sur le formulaire transaction_create du manifest', () => {
    expect(model.form.fields).toHaveLength(6);
    expect(model.field('amount')?.type).toBe('currency');
    expect(model.field('category')?.optionsVocab).toBe('finance_categories');
  });

  describe('defaultValues', () => {
    it('produit des valeurs par défaut typées', () => {
      const values = model.defaultValues();
      expect(values.type).toBe('');
      expect(values.amount).toBe(1); // min: 1
      expect(values.category).toBe('');
      expect(values.date).toBe('');
      expect(values.groupId).toBe('');
      expect(values.description).toBe('');
    });
  });

  describe('coercition', () => {
    it('coerce currency en nombre, en nettoyant les séparateurs', () => {
      expect(model.coerce(model.field('amount')!, '12 500')).toBe(12500);
      expect(model.coerce(model.field('amount')!, '12,5')).toBe(12.5);
      expect(model.coerce(model.field('amount')!, 'abc')).toBeUndefined();
      expect(model.coerce(model.field('amount')!, '')).toBeUndefined();
    });

    it('coerce boolean depuis plusieurs formes', () => {
      const boolField = { key: 'flag', type: 'boolean' as const, required: false };
      expect(model.coerce(boolField, true)).toBe(true);
      expect(model.coerce(boolField, 'true')).toBe(true);
      expect(model.coerce(boolField, 1)).toBe(true);
      expect(model.coerce(boolField, '0')).toBe(false);
    });

    it('coerce multiselect en tableau', () => {
      const ms = { key: 'tags', type: 'multiselect' as const, required: false };
      expect(model.coerce(ms, ['a', 'b'])).toEqual(['a', 'b']);
      expect(model.coerce(ms, 'x')).toEqual([]);
    });
  });

  describe('validation', () => {
    it('champ requis vide → erreur', () => {
      expect(model.validateField(model.field('amount')!, undefined)).toBe(DEFAULT_MESSAGES.required);
      expect(model.validateField(model.field('amount')!, '')).toBe(DEFAULT_MESSAGES.required);
    });

    it('montant sous le min (1) → erreur', () => {
      expect(model.validateField(model.field('amount')!, 0)).toBe(DEFAULT_MESSAGES.min);
      expect(model.validateField(model.field('amount')!, 0.5)).toBe(DEFAULT_MESSAGES.min);
    });

    it('montant valide passe', () => {
      expect(model.validateField(model.field('amount')!, 5000)).toBeNull();
    });

    it('date invalide → erreur, date ISO valide passe', () => {
      expect(model.validateField(model.field('date')!, '31/12/2026')).toBe(DEFAULT_MESSAGES.date);
      expect(model.validateField(model.field('date')!, '2026-08-08')).toBeNull();
      expect(model.validateField(model.field('date')!, '2026-08-08T10:30:00Z')).toBeNull();
    });

    it('texte au-delà de max → erreur', () => {
      const textField = { key: 'desc', type: 'text' as const, required: false, max: 500 };
      expect(model.validateField(textField, 'x'.repeat(501))).toBe(DEFAULT_MESSAGES.max);
      expect(model.validateField(textField, 'x'.repeat(500))).toBeNull();
    });

    it('validationPattern appliqué sur le texte', () => {
      const email = { key: 'email', type: 'text' as const, required: true, validationPattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' };
      expect(model.validateField(email, 'pas-un-email')).toBe(DEFAULT_MESSAGES.pattern);
      expect(model.validateField(email, 'ok@exemple.org')).toBeNull();
    });

    it('champ optionnel vide passe', () => {
      expect(model.validateField(model.field('description')!, '')).toBeNull();
      expect(model.validateField(model.field('groupId')!, undefined)).toBeNull();
    });

    it('validate() retourne la map des erreurs, isValid() le booléen', () => {
      const errors = model.validate({ type: 'income', amount: 0, date: 'bad', description: '' });
      expect(errors.amount).toBe(DEFAULT_MESSAGES.min);
      expect(errors.date).toBe(DEFAULT_MESSAGES.date);
      expect(errors.type).toBeUndefined(); // select requis mais non vide ici
      const validValues = { type: 'income', amount: 5000, category: 'dime', date: '2026-08-08' };
      expect(model.validate(validValues)).toEqual({}); // champs optionnels absents = OK
      expect(model.isValid(validValues)).toBe(true);
      expect(model.isValid({})).toBe(false);
    });
  });

  describe('normalize — valeurs typées pour soumission', () => {
    it('ne garde que les champs du formulaire, coercés', () => {
      const normalized = model.normalize({
        type: 'income',
        amount: '12 500',
        category: 'dime',
        date: '2026-08-08',
        extra: 'ignored',
      });
      expect(normalized.amount).toBe(12500);
      expect(normalized.extra).toBeUndefined();
    });
  });

  describe('selectOptions — options pilotées par le vocabulaire (INV-009)', () => {
    it('les options du champ select viennent du namespace vocabulaire', () => {
      const options = model.selectOptions(model.field('type')!, vocab, 'fr');
      expect(options).toEqual([
        { key: 'income', label: 'Entrée' },
        { key: 'expense', label: 'Sortie' },
        { key: 'transfer', label: 'Transfert' },
      ]);
    });

    it('traduit les options en anglais', () => {
      const options = model.selectOptions(model.field('type')!, vocab, 'en');
      expect(options.find((o) => o.key === 'income')?.label).toBe('Income');
    });

    it('les catégories financières sont listées depuis le vocabulaire', () => {
      const categories = model.selectOptions(model.field('category')!, vocab, 'fr');
      expect(categories).toHaveLength(8);
      expect(categories[0]).toEqual({ key: 'dime', label: 'Dîme' });
    });

    it('champ sans optionsVocab → liste vide', () => {
      expect(model.selectOptions(model.field('description')!, vocab)).toEqual([]);
    });
  });
});
