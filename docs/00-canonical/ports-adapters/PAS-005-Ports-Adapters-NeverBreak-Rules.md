# Ports and Adapters NeverBreak Rules

**Doc ID:** PAS-005
**Version:** v1.0
**Statut:** SPECIFICATION CANONIQUE DEFINIE PAR GENESIS — REGLES CONSTITUTIONNELLES
**Date:** 2026-07-25
**Generateur :** ports-adapters-specifier v1.0
**Source canonique :** ["DOC-012", "DOC-013", "DOC-014", "DOC-015", "DOC-017", "DOC-018", "PAS-001", "PAS-002", "PAS-003"]
**Transformation_rule :** "ports-adapters-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines **10 constitutional NeverBreak rules** governing Ports and Adapters in the Lumina architecture. These rules are immutable. Any violation constitutes an architectural breach requiring immediate correction and ADR documentation following DOC-008's amendment pipeline.

Violation of any PA-NB rule is a **CRITICAL** severity finding. It cannot be ignored, deferred, or "fixed later." It must be fixed immediately because it undermines the entire hexagonal architecture foundation that every other layer depends on.

---

## PA-NB-001: NeverBreak-PortPurity

A Port MUST NEVER contain technology-specific types, return values, or error handling. Ports describe WHAT the system needs, never HOW it is achieved.

**Scope**: All 17 Ports defined in PAS-001.

**Verifiable assertion**: No SQL, no JSON, no HTTP status codes, no cryptographic algorithm names, no framework-specific type annotations, no ORM entity attributes appear in any Port specification defined in PAS-001. Port method signatures use abstract domain types, primitive values, structured DTOs, and generic collections only.

**Prohibited patterns in any Port**:
- Method returning HTTP response objects or status codes
- Parameter accepting or returning raw JSON strings (should accept structured DTOs)
- Error codes containing protocol-specific prefixes (e.g., "HTTP_500", "SQL_ERROR")
- Type references to database engines, cache implementations, message queue systems
- Return types like "ResultSet," "RowIterator," "Cursor" — should be "List<Entity>" or equivalent

**If violated**: The Port specification contains technology leakage. Rewrite to remove all technology-specific references while preserving the functional contract.

---

## PA-NB-002: NeverBreak-AdapterLooseCoupling

An Adapter MUST BE replaceable without modifying any consumer code. All consumers must interact exclusively through the Port interface.

**Scope**: Every Adapter Category defined in PAS-002 implementing any Port from PAS-001.

**Verifiable assertion**: Swapping adapter A for adapter B (from PAS-002's category table for the same Port) requires zero changes to Application Service code, Domain code, or API Layer code. The only file that changes is the composition root configuration in the Runtime Assembly layer.

**Prohibited patterns in any Adapter**:
- Adapter returns concrete domain types instead of abstract port-compatible types
- Adapter modifies input parameters before passing to the Port interface (surprising side effects)
- Adapter exposes infrastructure-level error messages directly to consumers
- Adapter implementation class name leaked to consumer code (e.g., `new PostgresRepositoryAdapter()`)

**If violated**: Consumer code is coupled to a specific adapter. Refactor to ensure consumers depend only on the Port interface.

---

## PA-NB-003: NeverBreak-BusinessLogicLocation

NEITHER a Port NOR an Adapter may contain business logic. All rules live exclusively in Aggregates (DOC-012) and invariant guards (DOC-015).

**Scope**: All Ports in PAS-001 and all Adapter Categories in PAS-002.

**Verifiable assertion**: grep for business rule patterns (state machines, financial calculations, validation logic beyond schema type-checking) in any Port or Adapter specification returns zero matches. Business rules such as "amount must be positive BIGINT," "email unique per org," "depth <= 5," "approval chain <= 5 levels" exist ONLY in Aggregate definitions (DOC-012), NOT in any Port or Adapter.

**What Adapters MAY validate (non-business)**:
- Schema type correctness (is this value a valid UUID format?)
- Required field presence (is the field null when it shouldn't be?)
- Serialization format validity (can this object be serialized/deserialized?)
- Transport-level constraints (maximum payload size, rate limiting at network level)

**What is FORBIDDEN in Adapters and Ports**:
- Financial calculations (summing amounts, computing balances, converting currencies)
- State machine transitions (draft→pending→approved logic)
- RBAC permission evaluation logic
- Workflow step advancement decisions
- Lifecycle state transition validation
- Org hierarchy depth calculation
- Password strength evaluation (beyond basic format check)

**If violated**: Business logic in a Port or Adapter means changing storage technology might inadvertently change business behavior. Extract all business rules back to their owning Aggregate.

---

## PA-NB-004: NeverBreak-DomainIsolation

No Port or Adapter may import, reference, or know about Domain layer internals. Ports should accept abstract types (Entity IDs, primitive values), never concrete Aggregate instances (except when passing them through RepositoryPort.save()).

**Scope**: All Port method signatures in PAS-001; all Adapter contracts in PAS-002.

**Verifiable assertion**: Port method signatures accept only primitive types (uuid, string, integer, boolean), structured DTOs, and generic collections. No direct Aggregate class names (OrganizationAggregate, ResourceAggregate, etc.) appear in Port specifications. When RepositoryPort.save() receives an entity, it accepts a Persistence Object — not a raw Aggregate instance with its internal domain methods exposed.

**Allowed exceptions**:
- RepositoryPort.save() receives a Persistence Object that was derived FROM a domain entity. This is a transformation, not a direct domain exposure.
- EventPublicationPort.publish() receives a Domain Event from DOC-014. Events are abstract contracts, not Aggregate internals.

**Prohibited patterns**:
- A Port method parameter typed as `TransactionRecord` (concrete entity from DOC-012) — should be `ResourcePersistenceObject` or equivalent abstract PO
- An Adapter calling a method on an Aggregate directly — should go through RepositoryPort.load() to get a PO first
- Port method signatures exposing VO types directly (e.g., `PasswordHash` from IdentityAggregate) — should expose only the hash value string or a generic credential DTO

**If violated**: Tight coupling between Ports/Adapters and specific Aggregates breaks swappability. Port consumers can inject mock Aggregates for testing only if Ports accept generic types.

---

## PA-NB-005: NeverBreak-NoFrameworkInAdapters

An Adapter specification must NOT declare any framework dependency. Any framework choice belongs to the Runtime assembly layer, not the Adapter specification.

**Scope**: All Adapter Categories defined in PAS-002.

**Verifiable assertion**: No Spring, Hibernate, EF Core, Prisma, Sequelize, SQLAlchemy, JDBC, PDO, OrmLite, Dapper, Laravel Eloquent, Django ORM, or any other framework/library name appears in adapter category descriptions. Framework choices are made at the Runtime composition root layer and wired into Adapters through dependency injection — they are never part of the Adapter's specification.

**Adapter categories describe**:
- WHAT the adapter does (stores data in a relational store)
- WHEN to use it (when strong consistency is required)
- Its characteristics (ACID transactions, structured queries)

**Adapter categories must NOT describe**:
- HOW it uses a specific ORM framework
- Which framework handles connection pooling
- Which library provides migration scripts
- Which tool generates model classes

**If violated**: The Adapter specification binds development teams to a specific framework, preventing framework migration without rewriting the specification itself.

---

## PA-NB-006: NeverBreak-EventConsistency

The EventPublicationPort preserves the exact event payload defined in DOC-014. Adapters MUST NOT modify, filter, or truncate event data during publication.

**Scope**: EventPublicationPort (Port-002) and all its Adapter Categories in PAS-002.

**Verifiable assertion**: Event payloads flowing through EventPublicationPort match the structure documented in DOC-014 for each event type exactly. No fields are added, removed, renamed, or truncated during publication. Every event subscriber receives the identical payload that the emitting Aggregate produced.

**Prohibited adapter behaviors**:
- Filtering out certain event fields "because they aren't useful"
- Adding enrichment data not defined in DOC-014
- Truncating long-form text fields to fit message bus size limits silently (must throw or reject)
- Changing event type names (e.g., "UserLoggedIn" → "user.logged_in" — if mapping is needed, it must be a reversible transformation applied consistently)
- Dropping events "to reduce traffic" (violates at-least-once delivery guarantee)

**If violated**: Event consumers may receive incomplete data, leading to inconsistent downstream state. Audit logs might miss entries; sync queues might lose pending operations; notification dispatchers might not trigger.

---

## PA-NB-007: NeverBreak-RepositoryAbstraction

The RepositoryPort accepts Entity types from the Domain but returns them ALONE through the Port boundary. The adapter layer adds persistence metadata; consumers never see persistence metadata.

**Scope**: RepositoryPort (Port-001) and all its Adapter Categories in PAS-002.

**Verifiable assertion**: Loaded entities contain only Domain-defined attributes (from DOC-012). Persistence-specific fields (_persist_version, _sync_timestamp, _local_timestamp, _conflict_strategy, _tombstone, _purge_date, _log_sequence, _org_id, _sync_status, _created_by) are handled by the Adapter BEFORE exposing to consumers. The Consumer layer (Application Service) receives a clean domain entity with zero persistence metadata.

**Adapter responsibilities at the repository boundary**:
- Stripping _persist_version, _sync_timestamp, and other consistency metadata before returning to consumer
- Injecting _org_id, _persist_version onto entities before storing (consumer never sets these)
- Handling tombstone flag separation — soft-deleted entities filtered at adapter level, consumer never sees deleted data unless explicitly querying for archived items
- Transforming Persistence Objects to Domain Entities and vice versa (the round-trip conversion defined in DOC-018 Transition 2)

**If violated**: Domain entities leak persistence awareness, violating DR-007 (Persistence Ignorance). Changing the persistence layer would require modifying Domain code.

---

## PA-NB-008: NeverBreak-TenantIsolationAtPortLevel

Every Port that handles tenant-scoped data MUST include org_id as part of its interface contract. Adapters enforce org_id filtering.

**Scope**: RepositoryPort, NotificationPort, SearchPort, CachePort, FileStoragePort, VocabularyAccessPort, ConfigurationPort, and any Port touching data scoped to an organization.

**Verifiable assertion**: Every RepositoryPort method signature includes org_id parameter. Every NotificationPort.send() call includes user's org scope implicitly via userId resolution. Every SearchPort.search() includes org_id in the criteria. Every CachePort operation keys include org_id prefix. Every FileStoragePort operation includes org_id. Every VocabularyAccessPort operation includes org_id where applicable.

**org_id injection rules**:
- org_id is NEVER accepted as a raw user-input parameter
- org_id is resolved from the authenticated session context
- org_id is injected by the Application Service before calling any Port method
- Adapters do not extract org_id from request data; they receive it as a method parameter

**If violated**: Cross-org data leakage is possible. INV-004 (Multi-Tenant Isolation) becomes a trust-boundary assumption rather than an enforced invariant.

---

## PA-NB-009: NeverBreak-AdapterReplacementSafety

Every Port must have at least one in-memory adapter category defined so that automated tests can run without infrastructure.

**Scope**: All 17 Ports in PAS-001.

**Verifiable assertion**: Each Port definition in PAS-001 lists an In-Memory or in-process adapter category in PAS-002. Every Port has at least one adapter that requires no external dependencies (no database connection, no network socket, no file system access). This in-memory adapter uses process-local data structures (maps, lists) as its storage medium.

**In-memory adapter requirements**:
- Must implement ALL methods of the Port interface with identical signatures
- Must behave identically to the production adapter for all domain-correct inputs
- May return simplified results (no actual network calls, no actual file I/O)
- Must maintain correct error behavior (throwing equivalent exceptions for invalid inputs)

**Not satisfied by**:
- "Stub" adapters that only implement a subset of methods
- Test doubles that are hand-written mocks inside test files (must be defined in PAS-002 as a reusable category)
- Interfaces without any implementing category

**If violated**: Tests must spin up real infrastructure databases, caches, or message brokers. This increases test flakiness, slows CI pipelines, and couples tests to infrastructure availability.

---

## PA-NB-010: NeverBreak-TimeDeterminism

All timestamps flowing through ANY Port must be generated through ClockPort (PAS-001, Port-006). Adapters MUST NOT call system time directly.

**Scope**: All Ports in PAS-001, all Adapter Categories in PAS-002, all interaction flows in PAS-004.

**Verifiable assertion**: No system clock or datetime.now() calls exist within any Adapter category description or Port specification. All time originates from ClockPort.now(). Timestamps used in domain entities (created_at, updated_at, last_sync_at, purge_date calculations, quiet hours enforcement) all trace back to a single ClockPort instance selected at composition root time.

**Clock usage points across all flows**:
- Flow-001 (Write Command): ClockPort.now() sets created_at on new entities
- Flow-002 (Read Query): ClockPort.now() filters results by date range parameters
- Flow-005 (Event-Driven): ClockPort.now() timestamps event processing
- Flow-006 (Async Polling): ClockPort.now() schedules next polling interval
- Flow-007 (Identity Auth): ClockPort.now() sets session expiresAt and loginTimestamp

**Test configuration**: In automated tests, ClockPort is replaced with a Controlled/Fixed Clock adapter providing a deterministic timestamp.

**If violated**: Test outcomes become time-dependent. A test passing at 10:00 AM might fail at 11:00 AM if timestamps affect business logic (e.g., session expiry, quiet hours, retention periods).

---

## NEVERBREAK RULES COMPLIANCE SUMMARY

| Rule ID | Title | Scope | Verifiable By |
|---------|-------|-------|--------------|
| PA-NB-001 | PortPurity | All 17 Ports in PAS-001 | Grep Port specs for tech-specific types |
| PA-NB-002 | AdapterLooseCoupling | All adapter categories in PAS-002 | Swap test: replace adapter, verify consumer code unchanged |
| PA-NB-003 | BusinessLogicLocation | All Ports and Adapters | Grep Port/Adapter specs for business rule patterns |
| PA-NB-004 | DomainIsolation | All Port method signatures | Verify no Aggregate class names in Port specs |
| PA-NB-005 | NoFrameworkInAdapters | All Adapter Categories | Grep adapter descriptions for framework names |
| PA-NB-006 | EventConsistency | EventPublicationPort + adapters | Compare event payload in flow vs. DOC-014 schema |
| PA-NB-007 | RepositoryAbstraction | RepositoryPort + adapters | Verify persistence metadata stripped at Port boundary |
| PA-NB-008 | TenantIsolationAtPortLevel | All tenant-scoped Ports | Verify org_id in every method signature |
| PA-NB-009 | AdapterReplacementSafety | All 17 Ports | Verify each Port has >=1 in-memory adapter in PAS-002 |
| PA-NB-010 | TimeDeterminism | All Ports and Flows | Verify ClockPort.now() is the sole timestamp source |

**Total: 10 NeverBreak rules.** All verifiable by automated static analysis or manual inspection. Violation = CRITICAL severity = immediate fix required.
