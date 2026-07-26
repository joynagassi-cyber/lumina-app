export const meta = {
  name: 'lumina-full-feature',
  description: 'End-to-end feature development from idea to verified implementation — powered by Ruflo & Superpowers agents',
  phases: [
    { title: 'Discovery & Brief' },
    { title: 'Architecture Alignment' },
    { title: 'Design & Specification' },
    { title: 'Implementation' },
    { title: 'Verification' },
    { title: 'Documentation' },
  ],
}

// ============================================================
// PHASE 1: DISCOVERY & BRIEF
// ============================================================
phase('Discovery & Brief')

// Superpower brainstorming BEFORE the brief — explore the idea thoroughly
await agent(
`Before creating the product brief, brainstorm the proposed feature from multiple perspectives.

Explore:
- What problem does this feature solve? For whom?
- What are the edge cases and failure modes?
- How does this interact with existing capabilities and aggregates?
- What architectural risks should we be aware of?
- Are there alternative approaches worth considering?

Document insights that will shape the brief.
// SKILL: superpowers:brainstorming
`,
{ label: 'Feature brainstorm', phase: 'Discovery & Brief', subagent_type: 'superpowers:brainstorming' })

const brief = await agent(
`Create a product brief for a new Lumina feature.
Incorporate insights from the preceding brainstorming session.

Read:
- docs/00-canonical/CANONICAL-ELEMENT-REGISTRY.md (what elements exist)
- docs/00-canonical/CAPABILITY-DEPENDENCY-GRAPH.md (capability boundaries)
- docs/90-adrs/ (existing decisions that constrain this feature)

Produce:
{
  "feature_name": "...",
  "capability_mapped_to": "...",
  "aggregates_affected": ["..."],
  "business_rules_impacted": ["..."],
  "constraints": ["derived_from_ADRs_and_canonical_docs"],
  "user_stories": [{ "as": "...", "I want": "...", "so that": "..." }]
}`,
{ label: 'Product brief', phase: 'Discovery & Brief', schema: {
  type: 'object',
  properties: {
    feature_name: { type: 'string' },
    capability_mapped_to: { type: 'string' },
    aggregates_affected: { type: 'array', items: { type: 'string' } },
    business_rules_impacted: { type: 'array', items: { type: 'string' } },
    constraints: { type: 'array', items: { type: 'string' } },
    user_stories: { type: 'array', items: {
      type: 'object',
      properties: { as: { type: 'string' }, want: { type: 'string' }, so_that: { type: 'string' } }
    }}
  }
}})

log(`Feature: ${brief?.feature_name}`)
log(`Aggregates affected: ${(brief?.aggregates_affected || []).join(', ')}`)

// ============================================================
// PHASE 2: ARCHITECTURE ALIGNMENT
// ============================================================
phase('Architecture Alignment')

// DDD validation specialist checks architecture compliance
const archAlign = await agent(
`Check if the proposed feature respects Lumina's architecture rules using DDD validation.

Read:
- docs/00-canonical/ARCHITECTURE-DECISION-CONSTITUTION.md
- docs/00-canonical/IMPLEMENTATION-GENERATION-SPECIFICATION.md (§7 Rejet criteria)
- docs/00-canonical/DOC-023-CANONICAL-RELATIONAL-RULES.md (NeverBreak)
- docs/00-architecture/Dependency-Contract.md

Verify:
1. Feature maps to an existing Capability (no new Capability creation)
2. No new Aggregate is created (only adds entities to existing Aggregates)
3. No business logic injected at storage layer
4. All foreign keys respect boundary preservation
5. _org_id is present on all new physical objects
6. NeverBreak rules are not violated
7. Domain aggregate boundaries are respected per DDD principles

Output:
{
  "compliant": true/false,
  "violations": [{ "rule": "NB-XXX or ADR-NNN", "details": "..." }],
  "required_adrs": ["ADR for any exception needed"],
  "pipeline_stage": "Schema → Migration → RLS → Test"
}`,
{ label: 'Arch alignment', phase: 'Architecture Alignment', subagent_type: 'ruflo-ddd:ddd-validate', schema: {
  type: 'object',
  properties: {
    compliant: { type: 'boolean' },
    violations: { type: 'array', items: { type: 'object' } },
    required_adrs: { type: 'array', items: { type: 'string' } },
    pipeline_stage: { type: 'string' }
  }
}})

log(`Feature compliance: ${archAlign?.compliant ?? '?'}`)

// Continue based on compliance...
if (!archAlign?.compliant) {
  log('WARNING: Feature has architectural violations - blocking implementation')
} else {
  log('Architecture aligned — proceeding to design')
}

// ============================================================
// PHASE 3: DESIGN & SPECIFICATION
// ============================================================
phase('Design & Specification')

// Superpower writing-plans creates the detailed technical specification plan
const designPlan = await agent(
`Create a comprehensive technical design specification for the approved Lumina feature.
Write a structured implementation plan covering all layers.

Read:
- docs/00-canonical/DOC-021-PHYSICAL-DATA-MODEL.md (physical objects template)
- docs/00-canonical/DOC-022-PO-PHYSICAL-MAPPING-RULES.md (mapping rules)
- docs/00-canonical/DOC-023-CANONICAL-RELATIONAL-RULES.md (relational patterns)
- docs/00-canonical/CONSTRAINTS-INDEX-SPECIFICATION-v1.md (constraint patterns)
- docs/07-frontend-guide/Frontend-Implementation-Guide.md (UI patterns)
- docs/08-backend-guide/Backend-Implementation-Guide.md (API patterns)

Design must cover:
1. Physical Object definition (if new table needed): PO name, attributes, relations
2. Constraint derivation from invariants (NOT NULL, CHECK, UNIQUE)
3. Index specification (org_id mandatory + performance indexes)
4. API contract (endpoints, request/response types, error codes per IGS-v1 §3.5)
5. RLS policy (roles, using clause, force RLS if audit-critical)
6. Test strategy (invariant coverage, boundary conditions)

Write a phased plan that the implementation agent can follow precisely.
// SKILL: superpowers:writing-plans
`,
{ label: 'Tech design plan', phase: 'Design & Specification', subagent_type: 'superpowers:writing-plans' })

const design = await agent(
`Generate the complete technical design based on the written plan.

Include concrete specifications:
1. Physical Objects with attribute types per DOC-021
2. Constraints derived from invariants with sources
3. Indexes with justifications
4. API endpoints with command mappings and role requirements
5. RLS policies with using clauses and force-RLS flags
6. Test strategy with unit/integration counts

Output:
{
  "physical_objects": [{ "name": "...", "attributes": [...], "relations": [...] }],
  "constraints": [{ "table": "...", "constraint": "...", "source_invariant": "..." }],
  "indexes": [{ "table": "...", "index": "...", "type": "B-tree|GIN|UNIQUE", "justification": "..." }],
  "api_endpoints": [{ "method": "...", "path": "...", "command": "...", "roles": ["..."] }],
  "rls_policies": [{ "table": "...", "action": "SELECT|INSERT|UPDATE|DELETE", "roles": ["..."], "using_clause": "..." }],
  "test_strategy": { "unit_tests": N, "integration_tests": N, "invariant_coverage": "..." }
}`,
{ label: 'Tech design', phase: 'Design & Specification', schema: {
  type: 'object',
  properties: {
    physical_objects: { type: 'array', items: { type: 'object' } },
    constraints: { type: 'array', items: { type: 'object' } },
    indexes: { type: 'array', items: { type: 'object' } },
    api_endpoints: { type: 'array', items: { type: 'object' } },
    rls_policies: { type: 'array', items: { type: 'object' } },
    test_strategy: { type: 'object' }
  }
}})

// ============================================================
// PHASE 4: IMPLEMENTATION
// ============================================================
phase('Implementation')

// Ruflo core coder generates clean, convention-compliant code
const impl = await agent(
`Generate the complete implementation artifacts for the Lumina feature.
Write clean, well-documented code following all project conventions.

Based on the approved design, generate:

1. MIGRATION SQL:
   - CREATE TABLE statements following POSTGRESQL-SCHEMA-PACK-v1 format
   - IGS-v1 metadata headers on every table
   - All columns exactly per spec (types, constraints, defaults)
   - Indexes immediately after table creation
   - Rollback section

2. API SERVICE CODE:
   - Service methods implementing each command
   - Invariant guards before writes
   - Domain events emitted after state changes
   - Audit logging via AuditAggregate

3. FRONTEND COMPONENTS:
   - Screen components per Frontend Implementation Guide
   - Form definitions referencing Vocabulary
   - State management using Context + useReducer
   - Offline support via WatermelonDB adaptation

4. TEST FILES:
   - Unit tests for invariant checks
   - Integration tests for API endpoints
   - E2E test scenarios for key flows

All code must follow project conventions and be traceable to canonical docs.
// SKILL: ruflo-core:coder
`,
{ label: 'Generate implementation', phase: 'Implementation', subagent_type: 'ruflo-core:coder' })

// ============================================================
// PHASE 5: VERIFICATION
// ============================================================
phase('Verification')

// TDD specialist validates test coverage
const testCoverage = await agent(
`Review the generated implementation against the test strategy.
Ensure every invariant has corresponding tests, boundary conditions are covered,
and the test suite follows TDD best practices.

Check:
- Unit tests cover all invariant guard functions
- Integration tests verify API contract compliance
- E2E scenarios cover happy paths and error paths
- Test names clearly document expected behavior
- No test duplicates or dead code

Apply TDD discipline: tests define requirements, not just verify implementation.
// SKILL: superpowers:test-driven-development
`,
{ label: 'Test coverage review', phase: 'Verification', subagent_type: 'superpowers:test-driven-development' })

const verifyResult = await agent(
`Run the complete verification suite for the implemented feature.
Apply IGS-v1 validation chain (§8) with strict reviewer standards.

1. V-STRUCT: Format/syntax valid?
2. V-COHERE: Relations logically consistent?
3. V-TRACE: Every element traced to canonical doc?
4. V-NB: No business rules at storage layer?
5. V_REGRESS: No semantic drift from existing features?
6. V-INVENT: No new concepts/capabilities/aggregates invented?

Also check:
- All migrations can apply without conflicts
- RLS policies cover all new tables
- Index naming follows convention
- _org_id present on all new tables
- No legacy feature-oriented artifacts remain

Output:
{
  "validations": {
    "V_STRUCT": "PASS|FAIL",
    "V_COHERE": "PASS|FAIL",
    "V_TRACE": "PASS|FAIL",
    "V_NB": "PASS|FAIL",
    "V_REGRESS": "PASS|FAIL",
    "V_INVENT": "PASS|FAIL"
  },
  "migration_checks": { "can_apply_cleanly": true/false, "conflicts": [] },
  "rls_coverage": { "all_tables_covered": true/false, "missing_policies": [] },
  "naming_compliance": { "follows_convention": true/false, "violations": [] },
  "final_verdict": "COMPLIANT|BLOCKED"
}`,
{ label: 'Verify feature', phase: 'Verification', subagent_type: 'ruflo-core:reviewer', schema: {
  type: 'object',
  properties: {
    validations: { type: 'object', properties: { V_STRUCT: { type: 'string' }, V_COHERE: { type: 'string' }, V_TRACE: { type: 'string' }, V_NB: { type: 'string' }, V_REGRESS: { type: 'string' }, V_INVENT: { type: 'string' } } },
    migration_checks: { type: 'object' },
    rls_coverage: { type: 'object' },
    naming_compliance: { type: 'object' },
    final_verdict: { type: 'string', enum: ['COMPLIANT','BLOCKED'] }
  }
}})

log(`Feature verdict: ${verifyResult?.final_verdict ?? 'pending'}`)

// Final verification gate
await agent(
`FINAL GATE: Ensure nothing was shipped without being verified.
Confirm:
- All IGS-v1 validations passed
- Code-review feedback was incorporated (if any)
- Tests match the TDD strategy
- Documentation is complete and accurate

Only pass this gate if everything is truly ready.
// SKILL: superpowers:verification-before-completion
`,
{ label: 'Final verification gate', phase: 'Verification', subagent_type: 'superpowers:verification-before-completion' })

// ============================================================
// PHASE 6: DOCUMENTATION
// ============================================================
phase('Documentation')

// ADR creation specialist handles documentation decisions
await agent(
`Determine whether this feature requires a new Architecture Decision Record.
If yes, draft the ADR with proper context, decision, and consequences sections.
Read the Architecture Decision Constitution first for format requirements.

Consider creating an ADR when:
- The feature introduces a new pattern not yet documented
- An exception to a NeverBreak rule is granted
- A deviation from recommended architecture is justified
- A legacy artifact needs formal retirement

If an ADR is needed, prepare it for creation.
// SKILL: ruflo-adr:adr-create
`,
{ label: 'ADR assessment', phase: 'Documentation', subagent_type: 'ruflo-adr:adr-create' })

const docResult = await agent(
`Update all documentation for the implemented feature.

Tasks:
1. Update ADR registry (add ADR documenting this feature decision)
2. Update CANONICAL-TRACEABILITY-MATRIX.md with new mappings
3. Update INDEX.md if new docs were created
4. Update CANONICAL-ELEMENT-REGISTRY.md (if new elements were added)
5. Update glossary.md with any new terminology

Each update must include:
- Changed file path
- Section updated
- Before/after summary
- Canonical reference updated

Output:
{
  "docs_updated": [{ "file": "...", "section": "...", "summary": "..." }],
  "adr_created": "ADR-NNN or null",
  "traceability_updated": true,
  "glossary_updated": false
}`,
{ label: 'Document feature', phase: 'Documentation', schema: {
  type: 'object',
  properties: {
    docs_updated: { type: 'array', items: { type: 'object' } },
    adr_created: { type: ['string', 'null'] },
    traceability_updated: { type: 'boolean' },
    glossary_updated: { type: 'boolean' }
  }
}})

log(`Docs updated: ${(docResult?.docs_updated || []).length}`)
