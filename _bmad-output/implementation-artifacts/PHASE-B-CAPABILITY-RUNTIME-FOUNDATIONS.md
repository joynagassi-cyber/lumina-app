# Phase B — Fondations Capability / Runtime (COMPLÈTE)

**Date :** 2026-08-08 — **Séquence :** B-1 → B-2 → B-3 → B-4 → B-5 → B-6
**Prérequis :** Phase A (canonisation `src/shared/`, 41 tests verts)

## Bilan final

- **`tsc -p tsconfig.shared.json` : 0 erreur**
- **Tests : 11 suites · 118/118 verts** (`tests/unit/shared/`)
- **Frontend `frontend/` : aucune erreur nouvelle** sur `_layout.tsx`/runtime/`@shared` (les erreurs pré-existantes du frontend restent — scope Phase D)

## Livrables par étape

| Étape | Livrable | Tests |
|---|---|---|
| **B-1 Manifest Engine** | `src/shared/manifest/` : schéma JSON Draft-7 (`additionalProperties:false`), types, moteur AJV (NB-RULE-05, fail-fast), manifest réel MFE-JC, barrel | 6 |
| **B-2 Vocabulary Engine** | `src/shared/vocabulary/` : lookup terme→label FR/EN, chaîne de repli (locale demandée → locale manifest → 1re dispo → clé), aliases, `lookupOrNull`, erreurs structurées | 14 |
| **B-3 Capability Engine** | `src/shared/capability/` : rôles × permissions, wildcard `*` (admin), validation stricte des rôles (erreur de config toujours levée), feature toggles, `checkFeatureAccess` (toggle × permissions), `requirePermission`/`requireFeature` | 19 |
| **B-4 Forms Engine** | `src/shared/forms/` : `FormModel` (defaults typés, coercition FR `12 500`/`12,5`, validation requise/min/max/pattern/date ISO), `selectOptions` pilotées par vocabulaire (INV-009) + renderer RN déclaratif `FormRenderer` (registre de champs extensible) | 18 |
| **B-5 Workflow Engine** | `src/shared/workflow/` : machine à états finance **déclarative** (start → draft → pending → approved/rejected, rejected → draft), `transitionsFrom`/`canTransition`/`pathExists` (BFS)/`transition` (verdict structuré), `validateDefinition` | 17 |
| **B-6 Runtime bootstrap** | `src/shared/runtime/` : `createLuminaRuntime` (factory pure : Manifest→Vocabulary→Capability→Workflow→HotSwap→Offline, stores L2/L3 in-memory de repli), `LuminaRuntimeProvider` React (+ConnectivityListener), **branché dans `frontend/src/app/_layout.tsx`** + alias `@shared/*` dans `frontend/tsconfig.json` | 9 |

## Décisions & corrections notables

1. **`rejected` n'est pas un état final** : le manifest le déclarait `type: end` avec une transition `rejected → draft` (re-soumission) — sémantiquement contradictoire. Corrigé dans `mfe-jc.json` → `type: task` (état actionnable). La validation `validateDefinition` impose : 1 état start, cibles de transitions existantes, aucun état final avec transitions sortantes.
2. **`can()` valide les rôles en amont** : un rôle inconnu lève `CapabilityError` même si un autre rôle accorde la permission — les erreurs de config ne sont jamais masquées par le résultat.
3. **Coercition currency FR** : `'12 500'` → 12500 (espaces milliers), `'12,5'` → 12.5 (virgule décimale convertie en point).
4. **HotSwap n'active que les features activées AVEC module enregistré** : les features sans module (écrans Phase D) restent silencieuses ; crash d'activation → rollback automatique + `onError` (grâce dégradée vérifiée par test).
5. **`toOfflineManifest` mappe OrgManifest → OfflineManifest** (shapes distinctes : `formSchemas`/`vocabulary` aplati/`workflows` avec `config`), persistance L2+L3 pour démarrage offline.
6. **Renderer RN séparé du moteur pur** : `FormRenderer` importe react-native — le barrel `index.ts` l'exporte (consommé par le frontend) mais les tests n'importent que le moteur pur (`forms-engine.ts`), compatible jest node.

## Prochaine étape

- **Phase C — Backend finance** (B1–B6 du MVP-JOUR1-SPEC : guards RBAC via CapabilityEngine, seed, balance, transitions workflow déclaratif) avec le mapping NestJS DI ↔ RTS-001 documenté dans ADR-018.
- **Phase D — Écrans E1–E8** : FeatureModules par écran, schémas forms (déjà déclarés dans le manifest), consommation du runtime par les tabs.
