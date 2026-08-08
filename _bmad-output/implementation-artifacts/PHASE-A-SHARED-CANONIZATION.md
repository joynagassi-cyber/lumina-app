# Phase A — Canonisation de la couche `src/shared` (fondations)

**Agent :** Amelia (bmad-agent-dev) · **Date :** 2026-08-08 · **Statut :** ✅ COMPLÈTE

## ACs

| AC | Critère | Résultat |
|----|---------|----------|
| A-1 | Inventaire des 3 copies (src/shared, shared, src/core/runtime) | ✅ Copies vérifiées identiques (diff) |
| A-2 | Fusion `offline-runtime/runtime/**` → `src/shared/offline-runtime/runtime/` | ✅ 5 fichiers fusionnés (ARCHITECTURE.md, RuntimeStateStore, RuntimeContext, index, fanout-example) |
| A-3 | `src/shared` compile avec un tsconfig dédié (`tsconfig.shared.json`) | ✅ 0 erreur (38 corrigées) |
| A-4 | Tests unitaires fondations (red → green) | ✅ 5 suites · 35 tests verts |
| A-5 | Déduplication (sauvegarde réversible) | ✅ `shared/` + `src/core/` → `_bmad-output/dedup-backup-2026-08-08/` |

## Bugs réels découverts et corrigés (red → green)

1. **`json-validation.ts`** — `ajvErrors?: ReturnType<ValidateFunction>['errors']` → `ValidateFunction['errors']` (type faux).
2. **`icon-states.styles.ts`** — `ICON_TOKENS.animations.pulse/spin/warning` inexistants → animation jamais appliquée (ajout des classes NativeWind).
3. **`OfflineRuntimeCache`** — (a) lecture sans version ne touchait jamais L1 (clé stockée avec version) ; (b) `invalidate()` ne purgeait pas L3 → manifest « supprimé » ressuscitait du disque. Ajout de `deleteManifestFile` au contrat L3.
4. **`RuntimeStateStore`** — clone `JSON.stringify` détruisait Map/Set (vocab) et `getState()` renvoyait la même référence → incompatible `useSyncExternalStore`. Refactor : pattern **snapshot immuable** (clone préservant Map/Set), un seul notify par action, `commit(prev)`, découpage `applyAction`/`applyActionInternal` pour un notify unique par batch.

## État final

```
src/shared/
├── ajv-validator.ts · json-preprocess.ts · json-robust-parse.ts · json-validation.ts · index.ts
├── design/           (icon-registry, tokens/icon-states)
├── feature-hot-swap/ (HotSwapEngine, types, runtime-patches)
└── offline-runtime/  (cache L1/L2/L3, conflict-resolver, connectivity-listener, version-stack, runtime/)
```

- `npx tsc --noEmit -p tsconfig.shared.json` → **0 erreur**
- `npx jest tests/unit/shared` → **35/35 verts**

## Prochaine phase

**Phase B — Fondations capability/runtime** (B-1 Manifest Engine → B-2 Vocabulary → B-3 Capability/Permission → B-4 Forms → B-5 Workflow → B-6 branchement HotSwap + offline).
