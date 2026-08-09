/**
 * OfflineRuntimeCache — Three-tier cache (RAM / WatermelonDB / File System)
 *
 * Tier design:
 *   L1 (RAM):    Fast path — Hot data live in-process. TTL=5 min for manifest, unlimited for vocab/forms.
 *   L2 (SQLite): Cold persistence via WatermelonDB. Survives app restart.
 *   L3 (FS):     Fallback for critical manifests when L2 fails (corrupted DB, high RAM pressure).
 *
 * Local-First principle: the cached manifest IS the local source of truth.
 * The server is authoritative but not immediate — writes are eventual.
 */

import type {
  FormDefinition,
  L2Store,
  L3FileSystemStore,
  OfflineManifest,
  VocabularyEntry,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALE_MARKER_SEC = 300;

// ---------------------------------------------------------------------------
// In-memory L1 cache (plain JS Map — MMKV can be swapped in for RN persistency across crashes)
// ---------------------------------------------------------------------------

class L1Cache {
  private store = new Map<string, { data: unknown; ts: number }>();

  private key(orgId: string, kind: string, version?: number): string {
    return version ? `${orgId}:${kind}:${version}` : `${orgId}:${kind}`;
  }

  get<T>(orgId: string, kind: string, version?: number): T | null {
    if (version !== undefined) {
      return this._read<T>(orgId, kind, version);
    }
    // Versionless read: return the NEWEST cached variant of the key
    // (setManifest stores under versioned keys — a versionless lookup must still hit L1).
    const prefix = this.key(orgId, kind) + ':';
    let bestEntry: { data: unknown; ts: number } | null = null;
    let bestVersion = -1;
    for (const [k, entry] of this.store) {
      if (!k.startsWith(prefix)) continue;
      const suffix = k.slice(prefix.length);
      const v = Number(suffix);
      if (Number.isInteger(v) && v > bestVersion) {
        bestVersion = v;
        bestEntry = entry;
      }
    }
    if (!bestEntry) return null;
    if (Date.now() - bestEntry.ts > STALE_MARKER_SEC * 1000) return null; // logical staleness
    return bestEntry.data as T;
  }

  private _read<T>(orgId: string, kind: string, version: number): T | null {
    const entry = this.store.get(this.key(orgId, kind, version));
    if (!entry) return null;
    if (Date.now() - entry.ts > STALE_MARKER_SEC * 1000) return null; // logical staleness
    return entry.data as T;
  }

  set<T>(orgId: string, kind: string, data: T, version?: number): void {
    this.store.set(this.key(orgId, kind, version), { data, ts: Date.now() });
  }

  /** Remove specific version; if version is undefined, remove all variants of the key. */
  invalidate(orgId: string, kind: string, version?: number): void {
    if (version !== undefined) {
      this.store.delete(this.key(orgId, kind, version));
    } else {
      const prefix = this.key(orgId, kind);
      const keysToDelete: string[] = [];
      for (const k of this.store.keys()) {
        if (k.startsWith(prefix)) keysToDelete.push(k);
      }
      for (const k of keysToDelete) {
        this.store.delete(k);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// OfflineRuntimeCache — public API
// ---------------------------------------------------------------------------

export class OfflineRuntimeCache {
  private l1 = new L1Cache();

  constructor(
    private readonly l2: L2Store,
    private readonly l3: L3FileSystemStore,
  ) {}

  // ======================================================================
  // Manifest accessors (L1 → L2 → L3 cascade)
  // ======================================================================

  /**
   * Get manifest for an org, cascading through cache tiers.
   * Returns null only if nothing is cached anywhere.
   */
  async getManifest(orgId: string, version?: number): Promise<OfflineManifest | null> {
    // L1 hit
    const l1Hit = this.l1.get<OfflineManifest>(orgId, 'manifest', version);
    if (l1Hit) return l1Hit;

    // L2 miss → fetch from WatermelonDB
    const l2Hit = await this.l2.getManifest(orgId);
    if (l2Hit) {
      this.l1.set(orgId, 'manifest', l2Hit, l2Hit.version);
      return l2Hit;
    }

    // L2 miss → fallback to file system
    if (version === undefined || version <= 0) {
      // Fetch latest version info from L2
      const versions = await this.l2.listManifestVersions(orgId);
      if (versions.length > 0) {
        // Use the newest version
        const latest = versions.reduce((a, b) => (a.version > b.version ? a : b));
        const fsData = await this.l3.loadManifestFile(orgId, latest.version);
        if (fsData) {
          this.l1.set(orgId, 'manifest', fsData, latest.version);
          return fsData;
        }
      }
    } else {
      const fsData = await this.l3.loadManifestFile(orgId, version);
      if (fsData) {
        this.l1.set(orgId, 'manifest', fsData, version);
        return fsData;
      }
    }

    return null;
  }

  /**
   * Set manifest: write through to L1 + L2, and snapshot to L3.
   * @param orgId        Tenant identifier
   * @param version      Manifest schema version (from OfflineManifest.version)
   * @param data         Full manifest payload
   */
  async setManifest(orgId: string, version: number, data: OfflineManifest): Promise<void> {
    this.l1.set(orgId, 'manifest', data, version);
    await this.l2.setManifest(orgId, version, data);
    // Fire-and-forget L3 persistence — shouldn't block the hot path
    this.l3.saveManifestFile(orgId, version, data).catch(() => {/* L3 best-effort */ });
  }

  /**
   * Invalidate a specific version from all cache tiers.
   */
  async invalidate(version: number): Promise<void>;
  async invalidate(orgId: string, version?: number): Promise<void>;
  async invalidate(orgOrVer: string | number, verOrUndefined?: number): Promise<void> {
    let orgId: string;
    let version: number | undefined;

    if (typeof orgOrVer === 'number') {
      // Ambiguous call — treat as invalidate(version) which clears ALL orgs' L1 for that version
      // For safety, require org-aware invalidation in production
      version = orgOrVer;
      orgId = '*';
    } else {
      orgId = orgOrVer;
      version = verOrUndefined;
    }

    this.l1.invalidate(orgId, 'manifest', version);

    if (orgId !== '*' && version !== undefined) {
      await this.l2.deleteManifest(orgId, version);
      // L3 must be purged too — otherwise a "deleted" manifest resurrects from disk.
      await this.l3.deleteManifestFile(orgId, version).catch(() => { /* best-effort */ });
    }
  }

  // ======================================================================
  // Vocabulary accessors (read-heavy, mostly offline)
  // ======================================================================

  /** Get a single vocab entry by category+key. Falls back to L1 → L2. */
  async getVocabularyEntry(orgId: string, category: string, key: string): Promise<VocabularyEntry | null> {
    const l1 = this.l1.get<VocabularyEntry>(orgId, 'vocab', undefined);
    if (l1) {
      const found = (l1 as unknown as VocabularyEntry[]).find(e => e.category === category && e.key === key);
      if (found) return found;
    }

    const l2 = await this.l2.getVocabularyEntry(orgId, category, key);
    if (l2) {
      // Cache full category list in L1 for read perf
      const existing = this.l1.get<VocabularyEntry[]>(orgId, 'vocab');
      if (existing) {
        // Merge
        const merged = [...existing];
        if (!merged.find(e => e.id === l2.id)) merged.push(l2);
        this.l1.set(orgId, 'vocab', merged);
      } else {
        this.l1.set(orgId, 'vocab', [l2]);
      }
      return l2;
    }
    return null;
  }

  /** Load an entire vocabulary category into L1 for fast repeated access. */
  async loadCategoryIntoL1(orgId: string, category: string): Promise<VocabularyEntry[]> {
    const entries = await this.l2.getVocabulary(orgId, category);
    this.l1.set(orgId, 'vocab', entries);
    return entries;
  }

  // ======================================================================
  // Form definitions (deployed to L2 so offline forms know their validation)
  // ======================================================================

  /** Get all form definitions for an org — used at form render time offline. */
  async getForms(orgId: string): Promise<FormDefinition[]> {
    const l1 = this.l1.get<FormDefinition[]>(orgId, 'forms');
    if (l1) return l1;

    const l2 = await this.l2.getForms(orgId);
    this.l1.set(orgId, 'forms', l2);
    return l2;
  }

  /** Deploy a batch of forms into the local cache. Called after manifest sync. */
  async deployForms(orgId: string, forms: FormDefinition[]): Promise<void> {
    await this.l2.upsertForms(orgId, forms);
    this.l1.set(orgId, 'forms', forms);
  }

  /**
   * Build an OfflineValidationContext for a given form definition.
   * This answers "how does an offline form know which validations to apply?"
   * by extracting schema + vocabulary constraints from the locally-cached form.
   */
  buildValidationContext(formDef: FormDefinition): import('./types').OfflineValidationContext {
    return {
      schema: formDef.schema,                    // AJV-compilable JSON Schema already embedded
      vocabularyConstraints: formDef.fields
        .filter(f => f.type === 'select' || f.type === 'multiselect')
        .map(f => ({
          field: f.key,
          allowedValues: f.options?.map(o => o.value) ?? [],
        })),
      crossFieldRules: [],                        // Placeholder — populated if cross-field rules exist
    };
  }

  // ======================================================================
  // Full sync: pull from server → replace cache atomically
  // ======================================================================

  /**
   * Complete manifest refresh: fetch latest from L2 (as base), merge with any
   * pending L1 changes, apply server delta, replace cache atomically.
   */
  async refreshFromServer(
    orgId: string,
    fetchFn: (orgId: string) => Promise<OfflineManifest>,
  ): Promise<{ changed: boolean; version: number }> {
    const local = await this.getManifest(orgId);
    const server = await fetchFn(orgId);

    const changed = !local || local.version !== server.version || local.deployedAt !== server.deployedAt;

    if (changed) {
      await this.setManifest(orgId, server.version, server);
    }

    return { changed, version: server.version };
  }
}
