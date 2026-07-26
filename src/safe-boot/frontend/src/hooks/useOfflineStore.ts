/**
 * Offline store hook — WatermelonDB adapter.
 * ITS-V1: RTS-v1 sync protocol + WebSub push bridge.
 */

import { useState, useCallback } from 'react';

export function useOfflineStore() {
  const [ready, setReady] = useState(false);

  const initialize = useCallback(async () => {
    // TODO: Initialize WatermelonDB database
    setReady(true);
  }, []);

  return { ready, initialize };
}
