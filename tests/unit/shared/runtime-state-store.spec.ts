/**
 * RuntimeStateStore — unit tests (Phase A, AC A-4).
 *
 * Verifies the single-source-of-truth contract:
 *   - dispatch updates engine snapshots
 *   - subscribers receive a NEW snapshot identity per mutation (React-compatible)
 *   - Map/Set values survive the snapshot (no JSON.stringify clone)
 *   - topological update order and fan-out
 *   - EventBatcher coalescing
 */
import {
  RuntimeStateStore,
  EventBatcher,
  DependencyGraph,
  EngineName,
} from '../../../src/shared/offline-runtime/runtime/RuntimeStateStore';

describe('RuntimeStateStore', () => {
  it('initializes with default engine states and org id', () => {
    const store = new RuntimeStateStore('org-1');
    const state = store.getState();
    expect(state.currentOrganizationId).toBe('org-1');
    expect(state.engineStates[EngineName.Manifest].version).toBe(0);
    expect(state.enginesReady.size).toBe(0);
  });

  it('applies a Manifest action and bumps version + mutationCounter', () => {
    const store = new RuntimeStateStore('org-1');
    store.dispatch({
      engine: EngineName.Manifest,
      type: 'manifest:loaded',
      payload: { manifest: { name: 'MFE-JC' }, organizationId: 'org-1' },
    });

    const state = store.getState();
    expect(state.engineStates[EngineName.Manifest].validated).toBe(true);
    expect(state.engineStates[EngineName.Manifest].version).toBe(1);
    expect(state.engineStates[EngineName.Manifest].raw).toEqual({ name: 'MFE-JC' });
    expect(state.currentOrganizationId).toBe('org-1');
    expect(state.mutationCounter).toBeGreaterThan(0);
  });

  it('subscribers receive a NEW snapshot identity per mutation (React-compatible)', () => {
    const store = new RuntimeStateStore('org-1');
    const first = store.getState();
    store.dispatch({
      engine: EngineName.Manifest,
      type: 'manifest:loaded',
      payload: { manifest: {}, organizationId: 'org-1' },
    });
    const second = store.getState();

    expect(first).not.toBe(second);
  });

  it('preserves Map values in the snapshot handed to subscribers (no JSON clone)', () => {
    const store = new RuntimeStateStore('org-1');
    const seen: Array<ReturnType<RuntimeStateStore['getState']>> = [];
    store.subscribe((_prev, next) => seen.push(next));

    store.dispatch({
      engine: EngineName.Vocabulary,
      type: 'vocabulary:synced',
      payload: { terms: new Map([['income', 'Recette'], ['expense', 'Dépense']]), locale: 'fr' },
    });

    const snap = seen[seen.length - 1];
    expect(snap).toBeDefined();
    expect(snap.engineStates[EngineName.Vocabulary].terms).toBeInstanceOf(Map);
    expect(snap.engineStates[EngineName.Vocabulary].terms.get('income')).toBe('Recette');
  });

  it('tracks feature toggles via Capability actions', () => {
    const store = new RuntimeStateStore('org-1');
    store.dispatch({ engine: EngineName.Capability, type: 'capability:granted', payload: { featureId: 'finance', enabled: true } });
    store.dispatch({ engine: EngineName.Capability, type: 'capability:revoked', payload: { featureId: 'finance', enabled: false } });

    const state = store.getState();
    expect(state.engineStates[EngineName.Capability].enabledFeatures).not.toContain('finance');
    expect(state.engineStates[EngineName.Capability].capabilityMatrix['finance']).toBeDefined();
  });

  it('markReady adds engines to enginesReady', () => {
    const store = new RuntimeStateStore('org-1');
    store.markReady(EngineName.Manifest);
    store.markReady(EngineName.Vocabulary);
    expect(store.getState().enginesReady.has(EngineName.Manifest)).toBe(true);
    expect(store.getState().enginesReady.has(EngineName.Vocabulary)).toBe(true);
  });
});

describe('DependencyGraph', () => {
  it('produces deterministic topological order manifest → vocabulary → capability → forms → workflow', () => {
    const graph = new DependencyGraph();
    expect(graph.topologicalSort()).toEqual([
      EngineName.Manifest,
      EngineName.Vocabulary,
      EngineName.Capability,
      EngineName.Forms,
      EngineName.Workflow,
    ]);
  });

  it('reports dependents for fan-out', () => {
    const graph = new DependencyGraph();
    expect(graph.dependentsOf(EngineName.Manifest).sort()).toEqual([EngineName.Capability, EngineName.Forms].sort());
    expect(graph.dependentsOf(EngineName.Vocabulary)).toEqual([EngineName.Forms]);
  });

  it('throws on cycles', () => {
    const cyclic = new DependencyGraph({
      [EngineName.Manifest]: [EngineName.Workflow],
      [EngineName.Workflow]: [EngineName.Manifest],
    });
    expect(() => cyclic.topologicalSort()).toThrow(/cycle/i);
  });
});

describe('EventBatcher', () => {
  it('coalesces events sharing a correlationId into one batch on forceFlush', () => {
    const batches: Array<{ correlationId: string; count: number }> = [];
    const batcher = new EventBatcher((batch) => {
      batches.push({ correlationId: batch.correlationId, count: batch.events.length });
    });

    const cid = 'reload-org-1';
    for (let i = 0; i < 5; i++) {
      batcher.push({ engine: EngineName.Manifest, type: `e:${i}`, payload: {}, timestamp: Date.now(), correlationId: cid });
    }
    batcher.forceFlush();

    expect(batches).toHaveLength(1);
    expect(batches[0].count).toBe(5);
    expect(batches[0].correlationId).toBe(cid);
  });

  it('flushes automatically at MAX_BATCH_SIZE (10)', () => {
    const counts: number[] = [];
    const batcher = new EventBatcher((batch) => counts.push(batch.events.length));

    for (let i = 0; i < 11; i++) {
      batcher.push({ engine: EngineName.Manifest, type: `e:${i}`, payload: {}, timestamp: Date.now(), correlationId: 'x' });
    }
    batcher.forceFlush();

    // 10 flushed by size, remaining 1 flushed manually
    expect(counts[0]).toBe(10);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(11);
  });
});
