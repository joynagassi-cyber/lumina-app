export const meta = {
  name: 'docs-restructure',
  description: 'Restructure docs per canonical architecture',
  phases: [
    { title: 'Scan & Inventory', detail: 'Map all docs to layers' },
    { title: 'Rename & Move Phase 1', detail: 'Move critical files' },
    { title: 'Rename & Move Phase 2', detail: 'Move remaining files' },
    { title: 'Update Cross-References', detail: 'Fix links and refs' },
  ],
}

import { agent } from '@workflow'

// PHASE 1: Scan all existing docs and map them to the canonical layers
phase('Scan & Inventory')

const docList = [
  'docs/01-platform-core/index.md',
  'docs/01-platform-core/manifest-engine/index.md',
  'docs/01-platform-core/vocabulary-engine/index.md',
  'docs/01-platform-core/forms-engine/index.md',
  'docs/01-platform-core/workflow-engine/index.md',
  'docs/01-platform-core/capability-engine/index.md',
  'docs/00-architecture/Architecture-Map.md',
  'docs/00-architecture/Dependency-Contract.md',
  'docs/00-architecture/Documentation-Discipline.md',
  'docs/02-offline-first/index.md',
  'docs/03-configuration/engineered-declarative-analysis.md',
  'docs/06-gap-analysis/Gap-Analysis.md',
  'docs/99-supporting/invariants.md',
  'docs/99-supporting/neverbreak.md',
  'docs/99-supporting/glossary.md',
  'docs/INDEX.md',
  'docs/navigation-agent.md',
  'docs/08-backend-guide/Backend-Implementation-Guide.md',
  'docs/07-database-schema/Database-Schema.md',
  'docs/04-business-rules/financial-rules.md',
  'docs/04-business-rules/membership-rules.md',
]

const SCAN_RESULT = await agent(
`Scan these 21 doc files and for each one output a JSON object with:
- file path (relative to docs/)
- current content mentions 'Platform Core', 'moteur', 'Capability', 'engine'
- how many occurrences of 'Platform Core' remain
- how many occurrences of 'moteur' remain
- whether it needs renaming or just content update
Return ONE json array. No extra text.`,
  { label: 'scan all docs', phase: 'Scan & Inventory', schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, core_mentions: { type: 'number' }, engine_mentions: { type: 'number' }, needs_rename: { type: 'boolean' }, needs_content_fix: { type: 'boolean' } } } } } } }
)

log(`Scan complete: ${SCAN_RESULT?.files?.length ?? 'unknown'} files analyzed`)
