/**
 * Sync hook skeleton — manages online/offline sync state.
 * ITS-V1: WebSub + SSE push notification bridge per RTS-v1.
 */

import { useState, useCallback } from 'react';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const sync = useCallback(async () => {
    // TODO: Implement WatermelonDB sync with backend API
    return;
  }, []);

  return { isSyncing, isOnline, sync };
}
