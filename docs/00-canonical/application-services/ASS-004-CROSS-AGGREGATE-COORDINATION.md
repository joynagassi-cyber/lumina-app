# Cross-Aggregate Coordination Specification
**Doc ID:** ASS-004
**Version:** v1.0
**Statut:** SPECIFICATION CANONIQUE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** service-generator v1.0 (spec-only)
**Source canonique :** ["DOC-012", "DOC-014", "API-CONTRACT-001"]
**Transformation_rule :** "application-service-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document explicitly identifies and documents ALL interactions between Aggregates in the Lumina system. Each Aggregate is an isolated boundary — cross-Aggregate interactions occur only through:

1. **Domain Events published on the event bus** (eventual consistency)
2. **Read-only cross-references** (lookup without mutation)
3. **Implicit org_id scoping** (all operations scoped to the same organization)

No Aggregate directly calls another Aggregate's methods. No Aggregate bypasses Repository abstractions. No Aggregate shares mutable state with another.

---

## CROSS-AGGREGATE COORDINATION MATRIX

| Primary Aggregate | Secondary Aggregate(s) | Coordination Pattern | Trigger | Guarantees |
|------------------|----------------------|---------------------|---------|------------|
| ResourceAggregate | VocabularyAggregate | Read-only reference | CreateTransaction uses category from vocab_values | Eventual consistency via FK constraint |
| ResourceAggregate | OrganizationAggregate | Required context | All operations require org_id from organizations | Strong consistency through Aggregate boundary |
| ResourceAggregate | OfflineSyncAggregate | Side-effect propagation | ResourceCreated/Updated events trigger push queue | Eventual consistency via sync protocol |
| WorkflowAggregate | ResourceAggregate | Triggers domain events | Approval workflow on transactions | Eventual consistency via domain events |
| LifecycleAggregate | ResourceAggregate | Archived resources reference original entities | ArchiveEntry references Transaction/Member/Event | Strong consistency at archive creation time |
| OfflineSyncAggregate | ALL aggregates | Monitors for pending operations | Sync coordinator pushes/pulls | Eventual consistency via sync protocol |
| NotificationAggregate | IdentityAggregate | Delivers notifications to users | SendNotification resolves userId | Strong consistency within org |
| FormAggregate | VocabularyAggregate | Select options sourced from vocab | RenderForm uses vocabulary terms | Eventual consistency — vocab changes propagate |
| AuditAggregate | ALL aggregates | Receives LogAction calls from all | Any domain state change | Causal consistency — logs are append-only |

---

## DETAILED COORDINATION SPECIFICATIONS

### Coordination: ResourceAggregate → VocabularyAggregate (category reference)

- **Trigger**: CreateTransaction, UpdateDraftTransaction (category_ref field validation)
- **Primary Aggregate**: ResourceAggregate
- **Secondary Aggregate**: VocabularyAggregate (read-only reference)
- **Coordination Pattern**: Read-only cross-reference — vocabulary is queried but never mutated by resource operations
- **Data Flow**:
  1. CreateTransaction request includes category_ref UUID
  2. ResourceAggregate validates category_ref exists in VocabularyAggregate before accepting
  3. Category value is loaded via Repository abstraction but NOT modified
- **Domain Events**: NONE (read-only cross-reference, no coordination)
- **Consistency Guarantee**: Eventual consistency — vocabulary changes may not be immediately visible to existing transactions
- **Violation Risk**: LOW — simple foreign key reference, no shared invariants
- **Boundary Respect**: API-NB-001 (no direct table access), API-NB-005 (persistence ignorance maintained)

---

### Coordination: ResourceAggregate → OrganizationAggregate (org_id context)

- **Trigger**: ALL ResourceAggregate operations require org_id
- **Primary Aggregate**: ResourceAggregate
- **Secondary Aggregate**: OrganizationAggregate (context provider)
- **Coordination Pattern**: Context resolution — every resource operation is scoped to an org resolved from authenticated session
- **Data Flow**:
  1. Authenticated user session contains org_id
  2. Application Service resolves org_id BEFORE loading ResourceAggregate
  3. org_id is injected into all Create/Update operations as a boundary invariant
- **Domain Events**: NONE (org_id is context, not data flow)
- **Consistency Guarantee**: Strong consistency — all resources belong to exactly one org
- **Violation Risk**: NONE — enforced by INV-004 (org isolation) at every boundary
- **Boundary Respect**: Every ResourceService operation includes org_id from session; no cross-org data leakage possible

---

### Coordination: ResourceAggregate → OfflineSyncAggregate (push events)

- **Trigger**: ResourceCreated, ResourceUpdated, ResourceStateChanged, ResourceDeleted, TransactionCompensated events
- **Primary Aggregate**: ResourceAggregate
- **Secondary Aggregate**: OfflineSyncAggregate (consumer of domain events)
- **Coordination Pattern**: Event-driven side-effect — resource changes trigger sync queue entries
- **Data Flow**:
  1. ResourceAggregate emits ResourceCreated event after successful create
  2. EventBus routes event to OfflineSyncAggregate
  3. OfflineSyncAggregate creates PendingOperation record locally
  4. PushPendingOperations later sends to remote
- **Domain Events**: ResourceCreated, ResourceUpdated, ResourceStateChanged, ResourceDeleted, TransactionCompensated (from DOC-014)
- **Consistency Guarantee**: Eventual consistency — local writes always precede remote (SYNC-001)
- **Violation Risk**: MEDIUM — if offline mode is enabled, sync may lag; conflict resolution strategy varies by entity type
- **Boundary Respect**: PendingOperation tracks resource_type and resource_id; OfflineSyncAggregate never modifies resource data directly

---

### Coordination: WorkflowAggregate → ResourceAggregate (approval flows)

- **Trigger**: ApprovalGranted or ApprovalRejected events from ResourceAggregate
- **Primary Aggregate**: WorkflowAggregate
- **Secondary Aggregate**: ResourceAggregate (state affected)
- **Coordination Pattern**: Linear orchestration via events — workflow state changes based on resource approval results
- **Data Flow**:
  1. ResourceAggregate.ApproveTransaction() emits ApprovalGranted event
  2. EventBus routes to WorkflowAggregate
  3. WorkflowAggregate marks corresponding step as approved
  4. WorkflowAggregate either completes instance or advances to next step
- **Domain Events**: ApprovalGranted, ApprovalRejected, StepApproved, StepRejected (from DOC-014)
- **Consistency Guarantee**: Eventual consistency — workflow reacts to resource state changes after the fact
- **Violation Risk**: LOW — workflows NEVER modify approved transactions directly (WF-005 invariant protects this)
- **Boundary Respect**: WorkflowAggregate reads ApprovalGranted event and acts; never calls ResourceAggregate methods directly

---

### Coordination: LifecycleAggregate → ResourceAggregate (archive references)

- **Trigger**: ArchiveResource command requires valid resource_id and resource_type
- **Primary Aggregate**: LifecycleAggregate
- **Secondary Aggregate**: ResourceAggregate (referenced entity)
- **Coordination Pattern**: Reference validation — archive entry stores resource_type + resource_id; does NOT modify the original resource
- **Data Flow**:
  1. LifecycleService.ArchiveResource(resourceType, resourceId) called
  2. Application Service loads ResourceAggregate to verify resource exists (via Repository abstraction)
  3. If resource found: ArchiveEntry created referencing resource_type + resource_id
  4. If resource not found: E-404-001 returned — no archive entry created
- **Domain Events**: ResourceArchived event (from LifecycleAggregate)
- **Consistency Guarantee**: Strong consistency at archive creation time — resource must exist before archive is created
- **Violation Risk**: LOW — once archived, reference is stable; purging doesn't affect original resource (only archive entry is removed)
- **Boundary Respect**: ArchiveEntry stores only type+id references; LifecycleAggregate never reads or modifies resource data

---

### Coordination: OfflineSyncAggregate → ALL Aggregates (sync monitoring)

- **Trigger**: Connection restored; pending operations in queue
- **Primary Aggregate**: OfflineSyncAggregate
- **Secondary Aggregates**: All 12 other Aggregates (as data sources/sinks)
- **Coordination Pattern**: Fan-out monitoring — OfflineSyncAggregate tracks operations across all resource types
- **Data Flow**:
  1. OfflineSyncAggregate maintains PendingOperation records per resource_type (transaction, member, event, etc.)
  2. PushPendingOperations batches all pending ops (max 50 per batch)
  3. PullRemoteChanges fetches deltas since last_sync_timestamp per table
  4. Conflicts resolved per strategy: LWW (members/events), immutable (approved transactions), uuid-dedup (drafts), server-wins (vocabulary)
- **Domain Events**: BatchPushed, DeltaReceived, ConflictDetected, ConflictResolved, SyncCompleted (from DOC-014)
- **Consistency Guarantee**: Eventual consistency — all aggregates converge over time through sync protocol
- **Violation Risk**: HIGH — sync conflicts can arise; different strategies per entity type must be correctly applied
- **Boundary Respect**: OfflineSyncAggregate never modifies resource data; it only queues operations that other Aggregates eventually apply

---

### Coordination: NotificationAggregate → IdentityAggregate (user delivery)

- **Trigger**: SendNotification command requires valid recipient userId
- **Primary Aggregate**: NotificationAggregate
- **Secondary Aggregate**: IdentityAggregate (recipient lookup)
- **Coordination Pattern**: User resolution — notification sent to a specific user identified by userId from IdentityAggregate
- **Data Flow**:
  1. SendNotification(userId, channel, body) called
  2. IdentityAggregate verified user exists and is active (via Repository abstraction read)
  3. NotificationAggregate creates NotificationMessage and sends via selected channel
  4. In-app notifications delivered immediately (offline-first); push/email/sms follow channel preferences
- **Domain Events**: NotificationQueued, NotificationSent, NotificationFailed (from DOC-014)
- **Consistency Guarantee**: Strong consistency — user must exist at send time
- **Violation Risk**: LOW — user existence checked before sending; failed sends retry with backoff
- **Boundary Respect**: IdentityAggregate is read-only here; NotificationAggregate handles all delivery logic

---

### Coordination: FormAggregate → VocabularyAggregate (select options)

- **Trigger**: RenderForm and LoadFormDefinition for forms containing select/multiselect fields
- **Primary Aggregate**: FormAggregate
- **Secondary Aggregate**: VocabularyAggregate (term resolution)
- **Coordination Pattern**: Read-only reference — form field options sourced from vocabulary terms
- **Data Flow**:
  1. RenderForm(formDef, data) processes form definition
  2. For each select/multiselect field: ResolveLabel(namespace, termKey, lang) invoked on VocabularyAggregate
  3. Options rendered from resolved labels (never hardcoded lists)
- **Domain Events**: TranslationResolved (informational, from VOC-01-02 in ASS-002)
- **Consistency Guarantee**: Eventual consistency — vocabulary label changes propagate to form rendering
- **Violation Risk**: LOW — FRM-009 (no hardcoded forms) and VOCAB-002 (select from vocabulary only) prevent errors
- **Boundary Respect**: FormAggregate only reads vocabulary labels; never modifies term data

---

### Coordination: ALL Aggregates → AuditAggregate (auto-logging)

- **Trigger**: ANY domain state change across all Aggregates
- **Primary Aggregates**: All 12 write-capable Aggregates
- **Secondary Aggregate**: AuditAggregate (append-only consumer)
- **Coordination Pattern**: Universal side-effect — every state change triggers LogAction in AuditAggregate
- **Data Flow**:
  1. After any Aggregate commits a state change, it emits Domain Events
  2. System auto-invokes AuditAggregate.LogAction(entityType, entityId, action, oldValues, newValues)
  3. AuditAggregate appends immutable log entry
  4. Event ActionLogged emitted (internal — not user-facing)
- **Domain Events**: ActionLogged (from DOC-014)
- **Consistency Guarantee**: Causal consistency — audit log always reflects actual state changes
- **Violation Risk**: LOW — audit logging is fire-and-forget; if AuditAggregate unavailable, retry with backoff. Data is persisted first; audit is best-effort secondary.
- **Boundary Respect**: AuditAggregate receives structured data from callers; never mutates other Aggregates. AUD-001 (immutable) guarantees nothing in AuditAggregate can be modified.

---

### Coordination: OrganizationAggregate → RelationshipAggregate (hierarchy data)

- **Trigger**: CreateOrgUnit, UpdateOrgUnitParent commands
- **Primary Aggregate**: OrganizationAggregate
- **Secondary Aggregate**: RelationshipAggregate (parent link storage)
- **Coordination Pattern**: Delegation — organization operations that involve hierarchy delegate cycle detection and depth checks to RelationshipAggregate
- **Data Flow**:
  1. OrganizationService.CreateOrgUnit(name, parent, unitType) called
  2. OrganizationAggregate creates OrgUnit record
  3. OrgUnitCreated event emitted
  4. RelationshipAggregate receives event and creates/deletes parent links
  5. Cycle detection performed via Kahn's algorithm at RelationshipAggregate boundary
- **Domain Events**: OrgUnitCreated, OrgUnitParentChanged (from DOC-014, published by both Aggregates)
- **Consistency Guarantee**: Eventual consistency — hierarchy structure is maintained across two Aggregates
- **Violation Risk**: MEDIUM — if RelationshipAggregate fails to update links, hierarchy data becomes inconsistent. Mitigation: Retry events with exponential backoff.
- **Boundary Respect**: RelationshipAggregate only stores parent-child links; OrganizationAggregate owns OrgUnit entity data. Both enforce REL-001 (no cycles) and REL-002 (depth ≤5).

---

## SUMMARY OF CROSS-AGGREGATE INTERACTIONS

| Interaction Type | Count | Examples |
|-----------------|-------|----------|
| Read-only cross-reference | 3 | Resource→Vocabulary, Form→Vocabulary, Lifecycle→Resource |
| Context resolution | 2 | Resource→Organization (all ops), Notification→Identity |
| Event-driven side-effect | 5 | Resource→OfflineSync, Workflow→Resource, All→Audit, Org→Relationship, Approval→Workflow |
| Reference validation | 1 | Lifecycle→Resource (archive creates reference) |
| Fan-out monitoring | 1 | OfflineSync→ALL (sync coordinator) |
| **Total distinct interactions** | **12** | |

Every interaction above respects these principles:
- No direct method calls between Aggregates
- All cross-Aggregate communication is through Domain Events on the event bus or read-only repository lookups
- org_id scoping applies to ALL interactions (INV-004)
- No Aggregate bypasses its own boundary for external access
