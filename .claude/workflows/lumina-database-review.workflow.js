export const meta = {
  name: 'lumina-database-review',
  description: 'Database schema, migration, and RLS review with security focus — powered by Ruflo & Superpowers agents',
  phases: [
    { title: 'Schema Review' },
    { title: 'Migration Audit' },
    { title: 'RLS Security Audit' },
    { title: 'Performance Review' },
  ],
}

// ============================================================
// PHASE 1: SCHEMA REVIEW
// ============================================================
phase('Schema Review')

// Core reviewer reviews schema with strict database expertise
await agent(
`Conduct a comprehensive database schema review with database-focused standards.
Review from the perspective of a database specialist ensuring correctness, security, and compliance.

Read:
- docs/00-canonical/POSTGRESQL-SCHEMA-PACK-v1.md
- docs/00-canonical/SQL-DDL-SPECIFICATION-v1.md
- docs/00-canonical/DOC-023-CANONICAL-RELATIONAL-RULES.md

Check:
1. All tables have uuid PK with gen_random_uuid() default
2. Every table has an org_id column (multi-tenant isolation)
3. FK directions follow child→parent navigation (NB-RR-005)
4. ON DELETE CASCADE only for strict composition relationships
5. ON DELETE SET NULL for audit trails (created_by, approved_by, etc.)
6. ON DELETE RESTRICT for historical records (notifications, audit_entries)
7. CHECK constraints cover all DOC-015 invariants enforceable at DB level
8. No SERIAL columns used (all UUID primary keys)
9. timestamptz used everywhere (never timestamp without timezone)
10. jsonb used for flexible data, never plain text for structured data

Report violations with file path, line, rule violated, and suggested fix.
Apply strict reviewer standards for database correctness.
// SKILL: ruflo-core:reviewer
`,
{ label: 'Schema review', phase: 'Schema Review', subagent_type: 'ruflo-core:reviewer' })

// ============================================================
// PHASE 2: MIGRATION AUDIT
// ============================================================
phase('Migration Audit')

// Ruflo migrations validator checks migration packs rigorously
const audit = await agent(
`Audit the migration pack using ruflo-migrations:migrate-validate discipline.
Every migration is individually validated, then the chain is checked as a whole.

Read:
- docs/00-canonical/migration-rls-pack/MIGRATION-PACK-V1.md (if exists)
- docs/00-canonical/migration-rls-pack/BOOTSTRAP-MIGRATION-SPECIFICATION-V1.md (if exists)

Check:
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

Output findings as JSON:
{
  "order_valid": true/false,
  "self_contained": true/false,
  "rollbacks_present": true/false,
  "idempotent_safe": true/false,
  "igs_headers_present": true/false,
  "business_logic_found": false,
  "violations": [{ "migration": "MIG-NNN", "issue": "...", "severity": "CRITICAL|MAJOR|MINOR" }]
}`,
{ label: 'Migration audit', phase: 'Migration Audit', subagent_type: 'ruflo-migrations:migrate-validate', schema: { type: 'object', properties: {
  order_valid: { type: 'boolean' },
  self_contained: { type: 'boolean' },
  rollbacks_present: { type: 'boolean' },
  idempotent_safe: { type: 'boolean' },
  igs_headers_present: { type: 'boolean' },
  business_logic_found: { type: 'boolean' },
  violations: { type: 'array', items: { type: 'object' } }
}}})

log(`Migration violations: ${(audit?.violations || []).length}`)

// ============================================================
// PHASE 3: RLS SECURITY AUDIT
// ============================================================
phase('RLS Security Audit')

// Security auditor specializes in RLS vulnerability detection
const rlsAudit = await agent(
`Conduct a rigorous security audit of Row Level Security policies.
Use ruflo-security-audit:audit expertise to identify RLS vulnerabilities.

Read:
- docs/00-canonical/migration-rls-pack/RLS-POLICY-SPECIFICATION-V1.md (if exists)
- docs/00-canonical/POSTGRESQL-SCHEMA-PACK-v1.md (table definitions)
- docs/00-canonical/DOC-023-CANONICAL-RELATIONAL-RULES.md §8 (multi-tenant isolation)

Security checks:
1. Every table that stores tenant data has ENABLE ROW LEVEL SECURITY
2. Every policy's USING clause contains org_id filtering — NO EXCEPTIONS
3. FORCE ROW LEVEL SECURITY on audit_entries (NB-PERSIST-006)
4. Superadmin bypass is configured via session variable, not hardcoded
5. No policy uses OR logic that could bypass org_id filter
6. sync_service role cannot access users table credentials
7. readonly role has SELECT-only policies (no INSERT/UPDATE/DELETE)
8. migration_role has no RLS policies (only SCHEMA USAGE)
9. All RLS policies reference current_setting('request.org_id') — not hardcoded values
10. No policy grants access to another tenant's data through JOIN or subquery

Critical security risk check:
- ANY policy missing org_id filter = CRITICAL
- ANY USING clause without ::uuid cast = MAJOR
- ANY WITH CHECK clause missing = MINOR

Output:
{
  "security_level": "HIGH|MEDIUM|LOW",
  "critical_issues": N,
  "major_issues": N,
  "minor_issues": N,
  "tables_with_force_rls": ["audit_entries"],
  "missing_policies": [{ "table": "...", "action": "..." }],
  "compliant": true/false
}`,
{ label: 'RLS security audit', phase: 'RLS Security Audit', subagent_type: 'ruflo-security-audit:security-auditor', schema: { type: 'object', properties: {
  security_level: { type: 'string', enum: ['HIGH','MEDIUM','LOW'] },
  critical_issues: { type: 'number' },
  major_issues: { type: 'number' },
  minor_issues: { type: 'number' },
  tables_with_force_rls: { type: 'array', items: { type: 'string' } },
  missing_policies: { type: 'array', items: { type: 'object' } },
  compliant: { type: 'boolean' }
}}})

log(`RLS security: ${rlsAudit?.security_level ?? '?'} (${rlsAudit?.critical_issues ?? '/'}/critical)` )

// ============================================================
// PHASE 4: PERFORMANCE REVIEW
// ============================================================
phase('Performance Review')

// Researcher + systematic debugging for performance analysis
await agent(
`Review database performance considerations using research methods and systematic debugging.

Research all indexing and query patterns:
1. org_id indexes on all 32 tables (DOC-023 §8 requirement)
2. GIN indexes only on jsonb columns (not over-indexed)
3. No full-text search indexes yet (deferred per spec §5.4 EXCLUDED)
4. Composite indexes match actual query patterns (not theoretical)
5. Sequence/trigger overhead considered for audit_entries high-volume writes

Systematically debug any performance concerns:
6. Identify n+1 query risks in service code
7. Check if migration rollback scripts are O(1) operations (DROP TABLE, not DELETE)
8. Trace slow query patterns through the execution plan
9. Identify unnecessary joins triggered by FK relationships

For each finding: describe the issue, trace root cause, suggest fix.
// SKILL: superpowers:systematic-debugging
`,
{ label: 'Performance review', phase: 'Performance Review', subagent_type: 'ruflo-core:researcher' })
