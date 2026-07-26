# Plan de Recherche — Architecture Runtime Lumina v2

> **Date:** 2026-07-24  
> **Contexte:** Lumina est un système d'exploitation organisationnel — pas une app CRUD.  
> Le Runtime est le moteur qui fait TIRER les 5 moteurs (Manifest, Vocabulary, Forms, Workflow, Capability).  
> Objectif: Identifier LES recherches techniques prioritaires pour construire un Runtime robuste, performant, et extensible.

---

## 1. Comprendre la Grandeur du Projet

### 1.1 Lumina = Plateforme Runtime + Applications Multiples

```
Manifest Engine (Configuration → Runtime Config)
       ↓
Capability Engine (Features activées/désactivées)
       ↓
Vocabulary Engine (Termes, enums, labels, i18n)
       ↓
Forms Engine (Formulaires dynamiques JSON → React Native)
Workflow Engine (Séquences d'actions, approvals, notifications)
       ↓
Presentation Layer (Écrans composés depuis les moteurs)
       ↓
Data Layer (WatermelonDB → InsForge REST → PostgreSQL)
```

**Chaque moteur a son API TypeScript définie, son format YAML, ses règles d'or.**
Le Runtime est ce qui orchestre TODS ces moteurs ensemble.

### 1.2 Scale du Runtime

Un Runtime Lumina doit gérer:
- **Multi-tenant** — Chaque org a SON manifest, SON vocabulaire, SES forms, SES workflows
- **Hot-swap** — Changement de manifest sans re-déploiement
- **Offline-first** — Le Runtime doit fonctionner partiellement hors-ligne (manifest cache, forms locaux)
- **Multi-appareil** — Même config sync across appareils
- **Versioning** — Rollback de manifest si nouvelle version cassée
- **Validation stricte** — Manifest invalide = app bloquée (R-04 du Manifest Engine)

---

## 2. Points de Recherche Prioritaires

### RECHERCHE A: Compilation Manifest → Runtime Object

**Question centrale:** Comment compiler un YAML/JSON arbitraire en un objet JavaScript runtime-safe en moins de 50ms?

**Sous-questions:**
1. Quel outil de compilation YAML → JSON → Objet Typé? (js-yaml + AJV + custom transformer?)
2. Comment le caching fonctionne-t-il? (Memoization LRU? Stockage SQLite? Both?)
3. Comment handle les dépendances croisées entre moteurs? (Manifest → Forms refs Vocabulary, Workflow refs Capability...)
4. Quelle est la stratégie de parsing pour handles 10K+ formulaires dans un manifest?
5. Comment garantir que le runtime object est 100% type-safe? (Zod validation post-parse?)

**Livrable attendu:** Architecture du `ManifestCompiler` + Benchmark compilation time

---

### RECHERCHE B: Hot-Swap Capability & Feature Activation

**Question centrale:** Comment activer/désactiver des features ENTIERES (avec leurs écrans, workflows, forms) SANS redémarrage de l'app?

**Sous-questions:**
1. Pattern EventEmitter + React Context pour propager le changement aux composants?
2. Comment unload un module qui a déjà monté ses écrans dans le routeur?
3. Comment le Capability Engine notifie le Forms Engine qu'un form doit disparaître?
4. Stratégie de rollback: si nouvelle feature crash, revert automatique?
5. Comment hot-swap un workflow qui est EN COURS d'exécution?

**Livrable attendu:** Architecture du `RuntimeFeatureRouter` + Pattern hot-swap

---

### RECHERCHE C: Runtime State Management — Un Seul Source de Vérité

**Question centrale:** Où vit l'état du Runtime et comment les moteurs y accèdent sans créer de boucles de re-render?

**Sous-questions:**
1. Context AppState unique vs split en plusieurs contexts par moteur?
2. Comment WatermelonDB subscriptions interfacent avec le Manifest Engine?
3. Pattern pour éviter N re-renders quand le manifest change ET que 5 engines émettent des events?
4. Comment le Forms Engine sait QUAND re-render un formulaire après changement de vocabulaire?
5. Strategy for debouncing multiple engine events (manifest:updated + vocab:changed → batch re-render)?

**Livrable attendu:** Architecture du `RuntimeStateStore` + Pattern event batching

---

### RECHERCHE D: Sécurité Runtime — Prevention d'Injection

**Question centrale:** Comment s'assurer qu'un manifest malveillant NE PEUT PAS exécuter du code arbitraire sur l'appareil?

**Sous-questions:**
1. Pattern SafeCapabilityRegistry: whitelist d'action handlers obligatoires (déjà partiellement specifié)
2. Comment sandboxer le JSONata evaluation? (AST-safe par design, mais comment garantir?)
3. Comment empêcher un manifest de référencer un capability non-register?
4. Validation schema vs runtime type-checking — lequel est authoritative?
5. Comment limiter les ressources? (Un manifest ne devrait pas pouvoir créer 1000 formulaires et crash l'app?)

**Livrable attendu:** Architecture du `SafeRuntimeExecutor` + Security audit checklist

---

### RECHERCHE E: Offline Runtime — Graceful Degradation

**Question centrale:** Comment le Runtime se comporte-t-il quand le manifest server est inaccessible?

**Sous-questions:**
1. Cache strategy: quelles parties du Runtime sont mises en cache localement? (manifest? forms definitions? vocabulary?)
2. TTL pour le manifest cached? Quand force-refresh?
3. Comment un formulaire offline sait-il quelles validations appliquer si le schema JSON est côté serveur?
4. Pattern pour déployer un nouveau manifest alors que l'app est offline?
5. Comment gérer les conflicts entre modifications manifest offline vs online?

**Livrable attendu:** Architecture du `OfflineRuntimeCache` + Sync protocol manifest

---

### RECHERCHE F: Performance Runtime — Temps de Réponse Cibles

**Question centrale:** Combien de temps peut prendre chaque étape du Runtime avant que l'utilisateur ne perçoive de lag?

**Sous-questions:**
1. Target: Load manifest ≤ 50ms, Compile ≤ 30ms, Render form ≤ 200ms — how to achieve?
2. Memoization strategies pour le compilation pipeline
3. Lazy loading des features — charger le manifest finance seulement si finance est active
4. Comment le Forms Engine render 50 champs dynamiques sans bloquer l'UI thread?
5. Reanimated worklets pour les calculs de rendu hors du main thread?

**Livrable attendu:** Performance budget + Optimization strategy document

---

### RECHERCHE G: Versioning et Rollback du Runtime

**Question centrale:** Comment versionner tout le Runtime (manifest + schemas + compiled configs) et faire rollback en cas de problème?

**Sous-questions:**
1. Strategy: version par manifest file? Version globale du platform core? Both?
2. Migration path: quel manifest peut lire quelle version de forms/workflow definitions?
3. Rollback procedure: si un manifest v2.1 crash, revert à v2.0 conservé où? (WatermelonDB local)
4. Audit trail: chaque modification de manifest doit être tracée qui/quand/pourquoi
5. Comment le Manifest Engine détecte qu'un manifest legacy est incompatible avec le current Runtime version?

**Livrable attendu:** Architecture du `RuntimeVersionManager` + Migration guide

---

### RECHERCHE H: Debugging Runtime — Observabilité

**Question centrale:** Comment diagnostiquer QUAND un Runtime bug? (Quel moteur? Quelle config? Quelle version?)

**Sous-questions:**
1. Runtime telemetry: quels métriques logger? (compilation time, render count, error rate per engine)
2. Logging strategy: log quoi, où, et comment éviter de spy sur les données sensibles?
3. Dev tools: comment un développeur voit le state complet du Runtime en mode développement?
4. Error boundary pattern pour capturer les crashes de moteur sans crasher l'app entière
5. Report utilisateur friendly: afficher "Erreur de configuration manifest: line 45" au lieu d'un stack trace cryptique

**Livrable attendu:** Architecture du `RuntimeObservability` + DevTools spec

---

## 3. Priorisation des Recherches

| # | Recherche | Impact | Complexité | Bloque Autrui? | Effort Est. |
|---|-----------|--------|------------|----------------|-------------|
| **A** | Compilation Manifest → Runtime Object | CRITIQUE | Moyenne | OUI (tout dépend du compilateur) | 3-5 jours |
| **B** | Hot-Swap Capability & Feature Activation | HAUTE | Élevée | PARTIEL (dépend de A) | 5-7 jours |
| **C** | Runtime State Management | CRITIQUE | Moyenne | OUI (tous les moteurs interagissent) | 3-5 jours |
| **D** | Sécurité Runtime — Injection Prevention | CRITIQUE | Moyenne | OUI (avant writing ANY runtime code) | 2-3 jours |
| **E** | Offline Runtime | HAUTE | Élevée | PARTIEL (dépend de A+C) | 5-7 jours |
| **F** | Performance Runtime | MOYENNE | Moyenne | NON (optimisation itérative) | 3-5 jours |
| **G** | Versioning & Rollback | MOYENNE | Moyenne | NON (ajout post-C) | 2-3 jours |
| **H** | Observabilité & Debugging | BASSE | Faible | NON (ajout post-tout) | 1-2 jours |

---

## 4. Ordre Exécutif Recommandé

```
Phase 1 — FONDATIONS (Jours 1-3)
  ├── RECHERCHE D: Sécurité Runtime      ← FAIRE EN PREMIER, avant TOUT code
  ├── RECHERCHE A: Compilation Manifest   ← Base de TOUT le runtime
  └── RECHERCHE C: State Management       ← Interface entre moteurs

Phase 2 — ORCHESTRATION (Jours 4-7)
  ├── RECHERCHE B: Hot-Swap Capabilities  ← Après A+C (dépend des deux)
  └── RECHERCHE G: Versioning & Rollback  ← Après A (nécessite comprendre le compiler)

Phase 3 — RÉSILIENCE (Jours 8-10)
  ├── RECHERCHE E: Offline Runtime        ← Après A+C (nécessite cache stratégique)
  └── RECHERCHE F: Performance Runtime    ← Optimisation itérative, pas blocking

Phase 4 — VISIBILITÉ (Jour 11)
  └── RECHERCHE H: Observabilité          ← Dernier, consomme le work des phases 1-3
```

---

## 5. Dépendances entre Recherches

```
D (Sécurité) ──→ A (Compilation) ──→ C (State) ──→ B (Hot-Swap)
                                        │              │
                                        ├──────────────┘
                                        │
                                        ├→ E (Offline) ← G (Versioning)
                                        │
                                        └→ F (Performance) [independent optimization]
```

**Règle:** Ne JAMAIS implémenter B (Hot-Swap) sans avoir résolu A (Compilation) et C (State) d'abord. C'est la cause #1 des runtime bugs dans les plateformes configuration-driven.

---

*Plan de Recherche Runtime — 2026-07-24 — Lumina v2*
