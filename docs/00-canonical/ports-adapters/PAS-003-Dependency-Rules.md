# Canonical Dependency Rules

**Doc ID:** PAS-003
**Version:** v1.0
**Statut:** SPECIFICATION CANONIQUE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** ports-adapters-specifier v1.0
**Source canonique :** ["DOC-000", "DOC-012", "DOC-013", "DOC-014", "DOC-017", "ASS-001", "ASS-003"]
**Transformation_rule :** "ports-adapters-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **canonical dependency rules** of the hexagonal architecture for Lumina. These rules dictate which layers may depend on which other layers, in what direction dependencies flow, and what patterns are enforced at each layer boundary.

Violation of any rule in this document constitutes an architectural breach requiring immediate correction and ADR documentation.

---

## LAYER HIERARCHY (from innermost to outermost)

```
LAYER 1: Domain Layer (Aggregates, Entities, Value Objects, Domain Events, Domain Exceptions)
    ↑ depends on
LAYER 2: Application Service Layer (Service orchestration methods, input validation, event delegation)
    ↑ depends on
LAYER 3: Port Layer (Abstract interfaces defined by Domain/AppServices)
    ↑ depends on
LAYER 4: Adapter Layer (Concrete implementations of Ports using Infrastructure)
    ↑ depends on
LAYER 5: Infrastructure Layer (Databases, file systems, external APIs, network protocols)
```

Dependency arrows point UP — lower layers depend on higher layers. No dependencies flow downward.

---

## DR-001: Domain Independence

The Domain layer MUST NEVER depend on any Port, Adapter, or Infrastructure component.

**Domain layer consists ONLY of:**
- Aggregates (from DOC-012) with their Entities and Value Objects
- Domain Services (stateless, pure business logic: OrgHierarchyResolver, PasswordValidator, etc.)
- Domain Exceptions (typed error types for invariant violations)
- Domain Events (from DOC-014 registry)
- Policies applied within Aggregate boundaries

**Verifiable assertion:** No import, reference, or call into any package/module labeled "ports" or "adapters" exists within the Domain layer. Scanning all files in the Domain layer for references to infrastructure interfaces yields zero matches.

**Consequence of violation:** If a Domain method requires data from outside the Aggregate boundary, that data must be passed as a parameter (not fetched internally), or the logic belongs in an Application Service instead.

---

## DR-002: Application Service Dependency Direction

Application Services depend ONLY on Ports (abstract contracts). They must NEVER depend on concrete Adapter implementations.

**Application Service consists ONLY of:**
- Service orchestration methods that coordinate Aggregate operations
- Input validation delegates that forward validated DTOs to Aggregate commands
- Aggregate command/query invocation
- Event publication delegation to EventPublicationPort
- Response mapping from Aggregate state to API contract format
- Error translation from domain exceptions to API error codes

**Verifiable assertion:** Every method in an Application Service calls either an Aggregate method or a Port interface. No direct Adapter instantiation exists. No new operator references a concrete Adapter class.

**Consequence of violation:** If an Application Service instantiates a concrete adapter, it creates a compile-time coupling that prevents adapter swapping without modifying service code.

---

## DR-003: Adapter Implementation Rule

Adapters implement Ports. An Adapter may depend on Infrastructure libraries but MUST NOT expose them to consumers.

**Adapters must follow:**
- **Dependency inversion:** consume Ports, do not produce them — an adapter class implements a Port interface; it does not define new Port interfaces
- **Single responsibility:** one adapter category per concrete class/factory — each adapter class maps to exactly one Row in PAS-002's category table
- **Transparency:** the consuming layer cannot tell which adapter is active — swapping RepositoryPort's in-memory adapter for a relational store adapter changes zero lines of application service code

**Verifiable assertion:** All concrete Adapter classes implement exactly one Port interface. No Adapter inherits from or mixes infrastructure code directly into the Domain. Interface definitions are in the Port layer, implementation details in the Adapter layer, infrastructure dependencies only in the Adapter implementation.

---

## DR-004: Runtime Assembly Responsibility

The Runtime layer is responsible for assembling Adapters to Ports. It decides which Adapter implements which Port at composition root time only.

**The Runtime layer contains:**
- Composition root / dependency injection setup (executed exactly once at startup)
- Adapter factory registration mapping each Port to its chosen Adapter category
- Port-to-Adapter binding configuration
- Cross-cutting concern wiring (logging adapters, retry policies, circuit breakers)
- Clock and UUID port instance selection (system clock vs controlled clock, random vs deterministic UUID)

**Verifiable assertion:** No application code references a runtime assembly configuration. The assembly happens exactly once at startup and is invisible to all subsequent code. The composition root is the sole location where concrete Adapter classes are instantiated and bound to Ports.

---

## DR-005: API Layer Isolation

The API layer uses ONLY Application Services. It does NOT directly call Ports or Adapters.

**API Layer contains:**
- Request parsing (into domain-request-like DTOs conforming to API-CONTRACT-001/002 schemas)
- Response formatting (from domain-response DTOs to API contract formats)
- Exception-to-error-code mapping per API-CONTRACT-005 (E-400-NNN through E-500-NNN)
- Authorization gateway (delegates to AuthorizationPort BEFORE calling Application Service)
- Input shape validation (required fields, type checks, enum ranges — pre-domain)

**Verifiable assertion:** API layer methods receive request data, transform to input DTOs, call Application Service methods, transform outputs back, map exceptions to error codes. Never instantiate Adapters. Never call Ports directly. The API layer is a thin shell wrapping Application Services.

---

## DR-006: No Inverted Dependencies

No component in a lower layer may import or reference a component from a higher or equal layer.

**Layer hierarchy (from outermost to innermost):**
1. Infrastructure Layer (databases, file systems, external APIs)
2. Adapter Layer (implements Ports using Infrastructure)
3. Port Layer (abstract interfaces, defined by Domain/AppServices)
4. Application Service Layer (orchestrates Aggregates via Ports)
5. Domain Layer (Aggregates, Entities, VOs, Events, Domain Exceptions)

**Verifiable assertion:** For every module/package/file, its dependencies point only to layers closer to the innermost (Domain) layer, never outward. An Infrastructure module imports only other Infrastructure modules or Adapter interfaces it implements. It never imports a Port interface (that's the Adapter's responsibility), never imports an Application Service, never imports a Domain class.

**Consequence of violation:** Inverted dependencies create circular dependencies or force higher-layer concepts to leak into lower layers, breaking hexagonal architecture purity.

---

## DR-007: Persistence Ignorance

Neither Aggregates nor Application Services know how data is stored, queried, or retrieved. They work exclusively through RepositoryPort.

**Verifiable assertion:** No SQL string literals, no ORM annotations, no query builder patterns, no database connection management in Domain or Application Service layers. All data access flows through RepositoryPort.save(), load(), findByCriteria() methods. Database schema design, indexing strategy, partition keys, and connection pooling are entirely outside the concerns of Domain and Application layers.

**Consequence of violation:** If storage technology changes (relational → document → event store), zero code in Domain or Application layers needs modification. Only the Adapter and Infrastructure layers change.

---

## DR-008: Event Boundary Respect

Domain Events are defined exclusively in DOC-014. Neither Ports nor Adapters invent new Event types. Application Services publish Events exclusively through EventPublicationPort.

**Verifiable assertion:** Every event published through EventPublicationPort maps to exactly one entry in DOC-014. No custom event classes outside the DOC-014 event registry exist. Domain Events are emitted by Aggregates during Command execution, never by Adapters or Infrastructure components. Infrastructure layers may emit technical events (row inserted, page split, checkpoint) — these are entirely separate from Domain Events and never leak into domain code.

**Consequence of violation:** If an Adapter introduces a new event type, downstream subscribers have no specification for the event's payload structure, consumers, or semantics. All event contracts are defined once and only once in DOC-014.

---

## DR-009: Tenant Isolation Enforcement

Every operation that accesses or stores tenant-scoped data MUST include org_id as part of its interface contract. Adapters enforce org_id filtering at the storage boundary.

**Scope:** This rule applies to RepositoryPort.save/load/delete/findByCriteria, NotificationPort.send, SearchPort.search, CachePort operations, FileStoragePort operations, and VocabularyAccessPort operations when returning data scoped to an organization.

**Verifiable assertion:** Every data access method signature includes org_id as an explicit parameter or as an immutable part of the context object that flows through the method chain. No data access method can operate without an org_id. org_id is never accepted as raw user input — it is always resolved from the authenticated session context and injected by the Application Service.

**Consequence of violation:** Without org_id enforcement at the port level, a cross-org data leak is possible through any data access path.

---

## DR-010: Clock Source Unification

All timestamps flowing through ANY Port must be generated through ClockPort (PAS-001, Port-006). Adapters and Infrastructure components MUST NOT call system time directly.

**Verifiable assertion:** No system clock or datetime.now() calls exist within any consumer-facing code path. The ClockPort instance selected at composition root provides time to all layers. Adapters receive time values as parameters; they do not generate their own timestamps. Test harnesses replace ClockPort with a fixed-time adapter to achieve deterministic outcomes.

**Consequence of violation:** If system time is called directly in a test scenario, outcomes become non-reproducible (a timestamp in the past vs. now changes behavior). ClockPort unification ensures test determinism.

---

## DR-011: No Business Logic in Ports or Adapters

NEITHER a Port NOR an Adapter may contain business logic. All rules live exclusively in Aggregates (DOC-012) and invariant guards (DOC-015).

**Business logic includes:** state machine transitions, financial calculations, validation logic beyond schema type-checking, RBAC permission resolution, workflow step advancement, lifecycle state transition rules.

**What Adapters MAY do (non-business):** schema type validation (is this a valid UUID format?), null checking (was required data omitted?), serialization/deserialization of domain objects, error translation (domain exception to infrastructure error), retry on transient failures, rate limiting at the transport level (distinct from application-level rate limits).

**Verifiable assertion:** grep for business rule patterns (state machines, financial calculations, validation logic beyond schema type-checking) in any Port or Adapter specification returns zero matches. All state transitions, financial computations, permission evaluations, and lifecycle rules reside in their respective Aggregate domain methods.

**Consequence of violation:** If business logic lives in an Adapter, changing the storage engine would require re-verifying that business rules were not accidentally embedded in persistence logic. All business logic is concentrated in Aggregates where it can be tested, audited, and governed.

---

## DR-012: Cross-Aggregate Coordination Via Events

Cross-aggregate coordination occurs ONLY through Domain Events published on the event bus or through read-only repository lookups. No Aggregate directly calls another Aggregate's methods.

**This rule is derived from ASS-004 (Cross-Aggregate Coordination Specification).** The 12 identified cross-aggregate interactions are:
1. ResourceAggregate → VocabularyAggregate (read-only reference)
2. ResourceAggregate → OrganizationAggregate (context resolution via org_id)
3. ResourceAggregate → OfflineSyncAggregate (event-driven push)
4. WorkflowAggregate → ResourceAggregate (event-driven approval reaction)
5. LifecycleAggregate → ResourceAggregate (reference validation)
6. OfflineSyncAggregate → ALL aggregates (fan-out monitoring)
7. NotificationAggregate → IdentityAggregate (user resolution)
8. FormAggregate → VocabularyAggregate (read-only term resolution)
9. ALL Aggregates → AuditAggregate (auto-logging)
10. OrganizationAggregate → RelationshipAggregate (event-driven hierarchy)
11. ResourceAggregate → IdentityAggregate (created_by context)
12. ReportingAggregate → ResourceAggregate (read-only query for balance calculation)

**Verifiable assertion:** No method call exists that crosses an Aggregate boundary directly. All cross-aggregate communication flows through EventPublicationPort → EventSubscriptionPort or through RepositoryPort.read-only lookups initiated by Application Services. The Application Service orchestrates multi-aggregate workflows but never invokes another Aggregate from within an Aggregate.

**Consequence of violation:** Direct cross-aggregate calls create tight coupling that breaks Aggregate boundaries, making independent testing, replacement, and evolution of Aggregates impossible.

---

## SUMMARY TABLE

| Rule ID | Title | Enforced By | Verifiable |
|---------|-------|-------------|------------|
| DR-001 | Domain Independence | Static analysis of Domain layer imports | Yes |
| DR-002 | Application Service Dependency Direction | Compilation unit inspection | Yes |
| DR-003 | Adapter Implementation Rule | Code review of adapter classes | Yes |
| DR-004 | Runtime Assembly Responsibility | Composition root isolation check | Yes |
| DR-005 | API Layer Isolation | API handler dependency scan | Yes |
| DR-006 | No Inverted Dependencies | Layer dependency graph analysis | Yes |
| DR-007 | Persistence Ignorance | Domain/Application code grep for SQL/ORM | Yes |
| DR-008 | Event Boundary Respect | Event type registry cross-reference | Yes |
| DR-009 | Tenant Isolation Enforcement | Method signature audit | Yes |
| DR-010 | Clock Source Unification | System clock call grep in non-infrastructure code | Yes |
| DR-011 | No Business Logic in Ports/Adapters | Grep for business rule patterns in Port/Adapter specs | Yes |
| DR-012 | Cross-Aggregate Coordination Via Events | Call graph analysis across Aggregate boundaries | Yes |

**Total: 12 Dependency Rules.** All verifiable by automated or manual inspection.
