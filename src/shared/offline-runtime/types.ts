/**
 * Offline Runtime Types
 *
 * Contract for the Local-First manifest cache, version stack, conflict resolution,
 * and async sync queue. Every cached entity is typed strictly — no `any`.
 *
 * Compatible with: React Native + WatermelonDB + @react-native-community/netinfo + MMKV.
 */

// ---------------------------------------------------------------------------
// Manifest shape (extends feature-hot-swap/types.ts FeatureManifest)
// ---------------------------------------------------------------------------

export interface FormDefinition {
  id: string;
  orgId: string;
  version: number;
  schema: Record<string, unknown>;   // JSON Schema Draft-7 embedded for offline validation
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}

export interface FormField {
  key: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'currency' | 'richtext';
  required: boolean;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
  validationPattern?: string;         // regex string for text/phone
  defaultValue?: unknown;
}

export interface VocabularyEntry {
  id: string;
  orgId: string;
  category: string;                 // e.g. 'statuses', 'categories', 'custom_fields'
  key: string;
  label: Record<string, string>;    // i18n-safe: locale → display label
  aliases?: string[];               // synonym lookup
  createdAt: string;
  updatedAt: string;
}

/** The full OfflineManifest that every cached copy must conform to. */
export interface OfflineManifest {
  version: number;                   // schema version of the manifest itself
  orgId: string;
  deployedAt: string;                // ISO timestamp of last server-side deploy
  features: Array<{
    id: string;
    version: string;
    toggleKey: string;
    enabled: boolean;
    requiredPermissions: string[];
    deps?: Record<string, string>;
  }>;
  /** JSON Schemas extracted from every active form — enables offline validation. */
  formSchemas: FormDefinition[];
  /** Full vocabulary snapshot for every category — enables offline lookups. */
  vocabulary: VocabularyEntry[];
  /** Workflows referenced by features — lightweight DAG definitions stored locally. */
  workflows: WorkflowDefinition[];
  /** When this manifest was fetched from server (for TTL). */
  serverFetchedAt: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  nodes: Array<{
    id: string;
    type: 'start' | 'task' | 'approval' | 'transition' | 'end';
    config: Record<string, unknown>;
    transitions: string[];          // node ids this can transition to
  }>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Sync operation types (pending writes queue)
// ---------------------------------------------------------------------------

export type SyncOperationType =
  | 'manifest_pull'
  | 'manifest_push'
  | 'form_sync'
  | 'vocabulary_sync'
  | 'feature_toggle_change'
  | 'vocab_entry_upsert'
  | 'vocab_entry_delete';

export interface SyncOperation<T = unknown> {
  id: string;                      // UUID v4 generated client-side
  type: SyncOperationType;
  orgId: string;
  payload: T;
  createdAt: string;
  completedAt?: string;            // populated after server ack
  conflictResolution?: ConflictStrategy;
}

export type ConflictStrategy = 'server-wins' | 'client-wins' | 'merge' | 'manual-review';

// ---------------------------------------------------------------------------
// Connectivity states
// ---------------------------------------------------------------------------

export type ConnectivityLevel = 'online' | 'offline' | 'metered' | 'unknown';

export interface ConnectivityState {
  level: ConnectivityLevel;
  internetReachable: boolean;
  details: {
    type: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
    /** Bandwidth estimate in Mbps (null = unknown) */
    bandwidthMbps: number | null;
    /** True on metered networks — triggers delta-only sync */
    isMetered: boolean;
  };
}

// ---------------------------------------------------------------------------
// Cache layers
// ---------------------------------------------------------------------------

/** L1: In-memory RAM cache. Keyed by orgId + version. */
export interface CacheEntry<T> {
  data: T;
  /** Wall-clock epoch when this entry was loaded into L1 */
  cachedAtEpoch: number;
}

/** L2: WatermelonDB persistence layer contract. */
export interface L2Store {
  /** Get manifest for an org; null if not cached. */
  getManifest(orgId: string): Promise<OfflineManifest | null>;
  /** Upsert manifest. */
  setManifest(orgId: string, version: number, data: OfflineManifest): Promise<void>;
  /** Delete a specific manifest version. */
  deleteManifest(orgId: string, version: number): Promise<void>;
  /** List all stored manifest versions for an org (for version stack). */
  listManifestVersions(orgId: string): Promise<Array<{ version: number; deployedAt: string; serverFetchedAt: string }>>;
  /** Get vocab entry. */
  getVocabularyEntry(orgId: string, categoryId: string, key: string): Promise<VocabularyEntry | null>;
  /** Upsert vocab entries in bulk. */
  upsertVocabularyBatch(orgId: string, entries: VocabularyEntry[]): Promise<number>;
  /** Get all vocab for a category. */
  getVocabulary(orgId: string, category: string): Promise<VocabularyEntry[]>;
  /** Get pending sync operations filtered by type or org. */
  getPendingOps(type?: SyncOperationType, orgId?: string): Promise<SyncOperation[]>;
  /** Enqueue an operation. */
  enqueueOp(op: SyncOperation): Promise<void>;
  /** Mark an operation as completed. */
  completeOp(id: string): Promise<void>;
  /** Remove completed ops older than this many ms. */
  purgeCompleted(maxAgeMs: number): Promise<number>;
  /** Get form definitions for a given org. */
  getForms(orgId: string): Promise<FormDefinition[]>;
  /** Upsert form definitions. */
  upsertForms(orgId: string, forms: FormDefinition[]): Promise<void>;
}

/** L3: File-system store (Expo FileSystem). Used as fallback when L2 unavailable. */
export interface L3FileSystemStore {
  /** Persist a manifest JSON blob to local file. Returns file URI. */
  saveManifestFile(orgId: string, version: number, data: OfflineManifest): Promise<string>;
  /** Read manifest from file system. Returns null if missing. */
  loadManifestFile(orgId: string, version: number): Promise<OfflineManifest | null>;
  /** Check if file exists. */
  exists(orgId: string, version: number): Promise<boolean>;
  /** Delete a manifest file (cache invalidation). */
  deleteManifestFile(orgId: string, version: number): Promise<void>;
  /** Get cache directory URI. */
  getCacheDirUri(): Promise<string>;
}

// ---------------------------------------------------------------------------
// Conflict resolution types
// ---------------------------------------------------------------------------

export interface ManifestConflict {
  /** Version from the server. */
  serverManifest: OfflineManifest;
  /** Version from the local device. */
  clientManifest: OfflineManifest;
  /** List of fields that differ between the two. */
  differences: FieldDifference[];
  /** Recommended strategy based on field type. */
  recommendedStrategy: ConflictStrategy;
  /** Human-readable summary for UI display. */
  summary: string;
}

export interface FieldDifference {
  path: string;                // JSON pointer, e.g. "/features/2/enabled"
  serverValue: unknown;
  clientValue: unknown;
}

// ---------------------------------------------------------------------------
// Validation context (offline form knows which validators to apply)
// ---------------------------------------------------------------------------

export interface OfflineValidationContext {
  /** The JSON Schema compiled locally (via AJV). Carried in the form definition. */
  schema: Record<string, unknown>;
  /** Vocabulary-based enum constraints resolved at runtime. */
  vocabularyConstraints: Array<{ field: string; allowedValues: string[] }>;
  /** Cross-field rules defined in the form but not expressible in JSON Schema. */
  crossFieldRules: Array<{
    condition: string;           // e.g. "field_A != null -> field_B required"
    targetField: string;
  }>;
}
