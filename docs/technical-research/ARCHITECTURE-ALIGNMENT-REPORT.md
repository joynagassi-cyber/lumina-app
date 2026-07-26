# Rapport d'Alignement Architectural — Lumina v2

**Date:** 2026-07-24  
**Auteur:** Chief Platform Architect  
**Statut:** AUDIT COMPLÈTE  
**Scope:** PRD + Constitution + 16 ADRs + Invariants + NeverBreak + Architecture Map + 5 Engine Specs + Database Schema + Business Rules + Docs technique/research

---

## 1. Architecture Actuelle

Lumina repose sur un **noyau technique de 5 moteurs**: Manifest, Vocabulary, Forms, Workflow, Capability. Ces moteurs lisent un manifest YAML au runtime et interprètent toute la logique organisationnelle.

Le système comporte:
- Un schéma PostgreSQL avec **16 tables** (défini dans BACKEND-PG-SCHEMA.md)
- Des modèles **WatermelonDB** équivalents (BACKEND-WATERMELON-MODELS.md)
- **7 edge functions** InsForge pour la logique server-side (BACKEND-RLS-EDGE-FUNCTIONS.md)
- Une stratégie **offline-first** avec sync delta (ADR-003)
- Une hiérarchie multi-tenant par `org_id` + RLS (ADR-006)
- Un **DAG organisationnel** récursif (ADR-014)
- Un système de **consolidation financière déclarative** multi-niveaux (ADR-017-financial)
- Un système d'**archive générique** basé sur Lifecycle + JSONB
- Un RBAC **minimaliste** (1 table org_members, permissions via manifest)

**Problème fondamental détecté:** Le terme "Platform Core" est utilisé massivement dans les docs, induisant une lecture infrastructurelle plutôt que capability-compositionnelle. La Constitution l'a déjà remplacé par "Platform Capabilities", mais ce swap n'est pas 100% complété.

---

## 2. Architecture Cible

Conformément à la Constitution:

```
Foundation
  - Identity
  - Security
  - Permissions
  - Audit
  - Configuration
  - Storage
  - Offline
  - Localization
  - Logging
↓
Platform Capabilities
  - Manifest (Capability 1)
  - Vocabulary (Capability 2)
  - Forms (Capability 3)
  - Workflow (Capability 4)
  - Capability Registry (Capability 5)
↓
Business Packs
  (Church, School, NGO, Company... composent les capacités)
↓
Templates
  (Configuration pure: vocabularies, formulaires, workflows, règles)
↓
Organizations
  (Instances configurées d'un Template)
↓
Applications
  (Consomment uniquement les capacités exposées)
```

Règle fondamentale: **Les tables PostgreSQL n'appartiennent à aucun niveau de cette hiérarchie.** Les tables sont du stockage. Elles servent TOUTES les couches.

---

## 3. Analyse des Cinq Modèles

### 3.1 Architecture Model (Responsabilités)

| Élément | Statut | Écart |
|---------|--------|-------|
| Foundation décrite dans la Constitution | ✅ Définie | Aucun |
| Platform Capabilities = 5 moteurs | ⚠️ Partiel | Les moteurs sont listés mais certains sont identifiés comme "fonctionnalités métier" au lieu de capacités |
| Business Packs (Church, School, NGO...) | ❌ Absent | Aucun doc ne documente les Business Packs |
| Templates | ⚠️ Ambigu | Les templates sont confondus avec les manifests (ce sont deux choses différentes) |
| Organizations / Applications | ✅ Impliqué | Correct dans PRD |

**Écarts critiques:**
- E-01: Le Capability Engine liste `membership`, `finance`, `events`, `notifications`, `reports` comme capabilities. Ce sont des **fonctionnalités métier**, pas des capacités. `membership` est une composition d'Identity + Resource + Relationship + Workflow + Forms + Search + Notification + Reporting. `finance` est une composition de Resource + Workflow + Policy + Forms + Reporting.
- E-02: La section "Foundation" de la Constitution définit 9 services fondamentaux, mais aucune documentation ne les modélise individuellement.

### 3.2 Conceptual Model (Concepts fondamentaux)

| Concept | Présent? | Statut |
|---------|----------|--------|
| Identity | ⚠️ Dans auth/permissions | Partiel — pas de model conceptuel unique |
| Organization | ✅ Multi-tenant par org_id | OK |
| Resource | ❌ Absent | Critique — toutes les entités (transactions, membres, events, archives) sont des Resources |
| Relationship | ❌ Absent | Critique — group_memberships est une table, pas un concept universel |
| Activity | ⚠️ Events seulement | Partial — les workflow executions sont aussi des activities |
| Capability | ✅ Capability Engine | OK mais liste incorrecte (voir E-01) |
| Policy | ❌ Absent | Critique — audit retention, archival policies, approval thresholds sont des policy configs |
| Manifest | ✅ Format YAML défini | OK |
| Template | ❌ Absent du concept | Template ≠ Manifest (template = config, manifest = instance de template) |
| Workflow | ✅ Workflow Engine | OK |
| Form | ✅ Forms Engine | OK |
| Vocabulary | ✅ Vocabulary Engine | OK |
| Branding | ⚠️ Design tokens dans DESIGN.md | OK mais pas conceptualisé |
| Notification | ⚠️ Dans capability engine | Listé comme feature, pas comme concept universel |
| Audit | ✅ INV-007 + audit_logs table | OK |
| Offline Sync | ✅ ADR-003 + pending_operations | OK |

**Écarts critiques:**
- E-03: Le concept **Resource** est totalement absent. Pourtant, INV-002 exige que le core ne connaisse PAS de métier. Sans abstraction Resource, tout devient type-specific.
- E-04: Le concept **Relationship** est absent. Pourtant, PRD dit que les membres peuvent appartenir à plusieurs groupes, organisations peuvent avoir des enfants, etc. C'est un Relationship problem, pas un membership problem.
- E-05: Le concept **Policy** est absent. Pourtant, les approval_thresholds, audit_retention, archive_lifecycle, notification_rate_limits sont tous des POLICIES configurables.

### 3.3 Runtime Model (Exécution)

| Élément | Statut | Écart |
|---------|--------|-------|
| Manifests compilés | ✅ Manifest Engine | OK |
| Policies | ⚠️ Confondu avec workflow | Les policies sont configurables mais non-modélisées comme Runtime Model séparé |
| Configuration | ✅ Org settings dans manifest | OK |
| Vocabulaire | ✅ Vocab Engine | OK |
| Workflows | ✅ Workflow Engine | OK |
| Forms | ✅ Forms Engine | OK |
| Branding | ⚠️ Partiel | Couleurs/heures/presets définis dans DESIGN.md mais pas intégrés au runtime |
| Capabilities | ✅ Capability Registry | OK |
| Permissions | ✅ RBAC via JWT | OK |
| Feature Flags | ⚠️ Dans manifest.features | OK mais pas de mechanism générique de toggle |
| Design Tokens | ⚠️ Dark Canvas presets | OK mais pas modélisé comme runtime item |

**Écarts:**
- E-06: Pas de modèle conceptuel dédié aux **Design Tokens** (couleur accent, logo, police, thème). Ils sont dans DESIGn.md mais pas dans Runtime Model.
- E-07: Les **Feature Flags** existent en manifestation dans manifest.yaml (`features.finance.enabled`) mais pas de mechanism d'enregistrement/gestion dédié.

### 3.4 Domain Model (Objets manipulés)

| Concept présent | Table DB correspondante |
|----------------|------------------------|
| Organization | `organizations` |
| User | `users` |
| Transaction | `transactions` |
| Category | `categories` |
| Member | `members` |
| OrgUnit | `org_units` |
| GroupMembership | `group_memberships` |
| Event | `events` |
| ArchiveEntry | `archive_entries` |
| Notification | `notifications` |
| AuditLog | `audit_logs` |
| PendingOperation | `pending_operations` |

**Écarts critiques:**
- E-08: **Pas de concept Resource abstrait**. Transaction, Member, Event, ArchiveEntry, Notification sont TOUS des Resources dans le Domain Model. Elles sont traitées comme des types isolés.
- E-09: **Pas de concept Activity abstrait**. PendingOperation ET WorkflowInstance et les approvals sont des Activities. Elles sont traitées isolément.
- E-10: Dans Business Rules, "transaction" et "member" sont des types domaines. Mais la Constitution exige Resource comme type domaine universel.

### 3.5 Data Model (Stockage)

| Table | Justification |
|-------|--------------|
| organizations | Infrastructure multi-tenant |
| users | Identity |
| user_sessions | Auth (refresh tokens) |
| categories | Lookup (vocab financier) |
| transactions | Data métier (Resource) |
| members | Data métier (Resource/Identity) |
| org_units | Structure org (Resource/Relationship) |
| group_memberships | Many-to-many (Relationship) |
| events | Data métier (Resource/Activity) |
| event_templates | Template (config) |
| archive_entries | Archive générique (Lifecycle) |
| notifications | Communication |
| notification_preferences | Settings |
| org_settings | Configuration |
| audit_logs | Audit trail immuable |
| pending_operations | Sync offline queue |

**Écarts:**
- Aucun écart critique ici. Le Data Model est propre et bien structuré.
- Les tables reflètent correctement les données nécessaires au fonctionnement de la plateforme.

---

## 4. Écarts Détectés

### ÉCART CRITIQUE — E-01: Capability List Identifies Features as Capabilities

**Localisé dans:** `docs/01-platform-core/capability-engine/index.md` §4 "Capabilities de Base (MVP)"

**Description:** Le Capability Engine liste `membership`, `finance`, `events`, `notifications`, `reports` comme capabilities natives.

**Pourquoi c'est une violation:** La Constitution interdit explicitement ces termes:
> Tu ne dois jamais proposer : Member Engine, Finance Engine, Department Engine, Attendance Engine... Ces éléments sont des fonctionnalités métier.

**Preuve de la violation:**
- `membership` → devrait être une composition d'Identity + Resource + Relationship + Forms + Workflow + Search + Notification
- `finance` → devrait être Resource + Workflow + Policy + Forms + Reporting + Audit
- `events` → devrait être Resource + Activity + Notification + Search + Forms
- `notifications` → devrait être une capacité Notification de la Platform, pas une "feature"

**Impact:** Cette confusion alimente l'erreur mentale que la platform doit avoir un "membre engine". En réalité, le membre est une RESOUrce + une IDENTITY + des RELATIONSHIPS + un WORKFLOW d'admission + une NOTIFICATION de bienvenue.

**Correctif:** Remplacer la section "Capabilities de Base" par:

```yaml
# Platform Capabilities Official Catalog
capabilities:
  - id: "resource"
    name: "Resource Management"
    description: "CRUD générique pour toute ressource de l'organisation"
    
  - id: "identity"
    name: "Identity & Access"
    description: "Users, profiles, authentication, session management"
    
  - id: "relationship"
    name: "Relationship Graph"
    description: "Many-to-many relations entre resources et organizations"
    
  - id: "workflow"
    name: "Workflow Engine"
    description: "Orchestration d'étapes déclenchées par événements"
    
  - id: "forms"
    name: "Forms Engine"
    description: "Génération de formulaires dynamiques depuis définition JSON/YAML"
    
  - id: "vocabulary"
    name: "Vocabulary Engine"
    description: "Catalogue centralisé de termes, valeurs, traductions"
    
  - id: "manifest"
    name: "Manifest Engine"
    description: "Interprétation de configuration YAML/JSON par organisation"
    
  - id: "capability-registry"
    name: "Capability Registry"
    description: "Registre des capacités activables/désactivables"
    
  - id: "notification"
    name: "Notification Service"
    description: "Alertes, push, email, in-app, channels configurables"
    
  - id: "lifecycle"
    name: "Lifecycle Management"
    description: "States configurables (draft→active→archived→trashed→purged)"
    
  - id: "reporting"
    name: "Reporting Service"
    description: "Export configurable (PDF, CSV, JSON) depuis data any resource"
    
  - id: "policy"
    name: "Policy Engine"
    description: "Rules configurables (approvals, retention, rate limits, quotas)"
    
  - id: "design"
    name: "Design System"
    description: "Tokens, branding, themes, couleurs, typographie par org"
    
  - id: "search"
    name: "Search Service"
    description: "Full-text, GIN index, tags, filters configurables"
    
  - id: "offline-sync"
    name: "Offline Sync"
    description: "Push queue, pull strategy, conflict resolution, LWW"
    
  - id: "audit"
    name: "Audit Trail"
    description: "Immutable logging of all user actions"
    
  - id: "configuration"
    name: "Configuration Service"
    description: "Org settings, i18n, business rules, templates"
```

### ÉCART SÉVÈRE — E-02: Absence de Document Foundation

**Description:** La Constitution définit 9 services dans la Foundation mais aucun document ne les spécifie.

**Impact:** On ne peut ni implémenter ni vérifier une Foundation non-documentée.

### ÉCART SÉVÈRE — E-03/E-04: Absence des concepts Resource et Relationship

**Description:** Le Conceptual Model manque deux concepts fondamentaux définis par la Constitution: Resource et Relationship.

**Impact:** Toutes les entités sont traitées comme types spécifiques au lieu d'instancer d'une abstraction Resource.

### ÉCART MODÉRÉ — E-05: Absence du concept Policy

**Description:** Les policies (approval thresholds, audit retention, notification rate limits) sont configurées mais pas conceptualisées.

**Impact:** Il n'y a pas de moteur Policy dédié. Les policies sont dispersées entre Manifest Engine et Workflow Engine.

### ÉCART MODÉRÉ — E-06/E-07: Design Tokens et Feature Flags non-modélisés

**Description:** Design system existe (DESIGN.md) mais n'est pas un Runtime Model item. Feature flags existent en manifestation mais sans mechanism.

**Écarts mineurs:**
- E-09: Termes "Gestion des membres", "Gestion financière" persistent dans PRD §4
- E-10: Business Packs non-documentés (aucun dossier docs/business-packs/)
- E-11: Templates confondus avec manifests dans plusieurs docs

---

## 5. Corrections Proposées

### C-01: Remplacer "Capabilities de Base" du Capability Engine

Remplacer §4 de `capability-engine/index.md` par le catalogue officiel (ci-dessous E-01).

### C-02: Documenter la Foundation

Créer `docs/10-foundation/` avec un spec par service:
- `identity.md`
- `security.md`
- `permissions.md`
- `audit.md`
- `configuration.md`
- `storage.md`
- `offline.md`
- `localization.md`
- `logging.md`

### C-03: Introduire Resource et Relationship dans le Conceptual Model

Ajouter une page `docs/conceptual-model.md` listant tous les concepts:
```
Identity, Organization, Resource, Relationship, Activity, 
Capability, Policy, Manifest, Template, Workflow, Form, 
Vocabulary, Branding, Notification, Audit, Offline Sync
```

### C-04: Créer le catalogue officiel des Platform Capabilities

Page `docs/platform-capabilities/catalog.md` avec:
- Nom, Mission, Responsabilité
- Entrées, Sorties
- Dépendances
- Capacités utilisatrices
- Contraintes, Invariants, NeverBreak Rules

### C-05: Structurer Business Packs

Créer `docs/business-packs/` avec un subfolder par pack:
- `church/`
- `school/`
- `ngo/`
- `company/`

Chaque pack contient: vocabulaire pré-rempli, formulaire pré-configurés, workflows pré-définis.

### C-06: Supprimer les termes "Gestion X" du PRD

Section 4 du PRD utilise "Gestion Membres", "Gestion Rôles/Permissions". Remplacer par des noms de capacités.

---

## 6. Impacts

### Impact de C-01 (remplacement capability catalog)
- **Risk:** Moyen — change la liste des capabilities dans capability-engine
- **Benefit:** Élimine la confusion principale (features vs capabilities)
- **Breaking:** Oui, pour tout code qui référence `membership`, `finance` comme capabilities
- **Mitigation:** Mapping backward: `membership` → `identity`+`resource`+`relationship`; `finance` → `resource`+`workflow`+`policy`+`forms`+`reporting`+`audit`

### Impact de C-02 (Foundation docs)
- **Risk:** Faible — création uniquement, aucune modification
- **Benefit:** Clarification fondamentale des responsabilités

### Impact de C-03/C-04 (Conceptual Model + Catalog)
- **Risk:** Faible — documentation
- **Benefit:** Référence unique pour agents IA et développeurs

### Impact de C-05 (Business Packs)
- **Risk:** Faible — structure documentaire uniquement
- **Benefit:** Séparation claire entre capabilities et leur usage métier

### Impact de C-06 (PRD terminology)
- **Risk:** Très faible — terminologie PRD uniquement
- **Benefit:** Alignement terminologique haut niveau

---

## 7. Plan de Migration

### Phase 1 — Alignement Terminologique (Jour 1-2)

1. C-06: Supprimer "Gestion des membres" du PRD (§4)
2. C-01: Remplacer §4 du Capability Engine par catalogue officiel
3. C-03: Créer `docs/conceptual-model.md`
4. C-04: Créer `docs/platform-capabilities/catalog.md`

### Phase 2 — Documentation Foundation (Jour 3-5)

1. Créer `docs/10-foundation/` directory
2. Spécifier chaque service de Foundation (C-02)
3. Lier chaque spec aux ADRs correspondants

### Phase 3 — Business Packs & Templates (Jour 6-7)

1. Créer `docs/business-packs/church/` avec manifest exemple
2. Créer `docs/business-packs/school/` avec manifest exemple
3. Créer `docs/business-packs/ngo/` avec manifest exemple
4. Créer `docs/business-packs/company/` avec manifest exemple
5. Clarifier la différence Template ↔ Manifest dans Index.md

### Phase 4 — Références Croisées (Jour 8)

1. Mettre à jour INDEX.md avec la nouvelle hiérarchie
2. Scanner TOUS les docs pour "gestion membre", "gestion finance", "module membre", "module finance"
3. Corriger les références restantés

### Phase 5 — Validation Finale (Jour 9-10)

1. Scanner final de la documentation pour violations de la Constitution
2. Mettre à jour glossary.md avec nouveaux concepts (Resource, Relationship, Policy, Template)
3. Valider que TOUS les 16+ capabilities du catalogue sont documentées
4. Vérifier qu'aucune table DB n'est corrélée à une capacité
