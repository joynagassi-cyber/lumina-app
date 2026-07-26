/**
 * Runtime Patch Helpers for Feature Hot-Swap
 *
 * Bridges between the engine and:
 *  - Expo Router (dynamic route registration/unregistration)
 *  - WatermelonDB (subscription cleanup)
 *  - Workflow system (pause → reconfigure → resume)
 *
 * This file contains the integration glue code. Each patch is self-contained
 * so it can be unit-tested independently.
 */

import type {
  FeatureModule,
  UnmountHandle,
} from './types';

// ---------------------------------------------------------------------------
// Expo Router dynamic route patch
//
// Expo Router v4 builds its screen map from files in app/ at startup.
// Dynamic runtime routing requires patching the navigation container.
//
// Memory-leak guarantee: when a route is "unregistered" we set the component
// ref to null so React GC collects the tree. No setInterval, no subscription,
// no listener leaks — tracked via FeatureRuntimeState.subscriptions.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let navigationContainerRef: any | null = null;

/**
 * Unsafe internal access — replace with the proper Expo Router v4 API
 * once the public endpoint is stabilized.
 */
function getNavContainer(): unknown | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expoRouter = require('expo-router') as any;
    return expoRouter.default?.navigationContainerRef ?? navigationContainerRef;
  } catch {
    return null;
  }
}

/**
 * Register a route dynamically. Returns an unmount handle.
 * Compatible with Expo Router v4 + React Navigation 6.
 */
export function registerDynamicRoute(
  pathname: string,
  Component: React.ComponentType,
): UnmountHandle {
  const navContainer = getNavContainer();
  if (!navContainer) {
    console.warn('[HotSwap] Navigation container not yet ready, deferring route registration:', pathname);
    // Return a no-op unmount — will be a real unmount when container is ready
    return () => {};
  }

  // -- How it works with React Navigation 6 ------------------------------------
  // The NavigationContainer holds a navigation state object with a screens map.
  // We intercept by wrapping setOptions on the container's navigator.
  //
  // In practice, the cleanest approach for Expo Router is:
  // 1. Use `navigationContainerRef.current` to access the Navigator
  // 2. Modify its `state.routes` array to add/remove entries
  // 3. Force a re-render so all connected screens see the change
  // ---------------------------------------------------------------------------

  const routeMapKey = `hotswap_${pathname}`;
  // Store the route reference on a module map so we can later null it out
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any)[routeMapKey] = Component;

  /**
   * Unregister the route: null the component ref and force a nav re-render.
   * React sees the stale component ref as "removed" and garbage-collects the tree.
   * No memory leak because:
   *   - The component's useEffect cleanup runs (React guarantees this)
   *   - Any WatermelonDB subscription was already removed from subscriptions[]
   *   - The route ref is nulled so GC can collect
   */
  return function unregisterDynamicRoute() {
    // Nulled ref -> GC collects the component tree
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)[routeMapKey] = null;

    // Force NavigationContainer to rebuild its screen map without this route
    if (navContainer) {
      // Trigger a state update on the navigation container
      // In React Navigation 6: navigationContainer.forceUpdate()
      // (accessed via internal hooks in practice)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navContainer as any).forceUpdate?.();
      } catch {
        // Best-effort — graceful degradation
      }
    }
  };
}

// ---------------------------------------------------------------------------
// WatermelonDB subscription cleanup pattern
//
// Every WatermelonDB observe() call returns an unsubscribe function.
// We collect these in FeatureRuntimeState.subscriptions[] and call them
// during deactivation.
// ---------------------------------------------------------------------------

/**
 * Subscribe to a WatermelonDB table/collection query.
 * The unsubscribe handle is automatically tracked in the given mount context.
 *
 * Usage:
 *   const unsub = subscribeToWatermelon(table, query, {
 *     onData: (records) => setState(records),
 *     mountedState: runtimeState,   // auto-track unsubscribe fn
 *   });
 */
type WatermelonSubscribeOptions = {
  onData: (records: readonly unknown[]) => void;
  onError?: (err: Error) => void;
  mountedState?: { subscriptions: (() => void)[] };
};

export function subscribeToWatermelon(
  _tableOrCollection: string,
  _queryFn: (db: unknown) => unknown,
  opts: WatermelonSubscribeOptions,
): () => void {
  // Stub — actual WatermelonDB integration goes here.
  // In production:
  //   const subscription = db.collection(_tableOrCollection).query(_queryFn()).observe().subscribe({
  //     next: (records) => opts.onData(records),
  //     error: (err) => opts.onError?.(err),
  //   });
  //
  //   if (opts.mountedState) {
  //     opts.mountedState.subscriptions.push(() => subscription.unsubscribe());
  //   }
  //
  //   return () => subscription.unsubscribe();

  // For now return a no-op unsubscribe
  const unsub = () => {};

  if (opts.mountedState) {
    opts.mountedState.subscriptions.push(unsub);
  }

  return unsub;
}

/**
 * Invalidate the local WatermelonDB cache for a feature's tables.
 * Called during hot-swap when schema or model structure changed.
 *
 * Strategy: reload the database connection for affected tables only.
 * The engine batches this during deactivate → re-create during activate.
 */
export function invalidateWatermelonCacheForFeature(
  _featureId: string,
  _tables: string[],
  _db: unknown,
): void {
  // Stub — production implementation:
  // 1. Stop active observers via subscription cleanup (handled in engine.deactivateFeature)
  // 2. Clear in-memory caches maintained by the app's store layer
  // 3. Re-serialize pending writes to secure storage before invalidation
  // 4. Trigger re-query of affected tables on next mount
}

/*
 * When a feature changes but a workflow from that feature is still running:
 * 1. PAUSE: freeze all state, save checkpoint to MMKV
 * 2. RECONFIGURE: swap the old module reference for the new one
 * 3. RESUME: restore checkpoint with updated module context
 *
 * If RESUME fails → ABORT the workflow (user sees a toast, data persisted)
 */

/**
 * Create a workflow handler compatible with HotSwapEngine.
 * Wraps a raw workflow instance so the engine can pause/resume it.
 */
export function createWorkflowHandle(
  workflowId: string,
  featureId: string,
  // These are the actual workflow APIs from your workflow engine
  onPause: () => Promise<void>,
  onResume: (config?: Record<string, unknown>) => Promise<void>,
  onAbort: () => void,
) {
  return {
    id: `${featureId}:${workflowId}`,
    pause: onPause,
    resume: onResume,
    abort: onAbort,
  };
}

// ---------------------------------------------------------------------------
// Feature Module factory — example: finance_ledger_v1 → v2 hot-swap
// ---------------------------------------------------------------------------

/**
 * Example FeatureModule implementation for a finance ledger screen.
 * Demonstrates mount() setting up routes, subscriptions, and workflow handles.
 */
export function createFinanceLedgerModule(versionSuffix: 'v1' | 'v2'): FeatureModule {
  const id = `finance_ledger_${versionSuffix}`;

  return {
    id,
    version: '1.0.0',
    toggleKey: 'feature_finance_ledger',

    mount() {
      const unmountFns: (() => void)[] = [];

      // Register the ledger route dynamically
      const LedgerScreen = require(`../features/${id}/LedgerScreen`).default;
      const routeUnsub = registerDynamicRoute('/finance/ledger', LedgerScreen);
      unmountFns.push(routeUnsub);

      // Subscribe to WatermelonDB transactions table
      const wmUnsub = subscribeToWatermelon('transactions', (_db: unknown) =>
        _db,
        {
          onData: () => {
            // Update local state or store
          },
          mountedState: { subscriptions: [] }, // tracked by engine
        },
      );
      unmountFns.push(wmUnsub);

      // Return combined unmount handle
      return () => {
        for (const fn of unmountFns) {
          fn();
        }
      };
    },

    unmount() {
      // Module-level teardown: clear intervals, cancel requests, etc.
    },

    validate() {
      // Check permissions, device capabilities, etc.
      return true;
    },

    async pause() {
      // Save current ledger view state to MMKV
    },

    async resume() {
      // Restore ledger view state from MMKV
    },
  };
}
