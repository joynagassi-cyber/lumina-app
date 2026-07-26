/**
 * ManifestConflictResolver — merges two diverged manifest copies offline.
 *
 * Problem: Two admins edit the manifest simultaneously on different devices,
 * both go offline, then come back online. Server has version N+1, device A has
 * N+2 (changes to feature toggles), device B also has N+3 (changes to vocabulary).
 *
 * Strategy: structural diff via jsondiffpatch → categorize changes by mutation type →
 * apply per-change conflict strategy → produce merged manifest or escalate for manual review.
 */

import { diff } from 'jsondiffpatch';
import type { ConflictStrategy, FieldDifference, ManifestConflict, OfflineManifest } from './types';

// ---------------------------------------------------------------------------
// Change categories with default strategies
// ---------------------------------------------------------------------------

const STRATEGY_MAP: Record<string, ConflictStrategy> = {
  '/enabled':         'merge',           // feature toggle changes merge safely
  '/version':         'server-wins',     // server-managed feature versions
  '/schema':          'server-wins',     // schema mismatch is dangerous
  '/label':           'merge',           // vocab labels are org-specific
  '/deployedAt':      'server-wins',     // timestamps always server-authoritative
  '/requiredPermissions': 'merge',       // permission sets merge via union
  '/id':              'server-wins',     // IDs must not collide
  '/*':               'manual-review',   // catch-all for unknown paths
};

export class ManifestConflictResolver {
  /**
   * Compare two manifests and produce a conflict report.
   * If no differences exist, returns null (no conflict).
   */
  static compare(
    server: OfflineManifest,
    client: OfflineManifest,
  ): ManifestConflict | null {
    const delta = diff(server, client);
    if (!delta) return null;

    const differences: FieldDifference[] = [];
    this._walkDiff(delta, '/', differences);

    if (differences.length === 0) return null;

    const recommended = this._recommendStrategy(differences);
    const summary = this._buildSummary(differences, client.version);

    return {
      serverManifest: server,
      clientManifest: client,
      differences,
      recommendedStrategy: recommended,
      summary,
    };
  }

  /**
   * Attempt an automated merge when strategy allows it.
   * Returns merged manifest or null if manual review required.
   */
  static merge(conflict: ManifestConflict): OfflineManifest | null {
    if (conflict.recommendedStrategy === 'manual-review') return null;

    // Deep-clone server base
    const result: Record<string, unknown> = JSON.parse(JSON.stringify(conflict.serverManifest));

    for (const d of conflict.differences) {
      const strategy = this._strategyForPath(d.path);

      switch (strategy) {
        case 'server-wins':
          // server value already in result — skip
          break;

        case 'client-wins':
          this._applyAtPath(result, d.path, d.clientValue);
          break;

        case 'merge': {
          // For arrays, union them; for scalars, keep client; for objects, deep merge
          if (Array.isArray(d.clientValue) && Array.isArray(d.serverValue)) {
            const mergedArr = [...new Set([...(d.serverValue as unknown[]), ...(d.clientValue as unknown[])])];
            this._applyAtPath(result, d.path, mergedArr);
          } else if (
            typeof d.clientValue === 'object' &&
            d.clientValue !== null &&
            typeof d.serverValue === 'object' &&
            d.serverValue !== null
          ) {
            this._deepMergeAtPath(
              result,
              d.path,
              d.clientValue as Record<string, unknown>,
            );
          } else {
            this._applyAtPath(result, d.path, d.clientValue);
          }
          break;
        }

        case 'manual-review':
          return null;
      }
    }

    return result as unknown as OfflineManifest;
  }

  // --------------------------------------------------------------------------
  // Internals — walk a jsondiffpatch delta tree into flat path-level diffs
  // --------------------------------------------------------------------------

  private static _walkDiff(delta: unknown, path: string, out: FieldDifference[]): void {
    if (delta === undefined || delta === null) return;

    if (Array.isArray(delta)) {
      // jsondiffpatch array diff: [left, right] or [splice_ops, left, right]
      // At top level we care about [removed_item, added_item] pairs
      const left = delta[0] as unknown;
      const right = delta[1] as unknown;
      if (left !== undefined && right === undefined) {
        out.push({ path, serverValue: left, clientValue: undefined });
      } else if (left === undefined && right !== undefined) {
        out.push({ path, serverValue: undefined, clientValue: right });
      } else if (left !== undefined && right !== undefined && !this._valuesEqual(left, right)) {
        out.push({ path, serverValue: left, clientValue: right });
      }
      return;
    }

    if (typeof delta === 'object') {
      const obj = delta as Record<string, unknown>;
      for (const [key, val] of Object.entries(obj)) {
        this._walkDiff(val, `${path}/${key}`, out);
      }
    }
  }

  private static _valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object' && a !== null && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }

  private static _strategyForPath(path: string): ConflictStrategy {
    for (const [pattern, strategy] of Object.entries(STRATEGY_MAP)) {
      if (pattern === '/*') continue; // handled last
      if (path.includes(pattern.slice(1))) return strategy;
    }
    return STRATEGY_MAP['/*'] ?? 'manual-review';
  }

  private static _recommendStrategy(diffs: FieldDifference[]): ConflictStrategy {
    for (const d of diffs) {
      if (this._strategyForPath(d.path) === 'manual-review') return 'manual-review';
    }
    for (const d of diffs) {
      if (this._strategyForPath(d.path) === 'merge') return 'merge';
    }
    return 'server-wins';
  }

  private static _buildSummary(diffs: FieldDifference[], clientVersion: number): string {
    const counts = new Map<string, number>();
    for (const d of diffs) {
      const s = this._strategyForPath(d.path);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const parts = [...counts.entries()].map(([s, c]) => `${c}x ${s}`);
    return `Conflict at manifest v${clientVersion}: ${parts.join(', ')}.`;
  }

  private static _applyAtPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('/').filter(Boolean);
    let current: unknown = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current && typeof current === 'object') {
        const key = parts[i];
        if (key in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[key];
        } else {
          (current as Record<string, unknown>)[key] = {};
          current = (current as Record<string, unknown>)[key];
        }
      }
    }
    if (current && typeof current === 'object') {
      (current as Record<string, unknown>)[parts[parts.length - 1]] = value;
    }
  }

  private static _deepMergeAtPath(
    obj: Record<string, unknown>,
    path: string,
    value: Record<string, unknown>,
  ): void {
    const parts = path.split('/').filter(Boolean);
    let current: unknown = obj;
    for (const part of parts.slice(0, -1)) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      }
    }
    if (current && typeof current === 'object') {
      Object.assign(current as Record<string, unknown>, value);
    }
  }
}
