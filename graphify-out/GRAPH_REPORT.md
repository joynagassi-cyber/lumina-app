# Graph Report - lumina-app  (2026-07-25)

## Corpus Check
- 23 files · ~581,155 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 166 nodes · 270 edges · 9 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `RuntimeStateStore` - 18 edges
2. `HotSwapEngine` - 14 edges
3. `OfflineRuntimeCache` - 11 edges
4. `ConnectivityListener` - 11 edges
5. `ManifestConflictResolver` - 10 edges
6. `VersionStack` - 9 edges
7. `runStoreDemo()` - 7 edges
8. `L1Cache` - 6 edges
9. `OpQueue` - 6 edges
10. `TypedEventEmitter` - 5 edges

## Surprising Connections (you probably didn't know these)
- `compileValidator()` --calls--> `validateConfig()`  [INFERRED]
  src\shared\ajv-validator.ts → src\shared\json-validation.ts
- `preprocessAIRawJSON()` --calls--> `validateConfig()`  [INFERRED]
  src\shared\json-preprocess.ts → src\shared\json-validation.ts
- `robustParseJSON()` --calls--> `validateConfig()`  [INFERRED]
  src\shared\json-robust-parse.ts → src\shared\json-validation.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (5): runStoreDemo(), DependencyGraph, RuntimeStateStore, SubscriptionManager, TypedEventEmitter

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (5): FeatureRegistry, HotSwapEngine, RouteRegistry, SubscriptionManager, WorkflowBridge

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (4): ConnectivityListener, OpQueue, toConnectivityLevel(), toNetworkDetails()

### Community 3 - "Community 3"
Cohesion: 0.22
Nodes (2): L1Cache, OfflineRuntimeCache

### Community 4 - "Community 4"
Cohesion: 0.21
Nodes (4): getNavContainer(), registerDynamicRoute(), subscribeToWatermelon(), EventBatcher

### Community 5 - "Community 5"
Cohesion: 0.35
Nodes (1): ManifestConflictResolver

### Community 6 - "Community 6"
Cohesion: 0.24
Nodes (6): compileValidator(), getAjvInstance(), convertSingleQuotes(), preprocessAIRawJSON(), robustParseJSON(), validateConfig()

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (1): VersionStack

### Community 8 - "Community 8"
Cohesion: 0.53
Nodes (4): useEngine(), useEngineReady(), useEngineVersion(), useRuntimeState()

## Knowledge Gaps
- **Thin community `Community 3`** (17 nodes): `L1Cache`, `.get()`, `.invalidate()`, `.key()`, `.set()`, `OfflineRuntimeCache`, `.buildValidationContext()`, `.constructor()`, `.deployForms()`, `.getForms()`, `.getManifest()`, `.getVocabularyEntry()`, `.invalidate()`, `.loadCategoryIntoL1()`, `.refreshFromServer()`, `.setManifest()`, `cache.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 5`** (11 nodes): `ManifestConflictResolver`, `._applyAtPath()`, `._buildSummary()`, `.compare()`, `._deepMergeAtPath()`, `.merge()`, `._recommendStrategy()`, `._strategyForPath()`, `._valuesEqual()`, `._walkDiff()`, `conflict-resolver.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (9 nodes): `version-stack.ts`, `VersionStack`, `.append()`, `.constructor()`, `.current()`, `.list()`, `._prune()`, `.remove()`, `.rollbackTo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `compileValidator()` connect `Community 6` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `VersionStack` connect `Community 7` to `Community 0`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._