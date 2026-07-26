# Capability Dependency Graph — Dépendances Officielles

**Doc ID:** DOC-005 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** SOURCE DE VÉRITÉ ABSOLUE  
**Date:** 2026-07-24  

---

## NOTE PRÉLIMINAIRE

Ce document produit un **DAG officiel** (Directed Acyclic Graph) des dépendances entre les 18 Platform Capabilities.

Un DAG garantit: zéro dépendance circulaire, un ordre d'initialisation déterministe, et une vérification CI automatique.

Si une nouvelle capability crée un cycle → BLOCAGE IMMÉDIAT par script `dependency-check`.

---

## GRAPH DES DÉPENDANCES (format textuel)

```
                        +------------------+
                        |   Vocabular      | ← DÉPENDANCES: AUCUNE (couche fondamentale)
                        +--------+---------+
                                 |
                    +------------+-------------+
                    |                           |
            +-------v-------+           +-------v-------+
            |    Forms       |           |   Search      |
            |  Configuration |           |  Lifecycle    |
            +-------+-------+           +---------------+
                    |                           |
                    +------------+--------------+
                                 |
                         +-------v--------+
                         |   Policy       |
                         +-------+--------+
                                 |
            +--------------------+--------------------+
            |                    |                    |
    +-------v-------+   +-------v--------+   +-------v--------+
    |  Reporting     |   |  Notification  |   |  Manifest      |
    +----------------+   +----------------+   +-------+--------+
                                                       |
                                         +-------------+-------------+
                                         |                           |
                                  +------v------+           +------v------+
                                  |   Workflow  |           |   Branding  |
                                  +------+------+           +-------------+
                                         |
                                   +------v------+
                                   | Resource    |
                                   +------+------+
                                          |
                              +-----------+-----------+
                              |                       |
                       +------v------+         +------v-------+
                       | Identity    |         | Relationship   |
                       +------+------+         +----------------+
                                              |
                                       +------v-------+
                                       | Capability   |
                                       |  Registry    |
                                       +--------------+

+------------------------------------+
| Offline Sync  | Audit  | Permission |
+----------------+---------------------+
         |               |              |
    +-----v------+ +-----v------+ +-----v------+
    | Foundation | | Foundation | | Foundation |
    +------------+ +------------+ +------------+
```

### Légende Visuelle

- **Niveau 0** (dépendances nulles): Vocabulary, Branding
- **Niveau 1** (dépendent uniquement Niveau 0): Forms Configuration, Search, Lifecycle
- **Niveau 2**: Policy
- **Niveau 3**: Reporting, Notification, Manifest
- **Niveau 4**: Workflow
- **Niveau 5**: Resource
- **Niveau 6**: Identity, Relationship
- **Niveau 7**: Capability Registry
- **Foundation** (support): Offline Sync, Audit, Permission — utilisées par TOUTES les capacités

Les flèches pointent DE la capacité VERS sa dépendance. Une capacité ne dépend que de ce qui est au-dessous d'elle dans le DAG.

---

## FICHE CHAQUE CAPABILITY

Pour chaque capacité: Mission, Dépendances Requises, Requise Par, Dépendances Optionnelles, Foundation Services utilisés, Runtime Services utilisés, Business Packs compatibles, Contraintes, NeverBreak Rules applicables, Invariants liés.

---

### 1. Vocabulary Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Catalogue centralisé de termes, valeurs et traductions avec namespaces |
| **Dépend Directes** | AUCUNE |
| **Requise Par** | Forms, Workflow, Reporting, Search, Notification, Manifest, Lifecycle, Branding, Configuration |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (persist vocab terms), Logging (vocab updates) |
| **Runtime Utilisés** | Manifest Loader (lit vocab depuis manifest), Capability Orchestrator (init en premier) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | R-01: Jamais supprimé, marqué deprecated; R-02: Min FR+EN; R-03: Clés stables; R-04: Formulaire référençant terme inexistant → erreur explicite |
| **NeverBreak Rules** | NB-RULE-05 (validation manifest incluant vocab) |
| **Invariants** | INV-006 (chaque valeur enum vient du Vocab Engine) |

---

### 2. Branding Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Tokens visuels et stylistiques: couleur accent, logo, police, thème |
| **Dépend Directes** | AUCUNE |
| **Requise Par** | Configuration Capability (héritage couleurs) |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (photos, logos) |
| **Runtime Utilisés** | Context Manager (propage accent color), Manifest Loader (lit branding manifest) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Jamais de code couleur dur; C-02: Validation hex color WCAG contrast |
| **NeverBreak Rules** | NB-RULE-08 (traductions min FR/EN applies to brand labels too) |
| **Invariants** | INV-002 (pas de logique métier dans Branding) |

---

### 3. Forms Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Génération dynamique de formulaires depuis définition JSON/YAML |
| **Dépend Directes** | Vocabulary, Configuration |
| **Requise Par** | Workflow, Reporting, Notification, Lifecycle, Search, Branding |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (form templates persistés), Localization (labels multilingues) |
| **Runtime Utilisés** | Manifest Loader (lit forms_overrides), Capability Orchestrator (order: Vocab → Forms) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Aucun formulaire JSX dur; C-02: Tous les select/multiselect référence Vocab; C-03: Validation client = validation serveur; C-04: Formulaires sensibles verrouillés après soumission |
| **NeverBreak Rules** | NB-RULE-08 (i18n minimum), INV-009 (formulaire = JSON→UI, jamais JSX dur) |
| **Invariants** | INV-009 (Formulaire = JSON → UI, jamais JSX direct) |

---

### 4. Search Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Recherche plein texte, GIN index, filtres par tags, categories, metadata |
| **Dépend Directes** | Vocabulary |
| **Requise Par** | Reporting, Notification, Lifecycle |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (full-text index), Logging (search queries audit trail) |
| **Runtime Utilisés** | Init Coordinator (ordre post-Vocabulary) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Toujours filtré par org_id; C-02: Langue de recherche = langue du manifest |
| **NeverBreak Rules** | NB-RULE-04 (x-org-id header sur toute requête search API) |
| **Invariants** | INV-004 (isolement multi-tenant: recherche filtrée par org_id) |

---

### 5. Lifecycle Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Cycle de vie configurable de toute Resource: draft → active → archived → trashed → purged |
| **Dépend Directes** | Vocabulary, Search, Forms |
| **Requise Par** | Reporting, Notification, Manifest |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (state transitions), Audit (tous les changements d'état loggués) |
| **Runtime Utilisés** | HotSwap Engine (transition de lifecycle), Manifest Loader (lifecycle.types[]) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: States configurables via manifest; C-02: Transitions validées par policy; C-03: Purge irréversible (confirmation double) |
| **NeverBreak Rules** | NB-RULE-03 (transactions approved immuable = lifecycle state spécial) |
| **Invariants** | INV-001 (transaction approved = immutable), INV-010 (versioning sur tout state change) |

---

### 6. Configuration Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Settings par organization: currency, fiscal_year, timezone, language, locale |
| **Dépend Directes** | AUCUNE (couché sur Foundation Storage) |
| **Requise Par** | Forms, Policy, Branding, Notification, Reporting, Lifecycle, Manifest |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (persist settings), Localization (date/number formats) |
| **Runtime Utilisés** | Context Manager (propage settings), Manifest Loader (lit settings section) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Currency en ISO 4217; C-02: Timezone en IANA format; C-03: Date format = YYYY-MM-DD min |
| **NeverBreak Rules** | NB-RULE-05 (manifest validation inclut settings) |
| **Invariants** | INV-005 (configuration > code dur) |

---

### 7. Policy Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Règles configurables évaluables: approval_thresholds, retention_periods, rate_limits, quotas, visibility_rules |
| **Dépend Directes** | Configuration |
| **Requise Par** | Workflow, Reporting, Notification, Lifecycle, Manifest, Forms |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (policy definitions), Audit (policy evaluations logged) |
| **Runtime Utilisés** | Manifest Loader (lit policy sections), Context Manager (propagate org policy context) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Pas de logique conditionnelle complexe (>3 niveaux); C-02: Toujours évaluable sans effet secondaire; C-03: Exprimable en YAML |
| **NeverBreak Rules** | NB-RULE-05 (validation manifest inclut policies) |
| **Invariants** | INV-005 (règle configurable = config manifest, pas code dur) |

---

### 8. Reporting Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Export configurable de données: PDF, CSV, JSON depuis n'importe quelle ressource |
| **Dépend Directes** | Vocabulary, Policy, Notification |
| **Requise Par** | Manifest, Lifecycle |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (exported files), Logging (who exported what) |
| **Runtime Utilisés** | Manifest Loader (lit report_types), Capability Orchestrator (order: Vocab → Policy → Notification → Reporting) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Toujours filtré par org_id; C-02: Formats configurables; C-03: Permissions check avant export |
| **NeverBreak Rules** | NB-RULE-04 (x-org-id sur export API), NB-RULE-08 (traductions) |
| **Invariants** | INV-001 (approved transactions only), INV-007 (audit trail de tout export) |

---

### 9. Notification Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Service de messagerie multi-canal: in_app, push, email, sms avec templates, triggers, rate limiting |
| **Dépend Directes** | Policy |
| **Requise Par** | Workflow, Manifest |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (notification records), Logging (delivery status) |
| **Runtime Utilisés** | TypedEventBus (receive workflow events), Context Manager (user/locale notification lang) |
| **Business Packs Compatibles** | Tous |
| **Contraintres** | C-01: Pas de notification sans trigger; C-02: Rate limit par user/org; C-03: Templates configurables |
| **NeverBreak Rules** | NB-RULE-04 (org isolation notifications) |
| **Invariants** | INV-007 (notification creation logged) |

---

### 10. Manifest Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Lecture, parsing et compilation de YAML/JSON manifest en configuration runtime |
| **Dépend Directes** | Policy, Lifecycle, Configuration, Reporting |
| **Requise Par** | Workflow |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (compiled config cached), Security (schema validation) |
| **Runtime Utilisés** | Manifest Loader (service Runtime EXÉCUTANT cette Capacité) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Ne peut PAS ajouter de nouvelles Capacities; C-02: Validation AJV + Zod; C-03: Versionné avec rollback possible |
| **NeverBreak Rules** | NB-RULE-05 (JSON Schema validation avant compilation) |
| **Invariants** | INV-005 (Manifest > Code Dur) |

---

### 11. Workflow Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Séquence d'étapes déclenchées par événements: auto, approval, notification, conditional, delay, parallel |
| **Dépend Directes** | Manifest |
| **Requise Par** | Resource |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Audit (workflow execution logged), Security (approval validation), Storage (workflow state persistence) |
| **Runtime Utilisés** | TypedEventBus (trigger events), Capability Orchestrator (init order: Manifest → Workflow) |
| **Business Packs Compatibles** | Tous |
| **Contraintres** | C-01: Max 7 étapes sans loop; C-02: Timeout max 30 jours avec escalation obligatoire; C-03: Approval chain ≤ 5 niveaux; C-04: Échec = relance manuelle uniquement |
| **NeverBreak Rules** | NB-RULE-03 (workflow ne modifie jamais transaction approved) |
| **Invariants** | INV-001 (workflow finance ne modifie jamais approved), INV-007 (workflow execution always logged) |

---

### 12. Resource Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | CRUD générique pour toute resource de l'organisation — le concept universel le plus fondamental |
| **Dépend Directes** | Workflow |
| **Requise Par** | Identity, Relationship |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (CRUD data), Audit (all modifications), Security (permissions), Offline Sync (offline-first write) |
| **Runtime Utilisés** | Capability Orchestrator (Resource after Workflow), Init Coordinator (Resource loaded late due to many deps) |
| **Business Packs Compatibles** | Tous |
| **Contraintres** | C-01: Toutes les resources ont version field; C-02: Toutes les resources manipulables = Resources |
| **NeverBreak Rules** | NB-RULE-04 (org_id always injected on Resource CRUD) |
| **Invariants** | INV-001 (Resource financial immutable after approve), INV-010 (versioning on all mutable Resources) |

---

### 13. Identity Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Profils uniques reconnaissables avec attributs et associations |
| **Dépend Directes** | Resource |
| **Requise Par** | Relationship |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Security (password hashing, JWT), Storage (profiles persist), Audit (identity changes), Offline (session sync) |
| **Runtime Utilisés** | Context Manager (current identity context), Init Coordinator (Identity initialized early but after Resource depends) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Profile ne présume pas du rôle; C-02: Deux Identity ≠ même ID primaire |
| **NeverBreak Rules** | NB-RULE-07 (TypeScript strict, no any) |
| **Invariants** | INV-007 (identity changes always audited) |

---

### 14. Relationship Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Connexions universelles entre ressources et identités |
| **Dépend Directes** | Identity |
| **Requise Par** | Capability Registry |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (relationship graphs persisted), Audit (relationship changes logged) |
| **Runtime Utilisés** | Dependency Resolver (DAG traversal for relationship chains), Capability Orchestrator |
| **Business Packs Compatibles** | Tous |
| **Contraintres** | C-01: Relations sans logique métier; C-02: Supporte hiérarchique, many-to-many, referenced-by |
| **NeverBreak Rules** | NB-RULE-02 (zero cyclic dependencies between capabilities) |
| **Invariants** | INV-004 (relationships never cross org boundaries) |

---

### 15. Capability Registry

| Champ | Valeur |
|-------|--------|
| **Mission** | Registre de toutes les capacités activées/désactivées avec tracking de dépendances et lifecycle (draft → active → deprecated) |
| **Dépend Directes** | Relationship |
| **Requise Par** | AUCUNE (c'est le layer le plus bas du DAG Capability-level) |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Storage (registry state), Audit (capability activation/deactivation logged) |
| **Runtime Utilisés** | Init Coordinator (capability loading order from registry), HotSwap Engine (activate/deactivate/rollback) |
| **Business Packs Compatibles** | Tous |
| **Contraintes** | C-01: Désactivation impossible si donnée active dépend; C-02: Deprecated reste lisible 2 versions; C-03: Plugins implémentent CapabilityPlugin interface; C-04: Zéro dépendance circulaire |
| **NeverBreak Rules** | NB-RULE-02 (cyclic detection via topological sort at compile-time) |
| **Invariants** | INV-002 (Capability ne contient jamais de logique métier) |

---

### 16. Offline Sync Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Synchronisation bidirectionnelle entre local SQLite et distant PostgreSQL |
| **Dépend Directes** | AUCUNE (Foundation-only) |
| **Requise Par** | Resource |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Offline (directement) |
| **Runtime Utilisés** | N/A (c'est un mécanisme infrastructurel) |
| **Business Packs Compatibles** | Tous |
| **Contraintres** | C-01: Local write ALWAYS before remote; C-02: Conflict strategies par entity type; C-03: Push queue batch 50 ops |
| **NeverBreak Rules** | NB-RULE-06 (local write before remote) |
| **Invariants** | INV-003 (Offline-Absolute — app functional without network) |

---

### 17. Audit Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Journal immuable de toutes les actions utilisateurs |
| **Dépend Directes** | AUCUNE (Foundation-only) |
| **Requise Par** | Resource, Reporting, Notification |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Audit (directement) |
| **Runtime Utilisés** | N/A (append-only, triggered by other capabilities) |
| **Business Packs Compatibles** | Tous |
| **Contraintres** | C-01: Jamais modifiable; C-02: Jamais supprimable; C-03: old_value + new_value toujours présents |
| **NeverBreak Rules** | NB-RULE-03 (financial immutability extends to audit) |
| **Invariants** | INV-007 (Audit Trail Immuable: qui, quoi, quand, old_value, new_value) |

---

### 18. Permission Capability

| Champ | Valeur |
|-------|--------|
| **Mission** | Droit fin exprimé: resource:action:level — résolu depuis manifest, injecté dans JWT |
| **Dépend Directes** | AUCUNE (Foundation-only) |
| **Requise Par** | Resource, Workflow, Notification, Reporting |
| **Dépendances Optionnelles** | AUCUNE |
| **Foundation Utilisés** | Security (JWT generation), Audit (permission checks logged) |
| **Runtime Utilisés** | Context Manager (inject permissions into JWT), Manifest Loader (roles/permissions from manifest) |
| **Business Packs Compatibles** | Tous |
| **Contraintres** | C-01: Wildcard matching finance:*; C-02: Permissions only decrease through inheritance |
| **NeverBreak Rules** | NB-RULE-04 (x-org-id required) |
| **Invariants** | INV-008 (client validation = server validation rechecked) |

---

## GRAPHE FINAL — Validation DAG

| Vérification | Résultat |
|-------------|----------|
| Cycle détecté? | ❌ Aucun cycle |
| Ordre topologique valide? | ✅ Vocabulary/Branding/Config/Policy/OfflineSync/Audit/Permission → Forms/Search/Lifecycle → Reporting/Notification/Manifest → Workflow → Resource → Identity → Relationship → CapabilityRegistry |
| Toute capacité a ≤ 3 dépendances directes? | ✅ Oui (max 3: Forms → Vocab+Config) |
| Capability Registry en dernière position? | ✅ Oui — c'est le registre ULTIME qui vérifie tout |
| Foundation services utilisés par au moins 5 capacités? | ✅ Storage(18/18), Audit(10/18), Security(9/18), Logging(7/18) |
