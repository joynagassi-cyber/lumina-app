export const meta = {
  name: 'lumina-sprint-plan',
  description: 'Planifie ET exécute les 12 sprints de Lumina v2 — chaque sprint est documenté dans un fichier, exécuté un par un, avec validation DoD à la fin',
  phases: [
    { title: 'Sprint planning', detail: 'Spécification de CHAQUE sprint dans des fichiers séparés' },
    { title: 'Sprint execution', detail: 'Exécution sprint par sprint avec commit/branch/PR' },
    { title: 'Stabilisation', detail: 'Tests E2E, lint, build, verification' },
    { title: 'Review final', detail: 'Code review + validation DoD' },
    { title: 'Livraison', detail: 'Commit, push, PR, tag release' },
  ],
};

// ============================================================
// LUMINA SPRINT PLAN WORKFLOW
// Génère un fichier spec par sprint, puis les exécute séquentiellement.
// L'agent décide RIEN — il lit un fichier de specs et suit les instructions.
// ============================================================

const FEATURE_NAME = args?.feature || 'lumina-v2-complete';
const GITHUB_REPO = args?.repo || 'lumina-app';

// ──────────────────────────────────────────────────
// PHASE 1 — Specification de TOUS les sprints
// ──────────────────────────────────────────────────
phase('Sprint planning');

log('Phase 1: Génération des specs de tous les sprints...');

const sprintPlanSpecs = await agent(
  `EXÉCUTE cette tâche EXACTEMENT: lis TOUTES les specs Lumina v2 puis écris UN FICHIER PAR SPRINT contenant les instructions EXACTES à suivre pour construire la feature.

LIS D'ABORD tous ces fichiers (en entier):
- prd-lumina.md
- roadmap_dev.md
- docs/INDEX.md
- docs/00-architecture/Architecture-Map.md
- docs/00-architecture/Dependency-Contract.md
- docs/00-architecture/AI-Collaboration-Protocol.md
- docs/00-architecture/Documentation-Discipline.md
- docs/00-architecture/Definition-of-Done.md
- docs/00-architecture/Traceability-Matrix.md
- docs/01-platform-core/*/index.md
- docs/02-offline-first/index.md
- docs/03-design-guidelines/DESIGN.md
- docs/03-design-guidelines/EXPERIENCE.md
- docs/04-business-rules/financial-rules.md
- docs/04-business-rules/membership-rules.md
- docs/05-api-contracts/api-contracts.md
- docs/06-development-handbook/Development-Handbook.md
- docs/07-database-schema/Database-Schema.md
- docs/07-frontend-guide/Frontend-Implementation-Guide.md
- docs/08-backend-guide/Backend-Implementation-Guide.md
- docs/08-development-setup/Environment-Guide.md
- docs/09-testing-strategy/Testing-Strategy.md
- docs/90-adrs/ADR-001.md through ADR-015.md
- docs/99-supporting/invariants.md
- docs/99-supporting/neverbreak.md
- design-system/INDEX.md
- design-system/references/*.md
- design-system/prototypes/*.html

ENSUITE, ECOLE UN FICHIER PAR SPRINT avec Write tool. Chaque fichier contient LES INSTRUCTIONS EXACTES et LE CONTENU DES FICHIERS À CRÉER.

### Fichier 1: docs/superpowers/plans/SPRINT-0-initialization.plan.md

Sprint plan format:
- Sprint title and objective
- Commands to execute (exact shell commands)
- Files to create (full paths with COMPLETE content for EACH file)
- Tests to write
- Documentation to update
- DoD Checklist (C01-Q04, T01-T04, D01-D04 applied to this sprint)

### Fichier 2: docs/superpowers/plans/SPRINT-1-platform-core-motors.plan.md

Même format mais pour le Sprint 1 (5 moteurs Platform Core).

### Fichier 3: docs/superpowers/plans/SPRINT-2-auth-network-storage-sync.plan.md

Sprint 2 (Auth, Network, Storage, Sync Engine).

### Fichier 4: docs/superpowers/plans/SPRINT-3-database-models.plan.md

Sprint 3 (WatermelonDB models + PostgreSQL migrations).

### Fichier 5: docs/superpowers/plans/SPRINT-4-store-navigation-components.plan.md

Sprint 4 (Store, Navigation Expo Router, Shared Components).

### Fichier 6: docs/superpowers/plans/SPRINT-5-finance-module.plan.md

Sprint 5 (Finance K1 — Finance First, >90% coverage).

### Fichier 7: docs/superpowers/plans/SPRINT-6-members-module.plan.md

Sprint 6 (Members K2).

### Fichier 8: docs/superpowers/plans/SPRINT-7-groups-events-celebrations.plan.md

Sprint 7 (Groups + Events + Celebrations K2).

### Fichier 9: docs/superpowers/plans/SPRINT-8-dashboard-settings-social.plan.md

Sprint 8 (Dashboard + Settings + Social K3).

### Fichier 10: docs/superpowers/plans/SPRINT-9-offline-sync-e2e.plan.md

Sprint 9 (Offline-First + Sync E2E + test flows).

### Fichier 11: docs/superpowers/plans/SPRINT-10-stabilization.plan.md

Sprint 10 (Lint pass, typecheck, coverage thresholds, invariant tests, NB-RULE checks, doc sync).

### Fichier 12: docs/superpowers/plans/SPRINT-11-production-ready.plan.md

Sprint 11 (Build Expo, CI/CD pipeline, EAS, .env.example, release notes, final PR).

POUR CHAQUE FICHIER DE SPRINT:
- Liste EXHAUSTIVE des fichiers à créer (chemin + CONTENU COMPLET)
- Commandes shell EXACTES
- Tests à écrire avec code complet
- Documentation à mettre à jour
- DoD checklist spécifique

IMPORTANT: Le contenu de chaque fichier doit être AUTO-SUFFISANT.
L'agent qui exécutera ce sprint NE DECIDE RIEN — il copie-colle et exécute.
NE METS PAS de placeholders. Chaque fichier doit être exécutable tel quel.`,
  { label: 'Sprint Spec Writer', phase: 'Sprint planning', model: 'opus' }
);

log(`Sprint specs: ${sprintPlanSpecs?.length || 0} caractères générés.`);

// ──────────────────────────────────────────────────
// PHASE 2 — Exécution sprint par sprint
// ──────────────────────────────────────────────────
phase('Sprint execution');

log('Phase 2: Exécution des sprints...');

// Lancement du repo GitHub
await agent(
  `Initialize project if not already initialized:
1. git status — vérifier si git init existe
2. git remote get-url origin — vérifier si remote existe
3. Si non initialisé: git init; gh repo create ${GITHUB_REPO} --public --source=. --push`,
  { label: 'Repo Init', phase: 'Sprint execution', model: 'haiku' }
);

const sprintFiles = [
  'docs/superpowers/plans/SPRINT-0-initialization.plan.md',
  'docs/superpowers/plans/SPRINT-1-platform-core-motors.plan.md',
  'docs/superpowers/plans/SPRINT-2-auth-network-storage-sync.plan.md',
  'docs/superpowers/plans/SPRINT-3-database-models.plan.md',
  'docs/superpowers/plans/SPRINT-4-store-navigation-components.plan.md',
  'docs/superpowers/plans/SPRINT-5-finance-module.plan.md',
  'docs/superpowers/plans/SPRINT-6-members-module.plan.md',
  'docs/superpowers/plans/SPRINT-7-groups-events-celebrations.plan.md',
  'docs/superpowers/plans/SPRINT-8-dashboard-settings-social.plan.md',
  'docs/superpowers/plans/SPRINT-9-offline-sync-e2e.plan.md',
  'docs/superpowers/plans/SPRINT-10-stabilization.plan.md',
  'docs/superpowers/plans/SPRINT-11-production-ready.plan.md',
];

for (let i = 0; i < sprintFiles.length; i++) {
  const sprintFile = sprintFiles[i];
  log(`--- Exécution ${sprintFile} ---`);

  const sprintResult = await agent(
    `EXECUTE this sprint file EXACTLY as written. Do NOT decide anything.

Read the sprint plan first:
READ FILE: ${sprintFile}

Then follow EVERY instruction in order:
1. For each command in the plan → execute it
2. For each file creation → use Write tool with exact content from plan
3. For each test → write it AND run it
4. For documentation updates → read, modify if needed, write back
5. At the END of this sprint:
   - git add -A
   - git commit -m "[sprint-${i}] $(head -1 ${sprintFile})"
   - Verify DoD checklist items are met
   - Report results

Return a structured report:
- Files created: [list]
- Commands executed: [list with results]
- Tests: N passed, N failed
- DoD status: PASS / FAIL (with details)
- Commit SHA: [sha]
- Concerns: [none or specific]

If ANY command fails, REPORT THE ERROR but continue to next instruction.`,
    { label: `Sprint ${i} Executor (${sprintFile.split('/').pop()})`, phase: 'Sprint execution', model: 'sonnet', effort: 'high' }
  );

  log(`${sprintFile}: ${sprintResult?.substring(0, 200) || 'exécuté'}`);
}

// ──────────────────────────────────────────────────
// PHASE 3 — Stabilisation
// ──────────────────────────────────────────────────
phase('Stabilisation');

log('Phase 3: Stabilisation — lint, typecheck, coverage, invariants...');

const stabilization = await agent(
  `Run full stabilization on the Lumina v2 project.

STEPS TO EXECUTE:

1. npx tsc --noEmit 2>&1 | tail -30
   → Fix type errors WITHOUT changing logic
   → Report before/after error counts

2. npx eslint src/ --fix 2>&1 | tail -30
   → Verify NB-RULE-07: grep -rn ": any" src/ should find nothing
   → Verify NB-RULE-10: no hardcoded URLs

3. npm test -- --coverage 2>&1 | tail -50
   → Check thresholds: finance>=90%, auth>=90%, sync>=90%, members>=80%, groups>=80%, events>=70%, celeb>=70%, dashboard>=60%, social>=70%, settings>=80%
   → If below threshold, ADD MORE TESTS

4. Run invariant checks:
   - grep -rn "if.*type.*===.*church" src/ — should be empty
   - grep -rn "\.approved" src/features/finance/ — check immutability guard exists
   - grep -rn "org_id" src/core/network/ — verify injection middleware
   - grep -rn "\/src\/shared\/utils" src/features/ — verify no hardcoded paths

5. Update docs:
   - docs/INDEX.md (ensure all modules listed)
   - docs/99-supporting/glossary.md (ensure new terms added)
   - docs/00-architecture/Traceability-Matrix.md (update if needed)

Report:
- TypeScript errors: N → N
- Lint errors: N → N
- Coverage by module: [table]
- Invariant violations: N
- Docs updated: [list]`,
  { label: 'Stabilization Engineer', phase: 'Stabilisation', model: 'sonnet' }
);

log(`Stabilisation: complete.`);

// ──────────────────────────────────────────────────
// PHASE 4 — Review final
// ──────────────────────────────────────────────────
phase('Review final');

log('Phase 4: Review final adversarial...');

const finalReview = await agent(
  `Run final adversarial review of Lumina v2 project.

Execute and show output for:
1. git diff --stat HEAD~$(git rev-list --count HEAD)..HEAD | head -30
2. git log --oneline | head -20
3. ls -la src/features/
4. ls -la src/core/
5. ls -la docs/

CHECKLIST (show PASS/FAIL with evidence for each):
- All 10 MVP features implemented?
- Dependency-Contract respected? (no cycles)
- INV-001 to INV-010 verified?
- NB-RULE-01 to NB-RULE-10 passed?
- All coverage thresholds met?
- All E2E test flows present?
- Docs < 400 lines each?
- No Flutter/Dart files modified?
- No .env files committed?
- i18n FR+EN present?
- Dark Canvas theme #121212 used?
- WatermelonDB configured correctly?
- RLS policies defined?

Format:
### Assessment: PRODUCTION READY / NEEDS WORK / BLOCKED
- Strengths: [...]
- Critical issues: [...]
- Important issues: [...]
- Minor issues: [...]`,
  { label: 'Final Reviewer', phase: 'Review final', model: 'opus' }
);

// ──────────────────────────────────────────────────
// PHASE 5 — Livraison
// ──────────────────────────────────────────────────
phase('Livraison');

log('Phase 5: Livraison finale...');

const delivery = await agent(
  `Complete final delivery:

1. git add -A && git diff --cached --quiet 2>/dev/null && echo "NO_CHANGES" || git commit -m "[release] Lumina v2 complete — all sprints delivered"

2. git push -u origin main 2>/dev/null || echo "REMOTE_SETUP_NEEDED"

3. gh pr create --base main --title "[release] Lumina v2 complete" --body "# Lumina v2 — Complete Application

## Summary
- 12 sprints executed (0-11)
- Platform Core: 5 engines
- Auth, Network, Storage, Sync: complete
- Features: Finance, Members, Groups, Events, Celebrations, Dashboard, Settings, Social
- Offline-first with WatermelonDB
- Tests with coverage thresholds
- Documentation complete
- CI/CD configured"

4. git tag v2.0.0-mvp && git push origin v2.0.0-mvp

Return PR URL, commit SHA, tag name, and status of each step.`,
  { label: 'Delivery Engineer', phase: 'Livraison', model: 'sonnet' }
);

console.log(`
═══════════════════════════════════════════════════
  LUMINA v2 — SPRINT PLAN WORKFLOW TERMINÉ
═══════════════════════════════════════════════════

📊 RESUME:

  Repo:       ${GITHUB_REPO}
  Sprints:    12 (0-11)

▸ Phase 1 (Sprint planning):     ✅
▸ Phase 2 (Sprint execution x12): ✅
▸ Phase 3 (Stabilisation):         ✅
▸ Phase 4 (Review final):          ✅
▸ Phase 5 (Livraison):             ✅

───────────────────────────────────────────────
  STABILISATION
───────────────────────────────────────────────
${stabilization || '(none)'}

───────────────────────────────────────────────
  REVIEW FINAL
───────────────────────────────────────────────
${finalReview || '(none)'}

───────────────────────────────────────────────
  LIVRAISON
───────────────────────────────────────────────
${delivery || '(none)'}

═══════════════════════════════════════════════════
  ⏳ EN ATTENTE DE VALIDATION UTILISATEUR
═══════════════════════════════════════════════════

Le projet Lumina v2 complet est construit.
Merge automatique SKIPPÉ — l'utilisateur décide.
`);
