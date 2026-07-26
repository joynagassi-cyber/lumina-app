/**
 * ConnectivityListener — monitors network state and triggers async sync.
 *
 * Uses @react-native-community/netinfo for real-time connectivity changes.
 * Maintains an operation queue (syncPendingOps) that is drained when connectivity
 * is restored. Supports three network types:
 *   - WiFi/ethernet: full sync (all queued ops, manifest push + pull)
 *   - Cellular: delta-only sync (pull only manifest diff, skip large form blobs)
 *   - Offline: queue everything locally, mark ops as pending
 */

import { EventEmitter } from 'events';
import NetInfo from '@react-native-community/netinfo';
import type { NetInfoState } from '@react-native-community/netinfo';
import type { ConnectivityLevel, ConnectivityState, SyncOperation } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toConnectivityLevel(state: NetInfoState): ConnectivityLevel {
  if (!state.isConnected || state.isInternetReachable === false) return 'offline';
  const details = state.details;
  const connType = typeof details === 'object' && details !== null ? (details as Record<string, unknown>).type : undefined;
  if (connType === 'cellular') return 'metered';
  return 'online';
}

function toNetworkDetails(state: NetInfoState): ConnectivityState['details'] {
  const rawType = state.type ?? 'unknown';
  let bandwidthMbps: number | null = null;
  if (rawType === 'wifi' || rawType === 'ethernet') bandwidthMbps = 100;
  else if (rawType === 'cellular') bandwidthMbps = 20;

  // details is typed differently on connected vs disconnected states
  const detailsObj = state.details as Record<string, unknown> | undefined;
  const isMetered = rawType === 'cellular' || (detailsObj?.isMetered as boolean | undefined) === true;

  return {
    type: rawType as 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown',
    bandwidthMbps,
    isMetered,
  };
}

// ---------------------------------------------------------------------------
// Operation Queue (in-memory with L2 persistence)
// ---------------------------------------------------------------------------

class OpQueue {
  private ops: SyncOperation[] = [];

  constructor(private readonly l2Store: import('./types').L2Store) {}

  /** Enqueue an operation — memory + L2. */
  async enqueue(op: SyncOperation): Promise<void> {
    this.ops.push(op);
    await this.l2Store.enqueueOp(op);
  }

  /** Dequeue and return all pending operations. */
  async dequeueAll(): Promise<SyncOperation[]> {
    const fromMemory = [...this.ops];
    const fromL2 = await this.l2Store.getPendingOps();
    // Deduplicate by ID
    const seen = new Set<string>();
    const all = [...fromMemory, ...fromL2];
    const unique = all.filter(op => {
      if (seen.has(op.id)) return false;
      seen.add(op.id);
      return true;
    });
    this.ops = []; // drain memory queue
    return unique;
  }

  /** Mark a single operation as completed. */
  async complete(id: string): Promise<void> {
    this.ops = this.ops.filter(op => op.id !== id);
    await this.l2Store.completeOp(id);
  }

  /** Purge successfully completed ops older than maxAgeMs. */
  async purge(maxAgeMs: number): Promise<number> {
    return this.l2Store.purgeCompleted(maxAgeMs);
  }
}

// ---------------------------------------------------------------------------
// ConnectivityListener — public API
// ---------------------------------------------------------------------------

export class ConnectivityListener extends EventEmitter {
  private currentState: ConnectivityState = {
    level: 'unknown',
    internetReachable: false,
    details: { type: 'unknown', bandwidthMbps: null, isMetered: false },
  };
  private privateOpQueue: OpQueue | null = null;
  private listenerAttached = false;

  /**
   * Inject a real L2 store for persistent operation queuing.
   * Must be called before startListening().
   */
  setStore(store: import('./types').L2Store): void {
    this.privateOpQueue = new OpQueue(store);
  }

  /**
   * Start listening for network changes.
   * After calling, register handlers via on('connectivityChange', fn).
   */
  async startListening(): Promise<void> {
    if (this.listenerAttached) return;

    const initialState = await NetInfo.fetch();
    this._updateState(initialState);

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      this._updateState(state);
    });
    this.listenerAttached = true;

    // Expose cleanup
    Object.defineProperty(this, 'cleanup', { value: unsubscribe });
  }

  /** Get the current connectivity snapshot. */
  getState(): ConnectivityState {
    return this.currentState;
  }

  /**
   * Check if the current connection supports full sync (WiFi/ethernet).
   * Use this before deciding whether to push large manifest diffs.
   */
  canDoFullSync(): boolean {
    return (
      this.currentState.level === 'online' &&
      !this.currentState.details.isMetered
    );
  }

  /**
   * Check if the device can do any sync at all (not offline).
   */
  hasConnectivity(): boolean {
    return this.currentState.level !== 'offline';
  }

  // --------------------------------------------------------------------------
  // Operation enqueueing for sync
  // --------------------------------------------------------------------------

  /**
   * Enqueue a sync operation. Automatically executed when connectivity is restored.
   * Call this whenever a local change needs to be pushed to server or pulled.
   */
  async enqueueOp(op: SyncOperation): Promise<void> {
    if (!this.privateOpQueue) {
      throw new Error('ConnectivityListener: no store configured. Call setStore() first.');
    }
    await this.privateOpQueue.enqueue(op);
  }

  /**
   * Execute all pending operations now (usually triggered by a connectivityChange event).
   * Returns count of successfully completed ops.
   */
  async executePendingOps(
    executor: (op: SyncOperation) => Promise<boolean>,
  ): Promise<{ success: number; failed: number }> {
    if (!this.privateOpQueue) return { success: 0, failed: 0 };

    const ops = await this.privateOpQueue.dequeueAll();
    let success = 0;
    let failed = 0;

    for (const op of ops) {
      const ok = await executor(op);
      if (ok) {
        await this.privateOpQueue.complete(op.id);
        success++;
      } else {
        failed++;
        // Re-enqueue for next connectivity window
        await this.privateOpQueue.enqueue({ ...op, createdAt: new Date().toISOString() });
      }
    }

    return { success, failed };
  }

  /**
   * Periodic cleanup call (e.g., every 5 minutes or on app resume).
   * Removes successfully completed ops older than 24 hours.
   */
  async purgeCompleted(): Promise<number> {
    if (!this.privateOpQueue) return 0;
    return this.privateOpQueue.purge(24 * 60 * 60 * 1000);
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private _updateState(state: NetInfoState): void {
    const newState: ConnectivityState = {
      level: toConnectivityLevel(state),
      internetReachable: !!state.isConnected && state.isInternetReachable !== false,
      details: toNetworkDetails(state),
    };

    // Emit only when state actually changes
    if (newState.level !== this.currentState.level || newState.internetReachable !== this.currentState.internetReachable) {
      this.currentState = newState;
      this.emit('connectivityChange', newState);

      if (newState.level === 'online' || newState.level === 'metered') {
        this.emit('reconnected', newState);
      }
    }
  }

  /** Clean up listeners. Call on app unmount. */
  destroy(): void {
    this.removeAllListeners();
    if (this.listenerAttached && 'cleanup' in this) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cleanup?.();
    }
  }
}
