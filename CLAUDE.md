# Lumina — Agentic Development System

This project uses a structured workflow system for AI-assisted development. Every task goes through the appropriate workflow based on its type.

## WORKFLOW INDEX

### Lifecycle Workflows
| Workflow | When to Use | Script |
|----------|------------|--------|
| **Super-Agent System** | Full project alignment scan across all layers | `lumina-superagent-system.workflow.js` |
| **Full Feature** | End-to-end feature development (idea → verified impl) | `lumina-full-feature.workflow.js` |
| **Schema & Migration** | Database schema changes, migration generation, RLS policies | `lumina-schema-migration.workflow.js` |

### Quality & Compliance Workflows
| Workflow | When to Use | Script |
|----------|------------|--------|
| **Compliance Audit** | Multi-dimensional audit (architecture + NeverBreak + traceability) | `lumina-compliance-audit.workflow.js` |
| **Docs Quality** | Documentation health check, consistency, glossary validation | `lumina-docs-quality.workflow.js` |
| **Integration Check** | Cross-layer integration validation (frontend → backend → DB) | `lumina-integration-check.workflow.js` |

### Domain-Specific Workflows
| Workflow | When to Use | Script |
|----------|------------|--------|
| **ADR Generator** | Architecture Decision Record creation and validation | `lumina-adr-generator.workflow.js` |
| **Database Review** | Schema review, migration audit, RLS security check | `lumina-database-review.workflow.js` |
| **Frontend QA** | Design system audit, component review, accessibility | `lumina-frontend-qa.workflow.js` |

## HOW TO USE

### Starting a Feature

1. **Brief**: Define what you want to build
2. **Run**: `/lumina full-feature` or ask Claude to run the full-feature workflow
3. **Review**: Check compliance and traceability results
4. **Iterate**: Fix any blockers before implementation

### Running an Audit

1. **Ask**: "Run a compliance audit" 
2. **Select**: Choose the audit scope (architecture, database, docs, integration)
3. **Review**: Get prioritized remediation plan
4. **Fix**: Address P0/P1 items first

### Changing the Database

1. **Read**: Start from DOC-021 (Physical Data Model) as the source of truth
2. **Generate**: Run `lumina-schema-migration` workflow
3. **Verify**: All IGS-v1 validations must pass before proceeding
4. **Document**: Update ADR if architecture is deviating from canonical

## CANONICAL DOCUMENTS

These documents are the source of truth. No workflow should modify them.

```
docs/00-canonical/
├── ARCHITECTURE-DECISION-CONSTITUTION.md  — Governance rules
├── CANONICAL-DOMAIN-MODEL.md               — 13 Aggregates, 58 invariants
├── CAPABILITY-DEPENDENCY-GRAPH.md          — Capability DAG
├── POSTGRESQL-SCHEMA-PACK-v1.md           — 32 tables physical model
├── SQL-DDL-SPECIFICATION-v1.md            — Complete DDL
├── CONSTRAINTS-INDEX-SPECIFICATION-v1.md  — All constraints + indexes
├── SCHEMA-VERIFICATION-REPORT-v1.md       — Schema validation report
├── IMPLEMENTATION-GENERATION-SPECIFICATION.md — Pipeline IGS-v1
├── DOC-021-PHYSICAL-DATA-MODEL.md         — Physical Objects catalog
├── DOC-023-CANONICAL-RELATIONAL-RULES.md  — 27 NeverBreak rules
└── migration-rls-pack/                    — Generated artifacts
    ├── MIGRATION-PACK-V1.md               — 35 versioned migrations
    ├── BOOTSTRAP-MIGRATION-SPECIFICATION-V1.md — Bootstrap scripts
    ├── RLS-POLICY-SPECIFICATION-V1.md     — RLS for 32 tables × 9 roles
    └── MIGRATION-RLS-VERIFICATION-REPORT-V1.md — 47 verification checks
```

## WORKFLOW EXECUTION RULES

1. **Sequential phases**: Each workflow has ordered phases; do not skip phases
2. **Validation gates**: If a phase outputs BLOCKED, stop — do not proceed
3. **Traceability required**: Every generated artifact must reference its canonical source
4. **NeverBreak compliance**: Any violation of NB-PERSIST or NB-RR rules is a hard stop
5. **Deterministic output**: Same canonical input → same output, always

## AVAILABLE SKILLS

The following skills enhance the workflow system:

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `impeccable` | Code quality review | Before merging any code |
| `frontend-design` | UI design guidance | Before any screen/component work |
| `dataviz` | Chart/graph creation | When creating visualizations |
| `superpowers:*` | AI agent superpowers (brainstorming, planning, TD, review) | See skill definitions |
| `bmad-*` | BMad methodology skills (PRD, spec, architecture, review) | When using product/methodology workflows |
| `lazyweb*` | Product UI research and design | Before any product/design work |
| `architecture-guardian` | Architecture drift detection | Before any architecture-level change |
| `architecture-reviewer` | Architectural consistency check | Periodically or before major releases |
| `consistency-auditor` | Concept-definition-behavior consistency | Before release |
| `documentation-governor` | Documentation intellectual coherence | Periodic maintenance |
| `glossary-manager` | Terminology governance | Before writing new docs |
| `knowledge-graph-builder` | Cross-document linkage maintenance | After doc changes |

## REVERSE ENGINEERING

The Reversa framework is installed for analyzing legacy code:
- Use `/reversa` to activate
- Reversa writes only to `.reversa/` and `_reversa_sdd/`
- NEVER overwrite existing legacy files

## PREMIUM REFERENCES

When building or designing screens, components, dashboards, landing pages, charts, heroes, or any product UI — reach for these 8 curated resources before writing from scratch. They provide premium components, real motion, custom visuals, and animations that make AI-built projects look like they were shipped by a senior dev.

### Premium Components
| # | Resource | URL | When to use |
|---|----------|-----|-------------|
| 1 | **KokonutUI** | <https://kokonutui.com> | Liquid-glass cards, action search bars, animated components you fully own. Drop in, tweak anything. Use when you want one hero component that instantly reads "expensive." |
| 2 | **Magic UI** | <https://magicui.design> | 150+ animated effects — Globe, Animated Beam, more — in one line. Use for "wow" sections: globe, connected-logos diagram, integration diagram without hand-coding WebGL. |
| 3 | **React Bits** | <https://reactbits.dev> | WebGL shader backgrounds (Silk, Iridescence) in JS or TS, CSS or Tailwind. Use when your hero looks flat and you need living-gradient depth. |

### Real Motion
| # | Resource | URL | When to use |
|---|----------|-----|-------------|
| 4 | **Anime.js** | <https://animejs.com> | 24kb API to animate text, SVG, layouts. Tasteful scroll and text animation without a heavy dependency. |
| 5 | **Motion** | <https://motion.dev> | Physics-based springs (not linear easing). Use when transitions feel robotic and you want natural, weighted movement. |
| 6 | **Rive** | <https://rive.app> | Interactive animations that react to the cursor in real time, up to 90% lighter than Lottie. Use when you want a hero that responds to the user and feels alive. |

### Custom Visuals
| # | Resource | URL | When to use |
|---|----------|-----|-------------|
| 7 | **Limora** | <https://limora.ai> | Generate heroes, icons, mockups, illustrations fully on-brand. Drop straight into Figma or Framer. Use when you need imagery matching your palette instead of generic stock or off-brand AI output. |
| 8 | **Bklit** | <https://bklit.com> | 17+ chart types built to be styled, not just plotted. Video export animates the chart to video. Use when your dashboard looks identical to every other AI app. |

**Workflow:** Before implementing any product screen, scan these references. If an effect/component pattern exists, copy-paste it (respecting licenses) rather than building from scratch. Never hand-code what already ships as a drop-in component.
