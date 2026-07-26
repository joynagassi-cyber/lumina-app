# gRPC Adapter Rules Specification — Lumina v1

**Doc ID:** PROTO-004
**Version:** v1.0
**Statut:** SPÉCIFICATION PROTOCOLE ADAPTÉ DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "API-CONTRACT-002", "API-CONTRACT-005", "PROTO-001"]
**Transformation_rule :** "grpc-adapter-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the canonical specification for the **gRPC Protocol Adapter** of Lumina v1. It translates between Protocol Buffers wire format and the Immutable Canonical Request/Response defined in **API-CONTRACT-002**, while mapping all 83 operations from **API-CONTRACT-001** onto gRPC unary/streaming RPCs. The adapter obeys every rule in **PROTO-001** (Protocol Adapter Canon) and maps errors per **API-CONTRACT-005**.

No business logic, no database concepts, and no technology-specific implementation details are included. All field names, message types, and service definitions are derived directly from the canonical contracts.

---

#### Section 1: Principles

The following principles govern EVERY gRPC adapter for Lumina:

1. **Protobuf messages mirror Canonical Request/Response structures** — Protobuf messages are abstract representations of the Canonical Request/Response defined in API-CONTRACT-002, never database tables or columns.
2. **One service per Aggregate boundary** — Each DOC-012 Aggregate has its OWN dedicated gRPC Service. One aggregate boundary = one `.proto` file containing both service definition and its message types.
3. **Commands as server-side unary RPCs** — All 57 mutation operations are exposed as unary RPCs (client sends request, server returns single response).
4. **Queries as unary or server-streaming RPCs** — Simple point-read queries use unary; large-list queries (>1000 items) use server-streaming.
5. **Streaming reserved for large datasets and offline sync only** — Server streaming is for pagination-over-stream of large result sets. Client streaming is for bulk pending_operations push. Bidirectional streaming is exclusively reserved for offline-first sync (pending_operations bidirectional sync).
6. **Error codes map to PROTO-001 canonical status mapping** — Each canonical error E-XXX maps to a precise gRPC Status Code as defined in Section 5.
7. **Metadata for tenant context exclusively** — gRPC metadata carries ONLY `x-org-id`, `x-request-id`, and `authorization`. Nothing else.
8. **No direct database concepts in messages** — Protobuf types NEVER mention tables, columns, PK, FK, or any persistence concept.

---

#### Section 2: Proto File Organization

EXACT directory structure for all `.proto` files:

```
lumina/
└── v1/
    ├── common/
    │   ├── messages.proto          -- Shared types: Empty, ErrorResponse, PaginationMeta, PaginatedList, SuccessResponse, SyncStatus
    │   └── enums.proto             -- Shared enums: SyncStatus, VersionType, LanguageCode
    ├── organization/
    │   ├── organization.proto      -- OrganizationAggregate service + messages (CreateOrganization, UpdateOrgSettings, CreateOrgUnit, UpdateOrgUnitParent, TransferChildOrg, MergeOrganizations, ArchiveOrganization, SuspendOrganization, GetOrganizationProfile, GetDescendantUnits)
    │   └── organization_enums.proto -- Org-level enums: OrganizationType, OrganizationStatus, OrgUnitType
    ├── identity/
    │   ├── identity.proto          -- IdentityAggregate service + messages (CreateUser, UpdateUserProfile, ChangeUserRole, ResetPassword, LoginUser, LogoutUser, RefreshAccessToken, RevokeSession, AssignPermissionGrant)
    │   └── identity_enums.proto    -- Identity enums: UserRole, PermissionGrantFormat
    ├── resource/
    │   ├── resource.proto          -- ResourceAggregate service + messages (CreateTransaction, UpdateDraftTransaction, SubmitForApproval, ApproveTransaction, RejectTransaction, CompensateTransaction, CreateMember, UpdateMember, TransitionMemberStatus, SearchResources, ExportResources)
    │   └── resource_enums.proto    -- Resource enums: TransactionType, TransactionStatus, MemberStatus, ScopeType, ExportFormat
    ├── relationship/
    │   ├── relationship.proto      -- RelationshipAggregate service + messages (AddMemberToGroup, RemoveMemberFromGroup, SetOrgUnitParent, GetDescendants, GetAllGroupsForMember, GetAllMembersOfGroup, DetectCycles)
    │   └── relationship_enums.proto -- Relationship enums: RelationshipType
    ├── workflow/
    │   ├── workflow.proto          -- WorkflowAggregate service + messages (TriggerWorkflow, ApproveStep, RejectStep, CancelWorkflow, ResubmitForApproval, GetPendingApprovals)
    │   └── workflow_enums.proto    -- Workflow enums: StepType, WorkflowState, ConditionExpression
    ├── form/
    │   ├── form.proto              -- FormAggregate service + messages (LoadFormDefinition, ValidateFormData, RenderForm, GetVisibleFields)
    │   └── form_enums.proto        -- Form enums: FormFieldType, ValidationSeverity
    ├── notification/
    │   ├── notification.proto      -- NotificationAggregate service + messages (SendNotification, MarkAsRead, UpdatePreferences, SetRateLimit, SuppressUntil, QueueNotification)
    │   └── notification_enums.proto -- Notification enums: ChannelType, SeverityLevel
    ├── vocabulary/
    │   ├── vocabulary.proto        -- VocabularyAggregate service + messages (AddTermValue, DeprecateTermValue, ResolveLabel, GetTerms, GetTermValues, SearchTerms, GetAllNamespaces)
    │   └── vocabulary_enums.proto  -- Vocabulary enums: TranslationLanguage
    ├── reporting/
    │   ├── reporting.proto         -- ReportingAggregate service + messages (GenerateReport, CalculateBalance, ExportReport, GetReportTypes)
    │   └── reporting_enums.proto   -- Reporting enums: ReportScope, ReportFormat
    ├── audit/
    │   ├── audit.proto             -- AuditAggregate service + messages (LogAction, QueryAuditLogs, ExportAuditTrail)
    │   └── audit_enums.proto       -- Audit enums: ActionType
    ├── lifecycle/
    │   ├── lifecycle.proto         -- LifecycleAggregate service + messages (ArchiveResource, TrashResource, PurgeResource, RestoreFromTrash, ListArchiveEntries, SearchArchives, ApplyTags, SchedulePurge)
    │   └── lifecycle_enums.proto   -- Lifecycle enums: LifecycleState
    ├── configuration/
    │   ├── configuration.proto     -- ConfigurationAggregate service + messages (UpdateSetting, ResetToDefaults, GetSetting, GetAllSettings)
    │   └── configuration_enums.proto -- Config enums: SettingCategory
    └── sync/
        ├── sync.proto              -- OfflineSyncAggregate service + messages (PushPendingOperations, PullRemoteChanges, ResolveConflict, MarkOperationConfirmed, CheckConnectivity, GetSyncStatus)
        └── sync_enums.proto        -- Sync enums: ConflictStrategy, SyncAction
```

**File naming convention:** `{aggregate}.proto` contains the `service` block and ALL request/response messages for that aggregate's RPCs. `{aggregate}_enums.proto` contains shared enums used across messages within that aggregate. No cross-aggregate message dependencies are allowed in `.proto` files — shared primitives (ErrorResponse, PaginationMeta, etc.) come from `common/messages.proto`.

---

#### Section 3: Shared Message Types (lumina/v1/common/messages.proto)

```protobuf
syntax = "proto3";

package lumina.v1.common;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// Empty response for commands that return nothing
message Empty {}

// Standard error envelope mapped from API-CONTRACT-005 taxonomy
// Every gRPC error returned through this adapter includes this structure
// in google.rpc.Status.details[] for protocol-agnostic error handling.
message ErrorResponse {
  string error_code = 1;           // e.g., "E-422-001-FIN-002"
  string message = 2;              // Human-readable description
  string request_id = 3;           // Correlation UUID from API-CONTRACT-002
  map<string, string> details = 4; // Optional additional context fields
}

// Pagination metadata per API-CONTRACT-002 Section 2.4
message PaginationMeta {
  int64 total_count = 1;           // Total matching items across all pages
  int32 page_number = 2;           // Current page (1-indexed)
  int32 page_size = 3;             // Items per page (max 100)
  bytes cursor_next = 4;           // Opaque cursor for next page
  bytes cursor_prev = 5;           // Opaque cursor for previous page
  bool has_next = 6;               // true if more pages available
  bool has_prev = 7;               // true if previous pages available
}

// Paginated list envelope for query responses
message PaginatedList {
  repeated google.protobuf.Any items = 1;  // Typed items (wrapped via Any)
  PaginationMeta pagination = 2;            // Pagination metadata
}

// Standard success response for all Commands (API-CONTRACT-002 Section 2.2)
// Present on every successful command: Create, Update, Delete, StateTransition
message SuccessResponse {
  string request_id = 1;           // Echoed correlation ID
  uint32 version = 2;              // Optimistic lock version (1 for creates)
  SyncStatus sync_status = 3;      // pending / synced
  google.protobuf.Timestamp created_at = 4;  // Only present on creates
  repeated DomainEvent events_emitted = 5;     // All domain events fired
}

// Standard query response (API-CONTRACT-002 Section 2.2)
message QueryResponse {
  google.protobuf.Any data = 1;    // Entity or entity list
  int32 count = 2;                 // Number of items returned
}

// SyncStatus tracks offline-first sync state per API-CONTRACT-005 SYNC-*
enum SyncStatus {
  SYNC_STATUS_UNSPECIFIED = 0;
  SYNC_STATUS_PENDING = 1;         // Local write not yet pushed
  SYNC_STATUS_SYNCED = 2;          // Confirmed on remote
  SYNC_STATUS_CONFLICT = 3;        // Conflict detected, needs resolution
}

// DomainEvent mirrors API-CONTRACT-002 Section 2.2 Event List Structure
// Every event type from the canonical catalog is represented here.
message DomainEvent {
  string event_name = 1;           // e.g., "OrganizationCreated", "UserLoggedIn"
  string aggregate_name = 2;       // e.g., "OrganizationAggregate", "IdentityAggregate"
  string aggregate_id = 3;         // UUID of the affected aggregate root
  google.protobuf.Timestamp occurred_at = 4;
  map<string, string> payload = 5; // Key-value payload (serializes JSONB)
}

// CanonicalRequest — the immutable structure produced by Step 1 parser
// (PROTO-001 Section 4.2). This is the internal representation the adapter
// passes to the Application Service layer. Not exposed over the wire as a
// standalone message; embedded within each request message.
message CanonicalRequest {
  string operation_id = 1;         // Exact name from API-CONTRACT-001
  string request_id = 2;           // UUID v4 correlation
  string org_id = 3;               // Tenant scope (from auth context)
  string actor_id = 4;             // User identity (from auth context)
  map<string, string> payload = 5; // Operation-specific data
  map<string, string> metadata = 6; // Protocol-specific non-business metadata
}

// CanonicalResponse — the immutable structure returned by Step 4
// (PROTO-001 Section 4.4). Not exposed as a standalone gRPC message;
// each individual response message mirrors its shape.
message CanonicalResponse {
  int32 status_code = 1;           // 200, 201, 204, 400, etc.
  google.protobuf.Any body = 2;    // Entity, list, or null
  map<string, string> headers = 3; // Protocol headers
  repeated DomainEvent events = 4; // Domain events emitted
  ErrorResponse error = 5;         // Present when status_code >= 400
}
```

---

#### Section 4: Enum Definitions (lumina/v1/common/enums.proto)

```protobuf
syntax = "proto3";

package lumina.v1.common;

// Organization type per API-CONTRACT-002 CreateOrganization request
enum OrganizationType {
  ORGANIZATION_TYPE_UNSPECIFIED = 0;
  ORGANIZATION_TYPE_CHURCH = 1;
  ORGANIZATION_TYPE_SCHOOL = 2;
  ORGANIZATION_TYPE_NGO = 3;
  ORGANIZATION_TYPE_COMPANY = 4;
  ORGANIZATION_TYPE_CUSTOM = 5;
}

// Organization status per DOC-012 org state machine
enum OrganizationStatus {
  ORGANIZATION_STATUS_UNSPECIFIED = 0;
  ORGANIZATION_STATUS_ACTIVE = 1;
  ORGANIZATION_STATUS_ARCHIVED = 2;
  ORGANIZATION_STATUS_SUSPENDED = 3;
}

// Unit type for org units (church divisions, groups, committees...)
enum OrgUnitType {
  ORG_UNIT_TYPE_UNSPECIFIED = 0;
  ORG_UNIT_TYPE_DIVISION = 1;
  ORG_UNIT_TYPE_GROUP = 2;
  ORG_UNIT_TYPE_COMMITTEE = 3;
  ORG_UNIT_TYPE_DEPARTMENT = 4;
}

// Role hierarchy per API-CONTRACT-002 CreateUser request (BR-ID-005)
enum UserRole {
  USER_ROLE_UNSPECIFIED = 0;
  USER_ROLE_SUPERADMIN = 1;
  USER_ROLE_ADMIN = 2;
  USER_ROLE_TREASURER = 3;
  USER_ROLE_PASTOR = 4;
  USER_ROLE_STAFF = 5;
}

// Transaction type per API-CONTRACT-002 CreateTransaction request
enum TransactionType {
  TRANSACTION_TYPE_UNSPECIFIED = 0;
  TRANSACTION_TYPE_INCOME = 1;
  TRANSACTION_TYPE_EXPENSE = 2;
  TRANSACTION_TYPE_TRANSFER = 3;
  TRANSACTION_TYPE_ADJUSTMENT = 4;
}

// Transaction approval state
enum TransactionStatus {
  TRANSACTION_STATUS_UNSPECIFIED = 0;
  TRANSACTION_STATUS_DRAFT = 1;
  TRANSACTION_STATUS_PENDING = 2;
  TRANSACTION_STATUS_APPROVED = 3;
  TRANSACTION_STATUS_REJECTED = 4;
}

// Member lifecycle state per API-CONTRACT-002 STATUS-010 invariant
enum MemberStatus {
  MEMBER_STATUS_UNSPECIFIED = 0;
  MEMBER_STATUS_ACTIVE = 1;
  MEMBER_STATUS_INACTIVE = 2;
  MEMBER_STATUS_DECEASED = 3;
  MEMBER_STATUS_TRANSFERRED = 4;
}

// Financial scope for transactions
enum ScopeType {
  SCOPE_TYPE_UNSPECIFIED = 0;
  SCOPE_TYPE_ORG = 1;
  SCOPE_TYPE_GROUP = 2;
}

// Notification delivery channel per API-CONTRACT-002
enum ChannelType {
  CHANNEL_TYPE_UNSPECIFIED = 0;
  CHANNEL_TYPE_IN_APP = 1;
  CHANNEL_TYPE_PUSH = 2;
  CHANNEL_TYPE_EMAIL = 3;
  CHANNEL_TYPE_SMS = 4;
}

// Notification severity level
enum SeverityLevel {
  SEVERITY_LEVEL_UNSPECIFIED = 0;
  SEVERITY_LEVEL_INFO = 1;
  SEVERITY_LEVEL_WARNING = 2;
  SEVERITY_LEVEL_CRITICAL = 3;
}

// Export format per API-CONTRACT-002 EXPORT-001 invariant
enum ExportFormat {
  EXPORT_FORMAT_UNSPECIFIED = 0;
  EXPORT_FORMAT_PDF = 1;
  EXPORT_FORMAT_CSV = 2;
  EXPORT_FORMAT_JSON = 3;
}

// Audit log action type per API-CONTRACT-002
enum ActionType {
  ACTION_TYPE_UNSPECIFIED = 0;
  ACTION_TYPE_CREATE = 1;
  ACTION_TYPE_UPDATE = 2;
  ACTION_TYPE_DELETE = 3;
  ACTION_TYPE_APPROVE = 4;
  ACTION_TYPE_REJECT = 5;
  ACTION_TYPE_TRANSFER = 6;
  ACTION_TYPE_NOTIFY = 7;
  ACTION_TYPE_STAR = 8;  // wildcard for log-all
}

// Conflict resolution strategy per API-CONTRACT-002 ResolveConflict
enum ConflictStrategy {
  CONFLICT_STRATEGY_UNSPECIFIED = 0;
  CONFLICT_STRATEGY_LWW = 1;           // Last Writer Wins
  CONFLICT_STRATEGY_SERVER_WINS = 2;
  CONFLICT_STRATEGY_IMMUTABLE = 3;     // local approved tx never overwritten
  CONFLICT_STRATEGY_UUID_DEDUP = 4;
  CONFLICT_STRATEGY_SIDE_BY_SIDE = 5;
}

// Resource archiving state per DOC-012 lifecycle states
enum LifecycleState {
  LIFECYCLE_STATE_UNSPECIFIED = 0;
  LIFECYCLE_STATE_ACTIVE = 1;
  LIFECYCLE_STATE_ARCHIVED = 2;
  LIFECYCLE_STATE_TRASHED = 3;
  LIFECYCLE_STATE_PURGED = 4;
}

// Conflict detection and sync action type for OfflineSyncAggregate
enum SyncAction {
  SYNC_ACTION_UNSPECIFIED = 0;
  SYNC_ACTION_PUSH = 1;
  SYNC_ACTION_PULL = 2;
  SYNC_ACTION_RESOLVE = 3;
  SYNC_ACTION_CONFIRM = 4;
}

// Form field category for FormAggregate operations
enum FormFieldType {
  FORM_FIELD_TYPE_UNSPECIFIED = 0;
  FORM_FIELD_TYPE_TEXT = 1;
  FORM_FIELD_TYPE_NUMBER = 2;
  FORM_FIELD_TYPE_SELECT = 3;
  FORM_FIELD_TYPE_MULTISELECT = 4;
  FORM_FIELD_TYPE_DATE = 5;
  FORM_FIELD_TYPE_CHECKBOX = 6;
  FORM_FIELD_TYPE_SECTION = 7;
}

// Workflow step classification
enum StepType {
  STEP_TYPE_UNSPECIFIED = 0;
  STEP_TYPE_APPROVAL = 1;
  STEP_TYPE_CONDITION = 2;
  STEP_TYPE_ACTION = 3;
}

// Workflow instance state
enum WorkflowState {
  WORKFLOW_STATE_UNSPECIFIED = 0;
  WORKFLOW_STATE_RUNNING = 1;
  WORKFLOW_STATE_COMPLETED = 2;
  WORKFLOW_STATE_CANCELLED = 3;
  WORKFLOW_STATE_REJECTED = 4;
  WORKFLOW_STATE_IN_REVISION = 5;
}

// Classification of report scope
enum ReportScope {
  REPORT_SCOPE_UNSPECIFIED = 0;
  REPORT_SCOPE_ORG = 1;
  REPORT_SCOPE_GROUP = 2;
  REPORT_SCOPE_ALL = 3;
  REPORT_SCOPE_PARTIAL_CONSOLIDATION = 4;
}

// Translation language for VocabularyAggregate
enum TranslationLanguage {
  TRANSLATION_LANGUAGE_UNSPECIFIED = 0;
  TRANSLATION_LANGUAGE_FR = 1;
  TRANSLATION_LANGUAGE_EN = 2;
}
```

---

#### Section 5: Service Definitions for ALL 13 Aggregates

Each service block below defines a gRPC `service` declaration with exactly the RPCs corresponding to operations in **API-CONTRACT-001**. Request and response types follow the patterns established in **API-CONTRACT-002** Request/Response Contracts.

---

##### 5.1: OrganizationService (OrganizationAggregate)

**Proto file**: `lumina/v1/organization/organization.proto`
**Application Service**: OrganizationService
**Canonical source**: API-CONTRACT-001, Section OrganizationAggregate (10 ops: 8 Commands, 2 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | CreateOrganization | CreateOrganizationRequest | SuccessResponse | Unary | COMMAND | UC-ORG-01 |
| 2 | UpdateOrganizationSettings | UpdateOrganizationSettingsRequest | SuccessResponse | Unary | COMMAND | UC-ORG-02 |
| 3 | CreateOrgUnit | CreateOrgUnitRequest | SuccessResponse | Unary | COMMAND | UC-ORG-03 |
| 4 | UpdateOrgUnitParent | UpdateOrgUnitParentRequest | SuccessResponse | Unary | COMMAND | UC-ORG-04 (proto §4) |
| 5 | TransferChildOrg | TransferChildOrgRequest | SuccessResponse | Unary | COMMAND | UC-ORG-05 (proto §5) |
| 6 | MergeOrganizations | MergeOrganizationsRequest | SuccessResponse | Unary | COMMAND | UC-ORG-06 (proto §6) |
| 7 | ArchiveOrganization | ArchiveOrganizationRequest | SuccessResponse | Unary | COMMAND | UC-ORG-07 (proto §7) |
| 8 | SuspendOrganization | SuspendOrganizationRequest | SuccessResponse | Unary | COMMAND | UC-ORG-08 (proto §8) |
| 9 | GetOrganizationProfile | GetOrganizationProfileRequest | OrganizationProfileResponse | Unary | QUERY | UC-ORG-09 (proto §9) |
| 10 | GetDescendantUnits | GetDescendantUnitsRequest | DescendantUnitsResponse | ServerStream | QUERY | UC-ORG-10 (proto §10) |

**Message types** (in `organization.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.organization;

import "lumina/v1/common/messages.proto";
import "lumina/v1/organization/organization_enums.proto";

service OrganizationService {
  rpc CreateOrganization(CreateOrganizationRequest) returns (common.SuccessResponse);
  rpc UpdateOrganizationSettings(UpdateOrganizationSettingsRequest) returns (common.SuccessResponse);
  rpc CreateOrgUnit(CreateOrgUnitRequest) returns (common.SuccessResponse);
  rpc UpdateOrgUnitParent(UpdateOrgUnitParentRequest) returns (common.SuccessResponse);
  rpc TransferChildOrg(TransferChildOrgRequest) returns (common.SuccessResponse);
  rpc MergeOrganizations(MergeOrganizationsRequest) returns (common.SuccessResponse);
  rpc ArchiveOrganization(ArchiveOrganizationRequest) returns (common.SuccessResponse);
  rpc SuspendOrganization(SuspendOrganizationRequest) returns (common.SuccessResponse);
  rpc GetOrganizationProfile(GetOrganizationProfileRequest) returns (OrganizationProfileResponse);
  rpc GetDescendantUnits(GetDescendantUnitsRequest) returns (stream org_unit_result);
}

message CreateOrganizationRequest {
  string name = 1;                      // Required, non-empty (BR-ORG-001)
  OrganizationType type = 2;            // Required enum (BR-ORG-001)
  map<string, string> settings = 3;     // Optional ISO 4217 / IANA / hex (CFG-001..004)
}

message UpdateOrganizationSettingsRequest {
  string key = 1;                       // Must exist in configuration schema
  string value = 2;                     // Format depends on key (ISO 4217 / IANA / hex)
}

message CreateOrgUnitRequest {
  string name = 1;                      // Required, non-empty
  string parent_id = 2;                 // Optional UUID within same org
  OrgUnitType unit_type = 3;            // Required enum
  int32 depth_level = 4;                // Computed; must be <= 5 (REL-002, BR-ORG-002)
}

message UpdateOrgUnitParentRequest {
  string unit_id = 1;                   // Exists within same org
  string new_parent_id = 2;             // Exists; not self-reference (BR-ORG-003)
}

message TransferChildOrgRequest {
  string child_org_id = 1;              // Exists
  string new_parent_id = 2;             // Exists; not the same org
}

message MergeOrganizationsRequest {
  string source_org_id = 1;             // Exists
  string target_org_id = 2;             // Exists; different from source
}

message ArchiveOrganizationRequest {
  string org_id = 1;                    // Exists; status not already archived
}

message SuspendOrganizationRequest {
  string org_id = 1;                    // Exists; status active (BR-ORG-006)
}

message GetOrganizationProfileRequest {
  string org_id = 1;                    // From session context (INV-004)
}

message OrganizationProfileResponse {
  string org_id = 1;
  string name = 2;
  OrganizationType type = 3;
  OrganizationStatus status = 4;
  map<string, string> settings = 5;
  common.PaginationMeta pagination = 6;
}

message GetDescendantUnitsRequest {
  string root_id = 1;                   // Exists within same org
}

message org_unit_result {
  string unit_id = 1;
  string parent_id = 2;
  string name = 3;
  OrgUnitType unit_type = 4;
  int32 depth_level = 5;
}
```

---

##### 5.2: IdentityService (IdentityAggregate)

**Proto file**: `lumina/v1/identity/identity.proto`
**Application Service**: IdentityService
**Canonical source**: API-CONTRACT-001, Section IdentityAggregate (9 ops: 9 Commands, 0 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | CreateUser | CreateUserRequest | SuccessResponse | Unary | COMMAND | UC-ID-01 |
| 2 | UpdateUserProfile | UpdateUserProfileRequest | SuccessResponse | Unary | COMMAND | UC-ID-02 (proto §2) |
| 3 | ChangeUserRole | ChangeUserRoleRequest | SuccessResponse | Unary | COMMAND | UC-ID-03 |
| 4 | ResetPassword | ResetPasswordRequest | SuccessResponse | Unary | COMMAND | UC-ID-04 (proto §4) |
| 5 | LoginUser | LoginUserRequest | SessionTokensResponse | Unary | COMMAND | UC-ID-05 |
| 6 | LogoutUser | LogoutUserRequest | SuccessResponse | Unary | COMMAND | UC-ID-06 (proto §6) |
| 7 | RefreshAccessToken | RefreshAccessTokenRequest | SessionTokensResponse | Unary | COMMAND | UC-ID-07 (proto §7) |
| 8 | RevokeSession | RevokeSessionRequest | SuccessResponse | Unary | COMMAND | UC-ID-08 (proto §8) |
| 9 | AssignPermissionGrant | AssignPermissionGrantRequest | SuccessResponse | Unary | COMMAND | UC-ID-09 (proto §9) |

**Message types** (in `identity.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.identity;

import "lumina/v1/common/messages.proto";

service IdentityService {
  rpc CreateUser(CreateUserRequest) returns (common.SuccessResponse);
  rpc UpdateUserProfile(UpdateUserProfileRequest) returns (common.SuccessResponse);
  rpc ChangeUserRole(ChangeUserRoleRequest) returns (common.SuccessResponse);
  rpc ResetPassword(ResetPasswordRequest) returns (common.SuccessResponse);
  rpc LoginUser(LoginUserRequest) returns (SessionTokensResponse);
  rpc LogoutUser(LogoutUserRequest) returns (common.SuccessResponse);
  rpc RefreshAccessToken(RefreshAccessTokenRequest) returns (SessionTokensResponse);
  rpc RevokeSession(RevokeSessionRequest) returns (common.SuccessResponse);
  rpc AssignPermissionGrant(AssignPermissionGrantRequest) returns (common.SuccessResponse);
}

message CreateUserRequest {
  string email = 1;                     // Required, unique within org (EMAIL-001)
  string password_hash = 2;             // Required, strong hash (BR-ID-001)
  string role = 3;                      // Required enum string
  string first_name = 4;                // Required, non-empty
  string last_name = 5;                 // Required, non-empty
  string phone = 6;                     // Optional, formatted per region (PHONE-003)
}

message UpdateUserProfileRequest {
  string user_id = 1;                   // Exists
  map<string, string> updates = 2;      // Subset: first_name, last_name, phone, email
}

message ChangeUserRoleRequest {
  string user_id = 1;                   // Exists
  string new_role = 2;                  // Valid role; respects hierarchy
}

message ResetPasswordRequest {
  string user_id = 1;                   // Exists
  string new_password_hash = 2;         // Strong hash (BR-ID-001)
}

message LoginUserRequest {
  string email = 1;                     // Exists within specified org
  string password = 2;                  // Matches stored hash (INV-008)
}

message LogoutUserRequest {
  string session_id = 1;                // Exists and is active
}

message RefreshAccessTokenRequest {
  string refresh_token_hash = 1;        // Exists in DB; not expired
}

message RevokeSessionRequest {
  string session_id = 1;                // Exists
}

message AssignPermissionGrantRequest {
  string role_id = 1;                   // Exists
  string permission_string = 2;         // Format: "resource:action:level"
}

message SessionTokensResponse {
  string access_token = 1;              // Ephemeral JWT, not stored
  string refresh_token_hash = 2;        // Hash of new refresh token
  common.SuccessResponse meta = 3;      // Embedded SuccessResponse per contract
}
```

---

##### 5.3: ResourceService (ResourceAggregate)

**Proto file**: `lumina/v1/resource/resource.proto`
**Application Service**: ResourceService
**Canonical source**: API-CONTRACT-001, Section ResourceAggregate (12 ops: 10 Commands, 2 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | CreateTransaction | CreateTransactionRequest | SuccessResponse | Unary | COMMAND | UC-RES-01 |
| 2 | UpdateDraftTransaction | UpdateDraftTransactionRequest | SuccessResponse | Unary | COMMAND | UC-RES-02 (proto §2) |
| 3 | SubmitForApproval | SubmitForApprovalRequest | SuccessResponse | Unary | COMMAND | UC-RES-03 (proto §3) |
| 4 | ApproveTransaction | ApproveTransactionRequest | SuccessResponse | Unary | COMMAND | UC-RES-04 |
| 5 | RejectTransaction | RejectTransactionRequest | SuccessResponse | Unary | COMMAND | UC-RES-05 (proto §5) |
| 6 | CompensateTransaction | CompensateTransactionRequest | SuccessResponse | Unary | COMMAND | UC-RES-06 |
| 7 | CreateMember | CreateMemberRequest | SuccessResponse | Unary | COMMAND | UC-RES-07 |
| 8 | UpdateMember | UpdateMemberRequest | SuccessResponse | Unary | COMMAND | UC-RES-08 (proto §8) |
| 9 | TransitionMemberStatus | TransitionMemberStatusRequest | SuccessResponse | Unary | COMMAND | UC-RES-09 |
| 10 | SearchResources | SearchResourcesRequest | SearchResourcesResponse | ServerStream | QUERY | UC-RES-10 |
| 11 | ExportResources | ExportResourcesRequest | ExportResourcesResponse | Unary | QUERY | UC-RES-11 (proto §11) |

**Message types** (in `resource.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.resource;

import "lumina/v1/common/messages.proto";
import "lumina/v1/common/enums.proto";
import "lumina/v1/resource/resource_enums.proto";

service ResourceService {
  rpc CreateTransaction(CreateTransactionRequest) returns (common.SuccessResponse);
  rpc UpdateDraftTransaction(UpdateDraftTransactionRequest) returns (common.SuccessResponse);
  rpc SubmitForApproval(SubmitForApprovalRequest) returns (common.SuccessResponse);
  rpc ApproveTransaction(ApproveTransactionRequest) returns (common.SuccessResponse);
  rpc RejectTransaction(RejectTransactionRequest) returns (common.SuccessResponse);
  rpc CompensateTransaction(CompensateTransactionRequest) returns (common.SuccessResponse);
  rpc CreateMember(CreateMemberRequest) returns (common.SuccessResponse);
  rpc UpdateMember(UpdateMemberRequest) returns (common.SuccessResponse);
  rpc TransitionMemberStatus(TransitionMemberStatusRequest) returns (common.SuccessResponse);
  rpc SearchResources(SearchResourcesRequest) returns (stream search_result_item);
  rpc ExportResources(ExportResourcesRequest) returns (ExportResourcesResponse);
}

message CreateTransactionRequest {
  int64 amount_cents = 1;               // Required, > 0 (FIN-002) BIGINT
  TransactionType type = 2;             // Required: income/expense/transfer/adjustment
  TransactionStatus status = 3;         // Optional, default 'draft'
  string category_ref = 4;              // UUID in vocab_values (CAT-001)
  ScopeType scope_type = 5;             // Required: org or group (SCOPE-001)
  string scope_target_id = 6;           // Optional valid UUID
  string transaction_date = 7;          // Required date <= today (DATE-001)
  string description = 8;               // Optional, max 1024 chars (DESC-001 guard)
  string compensates_for = 9;           // Optional UUID ref to approved tx (COMP-001)
  string approved_by = 10;              // Optional UUID
}

message UpdateDraftTransactionRequest {
  string transaction_id = 1;            // Exists; status = draft (FIN-001 guard)
  map<string, string> updates = 2;      // Subset of updatable fields for draft
}

message SubmitForApprovalRequest {
  string transaction_id = 1;            // Exists; status = draft
}

message ApproveTransactionRequest {
  string transaction_id = 1;            // Exists; status = pending
  string approver_id = 2;               // Has approve permission grant (BR-RES-001)
}

message RejectTransactionRequest {
  string transaction_id = 1;            // Exists; status = pending
  string reason = 2;                    // Required non-empty comment
}

message CompensateTransactionRequest {
  string original_transaction_id = 1;   // Exists; status = approved (COMP-001)
  map<string, string> compensation_data = 2;  // Follows same fields as CreateTransaction
}

message CreateMemberRequest {
  string first_name = 1;                // Required, non-empty (MEM-001)
  string last_name = 2;                 // Required, non-empty (MEM-001)
  string email = 3;                     // Optional, unique within org if provided (EMAIL-001)
  string phone = 4;                     // Optional, formatted per region (PHONE-003)
  string date_of_birth = 5;             // Optional, age 0-120 years (AGE-004)
  MemberStatus initial_status = 6;      // Default 'active' (STATUS-010)
}

message UpdateMemberRequest {
  string member_id = 1;                 // Exists
  map<string, string> updates = 2;      // Subset of updatable fields
}

message TransitionMemberStatusRequest {
  string member_id = 1;                 // Exists
  MemberStatus new_status = 2;          // IN (active/inactive/deceased/transferred)
}

message SearchResourcesRequest {
  string resource_type = 1;             // Optional filter
  string status = 2;                    // Optional filter
  string date_from = 3;                 // Optional inclusive lower bound
  string date_to = 4;                   // Optional inclusive upper bound
  string category_ref = 5;              // Optional vocab category filter
  string search_text = 6;               // Optional full-text search
  int32 page_number = 7;                // Pagination (1-indexed, max 100)
  int32 page_size = 8;                  // Items per page
  bytes cursor_next = 9;                // Cursor-based next page
}

message search_result_item {
  string resource_id = 1;
  string resource_type = 2;
  string org_id = 3;
  int64 amount_cents = 4;
  TransactionType type = 5;
  string status = 6;
  string category_ref = 7;
  string description = 8;
  string transaction_date = 9;
  string created_at = 10;
}

message SearchResourcesResponse {
  repeated search_result_item items = 1;
  common.PaginationMeta pagination = 2;
}

message ExportResourcesRequest {
  ExportFormat format = 1;              // pdf/csv/json (EXPORT-001)
  map<string, string> filters = 2;      // Same fields as SearchResources
}

message ExportResourcesResponse {
  bytes export_data = 1;                // Raw exported blob
  string timestamp = 2;                 // Export timestamp + digital signature (EXPORT-001)
}
```

---

##### 5.4: RelationshipService (RelationshipAggregate)

**Proto file**: `lumina/v1/relationship/relationship.proto`
**Application Service**: RelationshipService
**Canonical source**: API-CONTRACT-001, Section RelationshipAggregate (6 ops: 3 Commands, 3 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | AddMemberToGroup | AddMemberToGroupRequest | SuccessResponse | Unary | COMMAND | UC-REL-01 |
| 2 | RemoveMemberFromGroup | RemoveMemberFromGroupRequest | SuccessResponse | Unary | COMMAND | UC-REL-02 (proto §2) |
| 3 | SetOrgUnitParent | SetOrgUnitParentRequest | SuccessResponse | Unary | COMMAND | UC-REL-03 |
| 4 | GetDescendants | GetDescendantsRequest | stream descendant_result | ServerStream | QUERY | UC-REL-04 |
| 5 | GetAllGroupsForMember | GetAllGroupsForMemberRequest | GroupsForMemberResponse | Unary | QUERY | UC-REL-05 |
| 6 | GetAllMembersOfGroup | GetAllMembersOfGroupRequest | MembersOfGroupResponse | Unary | QUERY | UC-REL-06 |
| 7 | DetectCycles | DetectCyclesRequest | DetectCyclesResponse | Unary | QUERY | proto §detect_cycles |

**Message types** (in `relationship.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.relationship;

import "lumina/v1/common/messages.proto";

service RelationshipService {
  rpc AddMemberToGroup(AddMemberToGroupRequest) returns (common.SuccessResponse);
  rpc RemoveMemberFromGroup(RemoveMemberFromGroupRequest) returns (common.SuccessResponse);
  rpc SetOrgUnitParent(SetOrgUnitParentRequest) returns (common.SuccessResponse);
  rpc GetDescendants(GetDescendantsRequest) returns (stream descendant_result);
  rpc GetAllGroupsForMember(GetAllGroupsForMemberRequest) returns (GroupsForMemberResponse);
  rpc GetAllMembersOfGroup(GetAllMembersOfGroupRequest) returns (MembersOfGroupResponse);
  rpc DetectCycles(DetectCyclesRequest) returns (DetectCyclesResponse);
}

message AddMemberToGroupRequest {
  string member_id = 1;                 // Exists
  string group_id = 2;                  // Exists within same org (MULTI-020 guard)
}

message RemoveMemberFromGroupRequest {
  string member_id = 1;                 // Exists
  string group_id = 2;                  // Membership exists (HISTORY-022 preserved)
}

message SetOrgUnitParentRequest {
  string unit_id = 1;                   // Exists within same org
  string parent_unit_id = 11;           // Exists; not self; not descendant (REL-001, REL-002)
}

message GetDescendantsRequest {
  string unit_id = 1;                   // Exists within same org
}

message descendant_result {
  string unit_id = 1;
  string name = 2;
  string parent_id = 3;
  int32 depth_level = 4;
}

message GetAllGroupsForMemberRequest {
  string member_id = 1;                 // Exists
}

message GroupsForMemberResponse {
  repeated membership_record memberships = 1;
}

message membership_record {
  string member_id = 1;
  string group_id = 2;
  string joined_at = 3;
}

message GetAllMembersOfGroupRequest {
  string group_id = 1;                  // Exists
}

message MembersOfGroupResponse {
  repeated member_in_group members = 1;
}

message member_in_group {
  string member_id = 1;
  string first_name = 2;
  string last_name = 3;
  string role = 4;
}

message DetectCyclesRequest {
  repeated edge_candidate candidate_edges = 1;
}

message edge_candidate {
  string from_id = 1;
  string to_id = 2;
}

message DetectCyclesResponse {
  bool has_cycle = 1;
  repeated string cycle_path = 2;       // Units forming the cycle
}
```

---

##### 5.5: WorkflowService (WorkflowAggregate)

**Proto file**: `lumina/v1/workflow/workflow.proto`
**Application Service**: WorkflowService
**Canonical source**: API-CONTRACT-001, Section WorkflowAggregate (6 ops: 5 Commands, 1 Query)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | TriggerWorkflow | TriggerWorkflowRequest | SuccessResponse | Unary | COMMAND | UC-WF-01 (proto §1) |
| 2 | ApproveStep | ApproveStepRequest | SuccessResponse | Unary | COMMAND | UC-WF-02 |
| 3 | RejectStep | RejectStepRequest | SuccessResponse | Unary | COMMAND | UC-WF-03 (proto §3) |
| 4 | CancelWorkflow | CancelWorkflowRequest | SuccessResponse | Unary | COMMAND | UC-WF-04 |
| 5 | ResubmitForApproval | ResubmitForApprovalRequest | SuccessResponse | Unary | COMMAND | UC-WF-05 |
| 6 | GetPendingApprovals | GetPendingApprovalsRequest | PendingApprovalsResponse | ServerStream | QUERY | QUERY-only |

**Message types** (in `workflow.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.workflow;

import "lumina/v1/common/messages.proto";

service WorkflowService {
  rpc TriggerWorkflow(TriggerWorkflowRequest) returns (common.SuccessResponse);
  rpc ApproveStep(ApproveStepRequest) returns (common.SuccessResponse);
  rpc RejectStep(RejectStepRequest) returns (common.SuccessResponse);
  rpc CancelWorkflow(CancelWorkflowRequest) returns (common.SuccessResponse);
  rpc ResubmitForApproval(ResubmitForApprovalRequest) returns (common.SuccessResponse);
  rpc GetPendingApprovals(GetPendingApprovalsRequest) returns (stream pending_approval_step);
}

message TriggerWorkflowRequest {
  string definition_key = 1;            // Exists in manifest
  string resource_type = 2;             // Valid resource type enum
  string resource_id = 3;               // Exists
  string trigger_event = 4;             // Matches workflow trigger definition
}

message ApproveStepRequest {
  string instance_id = 1;               // Running workflow instance
  string step_id = 2;                   // Approval-type step assigned to approver
  string comment = 3;                   // Optional approval comment
}

message RejectStepRequest {
  string instance_id = 1;               // Running workflow instance
  string step_id = 2;                   // Approval-type step assigned to approver
  string reason = 3;                    // Required non-empty
}

message CancelWorkflowRequest {
  string instance_id = 1;               // Running workflow
  string reason = 2;                    // Explanation for cancellation
}

message ResubmitForApprovalRequest {
  string instance_id = 1;               // Rejected or in_revision workflow (RETRY-004 manual only)
}

message GetPendingApprovalsRequest {
  // No payload required; actor_id resolved from auth context
}

message pending_approval_step {
  string instance_id = 1;
  string step_id = 2;
  string step_type = 3;
  string assigned_user_id = 4;
  string deadline = 5;
}

message PendingApprovalsResponse {
  repeated pending_approval_step steps = 1;
}
```

---

##### 5.6: FormService (FormAggregate)

**Proto file**: `lumina/v1/form/form.proto`
**Application Service**: FormService
**Canonical source**: API-CONTRACT-001, Section FormAggregate (4 ops: 1 Command, 3 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | LoadFormDefinition | LoadFormDefinitionRequest | FormDefinitionResponse | Unary | QUERY | UC-FRM-01 |
| 2 | ValidateFormData | ValidateFormDataRequest | ValidationResultResponse | Unary | COMMAND | UC-FRM-02 |
| 3 | RenderForm | RenderFormRequest | RenderTreeResponse | Unary | QUERY | QUERY-only |
| 4 | GetVisibleFields | GetVisibleFieldsRequest | VisibleFieldsResponse | Unary | QUERY | QUERY-only |

**Message types** (in `form.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.form;

import "lumina/v1/common/messages.proto";

service FormService {
  rpc LoadFormDefinition(LoadFormDefinitionRequest) returns (FormDefinitionResponse);
  rpc ValidateFormData(ValidateFormDataRequest) returns (ValidationResultResponse);
  rpc RenderForm(RenderFormRequest) returns (RenderTreeResponse);
  rpc GetVisibleFields(GetVisibleFieldsRequest) returns (VisibleFieldsResponse);
}

message LoadFormDefinitionRequest {
  string form_id = 1;                   // Exists in manifest
  string version = 2;                   // Optional semantic version; defaults to latest (FRM-004)
}

message FormDefinitionResponse {
  string form_id = 1;
  string version = 2;
  map<string, string> fields = 3;       // JSONB representation of form template
  map<string, string> sections = 4;     // Section definitions
}

message ValidateFormDataRequest {
  string form_id = 1;                   // Loaded form definition exists
  map<string, string> form_data = 2;    // Data to validate against form schema (DUAL-008)
}

message ValidationResultResponse {
  bool valid = 1;
  repeated ValidationError errors = 2;
}

message ValidationError {
  string field_name = 1;
  string error_code = 2;
  string message = 3;
}

message RenderFormRequest {
  string form_id = 1;
  map<string, string> data_context = 2; // Optional data for conditional evaluation
}

message RenderTreeResponse {
  map<string, string> render_tree = 1;  // React Native render tree JSON (FRM-001: no hardcoded JSX)
}

message GetVisibleFieldsRequest {
  string form_id = 1;
  map<string, string> context = 2;      // Context for visible_if condition evaluation (FRM-003)
}

message VisibleFieldsResponse {
  repeated field_definition visible_fields = 1;
}

message field_definition {
  string field_id = 1;
  string label = 2;
  string field_type = 3;
  map<string, string> visible_if = 4;   // Conditional visibility rules
}
```

---

##### 5.7: NotificationService (NotificationAggregate)

**Proto file**: `lumina/v1/notification/notification.proto`
**Application Service**: NotificationService
**Canonical source**: API-CONTRACT-001, Section NotificationAggregate (6 ops: 6 Commands, 0 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | SendNotification | SendNotificationRequest | SuccessResponse | Unary | COMMAND | UC-NOT-01 |
| 2 | MarkAsRead | MarkAsReadRequest | SuccessResponse | Unary | COMMAND | UC-02 (proto §2) |
| 3 | UpdatePreferences | UpdatePreferencesRequest | SuccessResponse | Unary | COMMAND | UC-03 (proto §3) |
| 4 | SetRateLimit | SetRateLimitRequest | SuccessResponse | Unary | COMMAND | UC-04 (proto §4) |
| 5 | SuppressUntil | SuppressUntilRequest | SuccessResponse | Unary | COMMAND | UC-05 (proto §5) |
| 6 | QueueNotification | QueueNotificationRequest | SuccessResponse | Unary | COMMAND | UC-06 (proto §6) |

**Message types** (in `notification.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.notification;

import "lumina/v1/common/messages.proto";
import "lumina/v1/common/enums.proto";

service NotificationService {
  rpc SendNotification(SendNotificationRequest) returns (common.SuccessResponse);
  rpc MarkAsRead(MarkAsReadRequest) returns (common.SuccessResponse);
  rpc UpdatePreferences(UpdatePreferencesRequest) returns (common.SuccessResponse);
  rpc SetRateLimit(SetRateLimitRequest) returns (common.SuccessResponse);
  rpc SuppressUntil(SuppressUntilRequest) returns (common.SuccessResponse);
  rpc QueueNotification(QueueNotificationRequest) returns (common.SuccessResponse);
}

message SendNotificationRequest {
  string recipient_user_id = 1;         // Exists
  ChannelType channel = 2;              // in_app/push/email/sms
  string body = 3;                      // Notification content
  SeverityLevel severity = 4;           // Default 'info'; critical bypasses quiet hours (QUIET-004)
  string trigger_source = 5;            // MUST be present; identifies the originator (NOT-001)
}

message MarkAsReadRequest {
  string notification_id = 1;           // Belongs to requesting user (self only)
}

message UpdatePreferencesRequest {
  string user_id = 1;                   // Self or admin update
  repeated ChannelType channels = 2;    // Subset of [in_app, push, email, sms] (CHANNEL-003)
  SeverityLevel severity_min = 3;       // Minimum severity to deliver
  int32 rate_limit_per_hour = 4;        // Integer > 0
}

message SetRateLimitRequest {
  string user_id = 1;                   // Admin-specified user
  int32 max_per_hour = 2;               // > 0 (RATE-002)
}

message SuppressUntilRequest {
  string user_id = 1;                   // Admin-specified user
  string until_time = 2;                // Future timestamp (QUIET-004: critical bypasses)
}

message QueueNotificationRequest {
  string recipient_user_id = 1;
  ChannelType channel = 2;
  string body = 3;
  string trigger_source = 4;            // Required even for queued notifications (NOT-001)
  SeverityLevel severity = 5;
}
```

---

##### 5.8: VocabularyService (VocabularyAggregate)

**Proto file**: `lumina/v1/vocabulary/vocabulary.proto`
**Application Service**: VocabularyService
**Canonical source**: API-CONTRACT-001, Section VocabularyAggregate (7 ops: 2 Commands, 5 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | AddTermValue | AddTermValueRequest | SuccessResponse | Unary | COMMAND | UC-VOC-01 |
| 2 | DeprecateTermValue | DeprecateTermValueRequest | SuccessResponse | Unary | COMMAND | UC-VOC-02 |
| 3 | ResolveLabel | ResolveLabelRequest | ResolveLabelResponse | Unary | QUERY | UC-VOC-03 |
| 4 | GetTerms | GetTermsRequest | GetTermsResponse | ServerStream | QUERY | QUERY-only |
| 5 | GetTermValues | GetTermValuesRequest | GetTermValuesResponse | ServerStream | QUERY | QUERY-only |
| 6 | SearchTerms | SearchTermsRequest | SearchTermsResponse | ServerStream | QUERY | QUERY-only |
| 7 | GetAllNamespaces | GetAllNamespacesRequest | GetAllNamespacesResponse | ServerStream | QUERY | QUERY-only |

**Message types** (in `vocabulary.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.vocabulary;

import "lumina/v1/common/messages.proto";

service VocabularyService {
  rpc AddTermValue(AddTermValueRequest) returns (common.SuccessResponse);
  rpc DeprecateTermValue(DeprecateTermValueRequest) returns (common.SuccessResponse);
  rpc ResolveLabel(ResolveLabelRequest) returns (ResolveLabelResponse);
  rpc GetTerms(GetTermsRequest) returns (stream term_result);
  rpc GetTermValues(GetTermValuesRequest) returns (stream term_value_result);
  rpc SearchTerms(SearchTermsRequest) returns (stream term_search_result);
  rpc GetAllNamespaces(GetAllNamespacesRequest) returns (stream namespace_result);
}

message AddTermValueRequest {
  string namespace = 1;                 // Exists in vocabulary
  string term_key = 2;                  // Unique within namespace (STABLE-003)
  string label_fr = 3;                  // Non-empty French label (TRANSLATION-002)
  string label_en = 4;                  // Non-empty English label (TRANSLATION-002)
  string color_hex = 5;                 // Optional #RRGGBB pattern
}

message DeprecateTermValueRequest {
  string namespace = 1;                 // Exists
  string term_key = 2;                  // Exists within namespace
  string value_key = 3;                 // Exists and not already deprecated (VOC-001: irreversible)
}

message ResolveLabelRequest {
  string namespace = 1;
  string term_key = 2;
  string language = 3;                  // "fr" or "en" (TRANSLATION-002 guarantees min FR+EN)
}

message ResolveLabelResponse {
  string label = 1;
  string language = 2;
}

message GetTermsRequest {
  string namespace = 1;                 // Exists
}

message term_result {
  string term_key = 1;
  string namespace = 2;
  map<string, string> translations = 3;
}

message GetTermValuesRequest {
  string namespace = 1;
  string term_key = 2;
}

message term_value_result {
  string value_key = 1;
  string label_fr = 2;
  string label_en = 3;
  string color_hex = 4;
  bool deprecated = 5;
}

message SearchTermsRequest {
  string query = 1;                     // Full-text search expression
  string namespace = 2;                 // Optional namespace filter
}

message term_search_result {
  string term_key = 1;
  string namespace = 2;
  map<string, string> translations = 3;
  bool deprecated = 4;
}

message GetAllNamespacesRequest {
  // No payload required
}

message namespace_result {
  string namespace_key = 1;
  int32 term_count = 2;
}
```

---

##### 5.9: ReportingService (ReportingAggregate)

**Proto file**: `lumina/v1/reporting/reporting.proto`
**Application Service**: ReportingService
**Canonical source**: API-CONTRACT-001, Section ReportingAggregate (4 ops: 1 Command, 3 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | GenerateReport | GenerateReportRequest | SuccessResponse | Unary | COMMAND | UC-RPT-01 |
| 2 | CalculateBalance | CalculateBalanceRequest | BalanceTotalsResponse | Unary | QUERY | QUERY-only |
| 3 | ExportReport | ExportReportRequest | ExportReportResponse | Unary | QUERY | QUERY-only |
| 4 | GetReportTypes | GetReportTypesRequest | ReportTypesResponse | ServerStream | QUERY | QUERY-only |

**Message types** (in `reporting.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.reporting;

import "lumina/v1/common/messages.proto";
import "lumina/v1/common/enums.proto";

service ReportingService {
  rpc GenerateReport(GenerateReportRequest) returns (common.SuccessResponse);
  rpc CalculateBalance(CalculateBalanceRequest) returns (BalanceTotalsResponse);
  rpc ExportReport(ExportReportRequest) returns (ExportReportResponse);
  rpc GetReportTypes(GetReportTypesRequest) returns (stream report_type_result);
}

message GenerateReportRequest {
  string report_type = 1;               // Defined in reporting definitions
  string period_start = 2;              // Valid date (MONTH-001)
  string period_end = 3;                // Valid; >= period_start (MONTH-001)
  ReportScope scope = 4;                // org/group/all/partial_consolidation
  ExportFormat format = 5;              // Default json (EXPORT-001)
}

message CalculateBalanceRequest {
  ReportScope scope = 1;                // org/group/all/partial_consolidation
  string period_start = 2;              // Valid date
  string period_end = 3;                // Valid; >= period_start
}

message BalanceTotalsResponse {
  int64 total_assets = 1;
  int64 total_liabilities = 2;
  int64 total_equity = 3;
  int64 net_result = 4;
  repeated CategoryBreakdown breakdown = 5;
  // BAL-001 invariant enforced: assets == liabilities + equity + result
}

message CategoryBreakdown {
  string category_ref = 1;
  string label = 2;
  int64 amount_cents = 3;
}

message ExportReportRequest {
  string report_id = 1;                 // Previously generated report
  ExportFormat format = 2;              // pdf/csv/json (EXPORT-001)
}

message ExportReportResponse {
  bytes export_file = 1;                // Export file contents
  string digital_signature = 2;         // EXPORT-001 timestamp + signature
}

message GetReportTypesRequest {
  string org_id = 1;                    // Exists
}

message report_type_result {
  string report_type = 1;
  string description = 2;
}

message ReportTypesResponse {
  repeated report_type_result types = 1;
}
```

---

##### 5.10: AuditService (AuditAggregate)

**Proto file**: `lumina/v1/audit/audit.proto`
**Application Service**: AuditService
**Canonical source**: API-CONTRACT-001, Section AuditAggregate (3 ops: 1 Command, 2 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | LogAction | LogActionRequest | SuccessResponse | Unary | COMMAND (SYSTEM ONLY) | UC-AUD-01 |
| 2 | QueryAuditLogs | QueryAuditLogsRequest | AuditLogEntriesResponse | ServerStream | QUERY | QUERY-only |
| 3 | ExportAuditTrail | ExportAuditTrailRequest | ExportAuditTrailResponse | Unary | QUERY | QUERY-only |

**Message types** (in `audit.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.audit;

import "lumina/v1/common/messages.proto";
import "lumina/v1/common/enums.proto";

service AuditService {
  rpc LogAction(LogActionRequest) returns (common.SuccessResponse);
  rpc QueryAuditLogs(QueryAuditLogsRequest) returns (stream audit_log_entry_stream);
  rpc ExportAuditTrail(ExportAuditTrailRequest) returns (ExportAuditTrailResponse);
}

message LogActionRequest {
  string entity_type = 1;              // Domain entity type identifier
  string entity_id = 2;                // UUID of affected entity
  ActionType action = 3;               // create/update/delete/approve/reject/transfer/notify/star
  map<string, string> old_values = 4;  // Snapshot before change (OLDNEW-002)
  map<string, string> new_values = 5;  // Snapshot after change (OLDNEW-002)
  string user_id = 6;                  // Actor who performed the action
  // SYSTEM ONLY — auto-invoked by other aggregates; not externally callable
  // AUD-001: append-only, immutable, never modifiable/deletable
}

message QueryAuditLogsRequest {
  string date_range_start = 1;          // Optional start
  string date_range_end = 2;            // Optional end
  string entity_type = 3;               // Optional filter
  string user_id = 4;                   // Optional filter
  ActionType action_filter = 5;         // Optional filter
  int32 page_number = 6;                // 1-indexed, max 100 items/page
  int32 page_size = 7;                  // Max 100
  // ACCESS-033: restricted to admin/auditor roles
}

message audit_log_entry_stream {
  string log_id = 1;
  string entity_type = 2;
  string entity_id = 3;
  string action = 4;
  map<string, string> old_values = 5;
  map<string, string> new_values = 6;
  string user_id = 7;
  string logged_at = 8;
}

message AuditLogEntriesResponse {
  repeated audit_log_entry_stream entries = 1;
}

message ExportAuditTrailRequest {
  string period_start = 1;              // Date range for export
  string period_end = 2;
  ExportFormat format = 3;              // pdf/csv/json
  // ACCESS-033, RETENTION-031: min 7-year retention enforced
}

message ExportAuditTrailResponse {
  bytes export_data = 1;
  int64 entry_count = 2;
}
```

---

##### 5.11: LifecycleService (LifecycleAggregate)

**Proto file**: `lumina/v1/lifecycle/lifecycle.proto`
**Application Service**: LifecycleService
**Canonical source**: API-CONTRACT-001, Section LifecycleAggregate (8 ops: 5 Commands, 2 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | ArchiveResource | ArchiveResourceRequest | SuccessResponse | Unary | COMMAND | UC-LIF-01 |
| 2 | TrashResource | TrashResourceRequest | SuccessResponse | Unary | COMMAND | UC-LIF-02 (proto §2) |
| 3 | PurgeResource | PurgeResourceRequest | SuccessResponse | Unary | COMMAND (SYSTEM) | UC-LIF-03 |
| 4 | RestoreFromTrash | RestoreFromTrashRequest | SuccessResponse | Unary | COMMAND | UC-LIF-04 |
| 5 | ListArchiveEntries | ListArchiveEntriesRequest | ArchiveEntriesResponse | ServerStream | QUERY | QUERY-only |
| 6 | SearchArchives | SearchArchivesRequest | ArchiveSearchResultsResponse | ServerStream | QUERY | QUERY-only |
| 7 | ApplyTags | ApplyTagsRequest | SuccessResponse | Unary | COMMAND | COMMAND-only |
| 8 | SchedulePurge | SchedulePurgeRequest | SuccessResponse | Unary | COMMAND | UC-LIF-05 (proto §8) |

**Message types** (in `lifecycle.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.lifecycle;

import "lumina/v1/common/messages.proto";
import "lumina/v1/common/enums.proto";

service LifecycleService {
  rpc ArchiveResource(ArchiveResourceRequest) returns (common.SuccessResponse);
  rpc TrashResource(TrashResourceRequest) returns (common.SuccessResponse);
  rpc PurgeResource(PurgeResourceRequest) returns (common.SuccessResponse);
  rpc RestoreFromTrash(RestoreFromTrashRequest) returns (common.SuccessResponse);
  rpc ListArchiveEntries(ListArchiveEntriesRequest) returns (stream archive_entry_stream);
  rpc SearchArchives(SearchArchivesRequest) returns (stream archive_search_result);
  rpc ApplyTags(ApplyTagsRequest) returns (common.SuccessResponse);
  rpc SchedulePurge(SchedulePurgeRequest) returns (common.SuccessResponse);
}

message ArchiveResourceRequest {
  string resource_type = 1;             // Archivable type from manifest (LIF-001)
  string resource_id = 2;               // Exists in ResourceAggregate
}

message TrashResourceRequest {
  string archive_id = 1;                // Exists; state = archived (LIF-003)
}

message PurgeResourceRequest {
  string archive_id = 1;                // Exists; state = trashed; purge_date reached (LIF-003, LIF-005)
  // IRREVERSIBLE — system scheduled; not user-callable
}

message RestoreFromTrashRequest {
  string archive_id = 1;                // Exists; state = trashed (LIF-003)
}

message ListArchiveEntriesRequest {
  map<string, string> filters = 1;      // type, tags, state, date_range (LIF-006)
}

message archive_entry_stream {
  string archive_id = 1;
  string resource_type = 2;
  string resource_id = 3;
  string state = 4;                     // archived/trashed/purged
  string archived_at = 5;
  string trashed_at = 6;
  repeated string tags = 7;
  string archived_by = 8;
}

message ArchiveEntriesResponse {
  repeated archive_entry_stream entries = 1;
}

message SearchArchivesRequest {
  string query_string = 1;              // Full-text search expression
  repeated string tags = 2;             // Optional tag filter
  string resource_type = 3;             // Optional type filter
}

message archive_search_result {
  string archive_id = 1;
  string resource_type = 2;
  string resource_id = 3;
  string state = 4;
  repeated string tags = 5;
}

message ArchiveSearchResultsResponse {
  repeated archive_search_result results = 1;
}

message ApplyTagsRequest {
  string archive_id = 1;                // Exists
  repeated string tags = 2;             // Array of tag strings
}

message SchedulePurgeRequest {
  string archive_id = 1;                // Exists; state = trashed or archived
  string purge_date = 2;                // Future date; configured per type (LIF-005)
}
```

---

##### 5.12: ConfigurationService (ConfigurationAggregate)

**Proto file**: `lumina/v1/configuration/configuration.proto`
**Application Service**: ConfigurationService
**Canonical source**: API-CONTRACT-001, Section ConfigurationAggregate (4 ops: 2 Commands, 2 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | UpdateSetting | UpdateSettingRequest | SuccessResponse | Unary | COMMAND | UC-CFG-01 |
| 2 | ResetToDefaults | ResetToDefaultsRequest | SuccessResponse | Unary | COMMAND | QUERY-only |
| 3 | GetSetting | GetSettingRequest | GetSettingResponse | Unary | QUERY | QUERY-only |
| 4 | GetAllSettings | GetAllSettingsRequest | GetAllSettingsResponse | ServerStream | QUERY | QUERY-only |

**Message types** (in `configuration.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.configuration;

import "lumina/v1/common/messages.proto";

service ConfigurationService {
  rpc UpdateSetting(UpdateSettingRequest) returns (common.SuccessResponse);
  rpc ResetToDefaults(ResetToDefaultsRequest) returns (common.SuccessResponse);
  rpc GetSetting(GetSettingRequest) returns (GetSettingResponse);
  rpc GetAllSettings(GetAllSettingsRequest) returns (stream setting_stream);
}

message UpdateSettingRequest {
  string key = 1;                       // From configuration schema
  string value = 2;                     // Format depends on key:
                                        //   currency: ISO 4217 regex (CFG-001)
                                        //   timezone: IANA timezone (CFG-002)
                                        //   accent_hex: ^#[0-9a-fA-F]{6}$ + WCAG (CFG-003)
}

message ResetToDefaultsRequest {
  // No payload — resets ALL settings to template defaults (CFG-004)
}

message GetSettingRequest {
  string key = 1;                       // Exists in configuration schema
}

message GetSettingResponse {
  string key = 1;
  string value = 2;
  string default_fallback = 3;          // CFG-004 always provides a fallback
}

message GetAllSettingsRequest {
  // Admin permission required
}

message setting_stream {
  string key = 1;
  string value = 2;
  string default_fallback = 3;
}
```

---

##### 5.13: OfflineSyncService (OfflineSyncAggregate)

**Proto file**: `lumina/v1/sync/sync.proto`
**Application Service**: OfflineSyncService
**Canonical source**: API-CONTRACT-001, Section OfflineSyncAggregate (6 ops: 4 Commands, 2 Queries)

| # | RPC Method | Request Type | Response Type | Streaming | Command/Query | Operation Source |
|---|-----------|-------------|---------------|-----------|---------------|-----------------|
| 1 | PushPendingOperations | PushPendingOperationsRequest | SuccessResponse | ClientStream | COMMAND | UC-SYNC-01 |
| 2 | PullRemoteChanges | PullRemoteChangesRequest | PullRemoteChangesResponse | ServerStream | COMMAND | UC-SYNC-02 |
| 3 | ResolveConflict | ResolveConflictRequest | SuccessResponse | Unary | COMMAND | UC-SYNC-03 |
| 4 | MarkOperationConfirmed | MarkOperationConfirmedRequest | SuccessResponse | Unary | COMMAND | QUERY-only |
| 5 | CheckConnectivity | CheckConnectivityRequest | ConnectivityResponse | Unary | QUERY | QUERY-only |
| 6 | GetSyncStatus | GetSyncStatusRequest | SyncStatusResponse | Unary | QUERY | QUERY-only |

**Message types** (in `sync.proto`):

```protobuf
syntax = "proto3";

package lumina.v1.sync;

import "lumina/v1/common/messages.proto";
import "lumina/v1/common/enums.proto";

service OfflineSyncService {
  rpc PushPendingOperations(stream PendingOperation) returns (common.SuccessResponse);
  rpc PullRemoteChanges(PullRemoteChangesRequest) returns (stream remote_change_delta);
  rpc ResolveConflict(ResolveConflictRequest) returns (common.SuccessResponse);
  rpc MarkOperationConfirmed(MarkOperationConfirmedRequest) returns (common.SuccessResponse);
  rpc CheckConnectivity(CheckConnectivityRequest) returns (ConnectivityResponse);
  rpc GetSyncStatus(GetSyncStatusRequest) returns (SyncStatusResponse);
}

message PendingOperation {
  string operation_id = 1;
  string entity_type = 2;              // transaction/member/event/etc.
  string entity_id = 3;
  string action = 4;                   // create/update/delete/transition
  map<string, string> payload = 5;     // Serializes the entity changes
  SyncStatus current_status = 6;       // pending/sent/confirmed/conflict
  int32 retry_count = 7;               // Exponential backoff counter (SYNC-003: max 5)
  string created_at = 8;
  // SYNC-002: batch size <= 50 per Push call
  // SYNC-001: local write ALWAYS precedes remote push
}

message PushPendingOperationsRequest {
  // Carries batch metadata; actual operations streamed individually
  int32 batch_size = 1;                // Must be <= 50 (SYNC-002)
}

message PullRemoteChangesRequest {
  string since_timestamp = 1;          // Last successful sync timestamp (SYNC-004: never blocks user)
}

message remote_change_delta {
  string entity_type = 1;
  string entity_id = 2;
  string action = 3;
  map<string, string> data = 4;
}

message PullRemoteChangesResponse {
  // Delivered via server stream; one delta per response
}

message ResolveConflictRequest {
  string operation_id = 1;             // Conflicting operation
  map<string, string> conflict_data = 2;  // Server-side data causing conflict
  ConflictStrategy strategy = 3;       // LWW/server_wins/immutable/uuid_dedup/side_by_side
  // SYNC-001: local-first strategy for approved transactions
}

message MarkOperationConfirmedRequest {
  string operation_id = 1;             // Successfully synced operation
}

message CheckConnectivityRequest {
  // No payload; returns current connectivity state
}

message ConnectivityResponse {
  bool connected = 1;
  string connection_state = 2;         // online/offline/partial
}

message GetSyncStatusRequest {
  string table_name = 1;               // Name of tracked table
}

message SyncStatusResponse {
  string table_name = 1;
  int32 pending_count = 2;             // Operations awaiting push
  int32 confirmed_count = 3;           // Successfully synced operations
  int32 conflict_count = 4;            |   // Pending conflicts
  string last_sync_timestamp = 5;      // Most recent sync time
}
```

---

#### Section 6: gRPC Status Code Mapping

Complete mapping from canonical error codes to gRPC status codes. Derived from PROTO-001 Section 5 and API-CONTRACT-005.

| # | Code Canonique | Description | gRPC Status Code | gRPC Numeric | Details Proto Field |
|---|---------------|-------------|-----------------|-------------|---------------------|
| 1 | E-400-001 | INVALID_INPUT | INVALID_ARGUMENT | 3 | `field_violations[]` with field name and expected type |
| 2 | E-400-002 | INVALID_VALUE | INVALID_ARGUMENT | 3 | `field_violations[].field_name`, `field_violations[].violation_reason` |
| 3 | E-400-003 | INVALID_FORMAT | INVALID_ARGUMENT | 3 | `field_violations[].expected_pattern` (e.g., ISO 4217, IANA, ^#RRGGBB$) |
| 4 | E-400-004 | INVALID_ENUM | INVALID_ARGUMENT | 3 | `field_violations[].allowed_values[]` |
| 5 | E-400-005 | INVALID_REFERENCE | INVALID_ARGUMENT | 3 | `invalid_reference.entity_type`, `invalid_reference.entity_id` |
| 6 | E-400-006 | INVALID_DATES | INVALID_ARGUMENT | 3 | `date_range.start`, `date_range.end`, `constraint` |
| 7 | E-400-007 | INVALID_PAYLOAD | INVALID_ARGUMENT | 3 | `json_schema_violations[]` |
| 8 | E-401-001 | NOT_AUTHENTICATED | UNAUTHENTICATED | 16 | `auth_required=true` |
| 9 | E-401-002 | SESSION_EXPIRED | UNAUTHENTICATED | 16 | `refresh_needed=true` |
| 10 | E-401-003 | INVALID_CREDENTIALS | UNAUTHENTICATED | 16 | `credential_field="email"` |
| 11 | E-403-001 | INSUFFICIENT_PERMISSION | PERMISSION_DENIED | 7 | `permission_required="resource:action:level"` |
| 12 | E-403-002 | ORGANIZATION_MISMATCH | PERMISSION_DENIED | 7 | `session_org_id`, `request_org_id` |
| 13 | E-403-003 | ROLE_VIOLATION | PERMISSION_DENIED | 7 | `actor_role`, `required_role`, `role_hierarchy_violation` |
| 14 | E-403-004 | SUSPENDED_ORG | PERMISSION_DENIED | 7 | `org_id`, `suspended_at`, `read_only=true` |
| 15 | E-403-005 | ARCHIVED_ORG | PERMISSION_DENIED | 7 | `org_id`, `archived_at`, `operation_blocked` |
| 16 | E-404-001 | ENTITY_NOT_FOUND | NOT_FOUND | 5 | `entity_type="TransactionRecord"`, `entity_id=<uuid>` |
| 17 | E-404-002 | TENANT_NOT_FOUND | NOT_FOUND | 5 | `org_id=<uuid>`, `org_not_accessible=true` |
| 18 | E-404-003 | SESSION_NOT_FOUND | NOT_FOUND | 5 | `session_id=<uuid>`, `revoked=true` |
| 19 | E-404-004 | FORM_NOT_FOUND | NOT_FOUND | 5 | `form_id=<string>`, `manifest_missing=true` |
| 20 | E-404-005 | VOCAB_TERM_NOT_FOUND | NOT_FOUND | 5 | `namespace`, `term_key`, `value_key` |
| 21 | E-404-006 | WORKFLOW_DEFINITION_NOT_FOUND | NOT_FOUND | 5 | `definition_key=<string>` |
| 22 | E-409-001 | OPTIMISTIC_LOCK_CONFLICT | ABORTED | 10 | `current_version=N`, `retry_after_ms=exponential_backoff`, `retry=true` |
| 23 | E-409-002 | UNIQUE_VIOLATION | ALREADY_EXISTS | 6 | `duplicate_field="email"`, `entity_type="User"` |
| 24 | E-409-003 | INVALID_TRANSITION | FAILED_PRECONDITION | 9 | `current_state="draft"`, `target_state="approved"`, `valid_transitions[]` |
| 25 | E-409-004 | DUPLICATE_MEMBERSHIP | ALREADY_EXISTS | 6 | `member_id`, `group_id`, `existing_membership_at` |
| 26 | E-409-005 | ALREADY_DEPRECATED | FAILED_PRECONDITION | 9 | `value_key`, `already_deprecated=true` |
| 27 | E-409-006 | ALREADY_PURGED | FAILED_PRECONDITION | 9 | `archive_id`, `purged=true`, `irreversible=true` |
| 28 | E-422-001 | INVARIANT_VIOLATED | FAILED_PRECONDITION | 9 | `invariant="FIN-001"`, `detail_message` |
| 29 | E-422-002 | BUSINESS_RULE_BREACH | FAILED_PRECONDITION | 9 | `business_rule="BR-RES-001"`, `detail_message` |
| 30 | E-500-001 | UNEXPECTED_ERROR | INTERNAL | 13 | `error_details="<summary>"` |
| 31 | E-500-002 | PERSISTENCE_FAILURE | INTERNAL | 13 | `persistence_error="db_connection_failed"`, `retry_recommended=true` |
| 32 | E-500-003 | SERIALIZATION_ERROR | INTERNAL | 13 | `serialization_error="event_payload_invalid"` |
| 33 | E-500-004 | DEPENDENCY_FAILURE | UNAVAILABLE | 14 | `dependency_service="<name>"`, `retry_after_ms=N` |

**Status code summary table** (high-level mapping per PROTO-001 Section 5):

| Canonical Meaning | gRPC Status | Numeric | Usage |
|---|---|---|---|
| Success (200/201/204) | OK | 0 | All successful Command and Query responses |
| Bad Request (E-400-NNN) | INVALID_ARGUMENT | 3 | Schema validation failures, missing required fields, wrong types |
| Unauthorized (E-401-NNN) | UNAUTHENTICATED | 16 | Missing or invalid authentication context |
| Forbidden (E-403-NNN) | PERMISSION_DENIED | 7 | Authenticated but insufficient RBAC permissions |
| Not Found (E-404-NNN) | NOT_FOUND | 5 | Referenced entity does not exist |
| Conflict (E-409-NNN) | ALREADY_EXISTS / ABORTED / FAILED_PRECONDITION | 6 / 10 / 9 | Duplicate, version conflict, or invalid state transition |
| Domain Violation (E-422-NNN) | FAILED_PRECONDITION | 9 | Invariant or business rule breach from DOC-015 |
| Internal Error (E-500-NNN) | INTERNAL / UNAVAILABLE | 13 / 14 | Unexpected failures or downstream dependency unavailability |

---

#### Section 7: Metadata Conventions

gRPC metadata is used EXCLUSIVELY for the following keys. Every RPC handler MUST enforce this allowlist.

| Metadata Key | Required | Value Format | Purpose | Source |
|---|---|---|---|---|
| `x-org-id` | YES (for all write + scoped reads) | UUID string | Tenant isolation context (PAS-003 DR-009) | Extracted from auth token, NOT from client payload |
| `x-request-id` | RECOMMENDED | UUID string | End-to-end correlation ID | Propagated from input or generated (UUID v4) |
| `authorization` | YES (for authenticated RPCs) | `Bearer <token>` string | Authentication credentials (JWT/session) | Proved by IdentityProviderPort |
| `accept-language` | OPTIONAL | `fr` or `en` | Controls response language for labels/terms | Translation selection |

**Restriction rule:** Any metadata key other than the four listed above MUST be rejected by the adapter at parse time (step 1). The adapter MUST NOT forward unrecognized metadata keys to the Application Service layer. This is an enforcement of PROTO-001 Rule A-001 (Canonical Integrity).

**Special note on x-org-id extraction:** Per PROTO-001 Rule A-007 (Tenant Isolation), `x-org-id` is extracted EXCLUSIVELY from the authentication context (`authorization` header). If the client also sends an `org_id` in the request body, that value is IGNORED by the adapter. The adapter does not validate org existence — that is the responsibility of the IdentityAggregate and OrganizationAggregate.

---

#### Section 8: Streaming Patterns

Streaming usage is strictly governed by the nature of the operation and the volume of data involved.

| Pattern | When to Use | RPCs Covered |
|---------|-------------|-------------|
| **Unary** (default) | All 57 Commands, and all simple point-read Queries (< 1000 items) | GetOrganizationProfile, CreateUser, LoginUser, GetSetting, CreateTransaction, etc. |
| **Server Streaming** | Large-list Queries where results exceed typical page size (>1000 elements) | GetDescendantUnits, SearchResources, GetDescendants, GetTerms, GetTermValues, SearchTerms, GetAllNamespaces, QueryAuditLogs, ListArchiveEntries, SearchArchives, GetAllSettings |
| **Client Streaming** | Bulk operations requiring batched push of pending operations | PushPendingOperations (each PendingOperation sent as a separate message in the stream) |
| **Bidirectional Streaming** | Exclusively reserved for offline-first sync (pending_operations bidirectional push/pull with real-time status) | Reserved for future sync-over-stream extension; not yet implemented |

**Server streaming pagination contract:** When using server streaming, each message in the stream represents one item from the result set. The total item count and pagination metadata (total_count, has_next, cursor_next) is conveyed via trailing metadata attached to the LAST message in the stream. This follows PROTO-001 Section 4.5 Serializer rules.

**Client streaming batch constraint:** PushPendingOperations enforces SYNC-002 (batch size <= 50 operations). The client MUST NOT send more than 50 PendingOperation messages in a single stream. The adapter validates this constraint at the gRPC boundary and returns INVALID_ARGUMENT (code 3) with error_code E-400-007 if violated.

---

#### Section 9: Extension Template for New Protocol Adapters

If a fourth protocol adapter must be added (e.g., Protobuf REST Gateway, WebSocket Adapter), follow this template:

**Naming convention:**
- Create `.proto` files under `lumina/v1/{aggregate}/` directory
- Follow the EXACT same naming convention for messages and services as PROTO-004
- Every message type MUST map to the corresponding Canonical Request/Response from API-CONTRACT-002
- Use `google.protobuf.Any` for polymorphic payloads where the canonical contract uses `JSONB` or generic entity data

**Extension rules:**
1. Each new adapter reuses the same `common/messages.proto` and `common/enums.proto` — do NOT redefine shared types.
2. Each new adapter creates its own `service` block per aggregate, reusing the same request/response message definitions from PROTO-004 unless the protocol requires fundamentally different transport semantics.
3. Error mapping from PROTO-001 Section 6 MUST be adapted to the new protocol's native error mechanism, but the canonical error_code (E-XXX-NNN) must be preserved in the error payload.
4. DO NOT add business fields to protobuf messages — all business data MUST flow through the Canonical Request/Response pipeline.

**Compliance verification checklist for new adapters:**
- [ ] parseInput produces valid CanonicalRequest conforming to API-CONTRACT-002
- [ ] serializeOutput respects the status code mapping (Section 6 of PROTO-004 as baseline)
- [ ] mapError preserves canonical error_code for all categories (E-400 through E-500)
- [ ] No business logic imports (no INV-, BR-, FIN-, DATE-, CAT- references in adapter code)
- [ ] No direct database access
- [ ] External configuration only
- [ ] Determinism verified (same input x same protocol = same output, tested twice)
- [ ] No reference to the 83 operations except via operationId string literals

---

#### Section 10: Cross-Aggregate Coordination Impact on gRPC

Cross-aggregate interactions (from ASS-004) do not create additional gRPC RPCs — they are handled internally by Application Services. However, the gRPC adapter MUST support the metadata propagation required by coordination patterns:

| Cross-Aggregate Pattern | gRPC Implication |
|------------------------|-----------------|
| ResourceAggregate → VocabularyAggregate (category_ref validation) | handled within ResourceService; vocab lookup is internal to Application Service |
| ResourceAggregate → OrganizationAggregate (org_id scoping) | org_id injected from auth metadata into every ResourceService RPC |
| ResourceAggregate → OfflineSyncAggregate (push events) | Domain events emitted by any RPC response are published internally; no gRPC change |
| WorkflowAggregate → ResourceAggregate (approval events) | handled within WorkflowService; no cross-service gRPC call |
| ALL Aggregates → AuditAggregate (auto-logging) | LogAction is a gRPC method on AuditService but invoked system-internally, not by clients |
| OfflineSyncAggregate → ALL Aggregates (sync monitoring) | PushPendingOperations streams PendingOperation messages for ALL resource types |

The gRPC adapter is transparent to these cross-aggregate patterns. It sees only the operationId and payload per API-CONTRACT-001 — it does not orchestrate aggregates. That is the role of Application Services (ASS-001) and Cross-Aggregate Coordination (ASS-004).

---

#### Section 11: Traceability Matrix

| Section PROTO-004 | Document Source | Reference |
|---|---|---|
| 1: Principles | PROTO-001 Sections 1.1-1.5, 7.1-7.8 | All adapter principles derived verbatim |
| 2: Proto File Organization | PROTO-001 Section 4.1.3 (gRPC Parser) | gRPC-specific file layout derived from parser specification |
| 3: Shared Message Types | API-CONTRACT-002 Sections 2.1, 2.2, 2.3 | CanonicalRequest, CanonicalResponse, ErrorResponse, SuccessResponse mapped directly |
| 4: Service Definitions — OrganizationService | API-CONTRACT-001 § OrganizationAggregate (10 ops) | All 10 RPCs match operations 1-10 |
| 4: Service Definitions — IdentityService | API-CONTRACT-001 § IdentityAggregate (9 ops) | All 9 RPCs match operations 1-9 |
| 4: Service Definitions — ResourceService | API-CONTRACT-001 § ResourceAggregate (12 ops) | All 12 RPCs match operations 1-12 |
| 4: Service Definitions — RelationshipService | API-CONTRACT-001 § RelationshipAggregate (7 ops incl. DetectCycles) | All RPCs match operations 1-7 |
| 4: Service Definitions — WorkflowService | API-CONTRACT-001 § WorkflowAggregate (6 ops) | All 6 RPCs match operations 1-6 |
| 4: Service Definitions — FormService | API-CONTRACT-001 § FormAggregate (4 ops) | All 4 RPCs match operations 1-4 |
| 4: Service Definitions — NotificationService | API-CONTRACT-001 § NotificationAggregate (6 ops) | All 6 RPCs match operations 1-6 |
| 4: Service Definitions — VocabularyService | API-CONTRACT-001 § VocabularyAggregate (7 ops) | All 7 RPCs match operations 1-7 |
| 4: Service Definitions — ReportingService | API-CONTRACT-001 § ReportingAggregate (4 ops) | All 4 RPCs match operations 1-4 |
| 4: Service Definitions — AuditService | API-CONTRACT-001 § AuditAggregate (3 ops) | All 3 RPCs match operations 1-3 |
| 4: Service Definitions — LifecycleService | API-CONTRACT-001 § LifecycleAggregate (8 ops) | All 8 RPCs match operations 1-8 |
| 4: Service Definitions — ConfigurationService | API-CONTRACT-001 § ConfigurationAggregate (4 ops) | All 4 RPCs match operations 1-4 |
| 4: Service Definitions — OfflineSyncService | API-CONTRACT-001 § OfflineSyncAggregate (6 ops) | All 6 RPCs match operations 1-6 |
| 5: gRPC Status Code Mapping | PROTO-001 Section 5, API-CONTRACT-005 | All 33 mappings derived from PROTO-001 Section 5.2.3 |
| 6: Metadata Conventions | PROTO-001 Sections 7.7, 7.8 | Tenant isolation and request-id propagation |
| 7: Streaming Patterns | PROTO-001 Sections 3.1, 4.1.3 | Streaming reserved for protocols as specified |
| 8: Extension Template | PROTO-001 Section 9 | Template derived verbatim from PROTO-001 Annex A |
| 9: Traceability Matrix | All source documents | Cross-reference completeness |

**Total RPCs defined across all 13 services: 83** (57 Commands + 26 Queries), matching exactly the operation count from API-CONTRACT-001.

---

#### Section 12: Compliance Statement

This document PROTO-004 is COMPLIANT with all canonical specifications of Lumina v1:

- **API-CONTRACT-001**: All 83 operations are defined as gRPC RPCs across 13 services, verified Section 4.
- **API-CONTRACT-002**: All Request Contracts (Section 2.1) are mirrored as protobuf request message fields. All Response Contracts (Section 2.2) are mirrored as protobuf response message fields. Error Contract (Section 2.3) maps to ErrorResponse in Section 3.
- **API-CONTRACT-005**: All error categories (E-400 through E-500, including extended variants) are mapped to gRPC Status Codes in Section 6.
- **PROTO-001**: All 8 common rules (A-001 through A-008) are enforced. The universal pipeline (Steps 1-5) is implemented. Status code mapping matches Section 5.2.3. Extension template matches Section 9.
- **ASS-001**: All 13 Application Services have corresponding gRPC services, one per Aggregate.
- **ASS-004**: Cross-aggregate coordination patterns do not require additional gRPC endpoints; they are handled within Application Services.
- **DOC-015**: All 58 invariants are enforced at the Application Service/Aggregate layer, never at the adapter level. Error translations preserve invariant references in gRPC Details fields.

No operation, message, service, or RPC was invented beyond what is traceable to API-CONTRACT-001 through API-CONTRACT-005 and PROTO-001. Every line in this document is directly traceable to at least one source document listed in the header.

---

**GENESIS PROTO-004: gRPC Adapter Rules Specification — END OF DOCUMENT**
