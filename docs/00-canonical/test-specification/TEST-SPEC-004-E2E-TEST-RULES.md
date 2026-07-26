# E2E Test Rules — Lumina v1
**Doc ID:** TEST-SPEC-004
**Version:** v1.0
**Statut:** SPECIFICATION DE TESTS DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-012", "DOC-014", "DOC-015", "ASS-002", "ASS-003", "API-CONTRACT-001", "API-CONTRACT-004"]
**Transformation_rule :** "test-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the rules for writing end-to-end (E2E) tests for the Lumina application. E2E tests simulate real user journeys from authentication through business outcome, exercising the full application stack: input layer, protocol adapter, API layer, Application Services, Domain Model, Persistence, Event Bus, and observable side effects (notifications, audit logs, sync status).

E2E tests are expensive in execution time, maintenance cost, and flakiness. They are reserved EXCLUSIVELY for twelve critical user journeys identified in this document. No other scenarios receive E2E test coverage. This constraint is non-negotiable — every request to add a new E2E journey must be evaluated against the cost/maintenance burden and converted to a lower-level test where possible.

Every decision in this document traces to ASS-002 (Use Case Catalog sequenced into journeys), TEST-SPEC-001 (E2E Level 4 specifications), and API-CONTRACT-001 (available operations).

---

## SECTION 1: PURPOSE

E2E tests verify that the complete system works correctly together, not just individual components in isolation. They answer one question: can a real user perform a meaningful business operation from start to finish with the correct observable outcomes?

### 1.1 What E2E Tests Verify

- Complete authentication and authorization flow (login → session → token refresh → action → logout)
- Full command execution pipeline from user input through domain validation to persistence
- Cross-aggregate event propagation and eventual consistency
- Side effects: notifications sent, audit entries created, sync status updated
- Multi-tenant isolation across the complete stack
- Offline-first behavior: create offline → connect → sync → conflict resolution

### 1.2 What E2E Tests Do NOT Verify

- Individual invariant guards (covered by Unit Tests, TEST-SPEC-002)
- API schema fidelity per protocol (covered by Contract Tests, TEST-SPEC-001 Level 3)
- Performance under load (covered by Performance Tests, TEST-SPEC-006)
- Security boundary verification (covered by Security Tests, TEST-SPEC-007)

---

## SECTION 2: CRITICAL USER JOURNEYS — COMPLETE LIST

Exactly twelve critical user journeys are defined. Each journey represents a primary value-delivering path through the system, derived from sequencing ASS-002 use cases into coherent user narratives.

### Journey 1: Superadmin Creates Organization → Adds Admin → User Logs In

**Business value:** Foundation tenant setup — the complete onboarding path for a new organization.

**Sequenced operations from ASS-002:**
1. UC-ORG-01: CreateOrganization (superadmin)
2. UC-ID-01: CreateUser — admin role (superadmin creates the org's first admin)
3. UC-ID-05: LoginUser — as the newly created admin
4. UC-ORG-Q01: GetOrganizationProfile — admin verifies org exists
5. UC-CFG-Q01: GetSetting — admin reads default settings

**Duration target:** < 30 seconds total
**Preconditions:** None (this is the greenfield onboarding path)
**Post-conditions:** New organization created; admin user exists and can authenticate; org profile retrievable; default settings accessible.

---

### Journey 2: Treasurer Creates Transaction → Pastor Approves → Report Generated

**Business value:** Core financial workflow — the heartbeat of Lumina's finance module.

**Sequenced operations from ASS-002:**
1. UC-RES-01: CreateTransaction (treasurer creates draft)
2. UC-RES-03: SubmitForApproval (treasurer submits draft)
3. WorkflowAggregate triggers automatically (UC-WF-01)
4. UC-WF-Q01: GetPendingApprovals (pastor views pending approvals)
5. UC-WF-02: ApproveStep (pastor approves workflow step)
6. UC-RES-04: ApproveTransaction (pastor or system approves the transaction)
7. UC-RPT-01: GenerateReport (treasurer generates monthly report including the approved transaction)
8. UC-RPT-Q01: CalculateBalance (verify balance includes the approved transaction, SYNCED-001)

**Duration target:** < 30 seconds total
**Preconditions:** Organization exists; vocabulary terms pre-seeded with finance categories; treasurer and pastor users exist.
**Post-conditions:** Transaction is approved and immutable (FIN-001); workflow instance completed; report generated with balanced totals (BAL-001); audit trail contains all mutations (AUD-001); notification sent to treasurer confirming approval.

---

### Journey 3: Member Registered → Added to Group → Event Scheduled → Notification Sent

**Business value:** Membership lifecycle management — adding a new member, assigning them to groups, scheduling their first event, and notifying relevant parties.

**Sequenced operations from ASS-002:**
1. UC-RES-07: CreateMember (admin registers new member, MEM-001 firstName+lastName validated)
2. UC-REL-01: AddMemberToGroup (admin adds member to a group)
3. UC-RES-Q02 (implicit): SearchResources to verify member is searchable
4. Create Event via ResourceAggregate (event resource created, state=draft)
5. UC-RES-03 equivalent for events: Submit Event for publication
6. Event transitions draft → published
7. UC-NOT-01: SendNotification (system notifies group members about new event)

**Duration target:** < 30 seconds total
**Preconditions:** Organization exists with at least one group; admin and member users exist.
**Post-conditions:** Member record created with valid status (STATUS-010); membership link established (MULTI-020); event published; notifications sent respecting CHANNEL-003 preferences and RATE-002 limits.

---

### Journey 4: Workflow Triggered → Steps Advanced → Completed with Audit Log

**Business value:** Full workflow lifecycle — from trigger through multi-step approval to completion, with complete audit trail.

**Sequenced operations from ASS-002:**
1. Trigger event fires (resource creation or state change)
2. UC-WF-01: TriggerWorkflow (workflow instance created, LOG-005)
3. Step 1: Auto-execution completes
4. Step 2: Approval required — UC-WF-Q01 GetPendingApprovals (approver views)
5. Step 2: UC-WF-02 ApproveStep (approver approves, CHAINS-003 verified)
6. Step 3: Conditional check passes
7. Step 4: Notification step executes (UC-NOT-01 queued)
8. UC-WF-Q01: GetPendingApprovals returns empty (no more pending steps)
9. Verify audit log: ActionLogged entries for each workflow state change (LOG-005)
10. Verify workflow instance status = "completed"

**Duration target:** < 30 seconds total
**Preconditions:** Organization exists; resource exists; workflow definition registered; approver user exists.
**Post-conditions:** Workflow completed successfully; all 4 steps executed; audit trail complete for every state transition; no timeouts exceeded (WF-001).

---

### Journey 5: Form Defined → Published → Fields Filled → Submitted

**Business value:** Dynamic form lifecycle — from definition through rendering, validation, submission, and post-submission immutability.

**Sequenced operations from ASS-002:**
1. Admin configures form via manifest (form definition registered; FRM-009 JSON→UI only)
2. UC-FRM-Q01: LoadFormDefinition (load the form by ID)
3. UC-FRM-Q02: RenderForm (produce render tree with vocabulary-sourced options — VOCAB-002)
4. UC-FRM-Q03: GetVisibleFields (fields whose visible_if conditions match context — FRM-003)
5. User fills form data (some fields conditional on other field values)
6. UC-FRM-01: ValidateFormData (client and server produce identical results — DUAL-008)
7. Form submission creates underlying Resource (transaction/member/etc.)
8. Verify submitted financial form cannot be modified (LOCK-004 sensitive forms locked)

**Duration target:** < 30 seconds total
**Preconditions:** Form definition registered in manifest; vocabulary terms available for select fields.
**Post-conditions:** Form rendered correctly with visible conditions applied; client/server validation matches; submitted resource created; financial form locked read-only after submission.

---

### Journey 6: Vocabulary Term Defined → Category Created → Transaction Categorized

**Business value:** Vocabulary-driven categorization — establishing a term, using it in form select options, and referencing it in a financial transaction.

**Sequenced operations from ASS-002:**
1. UC-VOC-01: AddTermValue (add new term to namespace, TRANSLATION-002 min FR+EN)
2. UC-FRM-Q02: RenderForm (select option sourced from newly added vocabulary term)
3. UC-RES-01: CreateTransaction (reference the vocabulary category — CAT-001)
4. UC-VOC-Q01: ResolveLabel (resolve display label in both FR and EN)
5. Verify term cannot be deleted (VOC-001) — attempt deprecate instead
6. Verify deprecated term still resolves (legacy references preserved)

**Duration target:** < 30 seconds total
**Preconditions:** Organization exists; admin user with vocabulary management permission.
**Post-conditions:** Term created with FR+EN labels; transaction created with valid category reference; vocabulary options appear in form rendering; deprecated term remains resolvable.

---

### Journey 7: Offline Create → Sync Pushed → Conflict Resolved

**Business value:** Offline-first capability — creating data without network connectivity, syncing when connection restored, and resolving conflicts.

**Sequenced operations from ASS-002:**
1. Device goes offline; network unavailable
2. UC-RES-01: CreateTransaction locally (local write stored in SQLite, SYNC-001 local first)
3. UC-RES-07: CreateMember locally (another offline creation)
4. UC-SYNC-01: PushPendingOperations (network restored; batch of 2 ops pushed, SYNC-002 batch size)
5. Server accepts push; sync_status transitions pending → confirmed
6. Simulate conflict: same entity modified on server during offline period
7. UC-SYNC-03: ResolveConflict (apply conflict strategy — LWW for members, immutable for approved transactions)
8. UC-SYNC-Q02: GetSyncStatus (verify final sync status)

**Duration target:** < 30 seconds total
**Preconditions:** Organization exists; test device can toggle online/offline; mock server accepts sync requests.
**Post-conditions:** Offline-created transactions synced to remote; conflict resolved per strategy; sync status shows all operations confirmed; user experienced no blocking during sync (SYNC-004).

---

### Journey 8: Bulk Import of Members → Validation Errors Reported

**Business value:** Administrative efficiency — importing multiple members simultaneously with structured error reporting.

**Sequenced operations from ASS-002:**
1. Prepare bulk import payload (JSON array of 50 member records; mix of valid, boundary, and invalid entries)
2. Batch import processing validates each record against MEM-001 (firstName+lastName mandatory)
3. Records with duplicate email within org (EMAIL-001) are rejected
4. Records with invalid status enum (STATUS-010) are rejected
5. Valid records created; invalid records reported with specific error codes
6. Partial success: some members imported, others rejected with detailed errors
7. Report returned: count of successful imports, count of failures, list of individual errors

**Duration target:** < 30 seconds total
**Preconditions:** Organization exists; admin user with member management permission.
**Post-conditions:** Valid members created with unique emails per org; invalid members rejected with descriptive errors; overall import result reflects partial success/failure accurately.

---

### Journey 9: Archive Member → Purge Scheduled → Purge Executed → Audit Entry Created

**Business value:** Data lifecycle compliance — archive, trash, purge with retention enforcement and complete audit trail.

**Sequenced operations from ASS-002:**
1. UC-LIF-01: ArchiveResource (archive the member record, LIF-001 manifest-driven states)
2. UC-LIF-02: TrashResource (move archived entry to trash, LIF-003 not yet purged)
3. Verify purge_date configurable (LIF-005) — set purge date to past date for test
4. UC-LIF-03: PurgeResource (system scheduled purge, irreversible — LIF-003)
5. Attempt to restore purged entry → rejected with E-409-006 ALREADY_PURGED
6. Verify purge attempt before purge_date → rejected (LIF-005)
7. Verify audit trail: Archive → Trash → Purge all logged (AUD-001 append-only)
8. Verify retention: entry purged after > 7 years minimum (RETENTION-031)

**Duration target:** < 30 seconds total
**Preconditions:** Member record exists in active state; admin user.
**Post-conditions:** Member permanently purged; restoration impossible (irreversible); purge date enforcement verified; complete audit trail from creation through purge.

---

### Journey 10: Settings Updated → Preferences Changed → Notification Delivered

**Business value:** Configuration and notification integration — changing organization settings and verifying notification behavior adapts.

**Sequenced operations from ASS-002:**
1. UC-CFG-01: UpdateSetting (update currency to "USD" — CFG-001 ISO 4217 validated)
2. UC-CFG-01: UpdateSetting (update timezone to "Africa/Lubumbashi" — CFG-002 IANA validated)
3. UC-NOT-03: UpdatePreferences (user sets channel preferences — email blocked, in_app allowed)
4. UC-NOT-04: SetRateLimit (configure rate limit per user)
5. UC-NOT-01: SendNotification (notification sent via in_app only, email skipped due to preference)
6. Verify rate limit enforced: rapid successive sends blocked after limit exceeded (RATE-002)
7. Verify quiet hours: send during quiet hours blocked for non-critical (QUIET-004), critical bypasses
8. UC-CFG-Q02: GetAllSettings (verify all settings persisted correctly)

**Duration target:** < 30 seconds total
**Preconditions:** Organization exists with custom settings; user with notification preferences exists.
**Post-conditions:** Currency and timezone format validated and persisted; notification respects channel preferences, rate limits, and quiet hours; all settings retrievable.

---

### Journey 11: Multi-Tenant Isolation (Org A Cannot See Org B Data)

**Business value:** Security and data isolation — verifying the fundamental multi-tenant guarantee across all operations.

**Sequenced operations from ASS-002:**
1. UC-ORG-01: CreateOrganization (org_A)
2. UC-ORG-01: CreateOrganization (org_B)
3. UC-ID-01: CreateUser (admin for org_A)
4. UC-ID-01: CreateUser (admin for org_B)
5. UC-RES-01: CreateTransaction in org_A (by org_A admin)
6. UC-RES-01: CreateTransaction in org_B (by org_B admin)
7. Org_A admin queries resources → returns org_A data only, ZERO org_B transactions
8. Org_B admin queries resources → returns org_B data only, ZERO org_A transactions
9. Org_A admin attempts to access org_B's settings → E-403-001 INSUFFICIENT_PERMISSION
10. Org_A admin attempts to access org_B's users → E-404-002 TENANT_NOT_FOUND
11. Cross-org membership: org_A member cannot be added to org_B group (INV-004)
12. Query with org_id filter removed → results include both orgs' data (system-level admin query)

**Duration target:** < 30 seconds total
**Preconditions:** Two organizations exist with distinct org_ids; users authenticated per org.
**Post-conditions:** Complete data isolation between orgs; cross-org access always denied; org_id scoping enforced at every layer (Application Service, Aggregate, Repository).

---

### Journey 12: Auth → Session Refresh → Token Revocation → Re-Auth

**Business value:** Session security lifecycle — managing authentication tokens from login through rotation to revocation.

**Sequenced operations from ASS-002:**
1. UC-ID-05: LoginUser (initial login; receives access token + refresh token)
2. Access token expires (simulated by advancing ClockPort beyond TTL)
3. UC-ID-07: RefreshAccessToken (issue fresh access token using refresh token — SESSION-005)
4. UC-ID-08: RevokeSession (revoke the refresh token — invalidates all sessions)
5. Attempt to use revoked refresh token → E-401-002 SESSION_EXPIRED
6. UC-ID-05: LoginUser (re-authenticate with credentials)
7. UC-ID-06: LogoutUser (logout — user_logged_out event)
8. Verify session count: single active session at any time (concurrent session limit)
9. UC-ID-09: AssignPermissionGrant (admin assigns new permission)
10. Permission reflected immediately in subsequent request authorization

**Duration target:** < 30 seconds total
**Preconditions:** User exists; password hash available; ClockPort controllable.
**Post-conditions:** Token refresh works without re-authentication; revoked tokens are immediately invalid; re-authentication produces new session; permission changes propagate instantly.

---

## SECTION 3: FRAMEWORK-AGNOSTIC SPECIFICATION

This specification describes WHAT is tested, not HOW it is tested. The following principles govern the framework-agnostic approach:

### 3.1 No Framework Names

No testing framework, HTTP client library, browser automation tool, or assertion library is named in this specification. Implementation teams select appropriate tools for their environment.

### 3.2 Layer Abstraction

Tests interact with the system through its public interfaces:
- Authentication via the login endpoint/entry point
- Business operations via the Application Service layer (direct invocation or API call)
- State verification via database queries or repository reads
- Event verification via event bus interceptor/listener
- Notification verification via notification store queries

### 3.3 Environment Requirements

E2E tests require a staging environment matching production:
- Real PostgreSQL database (not in-memory)
- Real authentication system (real credential hashing, real token generation)
- Real event bus (real event publication and consumption)
- Real offline sync simulation (local SQLite ↔ remote PostgreSQL)
- Real notification queuing (in-app delivery simulated; push/email/sms mocked)

### 3.4 Test Data Isolation

Each E2E journey uses its own isolated organization and users:
- Unique org_id per journey run
- Unique user credentials per journey run
- Full schema truncation between journeys (topological order: referenced tables before referencing tables)
- No shared state between sequential journey executions

---

## SECTION 4: EXECUTION FREQUENCY

### 4.1 Before Each Release Only

E2E tests execute BEFORE EACH RELEASE, not on every commit. This is a deliberate constraint based on:
- **Execution cost:** 12 journeys x ~30 seconds = ~6 minutes minimum
- **Maintenance burden:** E2E tests drift from reality as UI/flow changes
- **Flakiness risk:** Network-dependent tests occasionally fail due to transient issues
- **Environment dependency:** Requires dedicated staging environment matching production

### 4.2 Trigger Conditions

| Trigger | E2E Tests Executed | Notes |
|---------|-------------------|-------|
| Git push to feature branch | NO (Stages 1-3 only) | Unit, Integration, Contract tests |
| Pull Request open/review | PARTIAL (Stage 4 smoke subset) | Optional: run top-3 critical journeys only |
| Release tag created | YES (full suite) | All 12 journeys |
| Scheduled nightly | NO | Stages 1-5 (adds Performance tests) |

### 4.3 Smoke Subset for PR Review

When E2E tests are run partially (PR review trigger), execute these priority journeys first:
1. Journey 1: Organization creation + admin setup (foundation test)
2. Journey 2: Financial approval workflow (core business flow)
3. Journey 11: Multi-tenant isolation (security critical)

The remaining 9 journeys run fully only on release trigger.

---

## SECTION 5: TEST DATA REQUIREMENTS

### 5.1 Real API Endpoints

E2E tests use the actual API endpoints (REST, GraphQL, gRPC, or CLI depending on the protocol adapter being tested). No mocking at the protocol layer.

### 5.2 Real Database

E2E tests query the actual PostgreSQL database to verify persisted state. No in-memory fakes. All data is verified through real SELECT queries scoped by org_id.

### 5.3 Real Auth Flow

E2E tests exercise the full authentication pipeline:
- Credential submission (email + password)
- Session creation with token generation
- Token refresh with existing refresh token
- Session revocation
- Re-authentication after revocation

### 5.4 Real Offline Sync Simulation

Journey 7 requires:
- Local SQLite database on "device"
- Remote PostgreSQL database
- Network toggle capability (online/offline)
- Push/pull coordination working end-to-end
- Conflict detection and resolution through the real sync protocol

---

## SECTION 6: ASSERTION STANDARDS

### 6.1 Journey Completion

The primary assertion for every E2E test: the journey completes successfully without errors. If any step fails with an unexpected error, the test fails.

### 6.2 Side Effect Verification

After each journey completes, verify observable side effects:

| Journey | Side Effects to Verify |
|---------|----------------------|
| 1 | OrganizationCreated event; Audit log entry; Default settings applied |
| 2 | ResourceStateChanged events; WorkflowCompleted event; ApprovalGranted event; ReportGenerated; NotificationQueued; Audit entries for all mutations |
| 3 | ResourceCreated (member); MemberJoinedGroup event; NotificationQueued event; EventRecord published |
| 4 | WorkflowTriggered; StepApproved (x4); WorkflowCompleted; NotificationQueued; Audit entries per step |
| 5 | FormSubmitted event; ResourceCreated (from form data); Audit entries |
| 6 | TermAdded event; ResourceCreated with category reference; LabelResolved event |
| 7 | BatchPushed event; ConflictResolved event (if conflict); SyncCompleted event; PendingOperation records cleared |
| 8 | Multiple ResourceCreated events (valid); Error responses for invalid records; Partial success count accurate |
| 9 | ResourceArchived; ResourceTrashed; ResourcePurged; Audit entries; PurgeScheduled event |
| 10 | SettingUpdated events; PreferencesUpdated event; NotificationQueued (in_app only); Rate limit applied |
| 11 | Data queries return correct org-scoped results; Cross-org access attempts return E-403 or E-404 |
| 12 | SessionCreated (initial); SessionCreated (refresh); SessionRevoked (after revoke); UserLoggedIn (re-auth); UserLoggedOut |

### 6.3 End-to-End State Verification

Verify the final state of the system after each journey:
- All expected entities created/updated/deleted
- All expected domain events published
- All expected audit entries appended
- All expected notifications queued/delivered
- Sync status reflects current state (no orphaned pending operations)
- Balance totals computed correctly (for financial journeys)

---

## APPENDIX A: JOURNEY TRACEABILITY TO USE CASES

| Journey | Source Use Cases (ASS-002) | Related Invariants (DOC-015) |
|---------|--------------------------|----------------------------|
| 1 | UC-ORG-01, UC-ID-01, UC-ID-05, UC-ORG-Q01, UC-CFG-Q01 | INV-004, BR-ID-005 |
| 2 | UC-RES-01, UC-RES-03, UC-RES-04, UC-WF-01, UC-WF-Q01, UC-WF-02, UC-RPT-01, UC-RPT-Q01 | FIN-001, FIN-002, CAT-001, BAL-001, WF-001, LOG-005, AUD-001, SYNCED-001 |
| 3 | UC-RES-07, UC-REL-01, UC-NOT-01 | MEM-001, STATUS-010, MULTI-020, NOT-001, CHANNEL-003, RATE-002, QUIET-004 |
| 4 | UC-WF-01, UC-WF-02, UC-WF-Q01, UC-AUD-Q01 | LOG-005, CHAINS-003, WF-001, WF-005, ESCALATE-002, RETRY-004 |
| 5 | UC-FRM-01, UC-FRM-Q01, UC-FRM-Q02, UC-FRM-Q03 | FRM-009, VOCAB-002, DUAL-008, LOCK-004, FRM-003 |
| 6 | UC-VOC-01, UC-VOC-Q01, UC-RES-01 | TRANSLATION-002, VOC-001, STABLE-003, CAT-001 |
| 7 | UC-RES-01, UC-SYNC-01, UC-SYNC-03, UC-SYNC-Q02 | SYNC-001, SYNC-002, SYNC-003, SYNC-004, FIN-001 |
| 8 | UC-RES-07 (batched) | MEM-001, EMAIL-001, STATUS-010 |
| 9 | UC-LIF-01, UC-LIF-02, UC-LIF-03, UC-AUD-Q01 | LIF-001, LIF-003, LIF-005, AUD-001, RETENTION-031, ACCESS-033 |
| 10 | UC-CFG-01, UC-CFG-Q01, UC-CFG-Q02, UC-NOT-01, UC-NOT-03, UC-NOT-04 | CFG-001, CFG-002, NOT-001, RATE-002, CHANNEL-003, QUIET-004 |
| 11 | All aggregates (cross-org queries) | INV-004, E-403-001, E-404-002 |
| 12 | UC-ID-05, UC-ID-06, UC-ID-07, UC-ID-08, UC-ID-09 | INV-008, SESSION-005, RETRY-004 |

---

## APPENDIX B: DOCUMENT REVISION HISTORY

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v1.0 | 2026-07-25 | Agnes-2.0-Flash (Sapiens AI) | Genesis definition of E2E test rules and 12 critical journeys |

---

*This E2E test specification defines the twelve critical user journeys that constitute the complete end-to-end verification surface. Every journey traces to documented use cases, invariants, and operational flows.*

*FIN DU DOCUMENT TEST-SPEC-004*
