# Rollback Strategy — Lumina v1

**Doc ID:** DEP-SPEC-005
**Version:** v1.0
**Statut:** SPÉCIFICATION DÉPLOIEMENT DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-v1", "RTS-002", "RTS-003", "TRR-V1.2"]
**Transformation_rule :** "deployment-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## TABLE DES MATIÈRES

1. [Rollback Decision Criteria](#section-1-rollback-decision-criteria)
2. [Rollback Types](#section-2-rollback-types)
3. [Rollback Procedure](#section-3-rollback-procedure)
4. [Rollback Safety](#section-4-rollback-safety)
5. [Migration Rollback](#section-5-migration-rollback)
6. [Rollback Testing](#section-6-rollback-testing)

---

## SECTION 1: ROLLBACK DECISION CRITERIA

A rollback decision is triggered when post-deployment monitoring detects that the new artifact degrades system health beyond acceptable thresholds. The following criteria are evaluated automatically by the release health dashboard (§6 of DEP-SPEC-004) and manually by the Operations team.

### 1.1 Automatic Rollback Triggers

| Trigger | Condition | Threshold | Auto-Rollback? |
|---------|-----------|-----------|----------------|
| Error Rate | E-5xx response rate exceeds baseline | > 1% of total requests sustained for > 2 minutes | YES |
| Latency Degradation | P99 latency exceeds pre-deployment baseline | > 2x baseline sustained for > 2 minutes | YES |
| Health Check UNHEALTHY | Critical port reports UNHEALTHY verdict | Any critical port (RepositoryPort, EventPublicationPort, IdentityProviderPort) | YES |
| Transaction Failure | Cross-aggregate saga compensation failure rate | > 5% of sagas failing compensation | YES |
| Data Corruption Detection | Invariant violation detected during processing | Any INV-XXX violation in production | YES (immediate) |
| Offline Sync Queue Growth | Pending operations queue growing unbounded | > 1000 ops/minute growth for > 5 minutes | INVESTIGATE (not auto-rollback) |

### 1.2 Manual Rollback Triggers

These conditions require Operations Lead or Engineering Lead to initiate a rollback:

| Trigger | Description |
|---------|-------------|
| Business Logic Error | Application returns incorrect results (e.g., wrong transaction amounts, incorrect member statuses) — errors that pass health checks but violate business invariants |
| Security Concern | Suspected vulnerability exposed by the new release (prevents exploitation even if not confirmed) |
| Regulatory Non-Compliance | New release causes behavior that violates regulatory requirements (e.g., audit log gaps, data retention failures) |
| Performance Degradation (Subtle) | P50 latency unchanged but P99 increased moderately; business impact possible despite not meeting auto-rollback thresholds |
| User Reports | Real users report functional issues not yet detectable by automated metrics (requires correlation with deployment timeline) |
| Dependency Failure | External dependency (payment processor, notification provider) returns unexpected responses compatible with new code but not previous version |

### 1.3 Decision Authority

| Role | Can Initiate Auto-Rollback? | Can Authorize Manual Rollback? |
|------|---------------------------|-------------------------------|
| Developer | NO (Development only) | NO |
| QA Engineer | NO | NO |
| Operations Engineer | YES (via monitored threshold trigger) | YES (for Production) |
| DevOps Engineer | NO | YES (with Operations Engineer co-authorization) |
| Engineering Lead | NO | YES (single authorization sufficient) |
| Product Owner | NO | NO (can REQUEST rollback but cannot authorize) |

**Emergency Override:** In case of confirmed security breach or data corruption, ANY Operations Engineer can initiate immediate full rollback without waiting for co-authorization. Post-facto documentation required within 1 hour.

---

## SECTION 2: ROLLBACK TYPES

Three categories of rollback exist, each applicable to different failure modes.

### Type A: Full Rollback (Complete Version Revert)

**Definition:** Revert ALL application nodes to the immediately preceding artifact version. Database schema, configuration, and infrastructure remain unchanged — only the application code version changes.

**When Used:** Application-level bug, performance regression, feature malfunction, incorrect business logic in new code.

**Scope:** Entire cluster — all application nodes revert simultaneously (rolling restart pattern).

**Assumption:** The preceding artifact version is still available in the deployment registry (per DEP-SPEC-001 §5 rollback retention: minimum 30 days).

### Type B: Partial Rollback (Individual Service/Component Revert)

**Definition:** Revert a subset of application nodes or a specific Application Service while keeping other nodes/services on the new version. Used when the issue affects only a narrow slice of functionality.

**When Used:** A bug isolated to a single Application Service (e.g., WorkflowService approval flow broken but ResourceService transactions work correctly), or a specific adapter binding causing issues (e.g., email notification adapter misbehaving).

**Scope:** Selective — only affected nodes or service configurations changed.

**Implementation:** Achieved through routing rules at the load balancer level (route traffic for specific paths or orgs to nodes running previous version) or by selectively restarting only affected node instances.

**Risk:** Partial rollback creates a mixed-version cluster. This is inherently risky because:
- Event ordering (CRT-004 guarantees sequential dispatch per DOC-014) may behave differently across version boundaries
- Schema state must be compatible with BOTH versions being deployed
- Idempotency keys (CRT-013) cached in one version may not match behavior of another version

Partial rollback should be a TEMPORARY measure (maximum 4 hours) while a targeted fix is developed. It is NOT a long-term strategy.

### Type C: Data Rollback (Migration-Specific Undo)

**Definition:** Reverse a database schema change that was applied during the deployment. This type of rollback modifies DATA, not CODE. It is ONLY applicable when the deployment included Migration Pack migrations.

**When Used:** A schema migration introduces a bug (wrong column type, missing constraint, incorrect FK ON DELETE behavior) that requires reverting the DDL changes.

**Scope:** Database only — application code stays on the new version; database schema reverts to pre-migration state.

**Constraint:** Data rollback is HIGH-RISK because it may destroy data that was written against the new schema. It MUST only be used when no compatible workaround exists.

**Prevention Priority:** Design migrations to be forward-compatible (new code can read old schema, old code can write new schema) to avoid needing data rollbacks entirely.

---

## SECTION 3: ROLLBACK PROCEDURE

### 3.1 Full Rollback Procedure (Type A)

**Step 1: Initiate Rollback (T+0)**
- Operations Engineer confirms rollback trigger (automatic threshold exceeded OR manual authorization received)
- Rollback target identified: the artifact version immediately PRECEDING the failed deployment
- Documentation started: rollback incident record with timestamp, reason, target version

**Step 2: Pause New Deployments (T+0 to T+1 min)**
- All pending deployments to the affected environment are PAUSED
- No new artifacts are released to this environment until rollback completes
- This prevents cascade failures from simultaneous deployments

**Step 3: Graceful Node Replacement (T+1 min to T+N min)**

For a cluster with N application nodes, perform rolling replacement:

```
For each node i in [1, 2, ..., N]:
  1. Remove node i from load balancer pool
  2. Signal node i to begin shutdown (OS signal / orchestrator command)
  3. Wait for graceful drain period (default 30 seconds, per OR-012)
  4. Terminate node i completely
  5. Start new instance with ROLLBACK artifact version
  6. Wait for Phase 100-106 initialization to complete
  7. Run health check on restarted node (CRT-007 Phase 105 equivalent)
  8. If health check PASSES → add node to load balancer pool, continue to next node
  9. If health check FAILS → abort rollback, alert Operations Engineer, manual intervention required
```

**Complexity:** Each node takes approximately 1-2 minutes for full restart and health verification. For N=3 nodes, total rollback time ≈ 3-6 minutes. For N=50 nodes, total rollback time ≈ 50-100 minutes (proceed node-by-node maintaining minimum cluster size).

**Step 4: Post-Rollback Verification (T+N min to T+N+5 min)**

After all nodes have been rolled back:
1. Execute full health check suite (all 10 port-level health checks via CRT-007)
2. Run smoke tests: one representative operation per Application Service
3. Confirm error rate has returned to pre-deployment baseline
4. Confirm P99 latency has returned to pre-deployment baseline
5. Verify previous artifact is still accessible in registry (it was just deployed, so it is)
6. Write final audit entry: `{ action: "FullRollbackCompleted", artifact_from: <old>, artifact_to: <current_rollback_target>, duration_ms: <total> }`

**Step 5: Incident Documentation (T+N+5 min to T+N+60 min)**
- Complete rollback incident record with timeline, root cause analysis (if known), and remediation plan
- Notify stakeholders of successful rollback
- Schedule post-incident review within 48 hours

### 3.2 Partial Rollback Procedure (Type B)

**Step 1: Identify Affected Scope**
- Determine which Application Service(s) or node subset is affected
- Isolate the issue to confirm partial rollback is appropriate (vs full rollback)

**Step 2: Configure Routing Rules**
- At load balancer level: create routing rule directing traffic for affected paths/orgs to rollback nodes
- Example: `POST /transactions/*` and `POST /workflows/*` routes to nodes running previous version
- Example: All traffic from `org_id = "org-bug-affected"` routes to rollback nodes

**Step 3: Rollback Subset of Nodes**
- Select minimum number of nodes needed to handle the isolated traffic slice
- Perform rolling restart on selected nodes with previous artifact version
- Keep unaffected nodes on current (potentially buggy) version — they continue serving traffic for non-affected services

**Step 4: Verify Isolation**
- Confirm affected services now route to rollback nodes
- Confirm unaffected services continue operating on current version
- Monitor for cross-version incompatibility issues (event ordering, schema compatibility)

**Step 5: Develop and Deploy Fix**
- Fix the specific issue affecting the partial rollback scope
- Deploy fixed artifact to replace rollback nodes
- Re-integrate into full cluster once verified

### 3.3 Data Rollback Procedure (Type C)

**Step 1: Assess Impact**
- Identify exactly which migration(s) caused the problem
- Determine what data may have been written using the new (buggy) schema
- Determine whether rollback preserves all essential data

**Step 2: Prepare Migration Rollback Script**
- Reference Migration Pack ROLLBACK sections for the affected migrations
- Validate rollback script against a staging copy of Production data BEFORE executing in Production
- Ensure rollback is idempotent (IF NOT EXISTS patterns)

**Step 3: Execute During Low-Traffic Window**
- Schedule rollback during low-traffic period
- Optionally pause offline sync operations temporarily to prevent writes during schema change
- Execute rollback migrations in REVERSE ORDER (MIG-035 → MIG-034 → ... → MIG-001 as applicable)

**Step 4: Verify Schema State**
- Run PersistenceVerificationPort checks (Phase 102 equivalent)
- Confirm 32 tables match expected pre-migration state
- Verify referential integrity preserved

**Step 5: Resume Operations**
- Resume offline sync if paused
- Continue application on current version (schema-compatible by design)
- Document lessons learned to prevent repeat schema issues

---

## SECTION 4: ROLLBACK SAFETY

### 4.1 Data Integrity Guarantees

Rollback operations MUST preserve data integrity. The following guarantees apply:

**Guarantee R-001: No Data Loss During Full Rollback (Type A)**
Full rollback changes APPLICATION CODE ONLY. It does NOT modify any data in the database, file storage, cache, or message bus. All data persisted during the failed deployment session remains intact and accessible from the rolled-back version.

**Guarantee R-002: Schema Backward Compatibility**
All Migration Pack migrations MUST be forward-compatible: the new application code can read data written by the old schema, and (ideally) the old application code can read data written by the new schema. This ensures that even if schema is updated before rollback is decided, the old application version can still function correctly.

**Guarantee R-003: Event Replay Safety**
Events published during the failed deployment session that were placed in the Dead-Letter Queue (per OR-004) remain in the DLQ after rollback. When the rolled-back version starts, it can process DLQ events (assuming event handler behavior is backward-compatible). If event handler code changed between versions, DLQ events from the newer version's event format may not be processable by the older version — these events are archived and handled manually.

**Guarantee R-004: Idempotency Key Retention**
Idempotency keys (CRT-013) accumulated during the failed deployment remain valid for their configured TTL window (default 5 minutes). After rollback, requests retried with these keys receive the response that was cached from the failed deployment execution — which is correct behavior since the original request was successfully processed.

### 4.2 Safe Rollback Preconditions

A rollback SHOULD NOT be initiated unless:
1. The target artifact version is confirmed available in the deployment registry
2. The previous Migration Pack (or same Migration Pack, if no schema change) is verified compatible
3. At least one healthy database connection exists
4. The secrets vault is accessible (for ConfigurationLoader Phase 101)

If any precondition fails, rollback cannot proceed automatically. Manual intervention required.

### 4.3 Unsafe Conditions (Rollback Blocked)

The following conditions PREVENT safe rollback and require investigation before rollback can proceed:

| Condition | Why It Blocks Rollback | Resolution |
|-----------|----------------------|------------|
| Previous artifact deleted from registry | Cannot deploy version to revert to | Restore from archive or rebuild artifact |
| Database inaccessible | Runtime cannot initialize (Phase 102 fails) | Restore database connectivity |
| Secrets vault completely unavailable | Phase 101 exits immediately | Restore vault or use backup credentials |
| Schema version mismatch causing data loss risk | Rolling back could make existing data unreadable | Evaluate data loss risk manually; may require data migration before rollback |
| Active migration in progress | Mid-migration state is ambiguous | Wait for migration to complete or fail safely |

---

## SECTION 5: MIGRATION ROLLBACK

### 5.1 Migration Pack Rollback Principles

The Migration Pack (35 sequential migrations, MIG-001 through MIG-035) is designed for forward-only execution. However, rollback capability is provided for emergency situations where a migration introduced a breaking change.

**Key Principle:** Migration rollback reverts the DATABASE SCHEMA only. It does NOT revert application code — that is handled by Full Rollback (Type A). Migration rollback is used when the application code depends on a specific schema state that was disrupted by a bad migration.

### 5.2 Per-Migration Rollback Capability

Each migration in the Migration Pack includes a documented ROLLBACK section that describes the inverse operations. The rollback sections are:
- **Commented-out** in the Migration Pack (safe default: rollback is visible but not executed automatically)
- **Executable** when manually invoked (DBA or migration operator runs rollback scripts explicitly)
- **Idempotent**: use IF EXISTS / DROP IF EXISTS patterns so rollback can be repeated safely

### 5.3 Migration Rollback Order

When rolling back multiple migrations, execute ROLLBACKS IN REVERSE TOPOLOGICAL ORDER:

```
MIG-035 rollback → MIG-034 rollback → ... → MIG-001 rollback
```

This reverses the topological creation order and ensures that tables referenced by FK constraints are not dropped before their referencing tables.

**Exception:** If only ONE migration needs rollback, execute only that migration's ROLLBACK section. Do not cascade rollbacks to earlier migrations unless specifically required.

### 5.4 Migration Rollback Risk Assessment

Before executing any migration rollback, assess:

| Risk Factor | Assessment Question | Mitigation |
|------------|---------------------|------------|
| Data Destruction | Does the rollback drop columns, tables, or constraints that contain application data? | If yes: export affected data BEFORE rollback; reimport after rollback completes |
| Constraint Removal | Does the rollback remove UNIQUE, CHECK, or FK constraints? | Document which data integrity guarantees are temporarily disabled |
| Index Drop | Does the rollback drop indexes that affect query performance? | Accept performance degradation during rollback window; indexes are performance aids not correctness requirements |
| Sequence Reset | Does the rollback reset sequences that may conflict with existing data? | Verify no existing row references the reset sequence value |
| RLS Policy Removal | Does the rollback remove RLS policies, creating a temporary security gap? | Keep application code deployed but monitor access patterns; restore policies ASAP |

### 5.5 Migration Rollback Procedure

1. **Freeze writes** to affected database (optional: pause all Application Services via Operations interface)
2. **Export** any data that will be destroyed by rollback (tables, columns, or constraints being removed)
3. **Execute** rollback scripts in reverse topological order
4. **Verify** schema state matches expected pre-migration condition (run PersistenceVerificationPort checks)
5. **Re-import** exported data if any was temporarily saved
6. **Unfreeze writes** (resume Application Services)
7. **Monitor** for data integrity issues in the post-rollout period
8. **Document** the rollback in the incident record

### 5.6 Migration Rollback Prevention

To minimize the need for migration rollbacks:
- All migrations tested against staging copy of Production data BEFORE Production deployment
- Migration Pack reviewed by at least 2 engineers before inclusion in release
- Schema changes prioritized to be ADDITIVE (new tables, new columns, new constraints) rather than DESTRUCTIVE (drop columns, change types, remove constraints)
- Destructive changes scheduled during maintenance windows with explicit rollback plans

---

## SECTION 6: ROLLBACK TESTING

### 6.1 Test Philosophy

Rollback procedures are themselves artifacts that MUST be tested regularly. An untested rollback procedure is NOT a reliable rollback procedure.

**Testing Frequency:**
- Full rollback test: Quarterly (as part of DR failover drill)
- Partial rollback test: Bi-monthly
- Migration rollback test: Per significant schema change

### 6.2 Full Rollback Test Procedure

1. Deploy artifact version X.Y.Z to Staging environment
2. Intentionally introduce a defect that triggers an automatic rollback condition (e.g., configure error rate threshold very low so normal traffic triggers it)
3. Verify that the health dashboard detects the threshold violation
4. Verify that auto-rollback initiates within the defined time window (auto-rollback triggered upon error rate > threshold sustained for > 2 minutes)
5. Verify all nodes are reverted to previous artifact version
6. Verify health checks pass on rolled-back cluster
7. Verify data integrity preserved (no data loss, no schema corruption)
8. Record observed rollback duration and compare against expected (should be within 2x estimated time)

### 6.3 Migration Rollback Test Procedure

1. Apply N migrations to a fresh Staging database
2. Intentionally break the Nth migration (introduce a deliberate error in the migration script)
3. Attempt rollback of migration N
4. Verify migration N rollback completes cleanly
5. Verify remaining Migrations 1 through N-1 are still functional (their data structures intact)
6. Re-apply migration N with corrected script
7. Verify end-to-end: all N migrations apply cleanly after rollback-and-reapply cycle

### 6.4 Rollback Readiness Checklist

Before any Production deployment, verify rollback readiness:

| Check | Verified By |
|-------|------------|
| Previous artifact available in deployment registry | DevOps Engineer |
| Previous artifact passes health checks when deployed in isolation | QA Engineer |
| Rollback procedure documented and accessible | Operations Engineer |
| Migration rollback scripts validated against staging data | Database Administrator |
| Data export capability confirmed for destructive migrations | Engineering Lead |
| Rollback triggers documented with correct thresholds | Operations Lead |
| On-call rotation covers rollback window | Engineering Manager |
| Stakeholder notification list updated | Release Coordinator |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | deployment-specifier v1.0 | Creation — Rollback Strategy for Lumina v1: decision criteria (auto/manual triggers), three rollback types (full/partial/data), detailed procedures, safety guarantees, migration rollback protocol, testing program | COMPLIANT (verified against RTS-001 lifecycle, RTS-002 Phase 108 shutdown, RTS-003 OR-011/OR-012 determinism, TRR-V1.2 migration pack assessment, INV-004 multi-tenant data integrity) |

---

*Ce document definit la strategie de retour arriere pour Lumina. Il ne specifie aucun outil de deploiement concret (pas de scripts Kubernetes rollback, pas de commandes Helm undo). Les details d'implementation sont determines par les outils d'infrastructure selects independamment.*
