/**
 * React Context transport layer for RuntimeStateStore.
 *
 * The Context is NOT the source of truth.  It is only a pipe that takes
 * snapshots from the Store and makes them available in the React tree.
 *
 * Key pattern: one single `useSyncExternalStore`-style subscription on the
 * Store, no matter how many components consume it.  The Store fires ONE
 * listener call per batched update; React re-renders from that.
 */

import { createContext, useContext, useSyncExternalStore } from 'react';
import type {
  RuntimeAppState,
  EngineName,
  UnsubscribeFn,
} from '../RuntimeStateStore';
import { RuntimeStateStore } from '../RuntimeStateStore';

// ---------------------------------------------------------------------------
// Public context (reads from hook; never written to by components)
// ---------------------------------------------------------------------------

const RuntimeContext = createContext<RuntimeAppState | null>(null);

export const useRuntimeState = () => {
  const ctx = useContext(RuntimeContext);
  if (!ctx) {
    throw new Error('useRuntimeState must be used within <RuntimeProvider>');
  }
  return ctx;
};

/** Typed access to a specific engine's slice */
export function useEngine<K extends EngineName>(engine: K) {
  const fullState = useRuntimeState();
  return fullState.engineStates[engine];
}

/** Boolean: is this engine ready? */
export function useEngineReady(engine: EngineName): boolean {
  const fullState = useRuntimeState();
  return fullState.enginesReady.has(engine);
}

/** Engine version counter — useful to detect "did anything change for me?" */
export function useEngineVersion<K extends EngineName>(engine: K): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap = useEngine(engine) as any;
  return snap?.version ?? 0;
}

// ---------------------------------------------------------------------------
// Provider — single Store → React bridge
// ---------------------------------------------------------------------------

export interface RuntimeProviderProps {
  store: RuntimeStateStore;
  children: React.ReactNode;
}

/**
 * Use `useSyncExternalStore` so React 18+ batches subscriber updates
 * automatically and supports concurrent rendering safely.
 */
export function RuntimeProvider({ store, children }: RuntimeProviderProps) {
  const snapshot = useSyncExternalStore(
    (callback: () => void): UnsubscribeFn => store.subscribe(callback),
    () => store.getState(),
    () => store.getState(), // SSR fallback (identical for offline-first app)
  );

  return (
    <RuntimeContext.Provider value={snapshot}>
      {children}
    </RuntimeContext.Provider>
  );
}
