# Generator Dependency Matrix — Lumina IGS-v1

**Doc ID:** GDM-V1 (CERTIFICATION)  
**Version:** 1.0  
**Statut:** MATRICE COMPLÈTE DE DÉPENDANCES ENTRE GÉNÉRATEURS  
**Date:** 2026-07-25  
**Source canonique :** IMPLEMENTATION-GENERATION-SPECIFICATION.md §3, DOC-000 à DOC-024  
**Application:** Référence unique pour les dépendances entre tous les générateurs IGS-v1

---

## MATRICE COMPLÈTE DES 9 GÉNÉRATEURS

| # | Générateur | Entrées | Sorties | Dépend de | Est utilisé par | Cycle ? | Dépendance cachée ? |
|---|-----------|---------|---------|-----------|----------------|---------|-------------------|
| 1 | schema-generator | DOC-021 (Physical Objects), DOC-023 (Relational Rules) | PostgreSQL Schema Pack (32 tables), SQL DDL Spec | Rien (premier générateur) | migration-generator, constraint-index-generator, rls-generator | Non | Non |
| 2 | migration-generator | PostgreSQL Schema Pack (Étape 1), DOC-022 (PO Mapping Rules) | Migration Pack (MIG-001 à MIG-035, 35 migrations) | schema-generator (Étape 1 complète) | constraint-index-generator | Non | Non |
| 3 | constraint-index-generator | Migration Pack (Étape 2), DOC-023 (Relational Rules §2-9), DOC-015 (Invariants) | Constraints & Index Specification (38 CHECK + 10 UNIQUE + ~54 FK) | migration-generator (Étape 2 complète) | Aucun (output est doc spec autonome) | Non | Non |
| 4 | rls-generator | PostgreSQL Schema Pack (Étape 3/1), DOC-023 §8 (Multi-tenant isolation), IdentityAggregate roles (DOC-012) | RLS Policy Specification (32 tables × 9 rôles = 541+ politiques), Bootstrap Migration Spec (4 scripts) | schema-generator (Étape 1). Rôle du schema (pas des migrations) | verification-report-generator, deployment-config | Non | Non |
| 5 | api-contract-generator | DOC-014 (Commands + Events, 70 Commands, 60 Events), DOC-013 (Boundary specs) | API Contracts (endpoints, request/response types, error codes) | Aucun (dépend uniquement de documents canoniques) | service-generator, ui-generator, test-generator | Non | Non |
| 6 | service-generator | API Contracts (Étape 5), DOC-012 (Domain Model, 13 Aggregates), DOC-015 (58 Invariants) | Implémentation Services Applicatifs (methods, guards, domain events, audit logging) | api-contract-generator (Étape 5 complète) | ui-generator (consomme les APIs), test-generator (test les services) | Non | Non |
| 7 | deployment-config-generator | DOC-001 (Runtime Services catalogued), DOC-008 (Decision Constitution), ARA-v1 (Verdict GO) | Dockerfiles, docker-compose.yml, CI/CD pipelines, deployment targets | Aucun (configuration autonome) | Aucun (infrastructure externe au pipeline) | Non | Non |
| 8 | ui-generator | DOC-012 §FormAggregate (FormDefinition, FormField), DOC-019 §Vocabulary (Strategy §2.8), API Contracts (Étape 5) | Composants React Native dynamiques, FormRenderer, VocabularyConsumer | service-generator (consomme les APIs via api-contract-generator) | Aucun (output est code application) | Non | Non |
| 9 | test-generator | DOC-015 (58 Invariants: 38 Critiques, 15 Majeurs, 5 Mineurs), DOC-012 (70+ Business Rules), DOC-014 (Commands + Events) | Tests unitaires (invariant violations + respectés), Tests d'intégration (guard functions) | service-generator (les tests testent l'implémentation des services) | Aucun (output est code test) | Non | Non |

---

## ANALYSE DÉTAILLÉE PAR GÉNÉRATEUR

### 1. schema-generator (§3.1 IGS-v1)

```
+--------------------------------------------------+
|               schema-generator                   |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - DOC-021 (Physical Data Model)               |
|   - DOC-023 (Canonical Relational Rules)        |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - POSTGRESQL-SCHEMA-PACK-v1.md (32 tables)    |
|   - SQL-DDL-SPECIFICATION-v1.md (DDL complet)   |
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - Aucune (générateur racine du pipeline)      |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - DOC-021 doit contenir tous les Physical     |
|     Objects (30 PO pour 13 Aggregates)          |
|   - DOC-023 doit contenir toutes les règles    |
|     relationnelles (27 NeverBreak rules)        |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS lire un document hors DOC-021     |
|     et DOC-023                                  |
|   - Ne JAMAIS inventer de type de donnée non    |
|     catalogué                                   |
|   - Ne JAMAIS créer une table sans Physical     |
|     Object correspondant dans DOC-021           |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - Si DOC-021 est incomplet → tables manquantes|
|   - Si DOC-023 change → contraintes différentes |
|   - gen_random_uuid() → non-deterministe au     |
|     runtime mais deterministe dans le fichier   |
|     spec (la definition SQL est identique)      |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - sorties utilisées par: migration-generator,  |
|     constraint-index-generator, rls-generator    |
|   - aucun chevauchement de sortie avec d'autres |
+--------------------------------------------------+
```

### 2. migration-generator (§3.2 IGS-v1)

```
+--------------------------------------------------+
|             migration-generator                  |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - PostgreSQL Schema Pack (sortie Étape 1)     |
|   - DOC-022 (PO → Physical Mapping Rules)       |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - MIGRATION-PACK-V1.md (35 migrations)        |
|     MIG-001 à MIG-035                            |
|   - Chaque migration : CREATE TABLE + ROLLBACK  |
|   - Topological sort par FK dependencies         |
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - schema-generator (Étape 1 complète)         |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - Schema Pack doit contenir exactement 32     |
|     tables                                      |
|   - DOC-022 mapping rules doivent être complètes|
|   - IF NOT EXISTS sur chaque CREATE TABLE       |
|   - Rollback section sur chaque migration       |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS modifier un CREATE TABLE d'une    |
|     migration précédente                        |
|   - Ne JAMAIS créer une table avant ses FK      |
|   - Ne JAMAIS utiliser ALTER TABLE sur une     |
|     table créee dans une migration antérieure   |
|   - Ne JAMAIS sauter de numéro de migration     |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - Mig-027 : ALTER TABLE SET DEFAULT placé     |
|     AVANT CREATE TABLE (OBS-1)                 |
|   - Mig-001 : chk_statut_archived_irreversible  |
|     LAG() OVER invalide PostgreSQL (OBS-2)     |
|   - Nombre de colonnes standardisées DOC-017     |
|     peut varier entre générations               |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - sorties utilisées par: constraint-index-    |
|     generator                                   |
|   - 35 migrations créent 32 tables uniques,     |
|     0 doublon                                   |
+--------------------------------------------------+
```

### 3. constraint-index-generator (§3.3 IGS-v1)

```
+--------------------------------------------------+
|         constraint-index-generator               |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - Migration Pack (sortie Étape 2)             |
|   - DOC-023 (Canonical Relational Rules §2-9)   |
|   - DOC-015 (Invariant Registry)                |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - CONSTRAINTS-INDEX-SPECIFICATION-v1.md        |
|   - 38 CHECK constraints                        |
|   - 10 UNIQUE constraints                       |
|   - ~54 Foreign Key references                  |
|   - ~50+ performance indexes                    |
|   - 4 GIN indexes for JSONB columns             |
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - migration-generator (Étape 2 complète)      |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - Toutes les 32 tables existantes             |
|   - DOC-015 contains all 58 invariants          |
|   - DOC-023 contains relational rules           |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS créer un index qui traverse       |
|     plusieurs Aggregats                         |
|   - Ne JAMAIS violer NB-RR-008 (exclusive       |
|     immutable log for AuditAggregate only)      |
|   - Ne JAMAIS inventer une contrainte sans      |
|     trace vers DOC-015 ou DOC-023              |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - 4 invariants non enforceables physiquement  |
|     (REL-001 DAG cycle detection, WF-005 no     |
|     financial modification by workflow, AUD-004 |
|     access restriction, SYNC-002 batch size)     |
|   - Ces invariants nécessitent enforcement      |
|     application-level                           |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - sortie est document spec, pas utilisée      |
|     directement par d'autres générateurs        |
|   - référence consultative par rls-generator    |
+--------------------------------------------------+
```

### 4. rls-generator (§3.4 IGS-v1)

```
+--------------------------------------------------+
|                   rls-generator                  |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - Schema Pack (Étape 3 / Étape 1 directe)     |
|   - _org_id present sur tous les POs (DOC-021)  |
|   - DOC-023 §8 (Multi-tenant physical isolation)|
|   - IdentityAggregate roles (DOC-012)           |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - RLS-POLICY-SPECIFICATION-V1.md               |
|   - 32 tables couvertes                         |
|   - 9 rôles definitifs                          |
|   - 541+ politiques RLS (32 × ~8 roles actifs)  |
|   - Naming convention: pol_{table}_{role_short} |
|     _{action}                                   |
|   - Pattern USING: org_id = current_setting()   |
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - schema-generator (direct via Schema Pack)   |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - 32 tables doivent exister                   |
|   - Chaque table doit avoir org_id (direct ou   |
|     hérité via parent FK)                       |
|   - 9 rôles RBAC doivent être définis           |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS permettre un accès cross-org      |
|   - Ne JAMAIS utiliser un champ autre que      |
|     _org_id pour filtrer une politique RLS     |
|   - Ne JAMAIS créer une politique SQL pour     |
|     superadmin (bypass via application layer)   |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - 10 tables héritent l'isolement tenant via   |
|     parent FK (pas de colonne org_id directe)   |
|   - Superadmin bypass nécessite application     |
|     code spécifique (SET lumina.bypass_rls)    |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - sorties utilisées par: bootstrap            |
|     migration, verification-report-generator    |
|   - overlap avec migration-generator:           |
|     MIG-027 force RLS sur audit_entries          |
+--------------------------------------------------+
```

### 5. api-contract-generator (§3.5 IGS-v1)

```
+--------------------------------------------------+
|           api-contract-generator                 |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - DOC-014 (Commands + Events registry)        |
|   - DOC-013 (Boundary specs per Aggregate)      |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - API endpoints (REST format)                 |
|   - Request/Response types                      |
|   - Error codes (400, 401, 403, 409, 422)       |
|   - Header requirements (x-org-id, Authorization)|
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - Aucune (dépend de documents canoniques      |
|     directs, pas d'étapes précédentes)          |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - DOC-014: 70 Commands catalogués             |
|   - DOC-013: 13 Boundary specs (Expose/Interdit)|
|   - Chaque endpoint correspond EXACTEMENT à     |
|     un "Expose:" d'un Aggregate boundary        |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS créer un endpoint qui ne          |
|     correspond à aucune Command DOC-014        |
|   - Ne JAMAIS exposer un "Interdit" de DOC-013  |
|   - Ne JAMAIS définir de logique métier         |
|     dans les contrats (contrat uniquement)     |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - Mapping HTTP method → Command type        |
|     doit être cohérent (POST→Create, PUT→Update |
|     etc.)                                       |
|   - Response format { data, version,            |
|     sync_status } doit être uniforme            |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - sorties utilisées par: service-generator,   |
|     ui-generator, test-generator                |
|   - overlap avec: deployment-config-generator   |
|     (headers communs: x-org-id)                 |
+--------------------------------------------------+
```

### 6. service-generator (§3.6 IGS-v1)

```
+--------------------------------------------------+
|              service-generator                   |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - API Contracts (sortie Étape 5)              |
|   - DOC-012 (Domain Model, 13 Aggregates)       |
|   - DOC-015 (Invariants, 58 entries)            |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - Implémentation des services applicatifs     |
|   - Méthodes de service par Command DOC-014     |
|   - Guards d'invariants avant chaque write      |
|   - Domain Events émis après chaque state change|
|   - Audit logging systématique                  |
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - api-contract-generator (Étape 5 complète)   |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - Tous les 58 invariants de DOC-015          |
|     doivent pouvoir être implémentés            |
|   - DOC-014 Commands doivent mapper aux         |
|     méthodes de service                         |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS violer un invariant DOC-015       |
|   - Ne JAMAIS appliquer une règle métier        |
|     absente de DOC-012                          |
|   - Ne JAMAIS contourner les guards d'invariant |
|   - Ne JAMAIS inventer un nouveau concept       |
|     ou domaine métier                           |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - G-005 ARA : pas de scénarios E2E            |
|     complets → services testés individuellement |
|   - 58 invariants à implémenter = ~58 guards    |
|   - Optimistic locking sur chaque write         |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - sortie utilisée par: ui-generator,          |
|     test-generator                              |
|   - overlap avec: audit-log dans audit          |
|     aggregate (tous les services appellent      |
|     AuditAggregate.LogAction())                 |
+--------------------------------------------------+
```

### 7. deployment-config-generator (§3.7 IGS-v1)

```
+--------------------------------------------------+
|          deployment-config-generator             |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - DOC-001 (Runtime Services, 8 services)      |
|   - DOC-008 (Decision Constitution)             |
|   - ARA-v1 (Verdict GO avec réserves)          |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - Dockerfiles                                 |
|   - docker-compose.yml                          |
|   - CI/CD pipelines                             |
|   - Deployment targets configuration            |
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - Aucune (configuration autonome)            |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - DOC-001 Runtime Services list              |
|   - Chaque container doit être listé comme      |
|     Runtime Service dans DOC-001                |
|   - DOC-008 Step 8 (API exists)                 |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS introduire de dépendances non     |
|     cataloguées dans DOC-001                    |
|   - Ne JAMAIS changer l'architecture            |
|   - Ne JAMAIS ajouter un service non listé     |
|     dans Runtime Services                       |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - Les réserves ARA concernent                 |
|     l'infrastructure de déploiement             |
|   - Environment variables diffèrent entre       |
|     staging vs prod                           |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - aucun chevauchement significatif            |
|   - configuration externe au pipeline core      |
+--------------------------------------------------+
```

### 8. ui-generator (§3.8 IGS-v1)

```
+--------------------------------------------------+
|                   ui-generator                   |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - DOC-012 FormAggregate (FormDefinition,      |
|     FormField)                                  |
|   - DOC-019 Vocabulary (Strategy §2.8)          |
|   - API Contracts (Étape 5) — l'UI consomme    |
|     les APIs                                    |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - Composants React Native dynamiques          |
|   - FormRenderer (JSON → UI components)         |
|   - VocabularyConsumer (select options from     |
|     Vocabulary)                                 |
|   - Labels FR/EN résolus depuis TranslationPair |
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - service-generator (Étape 6 — l'UI          |
|     consomme les APIs)                          |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - DOC-012 FormDefinitions existantes          |
|   - DOC-019 Vocabulary terms + translations     |
|   - API Contracts defines endpoints consumed    |
|     by the UI                                   |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS définir un formulaire en JSX      |
|     dur (BR-FRM-001 violation)                  |
|   - Ne JAMAIS référencer un vocabulaire         |
|     inexistant (BR-VOC-004 violation)           |
|   - Ne JAMAIS inventer des champs non définis   |
|     dans une FormDefinition                     |
|   - Ne JAMAIS connaître la structure SQL        |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - ARA-v1 §4.6: UI PARTIEL — nécessite         |
|     Design Guidelines externes                  |
|   - Formulaires sensibles verrouillés après     |
|     soumission (sensitive form lock policy)     |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - sortie finale du pipeline, ne sert aucun    |
|     autre générateur                            |
|   - overlap avec: test-generator (même          |
|     FormAggregate input)                        |
+--------------------------------------------------+
```

### 9. test-generator (§3.9 IGS-v1)

```
+--------------------------------------------------+
|                 test-generator                   |
+--------------------------------------------------+
| Entrées autorisées EXACTES :                     |
|   - DOC-015 (58 Invariants)                     |
|   - DOC-012 (70+ Business Rules)                |
|   - DOC-014 (Commands + Events)                 |
+--------------------------------------------------+
| Sorties attendues EXACTES :                      |
|   - Tests unitaires (pour chaque invariant      |
|     CRITIQUE: test violé + test respecté)       |
|   - Tests d'intégration (pour chaque invariant  |
|     MAJEUR: guard function coverage)            |
|   - Tests smoke (pour chaque invariant          |
|     MINEUR: non-regression)                     |
|   - Pas de E2E test generation                 |
+--------------------------------------------------+
| Dépendances explicites :                         |
|   - service-generator (Étape 6 — tests          |
|     implémentation des services)                |
+--------------------------------------------------+
| Prérequis fonctionnels :                         |
|   - 58 invariants catalogués                    |
|   - Classification par sévérité (C/M/Mi)       |
|   - 70+ Business Rules pour tests d'intégration |
+--------------------------------------------------+
| Interdictions explicites :                       |
|   - Ne JAMAIS générer de E2E tests              |
|     (réservé aux spécifications manuelles)      |
|   - Ne JAMAIS modifier le comportement métier   |
|     via les tests                               |
|   - Tout invariant CRITIQUE doit avoir au moins |
|     1 test unitaire                             |
+--------------------------------------------------+
| Risques identifiés :                             |
|   - G-005 ARA: pas de scénarios E2E             |
|     complets → uniquement tests unitaires        |
|   - 58 invariants × 2 scenarios (violé/respecté |
|     = ~116 tests minimum pour invariants        |
|     critiques seulement                         |
+--------------------------------------------------+
| Chevauchements avec d'autres générateurs :       |
|   - sortie finale du pipeline, ne sert aucun    |
|     autre générateur                            |
|   - overlap avec: schema verification           |
|     report (même objectif: conformité)          |
+--------------------------------------------------+
```

---

## MATRICE DE CHEVAUCHEMENT

| Générateur 1 | Générateur 2 | Zone de Chevauchement | Solution |
|-------------|-------------|---------------------|----------|
| migration-generator | constraint-index-generator | Migrations créent tables, contraintes ajoutent FK/CHECK | Successif: migrations d'abord, contraintes ensuite |
| migration-generator | rls-generator | MIG-027 force RLS sur audit_entries | RLS spec documente cela explicitement; migration fait CREATE TABLE, RLS fait policies |
| api-contract-generator | service-generator | Contrats définissent endpoints, services implémentent | Successif: contracts d'abord, services implémentent les contrats |
| service-generator | ui-generator | Services exposent APIs, UI consomme APIs | Successif: services exposent, UI consomme. L'UI ne connaît PAS le schéma DB. |
| service-generator | test-generator | Services implémentent, tests vérifient | Tests dépendent de l'implémentation des services pour覆盖率 |
| ui-generator | test-generator | Deuxième utilisent DOC-012 FormAggregate | Inputs partagés, sorties indépendantes (UI → composants, tests → couverture) |

---

## RÉSUMÉ STATISTIQUE

| Metric | Value |
|--------|-------|
| Total générateurs | 9 |
| Générateurs sans dépendance (racines) | 4 (schema, api-contract, deployment-config) |
| Générateurs en cascade (dépendent d'étape N-1) | 5 (migration, constraint-index, rls, service, ui, test) |
| Cycles détectés | 0 |
| Dépendances cachées détectées | 0 |
| Exécutions hors séquence détectées | 0 |
| Générateurs avec chevauchement d'input | 1 paire (ui + test via DOC-012) |
| Générateurs avec chevauchement de output | 0 |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | Agnes-2.0-Flash (Sapiens AI) | Création — Matrice complète de dépendances pour les 9 générateurs IGS-v1 | CERTIFIED |

---

*Ce document est un artefact de certification. Il ne fait pas partie de la série DOC-000 à DOC-024.*
