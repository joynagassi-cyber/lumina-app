# AI Collaboration Protocol — Règles de Travail avec Agents IA

**Doc ID:** DOC-AI-COLLAB  
**Version:** 2.0  
**Statut :** VALIDÉ  
**Vérification :** Toujours charger avant toute action

---

## 1. Principes Fondamentaux

Tu es un agent IA assistant le développeur principal de Lumina. Chaque interaction doit suivre ce protocole strict pour garantir la cohérence du système.

---

## 2. Protocole Avant Modification

**TOUJOURS** exécuter ces étapes **avant** toute modification de code :

```
Phase 1 : Comprendre le Contexte (5 min)
    ├── 1. Lire INDEX.md → choisir le document pertinent
    ├── 2. Lire PRD_LUMINA_v2.md (Section 2 minimum)
    └── 3. Lire Architecture-Map.md

Phase 2 : Vérifier les Contraintes (2 min)
    ├── 4. Lire NeverBreak Rules → vérifier si une rule s'applique
    ├── 5. Lire Invariants → vérifier si un invariant est concerné
    └── 6. Lire l'ADR pertinente (ex: ADR-004 pour finance)

Phase 3 : Modifier (temps variable)
    ├── 7. Implémenter la modification
    ├── 8. Écrire les tests unitaires
    └── 9. Vérifier la couverture de tests

Phase 4 : Valider et Documenter (5 min)
    ├── 10. Mettre à jour la documentation concernée
    ├── 11. Créer/modifier un ADR si décision majeure
    ├── 12. Lancer les tests (coverage >= 90% pour finance)
    └── 13. Confirmer qu'aucune NeverBreak Rule n'est violée
```

## 3. Règles de Communication avec le Développeur

| Règle | Détail |
|---|---|
| **Toujours expliquer** | Avant de modifier, expliquer LE POURQUOI en 2 lignes max |
| **Proposer des options** | Donner 2-3 alternatives si le chemin n'est pas évident |
| **Demander confirmation** | Pour toute décision archi ou changement de scope |
| **Résumer les changements** | Après chaque série de modifications, faire un résumé en 3 bullet points |
| **Reporter les risques** | Si une solution a un risque, le mentionner explicitement |

## 4. Format de Réponse Standard

```markdown
### Contexte
[Brief : quel besoin métier/tech répondons-nous ?]

### Options proposées
1. Option A (recommandée) : pourquoi
2. Option B : alternative

### Modifications prévues
- Fichier X : changement Y
- Fichier Z : changement W

### Impact
- Tests à écrire : [liste]
- Docs à mettre à jour : [liste]
- ADR à créer/modifier : [oui/non]
```

## 5. Ce Qu'un Agent IA NE FAIT JAMAIS

| Interdiction | Raison |
|---|---|
| ❌ Ignorer les NeverBreak Rules | Violation = blocage déploiement |
| ❌ Modifier un invariant | Les invariants sont absolus |
| ❌ Ajouter du code hardcodé | Tout passe par les moteurs |
| ❌ Créer >400 lignes dans un doc | Règle NB-RULE-01 |
| ❌ Scanner plus de 3 fichiers | Garde le contexte manable |
| ❌ Déployer sans tests passer | Qualité minimum requise |
| ❌ Proposer une solution sans alternative | Le développeur doit choisir |

## 6. Workflows Spécifiques

### Pour ajouter une feature
```
Lire → Decision Trees Arbre #1 → Manifest Engine → Capability Engine → Forms/Workflow selon besoin
```

### Pour corriger un bug
```
Lire → Decision Trees Arbre #2 → Invariants concernés → ADR liée → Code → Test
```

### Pour une refactorisation
```
Lire → Architecture-Map → Dependency-Contract → NeverBreak Rules → ADR nécessaire
```
