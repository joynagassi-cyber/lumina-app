# IGS-v1 — Implementation Generation Specification

**Doc ID:** IGS-v1 (HORS SÉRIE CANONIQUE)  
**Version:** 1.0  
**Statut:** SPÉCIFICATION DE GÉNÉRATION FIGÉE  
**Date:** 2026-07-24  
**Référence :** Applique strictement DOC-000 à DOC-024 et ARA-v1  
**Application :** Spécifie comment générer les artefacts techniques de Lumina sans casser l'architecture canonique

---

## PRINCIPE FONDAMENTAL

Ce document ne définit PAS l'implémentation. Il définit le **pipeline de génération** qui produit les artefacts techniques à partir de l'architecture canonique figée.

**Règle absolue :** Même entrée canonique = même sortie technique. Toute génération différente pour la même entrée est une violation bloquante.

Ce document s'applique à tout agent IA ou toute équipe technique produisant des artefacts d'implémentation pour Lumina v2.

---

## 1. PÉCIMETRE DU PIPELINE DE GÉNÉRATION

Le pipeline de génération transforme les 24 documents canoniques DOC-000 à DOC-024 en artefacts d'implémentation.

**Ce que le pipeline FAIT :** Générer du code, des schémas, des migrations, des contrats, des configurations, des tests, des scripts.

**Ce que le pipeline NE FAIT PAS :** Décider quoi construire, inventer un nouveau concept, modifier un Aggregate, réécrire une Capability, créer une règle métier.

### 1.1 Entrées autorisées

Les seules entrées autorisées sont les documents suivants :

| Document | Contenu utilisé |
|----------|-----------------|
| DOC-000 | Hiérarchie des couches, principes de flux descendant, définition de chaque niveau |
| DOC-001 | Catalogue des 57 éléments (Concepts, Capabilities, Runtime Services, Domain Objects, Data Models, Templates) |
| DOC-004 | Règles de pont entre couches (12 PONTs) |
| DOC-005 | DAG des 18 Capacités, dépendances, Foundation Services utilisés |
| DOC-006 | Mapping Concept → Aggregate |
| DOC-008 | Pipeline décisionnel 9 étapes (pour validation de toute dérive) |
| DOC-012 | 13 Aggregates, 22 Entities, 40+ Value Objects, 70+ Business Rules |
| DOC-013 | Boundary specs (Possède / Protège / Expose / Interdit) |
| DOC-014 | 70 Commands + 60 Events |
| DOC-015 | 58 Invariants (38C/15M/5Mi) |
| DOC-016 | Validation DDD complète |
| DOC-017 | Persistence Model, PO metadata, Serialization Patterns, Storage Independence |
| DOC-018 | Mapping Rules: Aggregate → Entity → PO → Storage Unit |
| DOC-019 | 9 Persistence Strategies, matrice de sélection par Aggregate |
| DOC-020 | Persistence Validation Report |
| DOC-021 | 30 Physical Objects, attributs par catégorie de type, relations, cardinalités |
| DOC-022 | PO → Physical Mapping Rules, structural patterns |
| DOC-023 | Canonical Relational Rules, 27 NeverBreak rules |
| DOC-024 | PDM Validation Report |
| ARA-v1 | Verdict GO AVEC RÉSERVES, liste des réserves à traiter |

Toute autre source est une **violation**. Si un générateur a besoin d'une information non présente dans cette liste, il doit **arrêter et signaler une ambiguïté**, pas inventer.

### 1.2 Sorties attendues

Chaque génération produit UN ou PLUSIEURS artefacts techniques, chacun appartenant à UNE CATÉGORIE unique :

| Catégorie | Exemples | Document source principal |
|-----------|----------|-------------------------|
| Schéma physique | Table definitions, column mappings | DOC-021 + DOC-023 |
| Migrations | Scripts de versionning schema | DOC-021 + DOC-023 + DOC-022 |
| Contraintes & Index | Foreign keys, unique constraints, check constraints | DOC-023 §2-9 |
| Politiques RLS | Row-level security policies | DOC-023 §8 + DOC-021 `_org_id` |
| Contrats API | Endpoints, request/response types | DOC-014 + DOC-013 |
| Services applicatifs | Logic implémentant Commands | DOC-012 + DOC-015 |
| Configuration déploiement | Docker, CI/CD, environment | ARA-v1 + DOC-008 |
| UI dérivée | Écrans depuis Forms + Vocabulary | DOC-012 §FormAggregate + DOC-019 §Vocabulary |
| Tests | Unit, integration, E2E | DOC-015 (Invariants) + DOC-012 (Business Rules) |
| Scripts de vérification | Validation automatique de conformité | DOC-008 Decision Trees |

Aucune catégorie n'est obligatoire. Seules celles qui ont une entrée canonique définie doivent être générées.

---

## 2. ORDRE OBLIGATOIRE DE GÉNÉRATION

L'ordre ci-dessous est **constitutionnel**. Chaque étape dépend de la précédente. Aucune étape ne peut être sautée, inversée, ou générée en parallèle avec une étape antérieure.

### 2.1 Graphique de dépendance

```
┌─────────────────────────────┐
│ ÉTAPE 1: PDM → Schéma Physique │ ← Entrée: DOC-021 + DOC-023
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 2: Schéma → Migrations   │ ← Entrée: Étape 1 + DOC-022
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 3: Migrations →          │ ← Entrée: Étape 2 + DOC-023
│   Contraintes & Index          │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 4: Contraintes →         │ ← Entrée: Étape 3 + DOC-023 §8
│   Politiques RLS              │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 5: Contrats de données   │ ← Entrée: DOC-012 + DOC-014 + DOC-013
│   → API Contracts             │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 6: API → Services        │ ← Entrée: Étape 5 + DOC-012 + DOC-015
│   Applicatifs                 │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 7: Configuration de    │ ← Entrée: DOC-008 + ARA-v1 + DOC-001
│   déploiement                 │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 8: UI dérivée           │ ← Entrée: DOC-012 §Form + DOC-019 §Vocab
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 9: Tests dérivés        │ ← Entrée: DOC-015 + DOC-012 BR-XXX
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ÉTAPE 10: Vérification       │ ← Entrée: Toutes les étapes précédentes
│   de cohérence finale         │
└─────────────────────────────┘
```

### 2.2 Règles de séquentialité

1. **Aucune étape ne peut être sautée.** Générer l'étape 6 sans avoir fait les étapes 1-5 est une violation.
2. **Aucune étape ne peut être inversée.** L'étape N dépend TOUJOURS de l'étape N-1 si N > 1.
3. **Aucune étape ne peut être générée directement depuis une idée métier.** Chaque sortie doit tracer vers une entrée canonique.
4. **Aucune génération parallèle n'est autorisée entre étapes séquentielles.** La génération intra-catégorie (ex: toutes les migrations en parallèle) est autorisée SEULEMENT une fois l'étape précédente complète.

---

## 3. GÉNÉRATEURS OFFICIELS

Chaque générateur est un processus déterministe qui transforme des entrées canoniques en artefacts techniques.

### 3.1 Schema Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `schema-generator` |
| **Entrée** | DOC-021 (Physical Objects), DOC-023 (Relational Rules) |
| **Sortie** | Schéma relationnel technique (SQL DDL) |
| **Dépendances** | Aucune (premier générateur) |
| **Invariants** | NB-PERSIST-001 à NB-PERSIST-012 (DOC-017 §6), NB-RR-001 à NB-RR-008 (DOC-023 §9) |
| **Critères d'échec** | Un Physical Object de DOC-021 ne peut pas être mappé, ambigüité sur la catégorie de type, violation d'une règle NB |
| **Validation automatique** | `validate-schema-consistency`: chaque Physical Object → table avec tous les attributs, relations → FK, cardinalités respectées |
| **Traçabilité** | DOC-021 §X.Y → table T; DOC-023 §X → contraintes C |
| **Traitement des réserves ARA** | G-001: convention nommage tables (pluriel snake_case recommandé) |

**Spécifications de transformation :**
- Chaque Physical Object de DOC-021 devient UNE table
- Chaque attribut de DOC-021 avec catégorie "identifiant" → PRIMARY KEY ou FK composite
- Chaque catégorie "chaîne" → VARCHAR avec longueur raisonnable (définie par contexte)
- Chaque catégorie "numérique" → DECIMAL ou INTEGER selon description
- Chaque catégorie "date/heure" → TIMESTAMPTZ
- Chaque catégorie "booléen" → BOOLEAN
- Chaque catégorie "référence" → UUID FK vers la table cible
- Chaque catégorie "objet intégré" → JSONB
- Chaque catégorie "collection" → TEXT[] ou table séparée selon cardinalité
- Chaque catégorie "énumération" → CHECK constraint ou ENUM type
- Chaque catégorie "hachage" → TEXT (jamais exposé en clair)
- Chaque catégorie "token" → TEXT (encrypted at rest)
- `_org_id` présent sur toutes les tables (DOC-021 toujours, DOC-023 §8 toujours)

### 3.2 Migration Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `migration-generator` |
| **Entrée** | Schéma SQL généré par Schema Generator (Étape 1) |
| **Sortie** | Scripts de migration ordonnés (001_create_*.sql, etc.) |
| **Dépendances** | Étape 1 (Schema Generator complet) |
| **Invariants** | Flux descendant: le schéma ne dicte jamais l'ordre des migrations au-delà de topological sort des FK |
| **Critères d'échec** | Migration crée une table avant qu'une référence n'existe, migration modifie une table existante au lieu de créer une nouvelle version |
| **Validation automatique** | `validate-migration-order`: topological sort des tables basé sur FK |
| **Traçabilité** | Chaque migration référence le Physical Object source de DOC-021 |
| **Traitement des réserves ARA** | Aucune réserve spécifique |

**Spécifications de transformation :**
- Numéroter les migrations séquentiellement: `YYYYMMDD-HHMMSS-NNN_description.sql`
- Ordre: tables parentes d'abord, tables enfant ensuite
- Chaque migration: CREATE ONLY (pas de ALTER sur migration précédente)
- Migrations inversibles: chaque CREATE a un DROP correspondant

### 3.3 Constraint & Index Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `constraint-index-generator` |
| **Entrée** | Migrations (Étape 2) + DOC-023 (Relational Rules) |
| **Sortie** | Scripts d'index et de contraintes supplémentaires |
| **Dépendances** | Étape 2 complet |
| **Invariants** | NB-RR-004 (identifier immuable après création), NB-RR-008 (exclusive immutable log pour AuditAggregate seulement) |
| **Critères d'échec** | Création d'un index qui traverse plusieurs Aggregats, violation de NB-RR-008 |
| **Validation automatique** | `validate-constraint-completeness`: chaque invariant DOC-015 mappe à au moins une contrainte physique |
| **Traçabilité** | Constraint → DOCL-XXX: chaque IN-XXX de DOC-015 a une contrepartie physique |
| **Traitement des réserves ARA** | Aucune réserve spécifique |

**Spécifications de transformation :**
- Unique constraints : `UNIQUE(org_id, email)` (MEM-001 email unique par org)
- Check constraints : `CHECK(amount > 0)` (FIN-002 montant toujours positif)
- Foreign key constraints : `REFERENCES organization(id) ON DELETE CASCADE` (boundary preservation)
- Index strategy : org_id sur toutes les tables (SM-004 isolation par org), resource_type sur resources (search optimization)
- Sequence number sur audit_logs (NB-PERSIST-006)

### 3.4 RLS Policy Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `rls-generator` |
| **Entrée** | Schéma (Étape 3) + `_org_id` présent sur tous les objets physiques (DOC-021) |
| **Sortie** | Politiques RLS per-table (FOR SELECT/INSERT/UPDATE/DELETE USING ...) |
| **Dépendances** | Étape 3 complet |
| **Invariants** | NB-PERSIST-002 (isolation multi-tenant), DOC-023 §8 (tous objets ont `_org_id`) |
| **Critères d'échec** | Une politique RLS permet l'accès cross-org, une politique utilise un champ autre que `_org_id` pour filtrer |
| **Validation automatique** | `validate-rls-isolation`: chaque politique WHERE clause contient `org_id = current_org_id()` |
| **Traçabilité** | Chaque politique RLS trace vers l'Aggregate owner du Physical Object + le rôle RBAC |
| **Traitement des réserves ARA** | G-004: matrice table×rôle explicite manquante → inférée depuis DOC-012 IdentityAggregate roles |

**Spécifications de transformation :**
- Pattern universel : `USING (org_id = current_setting('request.org_id')::uuid)`
- Par défaut : ENABLE REPLICA pour toutes les tables avec données sensibles
- Suppression automatique des politiques RLS pour tables purement système (si applicable)
- Superadmin bypass via policy override

### 3.5 API Contract Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `api-contract-generator` |
| **Entrée** | DOC-014 (Commands + Events), DOC-013 (Boundary Expose/Interdit) |
| **Sortie** | API endpoints + types de requête/réponse + error codes |
| **Dépendances** | Aucune (dépend de documents canoniques, pas d'étapes précédentes) |
| **Invariants** | DOC-013 Boundary: chaque endpoint correspond EXACTEMENT à un "Expose:" d'un Aggregate boundary |
| **Critères d'échec** | Un endpoint ne correspond à aucune Command DOC-014, un endpoint expose un "Interdit" DOC-013 |
| **Validation automatique** | `validate-api-boundaries`: pour chaque endpoint ≥ 1 Command et ≤ 1 Aggregate boundary expose |
| **Traçabilité** | Endpoint → Command DOC-014; HTTP method mapping: POST→Create, PUT→Update, DELETE→Delete, GET→Read |
| **Traitement des réserves ARA** | Aucune réserve spécifique |

**Spécifications de transformation :**
- `/api/{aggregate}/create` → `Create{Entity}` command
- `/api/{aggregate}/update/{id}` → `Update{Entity}` command
- `/api/{aggregate}/{id}` → query avec `org_id` injection
- Response format: `{ data, version, sync_status }`
- Error codes: 400 validation, 401 auth, 403 permission, 409 conflict, 422 domain invariant violation
- Headers requis: `x-org-id` (toujours), `Authorization: Bearer <JWT>`

### 3.6 Service Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `service-generator` |
| **Entrée** | API Contracts (Étape 5) + DOC-012 (Domain Model) + DOC-015 (Invariants) |
| **Sortie** | Implémentation des services applicatifs |
| **Dépendances** | Étape 5 (API Contracts) |
| **Invariants** | DOC-015 Invariants (58 invariants toujours appliqués avant write), DOC-012 Business Rules |
| **Critères d'échec** | Service viole un invariant DOC-015, service applique une règle métier absente de DOC-012 |
| **Validation automatique** | `validate-service-invariants`: pour chaque guard dans service, vérifier ≤ 1 invariant DOC-015 |
| **Traçabilité** | Méthode de service → Command DOC-014 → Entity DOC-012 → Guard → Invariant DOC-015 |
| **Traitement des réserves ARA** | G-005: pas de scénarios E2E complets → services testés individuellement uniquement |

**Spécifications de transformation :**
- Chaque Command DOC-014 → méthode de service correspondante
- Guards d'invariants avant chaque write (optimistic lock, business rule validation)
- Domain Events émis après chaque état changé (DOC-014 Events registry)
- Audit logging systématique via AuditAggregate.LogAction()

### 3.7 Deployment Config Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `deployment-config-generator` |
| **Entrée** | DOC-001 (Runtime Services), DOC-008 (Decision Constitution) |
| **Sortie** | Dockerfiles, docker-compose.yml, CI/CD pipelines |
| **Dépendances** | Aucune (configuration autonome) |
| **Invariants** | DOC-000 Règle 1 (flux descendant), DOC-008 Step 8 (API existe) |
| **Critères d'échec** | Configuration de déploiement introduit des dépendances non cataloguées dans DOC-001 |
| **Validation automatique** | `validate-deployment-runtime`: chaque service dans docker-compose est listé dans DOC-001 Runtime Services |
| **Traçabilité** | Container → Runtime Service DOC-001 |
| **Traitement des réserves ARA** | Aucune |

### 3.8 UI Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `ui-generator` |
| **Entrée** | DOC-012 FormAggregate + DOC-019 Vocabulary (Strategy §2.8) |
| **Sortie** | Composants React Native dynamiques à partir de Form Definitions |
| **Dépendances** | Étape 6 (Services Applicatifs) — l'UI consomme les APIs |
| **Invariants** | NB-PERSIST-005 (Events définis par Commands, pas UI), DOC-012 BR-FRM (no JSX hardcoded forms) |
| **Critères d'échec** | UI définit un formulaire en JSX dur (BR-FRM-001), UI référence un vocabulaire inexistant (BR-VOC-004) |
| **Validation automatique** | `validate-ui-forms`: aucun formulaire hardcoded JSX, toutes les listes référencent Vocabulary |
| **Traçabilité** | Écran → FormDefinition → Fields → Vocabulary Terms → Labels FR+EN |
| **Traitement des réserves ARA** | ARA-v1 §4.6: UI PARTIEL — nécessite Design Guidelines externes pour le design précis |

**Spécifications de transformation :**
- Les formulaires HTML/JSX sont RENDUS depuis les FormDefinitions de DOC-012
- Les options de select/multiselect sont CHARGÉES depuis Vocabulary de DOC-019
- Les labels FR/EN sont RÉSOLUS depuis TranslationPair de DOC-019
- L'UI n'invente JAMAIS de champs non définis dans une FormDefinition

### 3.9 Test Generator

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `test-generator` |
| **Entrée** | DOC-015 (58 Invariants) + DOC-012 (70+ Business Rules) + DOC-014 (Commands/Events) |
| **Sortie** | Tests unitaires + tests d'intégration |
| **Dépendances** | Étape 6 (Services Applicatifs) |
| **Invariants** | Chaque invariant CRITIQUE de DOC-015 → au moins 1 test unitaire |
| **Critères d'échec** | Un invariant CRITIQUE sans test correspondant |
| **Validation automatique** | `validate-test-coverage`: for each INV-XXX CRITIQUE, exists test function covering it |
| **Traçabilité** | Test → Invariant DOC-015 → Aggregate DOC-012 → Boundary DOC-013 |
| **Traitement des réserves ARA** | G-005: pas de scénarios E2E complets → tests unitaires ONLY |

**Spécifications de transformation :**
- Pour chaque invariant CRITIQUE: test unitaire "violé" + test unitaire "respekté"
- Pour chaque invariant MAJEUR: test intégration couvrant la guard function
- Pour chaque invariant MINEUR: test smoke de non-régression
- Pas de E2E test génération (réservé aux spécifications manuelles)

---

## 4. RÈGLES DE DÉTERMINISME

### 4.1 Principes de déterminisme

Pour garantir que le pipeline produit toujours la même sortie pour la même entrée :

1. **Entrée identique → Sortie identique.** Si le schéma physique de l'étape 1 est re-généré avec les mêmes docs canoniques, le résultat doit être byte-identique (hors timestamp de migration).

2. **Différence de sortie = Différence d'entrée.** Si deux générations produisent des sorties différentes, l'une des entrées canoniques a changé ou une règle a été appliquée incorrectement.

3. **Aucun état implicite.** Chaque générateur lit UNIQUEMENT ses entrées documentées et produit UNIQUEMENT ses sorties documentées. Zéro variable d'environnement, zéro cache, zéro état externe.

4. **Ambiguïté = Blocage.** Si un générateur rencontre une information ambiguë ou contradictoire entre les documents canoniques, il doit arrêter et signaler le blocage. Jamais d'hypothèse.

### 4.2 Règles de déterminisme

| Règle | Description | Enforcement |
|-------|-------------|-------------|
| **D-001** | Pas de random dans la génération | Hash stable pour IDs |
| **D-002** | Ordre des tables déterministe | Tri alphabétique par nom |
| **D-003** | Ordre des colonnes déterministe | Ordre défini dans DOC-021 |
| **D-004** | Pas de dépendance horaire | Timestamps dans migrations uniquement |
| **D-005** | Formats de sortie standards | JSON/YAML/SQL formatting constant |

---

## 5. RÈGLES DE TRACABILITÉ

### 5.1 Métadonnées obligatoires par artefact

Tout artefact généré DOIT contenir les métadonnées suivantes (dans un header commenté ou un en-tête de fichier) :

| Champ | Description | Exemple |
|-------|-------------|---------|
| `generation_id` | Identifiant unique SHA-256 de l'artefact | `a1b2c3d4...` |
| `source_canonical` | Document(s) canonique(s) utilisés comme source | `DOC-021§3.1, DOC-023§5` |
| `transformation_rule` | Règle de transformation appliquée | `schema-generator v1.0` |
| `generation_date` | Date ISO 8601 de génération | `2026-07-24T10:30:00Z` |
| `architecture_version` | Version du pipeline canonique utilisé | `v1.0 (DOC-000 à DOC-024 + ARA-v1)` |
| `validation_hash` | Empreinte de validation structurelle | `SHA-256(artefact)` |
| `compliance_status` | Statut de conformité aux règles canoniques | `COMPLIANT / VIOLATION / BLOCKED` |

### 5.2 Règles d'or de traçabilité

- **R-TRACE-001 :** Aucun artefact ne doit être orphelin. Chaque artefact doit pouvoir être tracé vers au MOINS UN document DOC-000 à DOC-024.
- **R-TRACE-002 :** Si un artefact change, sa source canonique a changé OU la règle de transformation a changé. Tout autre changement est une violation.
- **R-TRACE-003 :** La traçabilité doit être vérifiable par un script automatique.

---

## 6. RÈGLES DE RÉGÉNÉRATION

### 6.1 Quand régénérer

Un artefact Technique DOIT être régénéré si :

| Condition | Action |
|-----------|--------|
| Source canonique modifiée (DOC-000 à DOC-024) | Régénérer TOUS les artefacts dérivés |
| Règle de transformation mise à jour | Régénérer les artefacts concernés |
| Nouvelle réservation ARA fermée | Régénérer les artefacts affectés par la réserve |
| Vérification de cohérence échoue | Régénérer l'ensemble du pipeline |

### 6.2 Quand NE PAS régénérer

| Condition | Justification |
|-----------|--------------|
| Changement cosmétique (formatage, indentation) | Ne change pas la sémantique |
| Changelog dans artefact lui-même | Information documentaire, pas structurelle |
| Déploiement cible change (staging vs prod) | Configuration externe, pasArtefact technique |

### 6.3 Détection de dérive

Une dérive est détectée lorsque :

1. L'empreinte SHA-256 d'un artefact change SANS que sa source canonique ait changé
2. Un artefact ne peut plus être re-généré à partir de ses entrées (perd une dépendance)
3. Un artefact généré contredit un invariant DOC-015

### 6.4 Comparaison de générations

Deux générations sont identiques si et seulement si :
- Leurs métadonnées de `source_canonical` sont identiques
- Leur `validation_hash` est identique
- Toutes les règles DOC-018/DOC-022/DOC-023 aboutissent au même résultat

---

## 7. CRITÈRES DE REJET

Un générateur DOIT refuser de produire un artefact si :

| Numéro | Condition | Sévérité |
|--------|-----------|----------|
| **R-001** | Une entrée n'est pas canonique (document absent ou corrompu) | CRITIQUE |
| **R-002** | Une dépendance manque (étape N-1 incomplète) | CRITIQUE |
| **R-003** | Une règle métier est inventée (non-tracée vers DOC-012 ou DOC-015) | CRITIQUE |
| **R-004** | Un document source est ambigu (deux DOC contradicteurs) | MAJEURE |
| **R-005** | Une contradiction existe entre DOC-000 et DOC-024 | CRITIQUE |
| **R-006** | Un artefact technique contredit une règle canonique (NeverBreak, Mapping Rule, etc.) | CRITIQUE |
| **R-007** | Une génération saute une couche du pipeline (Étape N+1 lancée sans Étape N) | CRITIQUE |
| **R-008** | Un artefact n'est pas traçable vers DOC-000 à DOC-024 | CRITIQUE |

En cas de rejet, le générateur doit :
1. Arrêter immédiatement
2. Signalier le numéro de critère (R-XXX)
3. Identifier la cause exacte
4. Ne JAMAIS appliquer de correction automatique

---

## 8. BOUCLE DE VALIDATION

Chaque génération passe par 6 validations en cascade. Si une validation échoue, la génération échoue.

### 8.1 Chaines de validation

```
Structurelle → Cohérence → Traçabilité → NeverBreak → Non-régression → Non-invention
     ↓              ↓            ↓              ↓              ↓              ↓
  Syntaxe      Relations    Artéfact     Jamais de        Changement   Jamais de
  Valide?      Logiques     Tracé?       business rule    Sémantique   nouveau concept
```

### 8.2 Détail des validations

| Validation | Vérifie | Source | Échoue si |
|------------|---------|--------|-----------|
| **V-STRUCT** | Syntaxe valide, structure conforme au template attendu | Règles du format de sortie | Format invalide |
| **V-COHERE** | Relations entre artefacts logiquement valides (FK respectées, Cardinalités OK) | DOC-023 §3-9 | Relation invalide |
| **V-TRACE** | Chaque élément est tracé vers un document canonique | Règles §5 | Élément orphelin |
| **V-NB** | Jamais de règle métier, jamais de new concept, jamais de boundary change | DOC-017 §6, DOC-023 §9 | Violation NeverBreak |
| **V-REGRESS** | Changement ne casse pas ce qui existait avant | Hashs comparés | Dérive détectée |
| **V-INVENT** | Jamais de nouveau concept, capability, aggregate, règle métier | DOC-000 Règle 3, DOC-008 Step 2 | Élément non-catalogué |

Si V-STRUCT échoue → arrêter (problème de format).
Si V-COHERE échoue → arrêter (problème logique).
Si V-TRACE échoue → arrêter (problème de traçabilité).
Si V-NB échoue → arrêter (violation constitutionnelle).
Si V-REGRESS échoue → arrêter (risque de dérive).
Si V-INVENT échoue → arrêter (invention interdite).

**Aucune correction automatique ne doit masquer une violation.** Une génération échouée doit être corrigée en amont (doc source, règle de transformation), jamais en aval (artefact résultant).

---

## 9. HIÉRARCHIE DES ARTÉFACTS TECHNIQUES

La hiérarchie des artefacts reflète la hiérarchie architecturale de DOC-000 :

```
Canon Architectural (DOC-000 à DOC-024)
  ↓ Prime sur tout
Domain Model (DOC-012, DOC-013, DOC-015)
  ↓ Prime sur le schéma
Persistence Model (DOC-017, DOC-018, DOC-019, DOC-022)
  ↓ Prime sur l'implémentation
Physical Data Model (DOC-021, DOC-023)
  ↓ Prime sur le SQL final
Schéma Relationnel (Étape 1 du pipeline)
  ↓ Prime sur les migrations
Migrations (Étape 2 du pipeline)
  ↓ Primes sur les politiques RLS
Contraintes & Index (Étape 3 du pipeline)
RLS Policies (Étape 4 du pipeline)
API Contracts (Étape 5 du pipeline)
Services Applicatifs (Étape 6 du pipeline)
Configuration Déploiement (Étape 7)
UI Dérivée (Étape 8)
Tests (Étape 9)
```

**Règle fondamentale :** Les migrations NE DÉFINISSENT JAMAIS la vérité métier. Elles stockent. Elles ne créent pas de règles. Les règles métier vivent dans DOC-012 et DOC-015, pas dans les migrations.

---

## 10. PÉRIMÈTRE AUTORISÉ DES ARTÉFACTS D'IMPLÉMENTATION

### 10.1 Catégories autorisées

| Catégorie | Peut | Ne peut PAS |
|-----------|------|-------------|
| Schéma physique | Structurer le stockage | Définir des règles métier |
| Migrations | Évoluer le schéma | Changer les Aggregates |
| Contraintes | Enforcer des invariants physiquement | Inventer de nouveaux invariants |
| Index | Optimiser les performances | Changer la sémantique des données |
| Politiques RLS | Isoler multi-tenant | Donner des permissions autres que celles de DOC-015 |
| Contrats API | Exposer les Commands | Créer de nouvelles Commands |
| Services applicatifs | Implémenter les Commands | Contourner les invariants |
| Configuration | Ordonner le déploiement | Changer l'architecture |
| UI dérivée | Rendre les Forms | Inventer des formulaires |
| Tests | Vérifier les invariants | Changer le comportement métier |
| Scripts de vérification | Valider la conformité | Modifier les documents canoniques |

### 10.2 Interdictions absolues

Les artefacts d'implémentation NE PEUVENT JAMAIS :

- Redéfinir un Concept (interdit : nouveau Concept non catalogué dans DOC-001)
- Redéfinir une Capability (interdit : nouvelle Capability non cataloguée dans DOC-005)
- Redéfinir un Aggregate (interdit : nouvelle Aggregate non défini dans DOC-012)
- Redéfinir une règle canonique (interdit : modifier DOC-008 à DOC-024)

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Spécification de génération contrôlée basée sur DOC-000 à DOC-024 + ARA-v1 | GO AVEC RÉSERVES |

---

*Ce document ne fait pas partie de la série DOC-000 à DOC-024. C'est un spécification de génération qui dépend des documents canoniques pour son existence.*
