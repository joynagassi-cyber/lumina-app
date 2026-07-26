# Application Workflow Specification
**Doc ID:** ASS-003
**Version:** v1.0
**Statut:** SPECIFICATION CANONIQUE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** service-generator v1.0 (spec-only)
**Source canonique :** ["DOC-012", "DOC-013", "DOC-014", "DOC-015", "API-CONTRACT-001", "API-CONTRACT-005"]
**Transformation_rule :** "application-service-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **workflow patterns** used by Application Services to orchestrate Commands and Queries across Aggregates. It covers:

1. The standard workflow pattern applicable to ALL 83 operations
2. Cross-aggregate coordination patterns for multi-Aggregate operations
3. Rollback points, transaction boundaries, idempotence guarantees, and compensation strategies

---

## WORKFLOW STANDARD

Pattern universal for EVERY Command or Query operation.

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   API Layer  │────▶│ Validation   │────▶│ Aggregate Load │
│  (contract)  │     │ (input spec) │     │ (Repository)  │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                   │
                                                   ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Response    │◀────│  Persist     │◀────│  Invariant    │
│  (contract)  │     │  (abstract)  │     │  Guard        │
└─────────────┘     └──────────────┘     └───────▲───────┘
                                                   │
                                                   ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Event Bus  │◀────│  Events      │◀────│  Command/     │
│  (publish)   │     │  capture     │     │  Query exec   │
└─────────────┘     └──────────────┘     └───────────────┘
```

### Step-by-step Detail

#### Step 1: Input Validation

- **Entrance**: Request Contract from API-CONTRACT-002
- **Validation**: Schema validation (required fields, types, value ranges) + enum checks + pattern validation (ISO 4217, IANA, hex regex, email format)
- **Exit**: Validated data ready for Domain pass-through
- **Failure path**: Return error per API-CONTRACT-005 (E-400-NNN codes) before any Aggregate loading

#### Step 2: Authorization Check (BEFORE Aggregate Load)

- **Entrance**: Authenticated user context with resolved org_id from session
- **Check**: Verify RBAC role from API-CONTRACT-004 against operation requirements
- **Exit**: Authorization confirmed OR error returned (E-401-NNN, E-403-NNN)
- **Failure path**: Return 401/403 error immediately — never load Aggregate without auth

#### Step 3: Aggregate Loading

- **Entrance**: Entity ID from validated input (or none for Create operations)
- **Source**: Repository abstraction interface (never direct SQL)
- **Pattern**: Load by ID → Aggregate instantiated → State restored from persistence
- **Create operations**: New Aggregate instance created (no load needed)
- **Fallback**: Return E-404-001 (ENTITY_NOT_FOUND) if Aggregate not found

#### Step 4: Domain Execution

- **Entrance**: Loaded Aggregate + validated Command/Query parameters
- **Action**: Invoke the specific boundary method on the Aggregate
- **Result**: State modified (Command) or read result (Query)
- **Events**: All Domain Events captured into a list within the Application Service
- **Failure path**: Domain exception caught → mapped to appropriate API-CONTRACT-005 error

#### Step 5: Invariant Guard

- **Entrance**: Domain Events list + new Aggregate state
- **Verification**: Each invariant from DOC-015 listed in the use case specification is verified inside the Aggregate boundary method (not in the Application Service)
- **Fail**: Exception thrown → mapped to E-422-NNN_INV-XXX errors per API-CONTRACT-005
- **Pass**: Continue to persistence

#### Step 6: Persistence

- **Entrance**: Modified Aggregate state
- **Abstraction**: Repository.save() interface — no optimistic lock version check specified at this layer
- **Transaction scope**: Transaction begins before Step 2, commits after Step 7, rolls back on any error
- **Failure path**: Rollback entire transaction; return E-500-002 (PERSISTENCE_FAILURE)

#### Step 7: Event Publishing

- **Entrance**: Captured Domain Events list from Step 4
- **Destination**: Event Bus abstraction interface
- **Ordering**: Events published in the order they were emitted by the Aggregate
- **Failure path**: If event bus unavailable, retry with exponential backoff (max 5 attempts); continue persists data anyway (eventual consistency)

#### Step 8: Response

- **Entrance**: Domain result or Aggregate state after successful completion
- **Format**: Response Contract from API-CONTRACT-002
- **HTTP Mapping**: Success → 200/201; Error codes mapped per API-CONTRACT-005 taxonomy
- **Failure path**: Already handled; returns error response

---

## QUERY-SPECIFIC WORKFLOW (Read Operations)

For all 26 Query operations, the workflow is simplified:

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   API Layer  │────▶│ Validation   │────▶│ Aggregate Load │
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                   │
                                                   ▼
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Response    │◀────│  NO mutation │◀────│  Read method  │
│  (contract)  │     │  (side-free) │     │  execution    │
└─────────────┘     └──────────────┘     └───────────────┘
```

Key differences from Command workflow:
- No persistence step (read-only — no mutations)
- No event publishing (queries produce zero Domain Events per ASS-NB-010)
- No invariant guards needed (reads don't change state)
- No transaction needed (reads are isolated by nature)

---

## CROSS-AGGREGATE WORKFLOW PATTERNS

Some operations implicitly involve multiple Aggregates through event propagation or cross-reference lookups. Three patterns are defined:

### Pattern 1: Linear Orchestration

Aggregate A → Events → Aggregate B → ...

- Sequential execution: one Aggregate active at a time
- Events from one Aggregate trigger actions in another
- Each step completes before the next begins
- Single transaction per Aggregate; cross-Aggregate events handled eventually

**Used by these use cases**:
- UC-RES-03 (SubmitForApproval): ResourceAggregate emits ApprovalRequested → WorkflowAggregate reacts (eventually consistent)
- UC-RES-04 (ApproveTransaction): ResourceAggregate emits ResourceStateChanged → WorkflowAggregate may advance to next step
- UC-RPT-01 (GenerateReport): ReportingAggregate reads from ResourceAggregate (via Repository abstraction, not direct coordination)
- UC-WF-01 (TriggerWorkflow): System triggers workflow on resource event; notification sent via NotificationAggregate (eventual)

### Pattern 2: Parallel Fan-Out

Aggregate A + Aggregate B + ... queried in parallel

- Multiple Aggregates read simultaneously
- Results combined in the response
- No modification to any Aggregate
- Used purely for read aggregation

**Used by these use cases**:
- UC-RES-Q01 (SearchResources): May fan-out to search TransactionRecord, MemberRecord, EventRecord in parallel (all within ResourceAggregate boundary)
- UC-REL-Q02 + UC-REL-Q03 (GetAllGroupsForMember, GetAllMembersOfGroup): RelationshipAggregate queries both directions simultaneously
- UC-VOC-Q04 (SearchTerms): VocabularyAggregate searches across potentially multiple namespaces

### Pattern 3: Saga Compensation

Aggregate A → Aggregate B → (if failure: compensate A)

- Multi-Aggregate operation where failure requires undoing previous steps
- Each step has a compensating action
- Used only when data consistency across aggregates is required

**Used by these use cases**:
- UC-WF-02 (ApproveStep) with ResourceAggregate side effect: If workflow approval succeeds but resource state transition fails → cancel workflow step
- UC-LIF-01 (ArchiveResource): If archive succeeds but ResourceAggregate update fails → compensate archive entry deletion

---

## DETAILED CROSS-AGGREGATE WORKFLOWS

### Workflow: SubmitForApproval → Workflow Activation

```
Step 1: ResourceService.SubmitForApproval(id)
  → ResourceAggregate submits (draft→pending)
  → Emits ApprovalRequested event

Step 2: EventBus propagates ApprovalRequested to WorkflowAggregate
  → WorkflowInstance created (auto-triggered by system)
  → Emits WorkflowTriggered event

Step 3: NotificationService sends alert to approvers
  → NotificationAggregate queues notification
  → Emits NotificationQueued event

Rollback point: Step 1 is the only write; Steps 2-3 are event-driven eventual.
  If Step 2 fails: Retry event processing with exponential backoff (max 5 attempts).
  If Step 3 fails: Notification can be retried asynchronously; resource state already pending.
```

### Workflow: ApproveTransaction → State Change

```
Step 1: ResourceService.ApproveTransaction(id, approver)
  → ResourceAggregate transitions pending→approved
  → Emits ResourceStateChanged + ApprovalGranted

Step 2: If workflow was tracking this resource:
  → EventBus propagates ApprovalGranted to WorkflowAggregate
  → WorkflowAggregate marks step as approved
  → Emits StepApproved event

Step 3: If approval triggers notification:
  → EventBus propagates to NotificationAggregate
  → Notification sent to requester (success confirmation)

Rollback point: Step 1 is committed atomically. Steps 2-3 are eventual.
  Compensating action: If workflow step cannot be approved, log to AuditAggregate but keep resource approved.
```

### Workflow: ArchiveResource → Resource Reference

```
Step 1: LifecycleService.ArchiveResource(resourceType, resourceId)
  → Creates ArchiveEntry with state=archived
  → References original resource by type+id
  → Emits ResourceArchived event

Step 2: AuditAggregate.LogAction auto-invoked (system)
  → Logs: {action: ARCHIVE, entityType: resourceType, entityId: resourceId, oldValues: {...}, newValues: {state: archived}}
  → Emits ActionLogged (internal)

Rollback point: Step 1 is the write; Step 2 is side-effect.
  If Step 2 fails: Retry audit logging; do NOT rollback archive.
```

### Workflow: PushPendingOperations → Conflict Detection

```
Step 1: OfflineSyncService.PushPendingOperations()
  → Local queue batched ≤50 ops
  → Each op sent to remote repository abstraction
  → Emits BatchPushed event

Step 2: Remote responses processed
  → Confirmed ops: sync_status = confirmed
  → Conflict ops: ConflictDetected event emitted
  → Failed ops: sync_status = failed (retry queued with backoff)

Step 3: For each ConflictDetected:
  → OfflineSyncService.ResolveConflict(operation, serverData)
  → Strategy applied: LWW, server-wins, immutable, uuid-dedup
  → Emits ConflictResolved event

Rollback point: Pending operations remain "sent" until confirmed.
  If remote unavailable: Ops stay "pending"; retry scheduled.
  No data loss: Local queue is source of truth until confirmation.
```

---

## TRANSACTION BOUNDARIES

### Default Pattern: Single-Aggregate Transaction

Each operation touches exactly ONE Aggregate. The transaction is:
- **Begins**: Before Aggregate load (Step 2 above)
- **Commits**: After persistence (Step 6)
- **Rolls back**: On any error during steps 2-6

### Multi-Aggregate Transactions: Saga Pattern

When an operation crosses Aggregate boundaries (events propagating between Aggregates):
- **Each Aggregate has its own transaction**
- **Cross-Aggregate consistency is EVENTUAL** (via Domain Events)
- **Compensating actions** undo work if downstream steps fail

### Rollback Points

| Step | Rollback Possible? | Severity if Rollover |
|------|-------------------|---------------------|
| Step 1: Input Validation | N/A (before DB touch) | None |
| Step 2: Auth Check | N/A (before DB touch) | None |
| Step 3: Aggregate Load | N/A (read-only) | None |
| Step 4: Domain Execution | YES | Low — aggregate state unchanged |
| Step 5: Invariant Guard | YES | Low — same as step 4 |
| Step 6: Persistence | YES | HIGH — must complete or fully rollback |
| Step 7: Event Publishing | PARTIAL | Medium — data persisted, events lost (retry) |

---

## IDEMPOTENCE GUARANTEES

Operations marked as idempotent in ASS-002 follow these patterns:

| Idempotence Type | Operations | Mechanism |
|-----------------|-----------|-----------|
| TRUE (full) | All 26 Query operations | No mutation = always safe to repeat |
| TRUE (conditional) | UC-ORG-07, UC-ORG-08, UC-ID-06, UC-ID-08, UC-REL-02, UC-WF-04, UC-VOC-02, UC-CFG-01, UC-CFG-02, UC-SYNC-01..04, UC-LIF-03, UC-LIF-04 | State checks prevent double-action |
| FALSE | UC-ORG-01, UC-ORG-03, UC-RES-01, UC-ID-01, UC-ID-05, UC-REL-01 | PK uniqueness enforced by Domain invariants |

---

## PER-OPERATION WORKFLOW CLASSIFICATION

| Use Case | Pattern | Transaction Scope | Idempotent? |
|----------|---------|-------------------|-------------|
| UC-ORG-01 (CreateOrg) | Standard | Single Aggregate | NO |
| UC-ORG-02 (UpdateSettings) | Standard | Single Aggregate | YES (partial) |
| UC-ORG-03 (CreateOrgUnit) | Standard | Single Aggregate | NO |
| UC-ORG-04 (UpdateOrgUnitParent) | Standard | Single Aggregate | NO |
| UC-ORG-05 (TransferChildOrg) | Standard | Single Aggregate | NO |
| UC-ORG-06 (MergeOrganizations) | Standard | Single Aggregate | NO |
| UC-ORG-07 (ArchiveOrg) | Standard | Single Aggregate | YES |
| UC-ORG-08 (SuspendOrg) | Standard | Single Aggregate | YES |
| UC-ORG-Q01 (GetProfile) | Query | Read-only | YES |
| UC-ORG-Q02 (GetDescendants) | Query | Read-only | YES |
| UC-ID-01 (CreateUser) | Standard | Single Aggregate | NO |
| UC-ID-02 (UpdateProfile) | Standard | Single Aggregate | YES |
| UC-ID-03 (ChangeRole) | Standard | Single Aggregate | YES |
| UC-ID-04 (ResetPassword) | Standard | Single Aggregate | NO |
| UC-ID-05 (Login) | Standard | Single Aggregate | NO |
| UC-ID-06 (Logout) | Standard | Single Aggregate | YES |
| UC-ID-07 (RefreshToken) | Standard | Single Aggregate | NO |
| UC-ID-08 (RevokeSession) | Standard | Single Aggregate | YES |
| UC-ID-09 (AssignPermission) | Standard | Single Aggregate | YES |
| UC-RES-01 (CreateTx) | Standard + Cross-Aggregate | Single Aggregate (+ event fan-out) | NO |
| UC-RES-02 (UpdateDraftTx) | Standard | Single Aggregate | NO |
| UC-RES-03 (SubmitApproval) | Standard + Linear Orchestration | Single Aggregate | NO |
| UC-RES-04 (ApproveTx) | Standard + Linear Orchestration | Single Aggregate | NO |
| UC-RES-05 (RejectTx) | Standard + Linear Orchestration | Single Aggregate | NO |
| UC-RES-06 (CompensateTx) | Standard | Single Aggregate | NO |
| UC-RES-07 (CreateMember) | Standard | Single Aggregate | NO |
| UC-RES-08 (UpdateMember) | Standard | Single Aggregate | YES |
| UC-RES-09 (TransitionStatus) | Standard | Single Aggregate | YES |
| UC-RES-Q01 (SearchResources) | Query | Read-only | YES |
| UC-RES-Q02 (ExportResources) | Query | Read-only | YES |
| UC-REL-01 (AddToGroup) | Standard | Single Aggregate | NO |
| UC-REL-02 (RemoveFromGroup) | Standard | Single Aggregate | YES |
| UC-REL-03 (SetOrgUnitParent) | Standard | Single Aggregate | NO |
| UC-REL-Q01 (GetDescendants) | Query | Read-only | YES |
| UC-REL-Q02 (GetGroupsForMember) | Query | Read-only | YES |
| UC-REL-Q03 (GetMembersOfGroup) | Query | Read-only | YES |
| UC-WF-01 (TriggerWorkflow) | Standard + Linear Orchestration | Single Aggregate | YES |
| UC-WF-02 (ApproveStep) | Standard + Linear Orchestration | Single Aggregate | NO |
| UC-WF-03 (RejectStep) | Standard + Linear Orchestration | Single Aggregate | NO |
| UC-WF-04 (CancelWorkflow) | Standard | Single Aggregate | YES |
| UC-WF-05 (Resubmit) | Standard | Single Aggregate | NO |
| UC-WF-Q01 (GetPending) | Query | Read-only | YES |
| UC-FRM-01 (ValidateForm) | Standard (validation only) | Single Aggregate | YES |
| UC-FRM-Q01 (LoadForm) | Query | Read-only | YES |
| UC-FRM-Q02 (RenderForm) | Query | Read-only | YES |
| UC-FRM-Q03 (GetVisibleFields) | Query | Read-only | YES |
| UC-NOT-01 (SendNotification) | Standard + Linear Orchestration | Single Aggregate | NO |
| UC-NOT-02 (MarkAsRead) | Standard | Single Aggregate | YES |
| UC-NOT-03 (UpdatePreferences) | Standard | Single Aggregate | YES |
| UC-NOT-04 (SetRateLimit) | Standard | Single Aggregate | YES |
| UC-VOC-01 (AddTermValue) | Standard | Single Aggregate | NO |
| UC-VOC-02 (DeprecateValue) | Standard | Single Aggregate | YES |
| UC-VOC-Q01 (ResolveLabel) | Query | Read-only | YES |
| UC-VOC-Q02 (GetTerms) | Query | Read-only | YES |
| UC-VOC-Q03 (GetTermValues) | Query | Read-only | YES |
| UC-VOC-Q04 (SearchTerms) | Query | Read-only | YES |
| UC-VOC-Q05 (GetNamespaces) | Query | Read-only | YES |
| UC-RPT-01 (GenerateReport) | Standard + Linear Orchestration | Single Aggregate (reads ResourceAggregate) | YES |
| UC-RPT-Q01 (CalculateBalance) | Query | Read-only (reads ResourceAggregate) | YES |
| UC-RPT-Q02 (ExportReport) | Query | Read-only | YES |
| UC-RPT-Q03 (GetReportTypes) | Query | Read-only | YES |
| UC-AUD-01 (LogAction) | Standard (System-only) | Single Aggregate | NO |
| UC-AUD-Q01 (QueryAuditLogs) | Query | Read-only | YES |
| UC-AUD-Q02 (ExportAuditTrail) | Query | Read-only | YES |
| UC-LIF-01 (ArchiveResource) | Standard + Linear Orchestration | Single Aggregate (+ audit side-effect) | NO |
| UC-LIF-02 (TrashResource) | Standard | Single Aggregate | NO |
| UC-LIF-03 (PurgeResource) | Standard | Single Aggregate | YES |
| UC-LIF-04 (RestoreFromTrash) | Standard | Single Aggregate | YES |
| UC-LIF-Q01 (ListArchiveEntries) | Query | Read-only | YES |
| UC-LIF-Q02 (SearchArchives) | Query | Read-only | YES |
| UC-CFG-01 (UpdateSetting) | Standard | Single Aggregate | YES |
| UC-CFG-02 (ResetToDefaults) | Standard | Single Aggregate | YES |
| UC-CFG-Q01 (GetSetting) | Query | Read-only | YES |
| UC-CFG-Q02 (GetAllSettings) | Query | Read-only | YES |
| UC-SYNC-01 (PushOps) | Standard + Parallel Fan-Out | Single Aggregate | YES |
| UC-SYNC-02 (PullChanges) | Standard + Parallel Fan-Out | Single Aggregate | YES |
| UC-SYNC-03 (ResolveConflict) | Standard + Linear Orchestration | Single Aggregate | YES |
| UC-SYNC-04 (MarkConfirmed) | Standard | Single Aggregate | YES |
| UC-SYNC-Q01 (CheckConnectivity) | Query | Read-only | YES |
| UC-SYNC-Q02 (GetSyncStatus) | Query | Read-only | YES |

Total: 57 Commands + 26 Queries = 83 operations, all classified.
