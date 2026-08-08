/**
 * ManifestConflictResolver — unit tests (Phase A, AC A-4).
 *
 * Verifies: no-diff → null, diff detection, strategy recommendation,
 * merge (feature toggles), server-wins (version), manual-review escalation.
 *
 * Note: `jsondiffpatch` is ESM-only and cannot be loaded by jest's node env,
 * so it is mocked with realistic jsondiffpatch-shaped deltas.
 */
jest.mock('jsondiffpatch', () => ({ diff: jest.fn() }));

import { diff } from 'jsondiffpatch';
import { ManifestConflictResolver } from '../../../src/shared/offline-runtime/conflict-resolver';
import type { OfflineManifest } from '../../../src/shared/offline-runtime/types';

const mockDiff = diff as jest.Mock;

function makeManifest(version: number, overrides: Partial<OfflineManifest> = {}): OfflineManifest {
  return {
    version,
    orgId: 'org-1',
    deployedAt: '2026-08-08T00:00:00.000Z',
    features: [
      { id: 'finance', version: '1.0.0', toggleKey: 'k_finance', enabled: true, requiredPermissions: [] },
      { id: 'groups', version: '1.0.0', toggleKey: 'k_groups', enabled: false, requiredPermissions: [] },
    ],
    formSchemas: [],
    vocabulary: [],
    workflows: [],
    serverFetchedAt: '2026-08-08T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockDiff.mockReset();
});

describe('ManifestConflictResolver', () => {
  it('returns null when server and client manifests are identical', () => {
    mockDiff.mockReturnValue(undefined);
    const m = makeManifest(2);
    expect(ManifestConflictResolver.compare(m, makeManifest(2))).toBeNull();
  });

  it('detects a version difference and recommends a strategy', () => {
    mockDiff.mockReturnValue({ version: [2, 4] });
    const conflict = ManifestConflictResolver.compare(makeManifest(2), makeManifest(4));
    expect(conflict).not.toBeNull();
    expect(conflict!.differences.some((d) => d.path.includes('/version'))).toBe(true);
    expect(conflict!.recommendedStrategy).toBe('server-wins');
  });

  it('merges a feature toggle change (merge strategy: client value wins for scalars)', () => {
    mockDiff.mockReturnValue({ features: { 0: { enabled: [false, true] } } });
    const server = makeManifest(2, { features: [{ id: 'finance', version: '1.0.0', toggleKey: 'k_finance', enabled: false, requiredPermissions: [] }] });
    const client = makeManifest(2, { features: [{ id: 'finance', version: '1.0.0', toggleKey: 'k_finance', enabled: true, requiredPermissions: [] }] });

    const conflict = ManifestConflictResolver.compare(server, client);
    expect(conflict!.recommendedStrategy).toBe('merge');

    const merged = ManifestConflictResolver.merge(conflict!);
    expect(merged).not.toBeNull();
    expect(merged!.features[0].enabled).toBe(true);
  });

  it('keeps server version on version mismatch (server-wins)', () => {
    mockDiff.mockReturnValue({ version: [4, 2] });
    const conflict = ManifestConflictResolver.compare(makeManifest(4), makeManifest(2));
    const merged = ManifestConflictResolver.merge(conflict!);
    expect(merged?.version).toBe(4);
  });

  it('escalates to manual review for unknown paths', () => {
    mockDiff.mockReturnValue({ vocabulary: { 0: { key: ['x', 'y'] } } });
    const server = makeManifest(2, { vocabulary: [{ id: 'v1', orgId: 'org-1', category: 'statuses', key: 'x', label: { fr: 'X' }, createdAt: 'a', updatedAt: 'a' }] });
    const client = makeManifest(2, { vocabulary: [{ id: 'v1', orgId: 'org-1', category: 'statuses', key: 'y', label: { fr: 'Y' }, createdAt: 'a', updatedAt: 'a' }] });

    const conflict = ManifestConflictResolver.compare(server, client);
    expect(conflict).not.toBeNull();
    // Unknown path fallback → manual-review escalation → merge() returns null
    expect(ManifestConflictResolver.merge(conflict!)).toBeNull();
  });
});
