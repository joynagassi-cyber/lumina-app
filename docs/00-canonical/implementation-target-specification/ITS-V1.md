# Implementation Target Specification v1.0

**Doc ID:** ITS-V1 (HORS SERIE CANONIQUE)
**Version:** 1.0.0
**Statut:** SPECIFICATION OBJET IMPLEMENTATION
**Date:** 2026-07-26T00:00:00Z
**Générateur :** ITS Generator v1.0
**Source canonique :** ["DOC-000", "DOC-024", "RTS-v1", "PROTO-v1", "PAS-v1"]
**Transformation_rule :** "implementation-target-selection v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## MARQUAGE IGS-v1

```sql
-- === IGS METADATA ===
-- generation_id: SHA-256(at-content)
-- source_canonical: ["DOC-000", "DOC-024", "RTS-v1", "PROTO-v1", "PAS-v1"]
-- transformation_rule: "implementation-target-selection v1.0"
-- generation_date: "2026-07-26T00:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- compliance_status: "COMPLIANT"
-- =====================
```

---

## 1. RESUME EXECUTIF

La présente Specification Objet d'Implementation (ITS-v1) définit le **stack technologique cible** pour la mise en production de la plateforme Lumina v1.0. Ce document constitue le pont formel entre les spécifications protocol-agnostiques (RTS-v1, PROTO-v1, PAS-v1) et l'implémentation concrète.

L'ITS-v1 répond à une contrainte constitutionnelle du pipeline IGS-v1 : aucun générateur ne peut produire d'artefacts d'exécution sans cette specification de cible d'implémentation.

**Decision :** Le choix du stack est **contraint** — aucune technologie supplémentaire n'est autorisée au-delà de celle listée en §2 sans ADR préalable.

---

## 2. STACK TECHNOLOGIQUE CIBLE

### 2.1 Runtime & Langage

| Élément | Valeur | Justification |
|---------|--------|---------------|
| **Langage** | TypeScript 5.x strict mode | Typage fort, compatible avec NestJS et React Native, support IGS-v1 |
| **Runtime Backend** | Node.js 20+ LTS | Support natif ES modules, stream API, performance websockets |
| **Runtime Frontend** | React Native Hermes (Expo SDK 51+) | Mobile-first, performances native, hot code reload, compatibility Expo Router v4 |
| **Build System** | Bun | 10x faster builds que npm/pnpm/yarn, compatible ESM, drop-in npm replacement |
| **Package Manager** | bun | Aligné avec Bun runtime, gestion lockfile bun.lockb |

### 2.2 Framework & Moteurs

| Couche | Technologie | Justification |
|--------|------------|---------------|
| **Backend API** | NestJS 10+ (modules) | Architecture port-adapters native, décorateurs, injection de dépendances, testing integrado |
| **Frontend Routing** | Expo Router v4 | File-based routing, deep linking, compatible with Web for responsive access |
| **Base de données** | PostgreSQL 16+ (Supabase) | Conforme au schema pack canonique, RLS natif, JSONB support |
| **ORM / Query Builder** | Prisma 5+ (schema-first) | Génération de types TS from schema, migrations, constraints validation |
| **State Management** | @reduxjs/toolkit + RTK Query | Cache managé, optimistic updates, compatible RN |
| **Données Locales (Offline)** | WatermelonDB | SQLite wrapper RN, reactive, design offline-first, conflict resolution |
| **Auth** | JWT court terme + Refresh long terme | SecureStore RN pour stockage token, rotation refresh chaque 30j |
| **Synchronisation** | Custom sync engine per RTS-v1 | Queue pending_operations + conflict resolution policy par aggregate |
| **Notifications Push** | Expo Push API | Natif à Expo, batched delivery, platform detection (iOS/Android/Web) |
| **Stockage Fichiers** | Supabase Storage | S3-compatible, RLS policies, CDN intégré |
| **i18n** | i18next + react-i18next | Support RN, pluriel, loading asynchrone de bundles |
| **Style/CSS** | NativeWind v4 (Tailwind RN) | Design tokens driven, dark/light mode support, compile-time CSS extraction |

### 2.3 Qualité, Testing & CI/CD

| Outil | Valeur | Usage |
|-------|--------|-------|
| **Linting/Formatting** | Biome | Drop-in ESLint+Prettier, 20x plus rapide, vérification types TS intégrée |
| **Tests Unitaires** | Jest 29+ | Backend NestJS + logique frontend, coverage >90% requis |
| **Tests End-to-End** | Detox | Tests e2e RN sur émulateurs/simulateurs |
| **Tests API Intégration** | Playwright | Validation contracts REST/webhook |
| **CI/CD** | GitHub Actions | Pipeline automatisé: lint → test → build → deploy |
| **Hôte CI** | linux x64 uniquement | Conforme invariant CI-001 |
| **Feature Flags** | Configuration JSON file | Hot-reloadable, versionné en git, pas de dependency externe |

### 2.4 Frontend Platform

| Critère | Valeur | Justification |
|---------|--------|---------------|
| **Cible principale** | react-native-web + expo | Mobile-first, responsive web via expo-web |
| **Mode styling** | Design-token driven par accent_hex org config | Thème dynamique, multi-branding |
| **Architecture UI** | Component-driven (Storybook-ready) | Réutilisabilité, testing visuel |

---

## 3. DECISIONS ARCHITECTURALES

### 3.1 Pourquoi NestJS et non Express direct ?

NestJS impose une **architecture modulaire structurée** alignée sur le Ports & Adapters pattern (PAS-v1). Les décorateurs `@Roles()`, `@UseGuards()`, `@Inject()` correspondent aux mécanismes de gouvernance définis dans ADR-013. Express pur serait trop permissif et ne garantirait pas la cohérence architecturelle.

### 3.2 Pourquoi WatermelonDB et non Realm / SQLite brut ?

WatermelonDB est le seul ORM mobile qui implémente nativement :
- La réactivité avec Observer pattern (synchro temps réel avec state Redux)
- Un design offline-first avec conflict resolution strategy
- La compatibilité avec PostgreSQL schema (types UUID, jsonb, timestamptz)

### 3.3 Pourquoi Expo et non React Native CLI ?

Expo fournit :
- Expo Router v4 (file-based routing conforme ADR-012)
- Gestion native des notifications push (Expo Push API)
- Build system (EAS Build) pour production iOS/Android
- Compatibilité react-native-web pour le responsive

Le CLI natif ne fourni pas ces services intégrés et multiplierait la dette technique.

### 3.4 Pourquoi Bun et non npm/pnpm/yarn ?

Performance : Bun est ~4-10x plus rapide pour l'installation de paquets et les builds. En phase de développement itératif, le gain de temps est significatif. Bun est aussi compatible ESM natif.

---

## 4. CONTRAINTES D'IMPLEMENTATION

### 4.1 Invariants Technologiques

Les règles suivantes sont **non négociables** :

1. **NB-TECH-001** : Toutes les technologies doivent être listées dans §2. Aucune addition sans ADR.
2. **NB-TECH-002** : Le typage TypeScript doit être en mode `strict` (strict: true dans tsconfig.json).
3. **NB-TECH-003** : WatermelonDB est le seul ORM mobile autorisé.
4. **NB-TECH-004** : PostgreSQL 16+ est la seule base de données autorisée.
5. **NB-TECH-005** : L'authentification MUST utiliser JWT court terme + refresh token, stocké dans SecureStore (RN) ou httpOnly cookie (Web).
6. **NB-TECH-006** : L'offline-first est garanti par WatermelonDB pour RN et Prisma + RTK Query cache pour le cache layer côté client.
7. **NB-TECH-007** : Les tests unitaires doivent atteindre ≥90% de couverture sur le backend et ≥80% sur le frontend.
8. **NB-TECH-008** : Le déploiement CI utilise GitHub Actions sur hôte linux x64 uniquement.
9. **NB-TECH-009** : Le style est 100% driven par des design tokens (NativeWind), jamais de valeurs hexadécimales hardcodées dans les composants.
10. **NB-TECH-010** : Chaque module NestJS doit exposer un interface public via module exports (architecture closed-box).

### 4.2 Non-Objectifs

- Pas de serverless functions (gardé en hors-scope v1)
- Pas de GraphQL (REST + Webhooks uniquement, conforme PAS-v1)
- Pas de microservices (monorepo monolithique modulaire)
- Pas de WASM sandbox (hors scope v1, peut arriver en v2)

---

## 5. MAPPEMENT VERS LES SPECIFICATIONS CANONIQUES

| Specification | Map ITS |
|--------------|---------|
| RTS-v1 (Runtime Spec) | §2.1 (Node.js 20+), §2.4 (state management, WatermelonDB) |
| PROTO-v1 (Protocol Adapters) | §2.2 (NestJS controllers, REST/HTTP adapters) |
| PAS-v1 (Ports & Adapters) | §2.2 (NestJS modules = ports, Prisma/WatermelonDB = adapter implementations) |
| DOC-024 (Generator Governance) | §3 (tech choices constrained), §4 (implementation invariants) |
| ADR-012 (expo-router) | §2.2 (Expo Router v4) |
| ADR-013 (NestJS adoption) | §3.1 (justification NestJS) |

---

## 6. CERTIFICATION

Ce document certifie que le stack technologique cible est :
1. **Conforme aux spécifications IGS-v1** -- toutes les couches sont protocol-agnostiques dans les specs, cette carte les instancie dans un stack concret.
2. **Contraint** -- aucune technologie supplémentaire autorisée sans ADR.
3. **Testable** -- chaque technologie a son outil de testing correspondant (Jest, Detox, Playwright).
4. **Déployable** -- compatible avec Expo EAS + Supabase/Railway.

**Statut : ACCEPTÉ** -- ce document débloque la Phase 1 Runtime Implementation du pipeline IGS-v1.

---

*FIN DU DOCUMENT ITS-V1 -- Implementation Target Specification*
