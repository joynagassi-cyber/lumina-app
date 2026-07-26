# High Availability Strategy — Lumina v1

**Doc ID:** DEP-SPEC-006
**Version:** v1.0
**Statut:** SPÉCIFICATION DÉPLOIEMENT DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-v1", "RTS-002", "RTS-003", "ASS-001"]
**Transformation_rule :** "deployment-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## TABLE DES MATIÈRES

1. [HA Definition](#section-1-ha-definition)
2. [Failure Domain Analysis](#section-2-failure-domain-analysis)
3. [Health Check Design](#section-3-health-check-design)
4. [Auto-Recovery Mechanisms](#section-4-auto-recovery-mechanisms)
5. [Graceful Degradation](#section-5-graceful-degradation)
6. [Circuit Breaker Patterns](#section-6-circuit-breaker-patterns)

---

## SECTION 1: HA DEFINITION

### 1.1 What "High Availability" Means for Lumina

High Availability (HA) for Lumina is defined as the system's ability to CONTINUE OPERATING — providing at least its core functionality — when one or more of its infrastructure components experience failures. HA does NOT mean zero downtime under all conditions; it means that the impact of any SINGLE failure is bounded, predictable, and recoverable within defined timeframes.

**Target Uptime:** The target uptime is expressed as a percentage per calendar quarter:

| Environment | Target Uptime | Allowed Downtime per Quarter | Typical Cause of Non-Availability |
|------------|--------------|-----------------------------|----------------------------------|
| Development | N/A (not a service) | N/A | Scheduled maintenance, developer-initiated stops |
| Staging | 99.0% | ~64 hours | Deployment windows, testing interruptions |
| Production (Single Region) | 99.9% | ~7 hours | Planned maintenance, unexpected hardware failures |
| Production (Multi-AZ) | 99.95% | ~3.5 hours | Planned maintenance, AZ-level failure with recovery |
| Production (Multi-Region AP) | 99.99% | ~43 minutes | Planned maintenance, regional disaster with failover |
| Production (Multi-Region AA) | 99.999% | ~4 minutes | Global catastrophe affecting all regions |

**Uptime Calculation Basis:** Uptime is measured from the perspective of an END USER attempting to use Lumina's API. It does NOT include:
- Scheduled maintenance windows communicated 48+ hours in advance
- Downtime caused by external dependency failures (e.g., cloud provider outage affecting Lumina entirely)
- Downtime during authorized emergency access procedures (§4 of DEP-SPEC-002)

### 1.2 HA Principles

**HA-P-001: Redundancy Over Reliability**

Individual components MAY fail. The system design assumes failure and provides redundancy to absorb it. No single component is trusted to be permanently available. This applies to:
- Application nodes (multiple redundant instances)
- Database (primary + replica, or multi-primary)
- Message bus (clustered brokers)
- Cache layer (distributed cache cluster or per-node fallback)
- File storage (provider-managed replication)
- Secrets vault (external dependency assumed always available at bootstrap)

**HA-P-002: Statelessness at the Application Layer**

Application nodes are STATELESS with respect to user traffic. All state required for request processing is held externally (database, cache, file storage). This enables:
- Any node can handle any request
- Nodes can be added or removed without interrupting ongoing requests (after graceful drain)
- No node holds user session state that would prevent replacement

Session state (JWT tokens, org_id context) is managed externally via IdentityProviderPort and TenantContextProvider. The application node itself holds no persistent user state.

**HA-P-003: Deterministic Recovery (OR-011)**

Following any failure and recovery, the system returns to a KNOWN GOOD STATE through deterministic initialization. The same artifact version deployed with the same configuration ALWAYS produces the same behavior (DEP-SPEC-001 P-004). This eliminates ambiguity about whether a recovered node is functionally equivalent to nodes that never failed.

**HA-P-004: Offline-First Resilience (SYNC-004)**

Lumina's offline-first architecture IS an HA mechanism. When the remote server is unavailable, connected devices continue operating locally. Operations queue in PendingOperations (OfflineSyncAggregate) and sync when connectivity restores. This means USER PRODUCTIVITY is not impacted by server unavailability — only real-time collaboration features are affected.

The remote server becoming unavailable DOES NOT constitute a Lumina outage from the end-user perspective if offline operations remain functional. HA metrics measure SERVER AVAILABILITY, not client productivity.

### 1.3 Availability Tiers by Component

Not all components have equal availability requirements. Different tiers apply:

| Tier | Components | Availability Target | Failure Impact |
|------|-----------|---------------------|---------------|
| Tier 1 (Critical) | RepositoryPort (DB), EventPublicationPort, IdentityProviderPort, AuthorizationPort | 99.99% | Core functionality broken — cannot process any requests |
| Tier 2 (Important) | EventSubscriptionPort, LoggingPort, AuditPort, Scheduler, RetryPolicy | 99.95% | Degraded functionality — some operations impaired but core continues |
| Tier 3 (Supporting) | NotificationPort, SearchPort, FileStoragePort, CachePort, VocabularyAccessPort | 99.9% | Non-blocking degradation — affected features degrade gracefully |
| Tier 4 (Optional) | PersistenceVerificationPort | 99.0% | Infrastructure validation only — never called during normal operation |

---

## SECTION 2: FAILURE DOMAIN ANALYSIS

A failure domain is a set of components whose simultaneous failure would cause a service disruption. Identifying failure domains enables targeted redundancy and recovery planning.

### 2.1 Identified Failure Domains

| # | Failure Domain | Scope | Affected Components | Mitigation | Impact if Breached |
|---|---------------|-------|-------------------|------------|-------------------|
| FD-001 | Single application node crash | One node out of N | 1 of 15 Runtime Components per node | Redundant nodes absorb traffic; auto-restart | Zero if N >= 2; degraded if N = 1 |
| FD-002 | Application node stuck in STARTING state | One node fails Phase 105 health check | 1 node becomes unhealthy, removed from rotation | Health check removes node from load balancer; orchestrator restarts | Minimal — other nodes handle traffic |
| FD-003 | Database primary failure | Entire database cluster | RepositoryPort (Port-001), TransactionManagerPort (Port-015) | Read replica promoted to primary; connection string updated | ALL writes blocked until failover complete (reads may continue on old primary if split-brain avoided) |
| FD-004 | Database connection pool exhaustion | All application nodes sharing pool | RepositoryPort (all consumers) | Connection pool size configurable per node; max connections = pool_size * node_count | Requests queue waiting for available connection; timeout → E-503 |
| FD-005 | Message bus broker failure | EventPublicationPort, EventSubscriptionPort | CRT-004 EventDispatcher | Clustered brokers with leader election; DLQ persists events independently | Events published after failure lost if no persistent store; previously published events in DLQ preserved |
| FD-006 | Network partition (intra-region) | Subset of nodes lose connectivity to DB/cache | Partial node group separated | Nodes in partitioned segment detect connectivity loss via health check; removed from rotation | Partitioned nodes unable to serve requests; remaining nodes continue |
| FD-007 | Network partition (inter-region) | Whole region isolated from other regions | Multi-region deployments affected | DNS reroutes traffic to healthy region; DR standby activates | Regional outage — users in affected region experience service interruption unless offline mode |
| FD-008 | Storage provider outage | FileStoragePort unavailable | Port-013, affected AppServices | CachePort fallback for recently accessed files; offline queue for uploads | New file uploads fail; previously downloaded files accessible from local cache |
| FD-009 | Cache layer failure | CachePort (Port-014) unavailable | CRT-012 RetryPolicy, CRT-013 IdempotencyManager | Graceful degradation: reads fall back to RepositoryPort; idempotency keys lost (acceptable — new request_ids issued) | Increased latency (direct DB reads); duplicate requests possible (new request_ids not deduplicated) |
| FD-010 | Secrets vault unavailability | Phase 101 bootstrap failure | CRT-005 ConfigurationLoader | NO FALLBACK — application CANNOT start without secrets; incident response triggered | Complete environment outage until vault restored |
| FD-011 | Clock drift | ClockPort (Port-006) returns inconsistent time | All timestamp-dependent operations | CRT-007 HealthCheck verifies monotonic vs wall-clock consistency; drift > 60s triggers DEGRADED | Timestamp ordering issues; sync conflict resolution may behave unexpectedly |
| FD-012 | UUID generation failure | UUIDPort (Port-007) unavailable | All CREATE operations | UUID generation is in-memory per node — single point within node, not cross-node | Cannot create new entities; existing reads/writes unaffected |
| FD-013 | Scheduler job contention | Multiple jobs targeting same resource simultaneously | CRT-009 Scheduler | Atomic aggregate-level operations per CRT-009 invariant; optimistic locking prevents double-execution | Jobs retry with backoff; no data corruption due to concurrency control |
| FD-014 | Audit log storage saturation | AuditPort write path full | CRT-014 AuditEnabler | Per AUD-001: audit is non-blocking — domain operation continues even if audit cannot write; alert generated | Audit trail gap — regulatory risk; no functional impact on application users |

### 2.2 Single Points of Failure

A single point of failure (SPOF) is a component where failure causes UNBOUNDED impact (system-wide outage).

| SPOF | Component | Current Status | Remediation Path |
|------|-----------|---------------|------------------|
| SPOF-001 | Database primary | Mitigated by topology pattern selection (§4 of DEP-SPEC-001) | Multi-AZ pattern (B) or Multi-Region patterns (C/D) eliminate this SPOF |
| SPOF-002 | Secrets vault | External dependency, outside Lumina scope | Select vault solution with HA guarantee; maintain backup credentials for emergency bootstrap |
| SPOF-003 | Load balancer | Must be provided by infrastructure layer (external to Lumina) | Use managed LB service with built-in HA; deploy LB across AZs |

**Note:** The 15 Runtime Components themselves have ZERO single points of failure within the application layer. Each CRT is instantiated per node, and nodes are redundant. The only exception is CRT-002 DependencyResolver (singleton, one-shot) — but it runs once at startup and is abandoned after, so its runtime availability is irrelevant.

### 2.3 Failure Domain Cross-References

Each failure domain maps to specific Runtime Components and lifecycle phases:

| Failure Domain | Affected CRT(s) | Affected Phase(s) | Related RTS-003 Rule |
|---------------|-----------------|-------------------|---------------------|
| FD-001 | All CRTs (per node) | Phase 107 (normal operation) | OR-014 (resource cleanup) |
| FD-003 | CRT-003 (TxCoord), CRT-007 (health), CRT-009 (scheduler) | Phase 107 | OR-003 (transaction boundary) |
| FD-005 | CRT-004 (EventDispatcher), CRT-012 (RetryPolicy) | Phase 107 | OR-004 (event dispatch guarantee) |
| FD-009 | CRT-012, CRT-013 | Phase 107 | OR-005 (retry policy), OR-006 (idempotency) |
| FD-010 | CRT-005 (ConfigurationLoader) | Phase 101 | — (bootstrap only) |
| FD-011 | CRT-007, CRT-009, CRT-008 | Phase 105, 107 | OR-015 (diagnostics completeness) |

---

## SECTION 3: HEALTH CHECK DESIGN

### 3.1 Health Check Architecture

Health checks are implemented by CRT-007 (HealthMonitor) and serve two purposes:
1. **Internal diagnostics**: Inform the application of its own operational status
2. **External probes**: Provide endpoints for orchestration systems (load balancers, Kubernetes liveness/readiness probes)

All health checks are READ-ONLY (CRT-007 constitutional invariant: "Health checks sont READ-ONLY — jamais de mutation pendant le monitoring").

### 3.2 Health Check Categories

| Category | Purpose | Endpoint | Frequency | Verdict Options |
|----------|---------|----------|-----------|----------------|
| Startup Health Check | Verify all connections before accepting traffic | Internal (Phase 105) | Once at boot | HEALTHY / DEGRADED / UNHEALTHY |
| Continuous Health Poll | Monitor ongoing operational health | Internal + `/health` | Every N seconds (default 30s) | HEALTHY / DEGRADED / UNHEALTHY |
| Liveness Probe | Is the process alive and responsive? | `/health/liveness` | Every 10s (Kubernetes default) | alive / dead |
| Readiness Probe | Can the node accept traffic? | `/health/readiness` | Every 10s (Kubernetes default) | ready / not-ready |

### 3.3 Individual Port Health Checks (Phase 105 / Continuous)

Each of the 10 health checks defined in RTS-002 Phase 105 maps to a specific port and verdict logic:

| # | Port | Check Method | HEALTHY Criteria | DEGRADED Criteria | UNHEALTHY Criteria |
|---|------|-------------|-----------------|-------------------|-------------------|
| 1 | RepositoryPort (Port-001) | Ping + read system table | Response < 100ms; row count matches expected range | Response 100-500ms; row count slightly off | Timeout > 500ms; connection refused |
| 2 | EventPublicationPort (Port-002) | Loopback test: publish HealthCheckPing, verify receipt via EventSubscriptionPort | Publish + receive cycle < 50ms | Cycle 50-200ms | Cycle > 200ms or receive never arrives |
| 3 | ClockPort (Port-006) | Monotonic + wall-clock consistency check | Drift < 60 seconds from system clock | Drift 60-300 seconds | Drift > 300 seconds or monotonic clock stalled |
| 4 | CachePort (Port-014) | Write key + read back verification | Write + read < 5ms; value matches | Write + read 5-50ms | Write fails or read returns wrong value |
| 5 | FileStoragePort (Port-013) | Upload small blob + download + delete | Operation < 500ms | Operation 500ms - 2s | Timeout > 2s or upload fails |
| 6 | SearchPort (Port-012) | Index test term + search for it | Index + search < 200ms | Search 200-1000ms | Index fails or search returns no results for indexed term |
| 7 | NotificationPort (Port-011) | Connection test to SMTP/Push endpoint (NO actual send) | TCP handshake < 500ms | Handshake 500ms - 2s | Connection refused or timeout > 2s |
| 8 | Scheduler (CRT-009) | Schedule 0ms-delayed job + verify execution | Job executes < 10ms after scheduled time | Execution 10-100ms late | Job never executes |
| 9 | AuditPort (Port-010) | Write test audit entry (verifies NB-PERSIST-007: self-audit disabled) | Entry written < 100ms; no recursive audit triggered | Write 100-500ms | Write fails or recursion detected |
| 10 | IdentityProviderPort (Port-004) | Context resolution test (empty context = provider functional, just no user authenticated) | Context resolved < 50ms | Resolution 50-200ms | Resolution fails or throws |

### 3.4 Global Verdict Computation

The HealthMonitor aggregates individual port verdicts into a global verdict using these rules:

```
If ANY critical port (Tier 1) = UNHEALTHY → GLOBAL = UNHEALTHY
Else IF ANY critical port (Tier 1) = DEGRADED → GLOBAL = DEGRADED
Else IF ANY non-critical port = DEGRADED → GLOBAL = DEGRADED
Else → GLOBAL = HEALTHY
```

**Critical ports (Tier 1):** RepositoryPort, EventPublicationPort, IdentityProviderPort, AuthorizationPort

**Global Verdict Actions:**
- `HEALTHY`: Node is fully operational
- `DEGRADED`: Node continues serving traffic but with reduced capability; logged as WARN in CRT-008 Diagnostics
- `UNHEALTHY`: Node removed from load balancer rotation; orchestrator initiates restart or replacement

### 3.5 Readiness Gate

A node is READY to accept traffic ONLY when:
1. All Tier 1 health checks return HEALTHY (not just DEGRADED)
2. Phase 106 StartupPipeline has completed successfully (CRT-010 signals READY)
3. LifecycleManager state is RUNNING (not STARTING)

This readiness gate prevents traffic from reaching a node that is partially initialized. It enforces LV-002: "Aucune requete n'est acceptee avant la fin de la Phase 106."

---

## SECTION 4: AUTO-RECOVERY MECHANISMS

### 4.1 Self-Healing Behaviors

Lumina incorporates several automatic recovery mechanisms that operate WITHOUT human intervention:

| Mechanism | Trigger | Action | Recovery Time |
|-----------|---------|--------|--------------|
| Node Auto-Restart | Orchestrator detects node dead (liveness probe fails) | Kill zombie process; start new instance with same artifact | < 2 minutes |
| Connection Pool Refresh | RepositoryPort health check reports slow responses (> 500ms for 3 consecutive polls) | Close existing connections; open new pool | < 30 seconds |
| Cache Warm Rebuild | CachePort health check FAILS (was DEGRADED earlier) | Evict all cache entries; next reads hit database directly; cache warms on subsequent reads | Immediate fallback; warm-up over next minutes |
| DLQ Event Retry Expiration | DLQ entries age beyond 24 hours without manual intervention | Archive to long-term storage; do NOT auto-retry (prevents infinite loops per OR-004) | Deferred — manual investigation required |
| Scheduler Job Requeue | Scheduled job fails after max retries (CRT-012) | Job re-scheduled with exponentially increasing delay | Next scheduled window |
| Idempotency Key Eviction | Idempotency key TTL expires (default 5 minutes) | Key removed from cache; new executions allowed | Automatic — no action needed |
| Resource Leak Detection | CRT-008 resource_leaks counter > 0 for > 60 seconds | Alert sent to CRT-007; logged as ERROR in CRT-008; NO automatic fix (requires code investigation) | Deferred — P2 priority fix |

### 4.2 Recovery After Node Failure

When a node fails (crash, OOM kill, network isolation):

1. **Detection:** Load balancer health probe fails (consecutive failures: typically 3-5, depending on configuration)
2. **Removal:** Node removed from load balancer rotation within poll interval × consecutive_failures threshold
3. **Traffic Redirect:** Remaining nodes absorb redistributed traffic
4. **Restart:** Orchestrator starts new instance with same artifact version and configuration
5. **Initialization:** New node goes through Phases 100-106 (deterministic per OR-011)
6. **Readiness:** New node added back to rotation when readiness probe passes
7. **State Recovery:** No state needed at node level (stateless per HA-P-002); all state in shared services

**Recovery Time Estimate:** For a 3-node cluster, average recovery time = time_to_detect + restart_time ≈ 30s + 2min = ~2.5 minutes. During recovery, 2/3 of capacity available.

### 4.3 Recovery After Database Failover

When the database primary fails (FD-003):

1. **Detection:** RepositoryPort health check reports UNHEALTHY (connection refused or timeout)
2. **Failover Initiation:** Orchestration platform promotes read replica to primary (automated for Multi-AZ pattern and above)
3. **Connection Update:** Database connection string updated via configuration reload or DNS failover
4. **Node Restart:** Application nodes restarted to resolve new connection string (rolling restart)
5. **Verification:** Health check suite confirms RepositoryPort HEALTHY against new primary
6. **Data Consistency Check:** Post-failover verification compares row counts and checksums between old primary (now decommissioned) and new primary

**Recovery Time Estimate:** 
- Automated failover (Multi-AZ): 1-5 minutes for replica promotion + 2 minutes per node restart × 3 nodes ≈ 5-11 minutes total
- Manual failover (Single Region): 30 minutes to 4 hours depending on intervention speed

### 4.4 Recovery After Secrets Vault Outage

When the secrets vault becomes unavailable (FD-010):

1. **At Bootstrap (Phase 101):** EXIT IMMEDIATELY — cannot start without configuration. Incident response triggered.
2. **During Runtime (Phase 107):** NO IMPACT — secrets already resolved and cached in ConfigSnapshot. Vault outages during Phase 107 do not affect running nodes.
3. **During Rolling Restart:** If a node being restarted cannot reach the vault, that node FAILS to start. Other nodes continue functioning. Retry the failed node after vault is restored.

This asymmetric treatment (fatal at boot, harmless at runtime) is by design — it reflects the single-resolution-at-bootstrap architecture of CRT-005.

---

## SECTION 5: GRACEFUL DEGRADATION

When components fail or become degraded, Lumina does NOT fail catastrophically. Instead, it degrades functionality gracefully — maintaining core operations while reducing or disabling non-essential features.

### 5.1 Degradation Matrix

| Failing Component | Degradation Behavior | User Impact | Feature Loss | Recovery Path |
|-----------------|---------------------|-------------|-------------|--------------|
| CachePort (Port-014) | Reads bypass cache → direct to RepositoryPort | Slightly increased latency for vocabulary lookups, balance calculations | No functional loss; performance degradation only | Cache rebuilds automatically as reads happen |
| NotificationPort (Port-011) | Notifications queued in NotificationAggregate; delivered when port recovers | Users don't receive notifications in real-time | Real-time notification delivery delayed | Automatic delivery on port recovery |
| SearchPort (Port-012) | Search queries fall back to RepositoryPort filtered queries (slower, less capable) | Slower search results; FTS features unavailable | Full-text search degraded to structured query | Search index rebuilds during low-traffic period |
| FileStoragePort (Port-013) | Uploads fail; downloads served from local cache if available | Cannot upload new files; previously downloaded files accessible | File attachment creation disabled | Automatic retry on backoff (CRT-012 RetryPolicy) |
| EventPublicationPort (Port-002) | Events dispatched to DLQ per OR-004; original command succeeds (SYNC-004) | No event-driven side effects (audit logging delayed, offline sync push delayed) | Async features delayed, not broken | DLQ processed when port recovers |
| EventSubscriptionPort (Port-003) | Same as EventPublicationPort — handlers registered but events not delivered | Subscribers don't receive events in real-time | Event-driven coordination delayed | Auto-recovered when port healthy |
| ClockPort (Port-006) | Health check DEGRADED if drift > 60s; application continues with available clock | Timestamp accuracy may be off for audit and sync purposes | Sync conflict resolution may produce incorrect results | Clock synchronization restored; drift decreases |
| AuditPort (Port-010) | Per AUD-001: audit write failure is NON-BLOCKING — domain operation continues | Audit trail gap for affected writes | Audit compliance temporarily compromised | Audit entries written when port recovers (if queue); gaps permanent if not queued |
| IdentityProviderPort (Port-004) | Authentication fails → 401 Unauthorized for new sessions | Existing sessions continue; new logins fail | User onboarding, re-authentication blocked | Auth server restored → new sessions work |
| VocabularyAccessPort (Port-017) | Term lookups fail → form rendering incomplete | Forms show missing field options | Form completeness degraded | Vocabulary data served from cache if available |

### 5.2 Degradation Severity Levels

| Level | Description | Example Scenario |
|-------|-------------|-----------------|
| LIGHT | Minor performance impact; no feature loss | Cache miss → slower response times |
| MODERATE | Non-essential features unavailable; core functions intact | Notifications queued, not delivered |
| SIGNIFICANT | Multiple non-essential features down; user workflow interrupted | Search + file upload both unavailable simultaneously |
| CRITICAL | Core functionality impaired; rollback may be necessary | Database unavailable, authentication failing |

### 5.3 Degradation Monitoring

Degradation state transitions are tracked by CRT-007 HealthMonitor and exposed via CRT-008 Diagnostics:

- `HEALTHY → DEGRADED`: First sign of issue — alert at INFO level, log at WARN
- `DEGRADED → DEGRADED (extended)`: Same component degraded for > 3 consecutive polls — alert at WARN level
- `DEGRADED → UNHEALTHY`: Degradation escalates to failure — alert at ERROR level, node removed from rotation
- `UNHEALTHY → DEGRADED`: Partial recovery — node returns to rotation with reduced capacity
- `DEGRADED → HEALTHY`: Full recovery — alert cleared

Transitions between these levels trigger appropriate actions (logging, alerting, traffic rerouting) as defined in the health check design (§3).

---

## SECTION 6: CIRCUIT BREAKER PATTERNS

### 6.1 Circuit Breaker Concept

A circuit breaker is a pattern that prevents an application from repeatedly trying to execute an operation that is likely to fail. Instead of continuing to attempt the failing operation (wasting resources and potentially causing cascading failures), the circuit breaker:
1. **CLOSED** (normal): Requests pass through to the target component
2. **OPEN** (failing): Requests are short-circuited — rejected immediately without attempting the operation
3. **HALF-OPEN** (testing): A limited number of test requests allowed through to probe if the target has recovered

### 6.2 Circuit Breakers Applied to Lumina

| Circuit Breaker Target | Monitored By | Closure Condition | Open Threshold | Half-Open Test | Recovery Action |
|----------------------|-------------|-------------------|----------------|---------------|----------------|
| External HTTP calls (SMTP, FCM, APNs, remote auth) | RetryPolicy (CRT-012) | 3 consecutive successes | 5 consecutive failures within 60 seconds | 1 test request every 30 seconds | If test succeeds → CLOSED; if fails → OPEN again |
| Remote file storage provider (S3-compatible API) | FileStoragePort adapter | 3 consecutive successes | 3 consecutive failures within 120 seconds | 1 test upload every 60 seconds | If test succeeds → CLOSED; fall back to local storage if available |
| External message broker (Kafka/RabbitMQ, if used instead of in-memory) | EventDispatcher (CRT-004) | Connection established + test publish succeeds | Broker unreachable for > 30 seconds | Periodic reconnection attempt every 15 seconds | If reconnected → resume publishing; DLQ preserves missed events |
| External search service (Elasticsearch, if used) | SearchPort adapter | Index + search test succeeds | 2 consecutive search failures within 60 seconds | 1 test search every 30 seconds | If test succeeds → CLOSED; falls back to RepositoryPort query |

### 6.3 Circuit Breaker States and Behavior

**CLOSED State (Normal Operation):**
- All requests forwarded to target component
- Failure count monitored per time window
- No impact on user experience

**OPEN State (Circuit Tripped):**
- Requests are REJECTED immediately without contacting target component
- Rejection returns a controlled error (not a cascade timeout)
- Error type: "Service temporarily unavailable" (HTTP 503 equivalent)
- User sees degraded experience but application remains stable
- Duration: until half-open test period triggers

**HALF-OPEN State (Recovery Probe):**
- Limited test requests forwarded to target (typically 1 request)
- If test succeeds → transition to CLOSED (circuit closed, normal operation restored)
- If test fails → transition back to OPEN (probing failed, target still down)
- Half-open period: fixed interval (varies per circuit, 15-60 seconds typical)

### 6.4 Circuit Breaker Interaction with RetryPolicy

Circuit breakers and retry policies work in COMPLEMENT, not conflict:

1. **Request enters** → check if circuit is OPEN
   - If OPEN: reject immediately (do NOT retry, do NOT call target)
   - If CLOSED/HALF-OPEN: proceed to step 2
2. **Attempt operation** → if fails, apply RetryPolicy (CRT-012)
   - Retry up to max retries for applicable operation type (OR-005)
   - If retries exhausted → increment failure counter for circuit breaker
3. **After retry exhaustion**: check circuit breaker failure counter
   - If failure count ≥ threshold → OPEN circuit
   - Else → stay CLOSED, next failure increments counter

This ensures that transient failures get retry treatment (cheap, fast recovery) while persistent failures trip the circuit breaker (prevents wasted retry attempts against a known-broken target).

### 6.5 Never-Circuit-Break Components

Certain internal Runtime Components MUST NOT have circuit breakers because they are integral to Lumina's core operation:

- CRT-001 CompositionRoot: assembly happens once at boot; no runtime recovery path
- CRT-002 DependencyResolver: one-shot computation; impossible to fail mid-computation
- CRT-003 TransactionCoordinator: transaction management is integral to data integrity
- CRT-015 TenantContextProvider: org_id resolution is mandatory for all tenant-scoped operations (OR-010)
- CRT-013 IdempotencyManager: idempotence guard is essential for offline sync replay correctness

Circuit breakers are applied ONLY to EXTERNAL dependencies (network services, third-party APIs, infrastructure providers), NOT to internal Runtime Components.

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | deployment-specifier v1.0 | Creation — HA Strategy for Lumina v1: availability targets, 14 failure domains, 3 SPOFs, 10-port health check suite, auto-recovery mechanisms, graceful degradation matrix, circuit breaker patterns | COMPLIANT (verified against RTS-001 15 components, RTS-002 lifecycle phases, RTS-003 OR-011/OR-012/OR-004/OR-005 lifecycle determinism, ASS-001 service catalog, INV-004 multi-tenant isolation, SYNC-004 offline-first never-block rule, BR-ID-001 diagnostic privacy) |

---

*Ce document definit la strategie de haute disponibilite pour Lumina. Il ne specifie aucun outil d'orchestration concret (pas de Kubernetes, Consul, etc.). Les mecanismes decrits sont independants de l'outil d'implementation.*
