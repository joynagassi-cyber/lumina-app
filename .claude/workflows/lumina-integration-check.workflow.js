export const meta = {
  name: 'lumina-integration-check',
  description: 'End-to-end integration check across frontend, backend, database layers — powered by Ruflo & Superpowers agents',
  phases: [
    { title: 'Layer Integration' },
    { title: 'API Contract Validation' },
    { title: 'Offline Sync Check' },
    { title: 'Security Review' },
  ],
}

// ============================================================
// PHASE 1: LAYER INTEGRATION
// ============================================================
phase('Layer Integration')

// Knowledge graph navigator traces end-to-end data flows
await agent(
`Check that all layers integrate correctly end-to-end using knowledge graph navigation.
Use graph-navigator to trace data flows through the full stack.

Data flow: Frontend → API → Service → Database → RLS → Frontend

For each hop in the chain:
1. Use kg-traverse to follow the reference from frontend guide → API spec → DB schema
2. Verify Frontend queries match Backend API endpoints (docs/08-backend-guide/)
3. Verify Backend API request/response types match Database schema (POSTGRESQL-SCHEMA-PACK-v1.md)
4. Verify Database queries respect RLS policies (RLS-POLICY-SPECIFICATION-V1.md)
5. Verify RLS org_id filter matches tenant context from API headers (x-org-id)
6. Verify Offline sync data shape matches Database schema (pending_operations table)
7. Verify Vocabulary terms used by frontend forms match database vocab_values

Cross-layer checks via graph traversal:
- If a field is jsonb in DB, the frontend should handle dynamic schemas
- If a field has CHECK constraint, the API should validate before insert
- If a table has _persist_version, the frontend should send it on updates
- If an entity is in AuditAggregate, every CRUD operation logs to audit_entries

Report any broken links in the integration graph.
`,
{ label: 'Layer integration', phase: 'Layer Integration', subagent_type: 'ruflo-knowledge-graph:graph-navigator' })

// ============================================================
// PHASE 2: API CONTRACT VALIDATION
// ============================================================
phase('API Contract Validation')

// DDD validator checks API contracts against domain model boundaries
await agent(
`Validate API contracts against the domain model using DDD validation discipline.

Read:
- docs/05-api-contracts/api-contracts.md
- docs/00-canonical/DOMAIN-COMMAND-EVENT-REGISTRY.md (70 Commands + 60 Events)
- docs/00-canonical/AGGREGATE-BOUNDARY-SPECIFICATION.md (Boundaries: Possède / Protège / Expose / Interdit)

Check using DDD aggregate boundary principles:
1. Every API endpoint maps to exactly one Command from DOC-014
2. No endpoint exposes an "Interdit" boundary from any Aggregate
3. Every endpoint requires x-org-id header
4. Response format includes { data, version, sync_status } per IGS-v1 §3.5
5. Error codes follow standard: 400 validation, 401 auth, 403 permission, 409 conflict, 422 invariant violation
6. POST → Create, PUT → Update, DELETE → Delete, GET → Read mapping followed
7. All query parameters support filtering by org_id

Verify aggregate boundaries are respected as DDD invariants.
Report contract violations with severity level.
`,
{ label: 'API contract validation', phase: 'API Contract Validation', subagent_type: 'ruflo-ddd:ddd-validate' })

// ============================================================
// PHASE 3: OFFLINE SYNC CHECK
// ============================================================
phase('Offline Sync Check')

// Researcher scans offline strategy for patterns and gaps
await agent(
`Validate offline-first sync implementation against spec using pathfinder research methods.

Read:
- docs/02-offline-first/index.md (WatermelonDB strategy)
- docs/00-canonical/DOC-019-PERSISTENCE-STRATEGY-CATALOG.md (offline strategies)
- docs/00-canonical/POSTGRESQL-SCHEMA-PACK-v1.md (pending_operations table)

Research and verify:
1. All tables that need offline support have est_synchronise boolean column
2. pending_operations table tracks all create/update/delete operations
3. Conflict resolution strategies defined per Aggregate type (optimistic lock vs LWW)
4. WatermelonDB schema mirrors PostgreSQL schema for offline tables
5. Sync statuses tracked via sync_statuses table
6. Maximum batch size of 50 per sync cycle (SYNC-002)
7. Exponential backoff retry on failed sync attempts
8. Tombstone pattern implemented for soft deletes

Look for patterns where online-only tables were mistakenly given offline support,
and vice versa. Report findings.
`,
{ label: 'Offline sync check', phase: 'Offline Sync Check', subagent_type: 'ruflo-core:researcher' })

// ============================================================
// PHASE 4: SECURITY REVIEW
// ============================================================
phase('Security Review')

// Security auditor + systematic debugging for deep security analysis
await agent(
`Run a comprehensive security review across all layers.
Systematically debug potential vulnerabilities following a methodical approach.

Check:
1. PASSWORD HANDLING:
   - credentials.hachage_mot_de_passe uses varchar(60) bcrypt format
   - No plaintext passwords anywhere in code or config
   - Password rotation enforced via date_derniere_rotation column

2. RLS SECURITY:
   - All tenant data filtered by org_id at database level
   - Superadmin bypass only via session config, not hardcoded
   - FORCE RLS on audit_entries prevents policy circumvention

3. INPUT VALIDATION:
   - All CHECK constraints provide defense-in-depth
   - Accent hex validated via regex pattern ^#[0-9a-fA-F]{6}$
   - Email uniqueness enforced at DB level (UNIQUE email, org_id)
   - Transaction amounts validated > 0

4. AUDIT TRAIL:
   - All writes logged in audit_entries
   - Immutable log with trigger preventing UPDATE/DELETE
   - Before/after values captured (AUD-002)
   - Minimum 7-year retention (AUD-003)

5. SESSION MANAGEMENT:
   - Sessions expire and are validated
   - Device information tracked (informations_appareil jsonb)
   - Token revocation supported (date_revocation column)
   - Failed login counter and account lockout (credentials table)

6. DATA RETENTION:
   - archives table supports lifecycle states
   - purge_schedules table manages automatic purging
   - LIF-003 ensures purged data cannot be restored

Debug any identified vulnerability: trace it to root cause, identify the fix,
verify the fix would close the security gap.
// SKILL: superpowers:systematic-debugging
`,
{ label: 'Security review', phase: 'Security Review', subagent_type: 'ruflo-security-audit:security-auditor' })
