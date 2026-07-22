# Documentation Discipline — Règles de Synchronisation Code/Docs

**Doc ID:** DOC-DOC-DISCIPLINE  
**Version:** 2.0  
**Statut :** VALIDÉ  
**Vérification :** Blocage automatique en CI/CD si violation

---

## 1. Principes Fondamentaux

> **Si la documentation n'est plus synchronisée avec le code, elle perd toute sa valeur.**

Un code non-documenté est un risque. Une documentation non-synchronisée est un **piège à bugs**.  
Aucune exception n'est possible : la documentation fait partie intégrante du produit fini.

## 2. Règle Strictissime de Pull Request

```
AUCUNE Pull Request n'est considérée comme terminée tant que
la documentation correspondante n'a pas été mise à jour.

Même si tu développes seul avec des agents IA,
cette discipline est essentielle.
```

### Qu'est-ce qu'une "documentation correspondante" ?

Une PR modifie-t-elle... | docs à mettre à jour |
|---|---|
| Un moteur du Platform Core | Le spec du moteur concerné dans `docs/01-platform-core/*/index.md` |
| Un endpoint API | `docs/05-api-contracts/api-contracts.md` |
| Une règle métier | `docs/04-business-rules/*.md` |
| Le schéma de données | `docs/03-configuration/mfejc-manifest-example.md` |
| Une nouvelle feature | La Traceability Matrix + l'Engine concerned |
| L'architecure | Les ADRs concernés |
| Un invariant/rule | `docs/99-supporting/invariants.md` ou `neverbreak.md` |

## 3. Workflow de Merge

```
Push vers la branche
    │
    ▼
CI/CD Check
    │
    ├── Étape 1 : PR crée un fichier "doc-change-needed.md" listant les docs à modifier
    │
    ├── Étape 2 : Développeur modifie TOUS les fichiers listés
    │         └── Si un fichier manquant → PR REJETÉE automatiquement
    │
    ├── Étape 3 : CI/CD compare les modifications docs vs code
    │         └── Si incohérence détectée → PR REJETÉE
    │
    └── Résultat : MERGE ACCEPTÉ OU REJETÉ
```

## 4. Checklist avant de Demander Review

| # | Question | Vérifié par |
|---|---|---|
| 1 | Ai-je lu INDEX.md pour trouver les docs concernés ? | Développeur |
| 2 | Ai-je mis à jour TOUS les docs listés dans la matrice ? | Développeur |
| 3 | Ai-je créé un ADR si j'ai pris une décision architecturale ? | Développeur |
| 4 | Les tests couvrent-ils les changements ? | Test runner |
| 5 | Aucun NeverBreak Rule n'est violée ? | CI/CD |
| 6 | La Documentation change-t-elle dans PR commentée ? | Git diff |

## 5. Impact sur les Agents IA

Tous les agents IA assistant le développement doivent suivre ce protocole :

```markdown
## Protocole Agent IA — Synchronisation Docs

AVANT toute modification de code :
1. Lire INDEX.md → identifier les docs concernés
2. Lire DOC-DOC-DISCIPLINE → comprendre la règle de synchro

PENDANT la modification :
3. Lister les docs qui DOIVENT être modifiés
4. Implémenter le code
5. Mettre à jour CHAQUE doc de la liste

APRÈS la modification :
6. Confirmer que chaque doc listé a été modifié
7. Ne PAS demander review tant que tous les docs ne sont pas à jour
```

## 6. Exemples

### ✅ Exemple Correct

```bash
Commit message:
fix(finance): add transaction status transition

- Modify Transaction model to support 'pending_approval' status
- Update financial-rules.md with BR-FIN-014
- Update workflow-engine/index.md with new transition
- Update traceability matrix for PRD-03
- No ADR needed (minor change, covered by ADR-004)
```

### ❌ Exemple Incorrect

```bash
Commit message:
fix(finance): add transaction status transition

- Modify Transaction model
```
→ REJETÉ : pas de docs mis à jour, pas de lien vers traceabilité.
