/**
 * VersionStack — keeps the last N manifests locally for rollback.
 *
 * Design decisions:
 * - Fixed cap (default 3). Rationale: 3 covers a full release cycle
 *   (current + 2 prior) without unbounded storage growth.
 * - Each version is stored independently in L2 and L3 so rollback is O(1)
 *   and doesn't require re-computation.
 * - Immutable: once written, versions are never modified — only read or pruned.
 */

import type { OfflineManifest } from './types';

// ---------------------------------------------------------------------------
// Minimal store interface for VersionStack (decoupled from full L2Store)
// ---------------------------------------------------------------------------

export interface VersionStackStore {
  getAllVersions(orgId: string): Promise<Array<{
    version: number;
    orgId?: string;
    deployedAt: string;
    serverFetchedAt: string;
  }>>;
  getVersion(orgId: string, version: number): Promise<OfflineManifest | null>;
  saveVersion(orgId: string, data: OfflineManifest): Promise<void>;
  deleteVersion(orgId: string, version: number): Promise<void>;
}

// ---------------------------------------------------------------------------
// VersionStack
// ---------------------------------------------------------------------------

export class VersionStack {
  private readonly maxStored: number;

  constructor(private readonly store: VersionStackStore, maxStored: number = 3) {
    this.maxStored = maxStored;
  }

  // ======================================================================
  // Core operations
  // ======================================================================

  /**
   * Append a new manifest version to the stack, pruning if above max.
   * Idempotent: duplicate version numbers are skipped.
   */
  async append(orgId: string, data: OfflineManifest): Promise<boolean> {
    const existing = await this.store.getAllVersions(orgId);
    const hasVersion = existing.some(v => v.version === data.version);
    if (hasVersion) return false;

    await this.store.saveVersion(orgId, data);
    await this._prune(orgId);
    return true;
  }

  /** Get all stored versions sorted newest-first. */
  async list(orgId: string): Promise<Array<{
    version: number;
    deployedAt: string;
    serverFetchedAt: string;
  }>> {
    const all = await this.store.getAllVersions(orgId);
    return all.sort((a, b) => b.version - a.version);
  }

  /** Load full manifest data for a specific version. */
  async get(orgId: string, version: number): Promise<OfflineManifest | null> {
    return this.store.getVersion(orgId, version);
  }

  /** Rollback to a previous version. Returns the rolled-back manifest. */
  async rollbackTo(orgId: string, version: number): Promise<OfflineManifest | null> {
    return this.store.getVersion(orgId, version);
  }

  /** Delete a specific version from the stack. */
  async remove(orgId: string, version: number): Promise<void> {
    await this.store.deleteVersion(orgId, version);
  }

  // ======================================================================
  // Pruning
  // ======================================================================

  private async _prune(orgId: string): Promise<void> {
    const all = await this.store.getAllVersions(orgId);
    if (all.length <= this.maxStored) return;

    // Sort oldest first and remove excess
    const toRemove = all
      .sort((a, b) => a.version - b.version)
      .slice(0, all.length - this.maxStored);

    for (const entry of toRemove) {
      await this.store.deleteVersion(orgId, entry.version);
    }
  }

  /** Get the current (newest) manifest version metadata. */
  async current(orgId: string): Promise<{
    version: number;
    deployedAt: string;
    serverFetchedAt: string;
    data: OfflineManifest;
  } | null> {
    const all = await this.store.getAllVersions(orgId);
    if (all.length === 0) return null;
    const newest = all.reduce((a, b) => (a.version > b.version ? a : b));
    const data = await this.store.getVersion(orgId, newest.version);
    if (!data) return null;
    return { ...newest, data };
  }
}
