/**
 * OfflineRuntimeCache — unit tests (Phase A, AC A-4).
 *
 * Verifies the L1 → L2 → L3 cascade contract for manifests, vocab and forms.
 */
import { OfflineRuntimeCache } from '../../../src/shared/offline-runtime/cache';
import type {
  FormDefinition,
  L2Store,
  L3FileSystemStore,
  OfflineManifest,
  VocabularyEntry,
} from '../../../src/shared/offline-runtime/types';

function makeManifest(version: number, orgId = 'org-1'): OfflineManifest {
  return {
    version,
    orgId,
    deployedAt: `2026-08-0${version}T00:00:00.000Z`,
    features: [],
    formSchemas: [],
    vocabulary: [],
    workflows: [],
    serverFetchedAt: '2026-08-08T00:00:00.000Z',
  };
}

/** In-memory mock of the L2 (WatermelonDB) contract. */
class MemoryL2 implements L2Store {
  manifests = new Map<string, OfflineManifest>();
  vocab = new Map<string, VocabularyEntry[]>();
  forms = new Map<string, FormDefinition[]>();

  async getManifest(orgId: string): Promise<OfflineManifest | null> {
    return this.manifests.get(orgId) ?? null;
  }
  async setManifest(orgId: string, _version: number, data: OfflineManifest): Promise<void> {
    this.manifests.set(orgId, data);
  }
  async deleteManifest(orgId: string, _version: number): Promise<void> {
    this.manifests.delete(orgId);
  }
  async listManifestVersions(orgId: string): Promise<Array<{ version: number; deployedAt: string; serverFetchedAt: string }>> {
    const m = this.manifests.get(orgId);
    return m ? [{ version: m.version, deployedAt: m.deployedAt, serverFetchedAt: m.serverFetchedAt }] : [];
  }
  async getVocabularyEntry(orgId: string, category: string, key: string): Promise<VocabularyEntry | null> {
    return this.vocab.get(orgId)?.find((e) => e.category === category && e.key === key) ?? null;
  }
  async upsertVocabularyBatch(_orgId: string, _entries: VocabularyEntry[]): Promise<number> {
    return 0;
  }
  async getVocabulary(orgId: string, category: string): Promise<VocabularyEntry[]> {
    return (this.vocab.get(orgId) ?? []).filter((e) => e.category === category);
  }
  async getPendingOps(): Promise<never[]> {
    return [];
  }
  async enqueueOp(): Promise<void> {}
  async completeOp(): Promise<void> {}
  async purgeCompleted(): Promise<number> {
    return 0;
  }
  async getForms(orgId: string): Promise<FormDefinition[]> {
    return this.forms.get(orgId) ?? [];
  }
  async upsertForms(orgId: string, forms: FormDefinition[]): Promise<void> {
    this.forms.set(orgId, forms);
  }
}

/** In-memory mock of the L3 (file system) contract. */
class MemoryL3 implements L3FileSystemStore {
  files = new Map<string, OfflineManifest>();
  private key(orgId: string, version: number): string {
    return `${orgId}:${version}`;
  }
  async saveManifestFile(orgId: string, version: number, data: OfflineManifest): Promise<string> {
    this.files.set(this.key(orgId, version), data);
    return `file://${this.key(orgId, version)}`;
  }
  async loadManifestFile(orgId: string, version: number): Promise<OfflineManifest | null> {
    return this.files.get(this.key(orgId, version)) ?? null;
  }
  async exists(orgId: string, version: number): Promise<boolean> {
    return this.files.has(this.key(orgId, version));
  }
  async deleteManifestFile(orgId: string, version: number): Promise<void> {
    this.files.delete(this.key(orgId, version));
  }
  async getCacheDirUri(): Promise<string> {
    return 'file://cache';
  }
}

describe('OfflineRuntimeCache', () => {
  it('returns null when nothing is cached anywhere', async () => {
    const cache = new OfflineRuntimeCache(new MemoryL2(), new MemoryL3());
    expect(await cache.getManifest('org-1')).toBeNull();
  });

  it('setManifest writes through L1+L2 and snapshots L3; getManifest reads from L1', async () => {
    const l2 = new MemoryL2();
    const l3 = new MemoryL3();
    const cache = new OfflineRuntimeCache(l2, l3);
    const m = makeManifest(3);

    await cache.setManifest('org-1', 3, m);

    expect(await l2.getManifest('org-1')).toEqual(m);
    expect(await l3.exists('org-1', 3)).toBe(true);
    expect(await cache.getManifest('org-1', 3)).toEqual(m);
  });

  it('cascades L2 → L1 when L1 is empty', async () => {
    const l2 = new MemoryL2();
    const l3 = new MemoryL3();
    const m = makeManifest(2);
    await l2.setManifest('org-1', 2, m);
    const cache = new OfflineRuntimeCache(l2, l3);

    expect(await cache.getManifest('org-1')).toEqual(m);
    // Second read hits L1 (l2 unchanged)
    await l2.deleteManifest('org-1', 2);
    expect(await cache.getManifest('org-1')).toEqual(m);
  });

  it('cascades L3 when L2 misses', async () => {
    const l2 = new MemoryL2();
    const l3 = new MemoryL3();
    const m = makeManifest(5);
    await l3.saveManifestFile('org-1', 5, m);
    const cache = new OfflineRuntimeCache(l2, l3);

    expect(await cache.getManifest('org-1', 5)).toEqual(m);
  });

  it('invalidate(orgId, version) removes from L1 and L2', async () => {
    const l2 = new MemoryL2();
    const cache = new OfflineRuntimeCache(l2, new MemoryL3());
    await cache.setManifest('org-1', 4, makeManifest(4));

    await cache.invalidate('org-1', 4);

    expect(await cache.getManifest('org-1', 4)).toBeNull();
    expect(await l2.getManifest('org-1')).toBeNull();
  });

  it('getForms/deployForms round-trip and refreshFromServer detects changes', async () => {
    const l2 = new MemoryL2();
    const cache = new OfflineRuntimeCache(l2, new MemoryL3());
    const forms: FormDefinition[] = [
      {
        id: 'f1',
        orgId: 'org-1',
        version: 1,
        schema: { type: 'object' },
        fields: [{ key: 'amount', type: 'currency', required: true }],
        createdAt: '2026-08-08T00:00:00.000Z',
        updatedAt: '2026-08-08T00:00:00.000Z',
      },
    ];

    await cache.deployForms('org-1', forms);
    expect(await cache.getForms('org-1')).toEqual(forms);

    // Unchanged fetch → changed:false
    const unchanged = await cache.refreshFromServer('org-1', async () => makeManifest(1));
    expect(unchanged.changed).toBe(true); // first load: no local manifest → changed

    // After a load, an identical fetch → changed:false
    await cache.setManifest('org-1', 1, makeManifest(1));
    const same = await cache.refreshFromServer('org-1', async () => makeManifest(1));
    expect(same.changed).toBe(false);

    const bumped = await cache.refreshFromServer('org-1', async () => makeManifest(2));
    expect(bumped.changed).toBe(true);
    expect(bumped.version).toBe(2);
  });
});
