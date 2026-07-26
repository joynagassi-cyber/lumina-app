# IGS-v1 — Generator Catalog

**Doc ID:** IGS-v1-GEN (HORS SÉRIE CANONIQUE)  
**Version:** 1.0  
**Statut:** CATALOGUE FIGÉ DES GÉNÉRATEURS  
**Date:** 2026-07-24  
**Référence :** Applique IGS-v1 et DOC-000 à DOC-024

---

## PRÉAMBULE

Ce document est un complément à `IMPLEMENTATION-GENERATION-SPECIFICATION.md`. Il fournit la vue d'ensemble de tous les générateurs officiels, leurs relations, et leur position dans le pipeline de génération.

Chaque générateur est une transformation déterministe. Même entrée → même sortie.

---

## TABLEAU RÉCAPITULATIF DES GÉNÉRATEURS

| # | Nom | Entrée | Sortie | Dépendances | Étape IGS |
|---|-----|--------|--------|-------------|-----------|
| 1 | `schema-generator` | DOC-021 + DOC-023 | Schéma relationnel | Aucune | 1 |
| 2 | `migration-generator` | Schéma SQL | Scripts de migration | 1 | 2 |
| 3 | `constraint-index-generator` | Migrations + DOC-023 | Index & contraintes | 2 | 3 |
| 4 | `rls-generator` | Schéma + `_org_id` | Politiques RLS | 3 | 4 |
| 5 | `api-contract-generator` | DOC-014 + DOC-013 | Contrats API | Aucune | 5 |
| 6 | `service-generator` | API Contracts + DOC-012 + DOC-015 | Services applicatifs | 5 | 6 |
| 7 | `deployment-config-generator` | DOC-001 + DOC-008 | Configuration déploiement | Aucune | 7 |
| 8 | `ui-generator` | DOC-012 FormAggregate + DOC-019 Vocabulary | UI React Native | 6 | 8 |
| 9 | `test-generator` | DOC-015 + DOC-012 + DOC-014 | Tests unitaires | 6 | 9 |
| 10 | `consistency-checker` | Toutes étapes précédentes | Rapport de cohérence | 1-9 | 10 |

---

## DÉTAIL PAR GÉNÉRATEUR

### 1. Schema Generator

```
Input:  DOC-021 (Physical Objects, 30 objets) + DOC-023 (Relational Rules, 27 rules)
Output: Schéma relationnel technique
Validation: V-STRUCT → V-COHERE → V-TRACE → V-NB → V-REGRESS → V-INVENT
Check: Chaque Physical Object → table; chaque relation → FK; chaque cardinalité respectée
```

**Dépendances directes :** DOC-021 §X.Y, DOC-023 §2-9.
**Résultat attendu :** 30 tables relationnelles.
**Réserves ARA traitées :** G-001 (convention nommage tables).

### 2. Migration Generator

```
Input:  Schéma SQL (étape 1)
Output: Scripts de migration ordonnés (YYYYMMDD-HHMMSS-NNN_desc.sql)
Validation: Topological sort des tables basé sur FK
Check: Tables parentes avant tables enfants
```

**Dépendances directes :** Schéma de l'étape 1.
**Résultat attendu :** 30+ scripts de migration (1 par table + jointures).
**Réserves ARA traitées :** Aucune.

### 3. Constraint & Index Generator

```
Input:  Migrations (étape 2) + DOC-023 (Relational Rules)
Output: Scripts d'index et de contraintes supplémentaires
Validation: 58 invariants DOC-015 → au moins 1 contrainte physique chacun
Check: NB-PERSIST-006 (audit log exclusive immutable), NB-RR-008 (tenant isolation)
```

**Dépendances directes :** Étape 2, DOC-023 §2-9.
**Résultat attendu :** Index strategy (10-15 index), check constraints (58+), unique constraints (10+).
**Réserves ARA traitées :** Aucune.

### 4. RLS Policy Generator

```
Input:  Schéma (étape 3) + _org_id présent sur tous les objets physiques (DOC-021)
Output: Politiques RLS per-table
Validation: Chaque politique WHERE clause contient org_id = current_org_id()
Check: Pas de cross-org access, pas de bypass de tenant isolation
```

**Dépendances directes :** Étape 3 complet.
**Résultat attendu :** ~40 politiques RLS (selon nombre de tables).
**Réserves ARA traitées :** G-004 (matrice table×rôle inférée depuis IdentityAggregate roles).

### 5. API Contract Generator

```
Input:  DOC-014 (70 Commands + 60 Events) + DOC-013 (Boundary Specs)
Output: Endpoints API + types de requête/réponse
Validation: Chaque endpoint ≥ 1 Command DOC-014, ≤ 1 boundary "Expose" DOC-013
Check: Pas d'endpoint sans Command correspondant, pas de Command sans endpoint
```

**Dépendances directes :** DOC-014, DOC-013 (indépendant des étapes 1-4).
**Résultat attendu :** ~70 endpoints REST.
**Réserves ARA traitées :** Aucune.

### 6. Service Generator

```
Input:  API Contracts (étape 5) + DOC-012 (Domain Model) + DOC-015 (Invariants)
Output: Implémentation des services applicatifs
Validation: Pour chaque guard dans service → invariant DOC-015 documenté
Check: 58 invariants couverts par au moins un guard
```

**Dépendances directes :** Étape 5, DOC-012, DOC-015.
**Résultat attendu :** 70 méthodes de service (une par Command).
**Réserves ARA traitées :** G-005 (tests E2E non couverts → services testés unitairement uniquement).

### 7. Deployment Config Generator

```
Input:  DOC-001 (Runtime Services catalog) + DOC-008 (Decision Constitution)
Output: Dockerfiles, docker-compose.yml, CI/CD pipelines
Validation: Chaque container listé dans DOC-001 Runtime Services
Check: Pas de dépendances non-cataloguées
```

**Dépendances directes :** DOC-001, DOC-008.
**Résultat attendu :** docker-compose.yml, Dockerfile insforge, .github/workflows/ci.yml.
**Réserves ARA traitées :** Aucune.

### 8. UI Generator

```
Input:  DOC-012 FormAggregate (définitions) + DOC-019 Vocabulary (terms)
Output: Composants React Native dynamiques
Validation: Aucun JSX dur, tous les selects from Vocabulary, client validation = server validation
Check: BR-FRM-001 à BR-FRM-004 respectées
```

**Dépendances directes :** Étape 6 (consomme les APIs générées).
**Résultat attendu :** Écrans React Native dynamiques basés sur Forms + Vocabulary.
**Réserves ARA traitées :** ARA-v1 §4.6 (UI PARTIEL — nécessite Design Guidelines externes pour design précis).

### 9. Test Generator

```
Input:  DOC-015 (58 Invariants) + DOC-012 (70+ Business Rules) + DOC-014 (Commands/Events)
Output: Tests unitaires + tests d'intégration
Validation: Chaque invariant CRITIQUE DOC-015 ≥ 1 test unitaire "violé" + "respekté"
Check: 38 invariants critiques couverts
```

**Dépendances directes :** Étape 6 (services implémentés).
**Résultat attendu :** 58+ tests unitaires (2 par invariant = 116 tests minimum).
**Réserves ARA traitées :** G-005 (pas de scénarios E2E complets → unit tests only).

### 10. Consistency Checker

```
Input:  Toutes étapes précédentes (1-9)
Output: Rapport de cohérence finale
Validation: V-STRUCT, V-COHERE, V-TRACE, V-NB, V-REGRESS, V-INVENT sur l'ensemble
Check: zéro violation NeverBreak, zéro invention, traçabilité 100% complète
```

**Dépendances directes :** Toutes les étapes précédentes.
**Résultat attendu :** Rapport GO / GO avec réserves / NO-GO.
**Réserves ARA traitées :** Réserves ARA-générées → si bloquantes, bloque le checker.

---

## GRAPHIQUE DE DÉPENDANCES ENTRE GÉNÉRATEURS

```
                    ┌─────────────────────┐
                    │    DOC-000 à DOC-024 │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼───────┐    ┌────────▼────────┐    ┌────────▼────────┐
│ schema-gen    │    │ api-contract-gen│    │ deploy-config   │
│ (étape 1)     │    │ (étape 5)       │    │ (étape 7)       │
└───────┬───────┘    └─────────────────┘    └─────────────────┘
        │                                      (autonome)
        ▼
┌───────────────┐
│ migration-gen │  (étape 2)
└───────┬───────┘
        ▼
┌──────────────────┐
│ constraint-gen   │  (étape 3)
└───────┬──────────┘
        ▼
┌───────────────┐
│ rls-gen       │  (étape 4)
└───────┬───────┘
        │
        ▼
┌───────────────────┐     ┌───────────────┐
│ service-gen       │◄────│ api-contract  │
│ (étape 6)         │     │ (étape 5)     │
└───────┬───────────┘     └───────────────┘
        │
        ├──► ui-gen (étape 8)
        ├──► test-gen (étape 9)
        └──► consistency-checker (étape 10)
              ▲
              └── toutes étapes
```

**Règle de parallélisme :** Seuls les générateurs sans dépendance entre eux peuvent s'exécuter en parallèle :
- `schema-generator`, `api-contract-generator`, `deployment-config-generator` : EXÉCUTION EN PARALLÈLE possible (étapes 1, 5, 7)
- Tous les autres : SÉQUENCELLE stricte selon l'ordre des étapes.

---

## CRITÈRES D'ÉCHEC UNIFORMES

Pour TOUS les générateurs :

| Critère | Description |
|---------|-------------|
| **Entrée invalide** | Un document source est manquant, corrompu, ou non canonique |
| **Dépendance manquante** | L'étape précédente n'est pas complète |
| **Violation jamaisbreak** | L'artefact généré contredit une règle NeverBreak de DOC-017 ou DOC-023 |
| **Invention détectée** | L'artefact contient un concept/capability/aggregate non catalogue dans DOC-001 |
| **Ambiguïté non résolue** | Deux documents canoniques se contredisent |
| **Étape sautée** | Une étape du pipeline est manquante |
| **Orphelin détecté** | Un élément de l'artefact n'est pas tracé vers un document canonique |

En cas d'échec : STOP immédiat. Pas de correction automatique. Signalisation avec numéro de critère.

---

*Ce document ne fait pas partie de la série DOC-000 à DOC-024. C'est un complément de spécification technique qui dépend entièrement de l'architecture canonique.*
