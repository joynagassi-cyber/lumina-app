# Application Service NeverBreak Rules
**Doc ID:** ASS-005
**Version:** v1.0
**Statut:** SPECIFICATION CANONIQUE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** service-generator v1.0 (spec-only)
**Source canonique :** ["DOC-012", "DOC-013", "DOC-014", "DOC-015", "API-CONTRACT-001", "API-CONTRACT-004"]
**Transformation_rule :** "application-service-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

These are **constitutional rules** for the Application Service layer. Every Application Service specification in this document family (ASS-001 through ASS-004) must comply with every rule listed here. Violation of any rule is a BLOCKING error that prevents generation of implementation code.

Each rule has:
- A unique identifier (ASS-NB-NNN)
- A clear description of what is prohibited
- A verifiable assertion (how to automatically check compliance)
- The impact if violated

---

## ASS-NB-001 NeverBreak-DomainIsolation

Application services NEVER contain business logic. All business rules live exclusively in Domain Aggregates (DOC-012). An Application Service may only orchestrate Aggregate invocations.

- **Verifiable assertion**: No business rule validation code exists directly in the application service layer — all validations delegate to Aggregate methods.
- **Check method**: Scan every use case in ASS-002; verify that each Domain Step references an Aggregate boundary method, not inline validation logic.
- **Impact if violated**: Business logic becomes duplicated across layers; single source of truth breaks; invariant enforcement becomes inconsistent.

---

## ASS-NB-002 NeverBreak-InvariantPreservation

Application services NEVER modify domain invariants. Invariant enforcement happens exclusively within Aggregate boundary methods. The Application Service's role is to pass validated inputs through to the Domain — never to decide based on them.

- **Verifiable assertion**: Every invariant check referenced by an Application Service is performed inside an Aggregate method, never in the service layer.
- **Check method**: Cross-reference every invariant guard listed in ASS-002 with DOC-015. Verify that the guard is checked inside an Aggregate Expose method.
- **Impact if violated**: Domain invariants can be bypassed at the application layer, breaking data integrity guarantees.

---

## ASS-NB-003 NeverBreak-NoDirectPersistence

Application services NEVER read from or write to the database directly. All data access goes through Repository abstraction interfaces. No SQL, no ORM session management, no query builders.

- **Verifiable assertion**: No SELECT, INSERT, UPDATE, DELETE, or any SQL-like patterns exist in Application Service specifications.
- **Check method**: Verify all persistence references in ASS-002 point to "Repository abstraction" or "aggregate load/save via repository."
- **Impact if violated**: Coupling to a specific persistence technology; impossible to swap databases; breaks DDD isolation principle.

---

## ASS-NB-004 NeverBreak-NoAggregateBypass

Application services NEVER bypass Aggregate boundaries. Every command/query must flow through the appropriate Aggregate's boundary method (Expose pattern from DOC-013).

- **Verifiable assertion**: Every command from DOC-014 is invoked through exactly one Aggregate boundary — never directly on entities or value objects outside an Aggregate.
- **Check method**: For every operation in API-CONTRACT-001, verify it maps to exactly one Expose boundary entry in DOC-013.
- **Impact if violated**: Aggregate boundaries lose meaning; consistency invariants cannot be enforced; multi-tenant isolation breaks.

---

## ASS-NB-005 NeverBreak-ConceptCreation

Application services NEVER create new Concepts. All concepts must be catalogued in DOC-001 Element Registry.

- **Verifiable assertion**: Every entity, value object, and domain event referenced by an Application Service appears in DOC-001 or DOC-012.
- **Check method**: Extract all entity and VO names from ASS-002 use cases; cross-reference against DOC-012 entity/VO tables.
- **Impact if violated**: Architecture drift; undocumented domain model elements; loss of traceability.

---

## ASS-NB-006 NeverBreak-EventAuthenticity

Application services NEVER publish events that don't exist in DOC-014 (Domain Command-Event Registry). Events are emitted only when explicitly defined by Aggregate methods.

- **Verifiable assertion**: Every event published by every Application Service exists as an event entry in DOC-014.
- **Check method**: List all DomainEvents Emitted from every use case in ASS-002; verify each exists in DOC-014 event registry.
- **Impact if violated**: Event bus receives unknown events; downstream consumers break; event contract becomes unreliable.

---

## ASS-NB-007 NeverBreak-FrameworkIndependence

Application services NEVER depend on frameworks, languages, libraries, or infrastructure concerns. They operate in pure domain terms only.

- **Verifiable assertion**: No references to Spring, Express, Django, Hibernate, EF Core, or any other framework/language-specific construct appear in Application Service specs.
- **Check method**: Scan all spec documents for framework names, language keywords, HTTP status codes, JSON serialization details, dependency injection patterns.
- **Impact if violated**: Implementation is tied to a specific stack; re-generation for different tech stacks becomes impossible; determinism guarantee broken.

---

## ASS-NB-008 NeverBreak-TransactionBoundaries

Application services MUST NOT span database transactions across multiple Aggregate boundary operations unless explicitly coordinated through the Cross-Aggregate Coordination specification. Each Aggregate should maintain its own transaction boundary.

- **Verifiable assertion**: Multi-aggregate operations use the patterns defined in ASS-003 (Linear Orchestration, Parallel Fan-Out, Saga Compensation).
- **Check method**: Verify every cross-aggregate use case in ASS-003 classifies its coordination pattern. Confirm no use case spans two Aggregate writes in a single transaction.
- **Impact if violated**: Distributed transaction anti-pattern; lock contention across aggregates; single point of failure for multi-Aggregate operations.

---

## ASS-NB-009 NeverBreak-CommandEventTraceability

Every command processed by an Application Service must map to exactly ONE Command from DOC-014. Every event emitted must map to exactly ONE Event from DOC-014. One-to-one traceability is mandatory.

- **Verifiable assertion**: Every operation in ASS-002 has a clear DOC-014 source reference.
- **Check method**: For each UC-XXX entry in ASS-002, verify Command and Event fields reference exact DOC-014 registry entries. No invented commands/events.
- **Impact if violated**: Loss of traceability between specification and implementation; impossible to validate completeness.

---

## ASS-NB-010 NeverBreak-ReadsAreSideEffectFree

All query operations (read-side) must be functionally side-effect free. No state mutation, no logging, no audit trail creation through queries. Only write commands produce domain events and state changes.

- **Verifiable assertion**: Query operations documented in API-CONTRACT-001 are identified and verified to produce zero domain events.
- **Check method**: Count Domain Events Emitted for every QUERY-type use case in ASS-002. All must be empty or dash (—).
- **Impact if violated**: Read operations produce side effects → cache invalidation storms, audit log bloat, unexpected event cascade.

---

## ASS-NB-011 NeverBreak-ActorAuthorization

Every operation executed by an Application Service must be associated with an actor (user, service account, sync service) who holds appropriate permissions per API-CONTRACT-004 authorization mapping. Authorization checks happen BEFORE loading the Aggregate.

- **Verifiable assertion**: Every operation in ASS-002 has an RBAC role assignment from API-CONTRACT-004.
- **Check method**: Verify every use case in ASS-002 has an RBAC Roles field. Cross-reference with API-CONTRACT-004 role mappings.
- **Impact if violated**: Unauthorized users can execute operations; RBAC system bypassed; security hole at the application layer.

---

## ASS-NB-012 NeverBreak-TenantIsolation

All operations must enforce org_id isolation at the application level, regardless of what the persistence layer provides. The Application Service resolves org_id from the authenticated context before loading any Aggregate.

- **Verifiable assertion**: Every operation in ASS-001-ASS-004 requires org_id resolution before Aggregate loading.
- **Check method**: Verify every Command and Query type use case has org_id in its preconditions chain. No operation accepts org_id as user input.
- **Impact if violated**: Cross-org data leakage; multi-tenant isolation completely broken; GDPR/compliance violation.

---

## COMPLIANCE SUMMARY

| Rule ID | Rule Name | Verifiable | Status |
|---------|-----------|-----------|--------|
| ASS-NB-001 | Domain Isolation | Code scan for business logic | COMPLIANT |
| ASS-NB-002 | Invariant Preservation | Cross-ref guards → DOC-015 | COMPLIANT |
| ASS-NB-003 | No Direct Persistence | Scan for SQL patterns | COMPLIANT |
| ASS-NB-004 | No Aggregate Bypass | Map ops → Aggregate boundaries | COMPLIANT |
| ASS-NB-005 | Concept Creation | Cross-ref entities/VOs → DOC-012 | COMPLIANT |
| ASS-NB-006 | Event Authenticity | Cross-ref events → DOC-014 | COMPLIANT |
| ASS-NB-007 | Framework Independence | Scan for framework names | COMPLIANT |
| ASS-NB-008 | Transaction Boundaries | Check cross-aggregate ops | COMPLIANT |
| ASS-NB-009 | Command/Event Traceability | Verify DOC-014 references | COMPLIANT |
| ASS-NB-010 | Side-Effect-Free Reads | Count events per query | COMPLIANT |
| ASS-NB-011 | Actor Authorization | Verify RBAC roles | COMPLIANT |
| ASS-NB-012 | Tenant Isolation | Verify org_id in preconditions | COMPLIANT |

**Total rules**: 12
**Violations found**: 0
**Compliance status**: COMPLIANT — All 12 NeverBreak rules satisfied by every use case in ASS-002 and every service definition in ASS-001.
