# Unit Test Rules — Lumina v1
**Doc ID:** TEST-SPEC-002
**Version:** v1.0
**Statut:** SPECIFICATION DE TESTS DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-012", "DOC-014", "DOC-015", "API-CONTRACT-005"]
**Transformation_rule :** "test-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the rules for writing unit tests across the Lumina application. Unit tests are the fastest, most isolatable, and highest-fidelity verification layer. They verify domain correctness in complete isolation from infrastructure — no database, no network, no serialization, no authentication. Every decision in this document traces to DOC-015 (Domain Invariant Registry), DOC-012 (Canonical Domain Model), DOC-014 (Command/Event Registry), and API-CONTRACT-005 (Error Taxonomy).

Unit tests exist to answer one question: given a specific Aggregate state and a specific input, does the domain model produce the correct outcome? The answer must be deterministic, instantaneous, and reproducible in any environment.

---

## SECTION 1: WHEN TO WRITE UNIT TESTS

Unit tests are MANDATORY for the following elements. There are no exceptions.

### 1.1 All 58 Domain Invariants (DOC-015)

Every invariant documented in DOC-015 MUST have at least two unit tests:
1. **Respect test** — verifying the happy path where the invariant holds
2. **Violation test** — verifying the invariant guard rejects an attempted violation

This applies uniformly to all severity levels:
- **CRITIQUE (38 invariants):** Unit tests written first, peer-reviewed before any other test work begins
- **MAJEUR (15 invariants):** Unit tests written during implementation of the affected feature
- **MINEUR (5 invariants):** Unit tests written alongside other layer tests but still verified as passing

The 58 invariants span these Aggregates:
- ResourceAggregate: FIN-001, FIN-002, DATE-001, CAT-001, DESC-001, VERSION-001, CREATEBY-001, COMP-001, SCOPE-001, MEM-001, STATUS-010, DISABLE-011 (12)
- IdentityAggregate: EMAIL-001, PHONE-003, AGE-004, DUP-005 (4)
- RelationshipAggregate: REL-001, DEPTH-002, MULTI-020 (3)
- WorkflowAggregate: WF-001, ESCALATE-002, CHAINS-003, RETRY-004, LOG-005, NOT-001/WF-005 (6)
- FormAggregate: FRM-009, VOCAB-002, DUAL-008, LOCK-004 (4)
- NotificationAggregate: NOT-001, RATE-002, CHANNEL-003, QUIET-004 (4)
- VocabularyAggregate: VOC-001, TRANSLATION-002, STABLE-003 (3)
- AuditAggregate: AUD-001, OLDNEW-002, RETENTION-031, ACCESS-033 (4)
- LifecycleAggregate: LIF-001, LIF-003, LIF-005 (3)
- ConfigurationAggregate: CFG-001, CFG-002, CFG-003, CFG-004 (4)
- OfflineSyncAggregate: SYNC-001, SYNC-002, SYNC-003, SYNC-004 (4)
- ReportingAggregate: BAL-001, MONTH-001, EXPORT-001, ARCHIVED-001, SYNCED-001 (5)
- OrganizationAggregate/General: INV-004, INV-008, BR-ORG-006 (3)
- Additional BR rules: BR-ID-004, BR-ID-005, BR-RES-001, BR-REL-003, HISTORY-022, ATTR-021 (8)

Total minimum unit tests from invariants alone: 58 x 2 = **116 tests**.

### 1.2 All Value Objects

Every Value Object class documented in DOC-012 MUST have unit tests covering:
- Construction with valid inputs (happy path)
- Construction with invalid inputs (rejection)
- Immutability enforcement (state cannot be modified after construction)
- Equality semantics (two VOs with identical values compare equal)
- Serialization round-trip (construct from data → serialize → reconstruct → verify equality)

Value Object catalog to be tested:

| Aggregate | Value Objects |
|-----------|--------------|
| OrganizationAggregate | OrganizationName, OrganizationType, OrgUnitHierarchy, OrganizationSettings, OrganizationStatus |
| IdentityAggregate | EmailAddress, PhoneNumber, PasswordHash, UserRole, PermissionGrant, JWTToken, SessionContext |
| ResourceAggregate | ResourceId, ResourceType, ResourceState, ResourceVersion, ResourceMetadata, AmountInCents, TransactionReference |
| RelationshipAggregate | RelationshipType, RelationshipKey, JoinTimestamp, MembershipRole |
| WorkflowAggregate | WorkflowTrigger, StepType, StepTimeout, ApprovalChain, ConditionExpression, EscalationRule |
| FormAggregate | FormId, ModelRef, FieldDef, SectionDef, FormVersion |
| NotificationAggregate | ChannelType, SeverityLevel, MessageTemplate, RateLimitConfig |
| VocabularyAggregate | NamespaceKey, TermKey, LabelPair, DeprecatedFlag, ColorHex |
| ReportingAggregate | ReportScope, PeriodType, ReportFormat, BalanceTotals, CategoryBreakdown |
| AuditAggregate | ActionType, EntitySnapshot, UserId, IpAddress, LogTimestamp |
| LifecycleAggregate | LifecycleState, RetentionPeriod, ArchiveType, TagCollection, CategoryRef, AttachmentUrlList |
| ConfigurationAggregate | SettingKey, SettingValue |
| OfflineSyncAggregate | SyncAction, SyncStatus, ConflictStrategy, OperationPayload, PushBatchSize, RetryDelayMs |

Minimum: 40+ Value Object classes x minimum 4 tests each = **~160 tests minimum**.

### 1.3 All Aggregate Boundary Methods

Every boundary method listed in DOC-012's Aggregate definitions MUST have unit tests covering:
- State machine transitions (each defined transition from DOC-012 tested individually)
- Parameter validation at the method boundary
- Event emission verification (correct event type emitted, correct payload fields populated)
- Version increment verification (VERSION-001)
- created_by injection verification (CREATEBY-001)

Boundary method registry derived from DOC-012 and API-CONTRACT-001:
- OrganizationAggregate: CreateOrganization, UpdateOrganizationSettings, CreateOrgUnit, UpdateOrgUnitParent, TransferChildOrg, MergeOrganizations, ArchiveOrganization, SuspendOrganization (8 methods)
- IdentityAggregate: CreateUser, UpdateUserProfile, ChangeUserRole, ResetPassword, LoginUser, LogoutUser, RefreshAccessToken, RevokeSession, AssignPermissionGrant (9 methods)
- ResourceAggregate: CreateTransaction, UpdateDraftTransaction, SubmitForApproval, ApproveTransaction, RejectTransaction, CompensateTransaction, CreateMember, UpdateMember, TransitionMemberStatus (9 methods)
- RelationshipAggregate: AddMemberToGroup, RemoveMemberFromGroup, SetOrgUnitParent, GetDescendants, GetAllGroupsForMember, GetAllMembersOfGroup (6 methods)
- WorkflowAggregate: TriggerWorkflow, ApproveStep, RejectStep, CancelWorkflow, ResubmitForApproval, GetPendingApprovals (6 methods)
- FormAggregate: ValidateFormData, LoadFormDefinition, RenderForm, GetVisibleFields (4 methods)
- NotificationAggregate: SendNotification, MarkAsRead, UpdatePreferences, SetRateLimit (4 methods)
- VocabularyAggregate: AddTermValue, DeprecateTermValue, ResolveLabel, GetTerms, GetTermValues, SearchTerms, GetAllNamespaces (7 methods)
- ReportingAggregate: GenerateReport, CalculateBalance, ExportReport, GetReportTypes (4 methods)
- AuditAggregate: LogAction, QueryAuditLogs, ExportAuditTrail (3 methods)
- LifecycleAggregate: ArchiveResource, TrashResource, PurgeResource, RestoreFromTrash, ListArchiveEntries, SearchArchives, ApplyTags, SchedulePurge (8 methods)
- ConfigurationAggregate: UpdateSetting, ResetToDefaults, GetSetting, GetAllSettings (4 methods)
- OfflineSyncAggregate: PushPendingOperations, PullRemoteChanges, ResolveConflict, MarkOperationConfirmed, CheckConnectivity, GetSyncStatus (6 methods)

Total: 78 boundary methods minimum x ~2 scenarios = **~156 tests minimum**.

### 1.4 All Pure Functions / Guard Functions

DOC-015 identifies several pure functions used as invariant guards. Each must have input/output tests:
- `BalanceCalculator` — verify Actif = Passif + Résultat computation
- `PeriodValidator` — verify month/quarter/year date range correctness
- `RetentionManager` — verify 7-year minimum retention logic
- `RateLimitEnforcer` — verify per-user/per-org rate limiting math
- `QuietHoursPolicy` — verify quiet hours window enforcement with critical exception
- `ClockPort` interface — verify timestamp substitution works correctly

Minimum: 6 pure functions x ~3 input/output pairs each = **~18 tests minimum**.

---

## SECTION 2: WHAT TO TEST AT UNIT LEVEL

Unit tests focus EXCLUSIVELY on domain correctness. The following categories define what belongs in unit tests:

### 2.1 Invariant Compliance (Primary Purpose)

The sole purpose of unit tests is to verify that the Domain Model enforces every invariant from DOC-015. Each test answers one question: "Does the invariant hold or get rejected?"

Testable invariant behaviors include:
- Value constraint enforcement (amount > 0, email unique within org, date not in future)
- State machine transition validation (draft→pending→approved, not draft→approved directly)
- Reference integrity checks (category exists in vocabulary, resource exists before archive)
- Policy enforcement (DAG no cycles via Kahn's algorithm, depth <= 5, approval chain <= 5)
- Immutability guarantees (approved transaction cannot be modified, audit log cannot be deleted)
- Format validation (ISO 4217 currency code, IANA timezone, hex color with WCAG contrast)
- Temporal constraints (quiet hours, purge_date thresholds, timeout limits)
- Idempotence behavior (duplicate operations produce same result or rejected)

### 2.2 Event Emission Verification

When a command triggers a state change, the Aggregate MUST emit the correct Domain Event(s) as defined in DOC-014. Unit tests verify:
- The correct event type was emitted (e.g., ResourceCreated not ResourceUpdated for CreateTransaction)
- The event payload contains all required fields
- The event payload values match the input or computed values
- Multiple events are emitted in the correct order when applicable (e.g., ResourceStateChanged + ApprovalGranted for ApproveTransaction)
- No events are emitted when the operation was a read-only query

### 2.3 Version Numbering

VERSION-001 requires every mutable state change to increment the version number. Unit tests verify:
- New entities start at version 1
- Each mutation increments version by exactly 1
- Version never decreases
- Version never jumps more than 1
- Read operations do not affect version

### 2.4 created_by Injection

CREATEBY-001 requires every new entity to have createdBy set. Unit tests verify:
- New resources created via boundary methods include createdBy from injected context
- createdBy cannot be null or empty
- createdBy is injected at the Aggregate boundary, not set by caller-supplied data
- Update operations do not modify createdBy (it is creation-time only)

---

## SECTION 3: TEST STRUCTURE PATTERN

Every unit test follows the **Given / When / Then** pattern. This structure is not optional — it ensures each test verifies exactly one invariant scenario with maximum clarity.

### 3.1 Given — Setup Phase

The Given phase constructs the preconditions for the test:
- Create Aggregate instance(s) with known state
- Construct all required Value Objects with specific values
- Inject ClockPort with a fixed timestamp
- Inject ContextProvider with known createdBy identity
- For cross-reference validations, seed the dependent Aggregate's repository with known data

Rules for Given:
- All input data is constructed explicitly, never randomly generated
- Test fixtures produce deterministic, reproducible state
- Time-dependent behavior uses ClockPort — never the system clock
- External dependencies are replaced with test doubles (interfaces, not implementations)

### 3.2 When — Action Phase

The When phase invokes exactly ONE boundary method or domain function:
- Invoke a single Aggregate boundary method with the constructed input
- OR invoke a pure function with constructed parameters
- Capture the return value, emitted events, or raised exception

Rules for When:
- Exactly one action per test — never call two methods in the same When clause
- The action is the SUT (System Under Test) — the specific domain operation being verified
- No real infrastructure is touched (no database, no HTTP, no file I/O)

### 3.3 Then — Assertion Phase

The Then phase asserts the expected outcome:
- For invariant respect: the operation succeeds, returns the expected value, emits the expected event(s)
- For invariant violation: the operation throws/rejects with the correct error code from API-CONTRACT-005
- Version incremented by exactly 1 (or unchanged for reads)
- Event payload fields match expected values
- State transition occurred correctly

Rules for Then:
- Verify ONLY the invariant under test — do not assert unrelated state
- If testing an invariant violation, assert the specific error code from API-CONTRACT-005 mapped to that invariant (see Error Code Mapping in API-CONTRACT-005)
- Use exact comparisons (not approximate) for domain-critical values
- For event emission tests, verify event type AND payload content

### 3.4 Example: Full Given / When / Then for FIN-001

Invariant: FIN-001 — Approved transactions are immutable. Cannot be updated or deleted.

**Test 1: FIN-001 Respect — Creating and approving a transaction succeeds**

```
Given:
  - A fresh ResourceAggregate instance
  - A valid transaction with amount_cents = 50000, category_ref = valid-vocab-id, scope_type = "org"
  - ClockPort fixed to 2026-01-15T10:00:00Z
  - ContextProvider with createdBy = "user-123"

When:
  - Invoke CreateTransaction with the above data

Then:
  - Operation succeeds (no exception)
  - ResourceCreated event emitted with correct payload
  - Version = 1
  - created_by = "user-123"
  - Transaction state = "draft"

When:
  - Invoke ApproveTransaction(transaction_id, approver = "admin-456")

Then:
  - Operation succeeds
  - ResourceStateChanged event emitted: oldState="draft", newState="approved"
  - ApprovalGranted event emitted: approvedBy="admin-456"
  - Version = 2
  - Transaction state = "approved"
```

**Test 2: FIN-001 Violation — Updating an approved transaction is rejected**

```
Given:
  - A ResourceAggregate with one transaction in "approved" state (created and approved per above)
  - ClockPort fixed to 2026-01-16T10:00:00Z

When:
  - Invoke UpdateDraftTransaction(approved_transaction_id, {amount_cents: 99999})

Then:
  - Operation rejects with error code E-422-001-FIN-001
  - Error detail: "Transaction is approved — use CompensateTransaction instead"
  - Transaction remains in "approved" state (no state change)
  - Version unchanged
  - No Domain Events emitted
```

This example demonstrates the dual-scenario requirement: one test proving the invariant permits the happy path, one test proving the invariant blocks the violation.

---

## SECTION 4: NAMING CONVENTION

File and test naming follows a consistent, traceable convention.

### 4.1 File Naming Pattern

```
tests_unit_{aggregate}_{invariant_or_entity}_{scenario}.ext
```

Examples:
- `tests_unit_resource_fin_001_approve_immutable.ex`
- `tests_unit_identity_email_001_duplicate_rejected.ex`
- `tests_unit_relationship_rel_001_cycle_detected.ex`
- `tests_unit_workflow_wf_001_timeout_enforced.ex`
- `tests_unit_vocabulary_vocab_001_deprecated_irreversible.ex`
- `tests_unit_audit_audit_001_append_only.immutable.ex`
- `tests_unit_config_cfg_001_iso_4217_currency_valid.ex`
- `tests_unit_offlinesync_sync_002_batch_size_exceeded.ex`
- `tests_unit_notification_not_001_trigger_required.ex`
- `tests_unit_form_frm_009_no_hardcoded_jsx.ex`

### 4.2 Test Case Naming Pattern

Each test case name describes the exact invariant and scenario:

Pattern: `{Aggregate}.{InvariantID}.{ScenarioDescription}`

Examples:
- `ResourceAggregate.FIN-001.approve_rejects_update`
- `ResourceAggregate.FIN-002.create_with_negative_amount_rejected`
- `IdentityAggregate.EMAIL-001.duplicate_within_org_rejected`
- `RelationshipAggregate.REL-001.kahn_algorithm_detects_cycle`
- `WorkflowAggregate.WF-001.step_past_30_days_rejected`
- `LifecycleAggregate.LIF-003.purge_is_final`
- `ConfigurationAggregate.CFG-001.invalid_currency_format_rejected`
- `ReportingAggregate.BAL-001.imbalance_detected_on_calculation`

---

## SECTION 5: MOCKING RULES

Mocking is strictly controlled to preserve test purity and prevent false positives.

### 5.1 What CAN Be Mocked

Mocks are permitted ONLY for external dependencies — things outside the Aggregate's control:

| Dependency | Mock Type | Rationale |
|------------|-----------|-----------|
| ClockPort | Interface double | Provides deterministic timestamps for time-dependent invariants |
| Repository ports (read path) | Interface double | Seed aggregate data without touching a real database |
| Event bus (publish) | Interface double | Verify events are published without real delivery |
| Context Provider | Interface double | Inject known user context without auth flow |
| Notification channel senders | Interface double | Verify notification routing without actual delivery |
| External API callers | Interface double | For offline sync push/pull, mock the HTTP layer |

### 5.2 What MUST NOT Be Mocked

The following are NEVER mocked because they are part of the SUT:

| Element | Reason |
|---------|--------|
| The Aggregate being tested | Mocking the SUT makes tests meaningless |
| Value Object constructors | VO validation IS the invariant — must test real code |
| Boundary method implementations | These contain the invariant guards — must test real code |
| Pure functions (BalanceCalculator, etc.) | These ARE the domain logic being verified |
| Event emission within the Aggregate | Internal event capture — tested via assertion, not mocking |
| State transitions within the Aggregate | State machine IS the invariant — must test real code |

### 5.3 Mock Verification

After each test, verify mocks were called as expected:
- Repository read: verify exactly one query for the expected entity ID
- Event publish: verify the correct event type was published once
- ClockPort: verify the timestamp was read during the operation

### 5.4 Fake Implementations

Where an interface double is insufficient (e.g., Testing a real DAG cycle detection), use a FAKE implementation:
- In-memory graph for Kahn's algorithm testing
- In-memory list for event consumer verification
- Simple hash map for setting resolver with default fallback

Fakes must be deterministic and free of external side effects.

---

## SECTION 6: COVERAGE TARGETS

### 6.1 Minimum Coverage Matrix

| Category | Source | Target Count | Coverage Rule |
|----------|--------|-------------|---------------|
| Invariant respect tests | DOC-015 (all 58) | 58 | One test per invariant happy path |
| Invariant violation tests | DOC-015 (all 58) | 58 | One test per invariant rejection path |
| Value Object tests | DOC-012 (40+ VOs) | 160+ | Constructor, invalid, immutability, equality, serialization per VO |
| Boundary method transitions | DOC-012 + API-CONTRACT-001 | 156+ | Happy path + rejection per boundary method |
| Pure function tests | DOC-015 guard functions | 18+ | Input/output per pure function |
| Versioning enforcement | VERSION-001 | 5 | New=1, increment, no decrease, no jump, reads don't change |
| created_by enforcement | CREATEBY-001 | 4 | Present on create, set from context, not null, not overwritten on update |

**Grand total minimum unit tests: 615+**

### 6.2 Severity-Based Priority

Tests are prioritized by invariant severity:

Priority tier ordering (lowest-tier tests must pass first):
1. CRITIQUE invariants (38 tests x 2 = 76 tests) — gate for all other work
2. MAJEUR invariants (15 tests x 2 = 30 tests)
3. MINEUR invariants (5 tests x 2 = 10 tests)
4. Value Object tests (160+ tests)
5. Boundary method tests (156+ tests)
6. Pure function tests (18+ tests)

### 6.3 Coverage Gate

No commit is approved until ALL unit tests pass. Coverage is measured by:
- Line coverage: >= 90% of Aggregate domain code lines
- Branch coverage: >= 85% of decision points in boundary methods
- Invariant coverage: 100% of the 58 invariants from DOC-015 (measured by traceability matrix)

---

## SECTION 7: DETERMINISM REQUIREMENTS

Unit tests must produce identical results in every execution, every environment.

### 7.1 No Random Data

- Test data is constructed with known, fixed values
- No UUID.randomUUID(), no Math.random(), no crypto.randomBytes() in test setup
- Entity IDs are seeded deterministically (e.g., "test-org-uuid-fixed", "test-user-uuid-fixed")
- Test names generated deterministically (e.g., "TestOrg" + index suffix)

### 7.2 Time Control via ClockPort

All time-dependent behavior uses a ClockPort abstraction:

| Time-Dependent Invariant | ClockPort Usage |
|-------------------------|-----------------|
| DATE-001 (date not in future) | Fix ClockPort to 2026-07-25; test with date 2026-07-25 (ok), 2026-07-26 (rejected) |
| QUIET-004 (quiet hours) | Fix ClockPort to 02:00 (quiet hours active); test non-critical blocked, critical bypasses |
| WF-001 (timeout 30 days) | Fix ClockPort to step + 31 days; test timeout exceeded |
| RETENTION-031 (7 year retention) | Fix ClockPort to entry_created + 6 years (still retained); entry_created + 8 years (eligible for purge) |
| LIF-005 (purge_date) | Fix ClockPort to purge_date - 1 day (not reached); purge_date + 1 day (can purge) |
| SESSION expiration | Fix ClockPort to token_created + 25 hours (expired if TTL=24h) |

### 7.3 No System Clock

- System clock references are forbidden in unit test assertions
- Every time-dependent test MUST use a fixed ClockPort value
- Tests that depend on elapsed time simulate it via ClockPort manipulation

### 7.4 No External Side Effects

- Unit tests never write to disk
- Unit tests never make network calls
- Unit tests never access file systems
- Unit tests never spawn child processes
- Unit tests never touch environment variables (all config via injected values)

---

## SECTION 8: FORBIDDEN PATTERNS

The following patterns are STRICTLY PROHIBITED in unit tests. Their presence constitutes a test design defect.

### 8.1 Forbidden: Real Database Access

Unit tests MUST NOT connect to a real database:
- No PostgreSQL connections
- No SQLite file access
- No in-memory database instances
- Repository ports are mocked or served by in-memory fakes

Violation: Using a real database couples the test to infrastructure, introduces non-determinism (shared state between test runs), and destroys execution speed.

### 8.2 Forbidden: Real API Calls

Unit tests MUST NOT make HTTP requests:
- No HttpClient, no Fetch API, no REST client calls
- Protocol adapters are tested exclusively at Contract Test level (Level 3)

Violation: Network calls introduce flakiness, depend on external services, and require network availability.

### 8.3 Forbidden: Real Authentication Flows

Unit tests MUST NOT exercise the full authentication pipeline:
- No password hashing in tests (inject pre-hashed password)
- No JWT generation/validation in unit tests
- Auth context is injected via ContextProvider double
- RBAC checks are tested via permission grant assertions, not full auth flow

Violation: Authentication complexity belongs to integration tests. Unit tests verify domain invariants assuming auth context is resolved.

### 8.4 Forbidden: Framework-Specific Syntax in Specifications

This specification document deliberately avoids naming any test framework, assertion library, or programming language. However, when implementing unit tests:
- Tests MUST be framework-agnostic in their intent — the Given/When/Then structure applies regardless of tooling
- The testing technology stack selection is a separate implementation decision (not covered by this canonical spec)

### 8.5 Forbidden: Multi-Purpose Tests

Each unit test verifies exactly ONE invariant or ONE boundary condition:
- Do not test two invariants in a single test
- Do not test happy path and failure path in the same test
- Do not combine unit-level and integration-level concerns in one test

### 8.6 Forbidden: State Leakage Between Tests

Tests MUST be completely isolated:
- Each test constructs its own Aggregate instance
- No shared mutable state between tests
- Aggregate instances are garbage-collected after each test
- Test execution order must not affect results

### 8.7 Forbidden: Sleep/Wait Patterns

Unit tests are deterministic and synchronous:
- No thread sleep delays
- No event loop processing waits
- No polling loops
- Event emission is captured synchronously within the boundary method

---

## SECTION 9: ERROR CODE VERIFICATION

When testing invariant violations, each test must assert the correct error code from API-CONTRACT-005.

### 9.1 Error Code Mapping Summary

The following table maps invariant IDs to their specific error codes. Every violation test must assert the exact error code:

| Invariant | Error Code | Test Assertion |
|-----------|-----------|----------------|
| FIN-001 | E-422-001-FIN-001 | approved tx update rejected |
| FIN-002 | E-422-001-FIN-002 | amount <= 0 rejected |
| DATE-001 | E-422-001-DATE-001 | future date rejected |
| CAT-001 | E-422-001-CAT-001 | missing vocab category rejected |
| DESC-001 | E-422-001-DESC-001 | large amount without description rejected |
| VERSION-001 | E-422-001-VERSION-001 | version not incremented rejected |
| CREATEBY-001 | E-422-001-CREATEBY-001 | missing createdBy rejected |
| COMP-001 | E-422-001-COMP-001 | compensation link missing rejected |
| SCOPE-001 | E-422-001-SCOPE-001 | undefined scope_type rejected |
| MEM-001 | E-422-001-MEM-001 | missing firstName/lastName rejected |
| EMAIL-001 | E-422-001-EMAIL-001 | duplicate email in org rejected |
| STATUS-010 | E-422-001-STATUS-010 | invalid status enum rejected |
| DISABLE-011 | E-422-001-DISABLE-011 | inactive member transacting rejected |
| REL-001 | E-422-001-REL-001 | DAG cycle detected rejected |
| DEPTH-002 | E-422-001-REL-002 | depth > 5 rejected |
| MULTI-020 | E-409-004 | duplicate membership rejected |
| WF-001 | E-422-001-WF-001 | timeout exceeded rejected |
| WF-005 | E-422-001-WF-005 | workflow modifies approved tx rejected |
| RETRY-004 | E-422-001-RETRY-004 | auto-retry blocked |
| VOC-001 | E-422-001-VOC-001 | delete value attempted rejected |
| TRANSLATION-002 | E-422-001-TRANSLATION-002 | missing min translations rejected |
| STABLE-003 | E-422-001-STABLE-003 | key modification rejected |
| AUD-001 | E-422-001-AUD-001 | audit log mutation rejected |
| LIF-001 | E-422-001-LIF-001 | non-archivable type rejected |
| LIF-003 | E-422-001-LIF-003 | purge active entry rejected |
| LIF-005 | E-422-001-LIF-005 | purge_date not reached rejected |
| CFG-001 | E-422-001-CFG-001 | invalid currency rejected |
| CFG-002 | E-422-001-CFG-002 | invalid timezone rejected |
| CFG-003 | E-422-001-CFG-003 | invalid accent color rejected |
| SYNC-001 | E-422-001-SYNC-001 | remote before local rejected |
| SYNC-002 | E-422-001-SYNC-002 | batch size exceeded rejected |
| SYNC-003 | E-422-001-SYNC-003 | max retries exceeded rejected |
| NOT-001 | E-422-001-NOT-001 | spontaneous notification rejected |
| RATE-002 | E-422-001-RATE-002 | rate limit exceeded rejected |
| CHANNEL-003 | E-422-001-CHANNEL-003 | preference-blocked channel rejected |
| QUIET-004 | E-422-001-QUIET-004 | quiet hours violation rejected |

### 9.2 Partial Coverage

Some invariants do not produce client-facing errors:
- BAL-001: E-500-001 (internal computational integrity check)
- MONTH-001: E-400-006 (date range — schema validation upstream)
- EXPORT-001: E-500-001 (automatic timestamp injection — always succeeds if called correctly)
- ARCHIVED-001: General E-422-001 invariant violation
- SYNCED-001: E-500-001 (filter applied internally — read-only operation)
- VERSION-001: E-422-001-VERSION-001 (internal guard — not user-caused but testable)
- CREATEBY-001: E-422-001-CREATEBY-001 (injected, not user-caused but testable)

For these, unit tests verify internal behavior rather than external error codes, by asserting the domain function's return value or the presence of defensive code paths.

---

## SECTION 10: PERFORMANCE BUDGET

Unit tests are the fastest test level. Performance constraints ensure they remain executable on every commit without slowing development.

### 10.1 Individual Test Duration

Maximum: **1 millisecond** per individual test execution (excluding setup/teardown). The Aggregate boundary method itself must execute within this window. If a single test takes longer than 1ms excluding setup, the domain operation may be performing unnecessary work.

### 10.2 Total Suite Duration

Maximum: **30 seconds** for ALL unit tests combined (approximately 615+ tests). This means average test overhead including setup and teardown must not exceed approximately 48 milliseconds per test.

### 10.3 Execution Budget Optimization Techniques

- Batch test data construction: share common fixture factories
- Avoid lazy initialization in Given phase (construct all needed VOs upfront)
- Use in-memory fakes instead of deferred loading
- Parallelize test execution across Aggregate boundaries (no cross-aggregate state in unit tests)

---

## SECTION 11: AGGREGATE-SPECIFIC UNIT TEST SCENARIOS

Each Aggregate has unique characteristics that require tailored unit test strategies.

### 11.1 OrganizationAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Org creation | Valid name + type, invalid type enum, empty name |
| Hierarchy DAG | Set parent creates valid edge, set parent creates cycle (Kahn's), depth 5 succeeds, depth 6 fails, reparent resolves cycle |
| Org suspension | Active → suspended (writes blocked, reads succeed), suspended → write attempt rejected, suspended org + new sub-org rejected |
| Org archival | Active → archived, archived → write rejected, archived → read succeeds |
| Org merge | source + target both active → merge, source already archived → reject |

### 11.2 IdentityAggregate

| Test Category | Scenarios |
|---------------|-----------|
| User creation | Valid email+role, duplicate email in same org, duplicate email across orgs (allowed), role hierarchy violation (admin creates superadmin) |
| Email uniqueness | Same email + same org → reject, same email + different orgs → accept |
| Password | Hash stored not plain, reset replaces old hash, weak password rejected |
| Session management | Login creates session, logout revokes, refresh creates new, revoke invalidates, expired token rejected |

### 11.3 ResourceAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Transaction lifecycle | Draft create → pending → approved (immutable), rejected → resubmit, compensate approved tx |
| Member lifecycle | Create with name, create without name, update removing name, status transitions (all valid), invalid status rejected |
| Inactive member | Create transaction → rejected (DISABLE-011), create member → accepted, update member → accepted |
| Category reference | Valid vocab category → accepted, invalid category UUID → rejected, null category → rejected |
| Scope validation | scope_type org → accepted, scope_type group → accepted, null scope_type → rejected |

### 11.4 RelationshipAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Cycle detection | A→B→A cycle, A→B→C→A cycle, A→B→C→A→D→A complex cycle, no cycle (Kahn's returns topological order) |
| Depth enforcement | Depth 3 → accepted, depth 4 → accepted, depth 5 → accepted, depth 6 → rejected |
| Multi-membership | Member in 1 group, member in 5 groups, member in 20 groups (all accepted), duplicate membership → rejected |
| Bidirectional queries | Groups for member, members in group, descendant enumeration to depth 5 |

### 11.5 WorkflowAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Timeout enforcement | Step at day 29 → accepted, step at day 30 → accepted, step at day 31 → rejected |
| Auto-retry blocked | Failed workflow → resubmit (manual ok), failed workflow → system retry (blocked, RETRY-004) |
| Financial protection | Workflow approves transaction → OK, workflow directly updates approved transaction → rejected (WF-005) |
| Approval chain | Chain of 5 → accepted, chain of 6 → rejected (CHAINS-003) |
| Escalation | Step timeout → escalation triggered, no timeout → no escalation |

### 11.6 FormAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Client/server validation match | Same Zod schema, same input, identical outputs → assert match, different schema on either side → DUAL-008 violation |
| Vocabulary sourcing | Select field references vocab term → accepted, select field references non-existent term → rejected (VOCAB-002) |
| Form locking | Financial form pre-submission → editable, post-submission → read-only (LOCK-004) |
| Visible conditions | Condition true → field visible, condition false → field hidden, no condition → field always visible |

### 11.7 NotificationAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Trigger enforcement | sendNotification without trigger_source → rejected (NOT-001), with trigger → accepted |
| Rate limiting | Within rate limit → accepted, exceeding rate limit → rejected (RATE-002), rate limit resets after window |
| Channel preferences | User blocked email → email delivery skipped, user allowed email → email delivered |
| Quiet hours | 2 AM, non-critical → blocked (QUIET-004), 2 AM, critical severity → sent (bypass), 10 AM → always sent |

### 11.8 VocabularyAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Never delete | Deprecate value → deprecated flag set, then verify hard delete → rejected (VOC-001), deprecated value still resolvable |
| Translation minimum | Term with FR+EN → accepted, FR only → rejected (TRANSLATION-002), EN only → rejected |
| Key stability | Create term with key → set key → rejected (STABLE-003), update label only → accepted |
| Namespace search | Query with match → terms returned, query empty → rejected, query across namespaces → terms from all |

### 11.9 AuditAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Immutable append-only | Insert entry → accepted, Update entry → rejected (AUD-001), Delete entry → rejected (AUD-001) |
| Old/new snapshots | LogAction with old AND new → accepted, LogAction with old only → rejected (OLDNEW-002), LogAction with neither → rejected |
| Retention enforcement | Entry < 7 years → cannot purge, Entry = 7 years → eligible for purge scheduling, Entry > 7 years → purge permitted |
| Access restriction | Admin queries logs → accepted, Treasurer queries logs → rejected (ACCESS-033), Staff queries logs → rejected |

### 11.10 LifecycleAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Manifest-driven states | Non-configurable type → rejected (LIF-001), configurable type → accepted, state changes tracked |
| Purge irreversibility | Trashed → purged, purged → restore attempt → rejected (LIF-003), purged → transition to any state → rejected |
| Purge date | Before purge_date → rejected (LIF-005), on purge_date → accepted, after purge_date → accepted |
| Trash visibility | Normal query → trashed entries excluded (LIF-006), archive search → trashed entries included |

### 11.11 ConfigurationAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Currency format | "USD" → accepted, "dollar" → rejected (CFG-001), "CDF" → accepted, "US Dollar" → rejected |
| Timezone format | "Africa/Lubumbashi" → accepted, "est" → rejected (CFG-002), "UTC" → accepted |
| Accent color | "#FF0000" with sufficient WCAG contrast → accepted, "#ZZZZZZ" → rejected (CFG-003), "#ABC" (short hex) → rejected |
| Default fallback | Setting null → Resolver returns default (CFG-004), Setting set → Resolver returns actual value |

### 11.12 OfflineSyncAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Local-first absolute | Remote write without local write → rejected (SYNC-001), local write then remote → accepted |
| Batch size | Batch of 50 ops → accepted, batch of 51 ops → rejected (SYNC-002), batch of 1 → accepted |
| Retry backoff | Attempt 1 → fail, Attempt 2-5 → exponential delay, Attempt 6 → permanently failed (SYNC-003) |
| User op non-blocking | Sync running → user creates transaction → transaction accepted (SYNC-004), sync completes later |

### 11.13 ReportingAggregate

| Test Category | Scenarios |
|---------------|-----------|
| Balance equation | Income = 100000, Expense = 40000 → Net = 60000 (balanced), Income = 100000, Expense = 50001 → balance fails (BAL-001) |
| Monthly period | 1st to last day → accepted, 1st to middle of month → rejected (MONTH-001) |
| Sync filter | Only synced=true in calculation, synced=false excluded, mixed synced/unsynced → only synced counted (SYNCED-001) |
| Export timestamp | Export invoked → timestamp and signature present (EXPORT-001) |

---

## SECTION 12: EXCEPTION PROCESS

Unit test requirements may not be waived. However, technical limitations may prevent certain test configurations:

1. **Identify the limitation:** Document which invariant or boundary method cannot be unit-tested and why
2. **Assess compensating controls:** Can the invariant be verified through integration tests instead? If yes, document as compensated, not exempt
3. **Document the gap:** Record the gap in the test traceability matrix (TEST-SPEC-008)
4. **Remediation target:** A follow-up task must be created with a target resolution date
5. **Quarterly review:** All gaps reviewed quarterly for closure

There are no permanent exemptions. Every unit test gap is technical debt with an expiration date.

---

## APPENDIX A: TEST TRACEABILITY MATRIX — INvariants to Unit Tests

This appendix maps each DOC-015 invariant to its corresponding unit tests. Every row must have at least 2 entries (respect + violation).

| Invariant ID | Invariant Name | Aggregate | Respect Test ID | Violation Test ID | Error Code |
|-------------|---------------|-----------|----------------|------------------|------------|
| FIN-001 | Immutabilite Comptable | Resource | UT-RES-001-OK | UT-RES-001-BAD | E-422-001-FIN-001 |
| FIN-002 | Montant Toujours Positif | Resource | UT-RES-002-OK | UT-RES-002-BAD | E-422-001-FIN-002 |
| DATE-001 | Date Jamais Futur | Resource | UT-RES-003-OK | UT-RES-003-BAD | E-422-001-DATE-001 |
| CAT-001 | Categorie Issue du Vocabulaire | Resource | UT-RES-004-OK | UT-RES-004-BAD | E-422-001-CAT-001 |
| DESC-001 | Description Obligatoire > 100 | Resource | UT-RES-005-OK | UT-RES-005-BAD | E-422-001-DESC-001 |
| VERSION-001 | Version Tjs Incremente | Resource | UT-RES-006-OK | UT-RES-006-BAD | E-422-001-VERSION-001 |
| CREATEBY-001 | CreatedBy Tjs Defini | Resource | UT-RES-007-OK | UT-RES-007-BAD | E-422-001-CREATEBY-001 |
| COMP-001 | Compensation Link | Resource | UT-RES-008-OK | UT-RES-008-BAD | E-422-001-COMP-001 |
| SCOPE-001 | Scope Toujours Defini | Resource | UT-RES-009-OK | UT-RES-009-BAD | E-422-001-SCOPE-001 |
| BAL-001 | Bilan Equilibre | Reporting | UT-RPT-001-OK | UT-RPT-001-BAD | E-500-001 |
| MONTH-001 | Rapport Mensuel Complet | Reporting | UT-RPT-002-OK | UT-RPT-002-BAD | E-400-006 |
| EXPORT-001 | Export Horodate | Reporting | UT-RPT-003-OK | UT-RPT-003-OK | N/A (auto) |
| ARCHIVED-001 | Rapport Archive Immuable | Reporting | UT-RPT-004-OK | UT-RPT-004-BAD | E-422-001 |
| SYNCED-001 | Synced Participent | Reporting | UT-RPT-005-OK | UT-RPT-005-BAD | E-500-001 |
| MEM-001 | Prenom+Nom Obl | Resource | UT-RES-010-OK | UT-RES-010-BAD | E-422-001-MEM-001 |
| EMAIL-001 | Email Unique Par Org | Identity | UT-ID-001-OK | UT-ID-001-BAD | E-422-001-EMAIL-001 |
| PHONE-003 | Tel Format | Identity | UT-ID-002-OK | UT-ID-002-BAD | E-400-003 |
| AGE-004 | Age 0-120 | Identity | UT-ID-003-OK | UT-ID-003-BAD | E-400-002 |
| DUP-005 | Dup Email Detecte | Identity | UT-ID-004-OK | UT-ID-004-BAD | E-409-002 |
| STATUS-010 | Etats Valid | Resource | UT-RES-011-OK | UT-RES-011-BAD | E-422-001-STATUS-010 |
| DISABLE-011 | Inactive Cannot Transact | Resource | UT-RES-012-OK | UT-RES-012-BAD | E-422-001-DISABLE-011 |
| TRANS-012 | Transfert Necertificat | Relationship | UT-REL-001-OK | UT-REL-001-BAD | E-400-001 |
| REL-001 | DAG Sans Cycles | Relationship | UT-REL-002-OK | UT-REL-002-BAD | E-422-001-REL-001 |
| DEPTH-002 | Profondeur Max 5 | Relationship | UT-REL-003-OK | UT-REL-003-BAD | E-422-001-REL-002 |
| MULTI-020 | Multi-Membership Autorisee | Relationship | UT-REL-004-OK | UT-REL-004-BAD | E-409-004 |
| ATTR-021 | Attribution Validee | Workflow | UT-WF-001-OK | UT-WF-001-BAD | E-422-001 |
| HISTORY-022 | Historique Conserve | Audit | UT-AUD-001-OK | UT-AUD-001-BAD | E-500-001 |
| WF-001 | Timeout Max 30j | Workflow | UT-WF-002-OK | UT-WF-002-BAD | E-422-001-WF-001 |
| ESCALATE-002 | Escalade Oblige | Workflow | UT-WF-003-OK | UT-WF-003-BAD | E-500-001 |
| CHAINS-003 | Approval Chain <= 5 | Workflow | UT-WF-004-OK | UT-WF-004-BAD | E-422-001 |
| RETRY-004 | Retry Manuel Seulement | Workflow | UT-WF-005-OK | UT-WF-005-BAD | E-422-001-RETRY-004 |
| LOG-005 | Execution States Logged | Workflow+Audit | UT-WF-006-OK | UT-WF-006-BAD | E-500-001 |
| WF-005 | Financial Not Modified Directly | Workflow | UT-WF-007-OK | UT-WF-007-BAD | E-422-001-WF-005 |
| FRM-009 | JSON -> UI Only | Form | UT-FRM-001-OK | UT-FRM-001-BAD | E-422-001-FRM-009 |
| VOCAB-002 | Select From Vocabulary | Form | UT-FRM-002-OK | UT-FRM-002-BAD | E-422-001-VOCAB-002 |
| DUAL-008 | Validation Double | Form | UT-FRM-003-OK | UT-FRM-003-BAD | E-422-001-DUAL-008 |
| LOCK-004 | Sensitive Forms Locked | Form | UT-FRM-004-OK | UT-FRM-004-BAD | E-422-001-LOCK-004 |
| NOT-001 | Trigger Toujours Present | Notification | UT-NOT-001-OK | UT-NOT-001-BAD | E-422-001-NOT-001 |
| RATE-002 | Rate Limit Enforced | Notification | UT-NOT-002-OK | UT-NOT-002-BAD | E-422-001-RATE-002 |
| CHANNEL-003 | Preferences Respectees | Notification | UT-NOT-003-OK | UT-NOT-003-BAD | E-422-001-CHANNEL-003 |
| QUIET-004 | Quiet Hours Respectees | Notification | UT-NOT-004-OK | UT-NOT-004-BAD | E-422-001-QUIET-004 |
| VOC-001 | Never Delete Values | Vocabulary | UT-VOC-001-OK | UT-VOC-001-BAD | E-422-001-VOC-001 |
| TRANSLATION-002 | Min FR+EN Translations | Vocabulary | UT-VOC-002-OK | UT-VOC-002-BAD | E-422-001-TRANSLATION-002 |
| STABLE-003 | Keys Stable Forever | Vocabulary | UT-VOC-003-OK | UT-VOC-003-BAD | E-422-001-STABLE-003 |
| AUD-001 | Journal Immuable | Audit | UT-AUD-002-OK | UT-AUD-002-BAD | E-422-001-AUD-001 |
| OLDNEW-002 | Old Value + New Value | Audit | UT-AUD-003-OK | UT-AUD-003-BAD | E-422-001-AUD-OLDNEW-002 |
| RETENTION-031 | Conservation Min 7 Ans | Audit | UT-AUD-004-OK | UT-AUD-004-BAD | E-422-001 |
| ACCESS-033 | Acces Restreint | Audit | UT-AUD-005-OK | UT-AUD-005-BAD | E-403-001 |
| LIF-001 | States Configurable Par Manifest | Lifecycle | UT-LIF-001-OK | UT-LIF-001-BAD | E-422-001-LIF-001 |
| LIF-003 | Purge Irrversible | Lifecycle | UT-LIF-002-OK | UT-LIF-002-BAD | E-422-001-LIF-003 |
| LIF-005 | Purge Date Configurable | Lifecycle | UT-LIF-003-OK | UT-LIF-003-BAD | E-422-001-LIF-005 |
| CFG-001 | Currency ISO 4217 | Config | UT-CFG-001-OK | UT-CFG-001-BAD | E-422-001-CFG-001 |
| CFG-002 | Timezone IANA | Config | UT-CFG-002-OK | UT-CFG-002-BAD | E-422-001-CFG-002 |
| CFG-003 | Accent Color Valid Hex | Config | UT-CFG-003-OK | UT-CFG-003-BAD | E-422-001-CFG-003 |
| CFG-004 | Default Fallback | Config | UT-CFG-004-OK | UT-CFG-004-OK | N/A (auto) |
| SYNC-001 | Local First Absolute | OfflineSync | UT-SYNC-001-OK | UT-SYNC-001-BAD | E-422-001-SYNC-001 |
| SYNC-002 | Batch Size Max 50 | OfflineSync | UT-SYNC-002-OK | UT-SYNC-002-BAD | E-422-001-SYNC-002 |
| SYNC-003 | Retry Exponential Backoff 5 | OfflineSync | UT-SYNC-003-OK | UT-SYNC-003-BAD | E-422-001-SYNC-003 |
| SYNC-004 | User Ops Never Block | OfflineSync | UT-SYNC-004-OK | UT-SYNC-004-BAD | E-422-001-SYNC-004 |

Total: 58 invariants x 2 = **116 invariant tests minimum**.

---

## APPENDIX B: TEST COUNT SUMMARY

| Category | Minimum Count |
|----------|--------------|
| Invariant respect tests | 58 |
| Invariant violation tests | 58 |
| Value Object tests (40+ VOs, ~4 each) | 160 |
| Boundary method scenario tests (~2 per method) | 156 |
| Pure function tests (6 functions, ~3 each) | 18 |
| Special enforcement tests (versioning, created_by) | 9 |
| **TOTAL MINIMUM** | **459** |

Note: The higher estimate of 615+ from Section 6.1 accounts for additional edge cases per boundary method and per Value Object. The actual implementation should target the higher count.

---

## APPENDIX C: DOCUMENT REVISION HISTORY

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v1.0 | 2026-07-25 | Agnes-2.0-Flash (Sapiens AI) | Genesis definition of unit test rules from canonical source documents |

---

*This unit test specification defines mandatory rules for verifying domain correctness at the unit level. Every subsequent implementation MUST comply with these rules. Deviations require documented exception via the process defined in Section 12.*

*FIN DU DOCUMENT TEST-SPEC-002*
