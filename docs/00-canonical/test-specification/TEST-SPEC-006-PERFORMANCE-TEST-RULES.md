# Performance Test Rules — Lumina v1
**Doc ID:** TEST-SPEC-006
**Version:** v1.0
**Statut:** SPECIFICATION DE TESTS DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-012", "ASS-002", "ASS-004", "API-CONTRACT-001"]
**Transformation_rule :** "test-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the rules for performance testing across the Lumina application. Performance tests measure measurable latency, throughput, and resource utilization targets across all operation categories. They are not stress tests or load tests (those are separate). Performance tests verify that operations meet defined budgets under realistic usage patterns.

Performance tests run in a dedicated staging environment that matches production specifications: same PostgreSQL version, same connection pool configuration, same cache layer (if any), similar hardware profile. Every decision traces to ASS-002 (operation catalog with data volume hints) and ASS-004 (cross-aggregate coordination affecting latency).

---

## SECTION 1: PERFORMANCE BUDGETS

Performance budgets define maximum acceptable latency per operation category. These are measurable targets expressed as percentiles.

### 1.1 Read Operations Budget

| Operation Category | p95 Latency | p99 Latency | Data Volume | Conditions |
|-------------------|-------------|-------------|-------------|------------|
| Simple entity read (by ID) | < 50ms | < 100ms | 1 entity row | Single table, indexed by primary key |
| Profile query (UC-ORG-Q01, UC-ID-01 pattern) | < 80ms | < 150ms | 1 entity with related references | 1-N join within same org_id scope |
| List query with pagination, page size <= 50 | < 150ms | < 300ms | Up to 50 rows | Indexed by (org_id, sort_column) |
| List query with pagination, page size = 100 | < 200ms | < 400ms | Up to 100 rows | Indexed by (org_id, sort_column); pagination verified efficient |
| Search query (UC-RES-Q01, UC-VOC-Q04) | < 500ms | < 1000ms | Results up to 500 rows | Full-text search on indexed columns; org_id filter always applied |
| Hierarchy traversal (UC-ORG-Q02, UC-REL-Q01) | < 300ms | < 600ms | Tree depth <= 5 levels | Recursive CTE or iterative traversal; depth-limited |

### 1.2 Write Operations Budget

| Operation Category | p95 Latency | p99 Latency | Conditions |
|-------------------|-------------|-------------|------------|
| Single entity create (INSERT) | < 100ms | < 200ms | Single table insert; version increment auto |
| Single entity update (UPDATE) | < 100ms | < 200ms | Single table update; version increment checked |
| Transaction create (UC-RES-01) | < 200ms | < 400ms | Includes vocabulary category validation |
| Transaction approve (UC-RES-04) | < 150ms | < 300ms | State transition + event emission + audit log |
| Member create (UC-RES-07) | < 150ms | < 300ms | Includes email uniqueness check |
| Workflow trigger (UC-WF-01) | < 250ms | < 500ms | Instance creation + step execution + audit logging |

### 1.3 Report and Calculation Budget

| Operation Category | p95 Latency | p99 Latency | Data Volume | Conditions |
|-------------------|-------------|-------------|-------------|------------|
| CalculateBalance (UC-RPT-Q01) | < 500ms | < 1000ms | All approved transactions in period | Filtered by org_id, synced=true, period range |
| GenerateReport (UC-RPT-01) | < 1000ms | < 2000ms | Same as CalculateBalance + rendering overhead | On-demand generation; no persistence |
| ExportReport (UC-RPT-Q02) | < 2000ms | < 5000ms | Same + serialization to PDF/CSV/JSON | Format-dependent serialization time included |
| ExportAuditTrail (UC-AUD-Q02) | < 2000ms | < 5000ms | All audit entries in period | Filtered by org_id, period range |

### 1.4 Sync Operations Budget

| Operation Category | p95 Latency | p99 Latency | Data Volume | Conditions |
|-------------------|-------------|-------------|-------------|------------|
| Push batch (UC-SYNC-01) | < 2s | < 4s | Batch of 50 operations | Remote API call + local status update |
| Pull delta (UC-SYNC-02) | < 2s | < 4s | Up to 500 changed rows since last sync | Remote API call + local apply |
| Conflict resolution (UC-SYNC-03) | < 500ms | < 1000ms | Single operation conflict | Strategy-specific resolution logic |
| Connectivity check (UC-SYNC-Q01) | < 200ms | < 500ms | None | Ping to remote endpoint |

### 1.5 End-to-End Critical Journey Budget

Each of the 12 E2E journeys from TEST-SPEC-004 has an end-to-end latency budget:

| Journey | Total Budget (p95) | Notes |
|---------|-------------------|-------|
| 1: Org creation + admin setup | < 3s | Foundation setup; minimal data |
| 2: Financial approval workflow | < 5s | Multi-step: create → submit → approve → report |
| 3: Member registration + group + event + notification | < 5s | Four aggregates involved |
| 4: Full workflow lifecycle | < 5s | Multi-step approval chain |
| 5: Form definition through submission | < 3s | Form rendering + validation + resource creation |
| 6: Vocabulary through transaction categorization | < 3s | Three aggregates: vocab, form, resource |
| 7: Offline create through sync conflict resolve | < 10s | Network-dependent; includes sync round-trip |
| 8: Bulk member import (50 records) | < 10s | Batch processing; partial success reporting |
| 9: Archive → trash → purge lifecycle | < 3s | Sequential lifecycle transitions |
| 10: Settings + preferences + notification | < 3s | Configuration updates + notification delivery |
| 11: Multi-tenant isolation verification | < 5s | Cross-org queries; isolation assertions |
| 12: Auth session lifecycle | < 3s | Login → refresh → revoke → re-auth → logout |

---

## SECTION 2: LOAD TESTING PARAMETERS

Load tests verify system behavior under sustained concurrent usage.

### 2.1 Concurrency Levels

| Level | Definition | Target Users | Expected Behavior |
|-------|-----------|-------------|------------------|
| **Normal** | Typical production usage | 100 concurrent org users | All operations within performance budgets; p95 latency unchanged from baseline |
| **Peak** | End-of-month reporting period; monthly close | 250 concurrent org users | Read operations may degrade up to 2x; write operations remain within budget; reports may exceed normal budget but stay under absolute ceiling |
| **Stress** | Maximum practical load; capacity planning | 500 concurrent org users | Performance degrades gracefully; errors returned (not crashes); p99 latency increases but system remains responsive; connection pool exhaustion avoided |

### 2.2 Load Test Scenarios

Each concurrency level requires these test scenarios:

| Scenario | Description | Measured Metrics |
|----------|-------------|-----------------|
| Read-heavy mix | 80% reads / 20% writes | p50/p95/p99 latency; error rate; cache hit ratio |
| Write-heavy mix | 30% reads / 70% writes | p50/p95/p99 latency; lock contention; write queue depth |
| Report generation spike | 10% reads/writes + 2 simultaneous GenerateReport calls | Report p95 latency; memory during report; DB CPU during aggregation |
| Sync burst | 20 devices syncing simultaneously | Push/pull latency; conflict rate; connection pool utilization |
| Auth storm | 100 login attempts in 10 seconds | Login p95 latency; token generation time; session store pressure |

### 2.3 Duration

| Test Type | Minimum Duration | Rationale |
|-----------|-----------------|-----------|
| Normal load | 15 minutes | Stable metric collection; warm-up excluded |
| Peak load | 10 minutes | Sufficient to detect gradual resource depletion |
| Stress test | 5 minutes | Short duration to avoid infrastructure damage; focus on failure modes |

---

## SECTION 3: DATABASE PERFORMANCE

### 3.1 Query Plan Analysis

Every operation that touches more than one table via JOIN must have its query plan analyzed:

| Check | Method | Acceptance Criteria |
|-------|--------|---------------------|
| Index usage | EXPLAIN ANALYZE on all read queries | UsingIndex or IndexOnlyScan in plan; SeqScan only for tables < 10 rows |
| Join cost | NestedLoop vs HashJoin vs MergeJoin | MergeJoin or HashJoin for large sets; NestedLoop acceptable only for indexed FK lookups |
| Filter selectivity | WHERE clause on indexed column | Index used; filter reduces rows before join |
| Pagination efficiency | Cursor-based or indexed offset pagination | Constant time regardless of page number; no N+1 query pattern |

### 3.2 Table Join Cost

Cross-aggregate joins have specific cost budgets:

| Join Type | p95 Latency Budget | Affected Operations |
|-----------|-------------------|---------------------|
| Single FK lookup (Resource → Vocabulary category) | < 20ms additional | CreateTransaction, UpdateDraftTransaction |
| Parent-child traversal (RelationshipAggregate) | < 50ms per depth level | GetDescendants, GetAllGroupsForMember |
| Org-scoped filter (ALL cross-table joins include _org_id) | < 10ms additional | Every query — enforced at repository layer |
| Audit join (LogAction side-effect read) | < 15ms | Any mutation that triggers audit logging |

### 3.3 Connection Pool Utilization

Under peak load (250 concurrent users):
- PostgreSQL connection pool: <= 80% utilization
- Average connection wait time: < 50ms
- Connection recycling (idle timeout cleanup): no connections leaked
- Under stress (500 concurrent): pool saturates gracefully; excess requests queue with timeout (not crash)

### 3.4 Bulk Operation Index Verification

All 22 indexes with org_id from the physical data model must be verified for query plan efficiency:

| Index | Purpose | Verification Method |
|-------|---------|---------------------|
| resource_records_org_id_idx | org-scoped resource queries | EXPLAIN shows index scan for org_id filter |
| members_org_id_idx | org-scoped member queries | EXPLAIN shows index scan |
| sessions_org_id_idx | org-scoped session queries | EXPLAIN shows index scan |
| pending_operations_org_id_idx | org-scoped sync queries | EXPLAIN shows index scan |
| All 22 org_id indexes | Multi-tenant query filtering | Each verified with EXPLAIN ANALYZE using representative org_id value |

---

## SECTION 4: MEMORY AND CPU PROFILING

### 4.1 Memory Thresholds Under Sustained Load

| Resource | Normal Load Limit | Peak Load Limit | Alert Threshold |
|----------|------------------|-----------------|----------------|
| Application memory | < 512MB per instance | < 1GB per instance | > 1.2GB triggers alert |
| Database memory (shared_buffers) | < 40% of available RAM | < 60% of available RAM | > 70% triggers alert |
| Cache memory | < 256MB | < 512MB | > 600MB triggers eviction warning |

### 4.2 Memory Leak Detection

Performance tests include memory monitoring for:
- Connection objects: all database connections returned to pool after use
- Event handler registrations: no cumulative handler growth between test iterations
- Aggregate instances: garbage collected after each test (no lingering references)
- Buffer allocation: push/pull batches do not accumulate unbounded memory

### 4.3 CPU Profiling

During peak load scenarios:
- Application CPU: < 70% sustained average
- Database CPU: < 80% sustained average
- CPU spikes (transient peaks > 90%): permitted but must return to baseline within 30 seconds

Profiling focuses on:
- Aggregate boundary method execution (should be O(1) per call)
- Event processing pipeline (should be O(n) where n = events in batch)
- Balance calculation (should use indexed queries, not full table scans)
- Conflict resolution strategy dispatch (simple switch-based, minimal overhead)

---

## SECTION 5: SCALING TESTS

### 5.1 Database Connection Max-Out

Test: Gradually increase concurrent connections until database connection limit is reached.

| Metric | Expected Behavior |
|--------|------------------|
| Before limit | All queries execute within performance budgets |
| At 80% limit | p95 latency begins to increase (queueing for connections) |
| At 100% limit | Requests queue; timeout after configured wait (max 3 seconds); graceful error returned (E-500-002 PERSISTENCE_FAILURE) |
| After connections freed | Queued requests resume normally; no data loss |

### 5.2 Cache Miss Spike

Test: Warm cache with known data set, then invalidate or evict all entries, then replay traffic.

| Metric | Expected Behavior |
|--------|------------------|
| Cache hit scenario | Read operations within base latency (per Section 1.1) |
| First miss after invalidation | Read operations 2-3x slower (DB fetch required); should still be under budget |
| Sustained miss scenario | All reads go to DB; p95 increases but system stable; no cascade to write paths |
| Cache rebuild | Next access after cold start returns within 1.5x normal latency |

### 5.3 Data Volume Scaling

Test: Execute representative operations against databases containing increasing data volumes.

| Data Volume | Operation Tested | Expected Impact |
|------------|-----------------|----------------|
| 100 rows/table | Baseline | All operations within base budget |
| 1,000 rows/table | Moderate | Read < 200ms p95 (budget already assumes this volume) |
| 10,000 rows/table | Large | Verify indexes keep query time proportional; no linear scan degradation |
| 100,000 rows/table | Production scale | p95 may approach upper budget ceiling; verify no O(n) algorithms in domain layer |

---

## SECTION 6: PERF TEST SCHEDULE

### 6.1 When to Run Performance Tests

| Trigger | Tests Executed | Frequency |
|---------|---------------|-----------|
| Pre-release gate | Full suite (all budgets, all concurrency levels) | Before every release tag |
| Nightly on main branch | Core budgets only (read, write, list) | Nightly |
| Schema change commit | Query plan regression + index verification | Every schema migration commit |
| New aggregate/boundary | Operation-specific budgets for new operations | On first deployment of new code |
| Performance budget violation | Targeted re-run of failed budgets | Within 24 hours of detection |

### 6.2 Baseline Management

Performance baselines are maintained per operation category:

| Baseline Element | How Maintained | Who Reviews |
|-----------------|---------------|-------------|
| p95 latency baseline per operation | Stored in CI system; updated when intentionally improved | Engineering lead |
| Database query plan baseline | EXPLAIN output snapshots stored; compared on schema changes | DBA or senior engineer |
| Memory/CPU baseline | Monitoring system historical data; quarterly review | Infrastructure team |

### 6.3 Degradation Tolerance

| Degradation Amount | Action |
|-------------------|--------|
| 0-5% improvement | No action needed; celebrate |
| 5-10% degradation | Allowed with documented exception; investigation ticket created |
| 10-25% degradation | Merge allowed with exception; mandatory investigation within 48 hours |
| > 25% degradation | Merge blocked until root cause identified and fix planned |

### 6.4 Performance Test Reporting

After each performance test run, a report must include:
- All measured latencies (p50, p95, p99) per operation
- Comparison to previous baseline (improved / unchanged / degraded)
- Resource utilization during test (CPU, memory, DB connections)
- Any budget violations with severity classification
- Recommended follow-up actions

---

## APPENDIX A: PERFORMANCE TEST COVERAGE MATRIX

| Aggregate | Operations Tested | Key Budget |
|-----------|------------------|-----------|
| OrganizationAggregate | Create, UpdateSettings, GetProfile, GetDescendants | Read: < 200ms p95 |
| IdentityAggregate | Login, Refresh, Revoke, CreateUser | Auth: < 300ms p95 |
| ResourceAggregate | CreateTx, UpdateDraft, Submit, Approve, Reject, Compensate, CreateMember, UpdateMember, TransitionStatus, Search, Export | Write: < 500ms p95; Search: < 500ms p95 |
| RelationshipAggregate | AddToGroup, RemoveFromGroup, SetOrgUnitParent, GetDescendants, GetGroupsForMember, GetMembersOfGroup | Hierarchy: < 300ms p95 |
| WorkflowAggregate | Trigger, ApproveStep, RejectStep, Cancel, Resubmit, GetPending | Workflow: < 500ms p95 |
| FormAggregate | Validate, Load, Render, GetVisibleFields | Render: < 200ms p95 |
| NotificationAggregate | Send, MarkAsRead, UpdatePrefs, SetRateLimit | Send: < 500ms p95 |
| VocabularyAggregate | AddTermValue, DeprecateValue, ResolveLabel, GetTerms, SearchTerms | Lookup: < 100ms p95 |
| ReportingAggregate | GenerateReport, CalculateBalance, ExportReport, GetReportTypes | CalculateBalance: < 500ms p95; GenerateReport: < 1s p95 |
| AuditAggregate | LogAction, QueryLogs, ExportTrail | LogAction: < 200ms p95; Query: < 500ms p95 |
| LifecycleAggregate | Archive, Trash, Purge, Restore, ListArchives, SearchArchives | Archive: < 300ms p95 |
| ConfigurationAggregate | UpdateSetting, ResetDefaults, GetSetting, GetAllSettings | Update: < 100ms p95 |
| OfflineSyncAggregate | PushOps, PullChanges, ResolveConflict, MarkConfirmed, CheckConnectivity, GetSyncStatus | Push/Pull: < 2s p95; ResolveConflict: < 500ms p95 |

---

## APPENDIX B: DOCUMENT REVISION HISTORY

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v1.0 | 2026-07-25 | Agnes-2.0-Flash (Sapiens AI) | Genesis definition of performance test rules |

---

*This performance test specification defines measurable latency and resource budgets for all Lumina operations. All performance tests MUST comply with these budgets.*

*FIN DU DOCUMENT TEST-SPEC-006*
