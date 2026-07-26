# Test Strategy — Lumina v1
**Doc ID:** TEST-SPEC-001
**Version:** v1.0
**Statut:** SPECIFICATION DE TESTS DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-012", "DOC-014", "DOC-015", "API-CONTRACT-005", "ASS-002", "ASS-003", "ASS-004"]
**Transformation_rule :** "test-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the global test strategy for the Lumina application. It specifies what must be tested, at which level, by whom, and with what quality gates. These are specifications only — no code, no frameworks, no executable artifacts. Every decision in this document traces to one or more canonical sources listed in the header.

---

## SECTION 1: TESTING PHILOSOPHY

Lumina's testing philosophy is built on seven foundational principles that govern every layer of verification. These principles are non-negotiable; any deviation requires a documented Exception Request traceable to an Architecture Decision Record.

### Principle 1: Test-Driven Development Required for All New Code

Every new feature, command, query, or domain rule introduced into the Lumina codebase MUST have its corresponding test specification defined before the implementation begins. No feature is considered complete until its tests pass. This is not optional. The test specification drives the design of the command interface, constrains the Aggregate boundary methods, and validates invariant guards. Implementation without prior test specification is prohibited.

**Traceability:** This principle enforces DOC-015's assertion that all 58 invariants are automatically validated by the Domain Model. The test specification makes this automatic validation verifiable.

### Principle 2: Invariants First

Every invariant from DOC-015 MUST have at least two unit tests: one that verifies the invariant holds (the happy path), and one that verifies the invariant rejects a violation (the failure path). This applies to all severity levels — CRITIQUE, MAJEUR, and MINEUR. For the 58 documented invariants, this means a minimum of 116 unit tests covering every invariant boundary.

Severity-based prioritization:
- CRITIQUE (38 invariants): Tests written first, reviewed by peer before any other test
- MAJEUR (15 invariants): Tests written during implementation
- MINEUR (5 invariants): Tests written alongside other layer tests

**Traceability:** Each invariant maps to specific error codes in API-CONTRACT-005 (E-422-NNN_INV-XXX format). Tests verify both the positive and negative paths produce the correct error code when violated.

### Principle 3: Business Rules Tested at Domain Layer Only

Business rules are tested exclusively within the Domain layer through Aggregate boundary methods. No business rule is validated through API-level integration tests or end-to-end user journey tests. This ensures that business logic is testable in isolation, without database connections, authentication, serialization, or network overhead. API-level tests verify that commands reach the correct Aggregate and that responses conform to API contracts — they do not re-test business rules.

**Exception:** Cross-Aggregate business rules defined in ASS-004 are tested via Integration Tests (Section 2, Level 2), because they inherently span multiple Aggregate boundaries.

**Traceability:** DOC-015 states that all 58 invariants are guard functions within Aggregate boundary methods. Testing them at the API layer would be redundant and architecturally incorrect.

### Principle 4: Integration Tests for Cross-Aggregate Flows

Every cross-Aggregate coordination pattern defined in ASS-004 requires at least one integration test. These tests verify that Domain Events propagate correctly between Aggregates, that Saga compensation actions execute when downstream steps fail, and that eventual consistency reaches the expected final state.

The nine coordination patterns in ASS-004 each require specific test scenarios:
- Read-only cross-reference (Resource→Vocabulary, Form→Vocabulary, Lifecycle→Resource)
- Context resolution (Resource→Organization, Notification→Identity)
- Event-driven side-effect (Resource→OfflineSync, Workflow→Resource, All→Audit, Org→Relationship)
- Reference validation (Lifecycle→Resource archive flow)
- Fan-out monitoring (OfflineSync→ALL aggregates)

**Traceability:** Each pattern is verified against the coordination matrix in ASS-004, section "Cross-Aggregate Coordination Matrix" and "Detailed Coordination Specifications."

### Principle 5: End-to-End Tests Reserved for Critical User Journeys

End-to-end tests are expensive in execution time, maintenance cost, and flakiness. They are reserved exclusively for the twelve critical user journeys identified in TEST-SPEC-004. No other scenarios receive E2E test coverage. All non-critical functionality is covered by Unit Tests, Integration Tests, and Contract Tests at sufficient fidelity.

**Traceability:** The twelve E2E journeys are derived from ASS-002 use cases and represent the primary value-delivering paths through the system. See TEST-SPEC-004 for the complete list.

### Principle 6: Performance Tests for All Bulk Operations

Any operation that touches more than 1,000 rows in the underlying persistence layer MUST have a performance benchmark test. This includes financial report generation (UC-RPT-01), bulk member searches (UC-RES-Q01), hierarchy traversal for deep org units (UC-ORG-Q02), and sync batch operations (UC-SYNC-01, UC-SYNC-02).

Performance tests measure:
- p95 latency
- p99 latency
- Memory footprint under sustained load
- Connection pool utilization
- Query plan efficiency (index usage confirmed)

**Traceability:** Performance budgets in TEST-SPEC-006 define measurable targets for each operation category.

### Principle 7: Security Tests for All Authorization Boundaries

Every RBAC role permutation documented in API-CONTRACT-004 MUST have an authorization test verifying that the role can or cannot perform the claimed action. This covers the complete permission matrix across all 83 operations. For operations with multiple authorized roles, each role is tested individually — not as a group.

Security tests cover:
- Authentication boundary: unauthenticated access rejected
- Authorization boundary: unauthorized role rejected, authorized role accepted
- Multi-tenant isolation: org A cannot read org B data
- RLS policies: Row-Level Security correctly filters queries by org_id
- Audit trail: mutations produce immutable log entries (AUD-001)

**Traceability:** RBAC roles from API-CONTRACT-004; RLS policies from RLS-POLICY-SPECIFICATION-V1.md; audit invariants from DOC-015 (AUD-001, AUD-002, RETENTION-031, ACCESS-033).

---

## SECTION 2: TEST LEVELS AND THEIR RESPONSIBILITIES

Four distinct test levels exist, each with a clear scope, ownership, and purpose. No test belongs to more than one level — ambiguity between levels is a design defect.

### Level 1: Unit Tests

| Attribute | Specification |
|-----------|--------------|
| **What is tested** | Individual Aggregate boundary methods, Value Object validation, pure domain functions, invariant guards |
| **Primary source** | DOC-015 (Domain Invariant Registry), DOC-012 (Canonical Domain Model) |
| **Who writes** | Developer during Test-Driven Development |
| **Scope** | Single Aggregate, zero external dependencies (mocked only), no database, no network |
| **Prerequisites** | Aggregate domain model loaded (spec-defined); ClockPort available for timestamp control |
| **Test data** | In-memory Aggregate instances constructed with known-good and known-bad inputs |
| **Assertions** | Domain events emitted or not emitted; exception raised for invariant violations; value object constraints enforced |
| **Maximum duration** | 1 millisecond per individual test (aggregate method execution) |
| **Total execution budget** | Less than 30 seconds for all unit tests combined |
| **Execution frequency** | On every commit; required for merge approval |

Unit tests cover:
- All 58 invariants × 2 scenarios (respect + violation) = minimum 116 tests
- Value Object construction and constraint enforcement for all entity types
- Aggregate state machine transitions (draft→pending→approved, active→inactive, etc.)
- Command parameter validation at the boundary (non-null, range checks, enum membership)
- Event emission correctness (correct event type, correct payload fields)
- Pure functions: BalanceCalculator, PeriodValidator, RetentionManager, RateLimitEnforcer, QuietHoursPolicy

### Level 2: Integration Tests

| Attribute | Specification |
|-----------|--------------|
| **What is tested** | Complete Command flow (Request → Service → Aggregate → Persistence → Response), event chains, cross-aggregate workflows, saga compensation |
| **Primary source** | ASS-002 (Use Case Catalog), ASS-003 (Workflow Patterns), ASS-004 (Cross-Aggregate Coordination) |
| **Who writes** | Developer during implementation |
| **Scope** | Application Services layer + Aggregate domain layer + Repository ports. Database connection required. |
| **Prerequisites** | Isolated database transaction per test (or separate test schema). Event bus abstraction available. |
| **Test data** | Seeded with Organization model + representative users + roles. Cleanup via post-test transaction rollback. |
| **Assertions** | Final state matches expected; correct domain events emitted; no invariant violations unless intentionally triggered; saga compensation restored previous state |
| **Maximum duration** | 10 seconds per individual test |
| **Total execution budget** | Less than 2 minutes for all integration tests combined |
| **Execution frequency** | On every commit; required for merge approval |

Integration tests cover:
- All 57 Commands from DOC-014 (minimum 1 test per command)
- Event chain verification: Command triggers Aggregate → emits Events → subscribers process Events
- Cross-aggregate flows per ASS-004 coordination matrix (all 9 patterns)
- Saga compensation: when downstream step fails, upstream work is rolled back
- Idempotence verification for operations marked idempotent in ASS-003

Estimated quantity: 83 operations × approximately 3 scenarios each = minimum ~250 integration tests.

### Level 3: Contract Tests

| Attribute | Specification |
|-----------|--------------|
| **What is tested** | API input/output pairs match API-contract specifications for every protocol adapter |
| **Primary source** | API-CONTRACT-001 (API Spec), API-CONTRACT-002 (Response Schema), API-CONTRACT-005 (Error Taxonomy) |
| **Who writes** | Developer or Quality Engineer |
| **Scope** | API boundary: request serialization/deserialization, response structure, error code mapping |
| **Prerequisites** | Protocol adapter implementation available (REST, GraphQL, gRPC, CLI, Webhook) |
| **Test data** | Representative inputs for each operation, covering valid, boundary, and invalid cases |
| **Assertions** | Response matches contract schema; error codes map correctly to API-CONTRACT-005 taxonomy; protocol-specific serialization/deserialization is lossless |
| **Maximum duration** | 1 second per individual test |
| **Total execution budget** | Less than 1 minute for all contract tests combined |
| **Execution frequency** | On every commit; required for merge approval |

Contract test matrix by protocol:

| Protocol | Adapter Source | Contracts Validated |
|----------|---------------|---------------------|
| REST | PROTO-002 | HTTP status codes, JSON body structure, error response format |
| GraphQL | PROTO-003 | Schema definitions, query/mutation structure, error formatting |
| gRPC | PROTO-004 | Proto message definitions, status codes, streaming behavior |
| CLI | PROTO-005 | Command argument parsing, exit codes, output formatting |
| Webhook | PROTO-006 | Payload structure, retry behavior, signature verification |

For each of the 83 operations × 5 protocols = minimum 415 contract tests. Some operations may have protocol-specific exclusions (e.g., Webhook adapter does not expose read-only queries), but the specification remains framework-agnostic.

### Level 4: End-to-End Tests

| Attribute | Specification |
|-----------|--------------|
| **What is tested** | Complete user journeys from authentication through business outcome |
| **Primary source** | ASS-002 (Use Cases sequenced into journeys), TEST-SPEC-004 (E2E Test Rules) |
| **Who writes** | Quality Engineer or dedicated E2E specialist |
| **Scope** | Full application stack: UI/CLI input → API → Application Services → Domain → Persistence → Event bus → Observable outcome |
| **Prerequisites** | Staging environment matching production as closely as possible. Real database. Real auth flow. Real offline sync simulation. |
| **Test data** | Realistic organization, members, transactions, workflow instances seeded in staging |
| **Assertions** | Journey completes successfully; all side effects present (notifications sent, audit entries created, sync status updated) |
| **Maximum duration** | 30 seconds per individual journey scenario |
| **Total execution budget** | Less than 5 minutes for all E2E smoke tests combined |
| **Execution frequency** | Before each release; not on every commit |

E2E tests cover exactly the 12 critical user journeys defined in TEST-SPEC-004. No additional E2E scenarios exist. This is a deliberate constraint — every request to add a new E2E journey must be evaluated against the cost/maintenance burden and converted to a lower-level test where possible.

---

## SECTION 3: COVERAGE REQUIREMENTS

Minimum coverage thresholds are defined per architectural layer. These are not aspirational — they are gate conditions. Below-threshold coverage blocks merge, regardless of urgency.

### 3.1 Domain Layer (DOC-012) Coverage

| Requirement | Minimum | Measurement |
|-------------|---------|-------------|
| All 58 invariants have ≥ 1 passing unit test | 58/58 (100%) | TEST-SPEC-002 invariant test matrix |
| All 58 invariants have ≥ 2 tests (respect + violation) | 116 unit tests minimum | Per-invariant dual-scenario matrix |
| All Value Objects have constructor and constraint tests | 100% of VO classes | Value Object catalog traceability |
| All Aggregate boundary methods have state transition tests | 100% of boundary methods | DOC-012 boundary method registry |
| All pure functions have input/output tests | 100% of pure functions | DOC-015 guard function registry |

### 3.2 Application Services Coverage

| Requirement | Minimum | Measurement |
|-------------|---------|-------------|
| All 83 operations have ≥ 1 integration test | 83/83 (100%) | TEST-SPEC-003 integration test catalog |
| All 57 Commands have integration test | 57/57 (100%) | DOC-014 command registry |
| All 26 Queries have integration test | 26/26 (100%) | DOC-014 query registry |
| All workflow patterns (linear, fan-out, saga) tested | 3/3 (100%) | ASS-003 workflow classification table |
| All cross-aggregate coordination patterns tested | 9/9 (100%) | ASS-004 coordination matrix |

### 3.3 API Contracts Coverage

| Requirement | Minimum | Measurement |
|-------------|---------|-------------|
| All 83 operations have ≥ 1 contract test per protocol | 415 contract tests minimum | TEST-SPEC-003 contract test matrix |
| All error codes from API-CONTRACT-005 are exercised | 100% of error codes | Error code taxonomy traced to use case error responses |
| All 5 protocol adapters validated | 5/5 protocols | TEST-SPEC-003 contract coverage by adapter |
| Response schema validation for all operations | 100% of operations | API-CONTRACT-002 response schemas |

### 3.4 Data Layer Coverage

| Requirement | Minimum | Measurement |
|-------------|---------|-------------|
| All 35 migrations have post-application verification test | 35/35 (100%) | Migration verification from TRR-V1.2 |
| All 32 tables' RLS policies have multi-tenant isolation test | 32 tables × 9 roles (288 policy permutations minimum) | RLS-POLICY-SPECIFICATION-V1.md Section 3.x |
| All 22 indexes with org_id verified for query plan efficiency | 22/22 (100%) | INDEX verification |
| All 10 inherited org_id references verified for traversal path | 10/10 (100%) | TRR-V1.2 §M-008 inheritance documentation |
| All bootstrap scripts (000-003) have post-condition verification | 4/4 (100%) | Bootstrap verification spec |

### 3.5 Security Coverage

| Requirement | Minimum | Measurement |
|-------------|---------|-------------|
| All RBAC roles tested for each operation's permission boundary | 83 ops × 9 roles × 2 outcomes (allowed/denied) = minimum search space coverage per operation | API-CONTRACT-004 RBAC matrix |
| All session management scenarios tested (create, refresh, revoke, expire, concurrent) | 100% of session lifecycle states | DOC-014 IdentityAggregate events |
| Input validation test coverage for injection attacks | 100% of string input fields | SQL injection, XSS, NoSQL pattern coverage |
| Secret management verified (no hardcoded secrets in tests) | 100% of test configurations scanned | Security scan pipeline check |
| Audit trail completeness verified for all mutation operations | 57 commands × 1 audit entry = 57 audit trail assertions | TEST-SPEC-007 AUD-001, OLDNEW-002, RETENTION-031 |

---

## SECTION 4: TEST DATA STRATEGY

### 4.1 Seed Data Model

All test suites share a common seed data foundation:

| Entity | Purpose | Content |
|--------|---------|---------|
| Organization (model) | Foundation tenant for all tests | org_id, name="TestOrg", type=church, settings={} |
| SuperAdmin user | Test infrastructure operations | Email: superadmin@lumina.test, hashed password |
| Admin user | Test admin operations | Email: admin@lumina.test, role=admin |
| Treasurer user | Test finance operations | Email: treasurer@lumina.test, role=treasurer |
| Pastor user | Test approval operations | Email: pastor@lumina.test, role=pastor |
| Staff user | Test read operations | Email: staff@lumina.test, role=staff |
| Organization Units | Hierarchy for relationship tests | parent-child depth up to 5 levels |
| Vocabulary terms | Category reference for financial tests | Pre-populated namespace with approved values |

Each aggregate also receives aggregate-specific seed data:
- ResourceAggregate: draft/approved/rejected transactions, member records
- WorkflowAggregate: pending/completed/failed workflow instances
- NotificationAggregate: user preferences with various channel settings
- OfflineSyncAggregate: pending operations, conflict scenarios

### 4.2 Test Isolation

Every test runs in its own isolated context. The isolation mechanism depends on the test level:

| Test Level | Isolation Mechanism | Rollback Strategy |
|------------|-------------------|-------------------|
| Unit | Pure in-memory. Zero shared state. | N/A — no persistence |
| Integration | Separate database transaction per test | Automatic rollback after test completion |
| Contract | Protocol-layer mocking of service endpoints | Stateless — no shared state |
| E2E | Isolated staging instance or dedicated schema | Full schema truncation between journeys |

Key isolation rules:
- `org_id` is always injected per test context. No test shares another test's organization.
- User credentials are generated programmatically (unique email suffix per test run).
- Time-dependent tests use a mockable ClockPort — never the system clock.

### 4.3 Cleanup Policy

Post-test cleanup is automatic and mandatory:

1. **Unit tests:** No cleanup needed (in-memory only, GC handles disposal).
2. **Integration tests:** Transaction rollback at test teardown. If rollback is impossible (schema modification tests), explicit DELETE for all entities created during the test, scoped by org_id.
3. **Contract tests:** No cleanup needed (stateless protocol verification).
4. **E2E tests:** Schema truncation of all 32 tables after each journey, in topological order (referenced tables before referencing tables). PostgreSQL CASCADE on foreign keys handles orphan cleanup.

### 4.4 Sensitive Data Handling

Strict rules govern sensitive data in tests:

- Passwords are NEVER stored as plain text. Always hashed (bcrypt/scrypt/argon2 equivalent) using the same hash function as production.
- Credentials (API keys, tokens) are injected via environment variables or test configuration files that are excluded from version control.
- Real phone numbers and email addresses are used only in test form — fake local domain (@lumina.test), fake national prefixes.
- Payment amounts use BIGINT cents representation exactly as production, never floating-point decimals.
- No real user data from production environments is ever copied to test datasets.

---

## SECTION 5: TEST AUTOMATION PIPELINE

### 5.1 Pipeline Architecture

The test automation pipeline executes in strict sequential order. Each stage gates the next — a failure at any stage halts the pipeline.

```
Code Commit
    │
    ▼
┌─────────────────────┐
│ Stage 1: Unit Tests  │  ◄── Domain layer only. Fastest execution.
│   (≤ 30 seconds)     │
└─────────┬───────────┘
          │ PASS only
          ▼
┌──────────────────────────┐
│ Stage 2: Integration Tests│  ◄── Application services + persistence
│   (≤ 2 minutes)           │
└─────────┬────────────────┘
          │ PASS only
          ▼
┌─────────────────────────┐
│ Stage 3: Contract Tests  │  ◄── API boundary for all 5 protocols
│   (≤ 1 minute)           │
└─────────┬───────────────┘
          │ PASS only
          ▼
┌──────────────────────────┐
│ Stage 4: E2E Smoke Tests │  ◄── 12 critical journeys only
│   (≤ 5 minutes)          │
└─────────┬────────────────┘
          │ PASS only
          ▼
┌──────────────────────────┐
│ Stage 5: Performance Tests │ ◄── Bulk operations, load scenarios
│   (variable, gated)       │
└─────────┬────────────────┘
          │ PASS only
          ▼
┌──────────────────────────┐
│ Stage 6: Security Scan   │ ◄── Dependency check, secret detection,
│                          │    authorization boundary verification
└─────────┬────────────────┘
          │ PASS only
          ▼
         Merge Approved
```

### 5.2 Pipeline Execution Thresholds

| Stage | Maximum Duration | Retry Policy | Fail Action |
|-------|-----------------|--------------|-------------|
| Unit Tests | 30 seconds total | 1 retry (transient) | Block merge |
| Integration Tests | 2 minutes total | 1 retry (transient) | Block merge |
| Contract Tests | 1 minute total | No retry (deterministic) | Block merge |
| E2E Smoke Tests | 5 minutes total | 1 retry (flakiness) | Block release |
| Performance Benchmarks | Gated (pre-release) | N/A | Report degradation |
| Security Scan | 3 minutes max | No retry | Block merge if CRITICAL |

### 5.3 Execution Triggers

| Trigger | Stages Executed | Frequency |
|---------|----------------|-----------|
| Git push to feature branch | Stages 1-3 (Unit, Integration, Contract) | Every commit |
| Pull Request open/review | Stages 1-4 (adds E2E smoke) | Before merge |
| Release tag created | All stages 1-6 (full suite) | Before release |
| Scheduled nightly | Stages 1-5 (adds Performance) | Nightly on main |

---

## SECTION 6: QUALITY GATES

The following conditions MUST all be satisfied before any commit, push, or merge to the default branch is permitted. These gates are automated pipeline checks — manual override requires documented justification and sign-off.

### Gate 1: Unit Test Completeness

- All 58 invariants from DOC-015 have ≥ 2 passing unit tests (respect + violation).
- Zero regression on existing invariant tests. Any invariant test change requires review by at least one additional developer.
- Unit test suite executes in ≤ 30 seconds total.

### Gate 2: Integration Test Completeness

- All 83 operations from ASS-002 have ≥ 1 passing integration test.
- All cross-aggregate coordination patterns from ASS-004 have integration test coverage.
- Integration test suite executes in ≤ 2 minutes total.

### Gate 3: Contract Test Completeness

- All 83 operations have contract test coverage for the protocol being validated.
- All error codes from API-CONTRACT-005 are exercised at least once (positive assertion that the error is returned).
- Contract test suite executes in ≤ 1 minute total.

### Gate 4: Zero Regression

- All previously passing tests continue to pass.
- No invariant test changes detected without explicit reason documentation.
- No API contract regression (response schema unchanged without version bump).

### Gate 5: Performance Budget Compliance

- No bulk operation exceeds its performance budget (from TEST-SPEC-006).
- No degradation > 10% compared to baseline measurements.
- If performance degrades between 5% and 10%, merge is allowed with documented exception and a follow-up investigation ticket.

### Gate 6: Security Scan Clean

- Zero CRITICAL findings from dependency vulnerability scan.
- Zero hardcoded secrets detected in test code or configuration.
- All RBAC authorization boundaries pass their respective tests (allowed roles succeed, denied roles fail).
- RLS policy isolation verified: org A data never appears in org B results.

### Gate 7: Test Data Hygiene

- No plain-text passwords in any test fixture.
- No production data used in tests.
- Test cleanup executed successfully after all test suites (no dangling state affecting subsequent runs).

---

## APPENDIX A: TEST COVERAGE TRACEABILITY MATRIX

This appendix provides the cross-reference between canonical documents and test levels. Every entry below represents a testing obligation.

| Source Document | Document Section | Target Artifact Tested | Test Level(s) | Coverage Metric |
|----------------|----------------|----------------------|---------------|----------------|
| DOC-015 | All 58 invariants | Domain invariant guard functions | Unit | 58 invariants × 2 scenarios |
| DOC-014 | All 70 Commands | Command flow through Application Services | Integration | 70 commands × 1+ test |
| DOC-014 | All 60+ Events | Event emission and consumer processing | Integration | Events emitted per command verified |
| DOC-012 | All 13 Aggregate boundaries | Aggregate state transitions | Unit | All boundary methods covered |
| ASS-002 | All 83 Use Cases | End-to-end operational correctness | Integration + Contract | 83 operations × 1+ test |
| ASS-003 | Workflow patterns | Linear, fan-out, saga patterns | Integration | 3 patterns × multiple use cases |
| ASS-004 | 9 coordination patterns | Cross-aggregate event propagation | Integration | 9 patterns × 1+ test |
| API-CONTRACT-001 | API operations | Request/response correctness | Contract | 83 ops × 5 protocols |
| API-CONTRACT-002 | Response schemas | Serialization fidelity | Contract | All response types validated |
| API-CONTRACT-005 | Error taxonomy | Error code mapping | Contract | 50+ error codes asserted |
| RLS-POLICY-SPECIFICATION-V1.md | 32 tables, 9 roles | Row-level security enforcement | Security (integration) | 32 tables × 9 roles |
| MIGRATION-PACK-V1.md | 35 migrations | Post-migration verification | Integration | 35 migrations × 1+ test |
| BOOTSTRAP-MICRATION-SPECIFICATION-V1.md | 4 scripts (000-003) | Bootstrap pre/post conditions | Integration | 4 scripts × verification |

---

## APPENDIX B: EXCEPTION PROCESS

When a test requirement in this document cannot be met due to technical constraints, the following exception process applies:

1. **Identify the gap:** Document which requirement cannot be met and why.
2. **Assess risk:** Evaluate the impact of missing test coverage on system reliability, security, and correctness.
3. **Propose alternative:** Suggest compensating controls (code review intensity increase, manual verification, monitoring alerts).
4. **Request approval:** Submit exception to the architecture review process with full justification.
5. **Set expiration:** All exceptions are time-boxed. A remediation task must be created with a target date for closing the gap.
6. **Log permanently:** Accepted exceptions are recorded as Architectural Observation Records and referenced in this document's compliance tracking.

Exceptions are treated as technical debt, not permanent states. Each quarter, all active exceptions are reviewed for closure.

---

## APPENDIX C: DOCUMENT REVISION HISTORY

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v1.0 | 2026-07-25 | Agnes-2.0-Flash (Sapiens AI) | Genesis definition of test strategy from canonical source documents |

---

*This test strategy is defined by genesis. It establishes the global framework for all subsequent test specification documents (TEST-SPEC-002 through TEST-SPEC-008). Every subsequent test specification MUST comply with the principles, levels, coverage requirements, pipeline architecture, and quality gates defined herein.*

*FIN DU DOCUMENT TEST-SPEC-001*
