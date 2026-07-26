# Integration Test Rules — Lumina v1
**Doc ID:** TEST-SPEC-003
**Version:** v1.0
**Statut:** SPECIFICATION DE TESTS DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-012", "DOC-014", "DOC-015", "ASS-002", "ASS-003", "ASS-004", "API-CONTRACT-005"]
**Transformation_rule :** "test-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the rules for writing integration tests across the Lumina application. Integration tests verify that Application Services, Aggregates, Repository ports, and Event subscribers work together correctly through the complete Command/Query pipeline. They bridge the gap between isolated domain correctness (unit tests) and full-stack user journey verification (E2E tests).

Integration tests answer one question: given a valid command received by an Application Service, does the entire chain — validation, authorization, aggregate loading, domain execution, persistence, event publishing, and response serialization — produce the correct result?

Every decision in this document traces to ASS-002 (Use Case Catalog), ASS-003 (Workflow Patterns), ASS-004 (Cross-Aggregate Coordination), DOC-012 (Canonical Domain Model), DOC-014 (Command/Event Registry), and API-CONTRACT-005 (Error Taxonomy).

---

## SECTION 1: PURPOSE

Integration tests exist for four distinct purposes, each addressing a different interaction pattern:

### 1.1 Verify Complete Command Flow

Application Services orchestrate commands through a well-defined pipeline (8 steps per ASS-003). Integration tests verify:
- Request input passes schema validation (400-level errors returned immediately for invalid input)
- Authorization checks block unauthorized roles (401/403 for missing/denied permissions)
- Aggregate loads from repository correctly (404 if entity not found)
- Domain boundary methods execute invariant guards
- Persistence writes are committed atomically
- Domain events are published to the event bus
- Response conforms to API contract schema

### 1.2 Verify Event Chain Propagation

When an Aggregate emits Domain Events, subscribers process them asynchronously. Integration tests verify:
- Events are emitted in the correct order (per ASS-003 Step 7)
- Subscribers receive events and process them without error
- Compensating actions execute when downstream steps fail
- Eventual consistency reaches the expected final state

### 1.3 Verify Cross-Aggregate Coordination

ASS-004 defines nine coordination patterns spanning multiple Aggregates. Integration tests verify:
- All three cross-aggregate workflow patterns (Linear Orchestration, Parallel Fan-Out, Saga Compensation)
- The nine specific coordination interactions documented in ASS-004
- No direct method calls bypass Aggregate boundaries
- org_id scoping is maintained across Aggregate interfaces

### 1.4 Verify Saga Compensation

Multi-Aggregate operations with compensating actions (ASS-003 Pattern 3) require integration tests to verify:
- Upstream work is rolled back when downstream steps fail
- Compensating actions restore previous state
- Partial failures do not leave the system in an inconsistent state

---

## SECTION 2: SCOPE

### 2.1 Components Under Test

Integration tests exercise these layers:

| Layer | Included | Rationale |
|-------|----------|-----------|
| Protocol Adapter (HTTP/GraphQL/gRPC/CLI/Webhook parsing) | PARTIAL | Verify input reaches Application Service correctly; serialization tested at Contract level |
| Input Validation Layer | YES | Schema validation, type checking, range validation before domain layer |
| Authorization Layer | YES | RBAC checks, org_id scoping, session validation |
| Application Service | YES | Command routing, transaction management, event capture |
| Repository Ports (Aggregate Load/Save) | YES | Data loading from persistence, data saving with correct state restoration |
| Aggregate Domain Layer | YES | Boundary methods, invariant guards, domain event emission |
| Event Bus (Event Publishing) | YES | Event delivery to subscribers, ordering guarantees |
| Event Subscribers | YES | Cross-aggregate side-effects triggered by domain events |
| Audit Logging (AuditAggregate.LogAction) | YES | Append-only entry created for every mutation |

### 2.2 Components Explicitly Out of Scope

These are tested at other levels:
- **Pure domain logic** — tested at Unit level (TEST-SPEC-002)
- **Protocol serialization fidelity** — tested at Contract level (TEST-SPEC-001 Level 3)
- **Full user journey through UI/CLI** — tested at E2E level (TEST-SPEC-004)
- **Performance under load** — tested at Performance level (TEST-SPEC-006)
- **Authentication credential validation** — tested at Security level (TEST-SPEC-007)

---

## SECTION 3: TEST CATEGORIES

Four distinct test categories exist, each covering specific aspects of the integration surface.

### 3.1 Category: Command Flow Tests

**Purpose:** Verify the complete path from request to response for both Commands and Queries.

**Scope:** All 83 operations (57 Commands + 26 Queries) from ASS-002.

**Structure:**

```
Setup Phase:
  - Seed database with Organization + representative users + roles + vocab terms
  - Create isolated test context (unique org_id, user credentials per test)
  - Set ClockPort to fixed timestamp for deterministic time-dependent assertions

Trigger Phase:
  - Invoke Application Service method corresponding to the operation
  - Pass validated input parameters (valid, boundary, invalid cases)

Assertion Phase:
  - Verify HTTP status code matches API-CONTRACT-005 mapping
  - Verify response body structure matches API-CONTRACT-002 schema
  - Verify correct Domain Events were captured and published
  - Verify persisted state matches expected postconditions from ASS-002
  - Verify audit log entry created (AUD-001)
  - Verify no invariant violations occurred unless intentionally triggered
  - Verify resource isolation: this test's org_id data is not visible to other tests
```

**Minimum count:** 83 operations x ~3 scenarios (happy path + boundary + error) = **~250 tests minimum**.

#### Example 1: Command Flow — CreateTransaction (UC-RES-01)

```
Given:
  - Seeded database with Organization "TestOrg-INT-001" (org_id = "test-org-001")
  - Admin user "admin@lumina.test" with password hash and role=admin
  - Vocabulary namespace with category_id = "vocab-cat-valid"
  - ClockPort fixed to 2026-07-25T10:00:00Z
  - Test context: org_id = "test-org-001", user_id = "admin-user-id"

When (Happy Path):
  - Invoke ResourceService.CreateTransaction({
      amount_cents: 50000,
      category_ref: "vocab-cat-valid",
      scope_type: "org",
      scope_target: null,
      description: "Tithe offering",
      transaction_date: "2026-07-25"
    })

Then:
  - Response: 201 Created (void)
  - Database: New TransactionRecord exists in resource_records table
    with org_id="test-org-001", amount_cents=50000, category_ref="vocab-cat-valid",
    scope_type="org", status="draft", version=1, created_by="admin-user-id"
  - Events published: ResourceCreated with payload {resourceId, resourceType="transaction",
    orgId, createdBy}
  - Audit log: ActionLogged entry created with entityType="transaction",
    oldValues=null, newValues={amount_cents: 50000, ...}
  - BalanceCalculator: No balance change (status=draft, synced=false, SYNCED-001)
```

#### Example 2: Command Flow — ApproveTransaction (UC-RES-04)

```
Given:
  - Existing TransactionRecord in "pending" status (org_id="test-org-001")
  - Approver user with transaction:approve permission
  - ClockPort fixed to 2026-07-25T11:00:00Z

When:
  - Invoke ResourceService.ApproveTransaction(transaction_id, approver_id)

Then:
  - Response: 200 OK (void)
  - TransactionRecord: status transitions pending → approved, version = 2
  - Events published: ResourceStateChanged(oldState=pending, newState=approved),
    ApprovalGranted(approvedBy, approvedAt)
  - If WorkflowAggregate was tracking: StepApproved event published eventually
  - Balance affected: Transaction now synced=true, participates in BAL-001 calculation
```

### 3.2 Category: Event Chain Tests

**Purpose:** Verify that Domain Events propagate correctly through the event bus to all subscribers.

**Scope:** Event chains triggered by Commands documented in DOC-014 and ASS-003.

**Structure:**

```
Setup Phase:
  - Seed database with required entities and active event subscribers
  - Register an event interceptor/listener that captures all published events
  - Set up subscription handlers for known event types (from ASS-004 coordination patterns)

Trigger Phase:
  - Execute a Command that triggers known Domain Events
  - Allow event processing to complete (synchronous processing for testing;
    eventual consistency verified via polling or synchronization barrier)

Assertion Phase:
  - Verify all expected events were published (type, payload, order)
  - Verify all subscribers processed the events without error
  - Verify cross-aggregate side effects occurred (state changes in secondary Aggregates)
  - Verify saga compensation actions executed when appropriate
  - Verify no unexpected events were published (no phantom side effects)
```

**Minimum count:** Each of the 60+ events from DOC-014 requires at least one event chain test. Events emitted per command (DOC-014) provides the event list.
- Unique event types: ~35
- Each event type requires: basic propagation test + cross-aggregate subscriber test
- Total: **~70 event chain tests minimum**.

#### Example: Event Chain — SubmitForApproval → Workflow Activation

```
Given:
  - TransactionRecord in "draft" status
  - Workflow definition registered for "finance:transaction:submitted" trigger
  - Event bus initialized with WorkflowAggregate subscriber and NotificationAggregate subscriber

When:
  - Invoke ResourceService.SubmitForApproval(transaction_id)

Then (immediate assertions):
  - TransactionRecord transitions draft → pending, version incremented
  - ApprovalRequested event published: {resourceId, requestedBy, thresholdInfo}
  - Event captured by subscriber interceptor

Then (eventual consistency assertions):
  - WorkflowAggregate subscribes to ApprovalRequested
  - WorkflowInstance created (step 1, status=running)
  - WorkflowTriggered event published: {instanceId, triggerEvent, resourceType, resourceId}
  - NotificationAggregate subscribes to WorkflowTriggered
  - Notification queued for assigned approvers
  - NotificationQueued event published: {notificationId, channel, recipientId}
```

#### Example: Event Chain — ResourceArchived → AuditLogging

```
Given:
  - ArchiveEntry in "draft" status
  - AuditAggregate LogAction subscriber registered

When:
  - Invoke LifecycleService.ArchiveResource(resourceType, resourceId)

Then:
  - ResourceArchived event published: {archiveId, resourceType, resourceId, archivedAt, archivedBy}
  - AuditAggregate LogAction auto-invoked (system)
  - ActionLogged emitted: {action: ARCHIVE, entityType: resourceType,
    entityId: resourceId, oldValues: {state: draft}, newValues: {state: archived}}
  - Audit entry persisted with full old/new snapshots (OLDNEW-002)
```

### 3.3 Category: Cross-Aggregate Tests

**Purpose:** Verify coordination patterns defined in ASS-004 where two or more Aggregates interact.

**Scope:** All nine coordination patterns from ASS-004.

#### 3.3.1 Read-Only Cross-References (3 patterns)

```
Pattern: ResourceAggregate → VocabularyAggregate (category reference)
Setup: Vocabulary term exists with specific UUID; transaction references it
Trigger: CreateTransaction with category_ref pointing to vocabulary term
Assert: Transaction created successfully, category validated against VocabularyAggregate repository

Pattern: FormAggregate → VocabularyAggregate (select options)
Setup: Vocabulary namespace has term with value
Trigger: RenderForm(formDef with select field referencing vocab)
Assert: Render tree includes vocabulary term labels (not hardcoded values)

Pattern: LifecycleAggregate → ResourceAggregate (reference validation)
Setup: Resource exists with specific type and ID
Trigger: ArchiveResource(type, id)
Assert: ArchiveEntry created referencing the existing resource
```

#### 3.3.2 Context Resolution (2 patterns)

```
Pattern: ResourceAggregate → OrganizationAggregate (org_id scoping)
Setup: Two organizations seeded with distinct org_ids
Trigger: Admin of org-A creates transaction specifying org-A
Assert: Transaction stored with org-A; query with org-B's context cannot see it

Pattern: NotificationAggregate → IdentityAggregate (user resolution)
Setup: User exists in IdentityAggregate with specific notification preferences
Trigger: SendNotification to that user
Assert: Notification respects user's CHANNEL-003 preferences and RATE-002 limits
```

#### 3.3.3 Event-Driven Side Effects (5 patterns from ASS-004)

```
Pattern: ResourceAggregate → OfflineSyncAggregate (push events)
Setup: Offline mode enabled; PendingOperation queue available
Trigger: CreateTransaction
Assert: PendingOperation record created with resource_type=transaction, action=create
        SyncStatusTracker updated; BatchPushed event can be verified later

Pattern: WorkflowAggregate → ResourceAggregate (approval flows)
Setup: Workflow instance running for a transaction approval
Trigger: ResourceService.ApproveTransaction → ApprovalGranted event
Assert: WorkflowAggregate receives event; step marked approved; next step activated or instance completed

Pattern: ALL Aggregates → AuditAggregate (universal logging)
Setup: AuditAggregate LogAction listener registered
Trigger: Any state-changing operation across any aggregate
Assert: ActionLogged event published; audit entry contains entityType, entityId,
        oldValues AND newValues (OLDNEW-002); append-only guarantee verified

Pattern: OrganizationAggregate → RelationshipAggregate (hierarchy updates)
Setup: OrgUnit hierarchy exists; RelationshipAggregate subscriber active
Trigger: OrganizationService.CreateOrgUnit(parentId, unitType)
Assert: OrgUnitCreated event published; RelationshipAggregate creates/deletes parent links;
        REL-001 cycle detection via Kahn's algorithm enforced at Relationship boundary

Pattern: ApprovalGranted → Workflow (linear orchestration)
Setup: Workflow tracking the transaction; approval workflow step pending
Trigger: ApproveTransaction on tracked resource
Assert: ApprovalGranted event propagates to WorkflowAggregate; StepApproved published;
        resource workflow state reflects approval outcome
```

#### 3.3.4 Reference Validation (1 pattern)

```
Pattern: LifecycleAggregate → ResourceAggregate (archive validation)
Setup: Resource exists; resource DOES NOT exist
Trigger 1: ArchiveResource(exists_type, exists_id)
Assert 1: ArchiveEntry created with valid resource reference
Trigger 2: ArchiveResource(nonexistent_type, nonexistent_id)
Assert 2: Error E-404-001 (ENTITY_NOT_FOUND) returned; no archive entry created
```

#### 3.3.5 Fan-Out Monitoring (1 pattern)

```
Pattern: OfflineSyncAggregate → ALL aggregates (sync monitoring)
Setup: 3+ different resource types modified (transaction, member, org_unit);
       sync coordinator active
Trigger: PushPendingOperations
Assert: BatchPushed event contains count matching total pending operations
        across all resource types; push respects batch size SYNC-002 (<=50)
        Individual operation statuses transition pending→sent→confirmed
```

**Minimum count:** 9 coordination patterns x 2 scenarios (success + failure) = **~18 cross-aggregate tests minimum**.

### 3.4 Category: Saga Compensation Tests

**Purpose:** Verify that multi-Aggregate operations compensate correctly when downstream steps fail.

**Scope:** Operations classified as Saga Compensation in ASS-003.

#### 3.4.1 Saga Compensation — ApproveStep with Resource Side Effect

```
Given:
  - Workflow instance in running state, step awaiting approval
  - Transaction associated with the workflow in "pending" status
  - Both ResourceAggregate and WorkflowAggregate accessible via their repositories

When:
  - Invoke WorkflowService.ApproveStep(instance_id, approver_id)
  - Step succeeds in WorkflowAggregate but resource state transition fails

Then:
  - Workflow step remains approved (WorkflowAggregate committed)
  - Compensating action: workflow step is rolled back or marked as failed-with-compensation
  - Transaction remains in "pending" (not moved to approved)
  - Audit log entry records: action=APPROVE_FAILED, oldValues={workflow: pending},
    newValues={workflow: failed_compensated, resource: still_pending}
  - No partial state inconsistency: either both committed or both compensated
```

#### 3.4.2 Saga Compensation — ArchiveResource with Audit Side Effect

```
Given:
  - Resource exists; archive entry pending creation; AuditAggregate available

When:
  - Invoke LifecycleService.ArchiveResource(type, id)
  - Archive succeeds in LifecycleAggregate but AuditAggregate.LogAction fails

Then:
  - ArchiveEntry created in LifecycleAggregate (primary write committed)
  - Compensating action: audit retry with exponential backoff (max 5 attempts)
  - Data NOT rolled back (audit is side-effect, not primary write — per ASS-003 rollback points)
  - System logs: WARN audit retry exhausted; eventual audit log catch-up scheduled
```

**Minimum count:** 2 documented saga workflows x 2 scenarios (compensation succeeds + compensation fails) = **~4 saga tests minimum**.

---

## SECTION 4: DATA SETUP STRATEGY

### 4.1 Isolated Database Per Test

Every integration test runs within its own database transaction:

| Aspect | Specification |
|--------|--------------|
| **Transaction scope** | Begins before test setup, commits after test assertions, rolls back in teardown |
| **Rollback strategy** | Automatic rollback at test teardown — no manual cleanup needed |
| **Schema isolation** | Optional dedicated test schema (test_ prefix) for tests modifying DDL (migration tests) |
| **Seed data** | Organization model + representative users + roles pre-seeded before first test |
| **Cleanup** | Automatic via transaction rollback; schema-modification tests use explicit DELETE scoped by org_id |

### 4.2 Seed Data Structure

All integration tests share a common seed data foundation (derived from TEST-SPEC-001 Section 4.1):

| Entity | Purpose | Seed Strategy |
|--------|---------|--------------|
| Organization | Foundation tenant | Auto-generated org_id per test; name = "TestOrg-{test_index}" |
| SuperAdmin user | Infrastructure operations | Email: superadmin-{index}@lumina.test, hashed password pre-injected |
| Admin user | Admin-scoped operations | Email: admin-{index}@lumina.test |
| Treasurer user | Finance operations | Email: treasurer-{index}@lumina.test |
| Pastor user | Approval operations | Email: pastor-{index}@lumina.test |
| Staff user | Read-only operations | Email: staff-{index}@lumina.test |
| Vocabulary terms | Financial categories | Pre-populated namespace "finance" with 5+ standard terms |
| Org units | Hierarchy test data | Parent-child depth up to 5 levels (full valid hierarchy) |

### 4.3 Test-Specific Data Generation

Per-test data must be unique to prevent cross-test interference:

- **Emails:** Programmatic generation with unique suffix: `user-{test_uuid}@lumina.test`
- **Names:** `Test Firstname-{index}`, `Test Lastname-{index}`
- **org_id:** Always injected per test; never shared across tests
- **ClockPort:** Fixed timestamp per test; never uses system clock
- **UUIDs:** Deterministic derivation from test name: UUIDv5(test_namespace, test_name_string)

---

## SECTION 5: ASSERTION STANDARDS

### 5.1 State Assertions

After each test, verify the persisted state:

| Assertion Type | What to Verify | Source |
|---------------|---------------|--------|
| Entity state | Final state matches expected postcondition from ASS-002 | Use case postconditions |
| Version number | Incremented correctly; VERSION-001 enforced | DOC-015 |
| Timestamps | created_at, updated_at within acceptable tolerance | ClockPort value |
| Relations | Foreign keys resolve correctly; no orphaned records | Database constraint |
| Audit trail | LogAction called with correct parameters | AUD-001, OLDNEW-002 |

### 5.2 Event Assertions

| Assertion Type | What to Verify | Source |
|---------------|---------------|--------|
| Event emission | Correct event type published | DOC-014 |
| Event payload | All required fields present with correct values | DOC-014 + ASS-002 |
| Event order | Multiple events emitted in defined sequence | ASS-003 Step 7 |
| Event consumption | Subscribers processed events without error | ASS-004 coordination |

### 5.3 Error Assertions

| Assertion Type | What to Verify | Source |
|---------------|---------------|--------|
| Error codes | Specific error code from API-CONTRACT-005 mapped to invariant violated | API-CONTRACT-005 §E-422 |
| HTTP status | 400 for bad request, 401 for unauthenticated, 403 for forbidden, 404 for not found, 409 for conflict, 422 for domain violation, 500 for internal error | API-CONTRACT-005 categories |
| Error detail | Human-readable message references specific invariant (when client-facing) | API-CONTRACT-005 error details |

### 5.4 Isolation Assertions

Verify multi-tenant isolation:

- Query for org_A's data using org_B's context returns zero results
- org_B cannot see org_A's transactions, members, or settings
- org_A cannot modify org_B's organization_unit hierarchy

---

## SECTION 6: TIMEOUT AND PERFORMANCE BUDGET

### 6.1 Individual Test Duration

Maximum: **10 seconds** per individual integration test. This includes:
- Database transaction begin + seed data preparation
- Application Service execution
- Event processing completion
- Assertions and verification
- Transaction rollback

### 6.2 Total Suite Duration

Maximum: **2 minutes** for all integration tests combined. With approximately 250+ tests, average time per test (including setup/teardown) must not exceed 480 milliseconds.

### 6.3 Eventual Consistency Wait

For tests verifying event-driven side effects (cross-aggregate coordination):
- Use a synchronization barrier (not arbitrary sleep)
- Poll for expected event processing completion
- Maximum wait: 2 seconds per event chain verification
- If events are not processed within timeout: test fails (indicates broken event pipeline)

---

## SECTION 7: NAMING CONVENTION

### 7.1 File Naming Pattern

```
tests_integration_{aggregate}_{command_or_query}_{scenario}.ext
```

Examples:
- `tests_integration_resource_create_transaction_happy_path.ex`
- `tests_integration_resource_approve_transaction_workflow_trigger.ex`
- `tests_integration_identity_create_user_duplicate_email_rejected.ex`
- `tests_integration_relationship_set_org_unit_parent_cycle_detected.ex`
- `tests_integration_offlinesync_push_pending_operations_batch_size_enforced.ex`
- `tests_integration_lifecycle_archive_resource_nonexistent_type_rejected.ex`

### 7.2 Test Case Naming Pattern

Pattern: `{Aggregate}.{Operation}.{ScenarioDescription}`

Examples:
- `ResourceAggregate.CreateTransaction.valid_category_accepted`
- `ResourceAggregate.CreateTransaction.missing_scope_type_rejected`
- `IdentityAggregate.CreateUser.email_unique_across_orgs_accepted`
- `WorkflowAggregate.TriggerWorkflow.definition_not_found_rejected`
- `OfflineSyncAggregate.PushOps.batch_of_51_rejected_sync_002`

---

## SECTION 8: QUANTITY ESTIMATES

### 8.1 Per-Category Breakdown

| Category | Operations Covered | Min Tests |
|----------|-------------------|-----------|
| Command flow (Commands) | 57 Commands from DOC-014 | 57 x 3 = 171 |
| Command flow (Queries) | 26 Queries from DOC-014 | 26 x 2 = 52 |
| Event chain | 35+ unique event types | 35 x 2 = 70 |
| Cross-aggregate | 9 coordination patterns | 9 x 2 = 18 |
| Saga compensation | 2 documented sagas | 2 x 2 = 4 |
| **TOTAL MINIMUM** | | **~315** |

Note: ASS-002 states "83 operations x approximately 3 scenarios each = ~250 integration tests." The conservative estimate above (315) accounts for additional event chain and cross-aggregate tests beyond the basic happy/boundary/error triad per operation.

### 8.2 Minimum Coverage Requirement

| Requirement | Minimum | Measurement |
|-------------|---------|-------------|
| All 57 Commands have >= 1 integration test | 57/57 (100%) | DOC-014 command registry |
| All 26 Queries have >= 1 integration test | 26/26 (100%) | DOC-014 query registry |
| All 83 operations have happy path test | 83/83 | ASS-002 operation catalog |
| All 83 operations have error scenario test | 83/83 | API-CONTRACT-005 error mapping |
| All 3 workflow patterns tested | 3/3 | ASS-003 classification table |
| All 9 cross-aggregate patterns tested | 9/9 | ASS-004 coordination matrix |
| All saga workflows have compensation test | 2/2 | ASS-003 saga patterns |

---

## SECTION 9: CROSS-AGGREGATE DATA ASSERTIONS

Since integration tests cover multiple Aggregates, additional assertion types verify cross-boundary correctness:

### 9.1 Cross-Reference Integrity

After any cross-aggregate operation, verify:
- ResourceAggregate transaction references a valid VocabularyAggregate category
- WorkflowAggregate instance references a valid ResourceAggregate resource
- NotificationAggregate message resolves to a valid IdentityAggregate user
- LifecycleAggregate archive entry references an existing ResourceAggregate entity
- OfflineSyncAggregate pending operation tracks a real resource_type + resource_id

### 9.2 Org_ID Scoping Verification

In every cross-aggregate integration test:
- Primary Aggregate operates within TestContext.org_id
- Secondary Aggregate queries are filtered by the same org_id
- No cross-org data leakage: querying with a different org_id returns zero results for TestContext.org_id data

### 9.3 Event Order Verification

For operations emitting multiple events:
- Events are captured in the order they were emitted by the Aggregate (ASS-003 Step 7)
- Event order matches DOC-014 event definitions
- Subscribers process events in publisher order (no reordering)

---

## SECTION 10: MIGRATION AND SCHEMA TESTS

Integration tests cover migration and schema verification:

### 10.1 Post-Migration Verification

Each of the 35 migrations from MIGRATION-PACK-V1.md requires:
- Migration applied successfully (no errors)
- Tables/columns created with correct types, constraints, defaults
- RLS policies active post-migration (RLS-POLICY-SPECIFICATION-V1.md)
- Indexes created and query plans confirm index usage
- Bootstrap scripts (000-003) produce expected pre/post conditions

### 10.2 Idempotency Verification

- Running migration twice does not cause errors (idempotent)
- Running bootstrap script twice produces same final state

### 10.3 RLS Policy Verification

All 32 tables x 9 roles = **288 policy permutations minimum**:
- For each table + role combination, verify SELECT, INSERT, UPDATE, DELETE permissions match RLS-POLICY-SPECIFICATION-V1.md
- Multi-tenant isolation: org_A's data not visible when querying as org_B's user
- SuperAdmin bypass works correctly (session-level configuration, not DDL-level)

---

## SECTION 11: QUERY INTEGRATION TESTS

Queries (26 operations) differ from Commands in important ways:

### 11.1 Read-Only Verification

| Assertion | Description |
|-----------|-------------|
| No mutations | Verify no UPDATE/INSERT/DELETE executed during query execution |
| Org isolation | Results scoped to calling user's org_id only |
| RBAC enforcement | Unauthorized role receives E-403-001 |
| Idempotence | Repeated identical query returns identical results |
| Pagination | Paginated results consistent across repeated calls |

### 11.2 Example: Query Integration — SearchResources (UC-RES-Q01)

```
Given:
  - Seeded Organization + TransactionRecords (multiple orgs for isolation test)
  - Staff user authenticated within TestOrg-001

When:
  - Invoke ResourceService.SearchResources({filters: {status: "approved", date_range: ...}})

Then:
  - Returns only TransactionRecords matching filters
  - All returned records belong to org_id = "test-org-001" (isolation verified)
  - TransactionRecords from other orgs are NOT returned
  - No mutation occurred (read-only operation)
  - Response format matches API-CONTRACT-002 schema
```

---

## APPENDIX A: INTEGRATION TEST COVERAGE MATRIX BY AGGREGATE

| Aggregate | Commands | Queries | Event Chains | Cross-Aggregate | Saga | Min Tests |
|-----------|----------|---------|-------------|----------------|------|-----------|
| OrganizationAggregate | 8 | 2 | 2 | 2 | 0 | 14 |
| IdentityAggregate | 9 | 0 | 2 | 1 | 0 | 12 |
| ResourceAggregate | 10 | 2 | 3 | 3 | 1 | 18 |
| RelationshipAggregate | 3 | 3 | 1 | 2 | 0 | 10 |
| WorkflowAggregate | 5 | 1 | 2 | 2 | 1 | 12 |
| FormAggregate | 1 | 3 | 0 | 1 | 0 | 6 |
| NotificationAggregate | 4 | 0 | 1 | 1 | 0 | 7 |
| VocabularyAggregate | 2 | 5 | 0 | 1 | 0 | 9 |
| ReportingAggregate | 1 | 3 | 0 | 1 | 0 | 6 |
| AuditAggregate | 1 | 2 | 2 | 1 | 0 | 6 |
| LifecycleAggregate | 5 | 2 | 1 | 1 | 1 | 11 |
| ConfigurationAggregate | 2 | 2 | 0 | 0 | 0 | 6 |
| OfflineSyncAggregate | 4 | 2 | 1 | 2 | 0 | 9 |
| **TOTAL** | **57** | **26** | **15** | **17** | **3** | **~161 direct + ~154 event/cross/saga = ~315** |

---

## APPENDIX B: DOCUMENT REVISION HISTORY

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v1.0 | 2026-07-25 | Agnes-2.0-Flash (Sapiens AI) | Genesis definition of integration test rules from canonical source documents |

---

*This integration test specification defines mandatory rules for verifying end-to-end operational correctness. Every subsequent implementation MUST comply with these rules.*

*FIN DU DOCUMENT TEST-SPEC-003*
