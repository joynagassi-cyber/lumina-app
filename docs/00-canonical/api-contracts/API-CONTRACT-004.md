# Authorization Mapping — Lumina v1

**Doc ID:** API-CONTRACT-004
**Version:** v1.0
**Statut:** CONTRAT CANONIQUE DEFINI PAR GENESIS
**Date:** 2026-07-25
**Generateur :** api-contract-generator v1.0
**Source canonique :** ["DOC-012", "DOC-013", "DOC-014", "DOC-015"]
**Transformation_rule :** "api-contract-generator v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document mappe chaque operation d'API vers ses permissions RBAC, roles, capabilities, et invariant guards. Les roles sont FONCTIONNELS (RBAC applicatif), pas PostgreSQL RLS.

---

## RBAC ROLE HIERARCHY

| Role | Permissions Granted | Can Create | Can Approve | Can Administer | Scope |
|------|--------------------|------------|-------------|----------------|-------|
| **superadmin** | ALL permissions (wildcard "*") | All users (any role) | All workflows | All organizations | Global |
| **admin** | transaction:*, member:*, event:*, form:read/write, lifecycle:*, config:*, reporting:read | Members, transactions, events | Transactions | Org units, settings, users (non-superadmin) | Single org |
| **treasurer** | transaction:create, transaction:approve, transaction:read | Transactions only | Transactions within threshold | None | Single org |
| **pastor** | transaction:read, workflow:approve, notification:read | None | Workflows (approval steps) | None | Single org |
| **staff** | resource:read (query only on all types) | None | None | None | Single org |

### Permission Grant Format

Format: `resource:action:level`

Examples:
- `transaction:create:org` — create transactions at org level
- `transaction:approve:org` — approve transactions at org level
- `member:read:org` — read members at org level
- `workflow:approve:instance` — approve specific workflow instances
- `config:update:org` — update org settings
- `*:*:*` — wildcard (superadmin only, audited)

### Role Creation Rules (from DOC-014 actors)

| Action | Authorized Actor | Constraint |
|--------|-----------------|------------|
| Create superadmin user | SuperAdmin only | Never created by admin |
| Create admin user | SuperAdmin only | Never created by admin |
| Create treasurer/pastor/staff | SuperAdmin or Admin | Admin restricted to non-admin roles (BR-ID-005) |
| Change any user's role | SuperAdmin only | Role hierarchy enforced |

---

================================================================================
AGGREGATE 1: OrganizationAggregate — Authorization
================================================================================

### Operation: CreateOrganization

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| organization:create | superadmin | ManifestLoader | INV-004 (org isolation) | Only superadmin can create orgs |

Precondition chain:
1. User is authenticated as superadmin
2. No org_id needed (auto-generated)
3. Name non-empty, type enum valid (BR-ORG-001)
4. INV-004 multi-tenant isolation guaranteed by auto-generated org_id

---

### Operation: UpdateOrganizationSettings

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| config:update:org | admin | Configuration | CFG-001, CFG-002, CFG-003, CFG-004 | Admin of the target org |

Precondition chain:
1. User authenticated; org_id resolved from session
2. User has config:update:org permission for that org
3. Setting key exists in configuration schema
4. Value format validated per setting type

---

### Operation: CreateOrgUnit

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| organization_unit:create | admin | Relationship | REL-001 (DAG integrity), REL-002 (depth ≤5) | Admin of target org |

---

### Operation: UpdateOrgUnitParent

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| organization_unit:reparent | superadmin | Relationship | REL-001 (cycle detection via Kahn's algo) | SuperAdmin only |

---

### Operation: TransferChildOrg

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| organization:transfer | superadmin | ManifestLoader | REL-001 (no cycle) | SuperAdmin only |

---

### Operation: MergeOrganizations

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| organization:merge | superadmin | ManifestLoader | INV-004 (isolation preserved post-merge) | BR-ORG-005 (superadmin validation) |

---

### Operation: ArchiveOrganization

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| organization:archive | superadmin | ManifestLoader | — | Status transition active → archived |

---

### Operation: SuspendOrganization

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| organization:suspend | superadmin | ManifestLoader | BR-ORG-006 (write locked post-suspend) | Status transition active → suspended |

---

### Query Operations (read-only — lower auth barrier)

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| GetOrganizationProfile | organization:read:org | admin, treasurer, pastor, staff | INV-004 (org isolation) |
| GetDescendantUnits | organization_unit:read:org | admin | REL-002 (depth ≤5) |

---

================================================================================
AGGREGATE 2: IdentityAggregate — Authorization
================================================================================

### Operation: CreateUser

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| user:create | superadmin, admin | PermissionResolver | EMAIL-001 (unique by org) | SuperAdmin creates any role; Admin limited to treasurer/pastor/staff |

Precondition chain:
1. User authenticated; org_id from session
2. Sufficient RBAC for user:create
3. Email unique within org (EMAIL-001)
4. Password hash strong (BR-ID-001)
5. Role creation respects hierarchy (BR-ID-005)

---

### Operation: UpdateUserProfile

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| user:update:self | self | PermissionResolver | EMAIL-001 (if email changed) | Self-update allowed |
| user:update:any | admin, superadmin | PermissionResolver | EMAIL-001 (if email changed) | Admin updates other users |

---

### Operation: ChangeUserRole

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| user:role:change | superadmin only | PermissionResolver | Role hierarchy enforced | SuperAdmin ONLY |

---

### Operation: ResetPassword

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| password:reset:self | self | PermissionResolver | BR-ID-001 (hash complexity) | Self-request |
| password:reset:any | admin, superadmin | PermissionResolver | BR-ID-001 (hash complexity) | Admin force-reset |

---

### Operation: LoginUser

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| auth:login | N/A (system action) | Authentication | INV-004 (org_id match), INV-008 (double validation) | No permission grant needed |

---

### Operation: LogoutUser

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| auth:logout:self | self | SessionManager | — | Self-logout |
| auth:logout:any | superadmin | SessionManager | — | SuperAdmin revokes any session |

---

### Operation: RefreshAccessToken

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| auth:refresh | self | SessionManager | Token not expired | Self-refresh |

---

### Operation: RevokeSession

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| session:revoke:self | self | SessionManager | — | Self-revoke |
| session:revoke:any | superadmin | SessionManager | — | SuperAdmin revokes any session |

---

### Operation: AssignPermissionGrant

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| permission:assign | superadmin only | PermissionResolver | Wildcard ["*"] audited but authorized | SuperAdmin only |

---

================================================================================
AGGREGATE 3: ResourceAggregate — Authorization
================================================================================

### Operation: CreateTransaction

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| transaction:create | admin, treasurer | CreateResource | FIN-002, DATE-001, CAT-001, SCOPE-001 | Requires org_id context; CREATEBY-001 injected |

---

### Operation: UpdateDraftTransaction

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| transaction:update:draft | admin, creator | CreateResource | FIN-001 (approved immutable) | Draft only; creator of draft can update |

---

### Operation: SubmitForApproval

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| transaction:submit | admin, treasurer, pastor | Any with write | — | Any role with write permission on transaction |

---

### Operation: ApproveTransaction

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| transaction:approve | admin, treasurer | ApproveResource | BR-RES-001 | Requires pending status; approver must have permission |

---

### Operation: RejectTransaction

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| transaction:reject | admin | RejectResource | BR-RES-001 | Admin only; reason required |

---

### Operation: CompensateTransaction

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| transaction:create | admin, treasurer | CreateResource | COMP-001 (link to original) | Same as create (creates new compensating tx) |

---

### Operation: CreateMember

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| member:create | admin | CreateResource | MEM-001 (firstName+lastName) | Admin only |

---

### Operation: UpdateMember

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| member:update | admin | CreateResource | MEM-001 (always mandatory) | Admin only |

---

### Operation: TransitionMemberStatus

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| member:status:transition | admin | CreateResource | STATUS-010 (valid states only), TRANS-012 (certificate for transfer) | Admin only |

---

### Query Operations (read — broad access)

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| SearchResources | resource:read | admin, treasurer, pastor, staff | INV-004 (org isolated); read permission on resource type |
| ExportResources | reporting:read | admin, treasurer | EXPORT-001 (export timestamped) |

---

================================================================================
AGGREGATE 4: RelationshipAggregate — Authorization
================================================================================

### Operation: AddMemberToGroup

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| membership:manage | admin | Relationship | MULTI-020 (no duplicate PK) | Admin only |

---

### Operation: RemoveMemberFromGroup

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| membership:manage | admin | Relationship | HISTORY-022 (audit trail) | Admin only |

---

### Operation: SetOrgUnitParent

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| org_unit:reparent | superadmin | Relationship | REL-001 (cycle detection), REL-002 (depth ≤5) | SuperAdmin only |

---

### Query Operations

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| GetDescendants | organization_unit:read | admin | REL-002 (depth ≤5) |
| GetAllGroupsForMember | membership:read | admin, treasurer, pastor, staff | INV-004 (org isolated) |
| GetAllMembersOfGroup | membership:read | admin, treasurer, pastor, staff | INV-004 (org isolated) |
| DetectCycles | system-only | superadmin | REL-001 (preemptive check) |

---

================================================================================
AGGREGATE 5: WorkflowAggregate — Authorization
================================================================================

### Operation: TriggerWorkflow

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| workflow:trigger | system (auto), admin | WorkflowExecutor | LOG-005 (execution states logged) | System-auto on trigger event OR admin manual |

---

### Operation: ApproveStep

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| workflow:approve | assigned approver role | WorkflowExecutor | CHAINS-003 (≤5 levels), WF-005 (never modifies approved tx) | Must be assigned to this step |

---

### Operation: RejectStep

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| workflow:reject | assigned approver role | WorkflowExecutor | WF-001 (timeout), LOG-005 | Must be assigned to this step; reason required |

---

### Operation: CancelWorkflow

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| workflow:cancel | admin, assigned approver | WorkflowExecutor | LOG-005 | Running workflows only |

---

### Operation: ResubmitForApproval

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| workflow:resubmit | requester (creator) | WorkflowExecutor | RETRY-004 (manual only) | Creator resubmits rejected workflow |

---

### Query Operation

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| GetPendingApprovals | workflow:read | admin, any assigned approver | LOG-005 |

---

================================================================================
AGGREGATE 6: FormAggregate — Authorization
================================================================================

### Operations (all require basic authentication)

| Operation | Permission | RBAC Role | Invariant Guard | Notes |
|-----------|-----------|-----------|-----------------|-------|
| LoadFormDefinition | form:read | any authenticated | FRM-004 (versioning) | Any authenticated user |
| ValidateFormData | form:validate | any authenticated | DUAL-008 (client = server) | Client + server both validate identically |
| RenderForm | form:read | any authenticated | FRM-001 (no hardcoded), VOCAB-002 | Produces render tree |
| GetVisibleFields | form:read | any authenticated | FRM-003 (visible_if conditions) | Read-only |

---

================================================================================
AGGREGATE 7: NotificationAggregate — Authorization
================================================================================

### Operation: SendNotification

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| notification:send | system (auto), admin | NotificationRouter | NOT-001 (always triggered) | System-triggered by workflow OR manual admin |

---

### Operation: MarkAsRead

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| notification:read:self | self | NotificationRouter | — | Self only |

---

### Operation: UpdatePreferences

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| notification:pref:self | self | NotificationRouter | CHANNEL-003 | Self-update |
| notification:pref:any | admin | NotificationRouter | CHANNEL-003 | Admin updates other users |

---

### Operation: SetRateLimit

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| notification:ratelimit | admin | RateLimitEnforcer | RATE-002 | Admin only |

---

### Operation: SuppressUntil

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| notification:suppress | admin | NotificationRouter | QUIET-004 (critical bypasses) | Admin only |

---

================================================================================
AGGREGATE 8: VocabularyAggregate — Authorization
================================================================================

### Operation: AddTermValue

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| vocabulary:manage | admin | VocabularyExecutor | STABLE-003 (key stable), TRANSLATION-002 (min FR+EN) | Admin only |

---

### Operation: DeprecateTermValue

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| vocabulary:manage | admin | VocabularyExecutor | VOC-001 (never delete, only deprecate) | Admin only; IRREVERSIBLE |

---

### Query Operations (open reads — vocabulary is lookup data)

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| ResolveLabel | vocabulary:read | any authenticated | TRANSLATION-002 (min FR+EN) |
| GetTerms | vocabulary:read | any authenticated | — |
| GetTermValues | vocabulary:read | any authenticated | — |
| SearchTerms | vocabulary:read | any authenticated | — |
| GetAllNamespaces | vocabulary:read | any authenticated | — |

---

================================================================================
AGGREGATE 9: ReportingAggregate — Authorization
================================================================================

### Operation: GenerateReport

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| reporting:generate | admin, treasurer | ReportGenerator | BAL-001, MONTH-001, SYNCED-001, EXPORT-001 | reading permission required |

---

### Operation: CalculateBalance

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| reporting:calculate | system (auto), admin | BalanceCalculator | BAL-001, MONTH-001, SYNCED-001 | System-invoked or admin request |

---

### Operation: ExportReport

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| reporting:export | admin, treasurer | ReportGenerator | EXPORT-001, ARCHIVED-001 | reporting:read permission |

---

### Query Operation

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| GetReportTypes | reporting:read | any authenticated | — |

---

================================================================================
AGGREGATE 10: AuditAggregate — Authorization
================================================================================

### Operation: LogAction

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| audit:log | SYSTEM ONLY (auto) | AuditLogger | AUD-001 (immutable), OLDNEW-002 (old+new values) | Not user-callable |

---

### Query Operations

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| QueryAuditLogs | audit:read | admin, auditor | ACCESS-033 (restricted roles) |
| ExportAuditTrail | audit:export | admin | ACCESS-033, RETENTION-031 (min 7 years) |

---

================================================================================
AGGREGATE 11: LifecycleAggregate — Authorization
================================================================================

### Operation: ArchiveResource

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| lifecycle:archive | admin | LifecycleExecutor | LIF-001 (manifest-configured types) | Admin only |

---

### Operation: TrashResource

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| lifecycle:trash | admin | LifecycleExecutor | LIF-003 (must not be purged) | Admin only; state archived → trashed |

---

### Operation: PurgeResource

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| lifecycle:purge | SYSTEM ONLY (scheduled) | LifecycleExecutor | LIF-003 (irreversible), LIF-005 (purge_date reached) | System cron job; never user-callable |

---

### Operation: RestoreFromTrash

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| lifecycle:restore | admin | LifecycleExecutor | LIF-003 (must not be purged) | Admin only; state trashed → archived |

---

### Query Operations

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| ListArchiveEntries | lifecycle:read | admin | LIF-006 (trashed excluded from normal query) |
| SearchArchives | lifecycle:read | admin | — |

---

### Operation: ApplyTags

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| lifecycle:tag | admin | LifecycleExecutor | — | Admin only |

---

### Operation: SchedulePurge

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| lifecycle:schedule | admin | LifecycleExecutor | LIF-005 (purge_date configurable per type) | Admin only |

---

================================================================================
AGGREGATE 12: ConfigurationAggregate — Authorization
================================================================================

### Operation: UpdateSetting

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| config:update | admin | ConfigurationExecutor | CFG-001, CFG-002, CFG-003, CFG-004 | Admin only; format validated |

---

### Operation: ResetToDefaults

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| config:reset | admin | ConfigurationExecutor | CFG-004 (every setting has default) | Admin only |

---

### Query Operations

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| GetSetting | config:read | admin | CFG-004 |
| GetAllSettings | config:read | admin | CFG-004 |

---

================================================================================
AGGREGATE 13: OfflineSyncAggregate — Authorization
================================================================================

### Operation: PushPendingOperations

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| sync:push | SYSTEM (auto) | PushCoordinator | SYNC-001 (local first), SYNC-002 (batch ≤50), SYNC-003 (exponential backoff) | System auto; never user-initiated |

---

### Operation: PullRemoteChanges

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| sync:pull | SYSTEM (auto) | PullCoordinator | SYNC-004 (never blocks user ops) | System auto; never user-initiated |

---

### Operation: ResolveConflict

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| sync:resolve | SYSTEM (auto), admin | ConflictResolver | SYNC-001 (strategy per entity type) | Auto-detected or admin-resolved |

---

### Operation: MarkOperationConfirmed

| Permission | RBAC Role | Capability | Invariant Guard | Notes |
|-----------|-----------|------------|-----------------|-------|
| sync:confirm | SYSTEM (auto) | PushCoordinator | — | System auto on successful push |

---

### Query Operations

| Operation | Permission | RBAC Role | Invariant Guard |
|-----------|-----------|-----------|-----------------|
| CheckConnectivity | sync:status | any authenticated | SYNC-004 |
| GetSyncStatus | sync:status | any authenticated | — |

---

## DATA ISOLATION RULE

All operations above are scoped to org_id resolved from session/tenant context.
No cross-org operations are possible through any authorization path.
The org_id is NEVER accepted as user-input — it is always resolved from the authenticated session.

## NOTE ON RLS

This document does NOT define any Row-Level Security policies. RLS policies are handled at the persistence layer (see migration-rls-pack documents). The RBAC mapping above is purely application-level authorization.
