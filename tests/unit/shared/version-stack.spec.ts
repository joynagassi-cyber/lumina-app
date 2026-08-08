/**
 * VersionStack — unit tests (Phase A, AC A-4).
 *
 * Verifies: append, idempotence, newest-first listing, pruning to max, rollback.
 */
import { VersionStack, type VersionStackStore } from '../../../src/shared/offline-runtime/version-stack';
import type { OfflineManifest } from '../../../src/shared/offline-runtime/types';

function makeManifest(version: number): OfflineManifest {
  return {
    version,
    orgId: 'org-1',
    deployedAt: `2026-08-0${version}T00:00:00.000Z`,
    features: [],
    formSchemas: [],
    vocabulary: [],
    workflows: [],
    serverFetchedAt: '2026-08-08T00:00:00.000Z',
  };
}

class MemoryStackStore implements VersionStackStore {
  versions = new Map<number, OfflineManifest>();

  async getAllVersions(orgId: string): Promise<Array<{ version: number; orgId?: string; deployedAt: string; serverFetchedAt: string }>> {
    return [...this.versions.values()]
      .filter((m) => m.orgId === orgId)
      .map((m) => ({ version: m.version, deployedAt: m.deployedAt, serverFetchedAt: m.serverFetchedAt }));
  }
  async getVersion(orgId: string, version: number): Promise<OfflineManifest | null> {
    const m = this.versions.get(version);
    return m && m.orgId === orgId ? m : null;
  }
  async saveVersion(orgId: string, data: OfflineManifest): Promise<void> {
    this.versions.set(data.version, data);
  }
  async deleteVersion(orgId: string, version: number): Promise<void> {
    this.versions.delete(version);
  }
}

describe('VersionStack', () => {
  it('appends versions and lists them newest-first', async () => {
    const store = new MemoryStackStore();
    const stack = new VersionStack(store);

    await stack.append('org-1', makeManifest(1));
    await stack.append('org-1', makeManifest(3));
    await stack.append('org-1', makeManifest(2));

    const list = await stack.list('org-1');
    expect(list.map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it('is idempotent on duplicate versions', async () => {
    const store = new MemoryStackStore();
    const stack = new VersionStack(store);

    await stack.append('org-1', makeManifest(2));
    const dup = await stack.append('org-1', makeManifest(2));

    expect(dup).toBe(false);
    expect((await stack.list('org-1')).length).toBe(1);
  });

  it('prunes to maxStored (default 3), removing the oldest first', async () => {
    const store = new MemoryStackStore();
    const stack = new VersionStack(store);

    for (let v = 1; v <= 5; v++) {
      await stack.append('org-1', makeManifest(v));
    }

    const versions = (await stack.list('org-1')).map((v) => v.version);
    expect(versions).toEqual([5, 4, 3]);
  });

  it('rolls back to a previous version via rollbackTo and get', async () => {
    const store = new MemoryStackStore();
    const stack = new VersionStack(store);
    await stack.append('org-1', makeManifest(1));
    await stack.append('org-1', makeManifest(2));

    const rolled = await stack.rollbackTo('org-1', 1);
    expect(rolled?.version).toBe(1);
    expect((await stack.get('org-1', 1))?.version).toBe(1);
  });

  it('current() returns the newest manifest with its data', async () => {
    const store = new MemoryStackStore();
    const stack = new VersionStack(store);
    await stack.append('org-1', makeManifest(1));
    await stack.append('org-1', makeManifest(2));

    const cur = await stack.current('org-1');
    expect(cur?.version).toBe(2);
    expect(cur?.data.version).toBe(2);
  });
});
