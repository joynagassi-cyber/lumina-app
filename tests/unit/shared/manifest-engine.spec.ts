/**
 * ManifestEngine — unit tests (Phase B, AC B-1).
 *
 * Verifies NB-RULE-05: AJV validation before compilation; the real MFE-JC
 * manifest compiles; invalid manifests throw with structured errors.
 */
import { ManifestEngine, ManifestValidationError } from '../../../src/shared/manifest';
import mfeJcManifest from '../../../src/shared/manifest/manifests/mfe-jc.json';

describe('ManifestEngine', () => {
  const engine = new ManifestEngine();

  it('compiles the real MFE-JC manifest', () => {
    const compiled = engine.compile(mfeJcManifest);
    expect(compiled.orgId).toBe('mfe-jc');
    expect(compiled.branding.accent).toBe('#FF6B00');
    expect(compiled.configuration.currency).toBe('XAF');
    expect(compiled.features.find((f) => f.id === 'finance')?.enabled).toBe(true);
    expect(compiled.workflows[0].id).toBe('transaction_state_machine');
  });

  it('exposes the finance vocabulary for the Forms engine', () => {
    const compiled = engine.compile(mfeJcManifest);
    const categories = compiled.vocabulary.find((v) => v.id === 'finance_categories')!;
    expect(categories.terms.map((t) => t.key)).toContain('dime');
    expect(categories.terms.find((t) => t.key === 'dime')?.label.fr).toBe('Dîme');
  });

  it('compiles from a JSON string', () => {
    const compiled = engine.compileFromJson(JSON.stringify(mfeJcManifest));
    expect(compiled.orgId).toBe('mfe-jc');
  });

  it('rejects an invalid manifest (missing required field) with structured errors', () => {
    const broken = { ...mfeJcManifest, name: undefined };
    expect(() => engine.compile(broken)).toThrow(ManifestValidationError);
    try {
      engine.compile(broken);
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestValidationError);
      expect((err as ManifestValidationError).errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects an invalid accent color', () => {
    const broken = { ...mfeJcManifest, branding: { ...mfeJcManifest.branding, accent: 'orange' } };
    expect(() => engine.compile(broken)).toThrow(/accent|pattern|format/i);
  });

  it('rejects invalid JSON text with a parse error', () => {
    expect(() => engine.compileFromJson('{ not json')).toThrow(ManifestValidationError);
  });
});
