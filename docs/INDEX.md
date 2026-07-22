# Index de la Documentation Lumina v2

**Doc ID:** DOC-INDEX  
**Version:** 2.0

---

## 1. Comment Naviguer

Ce projet utilise une **documentation modulaire** : chaque document fait moins de 400 lignes (~10 pages max) pour une efficacité optimale avec les agents IA.

**Règle :** Chaque fois que vous travaillez sur un sujet, lisez D'ABORD le document correspondant dans cet index, pas le PRD général.

---

## 2. Structure des Docs

```
docs/
├── 00-architecture/           ← Vision architecte & gouvernance IA ⭐ NOUVEAU
│   ├── Architecture-Map.md            ← Vue globale (1 page)
│   ├── Dependency-Contract.md         ← Dépendances autorisées/interdites
│   ├── AI-Collaboration-Protocol.md   ← Protocole agents IA
│   ├── Definition-of-Done.md          ← Checklist terminaison tâche
│   ├── Traceability-Matrix.md         ← Liaison PRD→ADR→Engine→Test
│   └── Documentation-Discipline.md    ← Règle synchro code/docs
│
├── 01-platform-core/          ← Moteurs du Platform Core
│   ├── index.md               ← Vue d'ensemble (1 page)
│   ├── manifest-engine/
│   │   └── index.md           ← Manifest Engine (8 pages)
│   ├── workflow-engine/
│   │   └── index.md           ← Workflow Engine (7 pages)
│   ├── forms-engine/
│   │   └── index.md           ← Forms Engine (8 pages)
│   ├── vocabulary-engine/
│   │   └── index.md           ← Vocabulary Engine (5 pages)
│   └── capability-engine/
│       └── index.md           ← Capability Engine (4 pages)
│
├── 02-offline-first/          ← Spécification Offline
│   └── index.md               ← WatermelonDB + Sync + Conflits
│
├── 03-configuration/          ← Fichiers de configuration
│   └── mfejc-manifest-example.md ← Exemple complet manifest
│
├── 04-business-rules/         ← Règles métier
│   ├── financial-rules.md     ← Règles financières
│   └── membership-rules.md    ← Règles membres
│
├── 05-api-contracts/          ← Contrats API
│   └── api-contracts.md       ← Endpoints + Types
│
├── 06-development-handbook/   ← 🆕 Guide multi-agents (git, modules, collaboration)
│   └── Development-Handbook.md ← Workflow git, boundaries modules, testing protocol
│
├── 07-frontend-guide/         ← 🆕 Structure React Native complète
│   └── Frontend-Implementation-Guide.md ← Architecture src/, contracts features, adapter pattern
│
├── 08-backend-guide/          ← 🆕 Spécifications InsForge + PostgreSQL
│   └── Backend-Implementation-Guide.md ← Migrations, RLS policies, functions, storage buckets
│
├── 09-testing-strategy/       ← 🆕 Matrice couverture tests par module
│   └── Testing-Strategy.md ← Unit/component/integration/E2E, invariant testing, CI pipeline
│
├── 08-development-setup/      ← 🆕 Environnement dev pas-à-pas
│   └── Environment-Guide.md   ← Prérequis Node/Expo/InsForge, variables env, launch commands
│
├── 90-adrs/                   ← Architecture Decision Records
│   ├── ADR-001-*.md           ← Platform Core vs Full Runtime
│   ├── ADR-002-*.md           ← React Native Rewrite
│   ├── ADR-003-*.md           ← WatermelonDB
│   ├── ADR-004-*.md           ← Financial Immutability
│   ├── ADR-005-*.md           ← Tech Stack
│   ├── ADR-006-*.md           ← Multi-Tenant Isolation
│   ├── ADR-007-*.md           ← MVP Scope
│   ├── ADR-008-*.md           ← Modular Documentation
│   ├── ADR-009-*.md           ← Admin-Only Auth
│   └── ADR-010-*.md           ← Finance First Priority
│
├── 99-supporting/             ← Documents transversaux
│   ├── invariants.md          ← 10 Invariants (2 pages)
│   ├── neverbreak.md          ← 10 NeverBreak Rules (3 pages)
│   ├── decision-trees.md      ← Arbres de décision (3 pages)
│   └── glossary.md            ← Glossaire officiel (2 pages)
│
└── legacy-analysis/           ← Analyse code existant
    └── (à créer quand nécessaire)
```

---

## 3. Guide par Scène de Développement

| Vous voulez... | Lire... |
|---|---|
| Comprendre l'architecture générale | [PRD](../PRD_LUMINA_v2.md) → Section 2 |
| Débuter sur le projet | [Environment Guide](08-development-setup/Environment-Guide.md) |
| Comprendre comment coder en multi-agent | [Development Handbook](06-development-handbook/Development-Handbook.md) |
| Créer le scaffold React Native | [Frontend Implementation Guide](07-frontend-guide/Frontend-Implementation-Guide.md) |
| Configurer le backend InsForge | [Backend Implementation Guide](08-backend-guide/Backend-Implementation-Guide.md) |
| Ajouter un nouveau type d'org | [Decision Trees](99-supporting/decision-trees.md) Arbre #1 → Manifest Engine |
| Créer un formulaire | Forms Engine + [Glossary](99-supporting/glossary.md) (termes UI) |
| Définir un workflow d'approbation | Workflow Engine + [Business Rules](04-business-rules/financial-rules.md) |
| Gérer les données offline | [Offline First](02-offline-first/index.md) + [ADR-003](90-adrs/ADR-003-watermelondb-offline-first.md) |
| Corriger un bug financier | [Invariants](99-supporting/invariants.md) INV-001 → ADR-004 |
| Écrire des tests | [Testing Strategy](09-testing-strategy/Testing-Strategy.md) |
| Vérifier si une règle est violée | [NeverBreak Rules](99-supporting/neverbreak.md) |
| Décider quelle doc lire | Ce fichier (Index) |

---

## 4. Check-list Complétude Documentation

Tous les dossiers doivent exister pour qu'un agent puisse commencer à coder sans ambiguïté :

- [x] `00-architecture/` — Architecture map, contracts, ADR governance
- [x] `01-platform-core/` — 5 moteurs du Platform Core documentés
- [x] `02-offline-first/` — WatermelonDB sync + conflict resolution spec
- [x] `03-configuration/` — Exemple manifest complet MFE-JC
- [x] `04-business-rules/` — Règles finance + membres
- [x] `05-api-contracts/` — Endpoints + types
- [x] `06-development-handbook/` — 🆕 Git, module boundaries, test protocol
- [x] `07-frontend-guide/` — 🆕 Structure src/, contracts features, adapter pattern, theming
- [x] `08-backend-guide/` — 🆕 Migrations SQL, RLS policies, functions, storage buckets
- [x] `09-testing-strategy/` — 🆕 Matrice couverture, invariant testing, CI pipeline
- [x] `08-development-setup/` — 🆕 Prérequis, variables env, commandes lancement, debugging
- [x] `07-database-schema/` — Modèles WatermelonDB + PostgreSQL + migrations
- [x] `08-organization-graph/` — DAG org structure, inheritance rules
- [x] `90-adrs/` — 10 ADRs couvrant toutes les décisions architecturales
- [x] `99-supporting/` — Invariants, NeverBreak, decision trees, glossary
- [ ] `legacy-analysis/` — Analyse comparative code Flutter → React Native (facultatif mais recommandé)

