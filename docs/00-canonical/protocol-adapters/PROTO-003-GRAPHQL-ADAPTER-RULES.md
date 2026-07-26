# GraphQL Adapter Rules Specification — Lumina v1
**Doc ID:** PROTO-003
**Version:** v1.0
**Statut:** SPECIFICATION PROTOCOLE ADAPTE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "API-CONTRACT-002", "API-CONTRACT-005", "PROTO-001"]
**Transformation_rule :** "graphql-adapter-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document definit les regles qu'un adapter GraphQL pour Lumina v1 DOIT respecter exclusivement. L'adapter GraphQL transforme le Canonical Request/Response defini dans **API-CONTRACT-001** et **API-CONTRACT-002** en schema et execution GraphQL, et traduit les erreurs canoniques d'**API-CONTRACT-005** vers le format erreur GraphQL.

Aucune logique metier ne vit dans l'adapter. L'adapter ne fait que :
1. Parser une requete/mutation GraphQL AST → Canonical Request
2. Invoquer le service via le port d'application (transparence totale)
3. Serialiser le Canonical Response → reponse GraphQL JSON
4. Traduire les erreurs canoniques → extensions GraphQL `errors[]`

---

## Section 1: Principles

Les principes suivants regissent TOUT adapter GraphQL pour Lumina. Chaque principe decoule directement d'un invariant architectural canonique.

### Principe G-001: Canonical Types Only

Les types GraphQL sont des representations abstraites des Canonical Request/Response (**API-CONTRACT-002**), pas de tables ou colonnes de base de donnees. Aucun nom de type GraphQL ne correspond a un nom de table SQL. Les types GraphQL modellant un entity canonique utilisent le camelCase du contract (ex: `CreateTransactionInput`, `TransactionResponse`), jamais le snake_case du stockage (ex: `transaction_record`).

**Source canonique :** PAS-003 DR-011 (No Business Logic in Ports or Adapters), API-CONTRACT-002 (contrats implémenteles par tous les adapters).

### Principe G-002: One Query/Mutation = One Operation

Chaque operation canonique definie dans **API-CONTRACT-001** a EXACTEMENT une Query root field (pour les Queries) ou une Mutation root field (pour les Commands) correspondante. Pas d'operations composites, pas de sous-champs derives. 83 operations → 83 root fields (26 Queries + 57 Mutations).

**Source canonique :** API-CONTRACT-001 (83 Operations across 13 Aggregates), PROTO-001 Section 4.1.2.

### Principe G-003: Error Extensions Mandatory

Toutes les erreurs transmises par l'adapter GraphQL INCLURENT systématiquement `error_code` d'**API-CONTRACT-005** dans le champ `extensions.code` de l'objet erreur GraphQL. Cette regle decoule de la Regle A-004 (**PROTO-001** Section 7.4) : la traduction d'erreur doit preserver le error_code canonique.

**Source canonique :** API-CONTRACT-005 (Error Taxonomy), PROTO-001 Section 5.2.2 (GraphQL Error Mapping), API-CONTRACT-002 §2.3 (Error Contract Standard).

### Principe G-004: No Nested Mutations

Une mutation ne modifie qu'un seul Aggregate a la fois. Les operations cross-aggregate (documentees dans **ASS-004**) passent par l'event bus eventual consistency. Une mutation comme `submitForApproval` déclenche uniquement ResourceAggregate. L'activation de WorkflowAggregate est un side-effect eventuel, pas une mutation nestede.

Exception : le pattern Saga (**ASS-003** Pattern 3) permet un enchaînement de mutations appeler par le client pour des operations multi-Aggregates necessitant une compensation immédiate (ex: UC-WF-02). Mais cela reste le client qui orchestre, pas l'adapter.

**Source canonique :** ASS-003 Cross-Aggregate Workflow Patterns, DOC-015 INV-004 (org isolation).

### Principe G-005: Cursor-Based Pagination Only

Toutes les operations de liste utilisent cursor pagination au format `edges/node` avec `PageInfo`. Offset-based pagination n'est JAMAIS exposee. Chaque list query retourne :
```
{ edges: [Node], pageInfo: PageInfo, totalCount: Int }
```
Cela decoule du Pagination Contract d'**API-CONTRACT-002** Section 2.4, qui est adapte au format GraphQL.

**Source canonique :** API-CONTRACT-002 §2.4 (Pagination Contract), PROTO-001 Section 5.2.2.

### Principe G-006: Field-Level Authorization

Chaque field peut être protégé par authorization via un directive personnalisé `@auth(permission: "resource:action:level")`. Le mapping des permissions RBAC suit le schema d'**API-CONTRACT-004**. L'authorization check se produit AVANT que la mutation/query n'atteigne l'Application Service — il est declenché par l'adapter GraphQL en lisant les directives schema, selon le Step 2 de **ASS-003** (Authorization Check BEFORE Aggregate Load).

**Source canonique :** API-CONTRACT-004 (RBAC mapping), ASS-003 Step 2, PAS-001 Port-005 (AuthorizationPort).

### Principe G-007: Introspection Disabled in Production

L'introspection (`__schema`, `__type`) est DESACTIVEE en production. En developpement, elle peut etre activee mais ne révélera JAMAIS de fields sensibles (password_hash, refresh_token_hash, credentials). Les types internes (`_HiddenType`, `_InternalPayload`) ne sont jamais exposes dans le schema public.

**Source canonique :** PROTO-001 §4.1.2 (Schema GraphQL attendu).

### Principe G-008: Schema Evolution via Deprecation

Toute modification du schema utilise la directive `@deprecated(reason: "...")` au lieu de la suppression directe. Un champ ou type déprécié reste dans le schema pendant au moins 2 releases majeures avant suppression. Le reason doit indiquer l'alternative recommandée.

**Source canonique :** PAS-003 DR-006 (Backward Compatibility), API-CONTRACT-003 NeverBreak rules.

---

## Section 2: Schema Definition

Cette section definit le schema GraphQL CANONIQUE — les types abstraits qui mappent directement vers les Request/Response Contracts d'**API-CONTRACT-002**.

### 2.1 Shared Scalar Types

```graphql
"""
DateTime scalar conforming to ISO 8601 (RFC 3339).
Maps to DATE or TIMESTAMP fields in API-CONTRACT-002.
"""
scalar DateTime

"""
UUID scalar following RFC 4122 v4.
Maps to UUID fields across all Request/Response contracts.
"""
scalar UUID

"""
BigInt scalar for 64-bit signed integers.
Used exclusively for BIGINT cents fields (amount_cents, total_count).
"""
scalar BigInt

"""
JSON scalar for arbitrary JSONB payloads.
Used for updates objects, filters, and metadata.
"""
scalar JSON
```

### 2.2 Common Input Types (Derived from API-CONTRACT-002 Request Contracts)

```graphql
"""
Common pagination envelope input. All list queries accept these args.
"""
input CursorPaginationInput {
  """Starting cursor (opaque cursor token). Null for first page."""
  after: String
  """Number of items to return. Max: 100."""
  first: Int = 25
}

"""
Common filter envelope for list queries.
"""
input FilterInput {
  """Full-text search expression."""
  search_text: String
  """Filter by entity type."""
  resource_type: ResourceType
  """Filter by status enum."""
  status: ResourceStatus
  """Inclusive date range start."""
  date_from: DateTime
  """Inclusive date range end."""
  date_to: DateTime
  """Category reference UUID from vocabulary."""
  category_ref: UUID
  """Sort field identifier."""
  sort_by: String
  """Sort direction: ASC or DESC."""
  sort_order: SortDirection = ASC
}

enum SortDirection {
  ASC
  DESC
}

"""
Org unit type enum across Organization and Relationship aggregates.
Source: DOC-012 organization/unit definitions.
"""
enum OrgUnitType {
  CHURCH
  SCHOOL
  NGO
  COMPANY
  CUSTOM
  GROUP
  DEPARTMENT
  SUB_UNIT
}

"""
Resource type enum covering TransactionRecord, MemberRecord, EventRecord.
Source: DOC-012 ResourceAggregate entities.
"""
enum ResourceType {
  TRANSACTION
  MEMBER
  EVENT
}

"""
Transaction type enum per DOC-021 §3.1.
"""
enum TransactionType {
  INCOME
  EXPENSE
  TRANSFER
  ADJUSTMENT
}

"""
Transaction status/state machine states.
Source: DOC-021 §3.1, DOC-015 STATUS-010.
"""
enum ResourceStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
}

"""
Member status per DOC-015 STATUS-010.
Valid states: active, inactive, deceased, transferred.
"""
enum MemberStatus {
  ACTIVE
  INACTIVE
  DECEASED
  TRANSFERRED
}

"""
Notification channel types per DOC-012.
"""
enum NotificationChannel {
  IN_APP
  PUSH
  EMAIL
  SMS
}

"""
Notification severity levels per DOC-012.
"""
enum NotificationSeverity {
  INFO
  WARNING
  CRITICAL
}

"""
Export format enum per DOC-015 EXPORT-001.
"""
enum ExportFormat {
  PDF
  CSV
  JSON
}

"""
Report scope enum per DOC-012.
"""
enum ReportScope {
  ORG
  GROUP
  ALL
  PARTIAL_CONSOLIDATION
}

"""
Sync conflict strategy per DOC-012.
"""
enum ConflictStrategy {
  LWW
  SERVER_WINS
  IMMUTABLE
  UUID_DEDUP
  SIDE_BY_SIDE
}

"""
Organization type per DOC-012 type enum.
"""
enum OrganizationType {
  CHURCH
  SCHOOL
  NGO
  COMPANY
  CUSTOM
}
```

### 2.3 Root Query Type

```graphql
"""
Root query type — maps to ALL 26 Query operations from API-CONTRACT-001.
Each field's arguments and return type are derived directly from the
corresponding Request/Response Contract in API-CONTRACT-002.
"""
type QueryRoot {
  # ========== OrganizationAggregate Queries (2) ==========
  getOrganizationProfile: OrganizationProfileResponse!
    @deprecated(reason: "Use getOrganization instead")
  getOrganization(id: UUID!): Organization!
  descendantUnits(rootId: UUID!): [OrgUnit!]!

  # ========== IdentityAggregate Queries (0 commands only) ==========

  # ========== ResourceAggregate Queries (2) ==========
  searchResources(
    filters: FilterInput
    pagination: CursorPaginationInput
  ): ResourceSearchResult!
  exportResources(format: ExportFormat!, filters: FilterInput): ExportBlob!

  # ========== RelationshipAggregate Queries (3) ==========
  descendants(unitId: UUID!): [OrgUnit!]!
  groupsForMember(memberId: UUID!): [GroupMembership!]!
  membersOfGroup(groupId: UUID!): [MemberRecord!]!

  # ========== WorkflowAggregate Queries (1) ==========
  pendingApprovals: [WorkflowStep!]!

  # ========== FormAggregate Queries (3) ==========
  formDefinition(formId: String!, version: String): FormDefinition!
  renderForm(formId: String!, data: JSON): RenderTree!
  visibleFields(formId: String!, context: JSON): [FormField!]!

  # ========== VocabularyAggregate Queries (5) ==========
  resolveLabel(namespace: String!, termKey: String!, lang: String!): String!
  terms(namespace: String!): [Term!]!
  termValues(namespace: String!, termKey: String!): [TermValue!]!
  searchTerms(query: String!, namespace: String): [Term!]!
  namespaces: [String!]!

  # ========== ReportingAggregate Queries (3) ==========
  balance(scope: ReportScope!, periodStart: DateTime!, periodEnd: DateTime!): BalanceTotals!
  reportExport(reportId: UUID!, format: ExportFormat!): ExportFile!
  reportTypes: [ReportTypeDef!]!

  # ========== AuditAggregate Queries (2) ==========
  auditLogs(filters: AuditLogFilters!, pagination: CursorPaginationInput): AuditLogResult!
  auditTrail(period: String!, format: ExportFormat!): ExportData!

  # ========== LifecycleAggregate Queries (2) ==========
  archiveEntries(filters: ArchiveFilters): ArchiveResult!
  searchArchives(query: String!, tags: [String!], type: String): ArchiveResult!

  # ========== ConfigurationAggregate Queries (2) ==========
  setting(key: String!): SettingEntry!
  settings: [SettingEntry!]!

  # ========== OfflineSyncAggregate Queries (2) ==========
  connectivity: ConnectivityState!
  syncStatus(tableName: String!): SyncStatusTracker!
}
```

### 2.4 Root Mutation Type

```graphql
"""
Root mutation type — maps to ALL 57 Command operations from API-CONTRACT-001.
Each mutation accepts the appropriate Create/Update Input type from API-CONTRACT-002
and returns the corresponding response type.
"""
type MutationRoot {
  # ========== OrganizationAggregate Commands (8) ==========
  createOrganization(input: CreateOrganizationInput!): CreateOrganizationResponse!
  updateOrganizationSettings(input: UpdateOrganizationSettingsInput!): UpdateResponse!
  createOrgUnit(input: CreateOrgUnitInput!): CreateOrganizationResponse!
  updateOrgUnitParent(input: UpdateOrgUnitParentInput!): UpdateResponse!
  transferChildOrg(input: TransferChildOrgInput!): UpdateResponse!
  mergeOrganizations(input: MergeOrganizationsInput!): UpdateResponse!
  archiveOrganization(input: ArchiveOrganizationInput!): UpdateResponse!
  suspendOrganization(input: SuspendOrganizationInput!): UpdateResponse!

  # ========== IdentityAggregate Commands (9) ==========
  createUser(input: CreateUserInput!): CreateIdentityResponse!
  updateUserProfile(input: UpdateUserProfileInput!): UpdateResponse!
  changeUserRole(input: ChangeUserRoleInput!): UpdateResponse!
  resetPassword(input: ResetPasswordInput!): UpdateResponse!
  loginUser(input: LoginUserInput!): LoginResponse!
  logoutUser(input: LogoutUserInput!): UpdateResponse!
  refreshAccessToken(input: RefreshAccessTokenInput!): RefreshResponse!
  revokeSession(input: RevokeSessionInput!): UpdateResponse!
  assignPermissionGrant(input: AssignPermissionGrantInput!): UpdateResponse!

  # ========== ResourceAggregate Commands (10) + Queries (2) ==========
  createTransaction(input: CreateTransactionInput!): CreateResourceResponse!
  updateDraftTransaction(input: UpdateDraftTransactionInput!): UpdateResponse!
  submitForApproval(input: SubmitForApprovalInput!): UpdateResponse!
  approveTransaction(input: ApproveTransactionInput!): UpdateResponse!
  rejectTransaction(input: RejectTransactionInput!): UpdateResponse!
  compensateTransaction(input: CompensateTransactionInput!): CreateResourceResponse!
  createMember(input: CreateMemberInput!): CreateResourceResponse!
  updateMember(input: UpdateMemberInput!): UpdateResponse!
  transitionMemberStatus(input: TransitionMemberStatusInput!): UpdateResponse!

  # ========== RelationshipAggregate Commands (3) ==========
  addMemberToGroup(input: AddMemberToGroupInput!): CreateRelationshipResponse!
  removeMemberFromGroup(input: RemoveMemberFromGroupInput!): UpdateResponse!
  setOrgUnitParent(input: SetOrgUnitParentInput!): UpdateResponse!

  # ========== WorkflowAggregate Commands (5) ==========
  triggerWorkflow(input: TriggerWorkflowInput!): CreateWorkflowResponse!
  approveStep(input: ApproveStepInput!): UpdateResponse!
  rejectStep(input: RejectStepInput!): UpdateResponse!
  cancelWorkflow(input: CancelWorkflowInput!): UpdateResponse!
  resubmitForApproval(input: ResubmitForApprovalInput!): UpdateResponse!

  # ========== FormAggregate Commands (1) ==========
  validateFormData(input: ValidateFormDataInput!): ValidationResult!

  # ========== NotificationAggregate Commands (6) ==========
  sendNotification(input: SendNotificationInput!): CreateNotificationResponse!
  markAsRead(input: MarkAsReadInput!): UpdateResponse!
  updatePreferences(input: UpdatePreferencesInput!): UpdateResponse!
  setRateLimit(input: SetRateLimitInput!): UpdateResponse!
  suppressUntil(input: SuppressUntilInput!): UpdateResponse!
  queueNotification(input: QueueNotificationInput!): CreateNotificationResponse!

  # ========== VocabularyAggregate Commands (2) ==========
  addTermValue(input: AddTermValueInput!): CreateVocabularyResponse!
  deprecateTermValue(input: DeprecateTermValueInput!): UpdateResponse!

  # ========== ReportingAggregate Commands (1) ==========
  generateReport(input: GenerateReportInput!): CreateReportResponse!

  # ========== AuditAggregate Commands (1) SYSTEM ONLY ==========
  logAction(input: LogActionInput!): UpdateResponse! @auth(permission: "audit:write:system")

  # ========== LifecycleAggregate Commands (5) ==========
  archiveResource(input: ArchiveResourceInput!): CreateLifecycleResponse!
  trashResource(input: TrashResourceInput!): UpdateResponse!
  purgeResource(input: PurgeResourceInput!): UpdateResponse! @auth(permission: "lifecycle:delete:system")
  restoreFromTrash(input: RestoreFromTrashInput!): UpdateResponse!
  applyTags(input: ApplyTagsInput!): UpdateResponse!
  schedulePurge(input: SchedulePurgeInput!): CreateLifecycleResponse!

  # ========== ConfigurationAggregate Commands (2) ==========
  updateSetting(input: UpdateSettingInput!): UpdateResponse!
  resetToDefaults: UpdateResponse!

  # ========== OfflineSyncAggregate Commands (4) ==========
  pushPendingOperations(input: PushPendingOperationsInput!): CreateSyncResponse!
  pullRemoteChanges(input: PullRemoteChangesInput!): UpdateResponse!
  resolveConflict(input: ResolveConflictInput!): UpdateResponse!
  markOperationConfirmed(input: MarkOperationConfirmedInput!): UpdateResponse!
}
```

### 2.5 Shared Response Types (Derived from API-CONTRACT-002 Response Contracts)

```graphql
"""
Standard success response for ALL command operations.
Maps to the Standard Success Response from API-CONTRACT-002 §2.2.
"""
type StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

"""
Standard query response with pagination for list queries.
Maps to the Standard Query Response from API-CONTRACT-002 §2.2.
"""
type PaginatedResponse {
  data: [JSON!]!
  count: Int!
  totalCount: BigInt!
  hasPreviousPage: Boolean!
  hasNextPage: Boolean!
  pageInfo: PageInfo!
}

"""
GraphQL standard PageInfo type for cursor pagination.
"""
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

"""
Standard domain event emitted by any aggregate.
Maps to API-CONTRACT-002 §2.2 Event List Structure.
"""
type DomainEvent {
  name: String!
  timestamp: DateTime!
  payload: JSON!
}

"""
Unified error response matching API-CONTRACT-005 taxonomy.
Every GraphQL error for a Lumina operation MUST include code in extensions.
"""
type ErrorDetail {
  code: String!     # E-XXX-NNN from API-CONTRACT-005
  message: String!  # Human-readable explanation
  details: JSON     # Optional additional context
  requestId: UUID!  # Correlation ID for tracing
}
```

### 2.6 Aggregate-Specific Response Types

```graphql
# ---- Organization Aggregate Responses ----
type OrganizationResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

type UpdateResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  eventsEmitted: [DomainEvent!]!
}

# ---- Identity Aggregate Responses ----
type IdentityResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

type LoginResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  eventsEmitted: [DomainEvent!]!
  accessToken: String!
  refreshToken: String!
}

type RefreshResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  eventsEmitted: [DomainEvent!]!
  accessToken: String!
  refreshToken: String!
}

# ---- Resource Aggregate Responses ----
type ResourceResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

type ResourceSearchResult {
  edges: [ResourceEdge!]!
  pageInfo: PageInfo!
  totalCount: BigInt!
}

type ResourceEdge {
  cursor: String!
  node: Resource!
}

type Resource {
  id: UUID!
  type: ResourceType!
  orgId: UUID!
  version: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: UUID!
  data: JSON!
}

# ---- Workflow Aggregate Responses ----
type WorkflowResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

type ValidationResult {
  success: Boolean!
  version: Int!
  valid: Boolean!
  errors: [FieldValidationResult!]
}

type FieldValidationResult {
  field: String!
  code: String!
  message: String!
}

# ---- Notification Aggregate Responses ----
type NotificationResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

# ---- Vocabulary Aggregate Responses ----
type VocabularyResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

# ---- Reporting Aggregate Responses ----
type ReportResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

# ---- Lifecycle Aggregate Responses ----
type LifecycleResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

# ---- Relationship Aggregate Responses ----
type RelationshipResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}

# ---- Audit Aggregate Responses ----
type AuditResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  eventsEmitted: [DomainEvent!]!
}

# ---- Configuration Aggregate Responses ----
type ConfigurationResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  eventsEmitted: [DomainEvent!]!
}

# ---- OfflineSync Aggregate Responses ----
type SyncResponse implements StandardSuccessResponse {
  success: Boolean!
  version: Int!
  createdAt: DateTime
  eventsEmitted: [DomainEvent!]!
}
```

### 2.7 Entity Types (Query Return Types — Read-Only Models)

These types represent read-only projections returned by Query operations. They are derived from the data described in **API-CONTRACT-002** response contracts and the physical schema in **DOC-021**. They do NOT contain internal implementation details.

```graphql
# Organization Aggregate Entities
type Organization {
  id: UUID!
  name: String!
  type: OrgUnitType!
  status: OrgStatus!
  settings: JSON
  createdAt: DateTime!
  updatedAt: DateTime!
  parentOrgId: UUID
}

enum OrgStatus {
  ACTIVE
  ARCHIVED
  SUSPENDED
}

type OrgUnit {
  id: UUID!
  orgId: UUID!
  name: String!
  unitType: OrgUnitType!
  parentId: UUID
  depthLevel: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Identity Aggregate Entities
type User {
  id: UUID!
  orgId: UUID!
  email: String!
  role: UserRole!
  firstName: String!
  lastName: String!
  phone: String
  status: UserStatus!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  SUPERADMIN
  ADMIN
  TREASURER
  PASTOR
  STAFF
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

type SessionContext {
  sessionId: UUID!
  userId: UUID!
  expiresAt: DateTime!
  createdAt: DateTime!
}

# Relationship Aggregate Entities
type GroupMembership {
  id: UUID!
  memberId: UUID!
  groupId: UUID!
  joinedAt: DateTime!
  role: String
}

# Workflow Aggregate Entities
type WorkflowInstance {
  id: UUID!
  definitionKey: String!
  resourceType: ResourceType!
  resourceId: UUID!
  status: WorkflowStatus!
  currentStep: Int!
  triggerEvent: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum WorkflowStatus {
  RUNNING
  COMPLETED
  CANCELLED
  REJECTED
  IN_REVISION
}

type WorkflowStep {
  id: UUID!
  instanceId: UUID!
  stepOrder: Int!
  stepType: StepType!
  status: StepStatus!
  assignedTo: UUID
  comment: String
  createdAt: DateTime!
  completedAt: DateTime
}

enum StepType {
  APPROVAL
  NOTIFICATION
  CONDITIONAL
}

enum StepStatus {
  PENDING
  COMPLETED
  REJECTED
  SKIPPED
  ESCALATED
}

# Form Aggregate Entities
type FormDefinition {
  id: String!
  version: String!
  title: String!
  sections: [SectionDef!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type SectionDef {
  key: String!
  title: String!
  fields: [FormField!]!
  visibleIf: JSON
}

type FormField {
  key: String!
  type: FieldType!
  label: String!
  required: Boolean!
  validation: JSON
  options: [FormFieldOption!]
  visibleIf: JSON
}

enum FieldType {
  TEXT
  NUMBER
  DATE
  EMAIL
  SELECT
  MULTSELECT
  BOOLEAN
  FILE
  JSON
}

type FormFieldOption {
  value: String!
  label: String!
}

type RenderTree {
  type: String!
  props: JSON
  children: [RenderTreeNode!]
}

type RenderTreeNode {
  type: String!
  props: JSON
  children: [RenderTreeNode!]
}

# Vocabulary Aggregate Entities
type Namespace {
  key: String!
  displayName: String!
  createdAt: DateTime!
}

type Term {
  namespace: String!
  key: String!
  labels: [TermLabel!]!
  values: [TermValue!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type TermLabel {
  language: String!
  label: String!
}

type TermValue {
  namespace: String!
  termKey: String!
  key: String!
  labels: [TermLabel!]!
  colorHex: String
  deprecated: Boolean!
  deprecatedAt: DateTime
}

# Reporting Aggregate Entities
type BalanceTotals {
  totalAssets: BigInt!
  totalLiabilities: BigInt!
  totalEquity: BigInt!
  netIncome: BigInt!
  periodStart: DateTime!
  periodEnd: DateTime!
  categoryBreakdown: [CategoryBreakdown!]!
}

type CategoryBreakdown {
  categoryId: UUID!
  categoryName: String!
  netAmount: BigInt!
  transactionsCount: Int!
}

type ReportTypeDef {
  key: String!
  name: String!
  description: String!
  availableScopes: [ReportScope!]!
}

type ExportBlob {
  contentType: String!
  content: String!
  filename: String!
  digitalSignature: String
  generatedAt: DateTime!
}

type ExportFile {
  contentType: String!
  content: String!
  filename: String!
  digitalSignature: String
  generatedAt: DateTime!
}

type ExportData {
  contentType: String!
  content: String!
  filename: String!
}

# Audit Aggregate Entities
type AuditLogEntry {
  id: UUID!
  entityType: String!
  entityId: UUID!
  action: ActionType!
  oldValues: JSON
  newValues: JSON
  userId: UUID!
  ipAddress: String
  timestamp: DateTime!
}

enum ActionType {
  CREATE
  UPDATE
  DELETE
  APPROVE
  REJECT
  TRANSFER
  NOTIFY
  ARCHIVE
  TRASH
  PURGE
  RESTORE
  RESET
  SYNC_PUSH
  SYNC_PULL
  SYNC_RESOLVE
  UNKNOWN
}

input AuditLogFilters {
  dateRange: DateRangeFilter
  entityTypes: [String!]
  userIds: [UUID!]
  actions: [ActionType!]
}

input DateRangeFilter {
  from: DateTime
  to: DateTime
}

# Lifecycle Aggregate Entities
type ArchiveEntry {
  id: UUID!
  resourceType: String!
  resourceId: UUID!
  state: ArchiveState!
  tags: [String!]!
  retentionPeriod: Int
  purgeDate: DateTime
  archivedBy: UUID!
  archivedAt: DateTime!
  trashedAt: DateTime
  purgedAt: DateTime
  restoredAt: DateTime
}

enum ArchiveState {
  ARCHIVED
  TRASHED
  PURGED
}

input ArchiveFilters {
  types: [String!]
  tags: [String!]
  states: [ArchiveState!]
  dateRange: DateRangeFilter
}

type ArchiveResult {
  edges: [ArchiveEdge!]!
  pageInfo: PageInfo!
  totalCount: BigInt!
}

type ArchiveEdge {
  cursor: String!
  node: ArchiveEntry!
}

# Configuration Aggregate Entities
type SettingEntry {
  key: String!
  value: JSON!
  defaultValue: JSON
  category: String!
  updatedAt: DateTime
}

type SettingValue {
  key: String!
  value: JSON!
  isDefault: Boolean!
}

# OfflineSync Aggregate Entities
type PendingOperation {
  id: UUID!
  orgId: UUID!
  resourceType: String!
  resourceId: UUID!
  action: SyncAction!
  payload: JSON!
  version: Int!
  createdAt: DateTime!
  syncStatus: SyncStatus!
  retryCount: Int!
}

enum SyncAction {
  CREATE
  UPDATE
  DELETE
}

enum SyncStatus {
  PENDING
  SENT
  CONFIRMED
  FAILED
  CONFLICT
}

type SyncStatusTracker {
  tableName: String!
  lastSyncTimestamp: DateTime
  pendingCount: Int!
  failedCount: Int!
  conflictCount: Int!
}

type ConnectivityState {
  isConnected: Boolean!
  lastCheckAt: DateTime!
  networkType: NetworkType
}

enum NetworkType {
  WIFI
  CELLULAR
  ETHERNET
  OFFLINE
  UNKNOWN
}
```

### 2.8 Aggregate-Specific Input Types (CREATE Operations)

```graphql
# ---- OrganizationAggregate Inputs ----
input CreateOrganizationInput {
  name: String!
  type: OrganizationType!
  settings: JSON
}

input UpdateOrganizationSettingsInput {
  key: String!
  value: JSON!
}

input CreateOrgUnitInput {
  name: String!
  parentId: UUID
  unitType: OrgUnitType!
}

input UpdateOrgUnitParentInput {
  unitId: UUID!
  newParentId: UUID!
}

input TransferChildOrgInput {
  childOrgId: UUID!
  newParentId: UUID!
}

input MergeOrganizationsInput {
  sourceOrgId: UUID!
  targetOrgId: UUID!
}

input ArchiveOrganizationInput {
  orgId: UUID!
}

input SuspendOrganizationInput {
  orgId: UUID!
}

# ---- IdentityAggregate Inputs ----
input CreateUserInput {
  email: String!
  passwordHash: String!
  role: UserRole!
  firstName: String!
  lastName: String!
  phone: String
}

input UpdateUserProfileInput {
  userId: UUID!
  updates: UserProfileUpdates!
}

input UserProfileUpdates {
  firstName: String
  lastName: String
  phone: String
  email: String
}

input ChangeUserRoleInput {
  userId: UUID!
  newRole: UserRole!
}

input ResetPasswordInput {
  userId: UUID!
  newPasswordHash: String!
}

input LoginUserInput {
  email: String!
  password: String!
}

input LogoutUserInput {
  sessionId: UUID!
}

input RefreshAccessTokenInput {
  refreshTokenHash: String!
}

input RevokeSessionInput {
  sessionId: UUID!
}

input AssignPermissionGrantInput {
  roleId: UUID!
  permissionString: String!
}

# ---- ResourceAggregate Inputs ----
input CreateTransactionInput {
  amountCents: BigInt!
  type: TransactionType!
  status: ResourceStatus
  categoryRef: UUID!
  scopeType: ScopeType!
  scopeTargetId: UUID
  transactionDate: DateTime!
  description: String
  compensatesFor: UUID
  approvedBy: UUID
}

enum ScopeType {
  ORG
  GROUP
}

input UpdateDraftTransactionInput {
  transactionId: UUID!
  updates: TransactionUpdates!
}

input TransactionUpdates {
  amountCents: BigInt
  type: TransactionType
  status: ResourceStatus
  categoryRef: UUID
  scopeType: ScopeType
  scopeTargetId: UUID
  transactionDate: DateTime
  description: String
  approvedBy: UUID
}

input SubmitForApprovalInput {
  transactionId: UUID!
}

input ApproveTransactionInput {
  transactionId: UUID!
  approverId: UUID!
}

input RejectTransactionInput {
  transactionId: UUID!
  reason: String!
}

input CompensateTransactionInput {
  originalTransactionId: UUID!
  compensationData: CreateTransactionInput!
}

input CreateMemberInput {
  firstName: String!
  lastName: String!
  email: String
  phone: String
  dateOfBirth: DateTime
  initialStatus: MemberStatus
}

input UpdateMemberInput {
  memberId: UUID!
  updates: MemberUpdates!
}

input MemberUpdates {
  firstName: String
  lastName: String
  email: String
  phone: String
  dateOfBirth: DateTime
}

input TransitionMemberStatusInput {
  memberId: UUID!
  newStatus: MemberStatus!
}

# ---- RelationshipAggregate Inputs ----
input AddMemberToGroupInput {
  memberId: UUID!
  groupId: UUID!
}

input RemoveMemberFromGroupInput {
  memberId: UUID!
  groupId: UUID!
}

input SetOrgUnitParentInput {
  unitId: UUID!
  parentUnitId: UUID!
}

# ---- WorkflowAggregate Inputs ----
input TriggerWorkflowInput {
  definitionKey: String!
  resourceType: ResourceType!
  resourceId: UUID!
  triggerEvent: String!
}

input ApproveStepInput {
  instanceId: UUID!
  stepId: UUID!
  comment: String
}

input RejectStepInput {
  instanceId: UUID!
  stepId: UUID!
  reason: String!
}

input CancelWorkflowInput {
  instanceId: UUID!
  reason: String!
}

input ResubmitForApprovalInput {
  instanceId: UUID!
}

# ---- FormAggregate Inputs ----
input ValidateFormDataInput {
  formId: String!
  formData: JSON!
}

# ---- NotificationAggregate Inputs ----
input SendNotificationInput {
  recipientUserId: UUID!
  channel: NotificationChannel!
  body: String!
  severity: NotificationSeverity
  triggerSource: String!
}

input MarkAsReadInput {
  notificationId: UUID!
}

input UpdatePreferencesInput {
  channels: [NotificationChannel!]
  severityMin: NotificationSeverity
  rateLimitPerHour: Int
}

input SetRateLimitInput {
  maxPerHour: Int!
}

input SuppressUntilInput {
  untilTime: DateTime!
}

input QueueNotificationInput {
  recipientUserId: UUID!
  channel: NotificationChannel!
  body: String!
  triggerSource: String!
}

# ---- VocabularyAggregate Inputs ----
input AddTermValueInput {
  namespace: String!
  termKey: String!
  labelFr: String!
  labelEn: String!
  colorHex: String
}

input DeprecateTermValueInput {
  namespace: String!
  termKey: String!
  valueKey: String!
}

# ---- ReportingAggregate Inputs ----
input GenerateReportInput {
  reportType: String!
  periodStart: DateTime!
  periodEnd: DateTime!
  scope: ReportScope!
  format: ExportFormat
}

# ---- AuditAggregate Inputs (SYSTEM ONLY) ----
input LogActionInput {
  entityType: String!
  entityId: UUID!
  action: ActionType!
  oldValues: JSON!
  newValues: JSON!
}

# ---- LifecycleAggregate Inputs ----
input ArchiveResourceInput {
  resourceType: String!
  resourceId: UUID!
}

input TrashResourceInput {
  archiveId: UUID!
}

input PurgeResourceInput {
  archiveId: UUID!
}

input RestoreFromTrashInput {
  archiveId: UUID!
}

input ApplyTagsInput {
  archiveId: UUID!
  tags: [String!]!
}

input SchedulePurgeInput {
  archiveId: UUID!
  purgeDate: DateTime!
}

# ---- ConfigurationAggregate Inputs ----
input UpdateSettingInput {
  key: String!
  value: JSON!
}

# ---- OfflineSyncAggregate Inputs ----
input PushPendingOperationsInput {
  operations: [PendingOperationInput!]!
}

input PendingOperationInput {
  resourceType: String!
  resourceId: UUID!
  action: SyncAction!
  payload: JSON!
  version: Int!
}

input PullRemoteChangesInput {
  sinceTimestamp: DateTime!
}

input ResolveConflictInput {
  operationId: UUID!
  conflictData: JSON!
  strategy: ConflictStrategy!
}

input MarkOperationConfirmedInput {
  operationId: UUID!
}
```

---

## Section 3: Operation Mapping — ALL 83 Operations

All 83 canonical operations from **API-CONTRACT-001** are mapped below, grouped by Aggregate. Each entry shows the exact GraphQL operation name, input type, output type, and possible error extensions.

### 3.1 OrganizationAggregate (10 operations: 8 Commands, 2 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| CreateOrganization | `mutation { createOrganization(input: ...) }` | CreateOrganizationInput! | OrganizationResponse! | E-400-001, E-400-004, E-403-001, E-500-002 |
| UpdateOrganizationSettings | `mutation { createOrganization(input: ...) }` | UpdateOrganizationSettingsInput! | UpdateResponse! | E-400-001, E-400-003, E-403-001, E-422-001-CFG-001, E-422-001-CFG-002, E-422-001-CFG-003 |
| CreateOrgUnit | `mutation { createOrgUnit(input: ...) }` | CreateOrgUnitInput! | OrganizationResponse! | E-400-001, E-400-005, E-403-001, E-422-001-REL-001, E-422-001-REL-002, E-500-002 |
| UpdateOrgUnitParent | `mutation { updateOrgUnitParent(input: ...) }` | UpdateOrgUnitParentInput! | UpdateResponse! | E-400-005, E-403-001, E-409-003, E-422-001-REL-001, E-422-001-REL-002, E-500-002 |
| TransferChildOrg | `mutation { transferChildOrg(input: ...) }` | TransferChildOrgInput! | UpdateResponse! | E-400-005, E-401-001, E-403-001, E-403-003, E-422-001-REL-001, E-500-002 |
| MergeOrganizations | `mutation { mergeOrganizations(input: ...) }` | MergeOrganizationsInput! | UpdateResponse! | E-400-005, E-401-001, E-403-001, E-403-003, E-500-002 |
| ArchiveOrganization | `mutation { archiveOrganization(input: ...) }` | ArchiveOrganizationInput! | UpdateResponse! | E-400-001, E-404-001, E-403-001, E-409-003, E-500-002 |
| SuspendOrganization | `mutation { suspendOrganization(input: ...) }` | SuspendOrganizationInput! | UpdateResponse! | E-400-001, E-404-001, E-403-001, E-409-003, E-500-002 |
| GetOrganizationProfile | `query { getOrganization(id: ...) }` | (no input — path param only) | Organization! | E-404-001, E-500-002 |
| GetDescendantUnits | `query { descendantUnits(rootId: ...) }` | (rootId: UUID!) | [OrgUnit!]! | E-404-001, E-422-001-REL-002, E-500-002 |

### 3.2 IdentityAggregate (9 operations: 9 Commands, 0 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| CreateUser | `mutation { createUser(input: ...) }` | CreateUserInput! | IdentityResponse! | E-400-001, E-400-003, E-409-002, E-422-001-EMAIL-001, E-403-003, E-500-002 |
| UpdateUserProfile | `mutation { updateUserProfile(input: ...) }` | UpdateUserProfileInput! | UpdateResponse! | E-400-005, E-400-003, E-403-001, E-422-001-EMAIL-001, E-500-002 |
| ChangeUserRole | `mutation { changeUserRole(input: ...) }` | ChangeUserRoleInput! | UpdateResponse! | E-400-005, E-403-001, E-403-003, E-500-002 |
| ResetPassword | `mutation { resetPassword(input: ...) }` | ResetPasswordInput! | UpdateResponse! | E-400-005, E-403-001, E-422-001-EMAIL-001, E-500-002 |
| LoginUser | `mutation { loginUser(input: ...) }` | LoginUserInput! | LoginResponse! | E-400-001, E-401-003, E-404-001, E-403-002, E-500-002 |
| LogoutUser | `mutation { logoutUser(input: ...) }` | LogoutUserInput! | UpdateResponse! | E-400-001, E-404-001, E-404-003, E-500-002 |
| RefreshAccessToken | `mutation { refreshAccessToken(input: ...) }` | RefreshAccessTokenInput! | RefreshResponse! | E-400-001, E-401-002, E-404-001, E-500-002 |
| RevokeSession | `mutation { revokeSession(input: ...) }` | RevokeSessionInput! | UpdateResponse! | E-400-001, E-404-001, E-404-003, E-500-002 |
| AssignPermissionGrant | `mutation { assignPermissionGrant(input: ...) }` | AssignPermissionGrantInput! | UpdateResponse! | E-400-001, E-400-005, E-403-001, E-500-002 |

### 3.3 ResourceAggregate (12 operations: 10 Commands, 2 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| CreateTransaction | `mutation { createTransaction(input: ...) }` | CreateTransactionInput! | ResourceResponse! | E-400-001, E-400-002, E-400-003, E-400-004, E-400-006, E-400-007, E-404-001, E-403-001, E-422-001-FIN-002, E-422-001-DATE-001, E-422-001-CAT-001, E-422-001-DESC-001, E-422-001-SCOPE-001, E-422-001-DISABLE-011, E-500-002 |
| UpdateDraftTransaction | `mutation { updateDraftTransaction(input: ...) }` | UpdateDraftTransactionInput! | UpdateResponse! | E-400-005, E-403-001, E-404-001, E-409-003, E-422-001-FIN-001, E-422-001-VERSION-001, E-500-002 |
| SubmitForApproval | `mutation { submitForApproval(input: ...) }` | SubmitForApprovalInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-409-003, E-500-002 |
| ApproveTransaction | `mutation { approveTransaction(input: ...) }` | ApproveTransactionInput! | UpdateResponse! | E-400-005, E-401-001, E-403-001, E-404-001, E-409-003, E-500-002 |
| RejectTransaction | `mutation { rejectTransaction(input: ...) }` | RejectTransactionInput! | UpdateResponse! | E-400-001, E-400-005, E-403-001, E-404-001, E-409-003, E-500-002 |
| CompensateTransaction | `mutation { compensateTransaction(input: ...) }` | CompensateTransactionInput! | ResourceResponse! | E-400-001, E-400-005, E-403-001, E-404-001, E-409-003, E-422-001-COMP-001, E-500-002 |
| CreateMember | `mutation { createMember(input: ...) }` | CreateMemberInput! | ResourceResponse! | E-400-001, E-400-002, E-400-003, E-404-001, E-409-002, E-422-001-MEM-001, E-422-001-EMAIL-001, E-422-001-STATUS-010, E-500-002 |
| UpdateMember | `mutation { updateMember(input: ...) }` | UpdateMemberInput! | UpdateResponse! | E-400-001, E-404-001, E-403-001, E-422-001-MEM-001, E-500-002 |
| TransitionMemberStatus | `mutation { transitionMemberStatus(input: ...) }` | TransitionMemberStatusInput! | UpdateResponse! | E-400-005, E-404-001, E-403-001, E-409-003, E-422-001-STATUS-010, E-500-002 |
| SearchResources | `query { searchResources(filters: ..., pagination: ...) }` | FilterInput, CursorPaginationInput | ResourceSearchResult! | E-400-006, E-404-002, E-500-002 |
| ExportResources | `query { exportResources(format: ..., filters: ...) }` | ExportFormat!, FilterInput | ExportBlob! | E-400-004, E-404-002, E-500-002 |

### 3.4 RelationshipAggregate (6 operations: 3 Commands, 3 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| AddMemberToGroup | `mutation { addMemberToGroup(input: ...) }` | AddMemberToGroupInput! | RelationshipResponse! | E-400-001, E-400-005, E-403-001, E-409-004, E-500-002 |
| RemoveMemberFromGroup | `mutation { removeMemberFromGroup(input: ...) }` | RemoveMemberFromGroupInput! | UpdateResponse! | E-400-001, E-400-005, E-403-001, E-404-001, E-500-002 |
| SetOrgUnitParent | `mutation { setOrgUnitParent(input: ...) }` | SetOrgUnitParentInput! | UpdateResponse! | E-400-005, E-403-001, E-409-003, E-422-001-REL-001, E-422-001-REL-002, E-500-002 |
| GetDescendants | `query { descendants(unitId: ...) }` | (unitId: UUID!) | [OrgUnit!]! | E-404-001, E-422-001-REL-002, E-500-002 |
| GetAllGroupsForMember | `query { groupsForMember(memberId: ...) }` | (memberId: UUID!) | [GroupMembership!]! | E-404-001, E-500-002 |
| GetAllMembersOfGroup | `query { membersOfGroup(groupId: ...) }` | (groupId: UUID!) | [MemberRecord!]! | E-404-001, E-500-002 |

### 3.5 WorkflowAggregate (6 operations: 5 Commands, 1 Query)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| TriggerWorkflow | `mutation { triggerWorkflow(input: ...) }` | TriggerWorkflowInput! | WorkflowResponse! | E-400-001, E-404-004, E-404-001, E-403-001, E-422-001-WF-005, E-500-002 |
| ApproveStep | `mutation { approveStep(input: ...) }` | ApproveStepInput! | UpdateResponse! | E-400-005, E-401-001, E-403-001, E-404-001, E-409-003, E-422-001-WF-001, E-500-002 |
| RejectStep | `mutation { rejectStep(input: ...) }` | RejectStepInput! | UpdateResponse! | E-400-005, E-401-001, E-403-001, E-404-001, E-409-003, E-500-002 |
| CancelWorkflow | `mutation { cancelWorkflow(input: ...) }` | CancelWorkflowInput! | UpdateResponse! | E-400-005, E-403-001, E-404-001, E-409-003, E-500-002 |
| ResubmitForApproval | `mutation { resubmitForApproval(input: ...) }` | ResubmitForApprovalInput! | UpdateResponse! | E-400-005, E-401-001, E-403-001, E-404-001, E-409-003, E-422-001-RETRY-004, E-500-002 |
| GetPendingApprovals | `query { pendingApprovals }` | (no input — resolves from auth context) | [WorkflowStep!]! | E-500-002 |

### 3.6 FormAggregate (4 operations: 1 Command, 3 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| ValidateFormData | `mutation { validateFormData(input: ...) }` | ValidateFormDataInput! | ValidationResult! | E-400-001, E-400-005, E-404-004, E-422-001-FRM-009, E-422-001-VOCAB-002, E-422-001-DUAL-008, E-422-001-LOCK-004, E-500-002 |
| LoadFormDefinition | `query { formDefinition(formId: ...) }` | (formId: String!, version: String) | FormDefinition! | E-404-004, E-500-002 |
| RenderForm | `query { renderForm(formId: ...) }` | (formId: String!, data: JSON) | RenderTree! | E-404-004, E-422-001-FRM-009, E-422-001-VOCAB-002, E-500-002 |
| GetVisibleFields | `query { visibleFields(formId: ...) }` | (formId: String!, context: JSON) | [FormField!]! | E-404-004, E-422-001-FRM-009, E-500-002 |

### 3.7 NotificationAggregate (6 operations: 6 Commands, 0 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| SendNotification | `mutation { sendNotification(input: ...) }` | SendNotificationInput! | NotificationResponse! | E-400-001, E-400-004, E-403-001, E-404-001, E-422-001-NOT-001, E-422-001-RATE-002, E-422-001-CHANNEL-003, E-422-001-QUIET-004, E-500-002 |
| MarkAsRead | `mutation { markAsRead(input: ...) }` | MarkAsReadInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-500-002 |
| UpdatePreferences | `mutation { updatePreferences(input: ...) }` | UpdatePreferencesInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-500-002 |
| SetRateLimit | `mutation { setRateLimit(input: ...) }` | SetRateLimitInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-500-002 |
| SuppressUntil | `mutation { suppressUntil(input: ...) }` | SuppressUntilInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-500-002 |
| QueueNotification | `mutation { queueNotification(input: ...) }` | QueueNotificationInput! | NotificationResponse! | E-400-001, E-400-004, E-403-001, E-404-001, E-422-001-NOT-001, E-422-001-RATE-002, E-422-001-CHANNEL-003, E-500-002 |

### 3.8 VocabularyAggregate (7 operations: 2 Commands, 5 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| AddTermValue | `mutation { addTermValue(input: ...) }` | AddTermValueInput! | VocabularyResponse! | E-400-001, E-400-004, E-403-001, E-409-002, E-422-001-STABLE-003, E-422-001-TRANSLATION-002, E-500-002 |
| DeprecateTermValue | `mutation { deprecateTermValue(input: ...) }` | DeprecateTermValueInput! | UpdateResponse! | E-400-001, E-403-001, E-404-005, E-409-005, E-422-001-VOC-001, E-500-002 |
| ResolveLabel | `query { resolveLabel(namespace: ..., termKey: ..., lang: ...) }` | (namespace, termKey, lang — scalars) | String! | E-404-005, E-500-002 |
| GetTerms | `query { terms(namespace: ...) }` | (namespace: String!) | [Term!]! | E-404-005, E-500-002 |
| GetTermValues | `query { termValues(namespace: ..., termKey: ...) }` | (namespace, termKey — scalars) | [TermValue!]! | E-404-005, E-500-002 |
| SearchTerms | `query { searchTerms(query: ..., namespace: ...) }` | (query: String!, namespace: String) | [Term!]! | E-500-002 |
| GetAllNamespaces | `query { namespaces }` | (no input) | [String!]! | E-500-002 |

### 3.9 ReportingAggregate (4 operations: 1 Command, 3 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| GenerateReport | `mutation { generateReport(input: ...) }` | GenerateReportInput! | ReportResponse! | E-400-001, E-400-006, E-403-001, E-422-001-MONTH-001, E-500-002 |
| CalculateBalance | `query { balance(scope: ..., periodStart: ..., periodEnd: ...) }` | (scope, periodStart, periodEnd — scalars) | BalanceTotals! | E-400-006, E-403-001, E-500-001 |
| ExportReport | `query { reportExport(reportId: ..., format: ...) }` | (reportId: UUID!, format: ExportFormat) | ExportFile! | E-400-004, E-404-001, E-403-001, E-500-002 |
| GetReportTypes | `query { reportTypes }` | (no input) | [ReportTypeDef!]! | E-500-002 |

### 3.10 AuditAggregate (3 operations: 1 Command, 2 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| LogAction | `mutation { logAction(input: ...) }` | LogActionInput! | AuditResponse! | E-400-001, E-401-001, E-403-001, E-422-001-AUD-001, E-422-001-AUD-OLDNEW-002, E-500-002 |
| QueryAuditLogs | `query { auditLogs(filters: ..., pagination: ...) }` | AuditLogFilters!, CursorPaginationInput | PaginatedResponse! | E-403-001, E-500-002 |
| ExportAuditTrail | `query { auditTrail(period: ..., format: ...) }` | (period: String!, format: ExportFormat) | ExportData! | E-400-004, E-403-001, E-500-002 |

### 3.11 LifecycleAggregate (7 operations: 5 Commands, 2 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| ArchiveResource | `mutation { archiveResource(input: ...) }` | ArchiveResourceInput! | LifecycleResponse! | E-400-001, E-400-005, E-403-001, E-404-001, E-422-001-LIF-001, E-500-002 |
| TrashResource | `mutation { trashResource(input: ...) }` | TrashResourceInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-409-003, E-500-002 |
| PurgeResource | `mutation { purgeResource(input: ...) }` | PurgeResourceInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-409-006, E-422-001-LIF-003, E-422-001-LIF-005, E-500-002 |
| RestoreFromTrash | `mutation { restoreFromTrash(input: ...) }` | RestoreFromTrashInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-409-003, E-500-002 |
| ApplyTags | `mutation { applyTags(input: ...) }` | ApplyTagsInput! | UpdateResponse! | E-400-001, E-403-001, E-404-001, E-500-002 |
| SchedulePurge | `mutation { schedulePurge(input: ...) }` | SchedulePurgeInput! | LifecycleResponse! | E-400-001, E-400-006, E-403-001, E-404-001, E-422-001-LIF-005, E-500-002 |
| ListArchiveEntries | `query { archiveEntries(filters: ...) }` | (filters: ArchiveFilters) | ArchiveResult! | E-500-002 |
| SearchArchives | `query { searchArchives(query: ..., tags: ..., type: ...) }` | (query: String!, tags: [String!], type: String) | ArchiveResult! | E-500-002 |

### 3.12 ConfigurationAggregate (4 operations: 2 Commands, 2 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| UpdateSetting | `mutation { updateSetting(input: ...) }` | UpdateSettingInput! | UpdateResponse! | E-400-001, E-403-001, E-422-001-CFG-001, E-422-001-CFG-002, E-422-001-CFG-003, E-500-002 |
| ResetToDefaults | `mutation { resetToDefaults }` | (no input) | UpdateResponse! | E-403-001, E-500-002 |
| GetSetting | `query { setting(key: ...) }` | (key: String!) | SettingValue! | E-404-001, E-500-002 |
| GetAllSettings | `query { settings }` | (no input) | [SettingEntry!]! | E-403-001, E-500-002 |

### 3.13 OfflineSyncAggregate (6 operations: 4 Commands, 2 Queries)

| Canonical Op | GraphQL Query/Mutation | Input Type | Output Type | Possible Error Extensions |
|---|---|---|---|---|
| PushPendingOperations | `mutation { pushPendingOperations(input: ...) }` | PushPendingOperationsInput! | SyncResponse! | E-400-001, E-400-007, E-422-001-SYNC-001, E-422-001-SYNC-002, E-422-001-SYNC-003, E-422-001-SYNC-004, E-500-002 |
| PullRemoteChanges | `mutation { pullRemoteChanges(input: ...) }` | PullRemoteChangesInput! | UpdateResponse! | E-400-001, E-404-001, E-500-002 |
| ResolveConflict | `mutation { resolveConflict(input: ...) }` | ResolveConflictInput! | UpdateResponse! | E-400-001, E-400-005, E-400-007, E-403-001, E-500-002 |
| MarkOperationConfirmed | `mutation { markOperationConfirmed(input: ...) }` | MarkOperationConfirmedInput! | UpdateResponse! | E-400-001, E-400-005, E-500-002 |
| CheckConnectivity | `query { connectivity }` | (no input) | ConnectivityState! | E-500-002 |
| GetSyncStatus | `query { syncStatus(tableName: ...) }` | (tableName: String!) | SyncStatusTracker! | E-404-001, E-500-002 |

---

## Section 4: Error Handling in GraphQL

### 4.1 Canonical Error → GraphQL Error Mapping

Toutes les erreurs de l'adapter GraphQL suivent le schema de reponse GraphQL avec `data: null` et `errors[]` rempli. Le mapping respect scrupuleusement la Regle A-004 (**PROTO-001** Section 7.4).

**Exemple de reponse d'erreur GraphQL complet :**

```json
{
  "data": null,
  "errors": [
    {
      "message": "Invariant FIN-002 violated: amount must be positive",
      "locations": [{ "line": 2, "column": 5 }],
      "path": ["createTransaction"],
      "extensions": {
        "code": "E-422-001-FIN-002",
        "requestId": "550e8400-e29b-41d4-a716-446655440000",
        "details": { "field": "amountCents", "constraint": "> 0", "invariant": "FIN-002" },
        "severity": "DOMAIN_VIOLATION",
        "category": "E-422"
      }
    }
  ]
}
```

### 4.2 Error Severity Classification

Chaque extension d'erreur GraphQL inclut un champ `severity` qui classe l'erreur pour le client :

| Severity Value | Maps To | Categories Covered |
|---------------|---------|-------------------|
| `PARSE_ERROR` | Parsing failures (Step 1 of PROTO-001 pipeline) | Malformed GraphQL, invalid syntax |
| `VALIDATION_ERROR` | Client input errors | E-400-001 through E-400-007 |
| `AUTHENTICATION_ERROR` | Auth failures | E-401-001 through E-401-003 |
| `AUTHORIZATION_ERROR` | Permission failures | E-403-001 through E-403-005 |
| `NOT_FOUND_ERROR` | Entity not found | E-404-001 through E-404-006 |
| `CONFLICT_ERROR` | State conflicts | E-409-001 through E-409-006 |
| `DOMAIN_VIOLATION` | Invariant/business rule breaches | E-422-001 and all extended variants |
| `INTERNAL_ERROR` | System failures | E-500-001 through E-500-004 |

### 4.3 Field-Level vs Global Errors

GraphQL supporte deux niveaux d'erreurs :

**Global errors** (operation-level) — retournées dans `errors[].extensions` :
- Authentification/Echeec d'autorisation
- Erreurs de parsing complet de la requête
- Échecs de persistance système
- Violations d'invariants globales (non-field-specific)

**Field-level errors** — retournées comme erreurs sur le field spécifique :
- Validation de champs individuels (un champ du payload est mal formé)
- Contraintes spécifiques à un champ (email dupliqué, format invalide)
- Transitions d'état échouées sur un entity donné

**Règle G-ERR-001 :** Si une erreur affecte un champ unique du payload (ex: `amount_cents <= 0`), l'adapter retourne l'erreur sur le field GraphQL concerné. Si l'erreur est globale (ex: org suspendue), l'adapter retourne une erreur globale.

### 4.4 Complete Error Code → GraphQL Extension Mapping

Le tableau ci-dessous couvre TOUS les codes d'erreur canoniques d'**API-CONTRACT-005** avec leur mapping vers les extensions GraphQL.

#### E-400-NNN (BAD_REQUEST)

```json
{
  "extensions": {
    "code": "E-400-NNN",
    "severity": "VALIDATION_ERROR",
    "category": "E-400"
  }
}
```

| Error Code | GraphQL Message Template | Typical Details |
|------------|------------------------|-----------------|
| E-400-001 | `Invalid input: {field} is required` | `{ "field": "...", "expected": "present" }` |
| E-400-002 | `Invalid value: {field} must satisfy {constraint}` | `{ "field": "...", "constraint": "> 0" }` |
| E-400-003 | `Invalid format: {field} does not match {pattern}` | `{ "field": "...", "pattern": "^[^@]+@[^@]+$" }` |
| E-400-004 | `Invalid enum: {field} must be one of {values}` | `{ "field": "...", "allowed": ["A","B"] }` |
| E-400-005 | `Invalid reference: {entity} {id} not found` | `{ "entity": "...", "id": "uuid" }` |
| E-400-006 | `Invalid date range: {field1} must be before {field2}` | `{ "from": "date", "to": "date" }` |
| E-400-007 | `Invalid payload structure` | `{ "schema": "..." }` |

#### E-401-NNN (UNAUTHORIZED)

```json
{
  "extensions": {
    "code": "E-401-NNN",
    "severity": "AUTHENTICATION_ERROR",
    "category": "E-401"
  }
}
```

| Error Code | GraphQL Message Template |
|------------|------------------------|
| E-401-001 | `Not authenticated: provide a valid Authorization header` |
| E-401-002 | `Session expired: refresh your token` |
| E-401-003 | `Invalid credentials` |

#### E-403-NNN (FORBIDDEN)

```json
{
  "extensions": {
    "code": "E-403-NNN",
    "severity": "AUTHORIZATION_ERROR",
    "category": "E-403"
  }
}
```

| Error Code | GraphQL Message Template |
|------------|------------------------|
| E-403-001 | `Insufficient permission: required {permission}` |
| E-403-002 | `Organization mismatch: request org does not match session org` |
| E-403-003 | `Role violation: {role} cannot perform {action}` |
| E-403-004 | `Organization suspended: write operations blocked` |
| E-403-005 | `Organization archived: operations blocked` |

#### E-404-NNN (NOT_FOUND)

```json
{
  "extensions": {
    "code": "E-404-NNN",
    "severity": "NOT_FOUND_ERROR",
    "category": "E-404"
  }
}
```

| Error Code | GraphQL Message Template |
|------------|------------------------|
| E-404-001 | `Entity not found: {entity} with id {id}` |
| E-404-002 | `Tenant not found: no access to organization {orgId}` |
| E-404-003 | `Session not found or already revoked` |
| E-404-004 | `Form definition not found: {formId}` |
| E-404-005 | `Vocabulary term not found: {namespace}/{termKey}/{value}` |
| E-404-006 | `Workflow definition not found: {definitionKey}` |

#### E-409-NNN (CONFLICT)

```json
{
  "extensions": {
    "code": "E-409-NNN",
    "severity": "CONFLICT_ERROR",
    "category": "E-409"
  }
}
```

| Error Code | GraphQL Message Template |
|------------|------------------------|
| E-409-001 | `Optimistic lock conflict: version mismatch, retry with latest version` |
| E-409-002 | `Unique constraint violation: {entity}.{field} already exists` |
| E-409-003 | `Invalid state transition: {currentState} → {requestedState} not allowed` |
| E-409-004 | `Duplicate membership: member already in group` |
| E-409-005 | `Already deprecated: {namespace}/{termKey}/{value} is already deprecated` |
| E-409-006 | `Already purged: purge is irreversible, entity no longer exists` |

#### E-422-NNN (DOMAIN_VIOLATION)

```json
{
  "extensions": {
    "code": "E-422-NNN[-INV_ID]",
    "severity": "DOMAIN_VIOLATION",
    "category": "E-422",
    "invariant": "INV-ID or business-rule-id"
  }
}
```

Les codes étendus d'E-422 incluent TOUS le champ `invariant` dans `extensions.details` :

| Extended Code | Invariant | GraphQL Message |
|--------------|-----------|----------------|
| E-422-001-FIN-001 | FIN-001 | `Transaction is immutable: approved/cancelled transactions cannot be modified` |
| E-422-001-FIN-002 | FIN-002 | `Amount must be positive: amount_cents > 0 required (BIGINT cents)` |
| E-422-001-DATE-001 | DATE-001 | `Date cannot be in the future: transaction_date must be today or earlier` |
| E-422-001-CAT-001 | CAT-001 | `Category must be from vocabulary: category_ref not found in vocab_values` |
| E-422-001-DESC-001 | DESC-001 | `Description required for large amounts: amount exceeds threshold` |
| E-422-001-VERSION-001 | VERSION-001 | `Version was not incremented: each write must increment version` |
| E-422-001-COMP-001 | COMP-001 | `Compensating transaction requires link to original: compensates_for is required` |
| E-422-001-SCOPE-001 | SCOPE-001 | `Scope is mandatory: scope_type must be defined for all transactions` |
| E-422-001-MEM-001 | MEM-001 | `Both firstName and lastName are required for every member` |
| E-422-001-EMAIL-001 | EMAIL-001 | `Email already exists within this organization` |
| E-422-001-STATUS-010 | STATUS-010 | `Invalid status: must be one of active/inactive/deceased/transferred` |
| E-422-001-DISABLE-011 | DISABLE-011 | `Inactive members cannot create transactions` |
| E-422-001-REL-001 | REL-001 | `Cycle detected in hierarchy: use Kahn's algorithm to find valid parent` |
| E-422-001-REL-002 | REL-002 | `Depth exceeded: maximum org hierarchy depth is 5` |
| E-422-001-WF-001 | WF-001 | `Step timeout exceeded: workflow step past 30-day limit` |
| E-422-001-WF-005 | WF-005 | `Workflows cannot directly modify approved financial transactions` |
| E-422-001-RETRY-004 | RETRY-004 | `Automatic retry is blocked: manual resubmit only allowed` |
| E-422-001-FRM-009 | FRM-009 | `Hardcoded forms not allowed: all forms must come from FormDefinition manifest` |
| E-422-001-VOCAB-002 | VOCAB-002 | `Select option references non-existent vocabulary term` |
| E-422-001-DUAL-008 | DUAL-008 | `Client/server validation mismatch: identical validation schemas required on both sides` |
| E-422-001-LOCK-004 | LOCK-004 | `Financial form cannot be modified after submission` |
| E-422-001-NOT-001 | NOT-001 | `Notifications must have a trigger source: never spontaneous` |
| E-422-001-RATE-002 | RATE-002 | `Rate limit exceeded: too many notifications per hour` |
| E-422-001-CHANNEL-003 | CHANNEL-003 | `Channel blocked by user preference: respect user channel preferences` |
| E-422-001-QUIET-004 | QUIET-004 | `Non-critical notification during quiet hours: wait or use critical severity` |
| E-422-001-VOC-001 | VOC-001 | `Values can only be deprecated, never deleted` |
| E-422-001-TRANSLATION-002 | TRANSLATION-002 | `Minimum translations not met: both French and English labels required` |
| E-422-001-STABLE-003 | STABLE-003 | `Keys are immutable after creation` |
| E-422-001-AUD-001 | AUD-001 | `Audit logs are append-only and immutable: UPDATE/DELETE not permitted` |
| E-422-001-LIF-001 | LIF-001 | `Resource type not archivable: must be declared in manifest.lifecycle.types[]` |
| E-422-001-LIF-003 | LIF-003 | `Cannot purge non-trashed entry: entry must be trashed before purge` |
| E-422-001-LIF-005 | LIF-005 | `Purge date not reached: wait until configured purge date` |
| E-422-001-CFG-001 | CFG-001 | `Invalid currency format: use ISO 4217 (e.g., CDF, USD, EUR)` |
| E-422-001-CFG-002 | CFG-002 | `Invalid timezone: use IANA format (e.g., Africa/Lubumbashi)` |
| E-422-001-CFG-003 | CFG-003 | `Invalid accent color: use hex (#RRGGBB) with sufficient WCAG contrast` |
| E-422-001-SYNC-001 | SYNC-001 | `Remote write attempted before local write completed: local FIRST always` |
| E-422-001-SYNC-002 | SYNC-002 | `Batch size exceeded: maximum 50 operations per push batch` |
| E-422-001-SYNC-003 | SYNC-003 | `Maximum retries exceeded: 5 retry attempts with exponential backoff reached` |
| E-422-001-SYNC-004 | SYNC-004 | `Sync operation blocked user action: user ops never depend on sync synchronously` |

#### E-500-NNN (INTERNAL_ERROR)

```json
{
  "extensions": {
    "code": "E-500-NNN",
    "severity": "INTERNAL_ERROR",
    "category": "E-500",
    "retryAfterMs": 1000  // only for E-500-004
  }
}
```

| Error Code | GraphQL Message | retry-after? |
|------------|----------------|-------------|
| E-500-001 | `Unexpected system error: {detail}. Contact support with request ID.` | No |
| E-500-002 | `Database operation failed. Retry after exponential backoff.` | Yes (E-500-004 only) |
| E-500-003 | `Domain event payload serialization error: {detail}. Internal error.` | No |
| E-500-004 | `Dependent aggregate unavailable: {service}. Retry later.` | Yes |

### 4.5 Retry-After Hints

Pour les erreurs E-500-004 (DEPENDENCY_FAILURE), l'extension GraphQL inclut `retryAfterMs` pour guider le client dans son retry policy :

```json
{
  "extensions": {
    "code": "E-500-004",
    "severity": "INTERNAL_ERROR",
    "category": "E-500",
    "retryAfterMs": 2000,
    "dependency": "ResourceAggregate",
    "message": "Downstream service ResourceAggregate unavailable"
  }
}
```

---

## Section 5: Schema Introspection & Compliance

### 5.1 Schema Validation Rules

Chaque schema GraphQL expose par l'adapter DOIT passer ces validations :

**G-COMP-001: Source Canonique Requis**

Chaque Query ou Mutation root field DOIT avoir une description contenant `source_canonical: <operation-id>` pointant vers l'operation d'**API-CONTRACT-001**. Exemple :

```graphql
"""
Creates a new transaction record within the organization.
source_canonical: CreateTransaction
request_contract: API-CONTRACT-002 § CreateTransaction
error_codes: E-400-001, E-422-001-FIN-002, ...
"""
mutation createTransaction(input: CreateTransactionInput!): ResourceResponse!
```

**G-COMP-002: Pas de Types Custom Hors Contrats Canoniques**

Aucun type GraphQL ne peut etre defini en dehors des types explicitement derives des Request/Response Contracts d'**API-CONTRACT-002**. Exception : les scalars partagés (DateTime, UUID, BigInt, JSON), les enums canoniques, et les types de pagination cursor-based (PageInfo, edges/nodes).

**G-COMP-003: Operations Requiert QRC Reference**

Tout nouveau root field ajoute au schema doit inclure une reference `qrc:` pointing to the Request Contract number in **API-CONTRACT-002**. Par exemple : `qrc: "§CreateTransaction"`.

**G-COMP-004: Meme Verification Rules Que Autres Protocol Specs**

Le schema GraphQL passe les memes regles de verification que les autres specifiers de protocol (**PROTO-001** Section 9.2) :

| Check | Description |
|-------|-------------|
| GC-01 | parseGraphQLInput produit toujours un CanonicalRequest valide conforme a API-CONTRACT-002 |
| GC-02 | serializeGraphQLOutput respecte le mapping de status codes de PROTO-001 Section 5 |
| GC-03 | mapGraphQLError preserve le error_code canonique pour les 42+ codes + variantes étendues |
| GC-04 | Aucun import de business logic (grep pour INV-, BR-, FIN-, DATE-, CAT- dans le code adapter) |
| GC-05 | Pas de lecture directe de base de donnees |
| GC-06 | Configuration externe uniquement |
| GC-07 | Determinisme verifie (meme input → meme output, teste 2x) |
| GC-08 | Aucune reference aux 83 operations autre que operationId string literal |
| GC-09 | Tous les 26 Queries present dans QueryRoot |
| GC-10 | Toutes les 57 Mutations presentes dans MutationRoot |

### 5.2 Directive Schema Pour Authorization

L'adapter doit definire la directive `@auth` pour le field-level authorization (Principe G-006) :

```graphql
"""
Authorize a field based on RBAC permission grants.
Maps to API-CONTRACT-004 permission hierarchy.
"""
directive @auth(
  """Required permission string in format resource:action:level"""
  permission: String!
  """Optional: alternative permissions (first match wins)"""
  altPermissions: [String!]
  """Optional: operator for combining permissions (AND/OR, default OR)"""
  operator: AuthOperator = OR
) on FIELD_DEFINITION

enum AuthOperator {
  AND
  OR
}
```

### 5.3 Schema Filing et Versionning

Le schema GraphQL complete est une sortie derivée du Canonical Contract, pas une source independent. Toute modification du schema GraphQL DOIT etre precedee d'une modification du contrat canonique correspondant (**API-CONTRACT-001** / **API-CONTRACT-002**).

### 5.4 Subscription Support (Future Extensibility)

Bien que le schema courant ne definisse pas de subscriptions GraphQL, la structure prepare la voie pour l'avenir :

```graphql
"""
Reserved for real-time event streaming (future feature).
Would map to Domain Events from DOC-014 via EventPublicationPort (PAS-001 Port-003).
Not yet implemented in v1.
"""
type SubscriptionRoot {
  # Reserved: onDomainEvent(aggregate: AggregateType!, eventType: EventType!): DomainEvent!
  # Reserved: onConflictDetected(tableName: String!): ConflictEvent!
  # Reserved: onConnectivityChanged(state: ConnectivityState!): ConnectivityEvent!
}
```

### 5.5 Batch Operations

GraphQL ne supporte pas nativement les batch requests au niveau canonical. Si plusieurs operations doivent etre executees, le clientfait plusieurs appels sequentiels ou concurrently via son propre orchestrateur. L'adapter ne combine JAMAIS deux operations canoniques en une seule requête GraphQL.

**Exception pour les mutli-mutations dans un seul appel GraphQL** (same HTTP request) : le client peut envoyer plusieurs mutations dans un seul document GraphQL, mais l'adapter les traite comme des operations separees, chacune produisant son propre Canonical Request independant. L'atomicite cross-mutation n'est GARANTIE par l'adapter — elle releve de Saga pattern (**ASS-003** Pattern 3) et est geree par l'Application Service.

---

## Section 6: Compliance Statement

Ce document PROTO-003 est conforme a l'ensemble des specifications canoniques de Lumina v1 :

- **API-CONTRACT-001** : Toutes les 83 operations sont mappees dans la Section 3 avec leurs operations GraphQL correspondantes, types d'input, types de sortie, et codes d'erreur possibles.
- **API-CONTRACT-002** : Tous les types GraphQL derives respectent les Request/Response/Error contracts des Sections 2.1, 2.2, 2.3 et 2.4 (pagination).
- **API-CONTRACT-005** : Les 42+ codes d'erreur canoniques (categories E-400 a E-500 avec toutes les variantes étendues) sont mappees dans la Section 4 avec leur format GraphQL extensions.
- **PROTO-001** : Les 8 regles communes a tous les adapters (Sections 7.1-7.8) sont respectees et renforcees par les regles G-001 a G-008 de cette specification. Le pipeline universel de transformation (Section 3) est conserve intact.
- **ASS-003** : Les workflows canoniques de 8 étapes sont preserves ; l'adapter GraphQL ne derange aucune étape, il ne fait que traduire les bornes d'entree/sortie.
- **ASS-004** : La coordination cross-aggregate est maintenue via event bus (pas de mutations nestedes, Principe G-004).
- **PAS-001/PAS-003** : Les 17 Ports sont invisibles de l'adapter. Les 12 Dependency Rules sont respectees, notamment DR-011 (no business logic) et DR-009 (tenant isolation).

Aucun element de ce document n'invente de nouvelle operation, invariant, port, adapter, ou technologie. Chaque ligne est directement tracable vers au moins un document source canonique liste dans le header.

---

## Glossaire

| Terme | Definition |
|-------|-----------|
| **QueryRoot** | Type racine GraphQL contenant les 26 Query root fields mappés vers les 26 Query operations d'API-CONTRACT-001 |
| **MutationRoot** | Type racine GraphQL contenant les 57 Mutation root fields mapper vers les 57 Command operations d'API-CONTRACT-001 |
| **Canonical Input Type** | Type GraphQL Input derive directement du Request Contract d'API-CONTRACT-002 pour une operation donnee |
| **Canonical Response Type** | Type GraphQL object derive directement du Response Contract d'API-CONTRACT-002 pour une operation donnee |
| **Cursor Pagination** | Format de pagination GraphQL edges/node avec opaque cursor tokens et PageInfo metadata |
| **Error Extension** | Champ GraphQL `extensions` contenant le error_code canonique, le requestId, et les metadata d'erreur |
| **@auth Directive** | Directive GraphQL personnalisée pour le field-level authorization basée sur RBAC (API-CONTRACT-004) |
| **Source Canonical** | Metadonnée dans la description du schema GraphQL pointant vers l'operation API-CONTRACT-001 source |

---

*Document termine.*
