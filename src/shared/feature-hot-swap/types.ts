/**
 * Feature Hot-Swap Types
 *
 * Contract for every feature module that can be dynamically mounted,
 * unmounted, and hot-swapped at runtime without app restart.
 */

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

export interface FeatureModule {
  /** Stable identifier, e.g. "finance_ledger_v1" */
  id: string;

  /** Arbitrary version string / semver */
  version: string;

  /** Feature-toggle name that controls visibility in the manifest */
  toggleKey: string;

  /** Called once when the feature becomes active.
   * Register routes, subscribe to WatermelonDB, attach navigation hooks. */
  mount(): UnmountHandle;

  /** Tears down everything mount() set up. MUST be idempotent. */
  unmount(): void;

  /** Returns true if the module can safely run on this device/state.
   * Used during activation to pre-validate before swapping. */
  validate(): boolean;

  /** Optional: called when a running instance of this feature must pause
   * because its manifest changed. Save all state so resume() can continue. */
  pause?(): Promise<void>;

  /** Optional: restore from a previous pause(). */
  resume?(): Promise<void>;
}

/** Return value of mount(): a function that cleans up that specific mount. */
export type UnmountHandle = () => void;

// ---------------------------------------------------------------------------
// Manifest (authoritative source of truth; admin edits this)
// ---------------------------------------------------------------------------

export interface FeatureManifestEntry {
  /** Must match FeatureModule.id */
  id: string;

  /** Semver version deployed for this feature */
  version: string;

  /** Feature-toggle key (from `toggleKey` of the module) */
  toggleKey: string;

  /** Is this feature enabled right now? */
  enabled: boolean;

  /** Minimum required permissions for this feature */
  requiredPermissions: string[];

  /** Snapshot of the module's dependencies at build time (for rollback) */
  deps?: Record<string, string>;
}

export interface FeatureManifest {
  version: number;                        // manifest schema version
  features: FeatureManifestEntry[];
  deployedAt: string;                     // ISO timestamp of last deploy
}

// ---------------------------------------------------------------------------
// Runtime state — what HotSwapEngine tracks per feature
// ---------------------------------------------------------------------------

export interface FeatureRuntimeState {
  id: string;
  /** Current version from the live manifest */
  version: string;
  /** true while the module is physically mounted */
  mounted: boolean;
  /** true if activateFeature ran successfully */
  active: boolean;
  /** Unmount handle returned by mount() — nilled after unmount */
  unmountHandle: UnmountHandle | null;
  /** Subscriptions registered by this feature (WatermelonDB, etc.) */
  subscriptions: (() => void)[];
  /** Workflow instances owned by this feature (for pause/resume) */
  workflows: WorkflowHandle[];
}

export interface WorkflowHandle {
  id: string;
  /** Pause a running workflow, saving all transient state */
  pause(): Promise<void>;
  /** Resume a paused workflow with reconfigured context */
  resume(reconfigure?: Record<string, unknown>): Promise<void>;
  /** Force-abandon the workflow (cleanup resources) */
  abort(): void;
}

// ---------------------------------------------------------------------------
// Route registration metadata
// ---------------------------------------------------------------------------

export interface DynamicRouteEntry {
  /** Expo Router path, e.g. "/finance/ledger" */
  pathname: string;
  /** Dynamic module that exports the screen component */
  moduleRef: { default: React.ComponentType };
  /** Feature id that owns this route */
  ownerId: string;
}
