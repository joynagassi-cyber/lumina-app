# Definition of Done — Critères Objectifs de Terminaison

**Doc ID:** DOC-DEFINITION-OF-DONE  
**Version:** 2.0  
**Statut :** VALIDÉ  
**Vérification :** Checklist automatique avant merge

---

## 1. Principes

Une tâche est **complètement terminée** uniquement quand **toutes** les cases cochées ci-dessous le sont.  
Aucune exception. C'est le critère objectif qui sépare "presque fini" de "prêt pour production".

---

## 2. Checklist DoD

### ✅ Code

| # | Critère | Comment Vérifier |
|---|---|---|
| C01 | Tests unitaires écrits | Exécuter `npm test` |
| C02 | Coverage module financier >= 90% | Exécuter `npm test -- --coverage` |
| C03 | Aucune violation NeverBreak Rule | Script CI détecte violations automatiquement |
| C04 | Aucun type `any` en TypeScript | ESLint `no-explicit-any` |
| C05 | Pas de hardcoded business logic | Grep recherche `if (type === 'church')` |

### ✅ Tests

| # | Critère | Comment Vérifier |
|---|---|---|
| T01 | Tests passent localement | `npm test -- --watchAll=false` |
| T02 | Test spécifique au bug corrigé (si applicable) | Nouveau fichier `*.test.ts` |
| T03 | Test de regression pour la règle métier concernée | Ajout au suite de test existant |
| T04 | Test offline simulé (si données modifiées) | Mode avion ou mock network |

### ✅ Documentation

| # | Critère | Comment Vérifier |
|---|---|---|
| D01 | Documentation mise à jour dans docs/ | Comparaison avec diff du code |
| D02 | ADR créé si décision architecturale | Vérifier dossier 90-adrs/ |
| D03 | Glossaire mis à jour (nouveaux termes) | docs/99-supporting/glossary.md |
| D04 | Matrice de traçabilité à jour | docs/00-architecture/Traceability-Matrix.md |

### ✅ Qualité

| # | Critère | Comment Vérifier |
|---|---|---|
| Q01 | Formatage Prettier appliqué | `npm run prettier:check` |
| Q02 | Linting passe sans erreur | `npm run lint` |
| Q03 | Aucun warning TypeScript | `tsc --noEmit` |
| Q04 | Taille document <= 400 lignes | NB-RULE-01 vérifiée auto |

---

## 3. Workflow de Vérification Automatique

```
Push vers la branche → CI/CD Pipeline
    │
    ├── Step 1: npm install + tsc --noEmit (Q03)
    ├── Step 2: npm run lint (Q02, C04)
    ├── Step 3: npm run prettier:check (Q01)
    ├── Step 4: npm test --coverage (C01, C02)
    │         └── Si coverage < 90% sur finance → FAIL (C02)
    ├── Step 5: dependency-check (C03)
    ├── Step 6: grep check hardcoded (C05)
    │
    └── Resultat
         ├── SUCCESS → TodoDn checked off
         └── FAIL → Corriger + re-push
```

## 4. Exceptions

Une exception à un critère DoD est possible UNIQUEMENT via :
1. ADR temporaire avec expiration (max 1 release)
2. Approbation explicite du développeur principal
3. Justification écrite dans le commit message

---

## 5. Exemple de Commit Suivant DoD Complet

```bash
feat(finance): add compensate transaction

- Implement Transaction.compensate() method
- Add compensation flow to workflow engine
- Update manifest schema for compensation field
- Write compensations.test.ts (coverage +15%)
- Update financial-rules.md with BR-FIN-012
- Create ADR-011-compensation-workflow
- Add compensation to traceability matrix

Refs: INV-001, DOC-PLATFORM-WORKFLOW, DOC-BUSINESS-RULES-FINANCE
Signed-off-by: DevTeam
```
