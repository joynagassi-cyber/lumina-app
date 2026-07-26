# Release Strategy — Lumina v1

**Doc ID:** DEP-SPEC-004
**Version:** v1.0
**Statut:** SPÉCIFICATION DÉPLOIEMENT DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-v1", "RTS-002", "ASS-001", "PAS-001"]
**Transformation_rule :** "deployment-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## TABLE DES MATIÈRES

1. [Release Cadence](#section-1-release-cadence)
2. [Feature Flag / Toggle Strategy](#section-2-feature-flag--toggle-strategy)
3. [Release Verification Pipeline](#section-3-release-verification-pipeline)
4. [Promotion Process](#section-4-promotion-process)
5. [Change Management](#section-5-change-management)
6. [Release Health Dashboard](#section-6-release-health-dashboard)

---

## SECTION 1: RELEASE CADENCE

### 1.1 Standard Release Windows

Standard releases follow a predictable schedule to allow operations teams, QA teams, and stakeholders to prepare.

| Environment | Release Frequency | Typical Window | Change Freeze Period |
|------------|------------------|----------------|---------------------|
| Development | Continuous (multiple per day) | Any time | None |
| Staging | Per release candidate | Daily, 10:00-14:00 local time | Pre-UAT freeze (24 hours before UAT window closes) |
| Production | Weekly (every Tuesday) | 02:00-06:00 UTC (low traffic window) | Friday afternoon through Monday morning (if weekly release is Tuesday); additional freezes for holiday periods |
| Disaster Recovery | Coincidental with Production release | Synchronized with Production deployment | Same as Production |

**Rationale for Tuesday 02:00-06:00 UTC Production releases:**
- Low global traffic period across all time zones
- Full business day available post-deployment for monitoring and rollback if needed
- Weekend preceding and following minimizes business disruption risk
- 4-hour window sufficient for rolling restart of 3+ node cluster with health verification between nodes

### 1.2 Release Candidate Process

Before any Production release, a Release Candidate (RC) is created and deployed to Staging:

1. **RC Creation:** A build artifact is tagged with `-rc.N` suffix on the semantic version (e.g., `1.3.7-rc.1`)
2. **RC Testing:** Full 83-operation test suite (per ASS-001) executed against RC in Staging environment
3. **Performance Benchmarking:** P50/P95/P99 latency, error rate, memory profile compared against last known-good baseline
4. **Regression Testing:** All previously-fixed issues re-verified against RC
5. **Go/No-Go Decision:** Operations lead, QA lead, and Product owner each vote Go or No-Go; unanamous Go required for Production deployment

If RC testing fails, the issue is fixed, a new RC tag is created (`-rc.2`, `-rc.3`, etc.), and the cycle repeats. There is NO maximum number of RC iterations — quality takes precedence over speed.

### 1.3 Hotfix Process

Hotfixes bypass standard cadence when critical production issues require immediate resolution.

**Trigger Conditions for Hotfix:**
- Error rate exceeds 5% of total requests (standard threshold is 1%, hotfix threshold is elevated to account for urgency)
- Security vulnerability confirmed in production
- Data corruption detected that cannot be resolved without code change
- Regulatory compliance breach requiring immediate remediation

**Hotfix Procedure:**
1. Issue identified and confirmed by Operations team
2. Hotfix branch created from current Production artifact commit (NOT from latest development head — hotfix applies to the EXACT code in production)
3. Fix developed, tested, and peer-reviewed (minimum 1 other developer review required — no exceptions)
4. Hotfix artifact built with `-hotfix.N` suffix (e.g., `1.3.7-hotfix.1`)
5. Hotfix deployed to Production WITHOUT Staging deployment (SKIP STAGING validation for hotfixes where every minute counts — documented exception to standard promotion process)
6. Immediate post-deployment monitoring (manual health check by deploying engineer within 5 minutes of deployment)
7. Full regression testing executed in Staging ASYNCHRONOUSLY after hotfix deployment (catches side effects missed by urgent production deployment)
8. Hotfix incorporated into next regular release cycle

**Hotfix Escalation Path:** Operations Engineer → DevOps Engineer → Engineering Lead → CTO (for security-related hotfixes)

### 1.4 Emergency Rollback Release

When a deployment causes a critical issue that requires reverting, the rollback itself is treated as a release:

1. Identify the last known-good artifact version (per DEP-SPEC-001 §5 rollback retention)
2. Create an emergency rollback plan documenting what is being reverted, why, and expected outcome
3. Execute rollback using rolling restart pattern (see DEP-SPEC-005)
4. Post-rollback monitoring for 30 minutes minimum
5. Document incident in change log

### 1.5 Release Schedule Conflicts

When multiple scheduled events collide:
- **Release window coincides with holiday freeze:** defer to next available window
- **RC fails during active Production release:** abort Production release, fix RC, retry next window
- **Multiple hotfixes queued:** prioritize by severity (P0 security > P1 data integrity > P2 service degradation > P3 cosmetic)
- **Production and Stacing release windows overlap:** acceptable — they are independent environments

---

## SECTION 2: FEATURE FLAG / TOGGLE STRATEGY

### 2.1 When to Use Feature Flags vs Releases

Feature flags control whether a feature is ENABLED or DISABLED at runtime WITHOUT deploying new code. They are complementary to, NOT a replacement for, the release process.

**USE feature flags when:**
- A feature is deployed to Production but intentionally disabled for most users
- Gradual rollout of a feature to a subset of organizations (canary release)
- Time-based activation (feature enabled at a specific date regardless of deployment status)
- A/B testing between two feature implementations
- Mitigating unknown unknowns — deploy code with flag OFF, enable after monitoring confirms stability
- Cross-cutting features that affect multiple Application Services

**USE a release (no flag) when:**
- The feature is fully complete, tested, and ready for universal availability
- The feature has been validated in Staging and optionally in canary Production with flag enabled for small percentage
- Data migrations are involved (schema changes must be backward-compatible before flipping the flag)
- The feature adds operations to an existing Application Service (backward-compatible API addition)
- Bug fixes (these are always released, not flagged)

**NEVER use a feature flag when:**
- It is used as a substitute for incomplete testing ("flag it off and we'll test later")
- It masks architectural debt that should be addressed directly
- More than 3 flags affect the same operation (flag complexity creates combinatorial testing explosion)

### 2.2 Feature Flag Categories

| Category | Scope | Lifetime | Management |
|----------|-------|----------|-----------|
| Experiment | Single org or user segment | Days to weeks | Product owner manages; auto-expire after experiment conclusion |
| Operational | Organization-wide enable/disable | Weeks to months | Operations team manages; tied to capacity/sla considerations |
| Conditional | Depends on configuration, tenant attributes, or external conditions | Indefinite (until removed) | Engineering manages; must have cleanup deadline in flag metadata |
| Ramp | Progressive percentage rollout | Days (typically) | Automated: percentage increases daily until 100% |

### 2.3 Feature Flag Governance

Each feature flag MUST have metadata documenting:

| Metadata Field | Example | Required? |
|---------------|---------|-----------|
| `flag_key` | `feature_offline_push_v2` | Yes |
| `description` | "Use v2 offline push algorithm instead of v1 batch size" | Yes |
| `owner` | "ResourceService team lead" | Yes |
| `created_date` | `2026-06-15` | Yes |
| `expiry_date` | `2026-07-15` (30 days from creation) | Yes |
| `default_state` | `false` (disabled by default) | Yes |
| `environment_override` | `{ staging: true, production: false }` | Conditional |
| `related_migration` | `MIG-028` (Migration Pack migration that enables this feature) | If data schema change involved |
| `related_invariant` | `SYNC-003` (invariant the feature implements or modifies) | If domain behavior change |

**Cleanup Rule:** Every feature flag MUST be removed (code deleted) within 90 days of reaching 100% enablement OR 90 days past expiry_date, whichever comes first. Abandoned flags are technical debt that degrades system understandability.

Flag removal procedure:
1. Confirm flag is at 100% enablement (or explicitly deprecated)
2. Remove flag evaluation code from all affected Application Services (all 13 services per ASS-001)
3. Remove flag from configuration store
4. Verify all tests pass without flag present
5. Deploy removal as part of standard release cycle
6. Delete flag metadata from documentation

### 2.4 Flag Evaluation Performance

Feature flag evaluation MUST have negligible performance impact:
- Resolution happens ONCE per request (during TenantContextProvider resolution, CRT-015)
- Flag state cached in ConfigSnapshot after initial resolution (not re-resolved per operation)
- Evaluation overhead measured as < 1 microsecond per flag check (p99)
- Feature flag infrastructure is part of CRT-005 ConfigurationLoader scope (configuration layer, not business logic layer)

Per OR-011 constitutional rule: feature flags may disable or modify Application Service behavior BUT MAY NEVER disable or modify any Runtime Component. All 15 CRTs are always initialized and operational regardless of feature flag state.

---

## SECTION 3: RELEASE VERIFICATION PIPELINE

### 3.1 Pipeline Overview

The release verification pipeline defines gates that an artifact MUST pass before being promoted to the next environment. Each gate is a CHECKPOINT — the artifact CANNOT proceed to the next environment until ALL checks in the current gate PASS.

```
Build (Source) → Gate 1: CI Tests → Stage (Staging) → Gate 2: QA/UAT → Approved → Gate 3: Production Readiness → Production → Gate 4: Post-Deployment Verification
```

### 3.2 Gate 1: Build-Time Verification (Source → Artifact)

Executed against the source code commit before any environment deployment:

| Check | Description | Pass Criteria | Fail Action |
|-------|-------------|--------------|-------------|
| Static Analysis | Lint rules, type checking, dependency analysis | Zero errors, warnings below threshold | Block build — developer fix required |
| Unit Tests | All unit tests in test suite | 100% pass rate | Block build |
| Integration Tests | Isolated integration tests for aggregate boundaries | 100% pass rate | Block build |
| Schema Generation | Migration Pack artifacts regenerated from schema spec | Generated output matches committed Migration Pack exactly | Block build — schema drift detected |
| Port Coverage | Verify all 17 Ports bound and all 13 AppServices exposed | Coverage matrix shows 100% binding | Block build |
| Security Scan | Static application security testing (SAST) | Zero CRITICAL/Major findings | Block build — fix or obtain waiver |
| Dependency Audit | Third-party dependency vulnerability scan | Zero known CVEs at CRITICAL/Major severity | Block build — update dependencies |
| Determinism Test | Startup sequence produces identical output across N runs (OR-011) | Identical logs for 3 consecutive runs | Block build — non-deterministic initialization |

### 3.3 Gate 2: Staging Verification (Artifact → Staging)

Executed against the artifact deployed in Staging environment:

| Check | Description | Pass Criteria | Fail Action |
|-------|-------------|--------------|-------------|
| Smoke Tests | One representative command + query per AppService (all 13 services) | All 26 smoke tests pass | Roll back artifact from Staging |
| Full Operation Suite | All 83 operations from ASS-001 tested | 100% pass rate | Block promotion to Production |
| Multi-Tenant Isolation | Two org contexts verified as isolated | Zero cross-org data leakage | Block promotion |
| Schema Migration | Migration Pack applies cleanly to fresh staging database | 35 migrations complete, 32 tables created | Roll back migration pack |
| Health Checks | All 10 port-level health checks pass (CRT-007 Phase 105) | HEALTHY verdict (DEGRADED acceptable for non-critical ports) | Block promotion if any UNHEALTHY |
| Performance Baseline | P50/P95/P99 latency measured and compared to previous release | P99 within 10% of previous release baseline | Require engineering sign-off |
| Load Test | Simulated traffic at 1.5x Production peak for 15 minutes | Zero errors, zero latency spikes, stable memory | Block promotion |
| Offline Sync Simulation | Push/pull cycle with simulated network interruptions | Confirmed pending ops queue and conflict resolution | Block promotion |
| Feature Flag Validation | All active flags evaluated correctly | Flag states match configuration | Block promotion |
| Audit Trail | Write operations produce correct audit entries | OLDNEW-002: old_values AND new_values present in every entry | Block promotion |
| Idempotency | Same request_id sent twice → second execution returns cached response | Double execution prevented | Block promotion |
| Retry Behavior | Failed event publish retries up to max 5 then DLQ | OR-004 and OR-005 verified | Block promotion |

### 3.4 Gate 3: Production Readiness Approval (Pre-Production Gate)

Manual approval gate requiring explicit sign-off from designated roles:

| Approver | Role | What They Verify |
|----------|------|-----------------|
| QA Lead | Quality assurance | Gate 2 results reviewed; all blocking items resolved |
| Operations Lead | Infrastructure readiness | Production node count adequate, load balancer configured, monitoring active |
| Product Owner | Feature completeness | New features match acceptance criteria; regression tests pass |
| Security Lead (if applicable) | Security review | Security scan cleared; no new vulnerabilities introduced |

**Approval Format:** Each approver records their name, timestamp, and comment in the deployment registry. ABSENCE of approval = deployment BLOCKED. Silence is not approval — explicit action required.

### 3.5 Gate 4: Post-Deployment Verification (Post-Production Gate)

Executed automatically immediately after Production deployment completes:

| Check | Description | Threshold | Auto-Rollback? |
|-------|-------------|-----------|----------------|
| Health Check Verdict | CRT-007 reports HEALTHY or DEGRADED (not UNHEALTHY) | HEALTHY/DEGRADED only | Yes — if UNHEALTHY on any critical port |
| Error Rate | Percentage of requests returning E-5xx errors | < 1% | Yes — if > 1% for > 2 minutes |
| Latency P99 | 99th percentile response time | < 2x pre-deployment baseline | Yes — if > 2x baseline for > 2 minutes |
| Transaction Count | Number of transactions processed per minute | > 80% of pre-deployment rate | Investigate (not auto-rollback — may be expected ramp-up) |
| Event Dispatch Count | Events published via CRT-004 | > 80% of pre-deployment rate | Investigate |
| Offline Sync Queue Depth | Number of pending operations | Stable or decreasing | Investigate if increasing |
| Resource Leaks | Diagnostics CRT-008 resource_leaks counter | == 0 | Alert (not auto-rollback — monitor for trend) |
| Rollback Safety Check | Previous artifact still accessible in registry | Yes — confirmed available | N/A |

**Monitoring Duration:** Gate 4 checks run continuously for 5 minutes post-deployment. If ALL checks pass throughout the monitoring window → release CONFIRMED SUCCESSFUL. If ANY check fails during monitoring window → investigation initiated; auto-rollback triggered for error rate and latency violations.

---

## SECTION 4: PROMOTION PROCESS

### 4.1 Artifact Promotion Rules

Artifacts PROMOTE UPWARD but NEVER DOWNWARD. An artifact that passes Staging verification CAN be deployed to Production. The SAME artifact CAN NOT be redeployed to Staging from Production. Promotion is strictly unidirectional.

**Exception for Hotfixes:** Hotfix artifacts may skip Staging (see §1.3 Hotfix Process). This is a documented exception requiring Operations Lead and DevOps Lead dual authorization.

### 4.2 Promotion Sequence

```
Development → Staging → Production → DR
```

Each arrow represents an explicit promotion action:

1. **Development → Staging:** Developer triggers promotion when feature branch is complete and all Gate 1 checks pass. Automated: artifact built, pushed to registry, pulled by Staging environment.

2. **Staging → Production:** Manual promotion gate (Gate 3 approval required). Triggered by release coordinator during the designated release window.

3. **Production → DR:** Automatic. DR environment continuously replicates Production configuration and receives the same artifact during every Production deployment. No manual promotion step required.

### 4.3 Promotion Atomicity

When promoting to Production with N application nodes:
- Node 1 receives new artifact, starts up, passes health check → marked HEALTHY
- Node 1 added to load balancer pool
- Node 1 drains old connections (grace period 30 seconds)
- Node 1 old instance terminated
- Repeat for Node 2, Node 3, ... Node N
- After all nodes updated, full health check suite re-executed across entire cluster

If ANY node fails during its individual update:
- That node's update ABORTED
- Remaining nodes NOT updated yet
- Decision: continue with remaining nodes (partial deployment) OR rollback all updated nodes
- Decision made by Operations Lead based on failure reason

### 4.4 Migration Pack Coordination

Database schema migrations (Migration Pack) MUST be coordinated with application deployments:

1. Migration Pack version MUST match the application artifact version (documented in artifact build metadata)
2. Migrations applied BEFORE application nodes start serving traffic (during startup Phase 102, PersistenceVerificationPort validates 32 tables)
3. If migration fails (table creation error, constraint violation): application deployment ROLLED BACK; migration IS NOT PARTIALLY APPLIED — migration pack is idempotent (IF NOT EXISTS) so reapplication is safe
4. If migration succeeds but application fails to start: database state is OK (migrations are backward-compatible additions); application artifact rollback resolves the issue

**Backward Compatibility Rule:** All migrations in the Migration Pack must be forward-compatible — new application versions can read tables created by BOTH the old and new schema versions. This allows rolling migrations (schema update before code update) if needed.

---

## SECTION 5: CHANGE MANAGEMENT

### 5.1 Change Documentation Requirements

Every Production change MUST be documented before deployment. Documentation includes:

| Field | Description |
|-------|-------------|
| Change ID | Unique identifier (auto-generated by deployment registry) |
| Title | Brief description of the change |
| Type | Feature, Bugfix, Hotfix, Configuration, Migration, Rollback |
| Artifact Version | Semantic version + SHA-256 hash of the deployed artifact |
| Migration Pack Version | Companion migration pack version (e.g., MIGRATION-PACK-V1.2) |
| Description | Detailed explanation of what changed and why |
| Affected Components | Which Runtime Components, Application Services, or Ports are impacted |
| Risk Level | Low (bugfix), Medium (new feature), High (schema migration), Critical (security) |
| Rollback Plan | Specific steps to revert this change, including target artifact version |
| Approval Chain | Names and timestamps of all approvers (Gate 3) |
| Deployment Window | Scheduled date and time range |
| Post-Deploy Verification | Specific checks to run after deployment (supplemental to Gate 4) |

### 5.2 Change Classification

| Classification | Criteria | Approval Required |
|---------------|----------|------------------|
| Trivial | Documentation-only, configuration value change that does not affect behavior | DevOps Engineer |
| Standard | Bug fixes, minor features, performance improvements | QA Lead + Operations Lead |
| Significant | Major features, schema migrations, architecture changes | QA Lead + Operations Lead + Product Owner + Security Lead |
| Emergency | Security vulnerability fix, data corruption fix, regulatory compliance | Operations Lead + DevOps Lead (post-facto review within 24 hours) |

### 5.3 Change Calendar

- **Weekly change calendar** published every Monday listing planned changes for the week
- **Monthly change freeze** typically observed during peak business periods (documented annually)
- **Ad-hoc changes** (hotfixes) announced via emergency channel immediately

---

## SECTION 6: RELEASE HEALTH DASHBOARD

### 6.1 Dashboard Definition

A release health dashboard provides real-time visibility into the state of an ongoing release. It is consumed by the Operations team, engineering leads, and product owners during and after deployment.

### 6.2 Required Dashboard Metrics

The dashboard displays the following metrics, sourced from CRT-008 Diagnostics and CRT-007 HealthMonitor:

| Metric Group | Individual Metrics | Source | Update Frequency |
|-------------|-------------------|--------|-----------------|
| Deployment Status | Current artifact version, nodes updated, nodes healthy, deployment phase | Deployment registry | Per-node transition |
| Request Volume | Total requests/min, requests/node | Load balancer + CRT-008 | Per second |
| Error Rate | E-5xx count, error breakdown by code, error rate % | CRT-008 + error classification | Per second |
| Latency | P50, P95, P99 response times | CRT-008 / diagnostics | Per 10 seconds |
| Health Check | Overall verdict (HEALTHY/DEGRADED/UNHEALTHY), per-port status | CRT-007 HealthMonitor | Per poll (configurable, default 30s) |
| Event Processing | Events dispatched, events failed, DLQ depth, retry count | CRT-004 + CRT-012 | Per minute |
| Offline Sync | Pending operations count, push success rate, conflict detection count | CRT-009 Scheduler + OfflineSyncAggregate | Per 5 minutes |
| Database | Active connections, query latency, connection pool utilization | CRT-007 (RepositoryPort health) | Per poll |
| Cache | Hit rate, miss rate, eviction count | CRT-007 (CachePort health) | Per poll |
| Audit | Entries written, write failures (non-blocking) | CRT-014 AuditEnabler | Per minute |
| Resource Leaks | Acquired vs released resource count, leak counter | CRT-008 | Per poll |
| Feature Flags | Active flags, flag states per environment | ConfigurationService | Per request resolution |

### 6.3 Dashboard Alerting

Automated alerts trigger on the following conditions during a release:

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Error Rate Spike | Error rate > 1% for > 60 seconds | WARNING | Notify Operations team |
| Critical Error Rate | Error rate > 5% for > 2 minutes | CRITICAL | Initiate investigation; auto-rollback possible |
| Latency Degradation | P99 > 2x pre-deployment baseline for > 2 minutes | CRITICAL | Auto-rollback triggered |
| Health Check Failure | Any critical port becomes UNHEALTHY | CRITICAL | Remove node from pool; investigate |
| Event DLQ Growth | DLQ entries growing > 10/minute | WARNING | Investigate failing handlers |
| Replication Lag | DR region replication lag > 60 seconds | WARNING | Alert Operations during DR failover consideration |
| Resource Leak | CRT-008 resource_leaks counter > 0 | WARNING | Investigate for missing finally blocks |
| Audit Write Failure | AuditEnabler failure rate > 0.1% | INFO (non-blocking) | Log for investigation; never triggers rollback |

### 6.4 Post-Release Monitoring Period

After a successful deployment (Gate 4 passed):
- **Hypercare period:** 30 minutes of intensified monitoring (dashboard refresh interval: 10 seconds instead of default 30 seconds)
- **Stabilization period:** 4 hours of standard monitoring
- **Extended observation:** 24 hours with reduced frequency (hourly summary)
- **Release closure:** After 24 hours with no issues, release officially closed in deployment registry

If any alert fires during hypercare or stabilization, monitoring reverts to intensified mode until the condition resolves or rollback is executed.

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | deployment-specifier v1.0 | Creation — Release Strategy for Lumina v1: cadence (weekly + hotfix), feature flag governance, 4-gate verification pipeline, promotion atomicity, change management, release health dashboard with real-time metrics | COMPLIANT (verified against RTS-001 15 components, RTS-002 phases, RTS-003 OR-011/OR-012 lifecycle rules, ASS-001 83 operations, PAS-001 17 ports, BR-ID-001 diagnostic privacy, RETENTION-031 audit retention) |

---

*Ce document definit la strategie de liberation pour Lumina. Il ne specifie aucun outil CI/CD concret (pas de GitHub Actions, GitLab CI, Jenkins). L'outillage est selectionne independemment des regles decrites ici.*
