export const meta = {
  name: 'lumina-docs-quality',
  description: 'Documentation quality audit, consistency check, and auto-fix suggestions — powered by Ruflo & Superpowers agents',
  phases: [
    { title: 'Quality Scan' },
    { title: 'Consistency Check' },
    { title: 'Glossary Validation' },
    { title: 'Auto-Fix Proposals' },
  ],
}

// ============================================================
// PHASE 1: QUALITY SCAN
// ============================================================
phase('Quality Scan')

// Researcher + KG extractor scan all docs and extract entities
const qualityScan = await agent(
`Scan all documentation for quality issues using pathfinder research methods.
Use kg-extract to identify entities, references, and relationships across documents.

Read all .md files in docs/ recursively.

Check each document for:
1. Frontmatter presence (title, version, date, author, status, validation)
2. IGS-v1 metadata blocks where required (schema, migration, RLS files)
3. Word count — flag documents that are too short (<50 words) or suspiciously long (>5000 words)
4. Internal link integrity ([[wiki-links]] resolve)
5. Cross-references to DOC-NNN exist and point to real documents
6. ADR format completeness (Context, Decision, Consequences sections)
7. Code blocks have language tags
8. Tables have consistent formatting
9. No TODO or FIXME markers left in production docs
10. French orthographic correctness (diacritics, accents)

Output:
{
  "total_docs_scanned": N,
  "quality_issues": [{ "file": "...", "line": N?, "type": "missing_frontmatter|broken_ref|format_issue|language_issue|content_issue", "description": "...", "severity": "CRITICAL|MAJOR|MINOR" }],
  "short_docs": ["path"],
  "long_docs": ["path"],
  "missing_frontmatter_count": N,
  "broken_links_count": N,
  "overall_quality_score": 0-100
}`,
{ label: 'Quality scan', phase: 'Quality Scan', subagent_type: 'ruflo-core:researcher', schema: { type: 'object', properties: {
  total_docs_scanned: { type: 'number' },
  quality_issues: { type: 'array', items: { type: 'object' } },
  short_docs: { type: 'array', items: { type: 'string' } },
  long_docs: { type: 'array', items: { type: 'string' } },
  missing_frontmatter_count: { type: 'number' },
  broken_links_count: { type: 'number' },
  overall_quality_score: { type: 'number' }
}}})

log(`Quality score: ${qualityScan?.overall_quality_score ?? '?}/100`)

// ============================================================
// PHASE 2: CONSISTENCY CHECK
// ============================================================
phase('Consistency Check')

// Core reviewer checks terminology consistency with strict standards
await agent(
`Check terminology and concept consistency across all documents.
Review as a code reviewer would check for patterns, naming conventions, and drift.

Rules from glossary.md:
1. "Platform Core" is used consistently (not "moteur", "framework", "engine")
2. "Capability" refers to capability-layer entity (not "fonctionnalité" for something else)
3. "Aggregate" always refers to DDD Aggregate boundary
4. "Physical Object" (PO) vs "Entity" — don't mix up conceptual vs physical
5. "_org_id" always prefixed with underscore (never "tenant_id" or "organization_id")
6. Migration IDs follow MIG-NNN format
7. Policy names follow pol_{table}_{action}_{role} format
8. Index names follow idx_{table}_{column} format

Scan docs for deviations and report them with file, line, and suggested fix.
`,
{ label: 'Terminology consistency', phase: 'Consistency Check', subagent_type: 'ruflo-core:reviewer' })

// ============================================================
// PHASE 3: GLOSSARY VALIDATION
// ============================================================
phase('Glossary Validation')

// Glossary manager skill validates term usage against definitions
await agent(
`Validate the glossary against actual usage across all documents.
Use the glossary-manager discipline to systematically verify term alignment.

Read:
- docs/99-supporting/glossary.md

For each term defined in the glossary:
1. Find all uses of the term in other documents
2. Verify the definition matches the context of use
3. Flag terms that are defined but never used
4. Flag terms that ARE used but NOT defined in glossary
5. Flag synonyms that should be unified (e.g., "tenant" vs "locataire" vs "_org_id")

Report a glossary health assessment with actionable remediation items.
// SKILL: glossary-manager
`,
{ label: 'Glossary validation', phase: 'Glossary Validation', subagent_type: 'superpowers:verification-before-completion' })

// ============================================================
// PHASE 4: AUTO-FIX PROPOSALS
// ============================================================
phase('Auto-Fix Proposals')

// Core coder proposes concrete fix implementations
await agent(
`Based on quality scan results, propose concrete fixes ready for implementation.
Write precise fix descriptions that a developer could apply directly.

Group fixes by priority:
P0: Broken cross-references that block navigation
P1: Missing frontmatter on canonical docs
P2: Terminology inconsistencies
P3: Formatting issues

For each fix:
- File path
- Section
- Current content summary
- Suggested fix (with exact text changes where possible)

Make every proposal actionable and traceable to the quality issue it resolves.
// SKILL: ruflo-core:coder
`,
{ label: 'Auto-fix proposals', phase: 'Auto-Fix Proposals', subagent_type: 'ruflo-core:coder' })
