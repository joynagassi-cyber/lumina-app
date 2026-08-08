# Runtime State Management — Architecture for Lumina Platform Core

## 1. Single AppState Store vs Separate Contexts? **Single Store.**

**Decision:** One `RuntimeStateStore` class holding all five engine snapshots, exposed to React via a single `<RuntimeProvider>` + `useSyncExternalStore`.

**Justification:**

| Concern | Separate Contexts | Single Store (chosen) |
|---|---|---|
| **N re-renders on manifest change** | 5 context providers → up to 5 tree traversals | 1 subscriber call → 1 render |
| **Cross-engine queries** | Requires reading from 2+ contexts simultaneously (nested hooks = anti-pattern) | `store.getEngine(Manifest)` + `store.getEngine(Capability)` in one place |
| **Batching** | Impossible: each context fires independently | Batcher sits in front of `notifyListeners()` |
| **Race conditions** | Hard to reason about ordering | Mutation counter + topological order = deterministic |
| **Testing** | 5 separate mock providers | 1 store instance with assertions on `getState()` |

The only role of React Context is **propagation**.  The authoritative state lives exclusively in `RuntimeStateStore`.

---

## 2. TypedEventEmitter — Inter-Engine Communication

Each engine gets its own `TypedEventEmitter<EngineName>` instance. Events carry:

```typescript
interface EngineEvent {
  engine: EngineName;       // who sent it
  type: string;             // e.g. 'manifest:loaded'
  payload: unknown;         // deserialized data
  timestamp: number;        // ordering hint
  correlationId: string;    // links events from the same logical operation
}
```

Two subscription modes:

| Mode | API | Use case |
|---|---|---|
| **Typed** | `emitter.on(EngineName.Manifest, 'updated', fn)` | Engine X listens only to Engine Y events |
| **Global** | `emitter.onAny(fn)` | Debug logger, analytics sink |

Fan-out is automatic: if Manifest emits `manifest:updated`, every listener registered on that type AND every global listener fires.

---

## 3. EventBatcher — Combining Concurrent Events

**Problem:** A manifest reload triggers `manifest:updated`, which causes Vocabulary to emit `vocab:changed`, which causes Forms to emit `form:compiled` — all within 10ms. Without batching, that's 3 re-renders.

**Solution:** `EventBatcher` groups events by `correlationId` and time window (50ms, max 10 events).

```
t=0ms    manifest:updated          ┐
t=2ms    vocab:changed             │   → pushed to batcher
t=5ms    form:compiled             ├─ batch fills (3 events, same correlationId)
t=8ms    capability:resolved       │
t=50ms   TIMER FIRES → flush()     ┘
          ↓
       Deduplicate (keep latest per engine:type)
       Sort by DependencyGraph.topologicalSort()
       Apply each action → ONE setState call → ONE React render
```

Configuration constants at the top of `RuntimeStateStore.ts`:

| Constant | Default | Tuning |
|---|---|---|
| `BATCH_WINDOW_MS` | 50 | Lower for snappier UI (30ms), higher for fewer renders (80ms) |
| `MAX_BATCH_SIZE` | 10 | If burst > 10 events, flush early |

---

## 4. WatermelonDB Subscription Integration

Each engine registers a subscription via `SubscriptionManager.subscribe(engine, table, callback)`. Three guards prevent race conditions:

### Guard 1 — Stale subscription detection
Each subscription records the `mutationCounter` at subscribe time.  On callback fire, if `state.mutationCounter > counterAtSubscribe + 100`, the subscription is considered stale and ignores the callback (triggers a re-subscribe from the engine side).

### Guard 2 — Mutation serialisation
The store's `applyAction()` sets `updateLock = true` during processing. Any action dispatched while locked is queued in `pendingActions[]` and drained after the current batch resolves.  This prevents recursive mutations.

### Guard 3 — Topological ordering
After a batch of events is collected, they are sorted by the dependency graph before application. A Vocabulary event will never be applied after a Manifest event if Manifest depends on Vocabulary.

```
WatermelonDB → Observable fires
     ↓
  SubscriptionManager wraps it with counter check
     ↓
  Engine reads rows → converts to action
     ↓
  Store.dispatch(action) OR enqueueEvent(event)
     ↓
  [if dispatch] → applies immediately
  [if event]    → goes through batcher → deduplicates → sorts → applies
```

---

## 5. Dependency Graph & Topological Ordering

The engine dependency map (`ENGINE_DEPENDENCIES`) is:

```
vocabulary (no deps) ← loads first
    ↑
capability (needs: manifest)
    ↑
forms (needs: manifest, vocabulary)
    ↑
workflow (needs: capability, forms)
```

```typescript
DependencyGraph.topologicalSort() // returns:
// [manifest, vocabulary, capability, forms, workflow]
```

When Manifest changes:
1. `manifest:updated` event arrives
2. Batch collects it
3. After flush, topological sort says: apply manifest events first
4. Capability, Forms, Workflow see updated dependency state automatically because they read from the same `RuntimeAppState`

---

## 6. Fan-Out Pattern Example

Scenario: manifest changes → recalculate capability → notify forms → trigger render.

```typescript
// In the Manifest Engine bootstrap:
runtimeStore.markReady(EngineName.Manifest);

runtimeStore.emitter.on(
  EngineName.Manifest,
  ['updated', 'validated'],
  async (event) => {
    // Fan-out step 1: Capability engine recalculates
    const orgId = event.payload.organizationId;
    await capabilityEngine.resolverFor(orgId);
    runtimeStore.enqueueEvent({
      engine: EngineName.Capability,
      type: 'capability:recalculated',
      payload: { organizationId: orgId },
      correlationId: event.correlationId,
      timestamp: Date.now(),
    });

    // Fan-out step 2: Forms engine re-compiles affected schemas
    await formsEngine.reloadSchemas();
    runtimeStore.enqueueEvent({
      engine: EngineName.Forms,
      type: 'forms:recompiled',
      payload: { organizationId: orgId },
      correlationId: event.correlationId,
      timestamp: Date.now(),
    });

    // Fan-out step 3: Workflow engine checks pending transitions
    await workflowEngine.checkPendingTransitions();
  },
);

// Step 4: Batcher flushes → batcher deduplicates → topological order applies
// all events in sequence → notifyListeners fires once → React renders once
```

One manifest change → 4 events emitted → batched into 1 flush → 1 React render.

---

## 7. Usage Summary

```typescript
// Bootstrap
const store = new RuntimeStateStore('org-mfe-jc-headquarters');
const provider = <RuntimeProvider store={store}>...</RuntimeProvider>;

// Read from any component
function LedgerScreen() {
  const manifest = useEngine(EngineName.Manifest);
  const capabilities = useEngine(EngineName.Capability);
  const isFinanceActive = capabilities.enabledFeatures.includes('finance');

  if (!isFinanceActive || !manifest.validated) return <Skeleton />;
  return <TransactionTable />;
}

// Dispatch from an engine
manifestEngine.loadManifest().then((data) => {
  store.dispatch({
    engine: EngineName.Manifest,
    type: 'manifest:loaded',
    payload: { manifest: data, organizationId: 'org-mfe-jc-headquarters' },
  });
});

// Subscribe from a component (React-safe via useSyncExternalStore)
function useAppStatus() {
  const ready = useRuntimeState().enginesReady;
  return { isBooted: ready.size === 5 };
}
```
