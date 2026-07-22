# Workflow Lumina Full Feature — Documentation

Ce document décrit le workflow multi-agent "de A à Z" pour développer une feature complète sur Lumina v2 sans intervention utilisateur (sauf validation finale).

## Architecture du Workflow

```
┌─────────────────────────────────────────────────┐
│  USER: "implement feature X"                     │
│         (only intervenes at start & end)         │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  PHASE 1: Contexte & Architecture                │
│  Skills: 4 experts en PARALLÈLE                  │
│  ├── Arch Analyst (opus)     → ADRs + Modules   │
│  ├── Data/API Analyst (sonnet) → DB + REST      │
│  ├── UI/UX Analyst (sonnet)   → Design System   │
│  └── Process Analyst (haiku)  → Handbook + Env  │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  PHASE 2: Spec Technique                         │
│  Skill: Tech Spec Writer (opus)                  │
│  → Génère spec détaillée + tests strategy        │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  PHASE 3: Plan d'Implémentation                  │
│  Skill: Plan Architect (opus)                    │
│  → TDD plan bite-sized tasks + no placeholders   │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  PHASE 4: Isolation Git                          │
│  Bash: worktree branch creation                  │
│  Save specs + plans to docs/superpowers/         │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  PHASE 5: Implémentation Autonome               │
│  Skill: Lead Implementer (sonnet/high effort)    │
│  → Exécute chaque task du plan:                  │
│     a. Test FAILING (TDD red)                   │
│     b. Run → verify fails                       │
│     c. Minimal code (green)                     │
│     d. Run → verify passes                      │
│     e. Commit [TYPE] [module] message            │
│  → Linting + typecheck + test run final          │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  PHASE 6: Vérification E2E                       │
│  Skills: Verification Engineer (sonnet)          │
│  ├── tsc --noEmit                                │
│  ├── eslint / npm run lint                       │
│  ├── jest/vitest complete suite                   │
│  └── manual checklist (placeholder scan, etc.)   │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  PHASE 7: Review Adversarial                     │
│  Skill: Senior Adversarial Reviewer (opus)       │
│  → 9 dimensions de review:                       │
│     Plan alignment, Code quality, Architecture,  │
│     Testing, Production readiness, Security,     │
│     Performance, Accessibility, Lumina-specific  │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  PHASE 8: Finalisation                           │
│  ├── Fix subagents if NEEDS_FIXES               │
│  ├── Clean commit                                │
│  └── Git diff summary                            │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│  REPORT FINAL → USER VALIDATION                  │
│  ├── Summary exécution avec stats                 │
│  ├── Code review assessment                     │
│  ├── Diff statistics                              │
│  └── PROCHAINES ETAPES: push + PR commands      │
│  (Merge automatique SKIPPÉ)                      │
└─────────────────────────────────────────────────┘
```

## Skills Superpowers Utilisées

| Skill | Phase | Rôle |
|-------|-------|------|
| **superpowers:brainstorming** | Phase 1-2 | Analyse contexte + design collaboratif |
| **superpowers:writing-plans** | Phase 3 | Plan TDD détaillé bite-sized tasks |
| **superpowers:test-driven-development** | Phase 5 | Red-green-refactor cycle par task |
| **superpowers:subagent-driven-development** | Phase 5 | Dispatch fresh implementer + task review |
| **superpowers:verification-before-completion** | Phase 6 | Iron Law: evidence before claims |
| **superpowers:requesting-code-review** | Phase 7 | Review adversarial post-implémentation |
| **superpowers:receiving-code-review** | Phase 7 | Traitement feedback reviewer |
| **superpowers:finishing-a-development-branch** | Phase 8 | Merge/push/PR options |
| **superpowers:using-git-worktrees** | Phase 4 | Workspace isolé |
| **superpowers:dispatching-parallel-agents** | Phase 1 | 4 experts en parallèle |
| **superpowers:systematic-debugging** | Phase 5-6 | Debug si implémentation bloque |

## Comment Utiliser

```bash
# Lancer le workflow pour une feature donnée
Workflow(args: { feature: "finance-ledger" })
```

Le workflow:
1. Analyse tout le contexte du projet
2. Génère spec technique + plan d'implémentation
3. Crée une branche isolée
4. Implémente AUTONOMEMENT (tests + code + commits)
5. Vérifie (typecheck + lint + tests + security check)
6. Review adversarial complet
7. Présente un rapport à l'utilisateur pour validation

L'utilisateur n'intervient QUE:
- Au début: donne le nom de la feature
- À la fin: valide le résultat ou demande des corrections

## Intégration avec les Règles Lumina

Le workflow intègre TOUTES les règles du projet:
- ✅ Reversa rule (jamais modifier Flutter legacy)
- ✅ Documentation-Discipline.md (sync code/docs)
- ✅ Dependency-Contract (qui appelle qui)
- ✅ Module Boundaries (Development-Handbook.md)
- ✅ Commit conventions ([TYPE] [MODULE])
- ✅ Stack technique (ADR-005)
- ✅ Offline-first (ADR-003)
- ✅ Multi-tenant RLS (ADR-006)
- ✅ Theme Dark Canvas (ADR-011)
- ✅ State management Context+useReducer (ADR-013)
- ✅ Expo Router v4 (ADR-012)
- ✅ Finance immutability (ADR-004)
