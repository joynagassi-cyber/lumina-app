export const meta = {
  name: 'lumina-compliance-audit',
  description: 'Multi-dimensional compliance audit across architecture, code, and documentation — powered by Ruflo & Superpowers agents',
  phases: [
    { title: 'Architecture Compliance' },
    { title: 'NeverBreak Verification' },
    { title: 'Traceability Audit' },
    { title: 'Gap Analysis' },
    { title: 'Remediation Plan' },
  ],
}

// ============================================================
// PHASE 1: ARCHITECTURE COMPLIANCE
// ============================================================
phase('Architecture Compliance')

// Ruflo core reviewer audits all ADRs and architecture documents
const archCompliance = await agent(
`Audit all documents for architecture compliance with strict reviewer standards.
Review from a quality, security, and best-practice perspective.

Read every ADR in docs/90-adrs/ and check:
1. Status is valid (PROPOSED|ACCEPTED|DEPRECATED|SUPERSEDED)
2. Context section describes the problem space
3. Decision section states the chosen approach clearly
4. Consequences section lists both positive AND negative impacts
5. References at least one DOC-XXX document or ARA-v1
6. Does NOT contradict any existing ADR
7. Is NOT proposing something that contradicts NeverBreak rules

Also read:
- docs/00-canonical/ARCHITECTURE-GOVERNANCE-REVIEW-WORKFLOW.md
- docs/00-canonical/ARCHITECTURE-SMELLS-REFACTORING-PAYBOOK.md

Check for architecture smells:
- Circular dependencies between doc layers
- Docs that reference implementation details at architecture layer
- Dead documentation (referenced nowhere)
- Orphaned decisions (no trace to current architecture)

Output:
{
  "adr_compliance": [{ "adr": "...", "valid": true/false, "issues": ["..."] }],
  "architecture_smells": [{ "type": "circular_dep|impl_leak|dead_doc|orphaned_decision", "path": "...", "severity": "HIGH|MEDIUM|LOW" }],
  "compliant_adr_count": N,
  "total_adrs": N,
  "smell_count": N
}`,
{ label: 'Arch compliance', phase: 'Architecture Compliance', subagent_type: 'ruflo-core:reviewer', schema: {
  type: 'object',
  properties: {
    adr_compliance: { type: 'array', items: { type: 'object' } },
    architecture_smells: { type: 'array', items: { type: 'object' } },
    compliant_adr_count: { type: 'number' },
    total_adrs: { type: 'number' },
    smell_count: { type: 'number' }
  }
}})

log(`ADR compliance: ${archCompliance?.compliant_adr_count ?? '?}/${archCompliance?.total_adrs ?? '?'}`)
log(`Architecture smells: ${archCompliance?.smell_count ?? '?'}`)

// ============================================================
// PHASE 2: NEVERBREAK VERIFICATION (parallel specialized checks)
// ============================================================
phase('NeverBreak Verification')

// DDD validator checks relational and persistence rules
await agent(
`Verify NeverBreak rules related to Persistence and Relational Rules using DDD validation discipline.

NEVER BREAK - Persistence:
- NB-PERSIST-001 through NB-PERSIST-012
- Focus on: no business rules in storage, invariants in Domain only,
  immutable log exclusive to AuditAggregate, no cross-aggregate FK deps

NEVER BREAK - Relational Rules:
- NB-RR-001 through NB-RR-008
- Focus on: aggregate boundaries, multi-tenant isolation, identification hygiene

Check schema docs, migration docs, and RLS docs for violations.
`,
{ label: 'NB-PERSIST/RR validate', phase: 'NeverBreak Verification', subagent_type: 'ruflo-ddd:ddd-validate' })

// Security auditor checks identity and multi-tenant rules
await agent(
`Security-audit NeverBreak rules related to Identity and Multi-tenant isolation.

NEVER BREAK - Identity:
- NB-ID-001 through NB-ID-004
- Natural identifiers never renamed, surrogate IDs never reused

NEVER BREAK - Multi-tenant:
- NB-MT-001: No object exists without valid _org_id
- NB-MT-002: No query executes without org filter
- NB-MT-003: No cross-tenant joins
- NB-MT-004: _org_id never modified after creation

Scan ALL docs and schema artifacts for potential bypasses or violations.
Report any security risk found at CRITICAL level.
`,
{ label: 'NB-ID/MT security audit', phase: 'NeverBreak Verification', subagent_type: 'ruflo-security-audit:security-auditor' })

// ============================================================
// PHASE 3: TRACEABILITY AUDIT
// ============================================================
phase('Traceability Audit')

// Knowledge graph traverser maps the full doc chain
await agent(
`Run a complete traceability audit across all documentation using knowledge graph traversal.

Map the traceability chain:
CONSTITUTION → Domain Model → Aggregates → Physical Objects → Schema → Migrations → RLS

For each link in the chain, use kg-traverse to:
1. Navigate from source to target and verify the connection exists
2. Check that the target references the correct source
3. Identify orphan artifacts not reachable from INDEX.md
4. Verify cross-references resolve correctly ([[doc-name]] links)
5. Validate all IGS-v1 metadata blocks are complete (7 fields minimum)

Specific checks:
- Every migration traces to exactly one Physical Object in DOC-021
- Every constraint traces to an invariant in DOC-015 or CC-XXX in DOC-021
- Every RLS policy traces to a table in DOC-021 and a role in the spec
- Every ADR traces to a canonical document

Report orphaned files and broken references as a traversed graph.
`,
{ label: 'Traceability audit', phase: 'Traceability Audit', subagent_type: 'ruflo-knowledge-graph:kg-traverse' })

// ============================================================
// PHASE 4: GAP ANALYSIS
// ============================================================
phase('Gap Analysis')

// Intelligence specialist identifies gaps through RETRIEVE→JUDGE→DISTILL→CONSOLIDATE
const gapAnalysis = await agent(
`Identify gaps between what exists and what should exist using the intelligence pipeline.

Step 1 RETRIEVE — Gather all document inventories:
- List all files in docs/ recursively
- List all files in docs/90-adrs/
- List all files in docs/00-canonical/migration-rls-pack/

Step 2 JUDGE — Check against IGS-v1 requirements:
1. Is there a test generation pipeline specification? (IGS-v1 §3.9)
2. Is there an API contract specification? (IGS-v1 §3.5)
3. Is there a deployment configuration spec? (IGS-v1 §3.7)
4. Are there data migration scripts for legacy data?
5. Is there a rollback strategy document?
6. Is there an encryption key management specification?

Step 3 DISTILL — Categorize gaps by impact:
- Structural gaps (missing entire document categories)
- Completeness gaps (documents exist but lack required sections)
- Reference gaps (DRs missing canonical refs)

Step 4 CONSOLIDATE — Produce prioritized gap list.

Report incomplete sections:
- Any ADR missing consequences section
- Any migration missing rollback section
- Any constraint missing canonical reference
- Any RLS policy missing authorization condition
`,
{ label: 'Gap analysis', phase: 'Gap Analysis', subagent_type: 'ruflo-intelligence:intelligence-specialist' })

// ============================================================
// PHASE 5: REMEDIATION PLAN
// ============================================================
phase('Remediation Plan')

// Writing-plans creates the structured remediation plan
const remediationPlan = await agent(
`Based on all audits completed above, generate a prioritized remediation plan.

Priority levels:
- P0 (IMMEDIATE): NeverBreak violations, security issues, data loss risk
- P1 (HIGH): Missing critical traces, broken cross-references, non-compliant ADRs
- P2 (MEDIUM): Architecture smells, documentation gaps
- P3 (LOW): Naming inconsistencies, formatting issues

For each item:
- Description
- Priority (P0-P3)
- Affected documents
- Suggested fix
- Estimated effort (F=quick, M=moderate, L=large)

Write this as an actionable backlog with clear acceptance criteria for each remediation.
// SKILL: superpowers:writing-plans
`,
{ label: 'Remediation plan', phase: 'Remediation Plan', subagent_type: 'superpowers:writing-plans' })
