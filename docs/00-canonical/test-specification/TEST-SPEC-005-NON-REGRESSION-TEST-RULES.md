# Non-Regression Test Rules — Lumina v1
**Doc ID:** TEST-SPEC-005
**Version:** v1.0
**Statut:** SPECIFICATION DE TESTS DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-015", "DOC-014", "API-CONTRACT-001", "API-CONTRACT-005", "MIGRATION-PACK-V1.md", "RLS-POLICY-SPECIFICATION-V1.md"]
**Transformation_rule :** "test-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the rules for non-regression testing across the Lumina application. Non-regression tests detect and prevent unintended changes to existing behavior when new code is introduced. They are the safety net that allows the team to evolve the system confidently without breaking what already works.

Non-regression tests focus on five areas: invariant stability, API contract stability, migration idempotency, RLS policy correctness, and sync behavior continuity. Every decision traces to DOC-015 (invariants), API-CONTRACT-001 through 006 (contracts), MIGRATION-PACK-V1.md (35 migrations), and RLS-POLICY-SPECIFICATION-V1.md (32 tables).

---

## SECTION 1: PURPOSE

Non-regression tests serve three purposes:

1. **Detect unintended behavior changes** — When a code change modifies an invariant check, error code, or state transition that was not the intended target of the change, the regression test fails immediately.

2. **Prevent backward compatibility breaks** — API contracts (request/response schemas) must remain stable. Non-regression tests verify that existing consumers will continue to receive expected responses.

3. **Verify infrastructure stability** — Migrations, RLS policies, and sync protocols must behave consistently across deployments. Non-regression tests confirm these systems work correctly after schema changes.

---

## SECTION 2: REGRESSION TEST CATALOG

This section lists every scenario where regression detection is required. The catalog is exhaustive — if a scenario is not listed here, it does not require a dedicated non-regression test (though it may be covered by unit or integration tests).

### 2.1 Invariant Stability Tests

All 58 invariants from DOC-015 MUST have regression tests that verify the invariant guard continues to function correctly after any code change.

| Invariant | Regression Scenario | Expected Behavior |
|-----------|-------------------|------------------|
| FIN-001 | Approved transaction update attempt post-change | E-422-001-FIN-001 returned; transaction unchanged |
| FIN-002 | Negative/zero amount transaction post-change | E-422-001-FIN-002 returned; transaction not created |
| DATE-001 | Future date transaction post-change | E-422-001-DATE-001 returned |
| CAT-001 | Transaction with nonexistent category post-change | E-422-001-CAT-001 returned |
| VERSION-001 | Mutation without version increment post-change | Version auto-incremented; E-422-001-VERSION-001 if manual override attempted |
| EMAIL-001 | Duplicate email within org post-change | E-422-001-EMAIL-001 returned |
| REL-001 | DAG cycle creation post-change | E-422-001-REL-001 returned; Kahn's algo still detects cycle |
| WF-001 | Step timeout beyond 30 days post-change | E-422-001-WF-001 returned |
| RETRY-004 | Auto-retry of failed workflow post-change | E-422-001-RETRY-004 blocked; only manual resubmit allowed |
| AUD-001 | Attempted UPDATE or DELETE on audit log post-change | E-422-001-AUD-001 returned; entry unchanged |
| VOC-001 | Attempted delete of vocabulary value post-change | E-422-001-VOC-001 returned; deprecation only path enforced |
| LIF-003 | Restore of purged entry post-change | E-409-006 ALREADY_PURGED returned |
| CFG-001 | Invalid currency format post-change | E-422-001-CFG-001 returned |
| SYNC-001 | Remote write without local write post-change | E-422-001-SYNC-001 returned |
| NOT-001 | Notification without trigger source post-change | E-422-001-NOT-001 returned |

Note: All 58 invariants require regression coverage. The table above shows representative examples. Full coverage matrix is maintained in the test traceability document (TEST-SPEC-008).

**Minimum count:** 58 invariant regression tests (one per invariant, verifying the happy path still succeeds after any change).

### 2.2 API Contract Stability Tests

Every API operation documented in API-CONTRACT-001 MUST have a regression test verifying the response structure remains stable.

| Operation Category | Regression Check | Expected Behavior |
|-------------------|-----------------|------------------|
| Create operations (POST-like) | Response contains no unexpected fields | Response matches schema from API-CONTRACT-002 |
| Read operations (GET-like) | Response shape consistent with previous version | Same fields, same types, same nullability |
| Error responses | Error codes map consistently to API-CONTRACT-005 taxonomy | Error structure matches E-XXX-NNN format |
| Pagination | Page-based and cursor-based pagination return consistent structure | total_count, page, items present in every paginated response |
| Bulk operations | Batch response includes per-item results | success/failure status per item + individual errors |

Contract regression checks apply to all 5 protocol adapters:
- REST: JSON body structure, HTTP status codes
- GraphQL: Schema definitions, query/mutation return types
- gRPC: Proto message definitions, status codes
- CLI: Command argument parsing, exit codes, output format
- Webhook: Payload structure, retry headers, signature verification

**Minimum count:** 83 operations x 2 scenarios (success response shape + error response shape) = **166 contract regression tests minimum**.

### 2.3 Migration Idempotency Tests

All 35 migrations from MIGRATION-PACK-V1.md MUST pass idempotency regression tests.

| Migration | Regression Check | Expected Behavior |
|-----------|-----------------|------------------|
| All DDL migrations | Re-run migration on already-migrated database | No errors; tables/columns/constraints unchanged |
| Bootstrap scripts (000-003) | Re-run bootstrap on bootstrapped database | Same state; no duplicate data created |
| Data migrations | Re-run data population step | Existing rows unaffected; new rows not duplicated |
| RLS policy migrations | Re-apply RLS policies | Policies replaced with current definition; no orphaned policies |
| Index migrations | Re-create existing index | Index dropped and recreated; query plans verified |

Idempotency verification steps:
1. Apply migration to clean database
2. Apply migration AGAIN to the now-migrated database
3. Verify: no errors, no data duplication, no schema drift
4. Run full integration test suite post-idempotency check — all tests must still pass

### 2.4 RLS Policy Verification Tests

All 32 tables with 9 roles = **288 policy permutations** require regression tests.

| Table + Role Combination | Regression Check | Expected Behavior |
|-------------------------|-----------------|------------------|
| resource_records + lumina_admin | SELECT filtered by org_id | Returns only rows with matching _org_id |
| resource_records + lumina_treasurer | SELECT filtered by org_id | Returns only rows with matching _org_id |
| resource_records + lumina_staff | SELECT filtered by org_id | Returns only rows with matching _org_id |
| audit_logs + lumina_staff | SELECT (denied by ACCESS-033) | E-403-001 INSUFFICIENT_PERMISSION |
| sessions + lumina_superadmin | All permissions (bypass configured at session level) | Works as designed; audit log confirms bypass usage |

Every RLS policy from RLS-POLICY-SPECIFICATION-V1.md Section 3.x must be tested:
- INSERT permission verified per role per table
- UPDATE permission verified per role per table
- DELETE permission verified per role per table
- SELECT permission verified per role per table
- Multi-tenant isolation: org_A user cannot SELECT org_B's rows on ANY table

**Minimum count:** 288 policy permutations x 2 scenarios (allowed + denied) = **576 RLS regression tests minimum**.

### 2.5 Sync Behavior Continuity Tests

Offline sync behavior must remain consistent after schema or configuration changes.

| Sync Aspect | Regression Check | Expected Behavior |
|------------|-----------------|------------------|
| Push batch size | MAX_BATCH_SIZE unchanged or consciously migrated | Batches of 50 ops accepted; batches of 51 rejected |
| Retry strategy | Exponential backoff formula unchanged | Delay sequence: 1s, 2s, 4s, 8s, 16s (max 5 attempts) |
| Conflict strategies | Per-entity-type strategies unchanged | LWW for members/events, immutable for approved tx, uuid-dedup for drafts |
| Local-first ordering | Local write always precedes remote push order | PUSH sequence: local_create → remote_push → remote_confirm |
| Sync status transitions | pending → sent → confirmed flow unchanged | Status machine follows defined transitions |
| Pull delta since timestamp | Delta includes only changes since last_sync_timestamp | No missing updates; no stale data included |

---

## SECTION 3: SNAPSHOT TESTING

Snapshot testing captures the complete state of an operation's output and compares it against a stored baseline on subsequent runs. It is a powerful regression detection mechanism but must be used selectively.

### 3.1 When to Use Snapshots

Snapshots are appropriate for:
- **Report generation output** — UC-RPT-01 GenerateReport produces deterministic output for fixed input. Snapshot captures the report JSON structure.
- **Form render tree output** — UC-FRM-Q02 RenderForm produces a JSON render tree. Snapshot captures the structure.
- **API response shapes** — Success responses from well-understood operations. Snapshot captures the field names, types, and nullability.
- **Error response structures** — Error responses for known error codes. Snapshot captures error code format, message structure, and metadata fields.
- **Export formats** — CSV, JSON, PDF content for fixed test data. Snapshot captures byte-exact or structurally comparable output.

### 3.2 When NOT to Use Snapshots

Snapshots are NOT appropriate for:
- Data containing timestamps or dates (values change every run)
- Data containing generated UUIDs (values change every run)
- Data containing system-derived values like counts, totals, or aggregated numbers (change with data)
- Binary data like digital signatures or cryptographic hashes
- Response bodies containing user-generated content (varies between test environments)

### 3.3 Snapshot Storage

When snapshots are used:
- Stored alongside the test definition in a `snapshots/` directory under the test specification folder
- Named following convention: `{operation_name}_{scenario}_snapshot.{format}`
- Version-controlled in the repository
- Reviewed during code review when the snapshot changes (snapshot change indicates behavior change — intentional or not)

### 3.4 Snapshot Update Process

When a behavior change legitimately requires a snapshot update:
1. The developer updating the code MUST also update the snapshot
2. The PR reviewer verifies the snapshot change matches the intended behavior change
3. The snapshot diff is reviewed as carefully as any code diff
4. Automated snapshot drift detection: CI pipeline fails if a test generates different output than its stored snapshot AND the developer has not updated it

---

## SECTION 4: DEPRECATED FEATURES COMPATIBILITY TESTS

Features that have been deprecated (not removed) MUST continue functioning correctly. Regression tests ensure deprecated paths do not break.

### 4.1 Deprecated Feature Catalog

| Feature | Deprecation Reason | Continued Behavior Required |
|---------|-------------------|---------------------------|
| Legacy category reference format | Migrated to vocabulary terms | Old format still resolves to correct category |
| Pre-manifest lifecycle states | States now configurable via manifest | Hardcoded legacy states still transition correctly |
| Simple (non-hierarchical) org units | Replaced by OrgUnit DAG model | Flat org structures still accepted and migrated |
| Single-channel notifications | Multi-channel support added | Email-only notification path still functional |

### 4.2 Compatibility Verification

For each deprecated feature:
- The deprecated code path MUST exist and be reachable
- The deprecated path MUST produce the same observable outcome as the new path
- Warning logs MAY be emitted (visible in audit trail)
- The deprecated path MUST continue passing all regression tests

### 4.3 Sunset Timeline

Deprecated features are documented with a sunset timeline:
- Year 1: Deprecated, fully functional, warning logged
- Year 2: Deprecated, functional, warning logged prominently, migration guide available
- Year 3: Deprecated, functional, migration deadline communicated
- Year 4: Code path removed (breaking change requires new major version)

Tests MUST cover the deprecated path through each phase. Removing a deprecated feature requires a version bump and corresponding contract regression test update.

---

## SECTION 5: AUTOMATED DETECTION IN CI PIPELINE

### 5.1 Integration with CI

Non-regression tests execute as part of the standard CI pipeline (TEST-SPEC-001 Section 5):

```
Commit → Unit Tests → Integration Tests → Contract Tests → NON-REGRESSION CHECKS
```

Non-regression checks run after Contract Tests (Stage 3) because they depend on the same API boundary stability that contract tests validate.

### 5.2 Automated Detection Categories

| Detection Method | What It Checks | Trigger |
|-----------------|---------------|---------|
| Invariant guard diff analysis | Any change to invariant check code | Changed files contain domain layer modifications |
| API response schema comparison | Response shape changed between runs | Contract test assertions differ |
| Migration re-apply | Migration re-runs on live database | Migration file modified |
| RLS policy drift | Current policies differ from RLS spec | RLS spec changed or policies regenerated |
| Sync protocol regression | Sync behavior changed for known scenarios | OfflineSyncAggregate modified |

### 5.3 Change Detection Triggers

Non-regression tests can be optimized to run only when relevant:
- Domain model changes → run ALL invariant regression tests (58 tests)
- API contract changes → run ALL contract regression tests (166 tests)
- Migration changes → run migration idempotency tests (35 tests)
- RLS spec changes → run RLS policy tests (288 tests)
- Sync aggregate changes → run sync regression tests (6 tests)
- No changes to any of the above → skip non-regression tests (they were last validated successfully)

This optimization reduces CI time while maintaining safety: if no related code changed, no regression is possible.

---

## SECTION 6: SEVERITY CLASSIFICATION

Regressions are classified by severity. This classification determines response urgency and fix priority.

### 6.1 Severity Scale

| Level | Name | Criteria | Response Time |
|-------|------|----------|--------------|
| **P0** | CRITICAL | Data loss, security breach, complete system outage, invariant violation allowing harmful state | Immediate (within 1 hour) |
| **P1** | MAJOR | Core business flow broken, incorrect financial calculation, authentication bypass, RLS isolation failure | Within 4 hours |
| **P2** | MINOR | Non-critical feature broken, incorrect error code returned, degraded performance (>10% but within budget) | Within 24 hours |
| **P3** | LOW | Documentation mismatch, deprecated feature path broken, cosmetic response format change | Next sprint |
| **P4** | INFO | Minor behavior difference not affecting functionality, test flakiness identified | Backlog |

### 6.2 Severity Assignment Examples

| Regression Scenario | Severity | Rationale |
|--------------------|----------|-----------|
| Approved transaction is modifiable (FIN-001 bypassed) | P0 | Financial data integrity compromised |
| Email uniqueness check fails (EMAIL-001 broken) | P1 | Data corruption risk; duplicate users |
| Report balance unbalanced (BAL-001 assertion removed) | P1 | Financial reporting accuracy compromised |
| Org isolation filter removed (INV-004 broken) | P0 | Multi-tenant security breach |
| Audit log deletion permitted (AUD-001 bypassed) | P0 | Compliance violation; evidence tampering |
| Error code E-422-001 changed to generic E-500-001 | P3 | Error taxonomy regression; debugging impact |
| API response adds optional field | P4 | Backward compatible change (adding optional fields) |
| API response removes existing field | P2 | Breaking change for existing consumers |
| Migration re-apply drops existing index | P1 | Performance degradation; potentially data loss |
| RLS policy allows cross-org read | P0 | Multi-tenant security breach |
| Sync pushes remote before local (SYNC-001 inverted) | P1 | Data consistency risk; potential conflict |
| Rate limit threshold changed by 10% | P3 | Behavioral drift; monitoring alert needed |

---

## SECTION 7: REGRESSION TEST METRICS

### 7.1 Key Metrics

| Metric | Target | Measurement Frequency |
|--------|--------|---------------------|
| Zero P0 regressions | 0 | Continuous |
| Zero P1 regressions | 0 | Continuous |
| P2 regressions per quarter | < 5 | Quarterly review |
| Regression detection time | < 1 commit after introduction | CI pipeline trigger |
| Rollback time for P0 | < 2 hours | Incident response SLA |

### 7.2 Regression Trend Analysis

Monthly regression analysis tracks:
- Number of regressions detected per release
- Average time to detection (commit to fix)
- Most frequently regressed invariants (indicates fragile code areas)
- Most frequently regressed API contracts (indicates unstable interfaces)

Trends showing increasing regressions trigger a code review initiative targeting the affected Aggregates.

---

## APPENDIX A: COMPLETE REGRESSION TEST COUNT

| Category | Count |
|----------|-------|
| Invariant stability (58 invariants) | 58 |
| API contract stability (83 ops x 2) | 166 |
| Migration idempotency (35 migrations) | 35 |
| RLS policy verification (32 tables x 9 roles x 2) | 576 |
| Sync behavior continuity (6 aspects) | 6 |
| Deprecated feature compatibility (4 features) | 4 |
| Snapshot testing (reports, forms, exports) | ~20 |
| **TOTAL MINIMUM** | **~865** |

---

## APPENDIX B: DOCUMENT REVISION HISTORY

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v1.0 | 2026-07-25 | Agnes-2.0-Flash (Sapiens AI) | Genesis definition of non-regression test rules |

---

*This non-regression test specification defines mandatory safeguards against unintended behavior changes. Every subsequent release MUST pass the full regression test suite before deployment.*

*FIN DU DOCUMENT TEST-SPEC-005*
