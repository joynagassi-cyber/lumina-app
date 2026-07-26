# Deployment Model — Lumina v1

**Doc ID:** DEP-SPEC-001
**Version:** v1.0
**Statut:** SPÉCIFICATION DÉPLOIEMENT DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-v1", "PAS-001", "ASS-001"]
**Transformation_rule :** "deployment-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## TABLE DES MATIÈRES

1. [Deployment Principles](#section-1-deployment-principles)
2. [Environment Types](#section-2-environment-types)
3. [Deployment Architecture](#section-3-deployment-architecture)
4. [Deployment Topology Options](#section-4-deployment-topology-options)
5. [Artifact Versioning](#section-5-artifact-versioning)
6. [Infrastructure Components Summary](#section-6-infrastructure-components-summary)

---

## SECTION 1: DEPLOYMENT PRINCIPLES

The following seven principles govern ALL deployment decisions for the Lumina platform. They are immutable, non-negotiable, and apply equally across every environment type and topology option defined in this document. Every subsequent deployment specification (DEP-SPEC-002 through DEP-SPEC-007) must uphold these principles without exception.

### P-001: Environment Parity

Staging MUST be identical to Production in terms of component topology, network configuration, and dependency relationships. The ONLY difference between environments is the VALUES used for configuration — connection strings, credential references, timeout thresholds, and feature toggles.

**Implication:** If a bug is reproducible in Production but not in Staging, the principle has been violated. Any discrepancy in component count, port exposure, or dependency chain between environments is treated as a P1 operational defect.

**Runtime Component Implications (from RTS-001):**
All 15 Runtime Components (CRT-001 through CRT-015) MUST exist in every environment. No runtime component is optional, conditional, or skippable based on environment type. This is a direct enforcement of OR-011 (Startup Sequence Determinism): the set of initialized components is constant `CONST_RUNTIME_COMPONENTS = [CRT-001..CRT-015]`.

**Port Coverage (from PAS-001):**
All 17 Ports (Port-001 through Port-017) MUST be bound to a concrete adapter category in every environment. The binding selection varies per environment (as documented in PAS-002 categories), but the binding existence does not.

### P-002: Infrastructure as Code

Every aspect of the Lumina deployment infrastructure MUST be expressed as a versioned, human-readable, machine-parsable artifact. Infrastructure state MUST NOT be managed through ad-hoc console operations, manual CLI commands, or undocumented procedures.

**Scope:** This principle covers network configuration, load balancing rules, database cluster topology, connection pool sizing, caching layer configuration, file storage bucket policies, and message bus partitioning. Each element is captured in an infrastructure artifact that is tracked alongside the application source code.

**Traceability Requirement:** Every infrastructure artifact line MUST reference the deployment specification section that mandates it. For example, a database cluster definition MUST cite `DEP-SPEC-001 §4` as its authority. This enables bidirectional traceability between architecture decisions and implementation artifacts.

### P-003: Zero-Downtime Deployments

Lumina services MUST remain AVAILABLE during deployment operations. Users and connected offline clients MUST NOT experience service interruption, error responses, or degraded connectivity during standard release cycles.

**Enforcement Mechanisms:**
- Rolling deployment: new instances replace old instances progressively, never all at once
- Readiness gates: no new instance receives traffic until its health check passes (CRT-007)
- Connection draining: existing connections complete before terminated instances shut down
- Blue-green capability: traffic routing can switch entire sets of instances atomically

**Grace Period (from OR-012):** During deployment shutdown of individual instances, the grace period MUST be maintained at a minimum of 30 seconds (`LUMINA_SHUTDOWN_GRACE_PERIOD_MS >= 30000`). This ensures in-flight requests complete before the instance is removed from the load balancer pool.

### P-004: Immutable Artifacts

A deployed build artifact NEVER changes after publication. Once an artifact is tagged and pushed to the deployment registry, it is cryptographically immutable. The same artifact SHA-256 deployed to Development MUST produce the identical behavior when subsequently deployed to Staging and Production.

**Versioning Rule:** Every artifact is identified by both its semantic version (`X.Y.Z`) and its content hash (`SHA-256`). The content hash is the source of truth — if two artifacts have the same semantic version but different hashes, they are different releases.

**Reproducibility (from OR-011 §Reproducibility Test):** Starting the same artifact N times (N>=3) with identical configuration MUST produce identical initialization logs, identical component assembly order, and identical health check results. Any variance indicates a violation of the determinism invariant.

### P-005: Configuration Separation

Code NEVER contains environment-specific configuration. All settings that differ between Development, Staging, and Production — database connection strings, API endpoints, secret references, feature flag values, rate limits, timeouts — are externalized into configuration artifacts that are injected at deployment time.

**Configuration Priority (from CRT-005):**
1. Environment-specific configuration file (highest priority)
2. Environment variables
3. Template defaults (lowest priority)

This priority order is enforced at the ConfigurationLoader (CRT-005) level. The ConfigSnapshot produced is IMMUTABLE after initialization (Phase 101 completion).

**Security Rule:** Secrets (passwords, API keys, encryption keys, certificates) are NEVER stored in configuration files. They are referenced by secure key paths only. The actual secret values are resolved at runtime by a secrets manager (see DEP-SPEC-003).

### P-006: Rollback Safety

Every deployment operation MUST include a verified rollback plan BEFORE execution begins. The rollback plan specifies: which previous artifact to revert to, in what order components are restored, what data migration state is expected, and how to verify post-rollback health.

**Rollback Triggers (from OR-011):** Post-deployment health monitoring detects failures within the first 5 minutes. Automatic rollback triggers activate on:
- Error rate exceeding 1% of total requests
- P99 latency exceeding 2x the baseline measured during last known-good deployment
- Health check failures on any critical port (RepositoryPort, EventPublicationPort, IdentityProviderPort)

**No Partial State:** Rollback reverts to the EXACT previous artifact. No incremental rollback or partial downgrade is performed. The previous artifact is preserved for a minimum of 30 days after deployment.

### P-007: Multi-Tenant by Design

All deployment infrastructure MUST enforce tenant isolation at every architectural layer. Tenant data (org_id-scoped) MUST NEVER be accessible outside its organizational boundary, regardless of deployment topology.

**Isolation Levels (from INV-004, DR-009):**
- **Logical isolation (minimum):** All queries include org_id WHERE clause injection (enforced by CRT-015 TenantContextProvider via thread-local/async-local storage)
- **Physical isolation (optional):** Separate database schemas or physical databases per tenant for high-compliance environments
- **Network isolation (optional):** VPC peering or namespace separation per tenant group

**Tenant Context Propagation (from OR-010):** The org_id resolved from authentication context propagates to ALL data access operations. It is NEVER derived from user-supplied input. This rule holds across all deployment topologies and environment types.

---

## SECTION 2: ENVIRONMENT TYPES

Lumina operates across four distinct environment types, each serving a specific purpose in the software delivery lifecycle. Each environment runs the FULL complement of 15 Runtime Components and 17 Ports as defined in RTS-001 and PAS-001. No environment omits or conditionally disables any runtime component.

### Environment 1: Development

**Purpose:** Individual developer work, feature implementation, unit testing, and local integration verification.

**Infrastructure Scope:**
- Single-node application deployment
- Embedded database (single-file persistent store)
- In-memory event bus
- Local file storage backend
- In-memory LRU cache
- Console-only logging output
- No external notification adapters (disabled)

**Configuration Sourcing:**
- Default template values dominate
- Optional local override file (`lumina.development.local.json`) merged with lowest priority
- All credentials sourced from local environment variables (never committed)
- Feature flags predominantly enabled for active development branches

**Monitoring Level:** Minimal. Health checks run on startup only (Phase 105). No continuous polling. Diagnostics available via `/debug/dump` endpoint during session lifetime. Logging level set to DEBUG.

**Data Lifecycle Policy:**
- Database file persists across restarts within a development session
- Data is regenerated fresh for each new development branch checkout
- Local seed data populated from synthetic datasets
- No replication, no backup requirement
- Automatic purge of all data on branch deletion (developer responsibility)

**Access Control:**
- Unrestricted access for developers on the team
- Authentication may be bypassed via local development mode (configured per project convention)
- Correlation IDs auto-generated (no real authentication required)

**Runtime Component Notes:**
- CRT-003 TransactionCoordinator operates with simplified single-aggregate transactions only
- CRT-004 EventDispatcher uses in-memory pub/sub (no dead-letter queue persistence)
- CRT-013 IdempotencyManager uses shorter TTL (default 1 minute instead of 5 minutes)
- CRT-014 AuditEnabler writes to console log only (not persisted)
- CRT-007 HealthMonitor performs one-time startup check only (Phase 105 equivalent), no polling

### Environment 2: Staging

**Purpose:** Integration testing, quality assurance validation, user acceptance testing, pre-release verification, and performance benchmarking.

**Infrastructure Scope:**
- Minimum 2-node application cluster (for load balancer failover testing)
- Clustered database with primary + read replica
- Dedicated message bus with dead-letter queue support
- External file storage service
- Remote cache layer
- All notification adapters configured (SMTP test endpoint, push sandbox)
- Full health monitoring with continuous polling

**Configuration Sourcing:**
- Production-like configuration template
- Values populated from staging-specific configuration store
- Secret references point to staging secrets vault
- Feature flags mirror production state (or explicitly differ for staged features)
- Same configuration format and priority order as Production (CRT-005)

**Monitoring Level:** Full. Health checks poll continuously (configurable interval, default 30 seconds). All 10 ports monitored (PHASE-005 Phase 105 equivalent at startup + continuous CRT-007 polling). Diagnostics exposed at `/health`, `/metrics`, `/debug/dump`. Alerting configured for degraded/unhealthy states.

**Data Lifecycle Policy:**
- Seeded with production-like synthetic dataset that mirrors production data distribution and volume
- Data refreshed weekly from anonymized production snapshot
- Retention policy matches Production (7-year audit retention, configurable purge schedules)
- Soft deletes honored with proper lifecycle transitions
- Backup runs daily at midnight local time

**Access Control:**
- QA team has full read/write access
- Product owners have read access plus UAT test account credentials
- Restricted API access (rate-limited to internal network)
- All requests require authenticated sessions with valid JWT tokens containing org_id

**Runtime Component Notes:**
- All 15 CRTs operate in their canonical configuration
- CRT-003 supports cross-aggregate sagas (linear, parallel, compensating patterns)
- CRT-004 dead-letter queue persisted to FileStoragePort
- CRT-012 RetryPolicy at full capacity (max 5 retries, exponential backoff)
- CRT-014 AuditEnabler fully functional (persisted, 7-year retention)
- CRT-009 Scheduler running all 6 scheduled jobs (health polling, sync push, purge, session cleanup, balance refresh, conflict detection)

### Environment 3: Production

**Purpose:** Live customer traffic, real data processing, revenue-generating operations.

**Infrastructure Scope:**
- Minimum 3-node application cluster (regardless of topology pattern chosen)
- Database cluster matching the selected topology pattern (§4: Single Region, Multi-AZ, Multi-Region Active-Passive, or Active-Active)
- Message bus with guaranteed delivery, partitioned topics, persistent DLQ
- Distributed file storage with provider SLA matching environment RTO/RPO targets
- Cache layer with provider SLA-backed availability
- All notification adapters production-configured (SMTP TLS, push production endpoints, in-app via event bus)
- Full observability stack (metrics, structured logging, distributed tracing)

**Configuration Sourcing:**
- Production configuration loaded from secured configuration store
- All secret values resolved from enterprise secrets manager
- Configuration validated against production schema requirements (CFG-001/002/003/004)
- Zero override capability from non-privileged users
- Feature flags evaluated at runtime with documented change history

**Monitoring Level:** Maximum. Continuous health monitoring with sub-minute polling intervals. Real-time alerting on all degradation signals. Metrics exported to centralized observability platform in Prometheus-compatible format. Incident response procedures defined for HEALTHY -> DEGRADED -> UNHEALTHY transitions.

**Data Lifecycle Policy:**
- Production data with full regulatory compliance requirements
- Continuous replication matching selected topology pattern RPO targets
- Backup frequency and retention governed by data classification and regulatory requirements
- Automated purge schedules enforced by CRT-009 Scheduler (LifecycleAggregate)
- Audit trail immutability guaranteed (CRT-014, RETENTION-031: minimum 7 years)

**Access Control:**
- Operations team manages deployment and infrastructure
- Development team access restricted to read-only diagnostics
- Product team access restricted to analytics and reporting endpoints
- Strict RBAC enforced via AuthorizationPort (Port-005) — roles per API-CONTRACT-004 hierarchy
- All access logged via AuditPort (Port-010)

**Runtime Component Notes:**
- Full operational mode: all 15 CRTs at production capacity
- CRT-007 HealthMonitor produces aggregated HEALTHY/DEGRADED/UNHEALTHY verdict used by load balancer health probes
- CRT-008 Diagnostics endpoint compliant with BR-ID-001 (zero sensitive data in any diagnostic output)
- CRT-015 TenantContextProvider enforces strict org_id resolution from JWT tokens (INV-004 constitutionnel)
- OfflineSyncService operates with real remote server endpoints (sync push/pull cycle)

### Environment 4: Disaster Recovery

**Purpose:** Failover target for Production continuity. Standby environment that can assume full Production load within defined RTO/RPO windows.

**Infrastructure Scope:**
- Mirror of Production infrastructure (same component counts, same topology minus active traffic)
- Database receives continuous replication from Production primary
- Application nodes running in standby mode (initialized, health-checked, but not accepting traffic)
- Load balancer configured for failover traffic routing
- Same notification and file storage adapter configurations as Production
- Same secrets vault access with replicated secret values

**Configuration Sourcing:**
- Identical Production configuration template
- Secret references resolve to DR-region secrets vault (replicated from Production vault)
- Database connection string points to DR-replica endpoint
- Load balancer DNS entry points to DR region by default (switches during failover event)

**Monitoring Level:** Production-level monitoring on all standby components. Health checks verify readiness to accept traffic continuously. Failover演练 (drills) conducted quarterly to validate RTO achievement. Metrics collected and compared against Production baselines to detect drift.

**Data Lifecycle Policy:**
- Data consistency maintained through continuous replication from Production
- Replication lag monitored and alerted (threshold configurable, default 5 seconds)
- On failover activation, replication becomes source-of-truth confirmation
- Post-failover: DR region BECOMES Production; former Production becomes new DR
- Cycle repeats with role interchange

**Access Control:**
- Operations team has elevated privileges for failover activation
- Access logged separately from Production audit trail (DR has its own audit append path)
- Emergency failover procedure allows time-bound privilege elevation (auto-revoked after 24 hours)

**Runtime Component Notes:**
- All CRTs initialized and health-checked (Phase 106 completed)
- CRT-006 LifecycleManager in PREPARED state (ready to transition to RUNNING on failover command)
- CRT-010 StartupPipeline has executed successfully; CRT-011 ShutdownPipeline ready for ordered termination
- CRT-009 Scheduler operating with reduced job set (no sync push to remote Production; all other jobs active)
- Offline operations queue maintained locally for post-failover synchronization

---

## SECTION 3: DEPLOYMENT ARCHITECTURE

This section defines the abstract layered architecture of Lumina deployments. It describes responsibilities, scaling behavior, and failure modes WITHOUT naming specific technologies, frameworks, or cloud providers. Implementation choices are deferred to infrastructure-as-code artifacts defined separately.

### Architectural Layers

```
                    [ Layer 0: Protocol Gateway ]
                    ┌─────────────────────────────┐
                    │        Load Balancer         │
                    │   (protocol termination,     │
                    │    routing, TLS termination)  │
                    └─────────────┬───────────────┘
                                  │ HTTPS/gRPC/WebSocket
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
    ┌─────▼─────┐        ┌───────▼───────┐      ┌───────▼───────┐
    │  Node 1   │        │    Node 2     │      │    Node N     │
    │           │        │               │      │               │
    │ [Layer 1] │        │ [Layer 1]     │      │ [Layer 1]     │
    │ App Layer │        │ App Layer     │      │ App Layer     │
    │           │        │               │      │               │
    │ - CRT-001 │        │ - CRT-001     │      │ - CRT-001     │
    │ - CRT-003 │        │ - CRT-003     │      │ - CRT-003     │
    │ - CRT-004 │        │ - CRT-004     │      │ - CRT-004     │
    │ - CRT-006 │        │ - CRT-006     │      │ - CRT-006     │
    │ - CRT-007 │        │ - CRT-007     │      │ - CRT-007     │
    │ - CRT-008 │        │ - CRT-008     │      │ - CRT-008     │
    │ - CRT-009 │        │ - CRT-009     │      │ - CRT-009     │
    │ - CRT-010 │        │ - CRT-010     │      │ - CRT-010     │
    │ - CRT-011 │        │ - CRT-011     │      │ - CRT-011     │
    │ - CRT-012 │        │ - CRT-012     │      │ - CRT-012     │
    │ - CRT-013 │        │ - CRT-013     │      │ - CRT-013     │
    │ - CRT-014 │        │ - CRT-014     │      │ - CRT-014     │
    │ - CRT-015 │        │ - CRT-015     │      │ - CRT-015     │
    │           │        │               │      │               │
    │ [Layer 2] │        │ [Layer 2]     │      │ [Layer 2]     │
    │ Ports 1-17│        │ Ports 1-17    │      │ Ports 1-17    │
    │ Adapter   │        │ Adapter       │      │ Adapter       │
    │ Bindings  │        │ Bindings      │      │ Bindings      │
    └─────┬─────┘        └───────┬───────┘      └───────┬───────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │ [Layer 3: Shared Services] │
                    │                             │
                    │ ┌─────────────────────────┐ │
                    │ │   Database Cluster      │ │
                    │ │   (RepositoryPort       │ │
                    │ │    consumers, CRT-003)  │ │
                    │ └─────────────────────────┘ │
                    │                             │
                    │ ┌─────────────────────────┐ │
                    │ │   Message Bus / Event     │ │
                    │ │   Bus (CRT-004, CRT-012) │ │
                    │ └─────────────────────────┘ │
                    │                             │
                    │ ┌─────────────────────────┐ │
                    │ │   File Storage Service  │ │
                    │ │   (FileStoragePort)     │ │
                    │ └─────────────────────────┘ │
                    │                             │
                    │ ┌─────────────────────────┐ │
                    │ │   Cache Service         │ │
                    │ │   (CachePort)           │ │
                    │ └─────────────────────────┘ │
                    │                             │
                    │ ┌─────────────────────────┐ │
                    │ │   Secrets Manager       │ │
                    │ │   (external to Lumina)  │ │
                    │ └─────────────────────────┘ │
                    └─────────────────────────────┘
```

### Layer 0: Protocol Gateway

**Responsibilities:**
- Terminate incoming client connections (HTTP/gRPC/WebSocket)
- Route requests to appropriate application nodes based on load, affinity, or round-robin
- Handle TLS termination (certificate management is external to Lumina application)
- Enforce rate limiting at the network level (distinct from application-level rate limiting via NotificationAggregate)
- Produce HTTP response codes consistent with Lumina error model (E-4xx client errors, E-5xx server errors)

**Scaling Behavior:**
- Horizontal scaling via adding/removing gateway instances behind a DNS or IP-based distributor
- Connection pooling to application layer nodes (pre-established connections reduce per-request latency)
- Geographic distribution via DNS-based routing (multi-region deployments)

**Failure Modes:**
- Single gateway node failure → DNS/load balancer reroutes to remaining nodes (zero user-visible impact)
- Complete gateway layer failure → clients receive connection refused; offline clients continue with local queue until recovery
- Certificate expiration → all TLS connections fail simultaneously; automated certificate renewal is mandatory

### Layer 1: Application Node

**Responsibilities:**
- Host the Lumina application process containing all 15 Runtime Components
- Process incoming API requests through the standard workflow: TenantContextProvider → Input Validation → Authorization → IdempotencyCheck → Aggregate Operation → Persistence → EventDispatch → Response (per ASS-003)
- Execute scheduled background jobs via Scheduler (CRT-009)
- Maintain health check endpoints for orchestration consumption (/health, /metrics, /debug/dump)
- Manage graceful startup (Phases 100-106 per RTS-002) and shutdown (Phases 108-110 per RTS-002)

**Scaling Behavior:**
- Horizontal auto-scaling based on: request queue depth, P99 latency, CPU utilization, memory pressure
- Minimum node count: 1 (Development), 2 (Staging), 3 (Production)
- Maximum node count: constrained by database connection pool capacity and message bus partition count
- Stateless design: any node can handle any request; session state held externally via IdentityProviderPort tokens

**Failure Modes:**
- Single node crash → remaining nodes absorb redistributed traffic; lifecycle of crashed node handled by orchestrator restart
- Node stuck in STARTING state (Phase 106 not completing) → removed from load balancer pool by health check failure; orchestrator attempts restart
- Node entering SHUTTING_DOWN state → traffic drained for grace period (default 30s); new connections rejected with 503
- OOM kill → automatic restart with original artifact (immutable artifact ensures identical version)

**Runtime Component Mapping (per RTS-001):**
Each application node hosts instances of ALL 15 Runtime Components:
- CRT-001 CompositionRoot: one singleton per node lifecycle
- CRT-002 DependencyResolver: one-shot at startup
- CRT-003 TransactionCoordinator: global scope, per-operation sub-scopes
- CRT-004 EventDispatcher: singleton, active during Phase 107
- CRT-005 ConfigurationLoader: singleton, loaded once at Phase 101
- CRT-006 LifecycleManager: singleton, spans entire node lifecycle
- CRT-007 HealthMonitor: singleton, continuous polling during Phase 107
- CRT-008 Diagnostics: singleton, continuous metrics collection
- CRT-009 Scheduler: singleton, background job execution
- CRT-010 StartupPipeline: single-use, Phase 106
- CRT-011 ShutdownPipeline: single-use, Phase 109
- CRT-012 RetryPolicy: singleton, active during Phase 107
- CRT-013 IdempotencyManager: scoped per-request, cache-backed
- CRT-014 AuditEnabler: scoped per-write-operation
- CRT-015 TenantContextProvider: scoped per-request/thread

### Layer 2: Port Bindings and Adapters

**Responsibilities:**
- Resolve the 17 abstract Ports (PAS-001) to concrete adapter implementations during Phase 104 (CompositionRoot binding)
- Provide health check endpoints for each adapter (consumed by CRT-007 HealthMonitor)
- Handle technology-specific details: SQL dialects, connection protocols, serialization formats
- Implement fallback strategies defined in PAS-002 (e.g., CachePort Redis → LRU fallback)

**Scaling Behavior:**
- Adapter selection is fixed at bootstrap (CRT-001 binds once, Phase 104) and does not change at runtime
- Connection pooling managed within adapter implementations (RepositoryPort connection pool size configured via CRT-005)
- Adapter health is polled independently (each adapter can report HEALTHY, DEGRADED, or UNHEALTHY)

**Failure Modes:**
- Adapter initialization failure at Phase 104 → EXIT IMMEDIATE (CRT-001 validates all 17 bindings)
- Adapter runtime failure during Phase 107 → reported as DEGRADED by CRT-007; application continues with best-effort degradation
- Persistent adapter failure (> 5 consecutive polls UNHEALTHY) → node marked unhealthy, removed from rotation

### Layer 3: Shared Services

**Responsibilities:**
- Provide shared infrastructure consumed by ALL application nodes simultaneously
- Maintain data consistency and durability across node failures
- Serve as the authoritative state source for tenant data

**Components:**

#### 3a. Database Cluster (RepositoryPort consumers, CRT-003)

**Responsibilities:** Persist aggregate state, enforce referential integrity via foreign keys, manage optimistic locking via version columns, store audit entries immutably, host the schema validated in Phase 102.

**Scaling Behavior:** Read replicas for query offload (SearchPort, VocabularyAccessPort reads). Primary handles all writes. Connection pooling per application node controls maximum concurrent database sessions.

**Failure Modes:** Primary database unavailable → all write operations fail → offline sync queue absorbs writes → retry on recovery. Read replica lag > threshold → health check degraded → reads may serve stale data.

#### 3b. Message Bus (CRT-004, CRT-012)

**Responsibilities:** Deliver domain events from producers (Aggregates) to subscribers (EventDispatcher handlers) with at-least-once guarantee. Maintain dead-letter queue for failed deliveries. Support replay for disaster recovery scenarios.

**Scaling Behavior:** Partitioned topics per event category enable parallel consumption. Dead-letter queue persists independently of application node lifecycle. Event ordering guaranteed within partition.

**Failure Modes:** Bus unavailable at startup → UNHEALTHY verdict at Phase 105 → EXIT. Bus unavailable during Phase 107 → events placed in DLQ per OR-004; original command operation succeeds (SYNC-004: event publishing never blocks domain operation).

#### 3c. File Storage Service (FileStoragePort)

**Responsibilities:** Store binary content for form attachments and archive URL records. Enforce MIME type validation, size limits, and virus scan acceptance criteria (per PAS-001 Port-013 constraints).

**Scaling Behavior:** External service with provider-managed replication. Each application node uploads/downloads independently. No coordination between nodes required.

**Failure Modes:** Service unavailable during upload → error returned to client; offline clients queue attachments for later retry. Service unavailable during download → cached copy served if available; otherwise 503.

#### 3d. Cache Service (CachePort)

**Responsibilities:** Provide fast read-through cache for vocabulary lookups, balance calculations, and organization profile caching. Best-effort delivery per PAS-001 Port-014 constraints.

**Scaling Behavior:** Each application node maintains its local LRU cache (in-memory). When remote cache adapter selected (Redis), cluster-mode scaling supported. Cache invalidation follows repository update order (cache invalidation BEFORE repository update per Port-014 constraint #2).

**Failure Modes:** Cache unavailable → all reads fall back directly to RepositoryPort (no application error, only degraded performance). Cache corruption → invalidated on next read via existence check (exists? returns false on corrupt entry).

#### 3e. Secrets Manager (external to Lumina)

**Responsibilities:** Store and serve encrypted secrets (database passwords, API keys, encryption keys, TLS certificates). Provide time-bound secret retrieval with automatic rotation. Audit all secret access attempts.

**Scaling Behavior:** Accessed exclusively during Phase 101 (ConfigurationLoader loads config referencing secret paths). After ConfigSnapshot creation, secrets are cached in memory for node lifetime. No per-request secret resolution overhead.

**Failure Modes:** Secrets manager unavailable at Phase 101 → EXIT IMMEDIATE (cannot start without configuration). Secrets manager degraded during Phase 107 → no impact (secrets already resolved and cached in ConfigSnapshot).

---

## SECTION 4: DEPLOYMENT TOPOLOGY OPTIONS

Four abstract deployment topology patterns are defined. Selection depends on scale, availability requirements, geographic distribution needs, and budget. Each pattern supports the full Lumina feature set including multi-tenant isolation, offline-first sync, and all 13 Application Services.

### Pattern A: Single Region

**Description:** All Lumina components deployed within a single geographic region. Single database primary. Suitable for MVP launches, low-to-moderate traffic applications, and proof-of-concept deployments.

**Component Placement:**
- Application nodes: 1-3 instances in the region's availability zone
- Database: single primary instance
- Message bus: single broker instance (or in-memory for Development)
- Cache: in-memory LRU per application node, or single remote cache instance
- File storage: single bucket/container in-region
- Secrets manager: regional endpoint

**Network Topology:**
- All components reside within the same network boundary (VPC/subscription/project)
- Internal communication over private network
- Public-facing endpoint via single load balancer with regional SSL certificate
- No cross-region replication

**Data Replication:** None. Single source of truth.

**Failover Procedure:**
1. Detect primary database failure via health check
2. Promote read replica to primary (if replica exists; otherwise restore from latest backup)
3. Update database connection string in configuration (requires node restart)
4. Redirect traffic to recovered node(s)
5. Manual intervention required for full recovery

**Performance Characteristics:**
- RTO: < 4 hours (manual failover, restore from backup)
- RPO: < 1 hour (last backup point)
- Latency: < 50ms p99 within region
- Max recommended throughput: 1,000 requests/second per application node
- Cost: lowest tier; suitable for validating product-market fit

**When to Use:** Development, early-stage startups, internal tools, low-volume deployments where downtime tolerance is acceptable and cost minimization is priority.

### Pattern B: Multi-AZ (Availability Zones)

**Description:** Application nodes distributed across multiple availability zones within a single region. Database with primary + automated read replica. Suitable for production deployments requiring moderate SLA guarantees.

**Component Placement:**
- Application nodes: minimum 2 instances, evenly distributed across AZs (1 per AZ minimum)
- Database: primary in AZ-1, synchronous read replica in AZ-2
- Message bus: clustered brokers spanning AZ-1 and AZ-2
- Cache: cluster-mode cache with nodes in each AZ
- File storage:跨区域-replicated bucket within the region
- Secrets manager: regional endpoint (same-region, multi-AZ accessible)

**Network Topology:**
- Cross-AZ network connectivity with < 5ms inter-AZ latency
- Load balancer distributes traffic across AZs with health-aware routing
- Database primary and replica connected via dedicated inter-AZ link
- Application nodes communicate with message bus and cache via internal endpoints

**Data Replication:**
- Database: synchronous replication primary → replica (RPO ≈ 0 during normal operations)
- File storage: asynchronous cross-AZ replication
- Message bus: mirrored partitions across AZs

**Failover Procedure:**
1. AZ failure detected by orchestrator (node health checks fail on remaining healthy AZ)
2. Load balancer stops routing to failed AZ
3. Database automatic failover: synchronous replica promoted to primary (RPO ≈ 0)
4. Connection string updated via DNS failover or configuration reload
5. Application nodes in healthy AZ continue serving; new nodes provisioned in healthy AZ
6. Grace period for rebuilding failed AZ capacity

**Performance Characteristics:**
- RTO: < 30 minutes (automated database failover + load balancer reconfiguration)
- RPO: < 5 minutes (synchronous replication with potential data loss during split-brain scenario)
- Latency: < 100ms p99 (cross-AZ communication overhead)
- Max recommended throughput: 5,000 requests/second (2+ nodes)
- Availability target: 99.9%

**When to Use:** Production deployments with defined business SLAs, organizations requiring compliance with moderate availability requirements, growth-stage deployments.

### Pattern C: Multi-Region Active-Passive

**Description:** Primary region handles all live traffic. Secondary region maintains continuously replicated data and warm standby application nodes. Suitable for organizations with high-availability requirements and regulatory data residency constraints.

**Component Placement:**
- Primary region: full production deployment (Pattern B or enhanced)
  - Application nodes: 3+ instances
  - Database primary
  - Message bus cluster
  - Full monitoring stack
- Secondary (DR) region: warm standby
  - Application nodes: minimum 2 instances in PREPARED state (CRT-006 LifecycleManager READY)
  - Database replica (continuous replication from primary region)
  - Message bus: read-only mirroring of primary topics
  - File storage: cross-region replicated bucket
  - Secrets manager: replicated secrets from primary region vault

**Network Topology:**
- Dedicated inter-region link (express route / DirectConnect / equivalent)
- Primary region public endpoint serves all client traffic
- Secondary region public endpoint disabled until failover activation
- DNS entry routes to primary region; failover switches DNS to secondary region
- Inter-region replication uses encrypted tunnel

**Data Replication:**
- Database: asynchronous cross-region replication (configurable lag threshold, default < 5 seconds)
- File storage: cross-region replication with eventual consistency
- Message bus: topic mirroring (events replicated asynchronously)
- Cache: not replicated (cold start on failover)

**Failover Procedure:**
1. Failover triggered manually (planned maintenance) or automatically (primary region health check failure sustained > 5 minutes)
2. Inter-region replication lag verified (must be within acceptable threshold, e.g., < 60 seconds)
3. DNS entry updated to point to secondary region
4. Secondary region application nodes transition from PREPARED to RUNNING state (CRT-006)
5. Database replica promoted to primary
6. Message bus switches to active mode
7. Secondary region now serves as Production; former primary becomes new DR
8. All offline-syncing clients reconnect to new primary region endpoint

**Performance Characteristics:**
- RTO: < 15 minutes (DNS propagation + warm standby activation + database promotion)
- RPO: < 1 minute (synchronous intra-region replication; asynchronous inter-region adds replication lag)
- Latency: < 150ms p99 for clients in primary region; < 300ms for clients geographically close to secondary region
- Max recommended throughput: 10,000+ requests/second (multiple regions)
- Availability target: 99.95%

**When to Use:** Enterprise production deployments, financial services (Lumina's finance-first priority model), healthcare organizations, deployments requiring data residency guarantees across jurisdictions.

### Pattern D: Multi-Region Active-Active

**Description:** Multiple geographic regions simultaneously serve live traffic. Cross-region data replication with conflict resolution handles concurrent writes from multiple regions. Suitable for global deployments requiring near-zero RTO and minimal RPO.

**Component Placement:**
- Each region: full production deployment (Pattern C primary-equivalent)
  - Application nodes: 3+ instances per region
  - Database primary (local to region)
  - Message bus cluster (local to region)
  - Cache layer (local to region)
  - File storage: cross-region replicated bucket
  - Full monitoring, alerting, and diagnostics per region
- Regional coordinators: load balancers distributing traffic within each region
- Global load balancer: DNS-based or anycast routing directing clients to nearest region

**Network Topology:**
- Low-latency inter-region links (< 50ms typically, depending on geography)
- Global anycast DNS routing (clients resolved to nearest region)
- Regional health check endpoints exposed per region
- Cross-region traffic encrypted and authenticated via mTLS

**Data Replication:**
- Database: multi-primary with cross-region conflict resolution
  - Conflicts resolved via Lumina's offline sync conflict resolution strategies (LWW, server-wins, immutable, uuid-dedup — per UC-SYNC-02 OfflineSyncService)
  - Optimistic concurrency (version columns, CRT-003 TransactionCoordinator saga compensation for unresolvable conflicts)
- Message bus: independent per region; cross-region event mirroring for audit and sync purposes
- Cache: not shared between regions (each region maintains independent LRU caches)
- File storage: cross-region replication with version awareness

**Conflict Resolution (from OfflineSyncAggregate):**
- `Last-Writer-Wins`: timestamp-based (ClockPort.now() from each region's independent clock)
- `Server-Wins`: remote authoritative during sync
- `Immutable`: resources with approved status cannot be modified; cross-region modification attempted → E-422 conflict
- `UUID-Dedup`: duplicate entity detection via UUID collision checking

**Failover Procedure:**
- No failover needed for individual region failure — global load balancer routes around the failed region
- Per-region failure: affected region's offline-syncing devices detect connection loss, queue operations locally, resume sync on recovery
- Regional data reconciliation performed during recovery (cross-region conflict detection scan via CRT-009 Scheduler)

**Performance Characteristics:**
- RTO: near-zero (global load balancer reroutes instantly; single region failure does not affect global availability)
- RPO: < 1 minute (cross-region replication with conflict resolution handles data divergence)
- Latency: < 50ms p99 within region; < 100ms p99 for cross-region operations
- Max recommended throughput: unlimited horizontal scaling (add regions as needed)
- Availability target: 99.99%+

**When to Use:** Global organizations, high-traffic platforms, deployments where any regional outage causes unacceptable business impact, organizations with multi-jurisdictional data sovereignty requirements.

---

## SECTION 5: ARTIFACT VERSIONING

### Semantic Versioning Scheme

All Lumina deployment artifacts follow semantic versioning: `MAJOR.MINOR.PATCH`

| Segment | Meaning | Deployment Impact | Rollback Required? |
|---------|---------|------------------|-------------------|
| MAJOR | Breaking changes to API contracts, schema migrations, protocol changes | Yes — requires coordinated rollout, potential data migration | Yes — prior major version must be preserved during transition |
| MINOR | New features, new Application Service operations, new events | No — backward compatible; new and old instances coexist | No — can roll back to previous minor without data risk |
| PATCH | Bug fixes, security patches, performance improvements | No — drop-in replacement; zero downtime deployment possible | No — instant rollback by reverting to previous patch artifact |

### Build Identification

Each build artifact receives two identifiers:
1. **Semantic version** (`X.Y.Z`) — human-readable, deployment-plan reference
2. **Content hash** (`SHA-256:abcdef...`) — immutable provenance anchor

The content hash is computed from the complete artifact bundle (application code, dependencies, embedded assets). Two builds with the same semantic version but different hashes are DIFFERENT releases.

### Build Metadata (Immutable)

Every artifact includes the following metadata, baked in at build time and non-modifiable afterward:

| Field | Source | Example |
|-------|--------|---------|
| `artifact_version` | Semantic version from source control tag | `1.3.7` |
| `build_sha256` | SHA-256 of complete artifact bundle | `a1b2c3d4...` |
| `commit_hash` | Source control commit hash | `f8e2d1c0...` |
| `commit_timestamp` | ISO-8601 timestamp of source commit | `2026-07-25T14:30:00Z` |
| `builder` | CI/CD pipeline name and version | `genesis-build-v2.1` |
| `dependency_manifest_hash` | SHA-256 of dependency lock file | `d4e5f6a7...` |
| `test_pass_rate` | Percentage of passing tests in build pipeline | `100.0` |
| `security_scan_status` | Result of static and dynamic security scans | `CLEAR` |
| `migration_companion` | Migration pack version this artifact pairs with | `MIGRATION-PACK-V1.2` |

### Rollback Retention

- **Current artifact:** always available for immediate re-deployment
- **Previous N artifacts:** retained for minimum 30 days, where N is the number of successful releases in that period
- **Archive artifacts:** historical artifacts retained indefinitely in cold storage for forensic audit purposes
- **Rollback verification:** each rollback must be followed by health check verification identical to initial deployment validation (CRT-007 Phase 105 equivalent)

---

## SECTION 6: INFRASTRUCTURE COMPONENTS SUMMARY

The following table maps every required infrastructure component to its corresponding Runtime Component (from RTS-001) and defines its scaling strategy, failure isolation characteristics, and the Ports it serves.

| # | Infrastructure Component | Runtime Dependency | Port Consumers | Scaling Strategy | Failure Isolation | RPO Target | RTO Target |
|---|-------------------------|-------------------|----------------|-----------------|-------------------|-----------|-----------|
| 1 | Application Nodes (full Runtime) | CRT-001 through CRT-015 (all 15 components) | All 17 Ports | Horizontal auto-scaling; min 1 (Dev), min 2 (Staging), min 3 (Prod) | Per-node crash isolated; remaining nodes absorb traffic | N/A | Per-node restart < 2 min |
| 2 | Database Cluster | RepositoryPort (CRT-003 TransactionCoordinator consumer) | Port-001 (RepositoryPort) | Read replicas for query offload; connection pooling per node | Single point — mitigated by redundancy pattern selection (§4) | 0 (sync replication) to 1 hour (backup restore) | < 4 hours (Single Region) to near-zero (Active-Active) |
| 3 | Message Bus / Event Bus | EventPublicationPort + EventSubscriptionPort (CRT-004 EventDispatcher consumer) | Port-002 (EventPublicationPort), Port-003 (EventSubscriptionPort) | Partitioned topics; parallel consumers per partition | Dead-letter queue preserves failed events for investigation | 0 (persistent topics with acknowledgment) | < 5 min for partition recovery |
| 4 | Cache Layer | CachePort (CRT-012 RetryPolicy, CRT-013 IdempotencyManager consumer) | Port-014 (CachePort) | In-memory LRU per node OR remote cluster with sharding | Lost on eviction — no data loss (cache is never source of truth, per Port-014 constraint #1) | N/A (ephemeral by design) | N/A (graceful fallback to direct DB reads) |
| 5 | File Storage | FileStoragePort (FormAggregate, LifecycleAggregate consumers) | Port-013 (FileStoragePort) | Provider-managed replication; per-region buckets | Provider-dependent SLA; offline fallback via pending_operations table | Provider SLA (typically 99.999999999% durability) | Provider-dependent |
| 6 | Secrets Vault | ConfigurationPort (CRT-005 ConfigurationLoader consumer) | Port-008 (ConfigurationPort) | External service — accessed during Phase 101 only | Cached in ConfigSnapshot after resolution; vault degraded during Phase 107 has NO impact | N/A (secrets resolved once at boot) | N/A (no runtime dependency) |
| 7 | Load Balancer / Gateway | External to Lumina (coordinates with CRT-007 HealthMonitor) | All inbound traffic | Horizontal scaling; health-aware routing | Per-instance failover; DNS/global routing for multi-region | N/A | Per-node failover < 30 seconds |
| 8 | Monitoring & Observability | CRT-007 (HealthMonitor), CRT-008 (Diagnostics) | /health, /metrics, /debug/dump endpoints | Aggregated metrics from all nodes; centralized dashboard | Individual metric collection failure does not affect application; dashboard unavailable = degraded observability | Metrics buffered locally if aggregator unreachable | N/A (observability is supplementary) |
| 9 | Audit Log Storage | AuditPort (CRT-014 AuditEnabler consumer) | Port-010 (AuditPort) | Append-only storage; 7-year retention minimum (RETENTION-031) | Append path failure non-blocking per AUD-001; domain operation continues | 0 (append-only, WAL-protected) | Provider-dependent (audit data loss is regrettably acceptable per AUD-001) |
| 10 | Scheduled Job Execution Framework | CRT-009 (Scheduler) | ClockPort (Port-006), RepositoryPort (Port-001) | One scheduler instance per application node; leader election for single-execution jobs | Per-job isolation: one failed scheduled job does not block others (CRT-009 invariant) | N/A (jobs are re-triggered on next schedule) | Per-job timeout with exponential backoff retry |

### Cross-Reference: Port Coverage Verification

All 17 Ports from PAS-001 are served by the infrastructure components above:

| Port | ID | Serving Component(s) | CRT Consumer(s) |
|------|-----|---------------------|-----------------|
| RepositoryPort | Port-001 | Database Cluster (#2) | CRT-003, CRT-009, all AppServices |
| EventPublicationPort | Port-002 | Message Bus (#3) | CRT-004 |
| EventSubscriptionPort | Port-003 | Message Bus (#3) | CRT-004 |
| IdentityProviderPort | Port-004 | Application Node (#1) [session storage in DB] | CRT-015 |
| AuthorizationPort | Port-005 | Application Node (#1) [RBAC rules from config] | CRT-015 |
| ClockPort | Port-006 | Application Node (#1) [monotonic + wall-clock] | CRT-007, CRT-009, all services |
| UUIDPort | Port-007 | Application Node (#1) [UUID generation] | CRT-001 (binding phase) |
| ConfigurationPort | Port-008 | Secrets Vault (#6) + Config Files | CRT-005 |
| LoggingPort | Port-009 | Application Node (#1) [stderr + rolling file] | CRT-004, CRT-007, CRT-008, CRT-012, CRT-014 |
| AuditPort | Port-010 | Audit Log Storage (#9) | CRT-014 |
| NotificationPort | Port-011 | Application Node (#1) [smtp/push adapters] | CRT-004 (event-driven dispatch) |
| SearchPort | Port-012 | Database Cluster (#2) [FTS index] or dedicated search service | CRT-007 (health check) |
| FileStoragePort | Port-013 | File Storage (#5) | CRT-012 (retry policy persistence) |
| CachePort | Port-014 | Cache Layer (#4) | CRT-012, CRT-013 |
| TransactionManagerPort | Port-015 | Database Cluster (#2) [SQL transaction support] | CRT-003 |
| PersistenceVerificationPort | Port-016 | Database Cluster (#2) [schema introspection] | Phase 102 (CRT-001, CRT-007 indirect) |
| VocabularyAccessPort | Port-017 | Database Cluster (#2) [vocabulary tables] | Phase 104 (CRT-001 binding) |

### Deployment Component Count Matrix

| Component | Development | Staging | Production (Pattern A) | Production (Pattern B) | Production (Pattern C) | Production (Pattern D) |
|-----------|:-----------:|:-------:|:----------------------:|:----------------------:|:----------------------:|:----------------------:|
| Application Nodes | 1 | 2 | 1-3 | 4+ | 3+3 | 3+ per region |
| Database Primary | 1 (embedded) | 1 | 1 | 1 | 1 | 1 per region |
| Database Replica | 0 | 1 | 0 | 1 | 1 (cross-region) | 0 (multi-primary) |
| Message Brokers | 1 (in-memory) | 1 | 1 | 2+ | 2+ | 2+ per region |
| Cache Instances | 1 (in-memory) | 1 | 1 | 2+ | 1 (warm standby) | 1 per region |
| File Storage Buckets | 1 (local) | 1 | 1 | 1 (replicated) | 1 + DR replicate | 1 per region |
| Secrets Endpoint | 1 | 1 | 1 | 1 | 2 (replicated) | 1 per region |

---

*This deployment model defines the abstract foundations upon which all subsequent deployment specifications (environments, secrets, releases, rollbacks, HA, validation) are built. Every decision in the following documents traces back to one or more principles (P-001 through P-007) and/or infrastructure component listed above.*

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | deployment-specifier v1.0 | Creation — Deployment Model for Lumina v1: 7 principles, 4 environment types, 3-layer architecture, 4 topology patterns, versioning scheme, 10 infrastructure components mapped to RTS-001 components and PAS-001 ports | COMPLIANT (verified against RTS-001 15-component catalog, RTS-002 10-phase lifecycle, RTS-003 orchestration rules, ASS-001 83-service catalog, PAS-001 17-port coverage, TRR-V1.2 deployment readiness assessment) |

---

*Ce document definit le modele de deploiement abstrait pour Lumina. Aucun artefact technique concret (Dockerfile, Kubernetes manifest, Terraform, script shell) n'est inclus. Ces details sont resolves dans les specifications d'infrastructure-as-code separees.*
