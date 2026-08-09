/**
 * Vocabulary Engine — centralized term lookup from the compiled Org Manifest.
 *
 * Canonical sources: ADR-001 (Vocabulary Engine), DOC-000 (Manifest layer),
 * RTS-001 (VocabularyAccessPort). Terms are NEVER hardcoded in UI code
 * (INV-009): every label comes from the manifest via this engine.
 */
import type { OrgManifest, VocabularyNamespace, VocabularyTerm } from '../manifest/types';

export class VocabularyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VocabularyError';
  }
}

export interface VocabularyLabel {
  key: string;
  label: string;
}

export class VocabularyEngine {
  private readonly namespaces: Map<string, VocabularyNamespace>;
  private readonly defaultLocale: string;

  constructor(manifest: OrgManifest) {
    this.namespaces = new Map(manifest.vocabulary.map((ns) => [ns.id, ns]));
    this.defaultLocale = manifest.configuration.locale;
  }

  /** Build an engine from an already-compiled manifest. */
  static fromManifest(manifest: OrgManifest): VocabularyEngine {
    return new VocabularyEngine(manifest);
  }

  hasNamespace(namespaceId: string): boolean {
    return this.namespaces.has(namespaceId);
  }

  hasTerm(namespaceId: string, termKey: string): boolean {
    const ns = this.namespaces.get(namespaceId);
    return ns !== undefined && ns.terms.some((t) => t.key === termKey);
  }

  /** All namespace ids present in the manifest. */
  namespaceIds(): string[] {
    return [...this.namespaces.keys()];
  }

  /** Resolve the label for a term with a strict locale fallback chain. */
  private resolveLabel(term: VocabularyTerm, locale: string | undefined): string {
    const wanted = locale ?? this.defaultLocale;
    const label = term.label[wanted];
    if (label !== undefined && label !== '') return label;
    const defaultLabel = term.label[this.defaultLocale];
    if (defaultLabel !== undefined && defaultLabel !== '') return defaultLabel;
    const firstAvailable = Object.values(term.label).find((l) => l !== undefined && l !== '');
    if (firstAvailable !== undefined) return firstAvailable;
    return term.key;
  }

  /**
   * Lookup a term label. Throws VocabularyError when the namespace does not
   * exist (configuration problem — fail fast). Missing term within an existing
   * namespace falls back: requested locale → manifest default → first
   * available → the term key itself (never undefined).
   */
  lookup(namespaceId: string, termKey: string, locale?: string): string {
    const ns = this.requireNamespace(namespaceId);
    const term = ns.terms.find((t) => t.key === termKey);
    if (!term) {
      throw new VocabularyError(
        `Terme inconnu "${termKey}" dans le namespace "${namespaceId}" (langue: ${locale ?? this.defaultLocale})`,
      );
    }
    return this.resolveLabel(term, locale);
  }

  /** Same as lookup but returns undefined instead of throwing for a missing term. */
  lookupOrNull(namespaceId: string, termKey: string, locale?: string): string | undefined {
    if (!this.hasNamespace(namespaceId)) return undefined;
    const term = this.namespaces.get(namespaceId)!.terms.find((t) => t.key === termKey);
    if (!term) return undefined;
    return this.resolveLabel(term, locale);
  }

  /** All terms of a namespace as { key, label } pairs, translated. */
  labels(namespaceId: string, locale?: string): VocabularyLabel[] {
    const ns = this.requireNamespace(namespaceId);
    return ns.terms.map((t) => ({ key: t.key, label: this.resolveLabel(t, locale) }));
  }

  /**
   * Resolve a term by alias (case-insensitive, matches `aliases` or the key
   * itself). Returns undefined when no term matches.
   */
  resolveAlias(namespaceId: string, alias: string): VocabularyTerm | undefined {
    const ns = this.namespaces.get(namespaceId);
    if (!ns) return undefined;
    const normalized = alias.trim().toLowerCase();
    return ns.terms.find(
      (t) =>
        t.key.toLowerCase() === normalized ||
        (t.aliases ?? []).some((a) => a.toLowerCase() === normalized),
    );
  }

  private requireNamespace(namespaceId: string): VocabularyNamespace {
    const ns = this.namespaces.get(namespaceId);
    if (!ns) {
      throw new VocabularyError(`Namespace de vocabulaire inconnu: "${namespaceId}"`);
    }
    return ns;
  }
}
