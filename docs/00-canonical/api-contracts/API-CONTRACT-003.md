# API Contract Rules — Lumina v1

**Doc ID:** API-CONTRACT-003
**Version:** v1.0
**Statut:** CONTRAT CANONIQUE DEFINI PAR GENESIS
**Date:** 2026-07-25
**Generateur :** api-contract-generator v1.0
**Source canonique :** ["DOC-013", "DOC-014", "DOC-015", "DOC-016", "DOC-023"]
**Transformation_rule :** "api-contract-generator v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document definit les regles NEVER-BREAK specifiques a la couche API. Ces regles sont constitutionnelles et ne peuvent PAS etre violees, meme temporairement, meme pour des raisons de performance ou d'UX.

Chaque regle API-NB est precedee par sa contrepartie NeverBreak du DOC-023.

---

## REGLES NEVER-BREAK DE LA COUCHE API

### API-NB-001 NeverBreak-Boundary

NO API exposes an internal aggregate boundary directly. API operations map to Command boundaries (DOC-013), not Entity/Value Object internals.

**Violation example:** A GET endpoint returns raw parent_id FK value from OrgUnit instead of going through GetDescendants() boundary method.

**Testable assertion:** For every API operation defined in API-CONTRACT-001, there exists exactly one "Expose:" declaration in the corresponding aggregate's boundary spec (DOC-013). No operation corresponds to a "Possede", "Protege", or "Interdit" declaration.

**Auto-check script logic:**
```
for each Operation in API-CONTRACT-001:
    aggregate = Operation.aggregate
    boundary = DOC-013[aggregate].Expose
    assert Operation.name IN boundary.exposed_methods
    # No operation should reference internal entity fields directly
    assert Operation does not expose Entity.private_fields
```

---

### API-NB-002 NeverBreak-DomainIsolation

NO API bypasses the Domain layer. Every mutation MUST go through a Command from DOC-014. Every read MUST go through a Query from DOC-013 Expose.

**Violation example:** A service method directly inserts into transactions table without going through CreateTransaction command.

**Testable assertion:** Every request contract in API-CONTRACT-002 maps to exactly one command or query declared in API-CONTRACT-001. There is no path from client input to persistence that skips the domain operation layer.

**Auto-check script logic:**
```
for each MutationRequest in API-CONTRACT-002:
    operation = resolve_operation(MutationRequest)
    assert operation IS a Command (not a raw persistence call)
    assert operation has DOC-014 source reference

for each ReadRequest in API-CONTRACT-002:
    operation = resolve_operation(ReadRequest)
    assert operation IS a Query
    assert operation has DOC-013 boundary source reference
```

---

### API-NB-003 NeverBreak-InvariantPreservation

API operations NEVER modify domain invariants. Invariant enforcement happens exclusively in the Domain layer. The API's role is to pass inputs through — not to decide based on them.

**Violation example:** An API endpoint silently drops invalid transactions before they reach the Domain layer (soft rejection instead of invariant violation error code E-422).

**Testable assertion:** Every invariant listed in DOC-015 that applies to an aggregate is checked BEFORE any persistence write. The API cannot suppress or override invariant violations.

**Auto-check script logic:**
```
for each Command in API-CONTRACT-001:
    invariants = resolve_invariants(Command)
    for each invariant in invariants:
        assert invariant IS checked before any persistence write
        assert invariant violation returns ErrorContract (not silent drop)
```

---

### API-NB-004 NeverBreak-ConceptCreation

API operations NEVER create new Concepts. All concepts MUST be in DOC-001 Element Registry.

**Violation example:** Adding a "budget" concept that isn't in DOC-001 Element Registry. Creating a new enum value outside documented types.

**Testable assertion:** Every type, enum, entity, and VO referenced by API operations exists in DOC-001 CANONICAL-ELEMENT-REGISTRY. No new domain concepts are introduced at the API layer.

**Auto-check script logic:**
```
for each Field in all RequestContracts of API-CONTRACT-002:
    concept = resolve_concept(Field.type)
    assert concept IN DOC-001.element_registry
    assert concept.category is valid (Entity|VO|Enum|Template|DataModel)
```

---

### API-NB-005 NeverBreak-NoPersistenceAwareness

API contracts know NOTHING about persistence. No column names, no table names, no SQL patterns. API speaks Entities, Commands, Queries, Events.

**Violation example:** Returning raw database row data with column-style field names (snake_case table columns) instead of projected domain object responses. API contract references "transactions.amount_cents" (table.column notation) instead of "TransactionRecord.amountInCents" (entity.property notation).

**Testable assertion:** All field names in API contracts use domain terminology (entities, VOs) not persistence terminology (tables, columns). No SQL constructs, no schema names, no migration references appear in API contracts.

**Auto-check script logic:**
```
for each ResponseField in all ResponseContracts of API-CONTRACT-002:
    assert response_field_name NOT IN persistence_column_names
    assert response_field references ENTITY property, not TABLE column
    for each error_code in API-CONTRACT-005:
        assert error_code does not reference specific DB constraints
```

---

### API-NB-006 NeverBreak-ExposesBehaviorNotData

API endpoints expose BEHAVIORS (what you can DO with an entity), not internal DATA STRUCTURES.

**Violation example:** PUT /transactions/{id} to update all fields directly instead of using semantic commands like ApproveTransaction, RejectTransaction.

**Testable assertion:** Every API operation represents a DOMAIN BEHAVIOR (an action), not a CRUD proxy on a data structure. There is no generic "UpdateEntity(entity, fields)" operation that performs blind field updates across entities.

**Auto-check script logic:**
```
for each Command in API-CONTRACT-001:
    assert command_name describes ACTION not DATA_MANIPulation
    # Good: "ApproveTransaction" (behavioral)
    # Bad: "UpdateTransactionFields" (data-manipulation)
    assert command has clear preconditions and postconditions
    assert command maps to a single semantic intent
```

---

### API-NB-007 NeverBreak-TenantIsolation

Every API operation requires and respects _org_id isolation. Cross-org queries are forbidden.

**Violation example:** A query that joins across organizations. An API operation that accepts org_id as user input instead of resolving it from session context.

**Testable assertion:** Every single operation (command AND query) enforces org_id scoping. The org_id comes from authenticated session context, never from user-provided request data. No operation can access data outside its own org.

**Auto-check script logic:**
```
for each Operation in API-CONTRACT-001:
    if Operation.is_query:
        assert Operation.enforces_org_id_scoping
    if Operation.is_command:
        assert Operation.enforces_org_id_scoping (write scope)
    assert Operation.org_id_resolved_from_session_context

# Cross-org queries must be impossible
assert NO query spans more than one org_id
```

---

### API-NB-008 NeverBreak-ImmutableLogProtection

AuditAggregate is IMMUTABLE at the API level. No UPDATE, no DELETE operations on audit_entries through API. Only READ.

**Violation example:** DELETE /audit_entries/{id} endpoint. Any endpoint that modifies audit log entries.

**Testable assertion:** AuditAggregate exposes only LogAction (system-auto), QueryAuditLogs (read), and ExportAuditTrail (read). There are zero mutation commands targeting AuditAggregate entries.

**Auto-check script logic:**
```
audit_commands = [op for op in API-CONTRACT-001 if op.aggregate == 'AuditAggregate']
for cmd in audit_commands:
    if cmd.is_mutation:
        assert cmd.name == 'LogAction'  # system-only, never user-callable
        assert cmd.actor == 'SYSTEM ONLY'

query_ops = [op for op in API-CONTRACT-001 if op.aggregate == 'AuditAggregate' and op.is_read]
assert len(query_ops) >= 2  # QueryAuditLogs + ExportAuditTrail
```

---

### API-NB-009 NeverBreak-CommandEventTraceability

Every Command MUST emit the Domain Events specified in DOC-014. Every Event emitted MUST have a corresponding Command trigger. No orphaned events.

**Violation example:** CreateTransaction emits ResourceCreated but omits NotificationQueued (which is a downstream consumer of ResourceCreated). Or: an operation emits an event not listed in DOC-014's event registry.

**Testable assertion:** For every Command in API-CONTRACT-001, the "Domain Events emitted" column references only events from DOC-014's event registry. Conversely, every event in DOC-014 appears in at least one Command's emission list.

**Auto-check script logic:**
```
all_doc014_events = {e.name for e in DOC-014.events}
for op in API-CONTRACT-001.operations:
    for emitted_event in op.domain_events_emitted:
        assert emitted_event IN all_doc014_events

for event in all_doc014_events:
    assert any(event IN op.domain_events_emitted for op in API-CONTRACT-001.operations)
    # or it is an internal/system event (no direct command trigger)
```

---

### API-NB-010 NeverBreak-ErrorTaxonomyCompliance

Every error returned by an API operation MUST use a code from API-CONTRACT-005 (Error Taxonomy). No ad-hoc error codes.

**Violation example:** Returning a custom error code "TXN_422_INVALID" instead of the canonical "E-422-001 INVARIANT_VIOLATED".

**Testable assertion:** Every error category in API-CONTRACT-005 covers all possible error conditions for API operations. No error code exists outside the taxonomy. Each domain invariant violation maps to a specific E-422-XXX code.

**Auto-check script logic:**
```
all_error_codes = {e.code for e in API-CONTRACT-005.all_errors}
for each operation in API-CONTRACT-001:
    possible_errors = resolve_potential_errors(operation)
    for err in possible_errors:
        assert err.code IN all_error_codes
```

---

### API-NB-011 NeverBreak-ReadOperationsAreSideEffectFree

All Query operations MUST be strictly read-only. They produce NO domain events, NO state changes, NO side effects of any kind.

**Violation example:** A "GetOrganizationProfile" query that also creates an implicit audit log entry as a side effect (that belongs in the Domain layer, not the Query boundary).

**Testable assertion:** Every Query operation in API-CONTRACT-001 has events_emitted = empty set. Every Query operation has postconditions = "data returned" only.

**Auto-check script logic:**
```
for op in API-CONTRACT-001.operations:
    if op.is_query:
        assert op.domain_events_emitted == []
        assert op.postconditions describe READ-ONLY behavior
```

---

### API-NB-012 NeverBreak-ActorAuthorization

Every command specifies its authorized actor in DOC-014. The API MUST enforce this authorization at the boundary — never delegating authorization decisions to downstream layers.

**Violation example:** CreateUser accepts requests from any authenticated user without checking Actor column. The Domain layer does not re-validate who triggered the command.

**Testable assertion:** Every command in API-CONTRACT-001 has an explicit actor from DOC-014, and the API enforcement layer checks this actor against the requesting user's role/capabilities before passing the command to the Domain layer.

**Auto-check script logic:**
```
for cmd in API-CONTRACT-001.commands:
    doc014_actor = DOC-014[cmd.name].actor
    api_authorization_check = resolve_api_auth_check(cmd)
    assert api_authorization_check.validates_actor(doc014_actor)
```

---

## VALIDATION RULES SUMMARY

| Rule ID | Auto-Checkable? | Check Type | Severity if Violated |
|---------|----------------|------------|---------------------|
| API-NB-001 | Yes (schema) | Structure validation | CRITICAL |
| API-NB-002 | Yes (logic) | Flow validation | CRITICAL |
| API-NB-003 | Yes (logic) | Guard validation | CRITICAL |
| API-NB-004 | Yes (schema) | Element registry check | CRITICAL |
| API-NB-005 | Yes (schema) | Naming convention check | MAJOR |
| API-NB-006 | Yes (semantic) | Behavioral vs data check | MAJOR |
| API-NB-007 | Yes (logic) | org_id injection check | CRITICAL |
| API-NB-008 | Yes (structure) | Aggregate operation filter | CRITICAL |
| API-NB-009 | Yes (cross-ref) | DOC-014 traceability | MAJOR |
| API-NB-010 | Yes (schema) | Error taxonomy compliance | MAJOR |
| API-NB-011 | Yes (logic) | Side-effect verification | MAJOR |
| API-NB-012 | Yes (logic) | Actor authorization | CRITICAL |

Total NeverBreak rules for API layer: 12
