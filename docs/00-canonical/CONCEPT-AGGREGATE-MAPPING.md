# Concept → Aggregate Mapping — Cartographie Officielle

**Doc ID:** DOC-006 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** SOURCE DE VÉRITÉ ABSOLUE  
**Date:** 2026-07-24  

---

## NOTE PRÉLIMINAIRE

Cette map relie chaque **Concept** du Conceptual Model v1 à sa structure DDD interne: Aggregate principal, Entities, Value Objects, Policies, Capacities utilisées, Runtime Services sollicités et Persistance cible.

**AUCUNE table SQL n'est définie ici.** Ce document prépare la modélisation. Il ne la remplace pas.

Une règle fondamentale: le Domain Model n'invente JAMAIS de nouveaux Concepts. Il instancie uniquement les Concepts existants.

---

## Mapping 1: Organization

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | OrganizationAggregate | Point d'entrée unique pour toute opération Organization |
| **Entities** | Organization, OrgUnit | Organisation racine + unités hiérarchiques sous-jacentes |
| **Value Objects** | OrganizationName, OrganizationCode, OrganizationType, OrganizationSettings, OrganizationBranding | Nom textuel, code unique, type enum, paramètres, tokens visuels |
| **Policies** | VisibilityPolicy, HierarchyPolicy, MaxDepthPolicy | Visibilité par org, DAG hierarchy, profondeur max 5 |
| **Capabilities** | Identity, Relationship, Branding, Configuration | Profil unique, structure hiérarchique, tokens visuels, settings |
| **Runtime Services** | Manifest Loader, Context Manager, Dependency Resolver | Charge manifest org, propage orgId en contexte, résout DAG capacités |
| **Persistance** | organizations table, org_units table | Structure + hiérarchie stockées séparément |

---

## Mapping 2: Identity

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | IdentityAggregate | Point d'entrée unique pour Identity |
| **Entities** | User | Profil utilisateur avec attributs (nom, email, téléphone) |
| **Value Objects** | EmailAddress, PhoneNumber, UserProfilePhotoUrl, UserCredentials | Address, phone, photo, password hash |
| **Policies** | UniquenessPolicy, PasswordPolicy | Email unique par org, hash sécurité |
| **Capabilities** | Identity, Permission, Audit, Security | Profile unique, droits fins, logging actions, auth |
| **Runtime Services** | Context Manager (current user), Capability Orchestrator (activation security) | Propage userId en contexte, active security capability |
| **Persistence** | users table, user_sessions table | Profils + sessions séparées |

---

## Mapping 3: Resource (Universal)

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | ResourceAggregate | Point d'entrée générique CRUD pour TOUTE ressource |
| **Entities** | Transaction, Member, Event, ArchiveEntry, NotificationRecord | Tous les objets manipulables sont des Resources |
| **Value Objects** | ResourceId, ResourceType, ResourceState, ResourceMetadata | UUID identifiant, type string, état enum, metadata JSONB |
| **Policies** | LifecyclePolicy, VisibilityPolicy, RetentionPolicy | States configurables, visibilité par org, retention configurable |
| **Capabilities** | Resource, Lifecycle, Policy, Search, Audit, Reporting | CRUD générique, cycle de vie, règles, recherche, logging, export |
| **Runtime Services** | Manifest Loader (lit resource config), HotSwap Engine (lifecycle transitions) | Active resource capability, transition states via hot-swap |
| **Persistence** | transactions, members, events, archive_entries, notifications | Chacune dans sa table |

---

## Mapping 4: Relationship

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | RelationshipAggregate | Gestion de connexions universelles |
| **Entities** | GroupMembership, OrgUnitChildRelation, MemberOrgUnitBinding | Connexions entre entités |
| **Value Objects** | RelationshipType (belongs_to, has_many, many_to_many, hierarchical, referenced_by), SourceResourceId, TargetResourceId, JoinTimestamp | Type, ID source, ID target, date création |
| **Policies** | DagPolicy (no cycles), MaxDepthPolicy (depth ≤ 5), MultiMembershipPolicy (allowed/forbidden by type) | Validation structurelle |
| **Capabilities** | Relationship, Policy, Workflow | Connexions universelles, validation règles, workflows de relation |
| **Runtime Services** | Dependency Resolver (DAG traversal for hierarchies), TypedEventBus (relation change events) | Traverse org_units graph, emits events on relation changes |
| **Persistence** | group_memberships, org_units(parent_unit_id self-ref) | Relations explicites + hiérarchie implicite (parent FK) |

---

## Mapping 5: Activity

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | ActivityAggregate | Enregistrement d'événements temporels modifiant le state |
| **Entities** | WorkflowInstance, ApprovalAction, StatusTransition, CreatedResourceEvent, DeletedResourceEvent | Séquence d'étapes événementielles |
| **Value Objects** | ActivityType (create, update, delete, approve, reject, transfer, notify), ActivityTimestamp, ActivityPayload | Type, timestamp, données accompagnant l'action |
| **Policies** | ImmutabilityPolicy (activity never modified), AuditTrailPolicy (all activities logged with old/new values) | INV-001 + INV-007 |
| **Capabilities** | Workflow, Audit, Notification | Séquences d'étapes, logging immuable, notifications post-activity |
| **Runtime Services** | TypedEventBus (activity event routing), Capability Orchestrator (activate workflow + audit together) | Route activity events to correct handlers |
| **Persistence** | audit_logs table, pending_operations (for unsynced activities) | Audit trail + sync queue |

---

## Mapping 6: Form

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | FormAggregate | Génération de formulaires dynamiques depuis définition JSON/YAML |
| **Entities** | FormDefinition, FormField, FormSection | Définition structurée |
| **Value Objects** | FieldType (text, number, date, select, multiselect, file_upload, signature), FieldConfig (required, pattern, min, max), ConditionalVisibility (visible_if, hidden_if, visible_if_all_of, visible_if_any_of) | Types de champs, configuration, visibilité conditionnelle |
| **Policies** | ValidationPolicy (client = server validation), ConditionalVisibilityPolicy | Règles validation + logique conditionnelle |
| **Capabilities** | Forms, Vocabulary, Policy, Configuration | Rendu dynamique, labels depuis vocabulaire, validation rules, settings |
| **Runtime Services** | Manifest Loader (lit forms_overrides), Forms Executor (runtime rendering) | Load form definitions, render forms at runtime |
| **Persistence** | N/A (forms are templates, not stored data; form SUBMISSIONS create Domain Objects) | Forms themselves → org_settings.jsonb; submissions → respective entity tables |

---

## Mapping 7: Workflow

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | WorkflowAggregate | Orchestration d'étapes déclenchées par événements |
| **Entities** | WorkflowDefinition, WorkflowStep, WorkflowInstance | Définitions + exécutions |
| **Value Objects** | StepType (auto, approval, notification, conditional, delay, parallel), TriggerEvent, TimeoutDuration, AssignmentRole | Types d'étapes, triggers, timeouts, rôles assignés |
| **Policies** | MaxStepsPolicy (≤7 sans loop), TimeoutEscalationPolicy (max 30 days), ApprovalChainPolicy (≤5 niveaux), NoFinancialModificationPolicy (workflows ne modifient jamais finances approuvées) | Contraintes strictes |
| **Capabilities** | Workflow, Notification, Policy, Audit | Orchestration, alerts, règles, logging |
| **Runtime Services** | Workflow Executor (step execution), TypedEventBus (trigger events), Capability Orchestrator (sequential activation) | Execute steps sequentially, route events between capabilities |
| **Persistence** | N/A (workflow definitions stored in manifest; instances in pending_operations for tracking) | Definitions → manifest; instances → pending_operations (tracking) + audit_logs |

---

## Mapping 8: Vocabulary

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | VocabularyAggregate | Catalogue centralisé de termes, valeurs et traductions |
| **Entities** | Namespace, Term, TermValue | Organisations logiques |
| **Value Objects** | NamespaceKey, TermKey, Translation (key→label mapping, deprecated flag), LabelFr, LabelEn | Clés, traductions, états de dépréciation |
| **Policies** | DeprecationPolicy (terms never deleted, marked deprecated), TranslationPolicy (min FR+EN), StabilityPolicy (keys never change) | Dépréciation douce, traduction minimale, stabilité des clés |
| **Capabilities** | Vocabulary | Autonomie totale |
| **Runtime Services** | Vocabulary Executor (term resolution at runtime), Manifest Loader (lit vocabulary from manifest) | Resolve term labels at runtime |
| **Persistence** | categories table (partial — only financial vocab); future: dedicated vocabulary_terms table for all namespaces | Categories store only finance-related terms currently |

---

## Mapping 9: Notification

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | NotificationAggregate | Service de messagerie multi-canal |
| **Entities** | NotificationTemplate, NotificationRecord | Templates + envois |
| **Value Objects** | Channel (in_app, push, email, sms), Severity (info, warning, critical), TemplateBody, DataPayload | Canaux, niveaux d'urgence, contenu |
| **Policies** | RateLimitPolicy (anti-spam per user), ChannelPreferencePolicy (user preferences respected), QuietHoursPolicy | Anti-spam, préférences utilisateur |
| **Capabilities** | Notification, Policy, Workflow | Messagerie multi-canal, règles configurables, triggers workflow |
| **Runtime Services** | Capability Orchestrator (notification after workflow step), TypedEventBus (trigger from workflow completion) | Activate notification capability, receive workflow completion events |
| **Persistence** | notifications table | All sent notifications stored |

---

## Mapping 10: Audit

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | AuditAggregate | Journal immuable de toutes les actions utilisateurs |
| **Entities** | AuditLogEntry | Une entrée par action utilisateur |
| **Value Objects** | ActionType, OldValues (JSONB), NewValues (JSONB), UserId, EntityId, IpAddress | Action, avant/après, user, entity, IP |
| **Policies** | ImmutabilityPolicy (never modify/delete), RetentionPolicy (configurable years), AccessRestrictionPolicy (admin/auditor only) | Immutable, configurable retention, restricted access |
| **Capabilities** | Audit | Autonomie totale |
| **Runtime Services** | Init Coordinator (audit always initialized first in Foundation phase) | Audit is a Foundation dependency — always ready |
| **Persistence** | audit_logs table | Dedicated immutable table |

---

## Mapping 11: Branding

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | BrandingAggregate | Tokens visuels et stylistiques |
| **Entities** | BrandingProfile | Profile d'identité visuelle |
| **Value Objects** | AccentColor (hex), PrimaryColor, SecondaryColor, LogoUrl, FontFamily, SpacingTokens, TypographyScale, DarkCanvasPalette | Couleurs, polices, espacements, typographie |
| **Policies** | ContrastPolicy (WCAG minimum ratio), SingleAccentPolicy (one accent color per org) | Accessibilité, contraintes de design |
| **Capabilities** | Branding | Autonomie totale |
| **Runtime Services** | Context Manager (propagate accent color), App Composer (inject branding into UI) | Set current org branding context |
| **Persistence** | organizations.settings (accent_hex, logo_url) | Stored as JSONB in organization row |

---

## Mapping 12: Permission

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | PermissionAggregate | Droits fins exprimés resource:action:level |
| **Entities** | PermissionGrant, RoleAssignment | Droits attribués aux rôles |
| **Value Objects** | PermissionString ("finance:ledger:read"), RoleHierarchy (superadmin > admin > treasurer > pastor > staff), WildcardMatch ("finance:*" matches all finance perms) | Permissions textuelles, hiérarchie, wildcard matching |
| **Policies** | InheritancePolicy (child inherits parent permissions), WildcardPolicy (wildcards audited but allowed), NeverReducePolicy (permissions never decrease through inheritance) | Héritage, wildcard audit, non-réduction |
| **Capabilities** | Permission, Policy | Droits fins + évaluation règles |
| **Runtime Services** | Manifest Loader (roles/permissions from manifest), Context Manager (inject into JWT), Authorization Edge Function (server-side gate) | Load roles, inject into JWT, enforce at API level |
| **Persistence** | users.role column, org_members relation (future) | Current MVP: role stored directly on users table |

---

## Mapping 13: Manifest

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | ManifestAggregate | Interprétation de configuration YAML/JSON par organisation |
| **Entities** | CompiledManifestConfig | Configuration compilée prête pour runtime |
| **Value Objects** | Version, OrganizationInfo, FeatureRegistry, RoleGraph, DepartmentTree, WorkflowOverrides, FormsOverrides, Settings | Structure de configuration |
| **Policies** | NoNewCapabilitiesPolicy (manifest ne peut PAS ajouter de nouvelles Capacities), SchemaValidationPolicy (AJV + Zod double validation), CycleDetectionPolicy (roles graph must be DAG) | Restraints fondamentaux |
| **Capabilities** | Manifest | Autonomie totale (mais dépend de toutes les autres pour VALIDATION) |
| **Runtime Services** | Manifest Loader (parsing/compilation), Dependency Resolver (cross-reference resolution with Kahn's algorithm) | Core runtime service for manifest |
| **Persistence** | organizations.manifest_json | Compiled config cached in organization row |

---

## Mapping 14: Lifecycle

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | LifecycleAggregate | States configurables pour toute resource |
| **Entities** | LifecycleStateDefinition, StateTransitionRule, LifecycleInstance | States et transitions |
| **Value Objects** | StateEnum (draft, active, archived, trashed, purged), TransitionTrigger, PurgeRetentionDays | Enums, triggers, durées |
| **Policies** | ArchiveRetentionPolicy (trashed → purge configurable), SoftDeletePolicy (trash date tracked separately), IrreversiblePurgePolicy (purge is final) | Rétention, soft delete, purge irréversible |
| **Capabilities** | Lifecycle, Policy, Resource | States configurables, règles, applied to resources |
| **Runtime Services** | HotSwap Engine (state transitions as atomic ops), Capability Orchestrator (activate lifecycle before affected resources) | Execute state machine transitions |
| **Persistence** | archive_entries.state column, entities.version column (version incremented on state change) | Stored as state ENUM + version INTEGER |

---

## Mapping 15: Configuration

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | ConfigurationAggregate | Settings par organization |
| **Entities** | SettingEntry | Paramètres key-value |
| **Value Objects** | SettingKey (currency, fiscal_year_start, timezone, language, locale, date_format, number_format), SettingValue (typed: string, number, boolean, object) | Clés et valeurs typées |
| **Policies** | FormatValidationPolicy (ISO 4217 currency, IANA timezone), MinTranslationPolicy (FR+EN minimum) | Formats standards, traductions minimales |
| **Capabilities** | Configuration | Autonomie totale |
| **Runtime Services** | Context Manager (propagate to all capabilities), Manifest Loader (settings section parsed) | Inject settings into context, load from manifest |
| **Persistence** | org_settings table (key-value pairs) + organizations.settings (JSONB composite) | Dual storage for performance and granularity |

---

## Mapping 16: Search

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | SearchAggregate | Recherche plein texte, tags, filtres |
| **Entities** | SearchResult, IndexDefinition | Résultats + définitions d'index |
| **Value Objects** | SearchQuery, FilterSet (by_type, by_tags, by_state, by_date_range), SortOrder, Pagination | Requête, filtres, tri, pagination |
| **Policies** | OrgIsolationPolicy (always filtered by org_id), LanguagePolicy (search language = manifest language) | Isolement multi-tenant, langue cohérente |
| **Capabilities** | Search, Vocabulary (for label translation in results) | Full-text search + vocabulary-aware labels |
| **Runtime Services** | Init Coordinator (search index initialization order) | Initialize search indexes after vocabulary capability |
| **Persistence** | GIN indexes (tags, metadata), tsvector (full-text), WHERE org_id = ? | PostgreSQL GIN + tsvector + org_id filter |

---

## Mapping 17: Reporting

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | ReportingAggregate | Export configurable de données |
| **Entities** | ReportDefinition, ReportInstance | Définitions + exécutions |
| **Value Objects** | ReportFormat (pdf, csv, json), ReportPeriod (monthly, quarterly, yearly, custom), ExportFilters | Formats, périodes, filtres |
| **Policies** | PermissionCheckPolicy (read permission required before export), DataScopePolicy (org-scoped only) | Permissions avant export, scope org unique |
| **Capabilities** | Reporting, Policy | Export configurables + rules |
| **Runtime Services** | Manifest Loader (lit report_types), Edge Function generate-report (PDF generation on server) | Load report types, execute on InsForge edge |
| **Persistence** | N/A (reports are generated on-demand; history optionally stored in org_settings or audit_logs) | Generated, not persisted (unless explicitly saved) |

---

## Mapping 18: Offline Sync

| Élément | Type | Détail |
|---------|------|--------|
| **Aggregate** | SyncAggregate | Synchronisation bidirectionnelle local ↔ distant |
| **Entities** | PendingOperation, SyncStatusTracker | Opérations en attente + statut sync |
| **Value Objects** | SyncAction (create, update, delete), SyncStatus (pending, sent, confirmed, failed), ConflictStrategy (LWW, server-wins, immutable, UUID dedup), TimestampClient (epoch ms) | Actions, statuts, stratégies, horodatages |
| **Policies** | LocalFirstPolicy (local write ALWAYS before remote), ConflictResolutionPolicy (strategy per entity type), BatchPolicy (push batches of 50) | Local-first, strategies, batching |
| **Capabilities** | Offline Sync | Autonomie totale |
| **Runtime Services** | Init Coordinator (sync initialization last, after all other capabilities loaded) | Initialize sync mechanism last |
| **Persistence** | pending_operations table, _synced column on all WatermelonDB models | Sync status per-record + queue table |

---

## RÉSUMÉ DU MAPPING

| Concept Count | Aggregates Defined | Domain Objects Instantiated | Persistence Tables Referenced |
|--------------|-------------------|---------------------------|------------------------------|
| 18 Concepts | 18 Aggregates (1:1 mapping) | 11 Domain Objects (Transaction, Category, Member, Event, OrgUnit, GroupMembership, ArchiveEntry, NotificationRecord, AuditLogEntry, PendingOperation, UserSession) | 15 tables references (all existing BACKEND-PG-SCHEMA tables) |

**Règle fondamentale respectée:** Aucun nouveau concept inventé dans le Domain Model. Chaque Domain Object est une instanciation d'un Concept existant.
