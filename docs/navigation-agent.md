# Navigation pour Agents — Lumina v2

> **DOC-ID:** DOC-AGENT-NAV  
> **Version:** 1.0  
> **Statut :** SPÉCIFICATION DE NAVIGATION  
> **Usage :** Guide l'agent IA (ou développeur) vers le bon document selon la tâche en cours

---

## Guide Ultra-Rapide

| Tu veux... | Lis D'ABORD |
|------------|-------------|
| Débuter sur le projet | [Environment Guide](08-development-setup/Environment-Guide.md) + [INDEX général](INDEX.md) |
| Comprendre l'architecture | [Architecture Map](00-architecture/Architecture-Map.md) → Puis [Invariants](99-supporting/invariants.md) + [NeverBreak](99-supporting/neverbreak.md) |
| Ajouter une feature | [Decision Trees](99-supporting/decision-trees.md) → Quel moteur impliquer ? |
| Créer un formulaire | [Forms Engine](01-platform-core/forms-engine/index.md) + [Glossary](99-supporting/glossary.md) |
| Gérer la finance | [Financial Rules](04-business-rules/financial-rules.md) → [INV-001](99-supporting/invariants.md) → [ADR-004](90-adrs/ADR-004-financial-immutability.md) |
| Configurer un type d'org | [Manifest Engine](01-platform-core/manifest-engine/index.md) → [Decision Trees Arbre #1](99-supporting/decision-trees.md) |
| Gérer le offline | [Offline First](02-offline-first/index.md) + [ADR-003](90-adrs/ADR-003-watermelondb-offline-first.md) |
| Faire du frontend RN | [Frontend Implementation Guide](07-frontend-guide/Frontend-Implementation-Guide.md) + [DESIGN.md](../DESIGN.md) + [DESIGN GUIDELINES](03-design-guidelines/DESIGN.md) |
| Faire du backend InsForge | [Backend Implementation Guide](08-backend-guide/Backend-Implementation-Guide.md) |
| Écrire des tests | [Testing Strategy](09-testing-strategy/Testing-Strategy.md) |
| Corriger un bug financier | [INV-001](99-supporting/invariants.md) → [ADR-004](90-adrs/ADR-004-financial-immutability.md) → [Financial Rules](04-business-rules/financial-rules.md) |
| Vérifier si tu ne violates rien | [NeverBreak Rules](99-supporting/neverbreak.md) |
| Comprendre un choix technique | Cherche l'ADR correspondant dans [90-adrs/](90-adrs/) |

---

## Routes Détaillées par Tâche

### Route 1: "Je débute sur le projet"

```
Lis → 08-development-setup/Environment-Guide.md   (prérequis, setup, commandes)
      ↓
      00-architecture/Architecture-Map.md           (vue globale système)
      ↓
      docs/INDEX.md                                  (table complète des docs)
      ↓
      99-supporting/glossary.md                      (termes techniques utilisés)
```

### Route 2: "Je veux comprendre l'architecture complète"

```
Lis → 00-architecture/Architecture-Map.md            (vue globale, 1 page)
      ↓
      01-platform-core/index.md                      (5 capacités du Platform)
      ↓
      99-supporting/invariants.md                    (règles absolues à respecter)
      ↓
      99-supporting/neverbreak.md                    (règles vérifiables automatiquement)
      ↓
      08-organization-graph/Organization-Graph-Spec.md (structure hiérarchique orgs)
      ↓
      07-database-schema/Database-Schema.md          (modèles WatermelonDB + PostgreSQL)
```

### Route 3: "Je dois implémenter une feature frontend"

```
Lis → 07-frontend-guide/Frontend-Implementation-Guide.md  (structure src/, contracts)
      ↓
      03-design-guidelines/DESIGN.md                        (composants UI, palette, typo)
      ou
      DESIGN.md (root)                                      (token spec format Google Labs)
      ↓
      design-system/INDEX.md                                (palette complète par org type)
      ↓
      design-system/SCREEN-ARCHITECTURE.md                  (routes écran par module)
      ↓
      design-system/SCENARIOS-UX.md                         (parcours utilisateur complets)
      ↓
      07-frontend-guide/Frontend-Implementation-Guide.md §6 (theme tokens section)
```

### Route 4: "Je dois implémenter une feature backend"

```
Lis → 08-backend-guide/Backend-Implementation-Guide.md  (migrations RLS functions storage)
      ↓
      07-database-schema/Database-Schema.md             (schéma tables + constraints)
      ↓
      04-business-rules/financial-rules.md              (règles métier finance)
      ↓
      05-api-contracts/api-contracts.md                 (endpoints + types TypeScript)
      ↓
      01-platform-core/workflow-engine/index.md         (moteur workflow si approval needed)
```

### Route 5: "Je dois créer/ajouter une organisation"

```
Lis → 01-platform-core/manifest-engine/index.md       (comment le manifest configure l'org)
      ↓
      03-configuration/mfejc-manifest-example.md      (exemple complet YAML)
      ↓
      01-platform-core/capability-engine/index.md     (quelles capabilities sont actives)
      ↓
      01-platform-core/vocabulary-engine/index.md     (terminologie org spécifique)
      ↓
      ADR-014 (Organization Graph DAG)                  (hiérarchie parent/enfant)
```

### Route 6: "Je dois gérer le offline/sync"

```
Lis → 02-offline-first/index.md                       (WatermelonDB, sync strategy, conflits)
      ↓
      01-platform-core/manifest-engine/index.md       (sync manifest config)
      ↓
      ADR-003 (WatermelonDB Offline-First)             (pourquoi ce choix)
```

### Route 7: "Je dois écrire des tests"

```
Lis → 09-testing-strategy/Testing-Strategy.md         (matrice coverage par module, CI pipeline)
      ↓
      99-supporting/invariants.md                     (quels invariant tester)
      ↓
      00-architecture/Definition-of-Done.md           (checklist terminaison)
```

### Route 8: "Je dois comprendre un ADR particulier"

Chaque décision architecturale est tracée dans [90-adrs/](90-adrs/). Pour trouver l'ADR pertinent :

| Sujet | ADR |
|-------|-----|
| Platform Capabilities (5 capacités) | ADR-001 |
| Réécriture vs Migration Flutter | ADR-002 |
| Offline / WatermelonDB | ADR-003 |
| Immuabilité financière | ADR-004 |
| Stack technique complète | ADR-005 |
| Multi-Tenant org_id | ADR-006 |
| MVP Scope (10 features) | ADR-007 |
| Documentation modulaire | ADR-008 |
| Auth admin-only MVP | ADR-009 |
| Priorité Finance K1 | ADR-010 |
| Design System Dark Canvas | ADR-011 |
| Navigation Expo Router | ADR-012 |
| State Management Context | ADR-013 |
| Organization Graph DAG | ADR-014 |
| API REST only | ADR-015 |

---

## Règles de Lecture Prioritaire

Quand tu es pressé (contexte court), lis dans cet ordre :

1. **`invariants.md`** — Les règles que TU NE PEUX PAS violer
2. **`neverbreak.md`** — Les règles vérifiées automatiquement
3. **`glossary.md`** — Les termes techniques utilisés partout
4. **Ton domaine spécifique** (voir Route ci-dessus)

---

## Vérification Avant Commit

Avant de commiter, vérifie ces documents rapidement :

- [ ] J'ai lu les Invariants pertinents pour ma feature ([invariants.md](99-supporting/invariants.md))
- [ ] Je n'ai violé aucune NeverBreak Rule ([neverbreak.md](99-supporting/neverbreak.md))
- [ ] J'ai utilisé les bons patterns du guide correspondant
- [ ] J'ai suivi les contrats API documentés si j'ai touché au backend
- [ ] J'ai respecté les specs de design si j'ai touché au frontend
- [ ] Mes tests couvrent les cas mentionnés dans [Testing Strategy](09-testing-strategy/Testing-Strategy.md)
