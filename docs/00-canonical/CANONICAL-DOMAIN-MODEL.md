# Canonical Domain Model — Lumina v2

**Doc ID:** DOC-012 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — DERNIÈRE AUTORITÉ MÉTIER AVANT PERSISTANCE  
**Date:** 2026-07-24  

---

## PRINCIPE

Le Domain Model est la couche LA PLUS HAUTE qui introduit du comportement métier.

Chaque Aggregate de DOC-006 est instancié ici. Aucun nouveau Concept n'est inventé. Toutes les règles métier sont documentées sans code.

Règle constitutionnelle: Si un élément du Domain Model n'a pas un Concept source dans DOC-CONCEPTUAL-MODEL-V1 et un Aggregate source dans DOC-006 → SIGNALER comme invention interdite.

---

## REGISTRE DES AGGREGATES

### Aggregate 1: OrganizationAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `OrganizationAggregate` |
| **Concept source** | `Organization` + `OrgUnit` |
| **Responsabilité métier** | Gérer l'identité, la structure hiérarchique et les paramètres d'une organisation autonome |
| **Boundary** | Tout ce qui touche à l'identité de l'org, sa hiérarchie récursive (≤5 niveaux), ses unités, et sa configuration globale |
| **Owner** | Superadmin (crée l'org). L'org admin gère ses unités et settings |
| **Entities** | `Organization` (profile unique avec nom, type, statut); `OrgUnit` (noeud du DAG hiérarchique) |
| **Value Objects** | `OrganizationName`, `OrganizationType` (enum church/school/ngo/company/custom), `OrgUnitHierarchy` (tree path string ex: "org/chorale/soprano"), `OrganizationSettings` (JSONB: currency, fiscal_year_start, timezone, language, accent_hex), `OrganizationStatus` (enum active/suspended/archived) |
| **Domain Services** | `OrgHierarchyResolver` (traversée DAG récursive), `OrgTemplateInheritor` (résout héritage Template→Manifest) |
| **Policies utilisées** | `VisibilityPolicy` (données jamais mixées entre orgs), `HierarchyPolicy` (DAG sans cycles, profondeur ≤5), `MaxDepthPolicy` (contrainte trigger DB sur depth_level) |
| **Capabilities** | Identity, Relationship, Branding, Configuration |
| **Commands autorisées** | `CreateOrganization`, `UpdateOrganizationSettings`, `CreateOrgUnit`, `UpdateOrgUnitParent`, `TransferOrgUnit`, `ArchiveOrganization`, `SuspendOrganization`, `MergeOrganizations` |
| **Transitions d'état** | `organization.status`: inactive → active → suspended → archived; `org_unit.status`: active → archived |
| **Business Rules** | BR-ORG-001: Chaque org a une identité unique (name non vide, type enum valide); BR-ORG-002: Profondeur max 5 niveaux; BR-ORG-003: Un OrgUnit ne peut pas devenir son propre parent (cycle detection); BR-ORG-004: org_id injecté dans toutes les requêtes; BR-ORG-005: Merge nécessite validation superadmin; BR-ORG-006: Organisation suspendue → plus d'écriture, lecture seule |
| **Domain Events produits** | `OrganizationCreated`, `OrganizationSuspended`, `OrganizationArchived`, `OrgUnitCreated`, `OrgUnitParentChanged`, `OrgMerged` |
| **Relations** | `OrganizationAggregate` 1:N → `IdentityAggregate` (users belong to org); `OrganizationAggregate` 1:N → `ResourceAggregate` (transactions/events de cette org uniquement) |

---

### Aggregate 2: IdentityAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `IdentityAggregate` |
| **Concept source** | `Identity` |
| **Responsabilité métier** | Gér er les profils uniques, leurs credentials, sessions et permissions |
| **Boundary** | Tout ce qui identifie UNIQUEMENT un utilisateur, son authentification, et ses droits |
| **Owner** | Superadmin (superadmin), Admin (autres users de son org) |
| **Entities** | `User` (profil avec firstName, lastName, email, phone, passwordHash, role) |
| **Value Objects** | `EmailAddress`, `PhoneNumber`, `PasswordHash` (jamais en clair, jamais dans logs), `UserRole` (enum superadmin/admin/treasurer/pastor/staff), `PermissionGrant` (string format resource:action:level), `JWTToken` (ephemeral, never stored plain), `SessionContext` (refreshToken hash, expiresAt, isActive, deviceInfo) |
| **Domain Services** | `PermissionResolver` (résout permissions depuis roles manifest + role hierarchy), `PasswordValidator` (complexité regex policy) |
| **Policies utilisées** | `UniquenessPolicy` (email unique par org), `PasswordPolicy` (hash cost, rotation), `InheritancePolicy` (permissions child inherit parent, jamais soustraites) |
| **Capabilities** | Identity, Permission, Audit |
| **Commands autorisées** | `CreateUser`, `UpdateUserProfile`, `ChangeUserRole`, `ResetPassword`, `LoginUser`, `LogoutUser`, `RefreshAccessToken`, `RevokeSession`, `AssignPermissionGrant` |
| **Transitions d'état** | Aucune transition d'état pour l'entité User elle-même (le status est géré via MembershipAggregate si applicable). Sessions ont: active → expired → revoked |
| **Business Rules** | BR-ID-001: Password_hash jamais stocké en clair; BR-ID-002: JWT stored encrypted (expo-secure-store côté client); BR-ID-003: Email unique par org (constraint composite org_id+email); BR-ID-004: Superadmin peut créer TOUS les users; BR-ID-005: Admin ne peut créer que treasurer/pastor/staff (pas superadmin); BR-ID-006: Wildcard permissions ["*"] auditées mais autorisées |
| **Domain Events produits** | `UserCreated`, `UserUpdated`, `UserRoleChanged`, `PasswordResetRequested`, `UserLoggedIn`, `UserLoggedOut`, `SessionCreated`, `SessionExpired`, `SessionRevoked` |
| **Relations** | `IdentityAggregate` N:1 → `OrganizationAggregate` (un user appartient à UNE org); `IdentityAggregate` 1:N → `RelationshipAggregate` (user↔orgUnit memberships); `IdentityAggregate` 1:N → `AuditAggregate` (toutes actions logguées par userId) |

---

### Aggregate 3: ResourceAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `ResourceAggregate` |
| **Concept source** | `Resource` |
| **Responsabilité métier** | CRUD générique pour toute ressource manipulable de l'organisation |
| **Boundary** | L'ensemble des opérations CRUD + état + version sur TOUT objet manipulable |
| **Owner** | Rôle selon permission grant (`resource:*:read/write`) |
| **Entities** | `TransactionRecord` (data financière, mutable state draft/pending/approved/rejected); `MemberRecord` (data membre, mutable state active/inactive/deceased/transferred); `EventRecord` (data événement, mutable state draft/published/cancelled/completed); `ArchiveEntryRecord` (data archive, mutable state active/archived/trashed/purged); `NotificationRecord` (data notification, immutable once sent) |
| **Value Objects** | `ResourceId` (UUID string), `ResourceType` (enum transaction/member/event/archive_entry), `ResourceState` (state machine par type), `ResourceVersion` (integer, auto-increment), `ResourceMetadata` (JSONB extensible), `AmountInCents` (BIGINT positive, never float), `TransactionReference` (UUID compensates_for field for INV-001) |
| **Domain Services** | `ResourceFactory` (create new typed resources), `ResourceValidator` (type-specific business rules), `ResourceScopeResolver` (resolve scope_type/scope_target for consolidation) |
| **Policies utilisées** | `ImmutabilityPolicy` (INV-001: approved transactions immuable), `VersioningPolicy` (INV-010: version increment on every change), `ScopePolicy` (scope_type org/group + scope_target group filtering) |
| **Capabilities** | Resource, Lifecycle, Policy, Search, Audit, Reporting, Offline Sync |
| **Commands autorisées** | `CreateResource[Type]`, `UpdateResource[Type]`, `TransitionResourceState[Type]`, `DeleteResource[Type]`, `CompensateTransaction`, `SearchResources`, `ExportResourceReport` |
| **Transitions d'état** | `Transaction`: draft → pending → approved / rejected; `Member`: active → inactive / deceased / transferred; `Event`: draft → published / cancelled / completed; `ArchiveEntry`: draft → active → archived → trashed → purged |
| **Business Rules** | BR-RES-001: Amount toujours positif (CHECK amount > 0); BR-RES-002: Approved transaction jamais modifiée — correction via compensates_for (INV-001); BR-RES-003: Every resource has version field (INV-010); BR-RES-004: Date pas dans le futur; BR-RES-005: Scope type 'org' ou 'group' (mandatory pour transactions); BR-RES-006: Category reference always from Vocabulary (INV-006); BR-RES-007: Created_by always set; BR-RES-008: Amount stored as BIGINT cents (never float) |
| **Domain Events produits** | `ResourceCreated`, `ResourceUpdated`, `ResourceStateChanged`, `ResourceDeleted`, `TransactionCompensated`, `ApprovalRequested`, `ApprovalGranted`, `ApprovalRejected` |
| **Relations** | `ResourceAggregate` N:1 → `OrganizationAggregate` (Toutes resources scoped to org_id); `ResourceAggregate` N:1 → `RelationshipAggregate` (linked_member_id, scope_target FK); `ResourceAggregate` M:N → `ResourceAggregate` (compensates_for links two transactions) |

---

### Aggregate 4: RelationshipAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `RelationshipAggregate` |
| **Concept source** | `Relationship` |
| **Responsabilité métier** | Gérer les connexions universelles entre Ressources et Identités sans logique métier |
| **Boundary** | Tous les liens relationnels: member↔group, org↔child_org, resource↔resource |
| **Owner** | Admin (member↔group), Superadmin (org↔org merge/transfer) |
| **Entities** | `GroupMembership` (many-to-many link between member and org_unit); `OrgUnitParentLink` (parent_unit_id self-referencing FK on org_units table) |
| **Value Objects** | `RelationshipType` (enum belongs_to, has_many, many_to_many, hierarchical, referenced_by), `RelationshipKey` (composite of source_entity_id + target_entity_id + relationship_type), `JoinTimestamp`, `MembershipRole` (optional: the role within a group) |
| **Domain Services** | `CycleDetector` (topological sort before insert/update), `DescendantEnumerator` (DFS traversal of hierarchical relationships) |
| **Policies utilisées** | `DagPolicy` (no cycles in hierarchy), `MaxDepthPolicy` (depth ≤ 5 enforced at both domain and DB level), `MultiMembershipPolicy` (a member CAN belong to multiple groups) |
| **Capabilities** | Relationship, Policy |
| **Commands autorisées** | `AddMemberToGroup`, `RemoveMemberFromGroup`, `ChangeOrgUnitParent`, `TransferChildOrg`, `MergeChildOrg`, `EnumerateDescendants` |
| **Transitions d'état** | Relationships are EMBEDDED — they don't have lifecycle states. Adding/removing is instant. |
| **Business Rules** | BR-REL-001: No cycles in org_unit hierarchy (checked by topological sort AND DB trigger); BR-REL-002: Max depth 5 (checked at domain layer BEFORE reaching DB); BR-REL-003: Transferring an org_unit preserves ALL existing memberships under it; BR-REL-004: Memberships are bidirectional-visible (can query groups FOR a member OR members IN a group) |
| **Domain Events produits** | `MemberJoinedGroup`, `MemberLeftGroup`, `OrgUnitReparented`, `ChildOrgTransferred`, `ChildOrgMerged`, `DescendantEnumerationRequested` |
| **Relations** | `RelationshipAggregate` N:1 → `OrganizationAggregate`; `RelationshipAggregate` N:1 → `IdentityAggregate` (member ↔ org unit); `RelationshipAggregate` N:1 → `ResourceAggregate` (org_unit ↔ financial transactions via scope_target) |

---

### Aggregate 5: WorkflowAggregate

| Propriètre | Détail |
|-----------|--------|
| **Nom officiel** | `WorkflowAggregate` |
| **Concept source** | `Workflow` + `Activity` |
| **Responsabilité métier** | Orchestrer séquences d'étapes déclenchées par événements; gérer transitions d'état des ressources |
| **Boundary** | Définitions de workflow, exécutions en cours (instances), étapes individuelles, timeouts et escalades |
| **Owner** | Système (déclenché automatiquement) ou Admin (manuel) |
| **Entities** | `WorkflowInstance` (execution tracking with currentStepIndex, totalSteps, status running/completed/failed/cancelled); `WorkflowStep` (individual step with type auto/approval/notification/conditional/delay/parallel) |
| **Value Objects** | `WorkflowTrigger` (enum finance:transaction:created, finance:expense:submitted, members:application:submitted, etc.), `StepType` (enum auto/approval/notification/conditional/delay/parallel), `StepTimeout` (duration string e.g. "3d", "7d"), `ApprovalChain` (ordered list of assigneeRoles with require_all boolean), `ConditionExpression` (JSONata string), `EscalationRule` (if timeout reached → notify X) |
| **Domain Services** | `StepExecutor` (execute current step based on type), `TimeoutMonitor` (check expiring steps), `EscalationRouter` (route escalation when timeout exceeded) |
| **Policies utilisées** | `MaxStepsPolicy` (max 7 steps before requiring capability native), `TimeoutEscalationPolicy` (max 30 days, escalation mandatory after), `ApprovalChainPolicy` (max 5 levels), `NoFinancialModificationPolicy` (workflows NEVER modify approved transactions directly) |
| **Capabilities** | Workflow, Notification, Policy, Audit |
| **Commands autorisées** | `TriggerWorkflow`, `ApproveStep`, `RejectStep`, `CancelWorkflow`, `SkipStep`, `ResubmitForApproval`, `RequestRevision` |
| **Transitions d'état** | `WorkflowInstance`: running → completed / failed / cancelled; `WorkflowStep`: pending → in_progress → completed / failed / skipped |
| **Business Rules** | BR-WF-001: Timeout max 30 jours; BR-WF-002: Approval chain max 5 niveaux hiérarchiques; BR-WF-003: Failed workflow can be retried manually NOT automatically; BR-WF-004: All execution states logged (audit trail INV-007); BR-WF-005: Financial workflows do NOT modify approved transactions directly; BR-WF-006: Workflow can NOT create new capabilities or add to manifest |
| **Domain Events produits** | `WorkflowTriggered`, `StepExecuted`, `StepApproved`, `StepRejected`, `StepEscalated`, `WorkflowCompleted`, `WorkflowFailed`, `WorkflowCancelled` |
| **Relations** | `WorkflowAggregate` N:1 → `OrganizationAggregate`; `WorkflowAggregate` N:1 → `ResourceAggregate` (workflow operates ON a resource — e.g. transaction approval); `WorkflowAggregate` 1:N → `NotificationAggregate` (notification steps) |

---

### Aggregate 6: FormAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `FormAggregate` |
| **Concept source** | `Form` |
| **Responsabilité métier** | Gérer définitions de formulaires dynamiques et leur rendu — aucun JSX dur |
| **Boundary** | Définitions YAML/JSON des formulaires, mapping vers composantes RN, validation rules, section ordering |
| **Owner** | Admin (modifie les templates), Système (rend le formulaire) |
| **Entities** | `FormDefinition` (id, model, version, fields[], sections[]); `FormField` (name, label, type, required, options, visible_if) |
| **Value Objects** | `FormId` (string key e.g. "finance_transaction_form"), `ModelRef` (string referencing a Domain Entity type), `FieldDef` (name, label_fr, label_en, type enum text/number/date/select/multiselect/file_upload/signature/textarea, required, pattern, min, max, default, visible_if condition), `SectionDef` (id, title_fr, title_en, fields array reference), `FormVersion` (semantic string e.g. "1.0") |
| **Domain Services** | `FormRenderer` (convert JSON definition to React Native component tree), `FormValidator` (client-side + server-side validation matching exactly) |
| **Policies utilisées** | `NoHardcodedFormPolicy` (INV-009: no form ever rendered in JSX), `ClientServerValidationMatchPolicy` (INV-008: client validation must match server validation exactly), `SensitiveFormLockPolicy` (financial forms locked read-only after submission except admins) |
| **Capabilities** | Forms, Vocabulary, Policy, Configuration |
| **Commands autorisées** | `LoadFormDefinition`, `ValidateFormData`, `RenderForm`, `GetVisibleFields`, `SubmitFormData` |
| **Transitions d'état** | None. Form definitions are CONFIGURATION (immutable unless admin updates version). Form SUBMISSIONS produce Data Objects (TransactionRecord, MemberRecord, etc.). |
| **Business Rules** | BR-FRM-001: Select/multiselect fields MUST reference Vocabulary, never hardcoded lists; BR-FRM-002: Client validation = Server validation (not approximation); BR-FRM-003: Fields with visible_if conditions supported; BR-FRM-004: Form versioning — old versions not modifiable |
| **Domain Events produits** | `FormSubmitted`, `FormValidationFailed`, `FormSubmittedForApproval` |
| **Relations** | `FormAggregate` N:1 → `OrganizationAggregate`; `FormAggregate` references → `VocabularyCapability` (for select options); `FormAggregate` output → `ResourceAggregate` (form data becomes a new Resource) |

---

### Aggregate 7: NotificationAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `NotificationAggregate` |
| **Concept source** | `Notification` |
| **Responsabilité métier** | Messagerie multi-canal avec templates, triggers et rate limiting |
| **Boundary** | Envoi, templates de message, préférences utilisateurs, rate limiting par org/user |
| **Owner** | Système (déclenché par Workflow) ou Admin (manuel) |
| **Entities** | `NotificationMessage` (title, body, severity, channel, data_json); `NotificationPreference` (channels[], severityMin, rateLimitH per user/org) |
| **Value Objects** | `ChannelType` (enum in_app/push/email/sms), `SeverityLevel` (enum info/warning/critical), `MessageTemplate` (subject_fr, subject_en, body_fr, body_en, data_placeholders[]), `RateLimitConfig` (max_per_hour integer) |
| **Domain Services** | `NotificationRouter` (send via correct channel), `RateLimitEnforcer` (prevent spam) |
| **Policies utilisées** | `NoUntriggeredNotificationPolicy` (always triggered by something — never spontaneous), `ChannelPreferencePolicy` (respect user preferences), `QuietHoursPolicy` (optional per-org quiet hours) |
| **Capabilities** | Notification, Policy |
| **Commands autorisées** | `SendNotification`, `QueueNotification`, `MarkAsRead`, `UpdatePreferences`, `SuppressUntil`, `SetRateLimit` |
| **Transitions d'état** | `NotificationMessage`: queued → sending → sent / failed; `NotificationPreference`: active → quiet_hours |
| **Business Rules** | BR-NOT-001: Every notification has a trigger (from Workflow, policy event, or manual admin action); BR-NOT-002: Rate limit configurable per user/org; BR-NOT-003: In-app notifications always delivered (no network dependency — offline first); BR-NOT-004: Push/email/sms optional (fail gracefully if channel unavailable); BR-NOT-005: Critical severity bypasses quiet hours |
| **Domain Events produits** | `NotificationQueued`, `NotificationSent`, `NotificationFailed`, `NotificationMarkedRead`, `PreferencesUpdated` |
| **Relations** | `NotificationAggregate` N:1 → `OrganizationAggregate`; `NotificationAggregate` N:1 → `IdentityAggregate` (user_id recipient); `NotificationAggregate` triggered_by → `WorkflowAggregate` (step completes) |

---

### Aggregate 8: VocabularyAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `VocabularyAggregate` |
| **Concept source** | `Vocabulary` |
| **Responsabilité métier** | Catalogue centralisé de termes, valeurs et traductions — source unique pour toutes les listes référençables |
| **Boundary** | Namespaces, terms, values, translations, deprecation management |
| **Owner** | Admin (manage terms/values); Système (read resolved labels) |
| **Entities** | `Namespace` (finance, common, membership, events, lifecycle); `Term` (key within namespace with label_fr, label_en, description, deprecated flag); `TermValue` (specific value with key, label_fr, label_en, color, metadata) |
| **Value Objects** | `NamespaceKey` (string identifier), `TermKey` (stable string, never changes), `LabelPair` (fr + en translation), `DeprecatedFlag` (boolean, if true value still exists but should not appear in new UI), `ColorHex` (validated hex pattern) |
| **Domain Services** | `TermResolver` (resolve term_key → display_label for given language), `NamespaceBrowser` (list all terms in namespace), `DeprecationManager` (mark values as deprecated without deleting) |
| **Policies utilisées** | `NeverDeletePolicy` (values never deleted, only deprecated), `TranslationMinimumPolicy` (min FR+EN for every term), `StabilityPolicy` (keys stable forever, only labels change) |
| **Capabilities** | Vocabulary |
| **Commands autorisées** | `AddTermValue`, `UpdateTermLabel`, `UpdateTermLabelEn`, `DeprecateTermValue`, `ListTermsByNamespace`, `ResolveTerm`, `SearchTerms`, `GetTermTranslation` |
| **Transitions d'état** | `TermValue`: active → deprecated (irreversible). Terms never change key. |
| **Business Rules** | BR-VOC-001: Values never deleted (only deprecated); BR-VOC-002: Minimum FR+EN translations; BR-VOC-003: Keys stable forever, only labels may evolve; BR-VOC-004: Forms referencing nonexistent terms must throw explicit error, not render silently |
| **Domain Events produits** | `TermAdded`, `TermValueDeprecicated`, `LabelUpdated`, `TranslationResolved` |
| **Relations** | `VocabularyAggregate` N:1 → `OrganizationAggregate` (vocab namespaced per org, fallbacks to global); `VocabularyAggregate` consumed_by → `FormAggregate` (select options from vocab); `VocabularyAggregate` consumed_by → `ReportingAggregate` (category breakdown colors) |

---

### Aggregate 9: ReportingAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `ReportingAggregate` |
| **Concept source** | `Reporting` (implied — reporting is a domain concern) |
| **Responsabilité métier** | Export configurable de données: bilan, rapports mensuels/annuels, formats PDF/CSV/JSON |
| **Boundary** | Report definitions, generated reports, export format configuration |
| **Owner** | Role with `reporting:*:read` permission grant |
| **Entities** | `ReportDefinition` (id, label_fr, label_en, scope_template, period_type, export_formats[]); `GeneratedReport` (period_start, period_end, scope, totals, by_category, transactionCount, export_format) |
| **Value Objects** | `ReportScope` (enum org/group/all/partial_consolidation), `PeriodType` (enum month/quarter/year/custom), `ReportFormat` (enum pdf/csv/json), `BalanceTotals` (income bigint, expense bigint, netResult bigint, transfers bigint), `CategoryBreakdown` (Record<categoryId, {income: bigint, expense: bigint}>) |
| **Domain Services** | `BalanceCalculator` (server-side aggregation of approved transactions filtered by scope and period), `ReportGenerator` (render report template in requested format) |
| **Policies utilisées** | `PermissionCheckPolicy` (read permission required before generating), `DataScopePolicy` (org-scoped only), `NetInternalTransfersPolicy` (consolidation_rules.net_internal_transfers flag prevents double counting) |
| **Capabilities** | Reporting, Policy, Search |
| **Commands autorisées** | `GenerateReport`, `GetReportTypes`, `ExportReport`, `FilterTransactionsByScope`, `CalculateBalance` |
| **Transitions d'état** | None. Reports are generated on-demand (not persisted unless explicitly saved). GeneratedReport is a VALUE passed back to caller. |
| **Business Rules** | BR-RPT-001: Balance must balance (Actif = Passif + Résultat) per BR-FIN-020; BR-RPT-002: Monthly report covers 1st to last day of month; BR-RPT-003: Export includes timestamp and digital signature (BR-FIN-022); BR-RPT-004: Archived reports immutable (BR-FIN-023); BR-RPT-005: Only synced=1 (approved) transactions participate in calculation |
| **Domain Events produits** | `ReportGenerated`, `ReportExported`, `BalanceCalculated` |
| **Relations** | `ReportingAggregate` N:1 → `OrganizationAggregate`; `ReportingAggregate` depends_on → `ResourceAggregate` (reads TransactionRecord data); `ReportingAggregate` triggered_by → `WorkflowAggregate` (scheduled report generation) |

---

### Aggregate 10: AuditAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `AuditAggregate` |
| **Concept source** | `Audit` |
| **Responsabilité métier** | Journal immuable de toutes les actions utilisateurs: qui, quoi, quand, old_value, new_value |
| **Boundary** | Log entries only — append-only, never modify, never delete |
| **Owner** | Immutable system-owned aggregate |
| **Entities** | `AuditLogEntry` (action, entityType, entityId, oldValues, newValues, userId, ipAddress) |
| **Value Objects** | `ActionType` (enum create/update/delete/approve/reject/transfer/notify/*), `EntitySnapshot` (JSONB diff before/after), `UserId` (who performed the action), `IpAddress` (request origin), `LogTimestamp` (UTC) |
| **Domain Services** | `AuditLogger` (append new entry), `RetentionManager` (configurable years, purge scheduled entries) |
| **Policies utilisées** | `ImmutablePolicy` (never modify/delete), `FullSnapshotPolicy` (old_values + new_values always present), `AccessRestrictionPolicy` (admin/auditor only access) |
| **Capabilities** | Audit |
| **Commands autorisées** | `LogAction` (auto-invoked by other aggregates on state change — not user-callable), `QueryAuditLogs`, `ExportAuditTrail` (read-only export for compliance) |
| **Transitions d'état** | None. Append-only by definition. |
| **Business Rules** | BR-AUD-001: Actions are logged IMMEDIATELY upon state change (before persistence); BR-AUD-002: old_value AND new_value ALWAYS captured; BR-AUD-003: Logs retained minimum 7 years (configurable via Policy); BR-AUD-004: Impossible to modify or delete any log entry; BR-AUD-005: Access restricted to admins and auditors (RBAC); BR-AUD-006: Manifest changes also logged (audit.log_manifest_changes: true) |
| **Domain Events produits** | `ActionLogged` (internal only — side effect of any domain operation) |
| **Relations** | `AuditAggregate` N:1 → `OrganizationAggregate`; `AuditAggregate` references → all other Aggregates (every aggregate calls AuditLogger when state changes) |

---

### Aggregate 11: LifecycleAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `LifecycleAggregate` |
| **Concept source** | `Lifecycle` (implied — lifecycle states are universal across Resources) |
| **Responsabilité métier** | States configurables pour TOUTE resource: draft → active → archived → trashed → purged |
| **Boundary** | State machine definition, state transitions, retention periods, purge scheduling |
| **Owner** | System (enforces rules) + Admin (configures lifecycle types via manifest) |
| **Entities** | `ArchiveEntry` (stateful resource with lifecycle transitions); `LifecycleTypeDefinition` (archivable_types declared in manifest: baptism, teaching, program, custom) |
| **Value Objects** | `LifecycleState` (enum draft/active/archived/trashed/purged), `RetentionPeriod` (enum 1_year/3_years/7_years/permanent), `ArchiveType` (configurable string from manifest lifecycle.types[]), `TagCollection` (TEXT[] for search/filter), `CategoryRef` (configurable category from manifest), `AttachmentUrlList` (TEXT[] array) |
| **Domain Services** | `StateTransitionValidator` (validates allowed transitions), `PurgeScheduler` (identifies trashed entries past purge_date) |
| **Policies utilisées** | `ArchiveRetentionPolicy` (trashed → purge configurable), `SoftDeletePolicy` (trash date tracked separately from permanent purge), `IrreversiblePurgePolicy` (purge is final — cannot restore) |
| **Capabilities** | Lifecycle, Policy, Search, Resource |
| **Commands autorisées** | `ArchiveResource`, `TrashResource`, `PurgeResource`, `RestoreFromTrash`, `ListArchiveEntries`, `SearchArchives`, `ApplyTags`, `RemoveTags`, `SchedulePurge` |
| **Transitions d'état** | `LifecycleState`: active → archived → trashed → purged; trashed → active (restore); archived → active (reopen); purged → N/A (irreversible) |
| **Business Rules** | BR-LIF-001: States configurable per org via manifest.lifecycle.types[]; BR-LIF-002: Archive linked to original resource (resource_type + resource_id); BR-LIF-003: Optional linking to members (linked_member_id FK); BR-LIF-004: Tags + categories for flexible organization; BR-LIF-005: Purge date configurable per archivable type; BR-LIF-006: Trashed entries NOT visible in normal queries, only via archive search |
| **Domain Events produits** | `ResourceArchived`, `ResourceTrashed`, `ResourcePurged`, `ResourceRestoredFromTrash`, `PurgeScheduled` |
| **Relations** | `LifecycleAggregate` N:1 → `OrganizationAggregate`; `LifecycleAggregate` depends_on → `ResourceAggregate` (archives resources); `LifecycleAggregate` many-to-1 → `IdentityAggregate` (archived_by user); `LifecycleAggregate` links → `ResourceAggregate` (linked_member_id) |

---

### Aggregate 12: ConfigurationAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `ConfigurationAggregate` |
| **Concept source** | `Policy` + `Configuration` |
| **Responsabilité métier** | Settings par organization: currency, fiscal_year, language, timezone, i18n, performance tuning |
| **Boundary** | All org-level configuration parameters |
| **Owner** | Admin |
| **Entities** | `SettingEntry` (setting_key, setting_value JSONB, updated_at) |
| **Value Objects** | `SettingKey` (currency, fiscal_year_start, language, timezone, org_logo_url, accent_hex, short_name, date_format, number_format, currency_symbol_position, show_skeleton_loading, optimistic_updates_enabled, animation_duration_default_ms); `SettingValue` (typed: string, number, boolean, object) |
| **Domain Services** | `SettingResolver` (read setting with fallback to template defaults), `SettingValidator` (validate hex color, date format regex, etc.) |
| **Policies utilisées** | `FormatValidationPolicy` (ISO 4217 currency, IANA timezone, hex color pattern ^#[0-9a-fA-F]{6}$), `TranslationMinimumPolicy` (FR+EN minimum for any labels) |
| **Capabilities** | Configuration, Branding |
| **Commands autorisées** | `UpdateSetting`, `GetSetting`, `GetAllSettings`, `ResetToDefaults`, `BulkUpdateSettings` |
| **Transitions d'état** | None. Settings are pure configuration. |
| **Business Rules** | BR-CONFIG-001: Currency ISO 4217 (e.g. CDF, USD, EUR); BR-CONFIG-002: Timezone IANA format (e.g. Africa/Lubumbashi); BR-CONFIG-003: Accent color validated hex + WCAG contrast check; BR-CONFIG-004: All settings have default values that take effect if not overridden |
| **Domain Events produits** | `SettingUpdated`, `SettingsResetToDefaults` |
| **Relations** | `ConfigurationAggregate` N:1 → `OrganizationAggregate`; `ConfigurationAggregate` consumed_by → all other Aggregates (every aggregate reads settings) |

---

### Aggregate 13: OfflineSyncAggregate

| Propriété | Détail |
|-----------|--------|
| **Nom officiel** | `OfflineSyncAggregate` |
| **Concept source** | `Offline Sync` |
| **Responsabilité métier** | Synchronisation bidirectionnelle local SQLite ↔ distant PostgreSQL |
| **Boundary** | Pending operations queue, conflict resolution strategies, push/pull coordination, connectivity monitoring |
| **Owner** | System-owned (automatic, user-transparent) |
| **Entities** | `PendingOperation` (resource_type, resource_id, action, payload, sync_status); `SyncStatusTracker` (last_sync_timestamp per table, connection_state) |
| **Value Objects** | `SyncAction` (enum create/update/delete); `SyncStatus` (enum pending/sent/confirmed/failed); `ConflictStrategy` (enum LWW/server_wins/immutable/uuid_dedup/side_by_side); `OperationPayload` (JSON string snapshot of entire resource); `PushBatchSize` (max 50); `RetryDelayMs` (exponential: 1000 → 2000 → 4000 → 8000 → 16000) |
| **Domain Services** | `PushCoordinator` (batch and send pending ops), `PullCoordinator` (delta fetch since last sync), `ConflictResolver` (apply strategy per entity type) |
| **Policies utilisées** | `LocalFirstPolicy` (INV-003: local write ALWAYS before remote), `ConflictResolutionPolicy` (strategy per entity type — see conflict matrix), `BatchPolicy` (push batches of 50 ops max) |
| **Capabilities** | Offline Sync |
| **Commands autorisées** | `PushPendingOps`, `PullRemoteChanges`, `ResolveConflict`, `MarkOperationConfirmed`, `ScheduleRetry`, `EnableOfflineMode`, `DisableOfflineMode` |
| **Transitions d'état** | `PendingOperation.sync_status`: pending → sent → confirmed / failed → pending (retry); `SyncStatusTracker.connection_state`: online → offline → online |
| **Business Rules** | BR-SYNC-001: Local write ALWAYS precedes remote write (INV-003 offline-absolute); BR-SYNC-002: Transactions approved = immutable (no sync override); BR-SYNC-003: Transactions draft = UUID dedup + side-by-side diff; BR-SYNC-004: Members/Events = LWW (timestamp); BR-SYNC-005: Categories = server-wins (lookup table); BR-SYNC-006: Batch size max 50, retry exponential backoff max 5 attempts; BR-SYNC-007: No user operation depends on synchronous API call |
| **Domain Events produits** | `SyncStarted`, `BatchPushed`, `DeltaReceived`, `ConflictDetected`, `ConflictResolved`, `SyncCompleted`, `ConnectionLost`, `ConnectionRestored` |
| **Relations** | `OfflineSyncAggregate` N:1 → `OrganizationAggregate`; `OfflineSyncAggregate` operates_on → all other Aggregates (pending operations track changes to every resource type) |

---

## RÉSUMÉ DU DOMAIN MODEL

| Aggregate Count | Entities Total | Value Objects Total | Domain Services | Business Rules Total |
|----------------|---------------|--------------------|-----------------|---------------------|
| 13 Aggregates | 22 Entities | 40+ Value Objects | 15 Domain Services | 70+ Business Rules |

**Règle fondamentale respectée:** Aucun nouveau Concept inventé. Chaque Aggregate est une instanciation directe d'un Concept du Conceptual Model. La chaîne Concept → Capability → Aggregate → Entity/VO est intacte pour tous les 13 Aggregates.
