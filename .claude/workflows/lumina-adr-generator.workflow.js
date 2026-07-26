export const meta = {
  name: 'lumina-adr-generator',
  description: 'Generate and validate ADRs against the Architecture Decision Constitution — powered by Ruflo & Superpowers agents',
  phases: [
    { title: 'ADR Analysis' },
    { title: 'ADR Generation' },
    { title: 'Consistency Check' },
  ],
}

// ============================================================
// PHASE 1: ADR ANALYSIS
// ============================================================
phase('ADR Analysis')

// Knowledge graph traverser navigates all ADR connections
const existingAdrs = await agent(
`Scan all ADRs in docs/90-adrs/ and analyze their current state.
Use kg-traverse to navigate the relationship graph between ADRs and canonical documents.

For each ADR, extract:
- ADR number and title
- Status (PROPOSED | ACCEPTED | DEPRECATED | SUPERSEDED)
- Context section completeness
- Decision section clarity
- Consequences section completeness
- Reference to canonical doc (DOC-XXX or ARA-v1)
- Date of creation/update
- Whether it cites superseded ADRs (for deprecated/superseded ones)

Output a JSON array of:
[{ "id": "ADR-NNN", "title": "...", "status": "...", "has_context": true/false, "has_decision": true/false, "has_consequences": true/false, "canonical_ref": "...", "supersedes": ["ADR-NNN"], "superseded_by": ["ADR-NNN"] }]
`,
{ label: 'Scan existing ADRs', phase: 'ADR Analysis', subagent_type: 'ruflo-knowledge-graph:kg-traverse', schema: { type: 'array', items: {
  type: 'object',
  properties: { id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' }, has_context: { type: 'boolean' }, has_decision: { type: 'boolean' }, has_consequences: { type: 'boolean' }, canonical_ref: { type: ['string', 'null'] }, supersedes: { type: 'array', items: { type: 'string' } }, superseded_by: { type: 'array', items: { type: 'string' } } }
}}})

log(`Analyzed ${existingAdrs?.length ?? 0} existing ADRs`)

// ============================================================
// PHASE 2: ADR GENERATION
// ============================================================
phase('ADR Generation')

// ADR creation specialist generates new architecture decisions
await agent(
`Based on the architecture alignment analysis, identify gaps requiring new ADRs.
Use ruflo-adr:adr-create standards for proper ADR format and content.

A new ADR is needed when:
1. An invariant rule needs exception (NB-PERSIST-XXX or NB-RR-XXX)
2. A design decision deviates from recommended patterns
3. A legacy artifact needs formal retirement
4. A performance optimization requires architectural exception
5. A new capability addition needs boundary documentation

Read:
- docs/00-canonical/ARCHITECTURE-DECISION-CONSTITUTION.md
- docs/00-canonical/ARCHITECTURE-GOVERNANCE-REVIEW-WORKFLOW.md
- docs/00-canonical/ARCHITECTURE-SMELLS-REFACTORING-PAYBOOK.md

For each identified gap, draft the ADR outline with:
- Proposed ADR title and number
- Full context section
- Proposed decision
- Positive and negative consequences
- References to canonical documents

List any ADRs that need to be created with full justification.
// SKILL: ruflo-adr:adr-create
`,
{ label: 'Identify ADR gaps', phase: 'ADR Generation', subagent_type: 'ruflo-adr:adr-create' })

// ============================================================
// PHASE 3: CONSISTENCY CHECK
// ============================================================
phase('Consistency Check')

// Core reviewer + verification gate ensure ADR consistency
const adrConsistency = await agent(
`Validate ALL existing ADRs for consistency using strict reviewer standards.

Rules:
1. Each ADR must reference at least one DOC-XXX document
2. Status must be valid (PROPOSED|ACCEPTED|DEPRECATED|SUPERSEDED)
3. Deprecated ADRs must have a superseding ADR reference
4. No two ADRs should contradict each other
5. All consequences sections must list both positive and negative impacts
6. Superseded ADRs must reference the document that supersedes them
7. Date format consistent across all ADRs (YYYY-MM-DD)

Report inconsistencies found with severity level.
`,
{ label: 'ADR consistency review', phase: 'Consistency Check', subagent_type: 'ruflo-core:reviewer' })

// Final verification gate
await agent(
`FINAL GATE for ADR generation workflow:
- All analyzed ADRs accounted for
- No orphaned or contradictory ADRs remain
- New ADR proposals follow the Constitution format exactly
- Every proposed ADR has complete context, decision, and consequences

Verify nothing was missed before declaring this workflow complete.
// SKILL: superpowers:verification-before-completion
`,
{ label: 'ADR consistency gate', phase: 'Consistency Check', subagent_type: 'superpowers:verification-before-completion' })
