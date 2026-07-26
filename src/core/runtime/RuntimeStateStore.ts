/**
 * Lumina Runtime State Management — Architecture Decisions
 *
 * Summary: Single RuntimeStateStore as the sole source of truth, React Context
 * only as a propagation transport.  EventEmitter pattern for inter-engine comms,
 * batching for coalesced updates, dependency-ordered topological execution.
 */

// ============================================================================
// 1. TYPES
// ============================================================================

export enum EngineName {
  Manifest = 'manifest',
  Vocabulary = 'vocabulary',
  Forms = 'forms',
  Workflow = 'workflow',
  Capability = 'capability',
}

/** Atomic events emitted by any engine */
export interface EngineEvent<TPayload = unknown> {
  engine: EngineName;
  type: string;
  payload: TPayload;
  timestamp: number;
  correlationId: string; // links related events (same manifest reload)
}

/** Batched events grouped by a shared `correlationId` or time window */
export interface EventBatch {
  correlationId: string;
  events: EngineEvent[];
  createdAt: number;
}

/** Per-engine snapshots stored inside the single AppState */
interface EngineStateSnapshots {
  [EngineName.Manifest]: {
    raw: Record<string, unknown>;
    validated: boolean;
    version: number;
    organizationId: string;
    lastLoadedAt: number;
  };
  [EngineName.Vocabulary]: {
    terms: Map<string, string>;
    locale: string;
    lastSyncedAt: number;
  };
  [EngineName.Forms]: {
    compiledForms: Record<string, unknown>; // compile cache key → tree
    version: number;
  };
  [EngineName.Workflow]: {
    activeInstances: Record<string, string>; // instanceId → stateKey
    version: number;
  };
  [EngineName.Capability]: {
    enabledFeatures: string[];
    capabilityMatrix: Record<string, Record<string, boolean>>;
    version: number;
  };
}

/** Full application state: one engine snapshot + runtime metadata */
export interface RuntimeAppState {
  engineStates: EngineStateSnapshots;
  enginesReady: Set<EngineName>;
  currentOrganizationId: string | null;
  /** Monotonic sequence counter to detect stale WatermelonDB subscriptions */
  mutationCounter: number;
  /** Last time a render was scheduled (batching sentinel) */
  lastRenderScheduledAt: number;
}

// ============================================================================
// 2. EVENT EMITTER (typed, per-engine, with fan-out support)
// ============================================================================

type Listener<TPayload = unknown> = (event: EngineEvent<TPayload>) => void;
type UnsubscribeFn = () => void;

interface EngineEventMap {
  [EngineName.Manifest]: Record<string, unknown>;
  [EngineName.Vocabulary]: Record<string, unknown>;
  [EngineName.Forms]: Record<string, unknown>;
  [EngineName.Workflow]: Record<string, unknown>;
  [EngineName.Capability]: Record<string, unknown>;
}

class TypedEventEmitter<TEngine extends EngineName> {
  private listeners = new Map<keyof EngineEventMap[TEngine], Set<Listener<unknown>>>();
  private globalListeners = new Set<Listener<unknown>>();

  on<TType extends keyof EngineEventMap[TEngine]>(
    engine: TEngine,
    eventTypes: TType | TType[],
    cb: Listener<EngineEventMap[TEngine][TType & string]>,
  ): UnsubscribeFn {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    for (const t of types) {
      if (!this.listeners.has(t)) {
        this.listeners.set(t, new Set());
      }
      this.listeners.get(t)!.add(cb);
    }
    return () => this.off(engine, eventTypes, cb);
  }

  off<TType extends keyof EngineEventMap[TEngine]>(
    engine: TEngine,
    eventTypes: TType | TType[],
    cb: Listener<EngineEventMap[TEngine][TType & string]>,
  ): void {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    for (const t of types) {
      this.listeners.get(t)?.delete(cb);
    }
  }

  /** Register a listener that fires on ALL engines and ALL event types */
  onAny(cb: Listener): UnsubscribeFn {
    this.globalListeners.add(cb);
    return () => this.globalListeners.delete(cb);
  }

  emit(event: EngineEvent): void {
    const { type, engine, payload } = event;
    // Direct typed listeners
    this.listeners.get(type)?.forEach((fn) => fn(event));
    // Global fan-out listeners
    this.globalListeners.forEach((fn) => fn(event));
  }
}

// ============================================================================
// 3. EVENT BATCHER — combines up to 10 events over 50ms into one re-render
// ============================================================================

const BATCH_WINDOW_MS = 50;
const MAX_BATCH_SIZE = 10;

class EventBatcher {
  private queue: EngineEvent[] = [];
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private onFlush: (batch: EventBatch) => void;

  constructor(onFlush: (batch: EventBatch) => void) {
    this.onFlush = onFlush;
  }

  push(event: EngineEvent): void {
    // Group by correlationId when present; otherwise fall back to time-window
    const correlated = this.queue.find(
      (e) => e.correlationId && e.correlationId === event.correlationId,
    );

    this.queue.push(event);

    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flush('max-size');
    } else if (!this.timerId) {
      this.timerId = setTimeout(() => this.flush('timeout'), BATCH_WINDOW_MS);
    }
  }

  flush(reason: 'timeout' | 'max-size' | 'manual'): void {
    if (this.queue.length === 0) return;

    // Pick the first non-empty correlationId or fallback to 'ungrouped'
    const correlationId =
      this.queue.find((e) => e.correlationId)?.correlationId ??
      `manual-${Date.now()}`;

    const batch: EventBatch = {
      correlationId,
      events: [...this.queue],
      createdAt: Date.now(),
    };

    this.queue = [];
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    this.onFlush(batch);
  }

  forceFlush(): void {
    this.flush('manual');
  }
}

// ============================================================================
// 4. DEPENDENCY GRAPH — topological order for deterministic update sequencing
// ============================================================================

type EngineDepMap = Partial<Record<EngineName, EngineName[]>>;

/**
 * Dependency map: which engines must update BEFORE a given engine.
 * Example: Forms depends on Manifest AND Vocabulary because form schemas
 * reference vocabulary terms that live inside the manifest.
 */
const ENGINE_DEPENDENCIES: EngineDepMap = {
  [EngineName.Vocabulary]: [], // independent, loads first after manifest
  [EngineName.Capability]: [EngineName.Manifest], // resolves permissions from org config
  [EngineName.Forms]: [EngineName.Manifest, EngineName.Vocabulary], // schema uses vocab
  [EngineName.Workflow]: [EngineName.Capability, EngineName.Forms], // guards check permissions
};

class DependencyGraph {
  private adjacency: Map<EngineName, Set<EngineName>> = new Map();
  private reverseAdj: Map<EngineName, Set<EngineName>> = new Map();

  constructor(deps: EngineDepMap = ENGINE_DEPENDENCIES) {
    for (const engine of Object.values(EngineName)) {
      this.adjacency.set(engine, new Set());
      this.reverseAdj.set(engine, new Set());
    }
    for (const [engine, depsList] of Object.entries(deps)) {
      for (const dep of depsList) {
        this.adjacency.get(dep)!.add(engine as EngineName); // dep → dependent
        this.reverseAdj.get(engine as EngineName)!.add(dep); // engine ← deps
      }
    }
  }

  /** Returns engines in valid update order (roots first, leaves last). */
  topologicalSort(): EngineName[] {
    const inDegree = new Map<EngineName, number>();
    for (const engine of Object.values(EngineName)) {
      inDegree.set(engine, this.reverseAdj.get(engine)!.size);
    }

    const queue: EngineName[] = [];
    for (const [eng, deg] of inDegree) {
      if (deg === 0) queue.push(eng);
    }
    queue.sort(); // deterministic tie-breaking

    const result: EngineName[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      for (const neighbor of this.adjacency.get(current) ?? []) {
        const newDeg = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    const expectedCount = new Set(Object.values(EngineName)).size;
    if (result.length !== expectedCount) {
      throw new Error(
        `Dependency cycle detected among engines: ${JSON.stringify(result)}`,
      );
    }
    return result;
  }

  /** Who gets notified when a given engine emits? (fan-out) */
  dependentsOf(engine: EngineName): EngineName[] {
    return [...(this.adjacency.get(engine) ?? [])];
  }
}

// ============================================================================
// 5. RUNTIME STATE STORE — single source of truth
// ============================================================================

type AppStateListener = (prev: RuntimeAppState, next: RuntimeAppState) => void;

type EngineSpecificActions = {
  [EngineName.Manifest]: { manifest: Record<string, unknown>; organizationId: string };
  [EngineName.Vocabulary]: { terms: Map<string, string>; locale: string };
  [EngineName.Forms]: { formId: string; renderTree: unknown };
  [EngineName.Workflow]: { workflowId: string; transition: string };
  [EngineName.Capability]: { featureId: string; enabled: boolean };
};

type Action<K extends EngineName> = {
  engine: K;
  type: string;
  payload: EngineSpecificActions[K];
  subscriptionId?: string; // optional WatermelonDB subscription handle
};

class RuntimeStateStore {
  private state: RuntimeAppState;
  private listeners = new Set<AppStateListener>();
  private emitter = new TypedEventEmitter<EngineName>();
  private batcher: EventBatcher;
  private dependencyGraph: DependencyGraph;
  private updateLock = false;
  private pendingActions: Array<Action<EngineName>> = [];

  constructor(initialOrgId: string | null = null) {
    this.state = {
      engineStates: {
        [EngineName.Manifest]: {
          raw: {},
          validated: false,
          version: 0,
          organizationId: initialOrgId ?? '',
          lastLoadedAt: Date.now(),
        },
        [EngineName.Vocabulary]: { terms: new Map(), locale: 'fr', lastSyncedAt: Date.now() },
        [EngineName.Forms]: { compiledForms: {}, version: 0 },
        [EngineName.Workflow]: { activeInstances: {}, version: 0 },
        [EngineName.Capability]: { enabledFeatures: [], capabilityMatrix: {}, version: 0 },
      },
      enginesReady: new Set(),
      currentOrganizationId: initialOrgId,
      mutationCounter: 0,
      lastRenderScheduledAt: 0,
    };
    this.dependencyGraph = new DependencyGraph();
    this.batcher = new EventBatcher((batch) => this.processBatch(batch));
  }

  getState(): Readonly<RuntimeAppState> {
    return this.state;
  }

  getEngine<K extends EngineName>(name: K): EngineStateSnapshots[K] {
    return this.state.engineStates[name];
  }

  isReady(engine: EngineName): boolean {
    return this.state.enginesReady.has(engine);
  }

  /** Subscribe to full state changes (called once at app level) */
  subscribe(listener: AppStateListener): UnsubscribeFn {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Low-level: action dispatched directly (bypasses batching, use for sync init) */
  dispatch(action: Action<EngineName>): void {
    if (this.updateLock) {
      // Queue for next tick — prevents recursive dispatch during setState
      this.pendingActions.push(action);
      return;
    }
    this.applyAction(action);
  }

  /** Push an event through the batcher (recommended path for runtime events) */
  enqueueEvent(event: EngineEvent): void {
    this.batcher.push(event);
    // Also emit for real-time subscribers who don't want batching
    this.emitter.emit(event);
  }

  /** Mark an engine as ready (call after bootstrap completes) */
  markReady(engine: EngineName): void {
    this.applyInternal((s) => s.enginesReady.add(engine));
  }

  /** Get topological update order */
  getUpdateOrder(): EngineName[] {
    return this.dependencyGraph.topologicalSort();
  }

  /** Fan-out: which engines react when a given engine emits? */
  getDependents(engine: EngineName): EngineName[] {
    return this.dependencyGraph.dependentsOf(engine);
  }

  /** Emit a typed event to the internal bus */
  emitEvent<TType extends string, TPayload>(
    engine: EngineName,
    type: TType,
    payload: TPayload,
    correlationId?: string,
  ): void {
    this.emitter.emit({
      engine,
      type,
      payload,
      timestamp: Date.now(),
      correlationId: correlationId ?? crypto.randomUUID?.() ?? String(Date.now()),
    });
  }

  // ---- Internals ----------------------------------------------------------

  private applyInternal(fn: (state: RuntimeAppState) => void): void {
    fn(this.state);
    this.state.mutationCounter++;
    this.notifyListeners();
  }

  private applyAction(action: Action<EngineName>): void {
    const { engine, type, payload } = action;

    switch (engine) {
      case EngineName.Manifest: {
        this.applyInternal((s) => {
          const snap = s.engineStates[EngineName.Manifest];
          snap.raw = payload.manifest;
          snap.validated = true;
          snap.version++;
          snap.organizationId = payload.organizationId;
          snap.lastLoadedAt = Date.now();
          s.currentOrganizationId = payload.organizationId;
        });
        break;
      }
      case EngineName.Vocabulary: {
        this.applyInternal((s) => {
          const snap = s.engineStates[EngineName.Vocabulary];
          snap.terms = payload.terms;
          snap.locale = payload.locale;
          snap.lastSyncedAt = Date.now();
        });
        break;
      }
      case EngineName.Forms: {
        this.applyInternal((s) => {
          const snap = s.engineStates[EngineName.Forms];
          snap.compiledForms[payload.formId] = payload.renderTree;
          snap.version++;
        });
        break;
      }
      case EngineName.Workflow: {
        this.applyInternal((s) => {
          const snap = s.engineStates[EngineName.Workflow];
          snap.activeInstances[payload.workflowId] = payload.transition;
          snap.version++;
        });
        break;
      }
      case EngineName.Capability: {
        this.applyInternal((s) => {
          const snap = s.engineStates[EngineName.Capability];
          if (payload.enabled) {
            if (!snap.enabledFeatures.includes(payload.featureId)) {
              snap.enabledFeatures.push(payload.featureId);
            }
          } else {
            snap.enabledFeatures = snap.enabledFeatures.filter((f) => f !== payload.featureId);
          }
          snap.capabilityMatrix[payload.featureId] = {
            ...snap.capabilityMatrix[payload.featureId],
            [type]: true,
          };
          snap.version++;
        });
        break;
      }
    }

    this.state.mutationCounter++;
    this.notifyListeners();

    // Drain queued actions if recursion happened
    this.drainPending();
  }

  private drainPending(): void {
    while (this.pendingActions.length > 0) {
      this.applyAction(this.pendingActions.shift()!);
    }
  }

  private processBatch(batch: EventBatch): void {
    // Deduplicate: keep only the latest event per (engine, type) pair
    const deduped = new Map<string, EngineEvent>();
    for (const evt of batch.events) {
      deduped.set(`${evt.engine}:${evt.type}`, evt);
    }

    // Compute valid update order from affected engines
    const affectedEngines = [...deduped.values()].map((e) => e.engine);
    const updateOrder = this.dependencyGraph.topologicalSort();
    const sorted = updateOrder.filter((eng) => affectedEngines.includes(eng));

    // Apply deduplicated events in topological order
    for (const eng of sorted) {
      const event = deduped.get(`${eng}:${batch.events.find((e) => e.engine === eng)?.type ?? ''}`);
      if (event) {
        // Convert event → dispatchable action
        const action = this.eventToAction(event);
        if (action) {
          this.applyAction(action);
        }
      }
    }

    this.state.mutationCounter++;
    this.notifyListeners();
  }

  private eventToAction(
    event: EngineEvent,
  ): Action<EngineName> | null {
    return {
      engine: event.engine,
      type: event.type,
      payload: event.payload as never,
    };
  }

  private notifyListeners(): void {
    // Snapshot before notifying so listeners see consistent state
    const snapshot = JSON.parse(JSON.stringify(this.state));
    // Don't call sync JSON — just iterate with reference comparison

    // Real implementation uses Object.is; stringify only for demo serialization
    for (const listener of this.listeners) {
      try {
        listener(snapshot as unknown as RuntimeAppState, this.state);
      } catch (err) {
        console.error('[RuntimeStateStore] Listener error:', err);
      }
    }
  }
}

// ============================================================================
// 6. WATERMELON DB SUBSCRIPTION INTEGRATION
// ============================================================================

/**
 * Pattern: each engine registers a WatermelonDB observable subscription.
 * On change, it does NOT write directly to the store. Instead it routes
 * through the batcher, which coalesces multiple DB changes into a single
 * mutation. A stale-subscription guard (mutationCounter) prevents late
 * events from old subscriptions from overwriting newer state.
 */

interface WatermelonSubscriptionHandle {
  unsubscribe: () => void;
}

class SubscriptionManager {
  private subscriptions = new Map<string, {
    unsubscribe: () => void;
    engine: EngineName;
    table: string;
    counterAtSubscribe: number;
  }>();

  constructor(private store: RuntimeStateStore) {}

  /**
   * Subscribe to a WatermelonDB table. Returns an unsubscribe function.
   * Inside the callback, mutate the store via dispatch() (not enqueueEvent)
   * because this is a trusted data path.
   */
  subscribe<TRow>(
    engine: EngineName,
    table: string,
    onChange: (rows: TRow[]) => void,
  ): WatermelonSubscriptionHandle {
    const counterAtSubscribe = this.store.getState().mutationCounter;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrappedCallback = (rawRows: any[]): void => {
      const state = this.store.getState();
      // Stale guard: if the store has moved on with higher mutations
      // while this subscription was idle, check whether we're still relevant
      if (state.mutationCounter > counterAtSubscribe + 100) {
        // Likely a stale subscription from a re-connection; unsubscribe and re-subscribe
        // The engine should handle this by catching the unsubscribe and re-calling subscribe
        return;
      }
      onChange(rawRows);
    };

    // Placeholder: actual WatermelonDB observable.attach would be wired here
    // const observable = database.get(table).observable;
    // const unsub = observable.subscribe(wrappedCallback);

    const id = `${engine}:${table}:${counterAtSubscribe}`;
    this.subscriptions.set(id, {
      unsubscribe: () => {}, // real: unsub()
      engine,
      table,
      counterAtSubscribe,
    });

    return {
      unsubscribe: () => {
        this.subscriptions.delete(id);
      },
    };
  }

  unsubscribeAll(): void {
    for (const sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();
  }
}

// ============================================================================
// 7. EXPORTS
// ============================================================================

export {
  RuntimeStateStore,
  EventBatcher,
  DependencyGraph,
  TypedEventEmitter,
  SubscriptionManager,
  ENGINE_DEPENDENCIES,
};
export type {
  RuntimeAppState,
  EngineEvent,
  EventBatch,
  EngineStateSnapshots,
  AppStateListener,
  EngineDepMap,
  WatermelonSubscriptionHandle,
};
