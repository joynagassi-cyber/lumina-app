# Adapter Categories

**Doc ID:** PAS-002
**Version:** v1.0
**Statut:** SPECIFICATION CANONIQUE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** ports-adapters-specifier v1.0
**Source canonique :** ["PAS-001", "DOC-017", "DOC-019"]
**Transformation_rule :** "ports-adapters-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **Adapter Categories** for each Port defined in PAS-001. An Adapter Category describes an ABSTRACT CLASS of implementation — it specifies WHEN to use a particular kind of adapter and WHAT characteristics distinguish it from other adapters implementing the same Port.

**IMPORTANT: No specific technology is named in this document.** PostgreSQL, Redis, Kafka, RabbitMQ, DynamoDB, Elasticsearch, Docker, Spring, Hibernate, EF Core, Prisma, Drizzle, Sequelize, and all other technology names are intentionally excluded. This document describes categories, not implementations.

Every Port has at least 2 adapter categories. Some have more.

---

## GLOBAL CONSTRAINTS FOR ALL ADAPTERS

Every Adapter implementing any Port in PAS-001 must satisfy these constraints:

1. Must NOT leak implementation details to consumers — consumers interact only with the Port interface
2. Must NOT contain business logic — all rules live in Aggregates (DOC-012) and invariant guards (DOC-015)
3. Must handle all error conditions gracefully with standard error translations
4. Must be swappable without changing any consumer code — swapping one adapter for another requires zero changes to Application Service or Domain code

---

## PORT-001: RepositoryPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| In-Memory | Adapter that stores entities in process-memory data structures (maps, lists). Lifecycle is tied to the running process. Data is lost on restart. | Zero infrastructure dependency; deterministic ordering; fast reads/writes; no persistence across process boundaries. | Automated testing; development environments; prototype validation |
| Relational Store | Adapter using a tabular store with structured records, foreign keys, and ACID transactions. Each Aggregate boundary maps to one or more tables/collections of rows. | Strong consistency; supports structured queries via query criteria; enforces referential integrity through constraints; transactional writes. | Production deployments requiring strong consistency and ACID guarantees |
| Document Store | Adapter using a document-oriented store where each Aggregate root or entity is persisted as a self-contained document. Embedded children stored within parent document. | Flexible schema evolution; natural fit for embedded and collection patterns; single-document atomicity; document-level versioning support. | Deployments favoring schema flexibility and denormalized read patterns |
| Key-Value Store | Adapter using a simple key-to-value mapping where entities are identified by UUID and stored as serialized values. Complex queries handled by maintaining secondary indexes. | Ultra-fast point lookups by ID; simple write path; secondary index maintenance for findByCriteria operations. | High-throughput point-lookup scenarios; cache-adjacent storage |

### Constraints for ALL Adapters implementing RepositoryPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Must always inject org_id into every query filter (SM-004)
- Must strip persistence metadata (_persist_version, _sync_timestamp, _tombstone) before returning entities to consumers (PA-NB-007)

---

## PORT-002: EventPublicationPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Synchronous Dispatcher | Events delivered to all subscribers before the publish method returns. All handlers execute in sequence within the same call stack. | Immediate delivery; blocking semantics; guaranteed in-order processing; failures in one handler block subsequent handlers unless isolated. | Single-process applications where event processing latency is acceptable |
| Asynchronous Message Bus | Events published to a message queue/intermediary and delivered asynchronously. The publish method returns immediately after enqueuing. | Decoupled timing; reliable delivery even if subscribers are down; parallel subscriber processing; at-least-once delivery guarantee. | Distributed systems where event producers and consumers operate independently |
| Event Log Adapter | Events appended to an immutable, ordered log stream. Subscribers consume from their own position in the log (offset tracking). | Complete replay capability; exact ordering preserved; durable history; new subscribers can catch up from any point. | Systems requiring audit trail reconstruction or event replay from any historical point |
| In-Memory Broker | Events distributed through an in-process event map. Publishers and subscribers share the same memory space. | Zero network overhead; fastest possible delivery; no durability guarantees; process lifecycle bound. | Testing, development, or single-process deployments where distribution is unnecessary |

### Constraints for ALL Adapters implementing EventPublicationPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Event payloads must exactly match DOC-014 schema — no field addition, removal, or modification
- At-least-once delivery is the minimum guarantee; duplicates must be tolerated by consumers

---

## PORT-003: EventSubscriptionPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Direct Method Binding | Handlers registered as direct references to methods/functions. Invocation is a direct function call within the same process. | Lowest latency; simplest to implement; tight coupling between event type and handler location. | Single-process applications with simple event routing needs |
| Topic-Based Registration | Handlers register interest by topic/event-type string. A central router matches incoming events to registered topic handlers. | Loose coupling; handlers discover events dynamically; easy to add/remove subscriptions at composition time. | Systems with many event types and many consumers needing selective subscriptions |
| Pattern-Match Routing | Handlers register with event type pattern strings (e.g., `finance:*:created`). Events matching the pattern route to the handler. | Flexible filtering without knowing exact event types; hierarchical event type namespaces support pattern prefixes. | Systems with namespaced event hierarchies (aggregate:type:action pattern) |
| Composite Handler Chain | Multiple handlers for the same event type are linked in a chain. Each handler processes and optionally transforms the event for downstream handlers. | Sequential processing pipeline; transformers can enrich or filter events before they reach next handler. | Cross-cutting concerns like audit logging + notification + sync triggered by same event |

### Constraints for ALL Adapters implementing EventSubscriptionPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Handler isolation: failure in one handler must not prevent other handlers from receiving the event
- Cannot invent new event types — only DOC-014-defined events may be subscribed to

---

## PORT-004: IdentityProviderPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Internal Credential Store | Authentication verified against credentials stored in the system's own persistence layer. Password comparison uses secure hashing. | Full control over credential storage; tight integration with organization model; credentials owned entirely by the system. | Standard user management within an organization's own identity system |
| External Identity Provider | Delegates authentication to an external authorization server (OAuth/OIDC provider). The system trusts the external provider's token validation. | Offloads credential storage to external service; supports social login; standard protocol interoperability. | Integration with existing enterprise identity systems (SAML, OIDC, OAuth2) |
| Token-Based Authentication | Authentication based on stateless cryptographic tokens. Token payload contains user claims; signature verification determines validity. | No session storage required; horizontally scalable; tokens self-contained with all necessary claims. | API-first architectures where statelessness is preferred |

### Constraints for ALL Adapters implementing IdentityProviderPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Never returns plaintext passwords in any response format
- JWT tokens are ephemeral and never stored plain — only their hashes are kept

---

## PORT-005: AuthorizationPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Role-Based Evaluator | Permissions evaluated against a user's assigned roles and the RBAC hierarchy defined in API-CONTRACT-004. Role-to-permission mappings stored in the system. | Standard RBAC model; hierarchical roles; wildcard permissions audited but allowed for superadmin. | Default authorization model for Lumina's five-role hierarchy |
| Permission Grant Validator | Evaluates explicit permission grants assigned to users, independent of role assignment. Supports fine-grained per-resource permissions. | Overrides or supplements role-based checks; supports resource-specific permissions beyond the role matrix. | Fine-grained access control where individual users need unique permissions |
| Context-Aware Gatekeeper | Evaluates permissions considering additional context: resource ownership, data scope (org/unit), operation type (read/write/admin), and temporal constraints. | Adds contextual dimensions to permission evaluation beyond simple role-to-permission matching. | Scenarios where access depends on who owns the resource being accessed |

### Constraints for ALL Adapters implementing AuthorizationPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- org_id never accepted as user input — always resolved from authenticated session

---

## PORT-006: ClockPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| System Clock | Returns the current system wall clock time. Simplest possible implementation. | Uncontrolled timing; cannot be influenced externally; suitable for production where monotonic clock behavior is expected. | Production deployments |
| Controlled/Fixed Clock | Accepts an externally set timestamp. The same "now" value is returned until explicitly changed. | Fully deterministic; enables time-travel testing; reproducible test outcomes regardless of when tests run. | Automated testing environments; regression test fixtures |
| Wall-Clock with Override | Returns system time by default but accepts an optional override that takes precedence when set. Falls back to system time when override is cleared. | Hybrid approach combining determinism for tests with normal operation for production. | Development/testing transitions where some tests need fixed time and others don't |

### Constraints for ALL Adapters implementing ClockPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Never calls system clock directly in consumer code — all timestamps flow through this port

---

## PORT-007: UUIDPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Random Generator | Produces identifiers using a cryptographically secure random number generator. 128 bits of entropy, compatible with UUID v4. | Unpredictable IDs; collision-resistant; no coordination needed between nodes. | Default production identity generation |
| Deterministic Hash | Generates identifiers deterministically from a combination of input data (aggregate type, org_id, sequence number). Same inputs produce same outputs. | Reproducible across environments; enables offline-to-online sync deduplication; predictable for testing. | Offline-sync scenarios requiring consistent IDs across local and remote instances |
| Sequential Identifier | Produces monotonically increasing identifiers optimized for storage engine performance (reduces fragmentation). | Better insert performance in ordered storage engines; lexicographically sortable. | Storage engines sensitive to insertion order performance |

### Constraints for ALL Adapters implementing UUIDPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Generated IDs must be compatible with UUID v4 format (36-character hyphenated string)

---

## PORT-008: ConfigurationPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Database-Backed Settings | Reads/writes settings to persistent storage. Each setting stored as a key-value pair scoped to an organization. Defaults loaded from manifest/template configuration. | Persistent across restarts; admin-modifiable at runtime; single source of truth for organizational settings. | Default production configuration storage |
| Manifest-Templated Settings | Loads settings from predefined template manifests. Organization-specific overrides applied on top of template defaults. Changes saved through a separate persistence mechanism. | Centralized template management; uniform baseline across organizations; override-only customization. | Multi-tenant deployments with template-driven baselines |
| In-Memory Cache with Persistence Fallback | Maintains a local in-process cache of settings. On cache miss or invalidation, falls back to persistent storage. Writes always go to persistence and update the cache. | Fast reads (cache hit); eventual cache consistency; automatic invalidation on settings updates. | High-read-frequency scenarios where settings change rarely |

### Constraints for ALL Adapters implementing ConfigurationPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Every setting has a default fallback (CFG-004); returning null for a valid key is forbidden

---

## PORT-009: LoggingPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Structured Text Logger | Writes human-readable formatted text lines to standard output or a file. Each line includes timestamp, level, and message. | Universal compatibility; easy to read manually; simple to integrate with log aggregation systems that parse text. | Basic deployments and local development |
| Structured Data Logger | Outputs machine-parsable structured data (key-value pairs or JSON-like objects) with typed fields for level, message, timestamp, and context. | Machine-consumable; precise field extraction; supports complex context nesting; easily ingested by structured log analytics platforms. | Production systems requiring automated log analysis and alerting |
| Asynchronous Buffer Logger | Buffers log entries in an in-process buffer and flushes them asynchronously. Guarantees zero blocking even under heavy log volume. | Non-blocking operation; batched writes for efficiency; back-pressure handling if downstream is unavailable. | High-volume logging scenarios where blocking would impact user-facing performance |
| Remote Log Forwarder | Sends log entries to a centralized logging service or platform over the network. Local buffering maintains entries during transient connectivity loss. | Centralized visibility across distributed deployments; searchable via remote platform's query interface. | Cloud-deployed or multi-node production systems |

### Constraints for ALL Adapters implementing LoggingPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Asynchronous: must never block the calling thread's execution

---

## PORT-010: AuditPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Append-Only Log Adapter | Appends each audit entry as a new record with a monotonic sequence number. No UPDATE or DELETE paths exist at the adapter level. | Immutable by construction; sequential ordering guaranteed; efficient append operations. | Default audit logging for compliance-sensitive operations |
| Batch-Append Adapter | Buffers multiple audit entries and appends them in a single batch operation. Preserves ordering within the batch. | Reduced write amplification; higher throughput for bulk audit scenarios; maintains per-entry timestamps. | High-volume operations that generate many audit entries simultaneously |
| Dual-Write Audit Adapter | Writes audit entries to both a primary immutable log and a secondary indexed view for efficient querying. Primary remains append-only; secondary supports filtered reads. | Optimizes read performance for audit queries without compromising append-only immutability of the primary log. | Systems requiring frequent audit log queries by date range or entity type |

### Constraints for ALL Adapters implementing AuditPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- IMMUTABLE: no UPDATE, no DELETE, no in-place replacement of any audit entry
- Self-audit disabled (NB-PERSIST-007): audit entries about audit entries are forbidden

---

## PORT-011: NotificationPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| In-App Notification Queue | Stores notifications in the application's own persistence layer. Delivered through the application's UI channel. Offline-first: available without network connectivity. | Guaranteed delivery within the system; works offline; respects user preferences natively. | Primary notification channel for all users — always available |
| External Push Service | Routes notifications through a third-party push notification service. Supports mobile device targeting and rich notification payloads. | Reaches devices outside the app; requires network connectivity; dependent on external service availability. | Mobile push notifications for real-time alerts |
| Email Gateway Adapter | Dispatches notifications through an SMTP-style mail gateway or email delivery service. Supports templated bilingual content (FR/EN). | Async delivery; works even if user is offline; supports richer content than push. | Email-based notifications for important system events |
| SMS Gateway Adapter | Routes notifications through a message gateway supporting text delivery to phone numbers. Limited payload size; per-message billing model. | Reaches users without internet or app installed; short-form messages only. | SMS alerts for critical notifications requiring immediate attention |

### Constraints for ALL Adapters implementing NotificationPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- In-app notifications ALWAYS delivered (BR-NOT-003, offline-first)
- External channels fail gracefully (BR-NOT-004)
- Critical severity bypasses quiet hours (BR-NOT-005)

---

## PORT-012: SearchPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| In-Memory Search Index | Maintains a search index in process memory built from domain events. Supports full-text queries against indexed entity fields. | Zero infrastructure dependency; instant availability; limited scalability (single process only). | Small-scale deployments or development/testing environments |
| Indexed Search Engine Adapter | Uses a dedicated search platform (text-indexed store) to provide full-text search capabilities. Index updated asynchronously via events from the primary store. | High-performance search at scale; advanced query syntax (fuzzy, prefix, boolean); faceted search support. | Large-scale production deployments with complex search requirements |
| Query-Build Projection Adapter | Builds optimized query predicates from search criteria and executes them against the primary store. Results are eventually consistent with indexed views. | No separate search infrastructure needed; leverages existing database query optimization; simpler deployment footprint. | Medium-scale deployments avoiding separate search platform investment |

### Constraints for ALL Adapters implementing SearchPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Search results are eventually consistent — never authoritative (SEARCHING is not authoritative)
- All searches MUST include org_id scope — zero cross-org leaks

---

## PORT-013: FileStoragePort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Blob Store Adapter | Uploads binary content to a cloud blob/object storage service. Content addressed by storage ID. Supports MIME type metadata and size-based access control. | Scalable to large files; CDN-friendly; highly durable; pay-per-use pricing. | Production file storage for form uploads and archive attachments |
| Hierarchical Filesystem Adapter | Stores files in a directory structure on a filesystem (local disk or network-mounted). Files organized by organization and entity type. | Simple mental model; POSIX-compatible operations; easy backup strategies. | Local deployments where infrastructure simplicity is prioritized |
| Stream-Based Storage Adapter | Accepts and serves file content through streaming I/O. Does not require holding entire file in memory. Processes chunks sequentially. | Memory-efficient for large files; supports progressive upload/download; suitable for very large attachments. | File sizes approaching streaming system limits |

### Constraints for ALL Adapters implementing FileStoragePort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Virus scanning must pass before acceptance
- Maximum size limits configurable — never hardcoded

---

## PORT-014: CachePort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| In-Process LRU Cache | Maintains a least-recently-used cache in memory with a maximum entry count. Entries evicted when capacity reached or TTL expires. | Zero external dependencies; fastest access time; process-bound (lost on restart); single-process only. | Single-instance production deployments or development environments |
| Distributed Cache Adapter | Connects to a distributed in-memory data store shared across multiple application instances. Consistent caching across the entire cluster. | Shared across instances; survives individual instance restarts; supports TTL and eviction policies at cluster level. | Multi-instance production deployments |
| Write-Through Cache Adapter | On write operations, updates both the cache and the backing store simultaneously. On read, cache first then fall back to store. | Strongest cache consistency; writes always reflected in store; slightly higher write latency. | Scenarios where cache and store must stay tightly aligned |
| Read-Through Cache Adapter | Cache only stores data retrieved from the store. No direct writes to cache — all cache population comes through a loader function. | Simpler invalidation reasoning; cache always derivable from store; no risk of stale writes in cache. | Read-heavy scenarios with infrequently changing data |

### Constraints for ALL Adapters implementing CachePort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Cache is NEVER the source of truth — always falls back to repository (PA-NB-008)
- Cache failures must never cause application errors (best-effort only)

---

## PORT-015: TransactionManagerPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Synchronous Transaction Coordinator | Coordinates a single ACID transaction spanning multiple repository writes within the same storage connection. All-or-nothing atomicity. | Strong consistency; simple model; blocked by slowest repository; single connection bound. | Cross-aggregate writes within the same storage unit (e.g., lifecycle + audit in one transaction) |
| Saga Orchestrator | Manages a sequence of steps where each step writes to a different Aggregate's repository. On failure, executes registered compensating actions in reverse order. | Eventual consistency across Aggregates; individual Aggregate transactions remain ACID; compensation handles failures. | Workflow approvals, multi-step form submissions, cross-aggregate resource operations |
| Outbox Pattern Adapter | Writes application data and event publication messages to an outbox table in a single transaction. A separate process publishes events from the outbox. | Combines local transaction atomicity with reliable event delivery; decouples data persistence from event dispatching. | Cross-aggregate operations requiring both data consistency and reliable event propagation |

### Constraints for ALL Adapters implementing TransactionManagerPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- Cross-aggregate transactions should be rare — prefer event-driven eventual consistency when possible
- Compensating actions are mandatory for Saga transactions (no partial commit accepted)

---

## PORT-016: PersistenceVerificationPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Schema Introspection Adapter | Queries the storage engine's system catalogs/metadata to verify table existence, column definitions, and constraint presence. | Relies on engine's built-in introspection mechanisms; no custom queries needed; fast verification. | Post-migration validation checks |
| Count-Query Verification Adapter | Executes COUNT queries against tables to verify row counts match expected minimums. Verifies structural properties indirectly. | Simple SQL queries only; no schema catalog access needed; works across all SQL-compatible stores. | Environments where schema metadata access is restricted |
| Infrastructure Health Check Aggregator | Combines multiple verification strategies (schema introspection + count queries + constraint checks) into a single health check endpoint. Returns pass/fail per aggregate's persistence requirements. | Comprehensive single-entry-point verification; reports specific failures per aggregate. | Deployment pipelines and pre-flight checks |

### Constraints for ALL Adapters implementing PersistenceVerificationPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- READ-ONLY: zero mutations of any kind under any circumstance

---

## PORT-017: VocabularyAccessPort — Adapter Categories

| Category | Description | Characteristics | Typical Use Case |
|----------|-------------|-----------------|------------------|
| Repository-Backed Vocabulary Adapter | Queries vocabulary data through the standard RepositoryPort using org-scoped read queries. Leverages existing persistence infrastructure. | No separate vocabulary store needed; shares persistence with rest of system; consistent org isolation. | Default category lookup used by forms and resources |
| Dedicated Vocabulary Index Adapter | Maintains a specialized indexed view of vocabulary data optimized for label resolution and search. Updated from vocabulary events. | Faster term resolution; supports full-text search across terms; pre-computed language-resolved labels. | High-frequency vocabulary access in form-heavy deployments |
| Cached Translation Resolver Adapter | Pre-resolves FR+EN label pairs into a local lookup cache. When vocabulary changes (TermAdded, LabelUpdated), invalidates and reloads the affected namespace. | O(1) label resolution after initial load; minimal store queries; supports offline vocab loading. | Form rendering scenarios requiring many rapid label resolutions |

### Constraints for ALL Adapters implementing VocabularyAccessPort
- Must NOT leak implementation details to consumers
- Must NOT contain business logic
- Must handle all error conditions gracefully with standard error translations
- Must be swappable without changing any consumer code
- READ-ONLY for application code — modifications flow through VocabularyAggregate commands only
- Deprecated values included but flagged (VOC-001)

---

## ADAPTER COVERAGE VERIFICATION

| Port | Number of Categories Defined | Minimum Required (2) | PASS/FAIL |
|------|-------------------------------|---------------------|-----------|
| Port-001 RepositoryPort | 4 | 2 | PASS |
| Port-002 EventPublicationPort | 4 | 2 | PASS |
| Port-003 EventSubscriptionPort | 4 | 2 | PASS |
| Port-004 IdentityProviderPort | 3 | 2 | PASS |
| Port-005 AuthorizationPort | 3 | 2 | PASS |
| Port-006 ClockPort | 3 | 2 | PASS |
| Port-007 UUIDPort | 3 | 2 | PASS |
| Port-008 ConfigurationPort | 3 | 2 | PASS |
| Port-009 LoggingPort | 4 | 2 | PASS |
| Port-010 AuditPort | 3 | 2 | PASS |
| Port-011 NotificationPort | 4 | 2 | PASS |
| Port-012 SearchPort | 3 | 2 | PASS |
| Port-013 FileStoragePort | 3 | 2 | PASS |
| Port-014 CachePort | 4 | 2 | PASS |
| Port-015 TransactionManagerPort | 3 | 2 | PASS |
| Port-016 PersistenceVerificationPort | 3 | 2 | PASS |
| Port-017 VocabularyAccessPort | 3 | 2 | PASS |

**Total: 17 Ports x 3-4 categories each = 57 distinct adapter categories.**
**All Ports meet the minimum 2-category requirement. COMPLIANT.**
