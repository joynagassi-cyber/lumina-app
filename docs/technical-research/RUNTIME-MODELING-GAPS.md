# Analyse Complète — Éléments à Modéliser en Runtime (Avant Codage)

> **Date:** 2026-07-24  
> **Objectif:** Identifier TOUT ce qui doit être configuré/déclaratif dans Lumina avant d'écrire une seule ligne de code  
> **Base:** PRD + Architecture Map + ADRs + Database Schema + Org Graph Spec + Business Rules + Invariants + NeverBreak

---

## Méthodologie d'Analyse

Pour chaque aspect du système, je pose 3 questions:
1. **Ce qui était codé en dur dans l'ancienne approche** (Flutter/classique)
2. **Ce qui DOIT devenir déclaratif/runtime**
3. **Quelle capability de la Platform le gère**

---

## A. ÉLÉMENTS FINANCIERS (Cœur Critique)

### A.1 Catégories Financières (Déjà Partiellement Couvert)

| Aspect | Hardcoded Avt | Declarative Maintenant | Moteur |
|--------|---------------|----------------------|--------|
| Type de catégorie (income/expense/asset/liability/equity) | Enum TS dur | `category_type` dans YAML | Vocabulary + Forms Engine |
| Nom multilingue | string dur | `label` + `label_en` dans vocab.yaml | Vocabulary Engine |
| Couleur par catégorie | HEX dur | `color` dans vocab.yaml | Forms Engine (render) |
| Immuabilité | boolean dur | `is_immutable` dans manifest | Manifest Engine (CHECK) |
| Hiérarchie parent/enfant | self-FK table | `parent_category_id` résolu via manifest | Manifest Engine (dept resolver) |

**GAP DÉTECTÉ:** Le schéma DB a `parent_category_id` mais aucune règle declarative ne définit la hiérarchie des catégories (ex: income → dîmes, offrandes). C'est DU CODE DUR qui doit devenir UN YAML.

---

### A.2 Scopes de Transaction (DÉJÀ ANALYSÉ dans ADR-017)

Déjà couvert: `scope_type: 'org' | 'group'` + `scope_target` + consolidation rules dans manifest.

---

### A.3 Règles Métier Financières (BR-FIN-XXX)

| Règle Metier | Statut Actuel | Besoin Runtime? | Moteur |
|---|---|---|---|
| BR-FIN-001: type obligatoire | Dans DB CHECK constraint | ✅ Partie du form schema | Forms Engine |
| BR-FIN-002: montant > 0 | Dans DB CHECK constraint | ✅ Min:0 dans form | Forms Engine |
| BR-FIN-003: date pas dans futur | Dans DB CHECK constraint | ✅ default:"today" | Forms Engine |
| BR-FIN-004: catégorie dans vocab |硬编码 dans app.js | ✅ `options.source: "vocab:..."` | Forms Engine + Vocab |
| BR-FIN-005: description min 1 car si montant > 100 |硬代码 conditional validation | ✅ `conditional_required` dans YAML | Forms Engine |
| BR-FIN-010: auto-approve sous seuil |硬code threshold = 500 | ✅ `settings.max_auto_approve` dans manifest | Workflow Engine |
| BR-FIN-011: double approbation seuil large |硬code thresholds | ✅ `approval_thresholds` dans manifest | Workflow Engine |
| BR-FIN-012: rejet retour draft |硬code state machine | ✅ `transitions` dans workflow states | Workflow Engine |
| BR-FIN-013: commentaire obligatoire rejet |硬code validation | ✅ condition dans form | Forms Engine |
| BR-FIN-020: bilan équilibre | hardcode formula | ✅ config report | Forms Engine |
| BR-FIN-021: rapport mensuel complet | hardcode logic | ✅ config report | Forms Engine |
| BR-FIN-022: export PDF signature numérique | hardcode template | ✅ export settings in manifest | Capability Engine |
| BR-FIN-023: rapport archivé non modifiable |硬code guard | ✅ read_only=true dans form | Forms Engine |
| BR-FIN-030: log modification old/new_value |硬code audit | ✅ audit trail auto (INV-007) | Capability Engine |
| BR-FIN-031: logs conservés 7 ans |硬code retention | ✅ policy settings | Manifest Engine |
| BR-FIN-032: impossible effacer log |硬code constraint | ✅ DELETE blocked by RLS | Capability Engine |
| BR-FIN-033: logs restreint admins/auditeurs |硬code permission check | ✅ RBAC permissions | Manifest Engine |

**GAP MAJEUR DÉTECTÉ:** Toutes ces règles sont documentées dans `docs/04-business-rules/financial-rules.md` MAIS AUCUNE n'est encore traduite en configuration manifest. Chaque règle doit devenir un item du YAML.

---

### A.4 Types de Rapports Financiers (Bilan, Rapport Mensuel, etc.)

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Template Bilan (actif/passif/résultat) |硬code dans calculatrice.ts | ✅ `report_types` dans manifest |
| Template Rapport Mensuel |硬code | ✅ `report_types` |
| Template Rapport Annuel |硬code | ✅ |
| Export PDF format |硬code template | ✅ `export.pdf` dans manifest |
| Export CSV format |硬code delimiter | ✅ `export.csv` dans manifest |
| Champs de filtre par défaut |硬code | ✅ `report_types[].filters` |
| Périodes prédéfinies (mois, trimestre, année) |硬code | ✅ `report_types[].period_options` |

---

## B. SYSTÈME D'AUTHENTIFICATION ET SÉCURITÉ

### B.1 Auth Flow (Déjà Bien Couvert)

| Aspect | Statut | Besoin Runtime? |
|--------|--------|-----------------|
| Login/password auth |硬code dans login-screen.tsx | ✅ Peut rester dur (c'est du core, pas métier) |
| JWT rotation |硬code buffer 5min | ✅ Configurable: `auth.session_buffer_minutes` |
| Session persistée 30 jours |硬code | ✅ Configurable: `auth.session_duration_days` |
| Last org active restaurée |硬code logic | ✅ Runtime: `AppContext.restoreLastOrg()` |
| Multi-org selector overlay |硬code UI | ✅ Peut rester dur (c'est du core navigation) |
| Password forgot flow |硬code écran | ✅ Configurable: `auth.enable_password_reset: true/false` |
| MFA (future V2) | Pas implémenté | ✅ Feature flag pour future activation |

**GAP:** `auth` section manque dans le manifest template. Pas de configuration runtime des paramètres d'authentification.

---

### B.2 Permissions et Rôles (Déjà Couvert RBAC)

Déjà analysé dans RBAC research. Les rôles, permissions et scope sont dans manifest.yaml.

**GAP SUBTILE:** `org_members` table existe mais la relation entre user_id et roles est hardcodée dans ADR-009. Il faut un mécanisme de mapping `user → org_members → role` qui soit résoluble au runtime.

---

## C. ORGANISATION GRAPHE (DAG)

### C.1 Hiérarchie des Organisations (Déjà Bien Spécifié)

Déjà couvert: `organizations.parent_org_id` récursif, héritage configuratif, create/transfer/archive/merge/delete.

**GAPS DÉTECTÉS:**

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Type générique d'org (`root`, `union`, `network`, `region`, `district`, `org`) | Enum TS dur | ✅ Résolu depuis manifest: `organization.type` |
| Status lifecycle (`active`, `pending`, `archived`, `deleted`, `merged`) |硬code state machine | ✅ Configurable: `organization.status_transitions` |
| Configuration d'héritage (`inherits_vocab`, `inherits_forms`, etc.) |硬code dans ADR-014 | ✅ `organization.inherits.<key>: true/false` |
| Merge strategy |硬code | ✅ `organization.merge_policy` dans manifest |
| Audit trail pour transfers/merges |硬code | ✅ Automatic via INV-007 (toujours actif) |

---

### C.2 Unités Organisationnelles (Groupes/Départements/Sous-groupes)

Déjà partiellement couvert (`org_units` table + `has_financial_scope`).

**GAPS:**

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| `unit_type` (ministry, department, committee, sub_group) | Enum TS dur | ✅ `available_types` dans manifest |
| Règle `requires_leader` par unit type |硬code | ✅ Par type dans manifest |
| Règle `allows_sub_units` par unit type |硬code | ✅ Par type dans manifest |
| Règle `requires_budget` par unit type |硬code | ✅ Par type dans manifest |
| Relation membre ↔ unité (multi-appartenance) |硬code many-to-many | ✅ `group_memberships` avec resolve runtime |
| Member count automatique |硬code computation | ✅ Computed column resolved by runtime |
| Permission par unit_type |硬code | ✅ Resolved via capability engine |

---

### C.3 Group Memberships (Multi-Appartenance)

Déjà specifié dans ADR-014 mais gap d'implémentation declarative:

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| table `group_memberships` |硬code | ✅ Peut rester dur (infrastructure) |
| Règles d'attribution (BR-MEM-021: validé par responsable) |硬code workflow | ✅ Workflow engine `member_admission` |
| Historique des attributions (BR-MEM-022) |硬code logs | ✅ Audit trail auto (INV-007) |
| Attributs supplémentaires membership (date_join, notes) |硬code model | ✅ `membership_extra_fields` dans manifest |
| Statut membership (active, inactive, transferred, deceased) |硬code enum | ✅ `memberships.status_values` dans manifest |

---

## D. FORMULAIRES DYNAMIQUES

### D.1 Templates de Formulaires (Déjà Couvert)

Déjà analysé: formulaire transaction, admission membre, bilan report.

**GAPS:**

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Formulaire configuration org (setup wizard) |硬code onboarding screens | ✅ `forms_overrides[onboarding_wizard]` |
| Formulaire gestion rôle/permissions (KR8) |硬code settings | ✅ `forms_overrides[role_config]` |
| Formulaire import CSV members |硬code screen | ✅ `forms_overrides[csv_import]` |
| Formulaire export données |硬code button | ✅ `forms_overrides[data_export]` |
| Formulaire notification preferences |硬code settings | ✅ `forms_overrides[notification_prefs]` |
| Validation personnalisée par champ |硬code regex | ✅ `fields[].pattern` dans form YAML |
| Conditional fields (visible si...) |硬code logic | ✅ `visible_if` dans form YAML |
| Required field rules |硬code | ✅ `required` dans form YAML |

---

### D.2 Vocabulaire / Term Registry (Déjà Couvert)

Déjà bien specifié. Glossary namespaces dans vocabulary engine.

**GAP:** Ajouter `terms` pour les status (active/inactive/deceased/transferred pour membres), les unités monétaires (CDF, USD, EUR...), lesfuseaux horaires, les langues supportées.

---

## E. WORKFLOWS

### E.1 Workflows Existant (Déjà Couverts)

- Approbation transaction financière ✅
- Admission membre (BR-MEM-021) ✅

### E.2 Workflows Manquants

| Workflow | Besoin Manifest? | Priorité |
|----------|-----------------|----------|
| **Workflow création org enfant** (parent → child) | ✅ `org:create_child` | K1 |
| **Workflow transfer org** (changer parent) | ✅ `org:transfer` | K2 |
| **Workflow archive org** | ✅ `org:archive` | K3 |
| **Workflow merge org** | ✅ `org:merge` | K3 |
| **Workflow delete member** (soft delete) | ✅ `members:delete` | K2 |
| **Workflow transfer member** (org A → org B) | ✅ `members:transfer` | K3 |
| **Workflow notification send** | ✅ `notifications:send` | K3 |
| **Workflow data export** | ✅ `data:export` | K3 |
| **Workflow import CSV** | ✅ `data:import` | K3 |
| **Workflow recurrence event creation** | ✅ `events:recurrent_create` | K2 |

Chaque workflow doit être déclaré dans `workflow_overrides` du manifest.

---

## F. NOTIFICATIONS

### F.1 Notification System (Feature 9 - K3)

Déjà listée comme feature à déclarer dans manifest.

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Trigger: transaction approved |硬code | ✅ `notifications.triggers[]` dans manifest |
| Template message push |硬code text | ✅ `notifications.templates[].body` |
| Channels: push, email, in-app |硬code config | ✅ `notifications.channels[]` |
| Subscription preferences user |硬code settings | ✅ `notifications.user_preferences` form |
| Frequency limit (anti-spam) |硬code | ✅ `notifications.rate_limit: "max_per_hour"` |
| Quiet hours (ne pas notifier la nuit) |硬code | ✅ `notifications.quiet_hours_start/end` |

---

## G. EXPORT / IMPORT DONNÉES (Feature 10 - K3)

### G.1 Data Migration & Backup

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Export format (PDF, CSV, JSON) |硬code choices | ✅ `export.formats[]` dans manifest |
| Export filters (par période, type, statut) |硬code | ✅ `export.filters[]` |
| Import source (CSV columns mapping) |硬code | ✅ `import.source_schema` + `import.column_mappings` |
| Import validation rules |硬code | ✅ `import.validation` |
| Import conflict resolution |硬code | ✅ `import.conflict_strategy: "skip"|"overwrite"|"merge"` |
| Backup schedule (future) |硬code | ✅ `backup.schedule` dans manifest |

---

## H. CONFIGURATION ORGANISATION SETUP

### H.1 Onboarding Wizard (Création Org)

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Étape 1: Type d'organisation |硬code switch | ✅ `onboarding.steps[0].org_type_selector` |
| Étape 2: Couleurs (accent picker) |硬code palette | ✅ `onboarding.steps[1].color_picker` presets from ORG_PRESETS |
| Étape 3: Info entry (nom, pays, langue, devise) |硬code form | ✅ `onboarding.steps[2].info_form` |
| Étape 4: Feature toggle selection |硬code checkboxes | ✅ `onboarding.steps[3].feature_toggles` |
| Étape 5: Review + Done |硬code summary | ✅ `onboarding.steps[4].manifest_preview` |
| Progress bar (N/5 étapes) |硬code counter | ✅ `onboarding.total_steps: 5` |
| Skip option ("Configurer plus tard") |硬code everywhere | ✅ `onboarding.allow_skip: true` |

**GAP MAJEUR:** L'onboarding est le SEUL écras hardcodé critique. L'utilisateur ne peut PAS le configurer — c'est un flux fixe. Il DOIT devenir declaratif.

---

## I. NAVIGATION & ROUTING

### I.1 Bottom Navigation (Déjà Bien Specifié)

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| 5 tabs fixes + FAB |硬code dans _layout.tsx | ✅ `navigation.bottom_tabs[]` dans manifest |
| Tab order |硬code | ✅ Peut être configuré: `navigation.tab_order: ["dashboard","finance","members","events","settings"]` |
| Deep linking pattern |硬code | ✅ `navigation.deep_linking.base_path` |
| Swipe back natif |硬code RN setting | ✅ Peut rester dur (c'est un paramètre global) |
| Hidden tabs par permission |硬code filter | ✅ `navigation.tabs[].required_permissions[]` |

---

## J. PARAMÈTRES GLOBAUX DE L'ORGANISATION

### J.1 Settings Organisation (Déjà Partiellement Couvert)

| Setting | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Currency |硬code ('CDF' default) | ✅ `settings.currency` dans manifest |
| Fiscal year start |硬code (en-tête manquant) | ✅ `settings.fiscal_year_start: "01-01"` |
| Language (FR/EN/...) |硬code | ✅ `settings.language` + `settings.languages_supported[]` |
| Timezone |硬code | ✅ `settings.timezone` |
| Logo URL |硬code | ✅ `settings.org_logo_url` |
| Accent color hex |硬code preset | ✅ `settings.accent_hex` (calculé variant light/dark) |
| Display name short |硬code | ✅ `settings.org_short_name` |

---

## K. AUDIT TRAIL & COMPLIANCE

### K.1 Audit Logging (INV-007 + BR-FIN-030/031/032/033)

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Qui/quand/quoi (audit trail) |硬code | ✅ INV-007 toujours actif (core immuable) |
| old_value + new_value |硬code | ✅ Core feature automatique |
| Conservation 7 ans |硬code | ✅ `audit.retention_years: 7` dans manifest |
| Impossible supprimer log |硬code RLS | ✅ Core feature (jamais modifiable) |
| Accès restreint admins/auditeurs |硬code | ✅ RBAC permissions |
| Logs de changement manifest |硬code | ✅ `audit.log_manifest_changes: true` |

---

## L. MULTI-LANGUE / I18N

### L.1 Traductions (NB-RULE-08)

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| FR + EN minimum |硬code strings | ✅ `i18n.supported_languages` dans manifest |
| Terminologie spécifique (dîme, offrande...) |硬code | ✅ Resolve via Vocabulary Engine |
| Labels de formulaires |硬code | ✅ I18n keys dans forms YAML (automatique) |
| Messages d'erreur |硬code | ✅ i18n `errors.*` dans manifest |
| Format date/heure |硬code (YYYY-MM-DD) | ✅ `i18n.date_format`, `i18n.time_format` |
| Format nombre (virgule vs point décimal) |硬code | ✅ `i18n.number_format` |
| Format devise (symbole, position) |硬code | ✅ `i18n.currency_symbol_position` |

---

## M. SYSTÈME DE PERFORMANCES ET PERCEPTION

### M.1 Feedback Utilisateur

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Skeleton loading (vs spinner) |硬code pattern | ✅ `performance.show_skeleton_loading: true` |
| Optimistic updates |硬code | ✅ `performance.optimistic_updates: true` |
| Pull to refresh |硬code | ✅ Peut rester dur |
| Animation durations |hardcoded | ✅ `animations.duration_default_ms` |
| Count-up animation nombres |hardcoded | ✅ `animations.count_up_enabled: true` |

---

## N. INTÉGRATION INSFORGE / SERVER

### N.1 Edge Functions Contract

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| validate-transaction |硬code file | ✅ Peut rester dur (core infra) |
| calculate-bilan |硬code file | ✅ Peut rester dur (core infra) |
| send-notification |硬code file | ✅ Paramétrable: `notifications.template` |
| sync-pending |硬code webhook | ✅ Peut rester dur |
| generate-report |hardcode | ✅ Template configurable |

---

## RÈGLEMENT

### O.1 Customization Par Type d'Organisation

| Élément | Statut | Besoin Runtime? |
|---------|--------|-----------------|
| Presets couleurs |hardcode ORG_PRESETS constant | ✅ `presets.colors[]` dans manifest |
| Presets rôles |hardcode | ✅ `presets.roles` copié depuis template |
| Presets features |hardcode | ✅ `presets.features` copié depuis template |
| Presets departments |hardcode | ✅ `presets.departments` copié depuis template |
| Presets workflows |hardcode | ✅ `presets.workflows` copié depuis template |
| Presets forms |hardcode | ✅ `presets.forms` copié depuis template |

---

## RÉCAPITULATIF DES GAPS DÉTECTÉS (PRIORISÉS)

### CRITIQUE — Doit être fait AVANT tout codage

| # | Gap | Impact | Moteur concerné | Effort estimé |
|---|-----|--------|-----------------|---------------|
| **G-01** | **Règles métier financières (BR-FIN-xxx) pas declaratives** | Bilan calcule mal si règles pas dans manifest | Forms + Workflow + Manifest | 1-2 jours |
| **G-02** | **Hiérarchie catégories financières pas configurée** | Catégories flat au lieu de tree | Vocabulary Engine | 0.5 jour |
| **G-03** | **Workflows manquants (10+ non déclarés)** | Transfert, merge, archive, delete membres non modélisés | Workflow Engine | 3-5 jours |
| **G-04** | **Onboarding Wizard non declaratif** | Flux fixe — impossible personnaliser par org | Forms Engine | 1-2 jours |
| **G-05** | **Settings organisation pas tous dans manifest** | Currency, fiscal_year, timezone, logo en dur | Manifest Engine | 0.5 jour |
| **G-06** | **Unit types (ministry/department/committee) pas configurables** | Hardcoded enum dans TS | Manifest Engine | 0.5 jour |
| **G-07** | **Notification system pas declaratif** | Templates, triggers, channels hardcodés | Capability Engine | 2-3 jours |
| **G-08** | **Export/Import formats pas configuables** | Formats hardcodés | Capability Engine | 1-2 jours |
| **G-09** | **Navigation tabs pas configurables** | 5 tabs fixes hardcodées | Manifest Engine | 0.5 jour |
| **G-10** | **i18n settings pas dans manifest** | Date/number/currency format hardcodés | Vocabulary Engine | 0.5 jour |

### IMPORTANT — À faire AU PLUS TARD au début Sprint 1

| # | Gap | Impact | Moteur concerné | Effort estimé |
|---|-----|--------|-----------------|---------------|
| **G-11** | Membership extra fields non configurables | Schéma rigide | Forms Engine | 1 jour |
| **G-12** | Report templates non dans manifest | Bilan/rapport hardcodés | Forms Engine | 2 jours |
| **G-13** | Status transitions org (active↔archived) non configurables | State machine rigide | Manifest Engine | 1 jour |
| **G-14** | Org merge policy non declarative | Fusion hardcodée | Manifest Engine | 1 jour |
| **G-15** | Audit retention period hardcodé | Compliance non configurable | Capability Engine | 0.5 jour |

---

## PRIORITÉ D'INTERRUPTION: QQUOI MODÉLISER EN PREMIER?

Dans l'ordre logique (dépendances):

```
PHASE 0 — Infrastructure Manifest (Semaine 0)
  ├── G-06: Unit Types               ← base pour tout le reste
  ├── G-05: Organization Settings    ← base pour thème, devise, langue
  └── G-10: i18n Settings           ← base pour formats

PHASE 1 — Finance Runtime (Semaines 1-2)
  ├── G-02: Category Hierarchy       ← nécessaire pour forms
  ├── G-01: Financial Business Rules ← necessaire pour transactions
  └── G-12: Report Templates        ← nécessite rules + categories

PHASE 2 — Organisation Runtime (Semaines 2-3)
  ├── G-04: Onboarding Wizard        ← premier écran de l'app
  ├── G-11: Membership Extra Fields  ← nécessaire pour gestion membres
  ├── G-13: Org Status Transitions   ← nécessaire pour management org
  └── G-14: Org Merge Policy         ← nécessaire pour multi-org

PHASE 3 — Workflows Runtime (Semaines 3-4)
  ├── G-03: All Missing Workflows    ← transfert, archive, merge, delete
  └── G-01 continued: Approval Rules ← partie approval du workflow

PHASE 4 — Features Complémentaires (Semaines 4-5)
  ├── G-07: Notification System      ← templates, triggers, channels
  ├── G-08: Export/Import System     ← formats, mappings, conflicts
  ├── G-09: Navigation Tabs          ← ordre, permissions par tab
  └── G-15: Audit Retention          ← configurable
```

---

*Analyse Runtime Modeling Gaps — 2026-07-24 — Lumina v2*
