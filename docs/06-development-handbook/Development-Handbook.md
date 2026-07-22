# Development Handbook — Guide Opérationnel Multi-Agents

**Doc ID:** DOC-HANDBOOK  
**Version:** 2.0  
**Statut :** SPÉCIFICATION OPÉRATIONNELLE  
**Dépendances :** PRD_LUMINA_v2, INDEX.md

---

## 1. Objectif

Ce document donne les règles de travail pour que **plusieurs agents (ou humains)** puissent coder sur Lumina simultanément sans conflits, confusions ni divergences architecturales. Chaque section est lue AVANT de commencer une tâche.

---

## 2. Git Workflow

### 2.1 Branching Strategy

```
main              ← Toujours stable, prêt pour production
├── feature/finance-ledger       ← Nouveau module financier
├── feature/member-management    ← Module membres
├── fix/login-crash             ← Correction bug
└── refactor/schema-v2          ← Refonte schéma DB
```

Règles :
- Nom : `feature/<module>` ou `fix/<descriptif-court>`
- Jamais de travaux directs sur `main`
- Branche = isolation totale d'une responsabilité unique

### 2.2 Commit Convention

Format : `[TYPE] [MODULE] message court (≤50 car.)`

Types : `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Exemples :
```
[feat] [finance] add transaction creation form
[fix] [auth] prevent null pointer on empty profile
[test] [sync] add watermelondb conflict tests
```

Chaque commit doit être fonctionnel. Pas de "WIP" ou "save".

### 2.3 Merge Policy

PR requires: ✅ lint pass, ✅ tests pass, ✅ docs updated. No manual overrides.

---

## 3. Module Boundaries — Qui Fait Quoi

Lumina est découpé en modules indépendants chakun ayant un dossier racine dédié. Chakun peut être travaillé par un agent différent SANS risque de conflit si les interfaces sont respectées.

### 3.1 Modules et Leur Responsabilité

| Module | Dossier | Travail possible | Bloqué par | Peut bloquer |
|---|---|---|---|---|
| **Auth** | `src/core/auth/` | Login, logout, OAuth, session | DB schema users | Finance, Members, tout |
| **Sync Engine** | `src/core/sync/` | WatermelonDB, conflicts, queue | Auth (user context) | Tous modules |
| **Network** | `src/core/network/` | InsForge SDK wrapper, retry | Auth token | Tous modules |
| **Storage** | `src/core/storage/` | Local files, cache, images | Storage bucket config | Sync Engine |
| **Finance** | `src/features/finance/` | Ledger, bilan, reports | Category definitions | Sync Engine |
| **Members** | `src/features/members/` | CRUD, search, family tree | Org structure | Sync Engine |
| **Groups** | `src/features/groups/` | Dynamic groups, features | Org + Members data | Sync Engine |
| **Events** | `src/features/events/` | Calendar, reminders, RSVP | Groups membership | Sync Engine |
| **Celeb** | `src/features/celebrations/` | Services, sacrament tracking | Events module | Sync Engine |
| **Dashboard** | `src/features/dashboard/` | Charts, KPIs, analytics | Any read-only data | Aucune |
| **Social** | `src/features/social/` | Feed, posts, comments | Auth + Members | Sync Engine |
| **Settings** | `src/features/settings/` | App config, preferences | Auth | Aucune |

### 3.2 Règles de Parallélisme

**PEUVENT TRAVAILLER EN PARALLÈLE** (aucun fichier en commun) :
- Auth ↔ Finance
- Members ↔ Groups
- Events ↔ Celebrations
- Dashboard ↔ Settings

**NE PEUVENT PAS** (partagent des fichiers communs) :
- Aucun module ne touche à `src/core/network/` ou `src/core/sync/` en écriture
- Les données communes (`org_id`, user context) passent par le Store seul
- Uniquement un module modifie les models WatermelonDB par table

### 3.3 Files Partagées Protégées

Ces fichiers sont LUS par tous mais ÉCRITS UNIQUEMENT par :

| Fichier | Propriétaire | Lecture par |
|---|---|---|
| `src/models/*.ts` | Sync Engine | Tous |
| `src/store/AppContext.tsx` | Architecture lead | Tous |
| `src/config/*.ts` | Architecture lead | Tous |
| `src/navigation/` | Navigation module | Tous |
| `src/shared/components/` | Shared components | Tous |

---

## 4. Code Conventions

### 4.1 TypeScript Strict (NB-RULE-07)

Jamais de `any`. Jamais de `@ts-ignore` sauf commenté "WHY: ...".

Types doivent être déclarés explicitement. Interfaces > type aliases pour les objets métier.

### 4.2 Naming Conventions

Fichiers : `camelCase.ts`
Composants : `PascalCase.tsx`
Hooks : `useCamelCase.ts`
Constants : `UPPER_SNAKE_CASE.ts`
Models : `PascalCase.ts` (camelCase pour variable)

### 4.3 Structure Component

Chaque feature X a cette structure fixe :
```
src/features/X/
├── XProvider.tsx           # State management
├── XCard.tsx               # Main display component
├── XForm.tsx               # Create/edit forms
├── XList.tsx               # List/scan view
├── XService.ts             # Data fetching
├── XValidator.ts           # Validation logic
└── X.test.tsx              # Unit tests
```

### 4.4 Service Pattern

Services sont purs et synchrones quand c'est possible. Async uniquement pour I/O réseau ou DB.

```typescript
class TransactionService {
  async create(data: TransactionCreateDto): Promise<Transaction> {
    // Validate → Transform → Save to WatermelonDB → Sync
  }
}
```

---

## 5. Testing Protocol

### 5.1 Test Levels (toujours dans cet ordre)

1. **Unit tests** — logique pure, services, validators. Cible >90% finance, >70% autres.
2. **Component tests** — rendu React, props, states. Chaque composant public testé.
3. **Integration tests** — flow complet (form → service → DB). Un par flow critique.
4. **E2E flows** — parcours utilisateur complet. Documentés dans `tests/flows/`.

### 5.2 Regles Spécifiques

- Finance: chaque invariant (INV-001 à INV-010) a au moins 2 tests unitaires
- Offline: toujours tester le cas "offline then online" (pas de réseau puis connexion)
- RLS: toujours simuler org_id différent pour vérifier isolation
- Sync: toujours tester conflict resolution paths (create/update/delete)

---

## 6. Documentation Synchronization (NB-RULE-01)

Quand vous codez UNE nouvelle fonctionnalité:
1. Lire la doc correspondante (INDEX.md)
2. Vérifier si la doc est à jour → modifier si nécessaire
3. La doc changeante = le code changeant

Si aucune doc n'existe pour votre module, créez-en une AVANT de coder. Max 400 lignes. Si ça dépasse → index + sous-docs.

---

## 7. Environment Setup

Voir doc séparée: `08-development-setup/Environment-Guide.md`

---

## 8. Emergency Procedures

**Bug critiques en prod :**
1. Créer branche `hotfix/<bug-id>`
2. Corriger + tests + doc
3. Merge direct vers main
4. Hotfix tag = `v<X>.<Y>.<Z-hotfix-N>`

**Conflict de module:**
1. Arrêter travail sur fichiers partagés
2. Notifier l'autre agent (commentaire PR)
3. Résoudre en lisant les contracts définis
4. Documenter la résolution dans ADR additionnel

---

## 9. File Ownership Map

Chaque fichier existe et appartient à un module. L'agent peut le MODIFIER mais jamais le DÉPLACER ou le SUPPRIMER sans accord du propriétaire du module.

Cette map est auto-générée et mise à jour par CI/CD.
