# Canonical Interaction Flows

**Doc ID:** PAS-004
**Version:** v1.0
**Statut:** SPECIFICATION CANONIQUE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** ports-adapters-specifier v1.0
**Source canonique :** ["DOC-012", "DOC-013", "DOC-014", "ASS-001", "ASS-003", "ASS-004", "API-CONTRACT-001", "API-CONTRACT-005"]
**Transformation_rule :** "ports-adapters-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **canonical interaction flows** between layers in the Lumina system. Each flow describes the exact sequence of steps from trigger to response, including which Ports are involved, which Aggregate is primary, and how errors propagate.

Flows are framework-agnostic: they describe WHAT happens at each step, not HOW it is implemented. The same flow works whether the underlying transport is HTTP, gRPC, CLI, or any other protocol.

---

## Flow-001: Write Command Flow

**Trigger**: API command (POST/PUT operation) such as CreateTransaction, CreateUser, CreateOrganization
**Initiating Layer**: API Layer
**Primary Aggregate(s)**: ResourceAggregate / IdentityAggregate / OrganizationAggregate
**Ports Involved**: RepositoryPort, EventPublicationPort, ClockPort, UUIDPort, ConfigurationPort, AuditPort, AuthorizationPort, LoggingPort
**Expected Adapters**: Relational Store OR Document Store adapter for RepositoryPort; Synchronous Dispatcher OR Asynchronous Message Bus for EventPublicationPort

### Flow Diagram

```
[API Layer]
    │ receives {request contract type} from client
    ▼
[API Translation]
    │ converts request to input DTO
    │ validates schema shape (required fields, types, enum ranges)
    │ maps auth context → user identity + org_id + role
    │ delegates to AuthorizationPort.hasPermission()
    ▼
[Application Service]        ← e.g., ResourceService.CreateTransaction()
    │ Step 1: Load Aggregate via RepositoryPort.load(resourceId, org_id)? (Create ops skip load)
    │ Step 2: Invoke Command on Aggregate (e.g., aggregate.CreateTransaction(data))
    │ Step 3: Aggregate executes business rules → emits Domain Events list
    │ Step 4: Capture Domain Events from Aggregate execution
    │ Step 5: Persist modified Aggregate via RepositoryPort.save(entity)
    │ Step 6: Publish events via EventPublicationPort.publishBatch(events[])
    │ Step 7: Emit AuditPort.log() call (system auto-invoked by Application Service)
    ▼
[EventPublicationPort]
    │ dispatches events to all registered subscribers
    │ ─→ AuditSubscriber (action logged)
    │ ─→ OfflineSyncSubscriber (pending op queued)
    │ ─→ NotificationSubscriber (alert sent if applicable)
    │ returns immediately (async mode) or waits (sync mode)
    ▼
[Response Mapping]
    │ translates result to response contract format
    └── returns {response contract type} or error code from API-CONTRACT-005
```

### Transaction Boundaries
- **Start**: Before Application Service method entry (authorization check begins transaction conceptually)
- **Commit point**: After RepositoryPort.save() completes successfully AND EventPublicationPort.publishBatch() completes
- **Rollback conditions**: Aggregate invariant violation (E-422-NNN_INV-XXX), repository persistence failure (E-500-002), authorization failure (E-403-NNN)

### Error Propagation
- If AuthorizationPort.hasPermission() returns false → E-403-N permission denied
- If RepositoryPort.load() fails for non-existent entity → E-404-001 ENTITY_NOT_FOUND (for update/delete commands)
- If Aggregate domain method throws invariant violation → E-422-NNN_INV-XXX domain invariant violated
- If RepositoryPort.save() fails → E-500-002 PERSISTENCE_FAILURE
- If EventPublicationPort.publishBatch() fails → event logged, retry deferred, operation still succeeds (eventual delivery guarantee per DR-008)

### Idempotence Consideration
- This flow is **non-idempotent** because Create operations generate new unique identifiers and increment version counters. Repeated submission creates duplicate entities or compensating transactions.
- Exception: UpdateDraftTransaction is conditionally idempotent (DR-012 guard ensures only matching state transitions succeed).

---

## Flow-002: Read Query Flow

**Trigger**: API query (GET operation) such as GetOrganizationProfile, SearchResources, GetAllSettings
**Initiating Layer**: API Layer
**Primary Aggregate(s)**: Depends on query target (any of 13 Aggregates)
**Ports Involved**: RepositoryPort, AuthorizationPort, ClockPort, CachePort (optional optimization)
**Expected Adapters**: Relational Store OR Document Store adapter for RepositoryPort

### Flow Diagram

```
[API Layer]
    │ receives {query request contract type}
    ▼
[API Translation]
    │ converts request to query DTO
    │ validates query parameters (filters, pagination)
    │ resolves org_id from session context
    │ delegates to AuthorizationPort.hasPermission() for read access
    ▼
[Application Service]        ← e.g., ResourceService.SearchResources()
    │ Step 1: Check AuthorizationPort.hasPermission(user, "resource:read", org)
    │ Step 2: Try CachePort.get("search:" + hash(queryDTO)) — if cached, return immediately
    │ Step 3: Load data via RepositoryPort.findByCriteria(queryDTO)
    │ Step 4: Map result to response contract format
    │ NOTE: No persistence step — read-only operation
    │ NOTE: No event publishing — queries produce zero Domain Events (per ASS-NB-004)
    ▼
[Response Mapping]
    │ translates result to response contract format
    └── returns {response contract type} (data array) or error code
```

### Transaction Boundaries
- **Start**: N/A — reads do not require transactions
- **Commit point**: N/A
- **Rollback conditions**: N/A — read operations cannot fail a transaction

### Error Propagation
- If AuthorizationPort hasPermission returns false → E-403-N permission denied
- If RepositoryPort.findByCriteria() encounters storage error → E-500-001 STORAGE_READ_FAILURE
- Invalid query parameters → E-400-NNN validation error (before any Aggregate loading)

### Idempotence Consideration
- This flow is **idempotent** because no mutation occurs. Repeated identical queries always return the same result (modulo time-based changes in the data store).

---

## Flow-003: Cross-Aggregate Flow

**Trigger**: Application command that implicitly involves multiple Aggregates through event propagation. Example: SubmitForApproval triggers ResourceAggregate state change AND WorkflowAggregate activation.
**Initiating Layer**: Application Service
**Primary Aggregate(s)**: ResourceAggregate (primary write), WorkflowAggregate (secondary, event-driven), NotificationAggregate (tertiary, event-driven)
**Ports Involved**: RepositoryPort, EventPublicationPort, EventSubscriptionPort, ClockPort, UUIDPort, AuditPort, NotificationPort
**Expected Adapters**: Any combination from PAS-002 based on aggregate persistence strategy

### Flow Diagram

```
[API Layer]
    │ receives SubmitForApproval request
    ▼
[Application Service]        ← ResourceService.SubmitForApproval(id)
    │ Step 1: Load ResourceAggregate via RepositoryPort
    │ Step 2: Invoke SubmitForApproval on ResourceAggregate (draft → pending transition)
    │ Step 3: Aggregate emits ApprovalRequested event
    │ Step 4: Save ResourceAggregate via RepositoryPort.save()
    │ Step 5: Publish approvalRequested via EventPublicationPort
    ▼
[Event Bus — Async, Eventual Consistency]
    │ EventBus routes ApprovalRequested to subscribed handlers:
    │   ├── WorkflowAggregate handler: TriggerWorkflow(definition, resource)
    │   │     └── Creates WorkflowInstance, emits WorkflowTriggered event
    │   ├── NotificationAggregate handler: SendNotification(approvers, "approval requested")
    │   │     └── Queues notification, emits NotificationQueued event
    │   └── AuditAggregate handler: LogAction(APPROVAL_REQUESTED, resourceType, resourceId)
    │         └── Appends audit entry
    ▼
[Response Mapping]
    │ ResourceAggregate write already committed (Steps 1-4)
    │ Workflow/Notification/Audit writes are eventual (Step 3 propagates)
    └── returns success response (resource is now pending)
```

### Transaction Boundaries
- **Primary transaction**: Steps 1-4 (ResourceAggregate write) — single-aggregate ACID transaction
- **Secondary operations**: Steps 3-5 events drive workflow creation, notifications, and audit logging OUTSIDE the primary transaction boundary
- **Rollback conditions**: Only ResourceAggregate save failure triggers rollback. If Workflow/Notification/Audit handlers fail, their events are retried with exponential backoff (max 5 attempts per DR-008).

### Error Propagation
- ResourceAggregate write failure → E-422-NNN_INV-XXX invariant violation (transaction rolled back)
- Event bus unavailability → event logged, scheduled retry; resource already submitted (partial success acceptable per ASS-004 Linear Orchestration pattern)
- WorkflowAggregate handler failure → audit trail preserved, workflow not triggered; admin can manually trigger

### Idempotence Consideration
- This flow is **partially idempotent**: the primary ResourceAggregate write is non-idempotent, but event consumers must handle duplicate event deliveries gracefully (at-least-once delivery guarantee per DR-008).

---

## Flow-004: Saga Compensation Flow

**Trigger**: Multi-step operation where failure at any step requires compensation of previous steps. Example: ArchiveResource command that must update both LifecycleAggregate and ResourceAggregate.
**Initiating Layer**: Application Service
**Primary Aggregate(s)**: LifecycleAggregate (primary), ResourceAggregate (referenced)
**Ports Involved**: RepositoryPort, EventPublicationPort, EventSubscriptionPort, TransactionManagerPort, ClockPort, UUIDPort, AuditPort, NotificationPort
**Expected Adapters**: Any from PAS-002; TransactionManagerPort uses Saga Orchestrator adapter category (PAS-002)

### Flow Diagram

```
[API Layer]
    │ receives ArchiveResource request (resourceType, resourceId)
    ▼
[Application Service]        ← LifecycleService.ArchiveResource(resourceType, resourceId)
    │ Step 1: Begin coordinated transaction via TransactionManagerPort.begin()
    │ Step 2: Verify resource exists via RepositoryPort.load(resourceId, org_id)
    │ Step 3: Create ArchiveEntry in LifecycleAggregate
    │ Step 4: Register compensation action: delete ArchiveEntry if Step 5 fails
    │ Step 5: Register compensation action: restore Resource state if this fails
    │ Step 6: Attempt lifecycle state transition via RepositoryPort.save()
    │ Step 7: Attempt ResourceAggregate reference update via RepositoryPort.save()
    │ Step 8: If Step 7 FAILS → execute compensation: undo Step 6 (delete ArchiveEntry)
    │ Step 9: If ALL succeed → TransactionManagerPort.commit()
    │ Step 10: Publish ResourceArchived event via EventPublicationPort
    ▼
[TransactionManagerPort]
    │ commit() — makes all writes visible simultaneously
    │ rollback() — executes registered compensations in reverse order
    ▼
[Response Mapping]
    └── returns success or E-409-NNN compensation failure
```

### Transaction Boundaries
- **Start**: TransactionManagerPort.begin()
- **Commit point**: TransactionManagerPort.commit() after all steps succeed
- **Compensation trigger**: Any step failure after Step 3 — compensations execute in reverse order
- **Rollback conditions**: All steps must succeed; if Step N fails, Steps 1..N-1 are compensated

### Error Propagation
- If ResourceAggregate reference update fails (resource doesn't exist) → E-404-001 RESOURCE_NOT_FOUND; compensation deletes the ArchiveEntry
- If LifecycleAggregate save fails → E-500-002; no compensation needed (nothing was written yet at this point)
- If compensation itself fails → CRITICAL: audit entry records the failed compensation; manual intervention required

### Idempotence Consideration
- This flow is **non-idempotent** — ArchiveResource must not be called twice on the same resource (would create duplicate ArchiveEntries). The Application Service should check for existing ArchiveEntry before proceeding.

---

## Flow-005: Event-Driven Flow

**Trigger**: Domain Event published by any Aggregate. Example: UserLoggedIn event triggers WelcomeNotification and SecurityAuditLog.
**Initiating Layer**: EventPublicationPort (consumer side — triggered by published event)
**Primary Aggregate(s)**: IdentityAggregate (event source), NotificationAggregate + AuditAggregate (event consumers)
**Ports Involved**: EventPublicationPort, EventSubscriptionPort, NotificationPort, AuditPort, ClockPort, LoggingPort
**Expected Adapters**: Asynchronous Message Bus or Event Log adapter (PAS-002) for event distribution

### Flow Diagram

```
[Event Source — e.g., IdentityService.LoginUser() completes]
    │ Emits UserLoggedIn event via EventPublicationPort.publish(event)
    ▼
[EventPublicationPort]
    │ event payload: { eventType: "UserLoggedIn", userId, orgId, deviceInfo, loginTimestamp }
    │ delivers to all subscribed handlers:
    ▼
[EventSubscriptionPort — NotificationHandler]
    │ Step 1: Receive UserLoggedIn event
    │ Step 2: Check NotificationAggregate.getPreferences(userId) via NotificationPort
    │ Step 3: Send welcome notification via NotificationPort.send(...)
    │ Step 4: Capture NotificationQueued event
    ▼
[EventSubscriptionPort — AuditHandler]
    │ Step 1: Receive UserLoggedIn event
    │ Step 2: Log security audit entry via AuditPort.log(action="LOGIN", ...)
    │ Step 3: Capture ActionLogged event (internal — not user-facing)
    ▼
[Flow Complete]
    │ Both handlers processed independently
    │ If NotificationHandler fails → AuditHandler still succeeded (handler isolation per DR-003)
    │ If both fail → retry with exponential backoff (max 5 attempts)
```

### Transaction Boundaries
- **Source transaction**: IdentityService LoginUser commit (happens BEFORE event publication)
- **Consumer transactions**: Each event subscriber operates in its own independent transaction
- **No cross-subscriber transactions**: Subscribers are never in the same transaction as each other

### Error Propagation
- If NotificationHandler fails → NotificationFailed event emitted for retry; original login operation unaffected
- If AuditHandler fails → audit gap logged, retry deferred; original login operation unaffected
- Event source (IdentityService) already committed — cannot roll back the login just because downstream handlers fail

### Idempotence Consideration
- This flow is **conditionally idempotent** — subscribers must detect and deduplicate re-delivered events (same event UUID, already processed → skip). The EventBus guarantees at-least-once delivery (DR-008).

---

## Flow-006: Async Polling / Scheduled Flow

**Trigger**: System-scheduled task or periodic polling. Example: PushCoordinator pushes pending operations; PurgeScheduler identifies entries past purge_date.
**Initiating Layer**: Infrastructure/Scheduler layer (not triggered by API request)
**Primary Aggregate(s)**: OfflineSyncAggregate, LifecycleAggregate, WorkflowAggregate (timeout monitoring)
**Ports Involved**: RepositoryPort, EventPublicationPort, ClockPort, LoggingPort, NotificationPort
**Expected Adapters**: Relational Store adapter for RepositoryPort; Asynchronous Message Bus for EventPublicationPort

### Flow Diagram

```
[Scheduler / Cron Trigger]
    │ Periodic invocation (e.g., every 5 minutes for sync push, daily for purge scheduling)
    ▼
[Application Service]        ← OfflineSyncService.PushPendingOperations()
    │ Step 1: Load all PendingOperation records via RepositoryPort.findByCriteria({
    │           filter: { sync_status: "pending" },
    │           pagination: { limit: 50 }  // BR-SYNC-002: batch max 50
    │         })
    │ Step 2: Batch up to 50 operations (BR-SYNC-002)
    │ Step 3: For each operation, attempt RepositoryPort.save() at remote (external store)
    │ Step 4: On success → mark sync_status = "confirmed"
    │ Step 5: On conflict → emit ConflictDetected event, apply resolution strategy
    │ Step 6: On failure → increment retry count, apply exponential backoff
    │ Step 7: Publish BatchPushed event
    │ Step 8: Log summary via LoggingPort.info(batchCount, successCount, failureCount)
    ▼
[Response]
    │ No HTTP response — this is an internal system operation
    │ Results recorded in log and audit trail
```

### Transaction Boundaries
- **Per-batch transaction**: Up to 50 operations pushed in a logical batch, but each individual operation's confirmation is its own atomic write
- **Batch boundaries**: Maximum 50 operations per batch (BR-SYNC-002); larger queues processed in subsequent invocations

### Error Propagation
- Network unavailable → operations stay "pending"; next scheduled run retries
- Remote repository rejects operation → error logged; operation remains pending for retry
- Exponential backoff: 1s → 2s → 4s → 8s → 16s (max 5 attempts per BR-SYNC-003)

### Idempotence Consideration
- This flow is **idempotent** per batch: re-running the scheduler does not cause duplicate pushes because confirmed operations are filtered out by findByCriteria(sync_status="pending"). Confirmed operations are never retried.

---

## Flow-007: Identity Auth Flow

**Trigger**: User login request. Example: LoginUser command.
**Initiating Layer**: API Layer (pre-authentication phase)
**Primary Aggregate(s)**: IdentityAggregate
**Ports Involved**: RepositoryPort, IdentityProviderPort, AuthorizationPort, ClockPort, UUIDPort, EventPublicationPort, AuditPort, LoggingPort
**Expected Adapters**: Internal Credential Store OR Token-Based Authentication adapter for IdentityProviderPort

### Flow Diagram

```
[API Layer]
    │ receives LoginUser request (email, password)
    ▼
[API Translation]
    │ validates email format and password presence
    │ extracts org_id from request context
    ▼
[Authorization Gateway]
    │ Skip permission check — login IS the permission grant mechanism
    ▼
[Application Service]        ← IdentityService.LoginUser(email, password)
    │ Step 1: Call IdentityProviderPort.authenticate(credentials)
    │          │ → hashes provided password, compares against stored hash
    │          │ → returns authentication context: {userId, orgId, role, sessionToken}
    │          │ → throws E-401-001 if credentials invalid
    │ Step 2: Load User entity via RepositoryPort.load(userId, orgId)
    │ Step 3: Verify INV-004 (org_id from auth matches session org)
    │ Step 4: Verify INV-008 (double validation: credential match + org resolution)
    │ Step 5: Create SessionContext via UUIDPort.generate() for sessionId
    │ Step 6: Store session via RepositoryPort.save(sessionPO)
    │ Step 7: Publish UserLoggedIn + SessionCreated events via EventPublicationPort
    │ Step 8: Log authentication event via LoggingPort.info(auth-success, {userId, deviceId})
    ▼
[EventPublicationPort]
    │ UserLoggedIn → AuditSubscriber (security audit)
    │ UserLoggedIn → NotificationSubscriber (welcome/notification if configured)
    ▼
[Response Mapping]
    │ Return authentication tokens (ephemeral JWT pair)
    └── HTTP 200 with auth response contract
```

### Transaction Boundaries
- **Start**: IdentityProviderPort.authenticate() call
- **Commit point**: RepositoryPort.save(sessionPO) + EventPublicationPort.publishBatch() complete
- **Rollback conditions**: Invalid credentials (E-401-001), org mismatch (E-401-002), session storage failure (E-500-002)

### Error Propagation
- If IdentityProviderPort.authenticate() fails → E-401-001 AUTHENTICATION_FAILED (never reveals whether email or password was wrong — BR-ID-003)
- If RepositoryPort.load() fails → E-404-001 USER_NOT_FOUND
- If RepositoryPort.save() (session) fails → E-500-002 SESSION_CREATION_FAILURE
- If EventPublicationPort fails → event logged, retry deferred; user authenticated successfully

### Idempotence Consideration
- This flow is **non-idempotent** — repeated login attempts create new sessions. However, existing sessions for the same user remain valid until they expire or are explicitly revoked. LoginUser does not revoke existing sessions (logout must be explicit per LogoutUser command).

---

## FLOW SUMMARY TABLE

| Flow ID | Name | Primary Pattern | Aggregates Involved | Idempotent? | Events Published? |
|---------|------|-----------------|---------------------|-------------|-------------------|
| Flow-001 | Write Command Flow | Single-aggregate write | 1 (varies) | NO (create) / YES* (update) | Yes |
| Flow-002 | Read Query Flow | Single-aggregate read | 1 (varies) | YES | No |
| Flow-003 | Cross-Aggregate Flow | Linear orchestration | 2-3 | Partial | Yes (fan-out) |
| Flow-004 | Saga Compensation Flow | Multi-step with rollback | 2+ | NO | Yes |
| Flow-005 | Event-Driven Flow | Fan-out event consumption | 1 source + N consumers | Conditionally YES | Yes |
| Flow-006 | Async Polling Flow | Scheduled/batched operations | 1 (sync/lifecycle) | YES | Yes |
| Flow-007 | Identity Auth Flow | Authentication + session | 1 (Identity) | NO | Yes |

*Update operations are idempotent when guarded by state checks (e.g., UpdateDraftTransaction only accepts draft status).

All flows conform to the standard workflow pattern defined in ASS-003:
Input Validation → Authorization → Aggregate Load → Domain Execution → Invariant Guard → Persistence → Event Publishing → Response.
