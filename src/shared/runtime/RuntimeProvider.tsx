/**
 * Lumina Runtime — React provider.
 *
 * Mounts the runtime bootstrap (Phase B-6: HotSwapEngine + offline-runtime
 * wired into the app root) and exposes it through context. The provider:
 *   1. Boots the engine graph from the org manifest (fail-fast on invalid).
 *   2. Starts the ConnectivityListener (offline-first sync, RN NetInfo).
 *   3. Persists the compiled manifest for offline startup (L2/L3).
 *   4. Disposes listeners on unmount.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConnectivityListener } from '../offline-runtime/connectivity-listener';
import type { ConnectivityState } from '../offline-runtime/types';
import { createLuminaRuntime, inMemoryStores, type LuminaRuntime, type LuminaRuntimeOptions } from './runtime-bootstrap';

export type RuntimeBootStatus = 'booting' | 'ready' | 'error';

export interface LuminaRuntimeContextValue {
  runtime: LuminaRuntime | null;
  status: RuntimeBootStatus;
  error?: Error;
  connectivity: ConnectivityListener | null;
  connectivityState: ConnectivityState | null;
}

const LuminaRuntimeContext = createContext<LuminaRuntimeContextValue>({
  runtime: null,
  status: 'booting',
  error: undefined,
  connectivity: null,
  connectivityState: null,
});

export interface LuminaRuntimeProviderProps extends LuminaRuntimeOptions {
  /** Raw manifest data (validated on boot). */
  manifest: unknown;
  children: React.ReactNode;
}

export function LuminaRuntimeProvider({ manifest, children, ...options }: LuminaRuntimeProviderProps) {
  const [status, setStatus] = useState<RuntimeBootStatus>('booting');
  const [error, setError] = useState<Error | undefined>(undefined);
  const [connectivityState, setConnectivityState] = useState<ConnectivityState | null>(null);

  const runtime = useMemo(() => {
    try {
      return createLuminaRuntime(manifest, options);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectivity = useMemo(() => {
    if (!runtime) return null;
    const listener = new ConnectivityListener();
    listener.on('connectivityChange', (state: ConnectivityState) => setConnectivityState(state));
    return listener;
  }, [runtime]);

  useEffect(() => {
    if (!runtime) {
      setStatus('error');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await runtime.persistManifest();
        if (connectivity) {
          connectivity.setStore(inMemoryStores().l2);
          await connectivity.startListening();
          setConnectivityState(connectivity.getState());
        }
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      connectivity?.destroy();
      runtime.dispose();
    };
  }, [runtime, connectivity]);

  const value = useMemo<LuminaRuntimeContextValue>(
    () => ({ runtime, status, error, connectivity, connectivityState }),
    [runtime, status, error, connectivity, connectivityState],
  );

  return <LuminaRuntimeContext.Provider value={value}>{children}</LuminaRuntimeContext.Provider>;
}

/** Access the booted runtime from any screen. Null while booting/on error. */
export function useLuminaRuntime(): LuminaRuntimeContextValue {
  return useContext(LuminaRuntimeContext);
}

