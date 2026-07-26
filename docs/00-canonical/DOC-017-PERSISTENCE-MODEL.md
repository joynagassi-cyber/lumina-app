# DOC-017 — Canonical Persistence Model

**Doc ID:** DOC-017 (FONDAMENTAL)
**Version:** 1.0
**Statut:** CONSTITUTIONNEL — MODE DE PERSISTANCE FIGÉ
**Date:** 2026-07-24

---

## PRÉAMBULE

Ce document ne définit PAS le stockage. Il définit la **stratégie de persistance** : comment chaque Aggregate du Domain Model se traduit en unités de conservation, avec quel mode, quelle cohérence, et quelles règles de vie.

Le Domain Model (DOC-012) décrit le comportement. La Persistence Strategy décrit la conservation. Le choix entre un store relationnel, un document store, un event store, un key-value store, ou toute combinaison est **sans effet** sur ce document. Ce document reste identique quel que soit le moteur de stockage.

**Règle fondamentale :** La Persistence Model mappe les objets du Domaine en unités de stockage. Elle ajoute des métadonnées de cohérence et de synchronisation. Elle n'ajoute AUCUNE règle métier. Les invariants vivent exclusivement dans le Domain Model.

---

## 1. PERSISTENCE MODEL PRINCIPLES

### 1.1 Persistence Modélise le Comportement, Pas les Règles Métier

La persistance ne définit pas ce qu'une entité **fait**. Elle définit comment l'état d'une entité est **conservé**, **récupéré**, **versionné**, et **synchronisé**. Les règles métier — immutabilité des transactions approuvées, règles de cycle de vie, contraintes de profondeur hiérarchique — résident exclusivement dans les Aggregates du Domain Model (DOC-012) et leurs Invariants (DOC-015).

### 1.2 Séparation Strict du Domaine et du Stockage

Chaque objet du Domaine a une représentation en Persistance équivalente, mais différente. L'objet de persistance porte les champs nécessaires au stockage (version, timestamps de sync, flags de cohérence, IDs dérivés) sans jamais introduire de règle métier nouvelle.

### 1.3 Indépendance du Stockage

Le même modèle de persistance peut fonctionner sur :
- Un store relationnel (schema avec tables, Foreign Keys, constraints CHECK)
- Un store documentaire (documents imbriqués, champs référencés)
- Un event store (séquences append-only de events)
- Un store clé-valeur (cache, session store, state snapshot)
- Ou toute combinaison de ces modes

Le choix du moteur de stockage est un détail d'implémentation qui n'affecte ni le Domain Model ni les Aggregates. Chaque persistence strategy ci-dessous est indépendante de tout choix technologique.

### 1.4 Les Objets de Persistance ne Sont Pas des Entités du Domaine

Les Persistence Objects (PO) sont des véhicules de données vers le stockage. Ils portent des métadonnées inconnues du Domaine (sync_timestamp, conflict_version, op_log_position, tombstone_flag). Le contraire est également vrai : un Entity du Domaine ne devient jamais un PO. Le PO est la **représentation de stockage** de l'état du Domaine, pas le Domaine lui-même.

### 1.5 Le Versioning est une Préoccupation de Persistance Qui Permet les Invariants du Domaine

Le versionning (optimiste, append-only, event-sourced) est un mécanisme de persistance qui permet au Domaine d'enforcer ses invariants (ex: INV-010, BR-RES-003). Sans versionning côté persistance, l'invariant « chaque modification incrémente le version » ne pourrait pas être détecté (lost update). Mais l'invariant lui-même appartient au Domaine, pas à la persistance.

---

## 2. PERSISTENCE STRATEGY PER AGGREGATE

Pour chaque Aggregate, cette section définit le mode de persistance, le périmètre transactionnel, le modèle de cohérence, le cycle de vie, la stratégie de versionning, le pattern de sync, et le pattern d'audit.

---

### 2.1 OrganizationAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Referenced** pour `Organization` (un seul par org, identifié par org_id). **Embedded collection** pour `OrgUnit` (la hiérarchie est consultée ensemble, jamais modifiée isolément sans traverser la hiérarchie). **Embedded Value Object** pour `OrganizationSettings`. |
| **Transaction Boundary** | Atomicité ACID sur `CreateOrganization` + initialisation des `OrgUnit` racine + création du premier `SettingEntry`. Toute opération sur `OrgUnit` qui modifie la hiérarchie doit être atomique avec la recalculation du DAG. |
| **Consistency Model** | **Strong** pour l'org profile et les settings (toujours cohérents, lus immédiatement). **Eventual** pour les descendants de la hiérarchie (la traversée complète peut être calculée de façon asynchrone). |
| **Lifetime & Deletion** | Soft delete via `OrganizationStatus` transition → `archived`. Hard purge irréversible uniquement par SuperAdmin. TTL : indéfini pour org active, configurable (min. 2 ans) pour org archived. |
| **Versioning Strategy** | **Optimistic** sur l'entité `Organization` (version number incrémented sur chaque update). Les `OrgUnit` héritent la version de l'org parent. |
| **Sync Pattern** | Full push on creation, delta pull/push on updates. Conflict resolution : **server-wins** pour settings, **merge-by-field** pour org profile fields (name conflicts extremely rare — one per org). |
| **Audit Pattern** | Every state change on Organization and OrgUnit logged to AuditAggregate with old_value + new_value. Settings changes fully snapshot-diffed. Org hierarchy restructure (reparent/transfer/merge) logs before/after tree state. |

**Justification du mode :** Organization est un singleton par contexte, donc referencé. OrgUnit forme un DAG imbriqué logiquement (on traverse ensemble, on ne consulte jamais un OrgUnit isolément), donc collection embedded. Settings sont intrinsèques à l'Organization, donc Value Object embedded.

---

### 2.2 IdentityAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Referenced** pour `User` (un user ≠ une organisation). **Embedded** pour `SessionContext` (lié生命周期 à User, jamais consulté isolément hors contexte de session). |
| **Transaction Boundary** | Atomicité sur `CreateUser` + hash password generation + permission grant setup. Session operations sont atomic par session id. Password reset est atomique avec invalidation des sessions existantes. |
| **Consistency Model** | **Strong** pour credentials (password_hash ne peut jamais être corrompu). **Strong** pour role assignments (RBAC resolve toujours depuis l'état actuel). Eventual pour session metadata (ex : last_login_at peut être mis à jour de manière asynchrone). |
| **Lifetime & Deletion** | User : soft delete via status transition (inactive/deactivated). Sessions : TTL automatique basé sur expiresAt + revocation explicit. Hard delete après 90 jours post-désactivation (configurable par Policy). Password_hash jamais en clair, jamais dans les logs. |
| **Versioning Strategy** | **Optimistic** sur `User` entity. **Append-only log** sur `SessionContext` (historique complet des créations/expirations/révocations). |
| **Sync Pattern** | Delta-based : seulement les champs modifiés sont envoyés. Conflict resolution : **server-wins** car l'identité est centrale. Local writes are rejected if offline identity changes conflict with server identity (requires manual resolution). |
| **Audit Pattern** | Every identity change fully audited: credential updates, role changes, session lifecycle, login/logout events. Old value + new value captured for every mutable field. Session revocation logged with revoker identity. |

**Justification du mode :** Users are referenced because they belong to an organization but exist independently within it. Sessions are embedded because their entire lifetime is scoped to the user session context.

---

### 2.3 ResourceAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Collection** pour les resources typedes (TransactionRecord, MemberRecord, EventRecord, ArchiveEntryRecord) — chaque type forme une collection bornée à l'intérieur de l'org. **Versioned Document** pour les transactions (current state + full history). **Embedded Value Objects** pour AmountInCents, ResourceVersion, ResourceMetadata. |
| **Transaction Boundary** | Atomicité sur Create + Audit logging (BR-AUD-001 : actions logged IMMEDIATELY upon state change). Atomicity on compensation: compensating transaction + original transaction linked in single operation. State transitions are atomic with audit log insertion. |
| **Consistency Model** | **Strong** pour approved transactions (INV-001: immutable — no concurrent modification possible). **Eventual** pour search indexes (transactions visible in search after short delay). **Strong** pour version increments (INV-010: no lost updates allowed). |
| **Lifetime & Deletion** | Transactions : draft/pending → approved (immuable, never deleted). Members : active/inactive/deceased/transferred (soft delete via status, never hard delete). Events : draft/published/cancelled/completed. Archive entries : follow LifecycleAggregate states (active → archived → trashed → purged). Soft delete via lifecycle states. Hard purge only after configurable retention period. |
| **Versioning Strategy** | **Optimistic locking** (every update requires current version). **Immutable log** for approved transactions (no update path exists; corrections go through compensating transactions). |
| **Sync Pattern** | Depends on resource type (see Conflict Resolution Matrix §2.3b): Transactions (draft) = UUID dedup + side-by-side diff. Approved transactions = immutable, no sync override. Members = LWW (last-write-wins by timestamp). Events = LWW. Categories = server-wins. Push batch size max 50 ops per OfflineSyncAggregate BR-SYNC-002. |
| **Audit Pattern** | Every create/update/state-change/deleted action logged with old_value + new_value snapshot. Compensating transactions explicitly linked to originals. Approval chain fully traced: who submitted, who approved/rejected, with timestamps and comments. |

**Justification du mode :** Resources form collections bounded by org_id. Transactions need versioned documents because they transition through states and approved ones must be read-only. All resources carry version for optimistic concurrency control.

#### Conflict Resolution Matrix (ResourceAggregate subtypes)

| Type | Conflict Strategy | Rationale |
|------|-------------------|-----------|
| Transaction (draft) | UUID dedup + side-by-side diff | Same transaction may be created offline on two devices |
| Transaction (approved) | Immutable (reject any sync overwrite) | INV-001: approved transactions cannot be modified |
| Member | LWW (timestamp-based) | Membership data may legitimately change on multiple devices |
| Event | LWW (timestamp-based) | Calendar events may be edited offline independently |
| Category | Server-wins | Vocabulary-driven; server is source of truth |

---

### 2.4 RelationshipAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Embedded collection** pour `GroupMembership` (group ↔ member links accessed together). **Referenced** pour `OrgUnitParentLink` (DAG edge, cross-referenced by hierarchy queries). |
| **Transaction Boundary** | Atomicité sur any add/remove membership operation + DAG cycle detection. Reparent operation atomic with descendant tree update. Transfer preserves ALL existing memberships in single transaction. |
| **Consistency Model** | **Strong** pour DAG integrity (cycle check before commit). **Strong** pour depth enforcement (depth ≤ 5 checked before persist). Eventual pour descendant enumerations (computed from cached edges). |
| **Lifetime & Deletion** | Relationships have no lifecycle states — they are EMBEDDED by design. Addition/removal is instantaneous. Removing a membership keeps historical record in AuditAggregate only (not in RelationshipAggregate itself). |
| **Versioning Strategy** | No versioning on relationships themselves (they are instant). Parent `OrgUnit` carries the version (changes propagate). |
| **Sync Pattern** | Memberships : LWW (if same member added to same group on two devices, deduplicate). Hierarchy changes : server-wins (org structure defined centrally). Batch size max 50 ops per BR-SYNC-002. |
| **Audit Pattern** | Every add/remove membership logged. Org unit reparent logged with old_parent + new_parent. Transfer/merge operations fully traceable through audit trail. No direct audit from this aggregate — all calls AuditAggregate's `LogAction`. |

**Justification du mode :** Relationships are structural connectors. They don't have independent lifecycles. Group memberships are naturally embedded (query by group → get members, query by member → get groups). Hierarchy edges are referenced because they cross-reference org units.

---

### 2.5 WorkflowAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Versioned Document** pour `WorkflowInstance` (current state + full execution history). **Embedded collection** pour `WorkflowStep` list within each instance. Definition stored separately from execution instances. |
| **Transaction Boundary** | Atomicity on `TriggerWorkflow` : create instance + initialize steps + emit WorkflowTriggered event. Step completion atomic with timeout tracking update. Escalation atomic with notification creation. |
| **Consistency Model** | **Strong** pour running workflows (state machine must be consistent — no partial step executions). **Eventual** pour completed workflow records (can be indexed/searched asynchronously). |
| **Lifetime & Deletion** | Running workflows : retained until completion or cancellation. Completed/cancelled/failed workflows : retained for configurable period (default 1 year). After retention : archived to LifecycleAggregate (as ArchiveEntry). Purge follows LifecycleAggregate rules. |
| **Versioning Strategy** | **Append-only log** for execution trace (every step state recorded). **Optimistic** for instance state updates (running → completed/failed/cancelled). |
| **Sync Pattern** | Not applicable for synchronous workflow execution (workflows run on server). If client triggers workflow, the trigger event is synced, not the workflow instance itself. |
| **Audit Pattern** | Every workflow state change logged : triggered, each step executed/approved/rejected/skipped, escalated, completed, failed, cancelled. Full execution trace preserved for compliance. Financial workflow steps explicitly audited against INV-001 (no approved transaction modification). |

**Justification du mode :** Workflows have execution histories that must be fully replayable. Append-only log preserves the complete sequence. Instances are versioned because they transition from running to terminal states.

---

### 2.6 FormAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Embedded** for `FormDefinition` (the definition IS the form — rendered directly from persisted JSON/YAML). Field definitions and sections are nested value objects within the form definition document. |
| **Transaction Boundary** | Atomicity on version bump when updating form definition. Old version locked (immutable), new version created. No multi-aggregate transaction needed. |
| **Consistency Model** | **Strong** for form definitions (always serve the correct version). Relaxed for rendering (form definition loaded once, rendered locally). |
| **Lifetime & Deletion** | Form versions are NEVER deleted. Each semantically versioned form persists indefinitely. New versions supersede old ones but old versions remain queryable (BR-FRM-004: old versions not modifiable). |
| **Versioning Strategy** | **Semantic versioning** embedded in the form definition (form version string, e.g., "1.0", "2.1"). Old versions become immutable. Only admin can publish new version. |
| **Sync Pattern** | Full document transfer on first load. Delta sync for subsequent loads (compare version strings). No conflict resolution needed — only one admin can modify forms at a time. |
| **Audit Pattern** | Form definition changes logged (who updated which version, what changed). Form submissions logged by FormAggregate emitting `FormSubmitted` event consumed by ResourceAggregate. |

**Justification du mode :** Forms are configuration documents, not entities with complex lifecycles. Embedded persistence captures the entire form structure in one document. Semantic versioning replaces traditional optimistic/pessimistic locking.

---

### 2.7 NotificationAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Collection** for `NotificationMessage` (batch of notifications sent per user/org, queryable by channel/severity/time). **Embedded Value Object** for `NotificationPreference` (preferences tightly coupled to user, always read together). |
| **Transaction Boundary** | Atomicity on send : enqueue notification + emit NotificationQueued event + rate limit counter increment. Batch sends atomic per batch (all succeed or none). |
| **Consistency Model** | **Strong** for in_app notifications (offline-first, must be immediately available locally). **Eventual** for push/email/SMS delivery confirmation (external channels). |
| **Lifetime & Deletion** | Sent notifications : retained for 90 days (configurable). Read/unread status tracked. Archived notifications moved to LifecycleAggregate. Suppressed/queued notifications : purged after 24h if not sent. |
| **Versioning Strategy** | **No versioning** on individual messages (sent once, immutable). Preferences can be updated with optimistic locking. |
| **Sync Pattern** | In-app notifications : sync first (offline-first invariant). Push/email/sms : fire-and-forget (fail gracefully per BR-NOT-004). Conflict resolution : N/A — notification creation is append-only. |
| **Audit Pattern** | Send attempts logged (sent, failed, retry count). Delivery status tracked per channel. Rate limit violations logged. Critical notifications bypassing quiet hours explicitly flagged. |

**Justification du mode :** Notifications are inherently time-bound and batch-processable. Collections allow efficient querying by time range, channel, or severity. Preferences are embedded because they're always read/written as a unit per user.

---

### 2.8 VocabularyAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Embedded collection** for terms within namespaces. **Value Objects** for translations (LabelPair FR+EN always persisted together). Term values stored as structured records with color/metadata. |
| **Transaction Boundary** | Atomicity on adding term + both translations (FR+EN required per INV translation policy). Atomicity on deprecation (deprecate is irreversible single operation). |
| **Consistency Model** | **Strong** for term keys (keys are stable forever — BR-VOC-003). Eventual for label resolution (cache-friendly, labels rarely change). |
| **Lifetime & Deletion** | Term values : NEVER deleted, only deprecated (BR-VOC-001). Deprecated terms retained indefinitely for backward compatibility. Active terms : retained indefinitely. Namespaces : immutable once created. |
| **Versioning Strategy** | **No versioning** on keys. Labels (display text) can evolve without key changes. Deprecation is a state transition, not a version increment. |
| **Sync Pattern** | Full namespace transfer on initial sync. Delta sync on label/key updates. Conflict resolution : server-wins (vocab is master reference for all forms and dropdowns). |
| **Audit Pattern** | Term additions logged. Deprecation events logged (which value deprecated, by whom, when). Label updates tracked with old_label + new_label. No self-audit needed — vocabulary is configuration, not business data. |

**Justification du mode :** Vocabulary is a centralized catalogue, not a per-user or per-org variable data store. Embedded collections within namespaces allow efficient namespace-scoped queries. The never-delete principle means data accumulates monotonically.

---

### 2.9 ReportingAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Snapshot** for generated reports (point-in-time capture of aggregated data). No persistent storage for reports by default — generated on-demand. If saved, stored as snapshot documents with full balance totals and category breakdowns. |
| **Transaction Boundary** | N/A — reporting is a query/computation layer, not a write layer. Balance calculation reads approved transactions and computes results atomically within a single computation window. |
| **Consistency Model** | Reports reflect the state of approved transactions at the moment of generation. If a transaction is approved mid-calculation (extremely unlikely due to short computation window), the result may include or exclude it — both outcomes are valid. |
| **Lifetime & Deletion** | Generated reports : not persisted unless explicitly saved by user. If saved, follow LifecycleAggregate archiving rules (configurable retention per report type). Exported files (PDF/CSV) : stored with expiration based on Policy settings. |
| **Versioning Strategy** | **No versioning** on computed reports. Each generation produces a new independent result. Report definitions carry semantic versions (see FormAggregate strategy). |
| **Sync Pattern** | N/A — reports are computed on-demand from ResourceAggregate data. Delta sync applies to source data (transactions), not to reports themselves. |
| **Audit Pattern** | Report generation logged (who requested, what scope, what period, what format). Export operations logged with exporter identity and timestamp. Balance calculations traceable to source transactions. |

**Justification du mode :** Reporting is fundamentally a read/computation concern. Snapshots capture the output when persisted. The key insight: the persistence strategy for reporting is OPTIONAL — most reports are ephemeral.

---

### 2.10 AuditAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Immutable Log** — append-only sequence. This is the ONLY aggregate whose persistence mode is strictly immutable log. Every entry is a permanent addition with zero modification or deletion path. |
| **Transaction Boundary** | Atomicity on append : single entry written, no partial logs. Batch appends supported (multiple events from one user operation) but each event retains its own timestamp and identity. |
| **Consistency Model** | **Strong** — audit entries must be exactly as appended. No eventual consistency tolerated. Every entry visible immediately after append. Read-after-write guaranteed for all consumers. |
| **Lifetime & Deletion** | Minimum 7 years retention (BR-AUD-003, configurable via Policy). After retention period : can be moved to cold storage or purge (irreversible, logged in its own entry). Purge of audit entries : itself audit-logged (recursive transparency — though audit.aggregate does NOT audit itself). |
| **Versioning Strategy** | **N/A** — immutable log has no concept of version or update. Sequence numbers (auto-increment) provide ordering guarantees. Monotonic clock timestamps provide temporal ordering. |
| **Sync Pattern** | **N/A** — audit is never synchronized. It lives only on the authoritative server. Client devices never maintain local audit copies. If an offline operation needs auditing, the audit is performed on reconnect. |
| **Audit Pattern** | Self-audit disabled (audit logs aren't audited — prevents infinite recursion). Every other aggregate's state change triggers a LogAction call to AuditAggregate. The audit aggregate is the END of the audit chain. |

**Justification du mode :** An immutable log is the only valid persistence mode for an audit trail. Any other mode (embedded, versioned document, snapshot) would permit modification or deletion, violating INV-007 and BR-AUD-004.

---

### 2.11 LifecycleAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Versioned Document** for `ArchiveEntry` (current lifecycle state + full state transition history). Linked resource referenced by ID (resource_type + resource_id), NOT embedded. |
| **Transaction Boundary** | Atomicity on state transition + linking to original resource. Archive creation atomic with resource state update (resource → archived in ResourceAggregate). |
| **Consistency Model** | **Strong** for state transitions (transition must pass StateTransitionValidator before persist). Eventual for search index updates (searchable after short propagation delay). |
| **Lifetime & Deletion** | Active entries : retained. Archived entries : retained until trash date. Trashed entries : retained until purge_date. Purged entries : HARD DELETE (irreversible, BR-LIF-003). Purge is logged in AuditAggregate before actual deletion. |
| **Versioning Strategy** | **State-based versioning** — each state transition represents a logical version. Retention periods act as implicit TTL versions. No numeric version field needed (state IS the version). |
| **Sync Pattern** | Lifecycle state changes pushed to remote. Conflict resolution : server-wins for state transitions (lifecycle state is central). Client state changes conflict with server → server state wins. |
| **Audit Pattern** | Every archive/trash/purge/restore operation fully audited with operator identity, timestamp, and reason. Purge operations carry special audit flag (irreversible action). Schedule purge operations logged by system scheduler. |

**Justification du mode :** Lifecycle entries need full history (how did we get here?) plus current state. Versioned documents capture both. The link to the original resource is referenced because the resource exists independently and may be restored.

---

### 2.12 ConfigurationAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Embedded Key-Value** for settings. All settings stored as a single organized object per organization (key → JSONB value pairs). Alternative: flat key-value table with org_id as partition key. |
| **Transaction Boundary** | Atomicity on bulk updates (`BulkUpdateSettings`). Individual setting updates are standalone transactions. Reset-to-defaults is atomic across all keys. |
| **Consistency Model** | **Strong** for all settings (format validation enforced at write time — ISO 4217 currency, IANA timezone, hex colors). Settings are read frequently and must never be stale or corrupt. |
| **Lifetime & Deletion** | Settings never deleted — always have defaults fallback (BR-CONFIG-004). Reset-to-defaults sets values back to baseline. New settings can be added over time (schema evolves). |
| **Versioning Strategy** | **No versioning** on individual settings. Settings are keyed by name. Updates are in-place. Last-write-wins within a single session. Multi-session conflicts resolved by timestamp (most recent update). |
| **Sync Pattern** | Full settings object transferred on org creation. Delta sync on updates (only changed keys). Conflict resolution : server-wins (settings are organizational decisions, not collaborative edits). |
| **Audit Pattern** | Setting changes logged with old_value + new_value. Resets to defaults logged as batch operation. Format validation failures logged separately (attempted invalid config). |

**Justification du mode :** Configuration is fundamentally key-value by nature. Settings are tightly coupled to the organization (never shared, never cross-org), so a flat key-value model within the org boundary is optimal. No versioning needed because settings are simple typed values.

---

### 2.13 OfflineSyncAggregate

| Aspect | Stratégie |
|--------|-----------|
| **Persistence Mode** | **Collection** for `PendingOperation` (queue of operations awaiting sync). **Embedded** for `SyncStatusTracker` (status metadata always co-located with the queue). |
| **Transaction Boundary** | Atomicity on enqueue : pushing an operation + updating sync_status_tracker timestamps. Atomicity on batch confirm : marking multiple ops as confirmed in a single operation. Conflict resolution is atomic with the winning data write. |
| **Consistency Model** | **Eventual** for pending operations (they represent a gap between local and remote state). **Strong** for connection state (must know accurately whether online/offline). **Strong** for confirmed operations (once confirmed, must not re-sync). |
| **Lifetime & Deletion** | Pending operations : deleted upon confirmation. Failed operations : retried up to 5 times (BR-SYNC-003), then marked dead. Dead operations : retained for configurable period (default 30 days) for manual inspection, then purged. Sync trackers : retained indefinitely (monotonic timestamp, never invalidated). |
| **Versioning Strategy** | **Append-only** for pending operation queue (operations added sequentially, removed only by confirmation). **No update** on pending ops — a failed operation retries as a new entry (idempotent by resource_id + action). |
| **Sync Pattern** | **Push** : batch pending operations (max 50 per BR-SYNC-002), exponential backoff on failure. **Pull** : delta fetch since last_sync_timestamp. **Conflict resolution** : strategy-per-entity-type (see ResourceAggregate matrix §2.3b). Local-first absolute (BR-SYNC-001): local write ALWAYS before remote push. |
| **Audit Pattern** | All sync activities logged : started, batches pushed, deltas received, conflicts detected/resolved, completed, connection lost/restored. Sync latency tracked per batch. Failed pushes logged with error context. |

**Justification du mode :** The pending operations queue is fundamentally a FIFO collection. Operations are appended (never modified) and removed upon confirmation. Sync status is co-located with the queue for atomic tracking. The offline-first nature means this aggregate is the bridge between local-first writes and global consistency.

---

## 3. PERSISTENCE OBJECTS

### 3.1 Definition

A **Persistence Object (PO)** is the storage-aware representation of domain aggregate state. It is the contract between the Domain Model and whatever storage mechanism is in use. A PO carries everything the domain entity carries PLUS additional metadata required for persistence operations.

### 3.2 PO vs Entity vs Value Object

| Dimension | Domain Entity | Domain Value Object | Persistence Object |
|-----------|--------------|---------------------|-------------------|
| **Purpose** | Encapsulate business behavior | Represent a conceptually whole attribute with no identity | Transport domain state through persistence layer |
| **Identity** | Defined by Aggregate boundary | No independent identity | May have storage-generated IDs |
| **Lifecycle** | Governed by domain rules | Tied to entity lifecycle | Governed by storage layer policies |
| **Metadata** | Business invariants only | Immutable value characteristics | Version numbers, sync timestamps, consistency markers, serialization hints, tombstone flags, op_log positions |
| **Awareness** | Zero storage technology awareness | Zero storage awareness | Aware of storage trade-offs (but NOT storage technology) |

### 3.3 Extra Metadata Carried by POs

A Persistence Object may carry the following metadata fields that do NOT exist in the domain equivalent:

| Metadata Field | Purpose | Example Usage |
|---------------|---------|--------------|
| `_persist_version` | Optimistic concurrency control | Compare before UPDATE, reject if mismatch |
| `_sync_timestamp` | Last successful synchronization | Delta pull since this timestamp |
| `_local_timestamp` | Last local modification time | LWW conflict resolution |
| `_conflict_strategy` | How to resolve sync conflicts | Per-entity-type strategy lookup |
| `_tombstone` | Soft delete marker | Excluded from normal queries, included in sync deletions |
| `_purge_date` | When hard delete becomes eligible | Scheduled purge job |
| `_log_sequence` | Position in append-only log | Audit entry ordering, event sourcing position |
| `_org_id` | Multi-tenant isolation | Injected on every write, validated on every read |
| `_sync_status` | Pending/confirmed/failed state | Push coordinator filters on this |
| `_created_by` | Audit identity (cross-cutting) | Used by AuditAggregate's LogAction |

### 3.4 Rules for Persistence Objects

These rules are immutable — violation constitutes a NeverBreak rule breach:

1. **PO CAN add consistency fields.** Fields like `_persist_version`, `_sync_timestamp`, `_org_id` are legitimate persistence concerns.

2. **PO CANNOT add business rules.** A PO cannot introduce a new business invariant that does not exist in the Domain Model. If a validation rule doesn't appear in DOC-012 (Domain Model) or DOC-015 (Invariant Registry), it has no place in a PO.

3. **PO CANNOT change invariant boundaries.** Adding a PO field cannot cause an invariant to be skipped, weakened, or altered. The domain's validation gates remain the sole authority on what state is valid.

4. **PO CANNOT introduce cross-aggregate dependencies.** A PO for Aggregate A cannot reference the PO for Aggregate B directly. Cross-aggregate references go through domain services or commands.

5. **PO CANNOT contain implementation technology details.** No SQL types, no ORM annotations, no schema names, no column definitions, no migration references. The PO describes WHAT needs to be persisted, not HOW.

### 3.5 PO Transformation Flow

```
Domain Entity → [Command] → Domain Service validates → Domain Events emitted
     ↓
Domain Aggregate state → PO Mapper transforms → Persistence Object
     ↓
Persistence Object → Storage Layer writes/reads → Storage response
     ↓
Storage response → PO unmapper → Domain Entity reconstruction → Domain Aggregate restored
```

The mapping between Domain Entities and Persistence Objects is a **transformation**, not a merger. Each direction has its own rules.

---

## 4. SERIALIZATION PATTERNS

Six serialization patterns are defined. Each specifies WHEN to use, WHEN NOT to use, and RULES.

---

### 4.1 Embedded

**Definition:** Store child objects directly inside the parent persistence object. No separate identity, no separate storage unit. The child's data lives as part of the parent's document/record.

**When to use:**
- Child objects have NO independent lifecycle outside the parent
- Child objects are always accessed together with the parent
- Child count is bounded and predictable (does not grow unbounded)
- Child objects are simple value objects or small aggregations

**When NOT to use:**
- Child objects can outlive the parent
- Children are queried independently of the parent
- Children form large unbounded collections (performance degradation)
- Children have their own aggregate boundaries requiring separate transaction support

**Rules:**
- Embedded children cannot be referenced from outside the parent PO
- Modifying a child implicitly modifies the parent (parent _persist_version bumps)
- Embedded children inherit the parent's _org_id automatically
- Maximum embedded collection size: 1000 items (soft limit, configurable by Policy)

**Used for:** OrgUnit hierarchy within OrganizationAggregate, FormField within FormDefinition, NotificationPreference within NotificationAggregate.

---

### 4.2 Referenced

**Definition:** Store the child in its own persistence unit. The parent holds only a reference (ID + type). The child is independently addressable and has its own lifecycle.

**When to use:**
- Child objects have independent identity and lifecycle
- Child objects may be shared across parents
- Child objects are queried independently
- Children are large enough that embedding degrades performance

**When NOT to use:**
- Child and parent are always accessed together (use Embedded instead)
- Child cannot exist without parent AND is never queried independently
- The relationship is truly compositional (has-a, not references-a)

**Rules:**
- Reference must include both ID and type (prevents ambiguous cross-type references)
- Deleting the parent does NOT cascade delete children (children have independent lifecycle)
- Referencing a non-existent child returns empty/null, never throws
- Circular references between referenced objects are prohibited

**Used for:** User references within OrganizationAggregate, OrgUnit references between each other, resource cross-references in WorkflowAggregate.

---

### 4.3 Collection

**Definition:** A bounded, ordered sequence of domain objects stored together but addressing individually. Each item has independent identity but is logically grouped.

**When to use:**
- Related objects accessed in batches (query by collection)
- Items have individual lifecycle but shared context
- Order may matter (sequence, priority, time)
- Collection size is predictable within reasonable bounds

**When NOT to use:**
- Items need to be queried individually without the collection context
- Collection grows without bound (use partitioned collection instead)
- Items have no logical grouping (use Referenced with tags/metadata)

**Rules:**
- Collection items maintain insertion order
- Deleting the collection container removes all items (unless they have independent lifecycle)
- Bulk operations supported: add_many, remove_many, replace_range
- Collection-level _persist_version bumped on ANY item addition or removal

**Used for:** TransactionRecord collection within ResourceAggregate, NotificationMessage collection within NotificationAggregate, PendingOperation queue within OfflineSyncAggregate.

---

### 4.4 Immutable Log

**Definition:** An append-only sequence where entries are never modified, never deleted (within retention period), and never reordered. Each entry is identified by its position in the log.

**When to use:**
- Complete audit trail required
- Change history must be reconstructible
- Compliance or legal retention requirements
- Event sourcing scenarios

**When NOT to use:**
- Current state needs frequent random access with low latency (supplement with snapshot)
- Entries need to be corrected (use corrective entries, not modifications)
- Retention policy allows purge (logs transition to cold storage or expire)

**Rules:**
- ZERO modifications: no UPDATE, no DELETE, no in-place replacement
- Entries ordered by monotonic position OR timestamp (both provided)
- Append operations are atomic (full entry or nothing)
- Retention policy governs purge eligibility (minimum configurable period)
- Log consumers MUST process entries in order; out-of-order consumption is an error
- Self-audit is prohibited (prevent infinite recursion)

**Used for:** AuditAggregate exclusively. This is the only aggregate whose persistence mode is strictly Immutable Log.

---

### 4.5 Versioned Document

**Definition:** A document that maintains a current version and an append-only history of previous versions. Each version is addressable by version number or timestamp. Transitions between versions are governed by a state machine.

**When to use:**
- Objects go through observable state transitions that must be reconstructible
- Time-travel queries are needed (what was the state at time X?)
- Concurrent modification detection is critical (optimistic locking)
- Rollback capability is required

**When NOT to use:**
- Objects are append-only (use Immutable Log instead)
- Objects never change (use Embedded)
- Version granularity too fine (snapshots at each micro-change)

**Rules:**
- Version numbers are monotonically increasing (never reused, never gap-filled)
- Previous versions are NEVER deleted (they may be archived to cold storage)
- Current version is always readable; historical versions readable subject to retention
- A write fails if the expected version does not match current version (optimistic lock violation)
- State transitions follow a predefined graph (versioned document tracks the graph path)

**Used for:** WorkflowInstance (execution history), TransactionRecord (draft → pending → approved history), Resource with optimistic versioning, ArchiveEntry (lifecycle state history).

---

### 4.6 Snapshot

**Definition:** A periodic or triggered capture of complete state at a point in time. Snapshots are independent records — they don't derive from diffs, they capture the full picture. Useful for fast reconstruction, reporting, and recovery.

**When to use:**
- Expensive recomputation can be avoided by reading a snapshot
- Point-in-time reporting (financial reports, balance sheets)
- Recovery from corruption (snapshot provides known-good state)
- Periodic checkpoints for long-running processes

**When NOT to use:**
- State changes frequently and snapshots become too large
- Only a few fields change between captures (use diff/versioned document instead)
- Real-time accuracy required (snapshots are inherently point-in-time, not live)

**Rules:**
- Snapshots are append-only (each snapshot is a new entry)
- Snapshot frequency is configurable via Policy
- Snapshots can be compressed (store delta from previous snapshot)
- Retrieval prefers most recent snapshot + following diffs
- Snapshots include metadata: capture timestamp, source version, checksum

**Used for:** ReportingAggregate (generated reports), WorkflowInstance (periodic execution checkpoints), ResourceAggregate (optional periodic state snapshots for fast reconciliation).

---

## 5. STORAGE INDEPENDENCE

### 5.1 Why This Persistence Model Works With Any Storage Engine

The persistence strategies defined above describe HOW domain data is organized for storage, not WHAT stores the data. This distinction is fundamental:

- **A relational store** implements Embedded via JOIN + foreign keys, Referenced via foreign keys, Collection via one-to-many tables, Immutable Log via append-only tables with serial IDs, Versioned Document via current-row + history-table pattern, Snapshot via materialized views.

- **A document store** implements Embedded via nested documents, Referenced via $ref or document ID, Collection via array fields or embedded subdocuments, Immutable Log via append-only collection with positional ID, Versioned Document via version field + versioned collection, Snapshot via full-document writes.

- **An event store** implements Embedded via events referencing parent aggregate root, Referenced via event correlation IDs, Collection via ordered event sequences, Immutable Log as native model, Versioned Document via aggregate version + event stream, Snapshot via periodic full-state events.

- **A key-value cache** implements Embedded via single-key document values, Referenced via key references, Collection via hash-set or sorted-set structures, Immutable Log via append-only key (Redis streams), Versioned Document via versioned keys, Snapshot via single-key full dumps.

The SAME persistence strategy maps differently depending on the storage engine. The DOMAIN MODEL remains unchanged regardless.

### 5.2 Storage Engine Trade-offs

| Strategy | Best Fit Storage | Alternative Storage | Performance Impact |
|----------|-----------------|---------------------|-------------------|
| Embedded | Document store | Relational (JSONB columns), KV store | Minimal across all |
| Referenced | Relational (with FK constraints), Document store (with indexes) | KV store (requires application-level join) | Low with proper indexing |
| Collection | Document store (arrays), Relational (child table) | Event store (aggregated events) | Moderate for large collections |
| Immutable Log | Event store (native), Append-only DB | Relational (insert-only table) | Optimal in event store, acceptable elsewhere |
| Versioned Document | Document store (version field), Event store (event stream) | Relational (history table pattern) | Low with version-based queries |
| Snapshot | Document store (full doc), Relational (materialized view) | KV store (full value dump) | Write-heavy, read-optimal |

### 5.3 What Changes When You Switch Storage Engines

What DOES change:
- Query performance characteristics (index strategies, join costs)
- Batch operation efficiency (bulk inserts vs. streaming appends)
- Concurrency control mechanisms (Pessimistic locks via SELECT FOR UPDATE, Optimistic via version field, PAXOS/Raft in distributed stores)
- Retention management (TTL indexes, partition pruning, log compaction)

What DOES NOT change:
- Aggregate boundaries
- Domain invariants
- Command interfaces
- Event contracts
- Persistence strategy per aggregate (the strategy in Section 2 is storage-agnostic)
- Persistence Object metadata fields (Section 3)
- Serialization pattern rules (Section 4)

### 5.4 Storage Independence Validation Rule

Any proposed storage implementation MUST pass this validation:
> If you replace the storage engine while keeping the Domain Model, Aggregate boundaries, Commands, and Events identical, can the system behave identically? If YES, the storage independence is maintained. If NO, the implementation has leaked storage-specific concerns into the domain layer.

---

## 6. NEVERBREAK RULES FOR PERSISTENCE

These rules are immutable. Any violation constitutes an architectural breach requiring immediate correction and ADR documentation.

### NB-PERSIST-001: Persistence Never Adds Business Rules

Persistence Objects may add consistency metadata (version, timestamps, sync flags). They may NOT introduce business logic, validation rules, or behavioral constraints. All business rules reside exclusively in the Domain Model (DOC-012) and Invariant Registry (DOC-015). If a validation rule appears only in persistence code and not in an Aggregate's business rules, it is incorrectly placed.

### NB-PERSIST-002: Invariants Live Only in the Domain

The Domain Model is the sole authority on what constitutes valid state. Persistence mechanisms (optimistic locking, constraints, triggers, indexes) MAY enforce domain invariants for safety, but they DO NOT define them. An invariant exists because the Aggregate says it exists, not because the database schema supports it.

### NB-PERSIST-003: Events Are Defined by Commands, Not by Storage

Domain Events are emitted in response to Commands processed by Aggregates. The events defined in DOC-014 (Domain Command & Event Registry) are the complete and exclusive set. Storage engines MAY emit technical events (row inserted, page split, checkpoint) — these are infrastructure concerns entirely separate from domain events and must never leak into domain code.

### NB-PERSIST-004: No Persistence Choice Changes Aggregate Boundaries

Choosing to store related data in the same document, or splitting data across documents, does NOT change which Aggregate owns which data. Aggregate boundaries are determined by domain cohesion and invariant containment, not by storage efficiency. If changing the storage engine requires moving data between Aggregates, the storage choice is wrong — not the aggregate boundaries.

### NB-PERSIST-005: The Conflict Resolution Matrix Is Domain-Defined

The conflict resolution strategy per entity type (defined in §2.3b) is a domain decision, not a storage decision. It derives from the business meaning of each resource type. Storing the same data in different engines may change how conflicts are technically resolved, but NOT which strategy applies.

### NB-PERSIST-006: Immutable Log Is Exclusive to AuditAggregate

Only AuditAggregate uses the Immutable Log persistence mode (§4.4). No other aggregate may use append-only semantics unless explicitly approved by ADR amendment. Other aggregates that need historical tracking use Versioned Documents (§4.5), which allow the concept of "current state" alongside history.

### NB-PERSIST-007: No Self-Audit for AuditAggregate

AuditAggregate's own entries are never themselves logged. This prevents infinite recursion (an audit log entry being audited creates another audit entry, ad infinitum). The audit log is the terminal point of the audit chain.

### NB-PERSIST-008: Sync Patterns Never Block User Operations

Per OfflineSyncAggregate BR-SYNC-004, no user-facing operation depends on synchronous completion of any sync activity. Push, pull, and conflict resolution are always background operations. This is a domain invariant, not a persistence optimization.

### NB-PERSIST-009: Persistence Objects Cannot Define Cross-Aggregate Dependencies

A PO for any Aggregate must not directly reference POs of other Aggregates. Cross-aggregate references flow through domain events, commands, or domain service abstractions. The persistence layer never implements cross-aggregate joins or foreign-key-like constraints between aggregates.

### NB-PERSIST-010: Storage Technology Must Never Appear in Domain-Level Documents

The Domain Model, Invariant Registry, Command/Event Registry, and Capability Dependency Graph must never mention specific storage technologies (no SQL, no PostgreSQL, no Supabase, no Prisma, no Drizzle, no table names, no column definitions, no migrations, no index definitions, no schema names). These are implementation concerns belonging exclusively to the Data Model layer, which is below the Domain Model in the architectural hierarchy (DOC-000).

### NB-PERSIST-011: Retention Policies Are Configured via Policy Capability, Never Hardcoded

All retention periods, purge dates, and lifecycle thresholds are configured through the Policy Capability (DOC-005), loaded from the Manifest. Persistence layers may apply defaults, but defaults must be overridable through configuration. Hardcoded retention values are a NeverBreak violation.

### NB-PERSIST-012: All Persistence Strategies Are Reversible to Documentation

For every Persistence Object transformation (domain entity → PO), there must be a documented inverse (PO → domain entity). Any loss of fidelity in this round-trip transformation (domain → PO → domain) must be explicitly documented in an ADR. Lossless round-trip conversion is the default expectation.

---

## RESUME: PERSISTENCE STRATEGIES AT A GLANCE

| Aggregate | Primary Mode | Consistency | Versioning | Sync Pattern |
|-----------|-------------|-------------|------------|-------------|
| OrganizationAggregate | Referenced + Embedded Collection | Strong | Optimistic | Full + Delta, server-wins |
| IdentityAggregate | Referenced + Embedded | Strong | Optimistic + Append-only (sessions) | Delta, server-wins |
| ResourceAggregate | Collection + Versioned Document | Strong (approved) / Eventual (search) | Optimistic | Per-entity-type matrix |
| RelationshipAggregate | Embedded Collection + Referenced | Strong (DAG integrity) | N/A (instant) | Per-entity-type matrix |
| WorkflowAggregate | Versioned Document | Strong (running) | Append-only (trace) | N/A (server-only) |
| FormAggregate | Embedded | Strong | Semantic versioning | Delta by version |
| NotificationAggregate | Collection + Embedded VO | Strong (in_app) | N/A | Push first, others best-effort |
| VocabularyAggregate | Embedded Collection | Strong (keys stable) | N/A (mutable labels) | Full + Delta, server-wins |
| ReportingAggregate | Snapshot | N/A (computed) | N/A (ephemeral) | N/A |
| AuditAggregate | Immutable Log | Strong (always) | N/A (append-only) | N/A (server-only) |
| LifecycleAggregate | Versioned Document | Strong (transitions) | State-based | Server-wins |
| ConfigurationAggregate | Embedded KV | Strong | In-place update | Full + Delta, server-wins |
| OfflineSyncAggregate | Collection + Embedded VO | Eventual (pending) | Append-only (queue) | Push/Pull/Delta |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Persistent Model constitutionnel pour les 13 Aggregates | CTO + Arch Principal |
