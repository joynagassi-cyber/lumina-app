# Architecture Governance & Review Workflow

**Doc ID:** DOC-011 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — OBLIGATOIRE POUR TOUS  
**Date:** 2026-07-24  

---

## PRINCIPE

Ce document définit QUI fait QUOI, DANS quel ordre, et QUELS documents canoniques sont mis à jour.

S'applique à chaque PR, ADR, Capability, table SQL, API endpoint, UI screen, Policy, ou Business Pack.

Tout agent IA ou humain contribuant à Lumina DOIT suivre ce workflow avant toute modification.

---

## RÔLES

| Rôle | Responsable | Pouvoirs |
|------|------------|----------|
| **Proposant** | Quiconque identifie un besoin d'évolution | Soumet la proposition, fournit le justificatif |
| **Vérificateur** | Agent IA autonome (ou développeur second) | Exécute les Decision Trees (DOC-009), vérifie la conformité aux Mapping Rules (DOC-004) |
| **Validateur** | CTO + Architecte Principal | Approve ou rejette les modifications au niveau Conceptual Model, Capability, ou Document Constitutionnel |
| **Exécutant** | Développeur / Agent IA | Applique la modification validée, met à jour les documents canoniques |

---

## WORKFLOW GÉNÉRAL — 6 PHASES

### Phase 1 : Proposition

| Action | Détail |
|--------|--------|
| Le Proposant remplit un template de proposition contenant: besoin exact, étapes DOC-008 appliquées, Decision Tree(s) applicables, impact estimé sur les documents canoniques |
| Si le besoin EXISTE déjà → Proposer une RÉUTILISATION avec lien vers DOC-001 entry existante. |
| Aucune proposition ne peut omettre l'étape 1 de DOC-008 (vérifier l'existant). |
| La proposition est placée dans un dossier `proposals/` en attendant revue. |

### Phase 2 : Vérification Automatique (Agent IA)

Le Vérificateur exécute automatiquement:

```
VÉRIFICATION:
1. [ ] DOC-008 Étape 1: Réutiliser → élément existe-t-il ?
2. [ ] DOC-008 Étape 2: Concept existant ? → Decision Tree 3
3. [ ] DOC-008 Étape 3: Capability existante ? → Decision Tree 1
4. [ ] DOC-008 Étape 4: Configuration seulement ? → Decision Tree 6
5. [ ] DOC-008 Étape 5: Runtime modifié ? → Decision Tree 4
6. [ ] DOC-008 Étape 6: Domain Object nouveau ? → Decision Tree 6
7. [ ] DOC-008 Étape 7: Table SQL nouvelle ? → Decision Tree 2
8. [ ] DOC-008 Étape 8: API existante ? → Decision Tree check
9. [ ] DOC-008 Étape 9: UI configurable ? → Decision Tree check

SMELL CHECK:
10. [ ] Capability trop grosse ? → Smell 1
11. [ ] Runtime connaît métier ? → Smell 2
12. [ ] Table définit concept ? → Smell 3
13. [ ] API expose base ? → Smell 4
14. [ ] UI connaît permissions ? → Smell 5
15. [ ] Manifest contient code ? → Smell 6
16. [ ] Template contient logique ? → Smell 7
17. [ ] Policy trop complexe ? → Smell 8
18. [ ] Capability dépend UI ? → Smell 9
19. [ ] Concept dépend tech ? → Smell 10
20. [ ] Domain invente concept ? → Smell 11
21. [ ] BP modifie Capacity ? → Smell 12
```

Si ÉTAPE 1→3 passe (réutilisation ou composition existante) → passage direct à Phase 5 (Exécution).

Si un Smell est détecté → Phase 3 obligatoire avant Phase 4.

### Phase 3 : Revue des Odeurs (si smell détecté)

Si un smell est détecté :

| Smell Detecté | Playbook | Documents à Mettre à Jour |
|--------------|----------|---------------------------|
| S1 (Capability trop grosse) | R-01 | DOC-001, DOC-005, DOC-002 |
| S2 (Runtime métier) | R-02 | DOC-001 |
| S3 (Table ≠ Concept) | R-03 | DOC-006, DOC-001 |
| S4 (API expose DB) | R-04 | DOC-002 |
| S5 (UI permissions) | R-05 | DOC-002 |
| S6-S12 | Voir DOC-010 | DOC-001 |

Après correction → retour à Phase 2.

### Phase 4 : Validation

La validation dépend du NIVEAU D'IMPACT :

| Niveau | Impact requis | Qui valide |
|--------|--------------|------------|
| **L1 — Config uniquement** | Nouveau Template, nouveau Manifest, extension vocabulary, branding | Vérificateur seul |
| **L2 — Domain Object** | Nouvel Aggregate, nouvelles entités/value objects dans DOC-006 | Vérificateur seul |
| **L3 — Data Model** | Nouvelle table SQL, nouvelle contrainte DB | Vérificateur + CTO |
| **L4 — Capability** | Nouvelle Capacité, modification d'une Capacité existante | Vérificateur + CTO + Architecte Principal |
| **L5 — Runtime Service** | Nouveau Runtime Service, modification d'ordre d'initialisation | Vérificateur + Architecte Principal |
| **L6 — Concept** | Nouveau Concept au Conceptual Model, suppression de Concept | Vérificateur + CTO + Architecte Principal |
| **L7 — Constitution** | Modification de DOC-000 à DOC-011 | CTO + Architecte Principal + écrit formel |

### Phase 5 : Exécution

L'Exécutant applique la modification dans cet ordre EXACT :

```
ORDRE D'EXÉCUTION OBLIGATOIRE:
1. Modifier les documents CANONIQUES en premier (DOC-000 à DOC-011)
2. Modifier les specs techniques (Engine specs, API contracts)
3. Modifier les schémas de données (migrations SQL)
4. Implémenter le code (TypeScript, RN components)
5. Écrire les tests unitaires
6. Mettre à jour la documentation utilisateur (si applicable)
```

Règle critique: **Les docs canoniques AVANT le code.** Si le code est écris avant que DOC-001 ne soit mis à jour → REJETÉ.

### Phase 6 : Mise à Jour Canonique

L'Exécutant met à JOUR les documents canoniques suivants selon la nature de la modification :

| Type de modification | Docs à mettre à jour |
|---------------------|---------------------|
| Nouvel élement catalogué | DOC-001 (Registry) |
| Nouvelle dépendance entre Capacities | DOC-005 (DAG) |
| Traçabilité modifiée | DOC-002 (Traceability Matrix) |
| Mapping modifié | DOC-006 (Concept → Aggregate) |
| Smell corrigé | DOC-010 (Playbook trace) |
| Validation report | DOC-003 (Alignment Report addendum) |

---

## WORKFLOW SPÉCIFIQUE PAR TYPE DE MODIFICATION

### A. Nouvelle Capability

```
Phase 1: Proposer (justificatif × 5 Business Packs)
Phase 2: Vérifier (Decision Tree 1 complet)
Phase 3: Si smell → refactor
Phase 4: Validé par CTO + Arch Principal (niveau L4)
Phase 5: Exécuter → ajouter à DOC-001 + DOC-005
Phase 6: Mettre à jour DOC-002, DOC-006, DOC-003
```

### B. Nouvelle Table SQL

```
Phase 1: Proposer (justificatif Aggregate correspondant dans DOC-006)
Phase 2: Vérifier (Decision Tree 2 complet)
Phase 3: Si smell → refactor
Phase 4: Validé par CTO (niveau L3)
Phase 5: Exécuter → migration SQL + DOC-001
Phase 6: Mettre à jour DOC-002
```

### C. Nouvelles API Endpoint

```
Phase 1: Proposer (justificatif Domain Object dans DOC-006)
Phase 2: Vérifier (Decision Tree 8 — étendre ou créer)
Phase 3: Si smell → refactor (Smell 4)
Phase 4: Validé par Vérificateur (niveau L1 — pas de validation CTO requise pour endpoints simples)
Phase 5: Exécuter → code API + contrat + DOC-002
Phase 6: Vérifier traçabilité Concept → Capability → Runtime → Domain → Data → API ✓
```

### D. Nouvel écran UI

```
Phase 1: Proposer (justificatif API contract + Capability consommée)
Phase 2: Vérifier (Decision Tree 9 — configurables via Manifest / Forms / Vocabulary)
Phase 3: Si smell → refactor (Smell 5)
Phase 4: Validé par Vérificateur (niveau L1)
Phase 5: Exécuter → écran + lien vers API contract
Phase 6: Vérifier que l'UI ne connaît ni SQL ni permissions directement
```

### E. Nouvelle Policy / Template / Configuration

```
Phase 1: Proposer (YAML/JSON prêt, zéro code)
Phase 2: Vérifier (Decision Tree 6 — configuration pure)
Phase 3: Pas de smell attendu (configuration pure)
Phase 4: Validé par Vérificateur (niveau L1 — automatique)
Phase 5: Exécuter → YAML dans manifests/ ou templates/
Phase 6: Vérifier qu'aucune capability n'est affectée (configuration uniquement)
```

### F. Modification de Business Pack

```
Phase 1: Proposer (composition existing Capacities sans modification)
Phase 2: Vérifier (Decision Tree 5 — composition pure, zero code)
Phase 3: Si smell S12 → refactor
Phase 4: Validé par Architecte Principal (niveau L2)
Phase 5: Exécuter → doc BP + lien vers Capacities composeses
Phase 6: Pas de mise à jour DOC-001 nécessaire (BP n'est pas catalogué)
```

---

## CHECKLIST ARCHITECTURE REVIEW (pour PR / ADR)

Chaque Pull Request ou ADR DOIT inclure cette checklist complétée:

```markdown
## Architecture Review Checklist

- [ ] Étapes DOC-008 Étape 1-9 appliquées (cocher celles qui sautent)
- [ ] Decision Tree approprié exécuté (DOC-009)
- [ ] Aucun Smell détecté (DOC-010)
- [ ] Impact classifié: L1/L2/L3/L4/L5/L6/L7
- [ ] Documents canoniques mis à jour listés
- [ ] Traçabilité complète vérifiée (DOC-002): Concept → Capability → Runtime → Domain → Data → API → UI
- [ ] Flux descendant respecté: aucune donnée remonte la hiérarchie
- [ ] Règle "priorité la plus haute" respectée
- [ ] Validation du bon rôle obtenue (selon niveau d'impact)
```

---

## INTEGRATION IA-ASSISTED DEVELOPMENT

Dans le contexte de Lumina (développement assisté par agents IA):

1. **Tout agent IA doit lire DOC-000 à DOC-011 avant de produire la moindre ligne de code ou document.**
2. **Lorsqu'un agent IA rencontre un besoin, il exécute automatiquement DOC-008 Étape 1-9.**
3. **Si un agent IA detecte un smell, il refactoring immédiatement ou bloque.**
4. **Toute proposition de nouvelle Capability/Concept/Table SQL par un agent IA est refusée sans justification conforme au Decision Tree correspondant.**
5. **Un agent IA ne peut pas se auto-valider pour les niveaux L4-L7.** La validation doit être faite par un humain (CTO ou Architecte Principal).
6. **La verification (Phase 2) est entièrement automatisable par un agent IA spécialisé "Architecture Reviewer".**

---

## REGISTRE DES MODIFICATIONS CONSTITUTIONNELLES

| Version | Date | Doc modifié | Modification | Validé par |
|---------|------|-------------|-------------|-----------|
| 1.0 | 2026-07-24 | DOC-000 à DOC-011 | Création complète | CTO + Arch Principal |
