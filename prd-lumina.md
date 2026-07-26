---
title: "Lumina v2 — Plateforme Universelle d'Organisation"
status: draft
created: "2026-07-22"
updated: "2026-07-22"
version: 2.0-prd
---

# PRD: Lumina v2 — Plateforme Universelle d'Organisation

## 0. Document Purpose

Ce document définit les spécifications fonctionnelles pour la réécriture totale de Lumina en **React Native + TypeScript + InsForge**.

**Pour qui :** Équipe de développement, pasteur responsable, administrateurs MFE-JC.

**Contexte :** L'application Flutter/Dart actuelle souffre de limitations techniques graves (pages blanches, erreurs de routage, propagation chaotique des IDs). Après 5 mois de corrections, une réécriture complète est nécessaire.

**Objectif :** Construire un système robuste, maintenable et évolutable capable de gérer n'importe quelle organisation (église, ONG, école, entreprise).

---

## 1. Vision

Lumina v2 est une **Plateforme Universelle d'Organisation** (Universal Organization Platform — UOP). Elle n'est PAS une application de gestion d'église — c'est un système d'exploitation organisationnel dont la première implémentation cible les églises MFE-JC.

### Engagement Principal : Transparence Financière Absolue

Chaque transaction (dîme, offrande, dépense) est enregistrée, catégorisée et traçable jusqu'à la source. Un trésorier, pasteur ou auditeur peut expliquer l'utilisation exacte de chaque sou collectée.

### Cible Utilisateur

L'application est conçue pour les **leaders** de l'organisation, pas pour les membres. Interface pensée pour la rapidité et la simplicité par un nombre limité de personnes clés.

---

## 2. Architecture : Platform Core (Lightweight Runtime)

### Voir d'abord...
- [Architecture-Map.md](docs/00-architecture/Architecture-Map.md) → Vue d'ensemble du système
- [Dependency-Contract.md](docs/00-architecture/Dependency-Contract.md) → Règles de dépendances
- [AI-Collaboration-Protocol.md](docs/00-architecture/AI-Collaboration-Protocol.md) → Règles agents IA
- [Documentation-Discipline.md](docs/00-architecture/Documentation-Discipline.md) → Règle synchro code/docs

### 2.1 Principe Fondamental

> **Le cœur de Lumina ne connaît pas les églises. Il connaît uniquement les organisations.**

Une organisation est un type abstrait : église, ONG, école, entreprise, association, etc. Le comportement est déterminé par un **manifeste de configuration**, jamais par du code dur.

### 2.2 Les 5 Moteurs du Platform Core

| Moteur | Rôle | Doc |
|---|---|---|
| **Manifest Engine** | Configuration organisationnelle YAML/JSON | [docs/01-platform-core/manifest-engine/index.md](docs/01-platform-core/manifest-engine/index.md) |
| **Vocabulary Engine** | Catalogue centralisé de termes et valeurs | [docs/01-platform-core/vocabulary-engine/index.md](docs/01-platform-core/vocabulary-engine/index.md) |
| **Forms Engine** | Génération de formulaires dynamiques | [docs/01-platform-core/forms-engine/index.md](docs/01-platform-core/forms-engine/index.md) |
| **Workflow Engine** | Orchestration de séquences et approbations | [docs/01-platform-core/workflow-engine/index.md](docs/01-platform-core/workflow-engine/index.md) |
| **Capability Engine** | Registre de fonctionnalités activables | [docs/01-platform-core/capability-engine/index.md](docs/01-platform-core/capability-engine/index.md) |

### 2.3 Stack Technique

| Couche | Technologie |
|---|---|
| Frontend | React Native + TypeScript + Expo |
| Offline DB | WatermelonDB (SQLite wrapper) |
| Backend | InsForge |
| Database | PostgreSQL |
| Auth | JWT + Session |
| UI Library | React Native Paper |
| Deployment | Vercel (frontend) + Server hosting (InsForge) |

---

## 3. Offline-First

L'application fonctionne **100% hors-ligne** avec synchronisation automatique au retour du réseau.

**Spécification complète :** [docs/02-offline-first/index.md](docs/02-offline-first/index.md)

### Stratégie de Conflits

| Type de Données | Stratégie |
|---|---|
| Transactions financières | Immutable (bloquer après validation) |
| Transactions Draft (hors validation) | UUID client-side + device_id, dédoublonnage à la sync, side-by-side diff si collision |
| Membres | Last-Writer-Wins (timestamp) |
| Événements | LWW avec notification |
| Formulaires | Server-wins si schema mismatch |

---

## 4. MVP : 10 Fonctionnalités Prioritaires

### Niveau K1 — Critique (Semaines 1-4)

| # | Fonctionnalité | Description |
|---|---|---|
| 1 | Authentification Admin | Login, rôles, permissions |
| 2 | Configuration Organisation | Setup du manifest |
| 3 | Grand Livre (Ledger) | Enregistrement transactions |
| 4 | Bilan Financier | Actif, passif, résultat |
| 5 | Rapports Financiers | PDF/CSV export |

### Niveau K2 — Important (Semaines 5-8)

| # | Fonctionnalité | Description |
|---|---|---|
| 6 | Gestion Membres | CRUD basique, dossiers |
| 7 | Calendrier Événements | Planning de base |
| 8 | Gestion Rôles/Permissions | Via manifest |

### Niveau K3 — Souhaitable (Semaines 9-12)

| # | Fonctionnalité | Description |
|---|---|---|
| 9 | Notifications | Alertes internes |
| 10 | Export/Import Données | Migration, backup |

**Fonctionnalités retirées du MVP :** Bible (V2), Sacrements (V2), Budget (V2), Communication membres (V3), Analytics (V3).

**Roadmap détaillée :** [ROADMAP_DEVELOPPEMENT.md](ROADMAP_DEVELOPPEMENT.md)

---

## 5. Règles Fondamentales

### Invariants (10 règles absolues)
[Voir docs/99-supporting/invariants.md](docs/99-supporting/invariants.md)

Points clés :
- **INV-001** : Transaction validée = immutable
- **INV-002** : Platform Core ne connaît aucun métier spécifique
- **INV-003** : Toujours fonctionnel hors-ligne
- **INV-004** : Isolement multi-tenant absolu
- **INV-005** : Configuration > code dur

### NeverBreak Rules (10 règles inviolables)
[Voir docs/99-supporting/neverbreak.md](docs/99-supporting/neverbreak.md)

Points clés :
- **NB-01** : Document max 400 lignes
- **NB-03** : Aucune modification transaction approved
- **NB-04** : Header x-org-id obligatoire sur tout appel API
- **NB-07** : Zéro type `any` en TypeScript
- **NB-09** : Coverage finance >= 90%

---

## 6. Architecture Decision Records (ADRs)

| ADR | Sujet |
|---|---|
| [ADR-001](docs/90-adrs/ADR-001-platform-core-vs-full-runtime.md) | Platform Core léger vs Runtime complet |
| [ADR-002](docs/90-adrs/ADR-002-react-native-rewrite-over-flutter-migration.md) | Réécriture RN vs Migration Flutter |
| [ADR-003](docs/90-adrs/ADR-003-watermelondb-offline-first.md) | WatermelonDB pour offline-first |
| [ADR-004](docs/90-adrs/ADR-004-financial-immutability.md) | Immuabilité transactions financières |
| [ADR-005](docs/90-adrs/ADR-005-react-native-typescript-insforge-stack.md) | Stack technique RN + TS + InsForge |
| [ADR-006](docs/90-adrs/ADR-006-multi-tenant-data-isolation.md) | Isolement données multi-tenants |
| [ADR-007](docs/90-adrs/ADR-007-mvp-10-features-scope.md) | MVP réduit à 10 fonctionnalités |
| [ADR-008](docs/90-adrs/ADR-008-modular-documentation-for-ai-agents.md) | Documentation modulaire pour agents IA |
| [ADR-009](docs/90-adrs/ADR-009-admin-only-auth-mvp.md) | Authentification admin-uniquement en MVP |
| [ADR-010](docs/90-adrs/ADR-010-finance-first-priority.md) | Priorité absolue au module financier |
| [ADR-016](docs/90-adrs/ADR-016-offline-draft-concurrency.md) | Conflits offline — transactions draft multi-appareil |

---

## 7. Documentation Supplémentaire

| Document | Description |
|---|---|
| [Decision Trees](docs/99-supporting/decision-trees.md) | Arbres de décision pour développement |
| [Glossary](docs/99-supporting/glossary.md) | Terminologie officielle |

---

## 8. Critères de Succès du MVP

| Critère | Objectif |
|---|---|
| Durée de développement | 12 semaines maximum |
| Transactions/jour supportées | 100+ sans latence |
| Bilan généré en | < 3 secondes |
| Données perdues en offline | 0 (zéro) |
| Bugs critiques sur finance | 0 après 30 jours |
| Coverage tests finance | >= 90% |
| Violations NeverBreak | 0 |

---

## 9. Prochaines Étapes

1. [ ] Créer les fichiers de configuration (manifests, schemas)
2. [ ] Initialiser le projet React Native + Expo
3. [ ] Configurer InsForge + PostgreSQL
4. [ ] Implémenter Platform Core (5 moteurs)
5. [ ] Implémenter Offline-First (WatermelonDB)
6. [ ] Développer les 10 fonctionnalités MVP
7. [ ] Tester en mode offline complet
8. [ ] Déployer en production pour MFE-JC
