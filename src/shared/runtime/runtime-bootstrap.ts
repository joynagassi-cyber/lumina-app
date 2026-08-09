/**
 * Lumina Runtime — bootstrap factory (pure, framework-agnostic).
 *
 * Composes the full engine graph from a compiled Org Manifest, per
 * RTS-001 (CompositionRoot) and ADR-001 (Platform Core): Manifest → Vocabulary
 * → Capability → Workflow → Feature Hot-Swap → Offline cache. The React
 * provider (./RuntimeProvider.tsx) wraps this factory and adds connectivity.
 *
 * Design rules honored:
 *  - Manifest is validated (AJV, NB-RULE-05) BEFORE anything is built.
 *  - INV-005: everything (labels, permissions, workflows, forms) comes from
 *    the manifest — nothing is hardcoded.
 *  - Fail-fast for configuration problems; graceful degradation for features
 *    (HotSwap rollback).
 */
import { ManifestEngine } from '../manifest';
import type { OrgManifest } from '../manifest/types';
import type { FeatureManifest, FeatureModule } from '../feature-hot-swap/types';
import { HotSwapEngine, type ErrorToastCallback } from '../feature-hot-swap/engine';
import { VocabularyEngine } from '../vocabulary';
import { CapabilityEngine } from '../capability';
import { WorkflowEngine } from '../workflow';
import { OfflineRuntimeCache } from '../offline-runtime/cache';
import type { L2Store, L3FileSystemStore, OfflineManifest, SyncOperation, SyncOperationType, VocabularyEntry, FormDefinition } from '../offline-runtime/types';

// ---------------------------------------------------------------------------
// In-memory L2/L3 fallback stores (used when no persistence adapter is wired)
// ---------------------------------------------------------------------------

class MemoryL2Store implements L2Store {
  private manifests = new Map<string, OfflineManifest>();
  private vocab = new Map<string, VocabularyEntry[]>();
  private forms = new Map<string, FormDefinition[]>();
  private ops = new Map<string, SyncOperation>();
  private completed: Array<{ op: SyncOperation; completedAt: number }> = [];

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
    return m ? [{ version: m.version, deployedAt: m.deployedAt, serverFetchedAt: m.serverFetchedAt ?? '' }] : [];
  }
  async getVocabularyEntry(orgId: string, categoryId: string, key: string): Promise<VocabularyEntry | null> {
    return (this.vocab.get(orgId) ?? []).find((e) => e.category === categoryId && e.key === key) ?? null;
  }
  async upsertVocabularyBatch(orgId: string, entries: VocabularyEntry[]): Promise<number> {
    const existing = this.vocab.get(orgId) ?? [];
    const byKey = new Map(existing.map((e) => [`${e.category}/${e.key}`, e]));
    for (const e of entries) byKey.set(`${e.category}/${e.key}`, e);
    this.vocab.set(orgId, [...byKey.values()]);
    return entries.length;
  }
  async getVocabulary(orgId: string, category: string): Promise<VocabularyEntry[]> {
    return (this.vocab.get(orgId) ?? []).filter((e) => e.category === category);
  }
  async getPendingOps(_type?: SyncOperationType, _orgId?: string): Promise<SyncOperation[]> {
    return [...this.ops.values()];
  }
  async enqueueOp(op: SyncOperation): Promise<void> {
    this.ops.set(op.id, op);
  }
  async completeOp(id: string): Promise<void> {
    const op = this.ops.get(id);
    if (op) {
      this.ops.delete(id);
      this.completed.push({ op, completedAt: Date.now() });
    }
  }
  async purgeCompleted(maxAgeMs: number): Promise<number> {
    const cutoff = Date.now() - maxAgeMs;
    const before = this.completed.length;
    this.completed = this.completed.filter((c) => c.completedAt > cutoff);
    return before - this.completed.length;
  }
  async getForms(orgId: string): Promise<FormDefinition[]> {
    return this.forms.get(orgId) ?? [];
  }
  async upsertForms(orgId: string, forms: FormDefinition[]): Promise<void> {
    this.forms.set(orgId, forms);
  }
}

class MemoryL3Store implements L3FileSystemStore {
  private files = new Map<string, OfflineManifest>();

  async saveManifestFile(orgId: string, version: number, data: OfflineManifest): Promise<string> {
    this.files.set(`${orgId}/${version}`, data);
    return `memory://manifests/${orgId}/${version}`;
  }
  async loadManifestFile(orgId: string, version: number): Promise<OfflineManifest | null> {
    return this.files.get(`${orgId}/${version}`) ?? null;
  }
  async exists(orgId: string, version: number): Promise<boolean> {
    return this.files.has(`${orgId}/${version}`);
  }
  async deleteManifestFile(orgId: string, version: number): Promise<void> {
    this.files.delete(`${orgId}/${version}`);
  }
  async getCacheDirUri(): Promise<string> {
    return 'memory://manifests';
  }
}

export const inMemoryStores = (): { l2: L2Store; l3: L3FileSystemStore } => ({
  l2: new MemoryL2Store(),
  l3: new MemoryL3Store(),
});

// ---------------------------------------------------------------------------
// Runtime assembly
// ---------------------------------------------------------------------------

export interface LuminaRuntimeOptions {
  /** Feature modules available for hot-swap mounting (registered by id). */
  modules?: FeatureModule[];
  onError?: ErrorToastCallback;
  l2Store?: L2Store;
  l3Store?: L3FileSystemStore;
}

export interface LuminaRuntime {
  manifest: OrgManifest;
  vocabulary: VocabularyEngine;
  capability: CapabilityEngine;
  workflow: WorkflowEngine;
  hotSwap: HotSwapEngine;
  offline: OfflineRuntimeCache;
  /** Cache the compiled manifest into L2/L3 for offline startup. */
  persistManifest(): Promise<void>;
  /** Clean up subscriptions and listeners. */
  dispose(): void;
}

/** Adapt the manifest's feature entries to the HotSwap FeatureManifest shape. */
export function toFeatureManifest(manifest: OrgManifest): FeatureManifest {
  return {
    version: manifest.version,
    deployedAt: manifest.deployedAt,
    features: manifest.features.map((f) => ({
      id: f.id,
      version: f.version,
      toggleKey: f.toggleKey,
      enabled: f.enabled,
      requiredPermissions: f.requiredPermissions,
    })),
  };
}

/** Adapt the compiled manifest to the OfflineManifest (persistence) shape. */
export function toOfflineManifest(manifest: OrgManifest): OfflineManifest {
  const now = new Date().toISOString();
  const serverFetchedAt = manifest.serverFetchedAt ?? manifest.deployedAt ?? now;
  return {
    version: manifest.version,
    orgId: manifest.orgId,
    deployedAt: manifest.deployedAt,
    features: manifest.features.map((f) => ({
      id: f.id,
      version: f.version,
      toggleKey: f.toggleKey,
      enabled: f.enabled,
      requiredPermissions: f.requiredPermissions,
    })),
    formSchemas: manifest.forms.map((form) => ({
      id: form.id,
      orgId: manifest.orgId,
      version: manifest.version,
      schema: {}, // extraction JSON Schema complète : scope Phase D
      fields: form.fields.map((f) => ({
        key: f.key,
        type: f.type,
        required: f.required,
        min: f.min,
        max: f.max,
        validationPattern: f.validationPattern,
      })),
      createdAt: manifest.deployedAt,
      updatedAt: manifest.deployedAt,
    })),
    vocabulary: manifest.vocabulary.flatMap((ns) =>
      ns.terms.map((term) => ({
        id: `${ns.id}:${term.key}`,
        orgId: manifest.orgId,
        category: ns.id,
        key: term.key,
        label: term.label,
        aliases: term.aliases,
        createdAt: manifest.deployedAt,
        updatedAt: manifest.deployedAt,
      })),
    ),
    workflows: manifest.workflows.map((wf) => ({
      id: wf.id,
      name: wf.name,
      version: wf.version,
      nodes: wf.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        config: {},
        transitions: n.transitions,
      })),
      createdAt: manifest.deployedAt,
      updatedAt: manifest.deployedAt,
    })),
    serverFetchedAt,
  };
}

/**
 * Bootstrap the complete runtime from raw manifest data.
 * Throws ManifestValidationError when the manifest is invalid (fail fast);
 * feature activation failures degrade gracefully (HotSwap rollback).
 */
export function createLuminaRuntime(raw: unknown, options: LuminaRuntimeOptions = {}): LuminaRuntime {
  const manifest = new ManifestEngine().compile(raw);

  const vocabulary = VocabularyEngine.fromManifest(manifest);
  const capability = CapabilityEngine.fromManifest(manifest);
  const workflow = WorkflowEngine.fromManifest(manifest);

  const hotSwap = new HotSwapEngine({ onError: options.onError });
  hotSwap.loadManifest(toFeatureManifest(manifest));
  for (const module of options.modules ?? []) {
    hotSwap.registerModule(module);
  }

  // Activate only features that are enabled AND have a registered module —
  // unregistered features are silent (they will be wired in Phase D).
  const modulesById = new Map((options.modules ?? []).map((m) => [m.id, m]));
  for (const feature of manifest.features) {
    if (feature.enabled && modulesById.has(feature.id)) {
      hotSwap.activateFeature(feature.id);
    }
  }

  const stores = options.l2Store && options.l3Store ? { l2: options.l2Store, l3: options.l3Store } : inMemoryStores();
  const offline = new OfflineRuntimeCache(stores.l2, stores.l3);

  return {
    manifest,
    vocabulary,
    capability,
    workflow,
    hotSwap,
    offline,
    async persistManifest() {
      await stores.l2.setManifest(manifest.orgId, manifest.version, toOfflineManifest(manifest));
      await stores.l3.saveManifestFile(manifest.orgId, manifest.version, toOfflineManifest(manifest));
    },
    dispose() {
      hotSwap.fullRollback();
    },
  };
}
