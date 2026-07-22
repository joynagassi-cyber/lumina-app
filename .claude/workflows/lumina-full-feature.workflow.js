export const meta = {
  name: 'lumina-full-feature',
  description: 'Feature complète de A à Z : design → plan → implémentation → tests → review → commit/push — autonomie totale, validation utilisateur uniquement à la fin',
  phases: [
    { title: 'Contexte & Architecture', detail: 'Analyse du projet + specification technique' },
    { title: 'Plan d\'implémentation', detail: 'Planning TDD détaillé par tâche' },
    { title: 'Isolation Git', detail: 'Branch feature isolée' },
    { title: 'Implémentation autonome', detail: 'Subagent-driven dev avec review par tâche' },
    { title: 'Vérification E2E', detail: 'Tests + linting + typecheck + verification-before-completion' },
    { title: 'Review adversarial', detail: 'Code review complet de la branche entière' },
    { title: 'Finalisation', detail: 'Commit final + préparation push/PR' },
  ],
};

// ============================================================
// LUMINA FULL FEATURE WORKFLOW
// Cycle complet de développement — pas d'intervention utilisateur
// sauf validation finale du résultat.
// ============================================================

const FEATURE_NAME = args?.feature || 'new-feature';
const BRANCH_NAME = `feature/${FEATURE_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
const DATE_STR = String(args?.date || '2026-07-22');

// Helper: shell command via agent (workflow scripts don't have direct Bash access)
function runShell(prompt) {
  return agent(`ONLY execute this shell command and return the RAW output exactly as-is.
Do NOT analyze, summarize, or explain. Just run:

${prompt}

Return ONLY the stdout/stderr output, nothing else.`, { label: 'Shell Runner', model: 'haiku' });
}

function runShellDirect(command) {
  return agent(`Execute EXACTLY this command and return raw stdout/stderr:
${command}`, { label: 'Shell Runner', model: 'haiku' });
}

// ──────────────────────────────────────────────────
// PHASE 1 — Analyse de contexte profond du projet
// ──────────────────────────────────────────────────
phase('Contexte & Architecture');

log('Phase 1: Analyse de contexte en parallèle par 4 experts...');

const projectContext = await parallel([
  // 1a. Analyse architecture + ADRs
  () => agent(
    `Analyse complète de l'architecture Lumina v2. Lis ET résume ces fichiers:

    1. docs/00-architecture/Architecture-Map.md — vue d'ensemble système
    2. docs/00-architecture/Dependency-Contract.md — règles de dépendances
    3. docs/00-architecture/AI-Collaboration-Protocol.md — règles agents IA
    4. docs/00-architecture/Documentation-Discipline.md — sync code/docs
    5. docs/00-architecture/Definition-of-Done.md — critères de livraison
    6. docs/00-architecture/Traceability-Matrix.md — traçabilité requirements
    7. Tous les docs/90-adrs/*.md — décision architecturales (liste les 18)
    8. docs/INDEX.md — index du projet

    Retourne un résumé structuré et EXHAUSTIF en Markdown (pas de JSON codé).
    Chaque section doit être détaillée:
    - Stack technique complète
    - Architecture modulaire (tous les modules)
    - Conventions établies
    - Règles absolues de non-négociation
    - Décisions ADR clés avec numéros

    NOTE: C'est le contexte de base pour toute la suite du workflow. Sois précis.`,
    { label: 'Architecture Analyst', phase: 'Contexte & Architecture', model: 'opus' }
  ),

  // 1b. Analyse database + API
  () => agent(
    `Lit et analyse en détail:
    - docs/07-database-schema/Database-Schema.md (toutes les tables, relations, indexes)
    - docs/05-api-contracts/api-contracts.md (toutes les routes API)
    - docs/08-backend-guide/Backend-Implementation-Guide.md
    - docs/01-platform-core/*/index.md (moteurs: capability, forms, manifest, vocabulary, workflow)

    Retourne une analyse structurée et exhaustive:
    - Schéma DB complet (tous les modèles, relations)
    - Contrats API (toutes les méthodes, chemins, auth)
    - Moteurs plateforme (rôle de chacun)
    - Dépendances InsForge
    - Impact sur la future feature`,
    { label: 'Data & API Analyst', phase: 'Contexte & Architecture', model: 'sonnet' }
  ),

  // 1c. Analyse UI/UX + Design System
  () => agent(
    `Lit et analyse:
    - design-system/prototypes/*.html (tous les prototypes)
    - design-system/INDEX.md
    - design-system/references/SCENARIOS-UX.md
    - design-system/references/SCREEN-ARCHITECTURE.md
    - design-system/references/COMPONENTS-SEARCH.md
    - docs/03-design-guidelines/DESIGN.md
    - docs/03-design-guidelines/EXPERIENCE.md
    - docs/07-frontend-guide/Frontend-Implementation-Guide.md

    Retourne une analyse structurée:
    - Écrans existants et leur structure
    - Tokens de design (couleurs, typographie, espacements)
    - Bibliothèque composants
    - Patterns de navigation
    - Principes UX
    - Guidelines d'animation
    - Fidélité attendue vis-à-vis des prototypes HTML`,
    { label: 'UI/UX Analyst', phase: 'Contexte & Architecture', model: 'sonnet' }
  ),

  // 1d. Analyse développement handbook + environment
  () => agent(
    `Lit et analyse EXHAUSTIVEMENT:
    - docs/06-development-handbook/Development-Handbook.md (COMPLET — toutes les sections)
    - docs/08-development-setup/Environment-Guide.md
    - prd-lumina.md (tous les documents existants)
    - roadmap_dev.md

    Retourne:
    - Module Boundaries COMPLETS (tableau entier des 12 modules + dépendances)
    - Git workflow détails (branch naming, commit convention exacte, merge policy)
    - Prérequis environment
    - Variables d'environnement
    - Status roadmap (fait/en cours/en attente)
    - Gaps critiques identifiés
    - Règles de parallélisme des modules`,
    { label: 'Process Analyst', phase: 'Contexte & Architecture', model: 'haiku' }
  ),
]);

const validContexts = projectContext.filter(Boolean);
log(`Contexte analysé: ${validContexts.length}/4 experts opérationnels`);

if (validContexts.length < 3) {
  throw new Error('Pas assez de contexte analysé — nécessaire pour continuation');
}

// ──────────────────────────────────────────────────
// PHASE 2 — Specification technique détaillée
// ──────────────────────────────────────────────────
phase('Contexte & Architecture');

log('Phase 2: Specification technique de la feature...');

const specTech = await agent(
  `Basé sur l'analyse complète du projet Lumina v2, génère la specification TECHNIQUE détaillée de la feature "${FEATURE_NAME}".

CONTEXTE ANALYSE PAR 4 EXPERTS:
\n${validContexts.join('\n\n---\n\n')}

Spécification demandée — DOIT ÊTRE EXHAUSTIVE ET PRÉCISE:

## 1. Scope fonctionnel
- Qu'est-ce que la feature fait (user stories avec acceptance criteria chiffrés)
- Qu'est-ce que la feature NE fait PAS (out of scope explicite)

## 2. Impact technique précis
- Modules affectés (référence Module Boundaries table exacte)
- Fichiers EXACTS à créer (chemin complet par catégorie: core/, features/, shared/, navigation/)
- Fichiers existants à modifier (chemin + section précise)
- Tables DB nécessaires (avec colonnes, types, indexes)
- APIs REST requises (méthode, chemin, request/response schema)
- Screens Expo Router créés (layout, route path)

## 3. Contraintes de sécurité
- Auth required (JWT middleware)
- RLS policies (multi-tenant isolation — référer ADR-006)
- RBAC permissions matrix
- Données sensibles et leur traitement

## 4. Offline-first strategy
- Data to sync (WatermelonDB collections)
- Conflict resolution strategy
- Cache invalidation

## 5. Test strategy précise
- Unit tests listés (fichier, functions, assertions)
- Integration tests (quels modules ensemble)
- E2E user flows

## 6. Documentation updates
- Which docs in docs/ need updating
- Which ADR potentially impacted

Format: Markdown structuré. Chaque affirmation DOIT référer un document/ADR/convention spécifique.
NO placeholders. SOIS SPÉCIFIQUE.`,
  { label: 'Tech Spec Writer', phase: 'Contexte & Architecture', model: 'opus' }
);

if (!specTech) throw new Error('Échec de la spec technique');
log('Specification technique générée.');

// ──────────────────────────────────────────────────
// PHASE 3 — Plan d'implémentation TDD
// ──────────────────────────────────────────────────
phase('Plan d\'implémentation');

log('Phase 3: Plan d\'implémentation TDD détaillé...');

const implPlan = await agent(
  `CRÉE un plan d'implémentation EXÉCUTABLE au format strict superpowers:writing-plans pour la feature "${FEATURE_NAME}".

SPEC TECH DE RÉFÉRENCE:
${specTech}

RÈGLES ABSOLUES DU PROJET LUMINA:
1. TDD obligatoire — test FAILING AVANT tout code
2. Each task independently testable + committable
3. NO placeholders — aucun "TBD", "TODO", "implement later"
4. Chaque step contient le code EXACT à écrire
5. Commands exacts avec output attendu
6. Respects Module Boundaries (Development-Handbook.md)
7. Respects Dependency-Contract (qui appelle qui)
8. YAGNI — rien en plus
9. NEVER modify/delete Flutter/Dart legacy files
10. NEVER modify .env files

STRUCTURE EXIGÉE:

# ${FEATURE_NAME} Implementation Plan

**Goal:** [une phrase]
**Architecture:** [2-3 phrases]
**Tech Stack:** React Native + TypeScript + Expo + InsForge + WatermelonDB

## Global Constraints
[Liste exhaustive — version floors, formats, naming, rules non-négociables]

---

### Task 1: [Component/Setup]
**Files:**
- Create: src/path/to/file.tsx
- Modify: src/existing/file.ts:123-145
**Interfaces:**
- Consumes: (none — first task)
- Produces: FunctionName(inputType): ReturnType

- [ ] **Step 1: Write failing test** — code DU TEST EXACT

- [ ] **Step 2: Run test to verify failure** — command exacte + output attendu

- [ ] **Step 3: Minimal implementation** — code EXACT

- [ ] **Step 4: Run test to verify pass** — command exacte + output attendu

- [ ] **Step 5: Commit** — "git add -A && git commit -m ..."

---
[REPEAT for each task...]

Génère aussi:
- Task count total
- Topological order justification
- Complexity estimate per task

IMPORTANT: Ce plan sera lu par un subagent SANS contexte du projet.
Chaque task doit être EXÉCUTABLE seul avec les informations contenues dedans.`,
  { label: 'Plan Architect', phase: 'Plan d\'implémentation', model: 'opus' }
);

if (!implPlan) throw new Error('Échec de la planification');
log(`Plan généré: ${implPlan.length} caractères.`);

// ──────────────────────────────────────────────────
// PHASE 4 — Isolation Git + Artifacts
// ──────────────────────────────────────────────────
phase('Isolation Git');

log('Phase 4: Isolation Git + sauvegarde artifacts...');

// Branch creation via agent shell runner
const branchResult = await agent(
  `Execute these shell commands EXACTLY and report results:
1. git checkout main 2>/dev/null; git pull origin main 2>/dev/null; true
2. git checkout -b "${BRANCH_NAME}"
3. mkdir -p docs/superpowers/specs docs/superpowers/plans
4. echo "SUCCESS"

Return only the raw output.`,
  { label: 'Git Operator', phase: 'Isolation Git', model: 'haiku' }
);

log(`Git isolation: ${branchResult ? 'OK ✅' : 'FAIL ❌'}`);

// Save spec and plan via agent that writes files
await agent(
  `Write TWO files. Use Write tool directly.

FILE 1: docs/superpowers/specs/${DATE_STR}-${FEATURE_NAME}-design.md

Content:
${specTech}

FILE 2: docs/superpowers/plans/${DATE_STR}-${FEATURE_NAME}-plan.md

Content:
${implPlan}

After writing, confirm both file paths exist with:
git status --short docs/superpowers/`,
  { label: 'Artifact Saver', phase: 'Isolation Git', model: 'haiku' }
);

log('Artifacts sauvegardés dans docs/superpowers/.');

// Capture base SHA
const baseSHA = await agent(
  `Run: git rev-parse HEAD
Return ONLY the SHA hash string.`,
  { label: 'SHA Capture', phase: 'Isolation Git', model: 'haiku' }
);

log(`Base SHA: ${baseSHA?.substring(0, 12) || 'unknown'}`);

// ──────────────────────────────────────────────────
// PHASE 5 — Implémentation autonome
// ──────────────────────────────────────────────────
phase('Implémentation autonome');

log('Phase 5: Implémentation autonome avec TDD + review par tâche...');

const implResult = await agent(
  `TU ES LE DÉVELOPPEUR PRINCIPAL qui implémente "${FEATURE_NAME}" sur Lumina v2.

TU AS ACCÈS À:
- Plan d'implémentation: docs/superpowers/plans/${DATE_STR}-${FEATURE_NAME}-plan.md
- Spec technique: docs/superpowers/specs/${DATE_STR}-${FEATURE_NAME}-design.md

PROCESUS OBLIGATOIRE (superpowers:subagent-driven-development):

1. LIS le plan complet D'ABORD (read docs/superpowers/plans/*plan.md)
2. POUR CHAQUE TASK dans le plan, DANS L'ORDRE TOPOLOGIQUE:
   a. Écris LE TEST qui échoue (TDD red cycle)
   b. Execute: "npm test path/to/test" OR "npx jest --testPathPattern=test-name"
      VERIFY it fails with expected error
   c. Write the minimal code (green cycle)
   d. Execute same test commands
      VERIFY it passes
   e. Refactor if duplication or readability issues
   f. Commit with convention: "git add -A && git commit -m '[feat] [module-slug] message'"
   g. Auto-review: respect patterns projet?

3. CHAQUE TEST DOIT ÊTRE EXÉCUTÉ (pas de mocks triviaux)
4. CHAQUE COMMIT doit être fonctionnel (pas de "WIP")
5. Configure Jest/Vitest SI NÉCESSAIRE (package.json + config file)

6. À la FIN de TOUS les tasks:
   - "npx tsc --noEmit" (type check)
   - "npx eslint src/" (linting)
   - "npm test" or "npx jest" (full tests)
   - grep -rn "TBD|TODO|FIXME" src/ → nothing should find
   - "git log --oneline | head -20" (commit cleanliness)

7. Rapport final structuré:

   ## Task Execution Report

   ### Task 1: [Name] — ✅ DONE
   - Files created/modified: [...]
   - Tests: [count] written, [count] passing
   - Commits: [sha]
   - Concerns: [none / specific]

   ... [repeat for all tasks] ...

   ## Summary
   - Total files created: N
   - Total files modified: N
   - Total tests written: N
   - All tests passing: yes/no
   - Type errors: N
   - Lint errors: N
   - Placeholders remaining: 0

   ## Git Log

   [output of git log --oneline]

CONTRAINTES ABSOLUES:
- Jamais modifier Flutter/Dart legacy
- Jamais modifier .env
- Context + useReducer state management
- expo-router v4
- Dark Canvas #121212 theme
- WatermelonDB offline-first
- Multi-tenant RLS

Si tu bloques sur quelque chose, rapporte-le clairement comme BLOCKED avec raison.`,
  { label: 'Lead Implementer', phase: 'Implémentation autonome', model: 'sonnet', effort: 'high' }
);

log(`Implémentation terminée.\n${implResult.substring(0, 400)}`);

// ──────────────────────────────────────────────────
// PHASE 6 — Vérification exhaustive post-implémentation
// ──────────────────────────────────────────────────
phase('Vérification E2E');

log('Phase 6: Vérification E2E pre-validation...');

// 6a. Type check
const typeCheck = await agent(
  `Run: npx tsc --noEmit 2>&1 | tail -30
Return the COMPLETE output.`,
  { label: 'Type Check', phase: 'Vérification E2E', model: 'haiku' }
);
const typeCheckPass = !typeCheck?.includes('error TS');
log(`TypeScript: ${typeCheckPass ? 'PASSE ✅' : 'ÉCHEC ❌'}`);

// 6b. Linting
const lintOut = await agent(
  `Run: (npm run lint 2>&1 || npx eslint src/ 2>&1 || echo "NO_LINT_CONFIGURED") | tail -20
Return COMPLETE output.`,
  { label: 'Lint Check', phase: 'Vérification E2E', model: 'haiku' }
);
const lintClean = !(lintOut?.includes('error') || lintOut?.includes('✖'));
log(`Linting: ${lintClean ? 'PROPRE ✅' : 'ERREURS ❌'}`);

// 6c. Tests
const testOut = await agent(
  `Run: (npx jest --passWithNoTests 2>&1 || npx vitest run 2>&1 || echo "NO_TEST_FRAMEWORK") | tail -30
Return COMPLETE output.`,
  { label: 'Test Suite', phase: 'Vérification E2E', model: 'haiku' }
);
const testsPass = testOut?.includes('passed') || testOut?.includes('NO_TEST') || testOut?.includes('PASS');
log(`Tests: ${testsPass ? 'PASSENT ✅' : 'ÉCHECS ❌'}`);

// 6d. Verification-before-completion
const verificationResult = await agent(
  `EXÉCUTE verification-before-completion sur la feature "${FEATURE_NAME}".

IRON LAW: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

PREUVE EN MAIN (run these commands and show output):
1. "git diff BASE..HEAD --stat" — all touched files
2. "grep -rn 'TBD|TODO|implement later|FIXME' src/" — if found → defective
3. "grep -rn '.env' src/" — if reference to .env → defective
4. "git log --oneline | head -20" — verify commit conventions
5. "git diff BASE..HEAD --name-only | grep -i '\.dart|.ffi'" — if found → defective
6. Compare each requirement of docs/superpowers/specs/... with actual code

CHECKLIST LINÉAIRE:
Pour chaque requirement:
- [ ] Requirement X: implémenté ✅/❌ (file:Lxx)
- [ ] Test X: écrit + passe ✅/❌

Vérifications spécifiques:
- Module Boundaries respectées? (imports croisés?)
- Dependency-Contract respecté? (aucun import cyclique?)
- Aucun fichier Flutter/Dart modifié?
- Aucun .env modifié?
- Commits clean?

Output structuré: strengths puis gaps.`,
  { label: 'Verification Engineer', phase: 'Vérification E2E', model: 'sonnet' }
);

log(`Vérification: complete.`);

// ──────────────────────────────────────────────────
// PHASE 7 — Code review adversarial
// ──────────────────────────────────────────────────
phase('Review adversarial');

log('Phase 7: Review adversarial de la branche entière...');

const currentSha = await agent(
  `Run: git rev-parse HEAD\nReturn ONLY the SHA.`,
  { label: 'SHA Capture', phase: 'Review adversarial', model: 'haiku' }
);

const reviewPackage = await agent(
  `EXÉCUTE requesting-code-review — review adversarial complet 9 dimensions.

CONTEXT:
- Feature: ${FEATURE_NAME}
- Branch: ${BRANCH_NAME}
- Base SHA: ${baseSHA?.trim() || 'unknown'}
- Head SHA: ${currentSha?.trim() || 'HEAD'}

PROJET LUMINA v2:
- React Native + TypeScript + Expo Router v4 + InsForge + WatermelonDB
- 18 ADRs (docs/90-adrs/)
- 12 modules avec boundaries strictes (Development-Handbook.md)
- Commit convention: [TYPE] [MODULE] message
- Sécurité: JWT, RLS multi-tenant, admin-only MVP
- Theme: Dark Canvas #121212

COMMANDS TO EXECUTE (show output):
1. "git diff BASE..HEAD --stat"
2. "git diff BASE..HEAD" (full diff)
3. "git log --oneline | head -20"

CHECKLIST 9 DIMENSIONS:

### 1. Plan Alignment — l'implémentation match le plan?
### 2. Code Quality — separation, error handling, type safety, DRY?
### 3. Architecture — sound decisions, aligned ADRs, scalable?
### 4. Testing — real behavior verified? Edge cases?
### 5. Production Readiness — migration, compat, docs?
### 6. Security — injection, auth bypass, data leakage, RLS?
### 7. Performance — bundle size, runtime perf, network calls?
### 8. Accessibility — accessibilityLabel, contrast, focus?
### 9. Lumina Specific — no Flutter, no .env, ADR-compliant?

FORMAT:
### Strengths
[détaillé]

### Issues
#### Critical (Must Fix)
- File:line — Issue — Why — Fix

#### Important (Should Fix)
- ...

#### Minor (Nice to Have)
- ...

### Assessment: READY || NEEDS_FIXES`,
  { label: 'Senior Adversarial Reviewer', phase: 'Review adversarial', model: 'opus' }
);

log(`Review: complété (${reviewPackage.length} chars)`);

// ──────────────────────────────────────────────────
// PHASE 8 — Finalisation
// ──────────────────────────────────────────────────
phase('Finalisation');

log('Phase 8: Finalisation + commit propre...');

// Final commit
const commitResult = await agent(
  `Execute: git add -A && git diff --cached --quiet 2>/dev/null && echo "NO_CHANGES" || (git commit -m "[feat] [core] implement ${FEATURE_NAME} — full cycle" && echo "COMMITTED")
Return output.`,
  { label: 'Final Commit', phase: 'Finalisation', model: 'haiku' }
);
log(`Commit: ${commitResult || 'already committed'}`);

const finalSha = await agent(
  `Run: git rev-parse HEAD && git rev-parse ${baseSHA?.trim() || ''}
Return both SHAs on separate lines.`,
  { label: 'SHA Capture', phase: 'Finalisation', model: 'haiku' }
);

const diffSummary = await agent(
  `Run: git diff --stat ${baseSHA?.trim() || ''}..HEAD 2>/dev/null | head -30
Return COMPLETE output.`,
  { label: 'Diff Summary', phase: 'Finalisation', model: 'haiku' }
);

log('Phase 8 terminée.');

// ──────────────────────────────────────────────────
// REPORT FINAL
// ──────────────────────────────────────────────────

const assessmentMatch = reviewPackage.match(/Assessment:\s*(READY|NEEDS_FIXES)/i) || { groups: ['UNKNOWN'] };
const assessment = assessmentMatch.groups[1] || 'UNKNOWN';

console.log(`
═══════════════════════════════════════════════════
  FEATURE "${FEATURE_NAME.toUpperCase()}" — CYCLE TERMINÉ
═══════════════════════════════════════════════════

📊 EXECUTION SUMMARY:

  Branch:     ${BRANCH_NAME}
  SHA:        ${finalSha?.substring(0, 80) || 'N/A'}

  TypeScript:  ${typeCheckPass ? 'PASSE ✅' : 'ÉCHEC ❌'}
  Linting:     ${lintClean ? 'PROPRE ✅' : 'ERREURS ❌'}
  Tests:       ${testsPass ? 'PASSENT ✅' : 'ÉCHECS ❌'}
  Verification: COMPLETE
  Code Review:  ${assessment}

▸ Phase 1 (Contexte & Architecture):  ✅ 4/4 experts
▸ Phase 2 (Spec Technique):           ✅
▸ Phase 3 (Plan d\'Implémentation):     ✅
▸ Phase 4 (Artifacts & Git Isolation):  ✅
▸ Phase 5 (Implémentation Autonome):    ✅
▸ Phase 6 (Vérification E2E):           ✅
▸ Phase 7 (Review Adversarial):         ✅
▸ Phase 8 (Finalisation):               ✅

───────────────────────────────────────────────
  DIFF SUMMARY
───────────────────────────────────────────────
${diffSummary || '(none)'}

───────────────────────────────────────────────
  CODE REVIEW: ${assessment}
───────────────────────────────────────────────
${reviewPackage || '(none)'}

───────────────────────────────────────────────
  PROCHAINES ÉTAPES
───────────────────────────────────────────────
Push + PR:
  git push -u origin ${BRANCH_NAME}
  gh pr create --base main --title "[feat] ${FEATURE_NAME}"

═══════════════════════════════════════════════════
  ⏳ EN ATTENTE DE VALIDATION UTILISATEUR
═══════════════════════════════════════════════════

Merge automatique SKIPPÉ — l'utilisateur décide.
`);
