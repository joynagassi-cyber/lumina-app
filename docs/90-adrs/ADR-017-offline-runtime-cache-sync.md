# ADR-017 : Offline Runtime — Cache Multi-Niveau et Sync Bidirectionnelle du Manifest

**Date :** 2026-07-24  
**Statut :** ACCEPTÉ  
**Décideurs :** CTO + Architecte Principal  
**Conséquences :** Cache local en 3 niveaux, pile de versions pour rollback, résolution de conflits structurée, sync async pilotée par le réseau

---

## 1. Contexte

L'application Lumina DOIT fonctionner 100% hors-ligne. Le manifest (toggles de features, définitions de formulaires, vocabulaire, workflows) est la donnée critique qui alimente le Feature Hot-Swap Engine. Sans lui, l'app perd sa capacité à charger des modules dynamiques, valider des formulaires, et exécuter des workflows.

> **Voir aussi :** ADR-003 (WatermelonDB offline-first), ADR-016 (conflits drafts), `src/shared/feature-hot-swap/types.ts` (FeatureManifest).

## 2. Décision

### Stratégie de Caching Multi-Niveau

| Tier | Stockage | Données | TTL | Récupération |
|------|----------|---------|-----|--------------|
| **L1 (RAM)** | `Map<string, CacheEntry>` en-process | Manifest complet, forms, vocabulary | Manifest: 5 min, Vocab/Forms: 30 min | `O(1)` lookup |
| **L2 (SQLite)** | WatermelonDB tables `manifest_versions`, `forms`, `vocabulary`, `sync_ops` | Tous les manifests + ops pending | Aucune (persistent) | Relecture au cold start |
| **L3 (FS)** | Expo FileSystem (`CacheDirectory`) | Snapshot JSON du manifest actuel | Aucune (fallback) | Relecture si L2 corrompu |

**Cascade de lecture :** `getManifest(orgId)` → L1 hit → L2 `getAll()` → L3 `loadFile()`.

**Cascade d'écriture :** `setManifest()` → L1 write → L2 upsert → L3 snapshot fire-and-forget.

### Architecture du VersionStack

- Garde les **N dernières versions** (par défaut 3) dans une pile immutable.
- Chaque version est stockée en L2 et L3 de manière indépendante — aucun calcul delta au rollback.
- `append(newManifest)` vérifie l'idempotence (skip si version existante), puis `pruneAbove(maxStored)` supprime les plus anciennes.
- Utilisation : écran de « Déploiement du Manifest » permet de rollback au clic sur une version précédente.

### Validation Offline des Formulaires

Un formulaire offline connaît ses validations parce que **le schema JSON complet est embarqué dans chaque FormDefinition** du manifest :

```typescript
interface FormDefinition {
  id: string;
  schema: Record<string, unknown>;  // JSON Schema Draft-7 compilable par AJV localement
  fields: FormField[];              // metadata UI + constraints
}
```

Au `deployForms()`, le cache stocke les schemas + forme un `OfflineValidationContext` que le moteur AJV compile une fois (`compileValidator` de `src/shared/ajv-validator.ts`). **Zéro appel serveur nécessaire pour valider.**

### Pattern de Sync Bidirectionnelle

```
┌─────────────┐    pull delta     ┌─────────────┐
│   Device     │ ←─────────────── │    Server    │
│   Offline    │   (GET /manifest │  (source     │
│              │    ?since=N)     │  of truth)   │
├─────────────┤                  ├─────────────┤
│   Device     │   push ops       │    Server    │
│   Pending    │ ───────────────→ │   Apply &    │
│   Operations │   POST /sync     │   deduplicate│
└─────────────┘                  └─────────────┘
```

- **Pull** : `GET /api/v1/manifest?since={lastVersion}` → delta. Si full sync required, server retourne `{ full: true, manifest }`.
- **Push** : file d'ops en L2 drainée par `ConnectivityListener.executePendingOps()`. Chaque op a un `conflictResolution` strategy hint.

### Résolution de Conflits de Manifest

Deux admins modifient simultanément sans connexion :

1. Au reconnect, `ManifestConflictResolver.compare(server, client)` calcule la diff structurée.
2. Chaque path a une stratégie prédéfinie :
   - `/features/*/enabled` → **merge** (toggles se fusionnent)
   - `/formSchemas/*/schema` → **server-wins** (schéma unsafe à override)
   - `/vocabulary/*/label` → **merge** (vocabulaire org-spécifique)
   - `/` (inconnu) → **manual-review** (escalade humaine)
3. Si aucune requiert pas `manual-review`, `merge()` produit automatiquement le manifest fusionné.

### Graceful Degradation

| Dégradation | Comportement |
|-------------|-------------|
| **Rien en cache** | App charge les données par défaut, features désactivées, forms en mode lecture seule |
| **Vocabularie absent** | Labels fallback sur les IDs bruts (`draft` → affiché "draft" au lieu de "Brouillon") |
| **Form schemas absents** | Forms visibles mais sans validation client — submission échoue silencieusement en L2, retry au sync |
| **Manifest absent** | Aucun feature dynamique activé, navigation statique seulement |
| **L1 seul, L2 corrompu** | L3 FS sert de fallback — manifest restauré, besoin de re-populer L2 au prochain warm start |

---

## 3. Alternatives Envisagées

### Alternative A : Service Worker + Cache API (PWA only)
- **Inconvénients** : React Native n'utilise pas de Service Worker natif. N'influence que le web export d'Expo. Exclu car l'app doit être RN-native.

### Alternative B : CRDTs pour le manifest (Yjs / Automerge)
- **Avantages** : merge automatique conflict-free garanti mathématiquement.
- **Inconvénients** : Surdimensionné pour un manifest qui change rarement (< 10 ops/jour). Bundle size +50KB. Complexité de debugging trop élevée pour un artefact administrateur unique. Revisitée si > 50 admins concurrents.

### Alternative C : Stockage diff-only (L2 garde uniquement le delta vs version N)
- **Inconvénients** : Rollback nécessite recalculer N-1 depuis N-2 + delta → O(n) au lieu de O(1). Le manifest est petit (< 100KB) donc la storage economy ne justifie pas la complexité.

### Alternative D : Prefetch au boot (charger tout le manifest au démarrage)
- Adopté partiellement : le cache L2 est pré-rempli au premier boot via `refreshFromServer()`. Mais la sync delta reste pilotée par ConnectivityListener, pas par un preload naïf.

---

## 4. Conséquences

### Positives
- ✅ 100% offline garantie sur les 3 tiers — même en cas de corruption SQLite, le FS garantit un recovery
- ✅ Rollback instantané sur 3 versions — zéro recalcul, zéro appel réseau
- ✅ Validation de formulaires entièrement locale via AJV — pas de dépendance schéma serveur
- ✅ Sync bidirectionnelle structurée avec stratégies par-champ — merge automatique sauf danger
- ✅ Compatible avec l'existant : WatermelonDB (ADR-003), AJV validator, netinfo déjà installés

### Négatives (et mitigations)
- ⚠️ Stockage multi-tiers = code plus volumineux → **Mitigation** : L3 fire-and-forget, L2 lazy-loaded, L1 en-memory, chaque tier est optionnel
- ⚠️ Merge automatique peut introduire des états inattendus → **Mitigation** : logs de chaque merge dans L2 `sync_ops` table pour audit
- ⚠️ TTL court (5 min) pour le manifest en L1 peut causer des misses fréquents → **Mitigation** : L2 couvre immédiatement après miss L1 ; latence perçue ~2ms

---

## 5. Fichiers Implementés

| Fichier | Description |
|---------|-------------|
| `src/shared/offline-runtime/types.ts` | Totaux TypeScript : manifest, forms, vocab, sync ops, L2/L3 contracts |
| `src/shared/offline-runtime/cache.ts` | `OfflineRuntimeCache` — cascade L1→L2→L3, cascade setManifest, buildValidationContext |
| `src/shared/offline-runtime/version-stack.ts` | `VersionStack` — append, list, rollback, pruning à N versions |
| `src/shared/offline-runtime/conflict-resolver.ts` | `ManifestConflictResolver` — compare(), merge(), strategies par chemin |
| `src/shared/offline-runtime/connectivity-listener.ts` | `ConnectivityListener` — EventEmitter wrapper sur netinfo, OpQueue, executePendingOps |
| `src/shared/offline-runtime/index.ts` | Barrel exports |

---

## 6. Références

- ADR-003 (WatermelonDB offline-first)
- ADR-016 (Conflits offline, transactions draft multi-appareil)
- `src/shared/feature-hot-swap/types.ts` (FeatureManifest shape)
- `src/shared/ajv-validator.ts` (validator factory pour validation schema offline)
- `src/shared/json-validation.ts` (pipeline validateConfig réutilisable)
- PRD Section "Offline-First Requirements"
