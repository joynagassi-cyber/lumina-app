# Canonical Port Catalog

**Doc ID:** PAS-001
**Version:** v1.0
**Statut:** SPECIFICATION CANONIQUE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** ports-adapters-specifier v1.0
**Source canonique :** ["DOC-012", "DOC-013", "DOC-014", "DOC-015", "DOC-017", "DOC-019", "ASS-001", "API-CONTRACT-004"]
**Transformation_rule :** "ports-adapters-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **exhaustive catalog of all Ports** required by the Lumina system to support its 13 Aggregates, 83 operations, and 60+ Domain Events. Each Port is an ABSTRACTION — a contract that the Domain or Application Service requires without knowing how it is implemented.

No Port contains business logic. No Port knows about technology. Every Port is framework-agnostic, language-agnostic, and storage-agnostic.

Ports are defined by what consumers need, not by what infrastructure provides.

---

## TOTAL PORT COUNT: 17

| # | Port ID | Port Name | Defined By |
|---|---------|-----------|------------|
| 1 | Port-001 | RepositoryPort | DOC-017 Persistence Model |
| 2 | Port-002 | EventPublicationPort | DOC-014 Command-Event Registry |
| 3 | Port-003 | EventSubscriptionPort | System Architecture |
| 4 | Port-004 | IdentityProviderPort | IdentityAggregate |
| 5 | Port-005 | AuthorizationPort | API-CONTRACT-004 |
| 6 | Port-006 | ClockPort | All Aggregates (timestamps) |
| 7 | Port-007 | UUIDPort | Schema Pack (PK uuid) |
| 8 | Port-008 | ConfigurationPort | ConfigurationAggregate |
| 9 | Port-009 | LoggingPort | Architecture Requirements |
| 10 | Port-010 | AuditPort | AuditAggregate (NB-PERSIST-006) |
| 11 | Port-011 | NotificationPort | NotificationAggregate |
| 12 | Port-012 | SearchPort | Query Operations on Aggregates |
| 13 | Port-013 | FileStoragePort | FormAggregate (file_upload), LifecycleAggregate (url_pieces_jointes) |
| 14 | Port-014 | CachePort | Performance Optimization Layer |
| 15 | Port-015 | TransactionManagerPort | WorkflowAggregate (multi-aggregate coordination) |
| 16 | Port-016 | PersistenceVerificationPort | Infrastructure Health Check |
| 17 | Port-017 | VocabularyAccessPort | ResourceAggregate (categories via vocab_values) |

---

## PORT DEFINITIONS

### Port-001: RepositoryPort

**Purpose**: Abstract interface for persisting and retrieving Entity and Aggregate state from any storage mechanism. Provides the sole data access channel between the Application layer and persistent storage.

**Defined By**: DOC-017 Persistence Model, DOC-018 Transition Rules

**Consumers**: All 13 Application Services (OrganizationService through OfflineSyncService)

**Data Manipulated**: Aggregate roots, domain entities, persistence objects, and query result DTOs

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| save(entity) | Persistence Object of any Aggregate entity | void | Persist a domain entity (create or update) with full aggregate boundary atomicity |
| load(id, org_id) | Entity identifier + organization scope | Domain Entity (fully reconstructed) | Retrieve a single entity by ID within its org boundary; throw if not found |
| delete(id, org_id) | Entity identifier + organization scope | void | Soft-delete or permanently remove entity (depends on aggregate lifetime policy) |
| findByCriteria(query) | Structured query with org_id scope, filters, pagination | List of Domain Entities | Execute a structured read against stored entities; never returns cross-org data |
| exists?(id, org_id) | Entity identifier + organization scope | boolean | Efficient existence check before attempting load |

### Constraints
1. Every method accepts org_id as mandatory scope parameter — no exception
2. Never executes SQL-like queries directly; uses structured query criteria only
3. The Port layer handles persistence metadata (_persist_version, _sync_timestamp, _tombstone); consumers receive clean domain entities
4. Save operations are boundary-atomic: writing one Aggregate's data is always complete or not written at all
5. Cannot execute cross-Aggregate joins; reads span only one Aggregate's entities per call

### Invariants Enforced
- INV-004 (Multi-Tenant Isolation): Every repository operation scoped to exactly one org_id
- VERSION-001 (Optimistic Concurrency): Repository respects version field for conflict detection
- SM-004 (Org Isolation at Storage Level): Repository enforces org-level partitioning
- NB-PERSIST-008: Repository operations never block user-facing operations during sync scenarios

---

### Port-002: EventPublicationPort

**Purpose**: Abstract interface for publishing Domain Events emitted by Aggregates after state changes. Decouples event producers (Aggregates) from event consumers (subscribers, external systems).

**Defined By**: DOC-014 Command-Event Registry

**Consumers**: All Application Services (post-persistence event dispatching)

**Data Manipulated**: Domain Events from DOC-014 registry (60 events across 13 Aggregates)

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| publish(event) | Single Domain Event payload matching DOC-014 schema | void | Publish one event to all registered subscribers; at-least-once delivery guaranteed |
| publishBatch(events[]) | Array of Domain Events | void | Batch-publish multiple events atomically (e.g., from a single command execution) |

### Constraints
1. Events published exactly match the payload structure defined in DOC-014 — no addition, removal, or modification of event fields
2. Delivery guarantee is at-least-once: duplicate deliveries may occur; consumers must be idempotent
3. Publication is fire-and-forget from the caller's perspective: the method returns immediately regardless of subscriber availability
4. Events are published in the order they were emitted by the Aggregate
5. If publication fails for any subscriber, the failure is logged and retried with exponential backoff; the original command operation still succeeds

### Invariants Enforced
- AUD-001 (Audit Immutability): Event payloads never modified after emission
- DOC-014 M-005 Constraint: Event types must map to exactly one entry in the DOC-014 event registry
- SYNC-004 (Never Block User Operations): Event publication failures do not prevent domain operation completion

---

### Port-003: EventSubscriptionPort

**Purpose**: Abstract interface for registering handlers that react to Domain Events. Enables event-driven cross-aggregate coordination (e.g., AuditAggregate auto-logging, OfflineSyncAggregate push queuing).

**Defined By**: System Architecture (cross-aggregate event propagation pattern defined in ASS-004)

**Consumers**: Cross-aggregate coordination mechanisms (AuditLogger, PushCoordinator, ConflictResolver)

**Data Manipulated**: Event type strings (keys) and abstract handler references

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| subscribe(eventType, handler) | Event type string (from DOC-014) + abstract event handler reference | subscription token | Register a handler to receive future publications of the specified event type |
| unsubscribe(eventType, subscriptionToken?) | Event type string + optional subscription token | void | Remove a previously registered handler (all handlers for a type, or a specific one) |

### Constraints
1. Handlers cannot modify domain state directly — they delegate to Application Services which go through proper Aggregate boundaries
2. Subscription registration happens at composition root time; runtime subscription/unsubscription is limited to dynamic event routing scenarios
3. Handlers execute in isolation: failure in one handler does not prevent other handlers from receiving the event
4. The port cannot invent new event types — only DOC-014-defined events may be subscribed to

### Invariants Enforced
- LOG-005 (Execution State Logged): Subscription-based audit logging ensures every state change triggers action logging
- Coordination Principle (ASS-004): All cross-aggregate interaction flows through events, never direct calls

---

### Port-004: IdentityProviderPort

**Purpose**: Abstract interface for authenticating users and managing their sessions. Handles credential verification, session lifecycle, and token management without revealing implementation details of the identity store.

**Defined By**: IdentityAggregate, DOC-013 Boundary Specification

**Consumers**: IdentityService, API Layer (pre-authentication), Security Capability

**Data Manipulated**: Credentials (email + password hash), session tokens, refresh tokens

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| authenticate(credentials) | Email address + password hash (or equivalent credential pair) | authentication context (userId, orgId, role, sessionToken) | Verify user credentials and return authentication context |
| validateSession(token) | Session token | valid: boolean, expired: boolean | Determine whether a session token is currently valid and not expired |
| refreshToken(token) | Refresh token | new token pair (access + refresh) | Issue new ephemeral tokens using a valid refresh token |
| revokeToken(token) | Token to revoke | void | Invalidate a token so it can no longer be used for authentication |

### Constraints
1. Never stores or returns plaintext passwords — credential comparison always occurs through secure hashing
2. Session tokens are ephemeral and never persisted in plain form — only their cryptographic hashes are stored
3. Email uniqueness is enforced per org_id
4. Token format and storage mechanism are implementation details hidden behind this port
5. Authentication failures must not reveal whether the email or the password was incorrect

### Invariants Enforced
- BR-ID-001 (Password Hash Never Plain): Credential verification never exposes plaintext passwords
- INV-004 (Multi-Tenant Isolation): Authenticated sessions are scoped to exactly one org_id
- INV-008 (Double Validation): Login requires both credential match and org_id resolution
- BR-ID-005 (Role Hierarchy): Admin can only create non-admin users; SuperAdmin creates all roles

---

### Port-005: AuthorizationPort

**Purpose**: Abstract interface for evaluating RBAC permissions against user contexts and resource scopes. Determines whether a user has the required permission grant for a given action on a resource.

**Defined By**: API-CONTRACT-004 (Authorization Mapping)

**Consumers**: API Layer (authorization gateway), all Application Services (permission verification)

**Data Manipulated**: User role context, permission strings (format: resource:action:level), organization scope, resource identifiers

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| hasPermission(userContext, permission, resourceContext) | User identity + org scope, permission string (resource:action:level), resource identifier context | boolean | Evaluate whether the user holds the required permission for the given resource context |
| resolvePermissions(userContext) | User identity + org scope | list of permission grants | Return the complete set of permissions granted to the user based on their roles |
| checkRoleHierarchy(requestedRole, actorRole) | Requested target role, actor's current role | allowed: boolean | Verify that role assignment follows the RBAC hierarchy rules |

### Constraints
1. Permission evaluation is strictly based on RBAC roles defined in API-CONTRACT-004 — no ad-hoc authorization logic
2. org_id is always resolved from the authenticated session, never from user input
3. Wildcard permissions ("*:*:*") are allowed for superadmin but always audit-logged
4. Authorization decisions are instantaneous — no cross-aggregate side effects from permission checks alone
5. The port does not determine WHAT permissions exist; it evaluates pre-existing permission grants

### Invariants Enforced
- API-CONTRACT-004 Role Hierarchy: Superadmin > admin > treasurer > pastor > staff
- INV-004 (Multi-Tenant Isolation): All permission checks scoped to the authenticated org
- ACCESS-033 (Access Restriction): Audit query restricted to admin/auditor roles

---

### Port-006: ClockPort

**Purpose**: Abstract source of canonical timestamps for all system operations. Ensures time determinism across all layers and enables injection of test time.

**Defined By**: All Aggregates requiring timestamps (creation dates, modification dates, sync timestamps, retention periods)

**Consumers**: All Application Services, all Aggregates (via application service delegation)

**Data Manipulated**: Instantaneous timestamp values

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| now() | (none) | deterministic timestamp | Return the current canonical time as a timestamp value |

### Constraints
1. All timestamps flowing through ANY Port must originate from ClockPort.now() — no exceptions
2. Adapters implementing this port must NOT call system time directly; they receive time from this port
3. The same ClockPort instance must be injectable in tests with fixed time values
4. Timestamp format is ISO-8601 compatible and UTC-based

### Invariants Enforced
- PA-NB-010 (Time Determinism): All timestamps originate from ClockPort
- BR-RES-004 (No Future Dates): Dates validated against ClockPort output, never system clock
- BR-SYNC-004 (Sync Timestamps): _sync_timestamp and _local_timestamp use ClockPort values

---

### Port-007: UUIDPort

**Purpose**: Abstract generator of unique identifiers for domain entities. Decouples primary key generation from any specific ID strategy.

**Defined By**: Schema Pack (primary keys are UUIDs)

**Consumers**: All Application Services creating new entities/aggregates

**Data Manipulated**: UUID values (128-bit)

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| generate() | (none) | unique identifier string | Produce a globally unique 128-bit identifier compatible with UUID v4 format |

### Constraints
1. Generated identifiers must be deterministic-free (random) to prevent prediction attacks
2. Compatible with standard UUID v4 format — 36-character hyphenated string representation
3. Collision probability must be negligible: fewer than 1 collision in 2^61 generated IDs
4. Must support deterministic ID generation when needed (e.g., for testing or idempotency keys)

### Invariants Enforced
- SM-001 (Semantic Integrity): UUIDs used consistently as primary keys across all aggregates
- NB-PERSIST-004 (No Cross-Aggregate Dependencies in Storage): UUIDs are the ONLY cross-aggregate reference mechanism

---

### Port-008: ConfigurationPort

**Purpose**: Abstract interface for reading and updating organization-level configuration settings. Provides a single point of access to currency, timezone, language, formatting, and performance settings.

**Defined By**: ConfigurationAggregate, DOC-017 Persistence Strategy

**Consumers**: All Application Services (reading settings), OrganizationService, ConfigurationService

**Data Manipulated**: SettingKey/SettingValue pairs where value is a JSONB-compatible structured data type

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| getSetting(key, org_id) | Setting key string + organization scope | SettingValue (typed: string/number/boolean/object/null) | Read a single setting value for the given organization |
| getAllSettings(org_id) | Organization scope | Map of all SettingKey/SettingValue pairs | Read all settings for the given organization |
| updateSetting(key, value, org_id) | Setting key, validated value, organization scope | void | Update a single setting value with format validation |
| bulkUpdateSettings(pairs, org_id) | List of key-value pairs + organization scope | void | Atomically update multiple settings |
| resetToDefaults(org_id) | Organization scope | void | Reset all settings to template default values |
| getDefaultSetting(key) | Setting key string | SettingValue | Read the template/system default for a setting (fallback when org override not set) |

### Constraints
1. Every setting has a default fallback value defined in the manifest — missing values are never null
2. Format validation for settings (ISO 4217 currency, IANA timezone, hex color) is enforced at the port contract level before persistence
3. Settings changes emit SettingUpdated events through EventPublicationPort
4. Cache local if available, but always falls back to persistence as the source of truth
5. Bulk updates are atomic: all succeed or none are applied

### Invariants Enforced
- CFG-001 (Currency ISO 4217): Currency values validated against ISO standard codes
- CFG-002 (Timezone IANA): Timezone values validated against IANA database names
- CFG-003 (Accent Color Hex + WCAG): Hex color validated with pattern check and contrast requirement
- CFG-004 (Default Fallback): Every setting has a default; never returns null for a valid key

---

### Port-009: LoggingPort

**Purpose**: Abstract system-wide journaling facility for diagnostic information, warnings, errors, and debug output. Used by all layers but never blocks execution.

**Defined By**: Architecture Requirements (system-wide observability)

**Consumers**: All Application Services, all Adapters, Infrastructure components

**Data Manipulated**: Message strings with optional context objects and exception data

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| info(msg, context?) | Informational message + optional structured context | void | Record a normal operational event at informational level |
| warn(msg, context?) | Warning message + optional structured context | void | Record a concerning condition that does not prevent operation |
| error(msg, exception?, context?) | Error message + optional exception data + context | void | Record a failure condition requiring investigation |
| debug(msg, context?) | Debug message + optional structured context | void | Record detailed diagnostic information (development/testing only) |
| logStructured(eventType, data) | Typed event name + structured data object | void | Record a structured, queryable event with typed fields |

### Constraints
1. All logging is asynchronous — the calling code never waits for log persistence to complete
2. No business logic is contained in log messages — only operational state changes
3. PasswordHash, JWTToken, and other sensitive Value Objects from DOC-012 must never appear in log data
4. Logging failures are silently handled — a logging failure must NEVER cause the calling operation to fail
5. Log levels are configurable at runtime through a separate mechanism

### Invariants Enforced
- BR-ID-001 (Credential Privacy): Sensitive credential data excluded from all log output
- Security Requirement: Logging port must redact any Value Object marked as sensitive in DOC-012

---

### Port-010: AuditPort

**Purpose**: Abstract interface for appending immutable audit log entries recording who did what, when, and what changed. The sole write channel for the AuditAggregate's append-only log.

**Defined By**: AuditAggregate (DOC-012), NB-PERSIST-006 (Immutable Log exclusive to AuditAggregate)

**Consumers**: All Application Services (auto-invoked after state changes), WorkflowAggregate (execution trace), NotificationAggregate (delivery status)

**Data Manipulated**: Audit entry fields including action type, entity type, entity ID, old values snapshot, new values snapshot, actor ID, organization ID, timestamp

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| log(action, entityType, entityId, oldValue, newValue, actorId, orgId) | Action type enum + entity type + entity identifier + old state snapshot + new state snapshot + actor identity + organization scope | void | Append an immutable audit log entry with full before/after snapshot |

### Constraints
1. IMMUTABLE — entries are appended only. Never UPDATE or DELETE any audit entry. Ever.
2. Both old_values AND new_values must ALWAYS be captured for every mutation audit entry
3. Entries are appended immediately upon state change (before persistence completion — parallel append)
4. Audit entries must include minimum 7 years of retention capability (configurable via Policy)
5. Access to audit entries restricted to admin/auditor roles only (RBAC enforced by Application Service)
6. AuditAggregate does NOT audit itself — preventing infinite recursion
7. Self-audit disabled to prevent infinite recursion

### Invariants Enforced
- BR-AUD-001 (Immediate Logging): Actions logged immediately upon state change, before persistence
- BR-AUD-002 (Full Snapshot): Old AND new values always captured — partial snapshots rejected
- BR-AUD-003 (7-Year Minimum Retention): Configurable but never less than 7 years
- BR-AUD-004 (Impossibility of Modification): Zero mutation paths exist on any audit entry
- BR-AUD-005 (Access Restriction): Admin/auditor role required for audit queries
- NB-PERSIST-006: Immutable Log exclusive to AuditAggregate

---

### Port-011: NotificationPort

**Purpose**: Abstract interface for sending multi-channel notifications to users. Manages notification delivery respecting user preferences, rate limits, and quiet hours policies.

**Defined By**: NotificationAggregate, DOC-017 Persistence Strategy

**Consumers**: NotificationService, WorkflowService (notification steps), External system triggers

**Data Manipulated**: Notification data including recipient ID, channel type, subject/body (FR+EN), severity level, rate limit context

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| send(toUserId, subjectFr, subjectEn, bodyFr, bodyEn, channel, severity, contextData) | Recipient identity + bilingual content + channel type + severity level + contextual data | sentSuccessfully: boolean | Dispatch a notification through the specified channel respecting user preferences |
| queueForOffline(toUserId, payload) | Recipient identity + notification payload | queueId: string | Queue notification locally when network unavailable for later delivery |
| markAsRead(notificationId, userId) | Notification identifier + user identity | void | Mark a delivered notification as read by the specified user |
| updatePreferences(userId, preferences) | User identity + preference changes (channels[], severityMin, rateLimitH) | void | Update a user's notification channel preferences |

### Constraints
1. Every notification MUST have a trigger — spontaneous notifications are prohibited (NOT-001)
2. Rate limiting is enforced per user and per org (NOT-002)
3. In-app notifications are ALWAYS delivered, even offline (BR-NOT-003, INV-003)
4. Push/email/SMS channels fail gracefully if unavailable (BR-NOT-004)
5. Critical severity bypasses quiet hours (BR-NOT-005)
6. Respect user channel preferences — never force a channel the user has disabled (CHANNEL-003)

### Invariants Enforced
- NOT-001 (Always Triggered): Every notification has a documented trigger source
- RATE-002 (Rate Limiting): Configurable per user/org, never exceeded
- CHANNEL-003 (Channel Preference): User preferences respected for channel selection
- QUIET-004 (Quiet Hours): Respected except for critical severity notifications
- SYNC-004 (Never Block User Ops): Notification failures never block the initiating user operation

---

### Port-012: SearchPort

**Purpose**: Abstract interface for full-text search and filtered queries across domain entities. Provides search capabilities that are eventually consistent with the primary data store.

**Defined By**: Query operations on ResourceAggregate (SearchResources), VocabularyAggregate (SearchTerms), LifecycleAggregate (SearchArchives)

**Consumers**: ResourceService, VocabularyService, LifecycleService

**Data Manipulated**: Search queries, filter criteria, pagination parameters, search result sets matching entity shapes

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| search(entityType, query, filters, pagination, org_id) | Entity type + full-text query string + structured filters + pagination config + organization scope | SearchResults (list of matching entities with relevance metadata) | Execute a full-text search across entities of the specified type within the org boundary |
| searchAdvanced(criteria) | Advanced search criteria (multi-entity, facets, aggregation) | AggregatedSearchResults | Execute complex searches across multiple entity types with faceted results |
| index(entityType, entityId, data) | Entity type + entity identifier + searchable data payload | void | Add or update a searchable index entry for the specified entity |

### Constraints
1. SEARCHING is NOT authoritative — results are eventually consistent with the primary store
2. All searches MUST be scoped to org_id — zero cross-org search results possible
3. Search results reflect approved/synced data only (SYNCED-001: only synced=1 transactions participate)
4. Search is a read-only operation — never triggers mutations or events
5. Index updates happen asynchronously via Domain Events, not synchronously with writes

### Invariants Enforced
- INV-004 (Multi-Tenant Isolation): All searches scoped to exactly one org_id
- SYNCED-001 (Approved Only): Reports and searches include only synced/approved data
- EXPORT-001 (Export Timestamped): When search results are exported, timestamp is included

---

### Port-013: FileStoragePort

**Purpose**: Abstract interface for storing and retrieving binary file content associated with forms (file_upload fields) and archives (url_pieces_jointes). Handles MIME type validation, size limits, and virus scanning acceptance criteria.

**Defined By**: FormAggregate (field type: file_upload), LifecycleAggregate (attachment URLs)

**Consumers**: FormService (form submission with file fields), LifecycleService (archive attachments)

**Data Manipulated**: Binary content with MIME type, size metadata, content disposition, Virus scan result flag

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| upload(contentType, content, metadata, org_id) | MIME type + binary content + structured metadata + organization scope | storageId: string | Accept and store binary content after passing size and content-type validation |
| download(storageId, org_id) | Storage identifier + organization scope | binary content + metadata | Retrieve previously stored content with org isolation enforcement |
| delete(storageId, org_id) | Storage identifier + organization scope | void | Permanently remove stored content (irreversible, audit-logged) |
| validateUpload(contentType, contentSize) | Content type + content size in bytes | isValid: boolean, rejectionReason? | Pre-validation check before upload to reject oversized or invalid content types early |

### Constraints
1. Maximum file size limits are configured per setting — never hardcoded in adapters
2. Virus/malware scanning must pass before content is accepted for storage (scan result checked before upload completes)
3. Content-type validation must match actual content, not just the provided MIME type header
4. File retrieval respects org_id isolation — users cannot download files from other organizations
5. Stored content is immutable after upload — updates require delete + re-upload

### Invariants Enforced
- FRM-001 (Vocabulary-backed): File field options sourced from vocabulary, not hardcoded
- Organization-scope isolation enforced by org_id parameter on every operation
- Sensitive file content never appears in logs or error messages

---

### Port-014: CachePort

**Purpose**: Abstract interface for distributed caching of frequently accessed, infrequently changing data. Reduces load on the primary data store for hot-read scenarios.

**Defined By**: Performance optimization layer (applied selectively where read patterns justify caching)

**Consumers**: VocabularyService (term label resolution), ReportingService (balance calculation cache), OrganizationService (org profile cache)

**Data Manipulated**: Serialized key-value pairs with optional TTL metadata

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| get(key) | Cache key string | cached value or null | Retrieve a value from cache; returns null if not present or expired |
| set(key, value, ttlSeconds) | Cache key + serialized value + time-to-live in seconds | void | Store a value in cache with expiration after the specified number of seconds |
| invalidate(pattern) | Key pattern (glob-style or exact) | void | Remove all cache entries matching the given pattern |
| exists?(key) | Cache key string | boolean | Check if a key is present and not yet expired without retrieving the value |

### Constraints
1. CACHE IS NEVER THE SOURCE OF TRUTH — if cache miss or inconsistency detected, always fall back to RepositoryPort
2. Cache invalidation must precede repository updates to prevent stale reads
3. TTL values must respect domain requirements — never extend cache lifetime beyond data staleness tolerance
4. Cache operations are best-effort — failures must never cause application errors
5. Cached data is serialized; deserialization is the adapter's responsibility, not the consumer's

### Invariants Enforced
- INV-004 (Multi-Tenant Isolation): Cache keys include org_id to prevent cross-org cache pollution
- Versioning Policy (INV-010): Cached entities include version field; stale versions invalidated on update

---

### Port-015: TransactionManagerPort

**Purpose**: Abstract interface for coordinating transactions across multiple repositories when a single operation requires writing to more than one Aggregate's data. Supports the Saga pattern for cross-aggregate operations.

**Defined By**: WorkflowAggregate (multi-step workflows), ResourceAggregate (compensating transactions), OfflineSyncAggregate (batch confirmations)

**Consumers**: Application Services executing cross-aggregate workflows (WorkflowService, LifecycleService, OfflineSyncService)

**Data Manipulated**: Transaction state machine (begin/commit/rollback), saga compensation steps

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| begin() | (none) | transaction context handle | Start a new coordinated transaction spanning multiple Aggregate boundaries |
| commit(ctx) | Transaction context handle | void | Commit all operations registered within the transaction context |
| rollback(ctx) | Transaction context handle | void | Roll back all operations registered within the transaction context |
| registerCompensation(ctx, compensateAction) | Transaction context + compensating action definition | void | Register a compensating action to execute if the transaction must be rolled back |

### Constraints
1. Supports the Saga pattern: each step can have a compensating action registered; if any step fails, all previous steps are compensated in reverse order
2. No individual repository write is visible to external readers until commit — partial writes are invisible
3. Transaction context carries saga step information for error reporting and retry logic
4. Timeout handling: transactions that exceed a configured maximum duration are automatically rolled back
5. Cross-aggregate coordination via transactions is rare — default to event-driven eventual consistency when possible

### Invariants Enforced
- WF-005 (No Financial Modification): Workflows never modify approved transactions directly — transactions provide the guard, not the TransactionManager
- M-008 (Transactional Consistency): Transactions never cross Aggregate boundaries in violation of DOC-018 constraint M-008
- COMP-001 (Transaction Compensation): Compensating transactions properly linked to originals

---

### Port-016: PersistenceVerificationPort

**Purpose**: Abstract interface for verifying data integrity post-migration or during infrastructure health checks. Provides read-only schema and data verification capabilities.

**Defined By**: Infrastructure health check, migration validation (DOC-020 PDM Validation Report)

**Consumers**: Deployment scripts, migration validators, infrastructure operators (never Application Services)

**Data Manipulated**: Schema metadata only — table names, column definitions, row counts, constraint definitions

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| verifyTableExists(tableName) | Table/storage unit name | present: boolean | Check if a specific table or storage unit exists in the persistent store |
| verifyColumns(table, columns[]) | Table name + list of expected column names | results: {column: name, exists: boolean}[] | Verify that each expected column exists in the specified table |
| verifyRowCount(table, expectedCount) | Table name + expected minimum row count | count: integer, meetsExpectation: boolean | Verify that a table has at least the expected number of rows |
| verifyConstraint(table, constraintName) | Table name + constraint identifier | present: boolean, valid: boolean | Verify a specific constraint (unique, check, foreign key) exists and is valid |

### Constraints
1. READ-ONLY — this port performs zero mutations under any circumstance
2. Only verifies schema metadata and row counts — never inspects business data content
3. Designed for infrastructure and migration validation — never called during normal application operation
4. Results are informational only — callers decide remediation actions

### Invariants Enforced
- DOC-020 Validation: Every Physical Object from DOC-021 must have a corresponding verified table
- NB-PERSIST-010 (No Technology in Domain): Verification runs exclusively in the Infrastructure layer

---

### Port-017: VocabularyAccessPort

**Purpose**: Abstract interface for efficient access to vocabulary data (namespaces, terms, term values, translations). Provides the read channel for all vocabulary lookups used by forms, reports, and resource categorization.

**Defined By**: ResourceAggregate (category references via vocab_values), FormAggregate (select options from vocabulary)

**Consumers**: ResourceService (transaction category validation), FormService (form rendering with vocabulary-backed selects), ReportingService (category breakdown colors)

**Data Manipulated**: Vocab namespace structures, term definitions with FR+EN labels, term values with colors and metadata, deprecated flags

### Contract

| Method Signature | Input Type | Output Type | Purpose |
|-----------------|------------|-------------|---------|
| getNamespace(orgId, namespaceKey) | Organization scope + namespace key string | Namespace definition (id, key, terms[], isActive) | Retrieve a vocabulary namespace within the given organization |
| getTerms(namespaceId) | Namespace identifier | List of Term definitions (key, labelFr, labelEn, deprecated) | Retrieve all terms within a specific namespace |
| getValues(termId) | Term identifier | List of TermValue definitions (key, labelFr, labelEn, color, metadata) | Retrieve all values (including deprecated) for a specific term |
| resolveLabel(namespaceKey, termKey, lang, orgId) | Namespace key + term key + language + org scope | resolved label string | Resolve a display label for a given term in the requested language |
| searchTerms(query, namespaceKey?, orgId) | Search query + optional namespace filter + org scope | Matching Term definitions | Search terms across namespaces matching the query string |
| getAllNamespaces(orgId) | Organization scope | List of all namespace keys and metadata | Retrieve all namespaces for an organization (with global fallback) |

### Constraints
1. READ-ONLY for application code — modifications must go through VocabularyAggregate's own commands
2. Deprecated values are always included in results but flagged — UI must decide display based on deprecation status
3. Keys are stable forever (BR-VOC-003) — code must never key off labels
4. Minimum FR+EN translations guaranteed (BR-VOC-002) — resolveLabel with unsupported language returns error, never empty string
5. If a referenced term does not exist, an explicit error must be returned (BR-VOC-004), not silent failure
6. Terms are namespaced per organization with fallback to global defaults

### Invariants Enforced
- STABLE-003 (Key Stability): Term keys never change — code must be resilient to label changes only
- TRANSLATION-002 (Minimum FR+EN): Every term has both French and English labels
- VOC-001 (Never Delete): Deprecated terms remain accessible via port queries
- CAT-001 (Category from Vocabulary): Resource transactions reference vocabulary categories exclusively

---

## PORT COVERAGE MATRIX

Every Aggregate and Application Service dependency mapped to Ports:

| Aggregate / Service | RepositoryPort | EventPublication | EventSubscription | IdentityProvider | Authorization | Clock | UUID | Config | Logging | Audit | Notification | Search | FileStorage | Cache | TxnMgr | PersistenceVerify | VocabAccess |
|---------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| OrganizationService | X | X | - | - | X | X | X | X | X | X | - | - | - | X | - | - | - |
| IdentityService | X | X | - | X | X | X | X | - | X | X | - | - | - | X | - | - | - |
| ResourceService | X | X | X | - | X | X | X | - | X | X | - | X | - | X | - | - | X |
| RelationshipService | X | X | - | - | X | X | X | - | X | X | - | - | - | X | - | - | - |
| WorkflowService | X | X | X | - | X | X | X | - | X | X | X | - | - | X | X | - | - |
| FormService | X | X | - | - | X | X | - | X | X | X | - | - | X | X | - | - | - |
| NotificationService | X | X | - | - | X | X | - | X | X | X | X | - | - | X | - | - | - |
| VocabularyService | X | X | - | - | X | X | - | - | X | X | - | X | - | X | - | - | X |
| ReportingService | X | X | - | - | X | X | - | X | X | X | - | - | - | X | - | - | - |
| AuditService | X | X | - | - | X | X | - | - | X | X | - | - | - | X | - | - | - |
| LifecycleService | X | X | - | - | X | X | X | - | X | X | - | X | X | X | - | - | - |
| ConfigurationService | X | X | - | - | X | X | - | X | X | X | - | - | - | X | - | - | - |
| OfflineSyncService | X | X | X | - | - | X | X | - | X | X | - | - | - | X | X | - | - |

Key: X = Port required/consumed by this service | - = Port not consumed by this service

Total Ports: **17**. Total Aggregate coverage: **100%**. Total operation coverage: **83 operations across all 13 Aggregates**.

---

## COMPLIANCE STATEMENT

This document defines exactly 17 Ports covering every dependency identified across the 13 Aggregates, 83 API operations, 60 Domain Events, and 58 Invariants of the Lumina architecture.

No Port was invented beyond what is required by existing specifications.
No Port contains business logic.
No Port references specific technology, framework, or programming language.
All Ports accept primitive types, structured DTOs, or generic collections.
All Ports include org_id scoping where tenant-isolated data is involved.

Every Port traces to at least one canonical source: DOC-012, DOC-013, DOC-014, DOC-015, DOC-017, DOC-019, DOC-021, ASS-001, ASS-003, ASS-004, or API-CONTRACT-004.
