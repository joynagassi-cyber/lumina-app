export const meta = {
  name: 'lumina-schema-migration',
  description: 'Schema-to-migration pipeline: derive migrations, RLS policies, and verification from canonical schema — powered by Ruflo & Superpowers agents',
  phases: [
    { title: 'Schema Audit' },
    { title: 'Migration Generation' },
    { title: 'RLS Policy Generation' },
    { title: 'Verification' },
  ],
}

// ============================================================
// PHASE 1: SCHEMA AUDIT
// ============================================================
phase('Schema Audit')

// Ruflo researcher scans the schema for patterns and dependencies
const schemaAudit = await agent(
`Audit the current PostgreSQL Schema Pack against IGS-v1 compliance.
Use pathfinder research to identify patterns, dependencies, and relationships across all schema artifacts.

Read:
- docs/00-canonical/POSTGRESQL-SCHEMA-PACK-v1.md (32 tables)
- docs/00-canonical/SQL-DDL-SPECIFICATION-v1.md (complete DDL)
- docs/00-canonical/CONSTRAINTS-INDEX-SPECIFICATION-v1.md (constraints + indexes)
- docs/00-canonical/SCHEMA-VERIFICATION-REPORT-v1.md (validation report)
- docs/00-canonical/migration-rls-pack/MIGRATION-PACK-V1.md (migration pack)
- docs/00-canonical/migration-rls-pack/RLS-POLICY-SPECIFICATION-V1.md (RLS policies)

Check:
1. All 32 Physical Objects from DOC-021 have SQL table definitions
2. Every column type matches the DOC-021 category → SQL type mapping
3. All CHECK constraints trace to DOC-015 invariants
4. All FK directions respect NB-RR-005 (child → parent navigation)
5. _org_id (or org_id_ref) present on all tenant-scoped tables
6. Index naming convention idx_{table}_{column} is followed
7. GIN indexes only on jsonb columns (not over-indexed)
8. No index exists that was explicitly excluded in IGS-v1 §5.4

Output:
{
  "tables_count": 32,
  "missing_tables": [],
  "column_types_valid": true,
  "constraint_traces": { "total": N, "untraceable": [] },
  "fk_direction_ok": true,
  "org_id_present": true,
  "index_naming_ok": true,
  "gin_indexes_valid": true,
  "excluded_indexes_present": [],
  "schema_compliant": true/false
}`,
{ label: 'Schema audit', phase: 'Schema Audit', subagent_type: 'ruflo-core:researcher', schema: {
  type: 'object',
  properties: {
    tables_count: { type: 'number' },
    missing_tables: { type: 'array', items: { type: 'string' } },
    column_types_valid: { type: 'boolean' },
    constraint_traces: { type: 'object', properties: { total: { type: 'number' }, untraceable: { type: 'array', items: { type: 'string' } } } },
    fk_direction_ok: { type: 'boolean' },
    org_id_present: { type: 'boolean' },
    index_naming_ok: { type: 'boolean' },
    gin_indexes_valid: { type: 'boolean' },
    excluded_indexes_present: { type: 'array', items: { type: 'string' } },
    schema_compliant: { type: 'boolean' }
  }
}})

log(`Schema compliant: ${schemaAudit?.schema_compliant ?? '?'}`)

// ============================================================
// PHASE 2: MIGRATION GENERATION
// ============================================================
phase('Migration Generation')

// Ruflo migrations specialist generates and validates migration artifacts
await agent(
`Generate or validate the migration pack following strict Ruflo migration conventions.

Rules for migration generation:
1. Tables with no FK dependencies must come first (organizations, vocab_namespaces)
2. Child tables always after parent tables in the MIG-NNN sequence
3. No circular dependencies between migrations
4. Each migration has exactly one CREATE TABLE (no batch creates)
5. Each migration has a ROLLBACK section
6. Idempotent patterns used where applicable (IF NOT EXISTS)
7. Indexes created in separate migrations from table creation
8. Triggers created after all tables are defined

Ensure all migrations follow ruflo-migrations:migrate-create standards.
`,
{ label: 'Migration generation', phase: 'Migration Generation', subagent_type: 'ruflo-migrations:migrate-create' })

await agent(
`Validate the migration pack against topological ordering rules.
Apply ruflo-migrations:migrate-validate discipline: check every migration individually,
then check the chain as a whole.

Verify:
1. Migration order follows topological sort of FK dependencies
2. Each migration is self-contained (no dependency on state from other migrations)
3. Rollback SQL provided for every forward migration
4. Idempotent patterns used (IF NOT EXISTS, DO NOTHING where safe)
5. No DDL in transaction that could leave partial state
6. Comments include IGS-v1 metadata header
7. No business logic injected into migration SQL
8. ALTER TABLE never modifies a table created by an earlier migration (CREATE ONLY)
9. Triggers defined AFTER all referenced tables exist
10. Index definitions separate from table creation (or immediately after in same migration)

Report any violations found.
`,
{ label: 'Migration validation', phase: 'Migration Generation', subagent_type: 'ruflo-migrations:migrate-validate' })

// ============================================================
// PHASE 3: RLS POLICY GENERATION
// ============================================================
phase('RLS Policy Generation')

// Security auditor reviews RLS policies for vulnerabilities
await agent(
`Security-audit all RLS policies against known vulnerability patterns.
Focus on org_id filter bypasses, cross-tenant access, and superadmin configuration.

Read:
- docs/00-canonical/migration-rls-pack/RLS-POLICY-SPECIFICATION-V1.md
- docs/00-canonical/POSTGRESQL-SCHEMA-PACK-v1.md
- docs/00-canonical/DOC-023-CANONICAL-RELATIONAL-RULES.md §8

Check:
1. Every table (except organizations) has policies for all active roles
2. All USING clauses use: org_id = current_setting('request.org_id')::uuid
3. All WITH CHECK clauses use the same org_id pattern
4. Audit entries have FORCE ROW LEVEL SECURITY
5. Superadmin bypass is documented but not implemented as an RLS policy
6. Policy names follow convention: pol_{table}_{action}_{role}
7. No policies grant cross-org access
8. Migration role has no RLS policies (only schema USAGE)

Identify any security risks in the policy specification.
`,
{ label: 'RLS security audit', phase: 'RLS Policy Generation', subagent_type: 'ruflo-security-audit:security-auditor' })

// ============================================================
// PHASE 4: VERIFICATION
// ============================================================
phase('Verification')

const verification = await agent(
`Run final end-to-end verification of the schema-migration-RLS pipeline.
This is the IGS-v1 §8 validation chain applied to the full stack:

1. V-STRUCT: All files parse as valid SQL/Markdown?
2. V-COHERE: Migrations order matches FK DAG?
3. V-TRACE: Every SQL artifact traces to DOC-021 or DOC-015?
4. V-NB: No business logic in migrations or RLS policies?
5. V-REGRESS: No changes to existing canonical documents?
6. V-INVENT: No new tables/columns beyond what DOC-021 defines?

Output:
{
  "v_struct": "PASS|FAIL",
  "v_co_here": "PASS|FAIL",
  "v_trace": "PASS|FAIL",
  "v_nb": "PASS|FAIL",
  "v_regress": "PASS|FAIL",
  "v_invent": "PASS|FAIL",
  "pipeline_status": "READY|BLOCKED"
}`,
{ label: 'Final verification', phase: 'Verification', subagent_type: 'ruflo-core:reviewer', schema: {
  type: 'object',
  properties: {
    v_struct: { type: 'string', enum: ['PASS','FAIL'] },
    v_co_here: { type: 'string', enum: ['PASS','FAIL'] },
    v_trace: { type: 'string', enum: ['PASS','FAIL'] },
    v_nb: { type: 'string', enum: ['PASS','FAIL'] },
    v_regress: { type: 'string', enum: ['PASS','FAIL'] },
    v_invent: { type: 'string', enum: ['PASS','FAIL'] },
    pipeline_status: { type: 'string', enum: ['READY','BLOCKED'] }
  }
}})

log(`Pipeline status: ${verification?.pipeline_status ?? 'pending'}`)

// Final Superpower verification gate
await agent(
`FINAL GATE for schema-migration pipeline. Verify before completion:
- Schema audit found zero blocking issues (or they are documented)
- All migrations are topologically ordered with rollbacks
- RLS policies cover all 32 tables × 9 roles
- No security vulnerabilities detected in RLS
- V-STRUCT through V-INVENT all pass

If any checkpoint fails, declare pipeline BLOCKED and list remediation steps.
// SKILL: superpowers:verification-before-completion
`,
{ label: 'Pipeline verification gate', phase: 'Verification', subagent_type: 'superpowers:verification-before-completion' })
