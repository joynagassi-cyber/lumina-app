export const meta = {
  name: 'lumina-superagent-workflows',
  description: 'Complete super-agent workflow system for Lumina development lifecycle — powered by Ruflo & Superpowers agents',
  phases: [
    { title: 'Phase 1 — Discovery & Alignment' },
    { title: 'Phase 2 — Architecture & Design Review' },
    { title: 'Phase 3 — Implementation Readiness' },
    { title: 'Phase 4 — Verification & Review' },
    { title: 'Phase 5 — Documentation & Release Prep' },
  ],
}

log('=== Lumina Super-Agent Workflow System (Ruflo + Superpowers) ===')
log('Phases: Discovery → Architecture → Implementation → Verification → Documentation')

// ============================================================
// PHASE 1: DISCOVERY & ALIGNMENT
// ============================================================
phase('Phase 1 — Discovery & Alignment')

// SKILL: agent-reach
const alignment = await agent(
`Run a comprehensive architecture alignment check against Lumina's canonical documents.
Use pathfinder research to find patterns and dependencies across the codebase.

Context:
- Canonical docs: docs/00-canonical/ (DOC-000 to DOC-024 + ARA-v1 + IGS-v1)
- Current architecture: docs/00-architecture/Architecture-Map.md
- Domain model: docs/00-canonical/CANONICAL-DOMAIN-MODEL.md
- Aggregates: docs/00-canonical/AGGREGATE-BOUNDARY-SPECIFICATION.md
- Invariants: docs/00-canonical/DOMAIN-INVARIANT-REGISTRY.md
- ADRs: docs/90-adrs/

Tasks:
1. Scan ALL .md files in docs/ and compare current state vs canonical truth
2. Identify drift: any deviation from DOC-000–DOC-024 rules, NeverBreak violations
3. Check that all ADRs reference canonical documents correctly
4. Detect orphaned docs (not referenced by INDEX.md or navigation-agent.md)
5. Verify traceability matrix completeness
6. Identify gaps between capability-engine definitions and actual implementations mentioned in docs

Output a JSON object with:
{
  "drift": [{ "doc": "...", "issue": "...", "severity": "CRITICAL|MAJOR|MINOR", "canonical_ref": "..." }],
  "orphans": ["path/to/orphan.md"],
  "broken_refs": [{ "from": "...", "to": "...", "type": "ADR|DOC|INDEX" }],
  "gap_count": number,
  "alignment_score": 0-100
}
`,
{ label: 'Align scan', phase: 'Phase 1 — Discovery & Alignment', subagent_type: 'ruflo-core:researcher', schema: {
  type: 'object',
  properties: {
    drift: { type: 'array', items: { type: 'object', properties: { doc: { type: 'string' }, issue: { type: 'string' }, severity: { type: 'string', enum: ['CRITICAL','MAJOR','MINOR'] }, canonical_ref: { type: 'string' } } } },
    orphans: { type: 'array', items: { type: 'string' } },
    broken_refs: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, type: { type: 'string' } } } },
    gap_count: { type: 'integer' },
    alignment_score: { type: 'integer' }
  }
}})

log(`Alignment score: ${alignment?.alignment_score ?? '?}/100`)
log(`Drifts found: ${(alignment?.drift || []).length}`)
log(`Orphans found: ${(alignment?.orphans || []).length}`)
log(`Broken references: ${(alignment?.broken_refs || []).length}`)

// ============================================================
// PHASE 2: ARCHITECTURE & DESIGN REVIEW
// ============================================================
phase('Phase 2 — Architecture & Design Review')

// Superpower pre-step: creative exploration before deep review
await agent(
`Before conducting the architectural review, brainstorm the key risk areas and failure modes
for this Lumina project. Consider:
- What architectural decisions are most fragile?
- Where is documentation drift most likely hiding?
- Which layers have the weakest traceability?
- What common anti-patterns appear in projects of this scale?

This brainstorming session should shape what the reviewer looks for.
// SKILL: superpowers:brainstorming
`,
{ label: 'Arch brainstorm', phase: 'Phase 2 — Architecture & Design Review', subagent_type: 'superpowers:brainstorming' })

// Ruflo intelligence specialist: constitution-level analysis
const archReview = await agent(
`Conduct a thorough architectural review using the RETRIEVE→JUDGE→DISTILL→CONSOLIDATE pipeline.

Step 1 RETRIEVE — Gather all relevant context:
- docs/00-canonical/ARCHITECTURE-DECISION-CONSTITUTION.md
- docs/00-canonical/CANONICAL-ARCHITECTURE-MODEL.md
- docs/00-canonical/IMPLEMENTATION-GENERATION-SPECIFICATION.md
- docs/00-canonical/ARCHITECTURE-GOVERNANCE-REVIEW-WORKFLOW.md
- docs/00-architecture/Dependency-Contract.md
- docs/90-adrs/ (ALL ADRs)

Step 2 JUDGE — Evaluate from multiple lenses:
1. CONSTITUTION COMPLIANCE: Do all ADRs respect the Architecture Decision Constitution?
2. DEPENDENCY CONTRACT: Are inter-layer dependencies flowing top-down only?
3. NEVERBREAK CHECK: Any violation of NB-PERSIST, NB-RR, NB-ID, NB-MT rules?
4. TRACEABILITY: Can every artifact be traced to DOC-000..DOC-024?
5. ADR QUALITY: Are all ADRs complete with status, context, consequences, decision?
6. CROSS-REFERENCE: Do cross-references between docs resolve correctly?

Step 3 DISTILL — Synthesize findings into actionable insights.

Step 4 CONSOLIDATE — Produce the final structured report.

Output:
{
  "constitution_compliance": [{ "adr": "...", "issue": "...", "rule": "..." }],
  "dependency_violations": [{ "from": "...", "to": "...", "direction": "forbidden_direction" }],
  "neverbreak_violations": [{ "rule": "NB-XXX", "location": "...", "details": "..." }],
  "traceability_gaps": ["doc_path_without_canonical_ref"],
  "adr_quality": [{ "adr": "ADR-NNN", "missing_fields": [...] }],
  "overall_health": "HEALTHY|DEGRADED|CRITICAL"
}
`,
{ label: 'Arch review', phase: 'Phase 2 — Architecture & Design Review', subagent_type: 'ruflo-intelligence:intelligence-specialist', schema: {
  type: 'object',
  properties: {
    constitution_compliance: { type: 'array', items: { type: 'object' } },
    dependency_violations: { type: 'array', items: { type: 'object' } },
    neverbreak_violations: { type: 'array', items: { type: 'object', properties: { rule: { type: 'string' }, location: { type: 'string' }, details: { type: 'string' } } } },
    traceability_gaps: { type: 'array', items: { type: 'string' } },
    adr_quality: { type: 'array', items: { type: 'object' } },
    overall_health: { type: 'string', enum: ['HEALTHY','DEGRADED','CRITICAL'] }
  }
}})

log(`Architecture health: ${archReview?.overall_health ?? 'pending'}`)

// Debug any architecture drifts systematically
await agent(
`Systematically debug any architectural drifts identified in the previous review.
For each neverbreak_violation and dependency_violation:
1. Trace the root cause of the drift
2. Identify which document or decision created the inconsistency
3. Determine the correct fix based on the canonical source

Follow the systematic debugging approach: observe → hypothesize → test → conclude.
// SKILL: superpowers:systematic-debugging
`,
{ label: 'Debug arch drift', phase: 'Phase 2 — Architecture & Design Review', subagent_type: 'superpowers:systematic-debugging' })

// ============================================================
// PHASE 3: IMPLEMENTATION READINESS CHECK
// ============================================================
phase('Phase 3 — Implementation Readiness')

// Validate domain model aggregates using DDD specialist
const dddValidation = await agent(
`Validate Lumina's domain model against DDD best practices.

Read:
- docs/00-canonical/CANONICAL-DOMAIN-MODEL.md
- docs/00-canonical/AGGREGATE-BOUNDARY-SPECIFICATION.md
- docs/00-canonical/DOMAIN-INVARIANT-REGISTRY.md
- docs/00-canonical/CAPABILITY-DEPENDENCY-GRAPH.md

Verify:
1. All 13 aggregates are properly defined with clear boundaries
2. Each aggregate has a single responsible entity (aggregate root)
3. Invariants are enforceable within aggregate boundaries
4. Cross-aggregate references use IDs, not object references
5. Capability dependencies respect the DAG (no cycles)
6. Physical objects map correctly to aggregates per DOC-021/DOC-022

Report any DDD violations.
`,
{ label: 'DDD validation', phase: 'Phase 3 — Implementation Readiness', subagent_type: 'ruflo-ddd:ddd-validate' })

// Write the implementation plan using Superpower planning
const implPlan = await agent(
`Based on the DDD validation results and architecture review, produce a detailed
implementation readiness plan that identifies gaps and prescribes the order of operations.

Check:
- Domain model completeness (13 aggregates, 58 invariants)
- Schema pack completeness (32 tables)
- Migration pack ordering and coverage
- RLS policy specification completeness
- Frontend/backend guide alignment with specs
- Test strategy covering all invariant checks
- Offline-first strategy consistency with schema

Create a phased implementation plan with dependencies mapped.
// SKILL: superpowers:writing-plans
`,
{ label: 'Impl plan', phase: 'Phase 3 — Implementation Readiness', subagent_type: 'superpowers:writing-plans' })

const implReady = await agent(
`Check implementation readiness for Lumina's full stack development.
Integrate DDD validation results and the written implementation plan.

Read the full spec chain:
- docs/00-canonical/CANONICAL-DOMAIN-MODEL.md (domain truth)
- docs/00-canonical/CAPABILITY-DEPENDENCY-GRAPH.md (capability DAG)
- docs/00-canonical/DOC-021-PHYSICAL-DATA-MODEL.md (physical objects)
- docs/00-canonical/POSTGRESQL-SCHEMA-PACK-v1.md (actual SQL tables)
- docs/00-canonical/CONSTRAINTS-INDEX-SPECIFICATION-v1.md (constraints)
- docs/07-frontend-guide/Frontend-Implementation-Guide.md
- docs/08-backend-guide/Backend-Implementation-Guide.md
- docs/09-testing-strategy/Testing-Strategy.md
- docs/01-platform-core/index.md (platform core definition)
- docs/02-offline-first/index.md (offline-first strategy)

Verify readiness at each layer:
1. DOMAIN: Are all 13 aggregates defined? Are all 58 invariants documented?
2. SCHEMA: Is the PostgreSQL schema pack complete (32 tables)?
3. MIGRATIONS: Are migration packs generated and ordered?
4. RLS: Are RLS policies specified for all tables?
5. FRONTEND: Does the frontend guide reference correct APIs and data models?
6. BACKEND: Does the backend guide follow API contracts correctly?
7. TESTING: Are test strategies aligned with invariant coverage requirements?
8. OFFLINE: Is the WatermelonDB strategy consistent with the schema?

Output:
{
  "readiness": {
    "domain_model": "READY|PARTIAL|MISSING",
    "schema_pack": "READY|PARTIAL|MISSING",
    "migrations": "READY|PARTIAL|MISSING",
    "rls_policies": "READY|PARTIAL|MISSING",
    "frontend_guide": "READY|PARTIAL|MISSING",
    "backend_guide": "READY|PARTIAL|MISSING",
    "testing_strategy": "READY|PARTIAL|MISSING",
    "offline_first": "READY|PARTIAL|MISSING"
  },
  "blockers": [{ "layer": "...", "issue": "...", "blocking": true/false }],
  "missing_specs": ["path_to_missing_spec"],
  "ready_percentage": number
}
`,
{ label: 'Impl readiness', phase: 'Phase 3 — Implementation Readiness', subagent_type: 'ruflo-ddd:ddd-validate', schema: {
  type: 'object',
  properties: {
    readiness: { type: 'object', properties: { domain_model: { type: 'string' }, schema_pack: { type: 'string' }, migrations: { type: 'string' }, rls_policies: { type: 'string' }, frontend_guide: { type: 'string' }, backend_guide: { type: 'string' }, testing_strategy: { type: 'string' }, offline_first: { type: 'string' } } },
    blockers: { type: 'array', items: { type: 'object', properties: { layer: { type: 'string' }, issue: { type: 'string' }, blocking: { type: 'boolean' } } } },
    missing_specs: { type: 'array', items: { type: 'string' } },
    ready_percentage: { type: 'number' }
  }
}})

log(`Implementation readiness: ${implReady?.ready_percentage ?? '?'}%`)

// ============================================================
// PHASE 4: VERIFICATION & CODE REVIEW
// ============================================================
phase('Phase 4 — Verification & Review')

// Ruflo core reviewer handles verification
const verification = await agent(
`Run the complete automated verification suite for Lumina.
Apply strict quality review from a security, correctness, and best-practice perspective.

Execute these checks using bash commands where possible:

1. FILE INTEGRITY CHECK:
   - Count total .md files in docs/
   - Verify no empty files exist
   - Check for proper frontmatter (---) on canonical docs
   - Verify INDEX.md references all organized docs

2. CROSS-REFERENCE VALIDATION:
   - grep for [[name]] wiki-link patterns and verify targets exist
   - grep for DOC-NNN references and verify those docs exist
   - grep for ADR-NNN references and verify those files exist
   - Check migration pack files have IGS-v1 headers

3. TRACEABILITY AUDIT:
   - Every file in docs/ should be reachable from INDEX.md
   - Every ADR should reference its canonical source
   - Every constraint should reference DOC-015 invariant
   - Verify migration pack traceability to schema pack

4. STRUCTURAL VALIDATION:
   - Validate all ADRs follow the format: Title, Status, Context, Decision, Consequences
   - Check that canonical docs have version, date, author, validation fields
   - Ensure glossary terms are referenced consistently

5. CONSISTENCY AUDIT:
   - Check that _org_id appears on all tenant-scoped tables
   - Verify index naming convention (idx_{table}_{column})
   - Check that check constraints use CHECK() syntax not inline
   - Verify no feature-oriented leftover artifacts remain

Output:
{
  "file_integrity": { "total_files": N, "empty_files": [...], "missing_frontmatter": [...] },
  "cross_references": { "valid": N, "broken": [...], "orphaned_targets": [...] },
  "traceability": { "complete_tables": N, "missing_traces": [...] },
  "structural": { "adr_format_ok": N, "format_violations": [...], "canonical_headers_ok": N },
  "consistency": { "org_id_present_on_all": true/false, "naming_violations": [...], "legacy_artifacts": [...] },
  "verification_passed": true/false
}
`,
{ label: 'Verify suite', phase: 'Phase 4 — Verification & Review', subagent_type: 'ruflo-core:reviewer', schema: {
  type: 'object',
  properties: {
    file_integrity: { type: 'object' },
    cross_references: { type: 'object' },
    traceability: { type: 'object' },
    structural: { type: 'object' },
    consistency: { type: 'object' },
    verification_passed: { type: 'boolean' }
  }
}})

log(`Verification passed: ${verification?.verification_passed ?? '?'}`)

// Final Superpower verification gate
await agent(
`FINAL GATE: Before declaring the workflow complete, verify everything holds together.
Check that:
- No critical drift was missed in Phase 1
- Architecture health is at least DEGRADED (not CRITICAL)
- Implementation readiness is at least 70%
- Verification suite passed or identified no critical issues

If any gate fails, report what needs to happen before proceeding.
// SKILL: superpowers:verification-before-completion
`,
{ label: 'Final verification gate', phase: 'Phase 4 — Verification & Review', subagent_type: 'superpowers:verification-before-completion' })

// ============================================================
// PHASE 5: DOCUMENTATION & RELEASE
// ============================================================
phase('Phase 5 — Documentation & Release Prep')

// Use intelligent docs writer for changelog and release prep
const releasePrep = await agent(
`Prepare release documentation for Lumina v1 migration pack.
Write professional, precise, and traceable documentation.

Current state:
- Migration Pack v1: docs/00-canonical/migration-rls-pack/
- Bootstrap Spec: docs/00-canonical/migration-rls-pack/BOOTSTRAP-MIGRATION-SPECIFICATION-V1.md
- Canonical docs: docs/00-canonical/ (DOC-000 to DOC-024)
- ADRs: docs/90-adrs/

Tasks:
1. Generate a CHANGELOG for the migration pack covering:
   - What changed (new 35 migrations, 32 tables ordered topologically)
   - Bootstrap scripts added (pgcrypto, org foundation, roles, verification)
   - RLS policies covering all 32 tables × 9 roles
   - Verification report with 47 checks

2. Create a RELEASE-NOTES.md summarizing:
   - Architecture summary (13 aggregates, 32 tables, multi-tenant by design)
   - What's included in this release
   - Migration path for existing projects
   - Known limitations and future work
   - Compliance status (all IGS-v1 checks passing)

3. Update INDEX.md to include the new migration-rls-pack directory

4. Generate a quick-start guide (QUICKSTART.md):
   - Step-by-step: how to apply bootstrap scripts
   - How to apply migrations in order
   - How to activate RLS policies
   - How to run verification

Output a structured plan with:
{
  "changelog_sections": ["section_title"],
  "release_notes_draft": "markdown content",
  "quickstart_steps": ["step_1", "step_2", ...],
  "index_updates_needed": ["path -> section_mapping"]
}
`,
{ label: 'Release prep', phase: 'Phase 5 — Documentation & Release Prep', subagent_type: 'ruflo-docs:docs-writer', schema: {
  type: 'object',
  properties: {
    changelog_sections: { type: 'array', items: { type: 'string' } },
    release_notes_draft: { type: 'string' },
    quickstart_steps: { type: 'array', items: { type: 'string' } },
    index_updates_needed: { type: 'array', items: { type: 'object' } }
  }
}})

log(`Quickstart steps: ${(releasePrep?.quickstart_steps || []).length}`)

// ============================================================
// FINAL SUMMARY
// ============================================================
log('=== Super-Agent Workflow Suite Complete (Ruflo + Superpowers) ===')
log(`Alignment score: ${alignment?.alignment_score ?? '?'/100}`)
log(`Architecture health: ${archReview?.overall_health ?? 'pending'}`)
log(`Implementation readiness: ${implReady?.ready_percentage ?? '?'}%`)
log(`Verification passed: ${verification?.verification_passed ?? '?'}`)
log(`Release prepared: ${(releasePrep?.changelog_sections || []).length} sections`)

return {
  phase1: { alignment_score: alignment?.alignment_score, drifts: alignment?.drift?.length, agent: 'ruflo-core:researcher' },
  phase2: { health: archReview?.overall_health, nb_violations: archReview?.neverbreak_violations?.length, agent: 'ruflo-intelligence:intelligence-specialist' },
  phase3: { ready_pct: implReady?.ready_percentage, ddd_validated: !!dddValidation, agent: 'ruflo-ddd:ddd-validate' },
  phase4: { passed: verification?.verification_passed, agent: 'ruflo-core:reviewer' },
  phase5: { sections: releasePrep?.changelog_sections?.length, steps: releasePrep?.quickstart_steps?.length, agent: 'ruflo-docs:docs-writer' },
}
