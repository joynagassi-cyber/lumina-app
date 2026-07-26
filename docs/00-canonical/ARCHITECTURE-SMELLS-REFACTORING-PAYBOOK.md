# Architecture Smells & Refactoring Playbook

**Doc ID:** DOC-010 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — OBLIGATOIRE POUR TOUS  
**Date:** 2026-07-24  

---

## PRÉAMBULE

Une "odeur architecturale" est un symptôme qui indique qu'une couche viole une règle du Mapping, empiète sur une autre couche, ou dérive vers un couplage indésirable.

Chaque smell a : Symptômes, Cause, Risque, Correction immédiate, Documents à mettre à jour après correction.

---

## SMOELL 1 : Capability Trop Grosse

| Champ | Détail |
|-------|--------|
| **Symptômes** | Une Capacité résout >1 problème universel. Ex: "Finance + Members + Events dans le même moteur." |
| **Cause** | Accumulation progressive de fonctionnalités sans décomposition atomique. |
| **Risque** | Impossibilité de composer. Modification d'une feature casse les autres. |
| **Correction** | Décomposer en Capacités atomiques. Voir DOC-008 Étape 3. |
| **Documents mis à jour** | DOC-001, DOC-005, DOC-002 |

---

## SMELL 2 : Runtime qui Connaît le Métier

| Champ | Détail |
|-------|--------|
| **Symptômes** | `IF org.type === 'church'` dans un Runtime Service. Le Runtime lit des données métier. |
| **Cause** | Le Runtime sert de "cache pour la logique métier" au lieu d'être un simple orchestrateur. |
| **Risque** | Le Runtime devient le centre du système (violation DOC-000 Règle 5). Toute nouvelle org type nécessite modification du Runtime. |
| **Correction** | Déplacer la logique vers Templates. Le Runtime ne fait que charger le Template et appeler les Capacities. |
| **Documents mis à jour** | DOC-001, DOC-006, DOC-002 |

---

## SMELL 3 : Table SQL qui Définit un Concept

| Champ | Détail |
|-------|--------|
| **Symptômes** | On crée une table parce qu'on a UNE NOUVELLE IDEE de concept au lieu de réutiliser un concept existant. |
| **Cause** | Confusion Data Model ↔ Conceptual Model. |
| **Risque** | Invention de concepts non-universels. Le stockage dicte l'architecture. |
| **Correction** | Vérifier DOC-CONCEPTUAL-MODEL-V1.md. Si le concept existe → utiliser la table existante + JSONB. Si inexistant → ouvrir revue Conceptual Model (DOC-008 Étape 2). |
| **Documents mis à jour** | DOC-001, DOC-006 |

---

## SMELL 4 : API qui Expose la Base

| Champ | Détail |
|-------|--------|
| **Symptômes** | Endpoint `/api/v1/transactions?org_id=X` retourne directement les lignes de la table. Pas de Domain Model intermédiaire. |
| **Cause** | Tentation de CRUD direct. |
| **Risque** | Couplage UI → Data Model. Changement de schéma = changement API = changements cascades. |
| **Correction** | Introduire Domain Model + Capability layer entre API et Data Model. L'API expose le COMPORTEMENT, pas les données brutes. |
| **Documents mis à jour** | DOC-001, DOC-002, DOC-006 |

---

## SMELL 5 : UI qui Connaît les Permissions

| Champ | Détail |
|-------|--------|
| **Symptômes** | Un écran vérifie `if (user.permissions.includes('finance:ledger:write'))` avant de s'afficher. |
| **Cause** | L'UI gère sa propre visibilité au lieu de la recevoir via le Manifest / Forms Engine. |
| **Risque** | UI couplée au RBAC. Nouvel permission = modifier les écrans. |
| **Correction** | La Permissions Capability filtre les formulaires affichés via le Forms Engine. L'UI ne fait QUE rendre ce qui lui est envoyé. |
| **Documents mis à jour** | DOC-001, DOC-002 |

---

## SMELL 6 : Manifest Contenant du Code

| Champ | Détail |
|-------|--------|
| **Symptômes** | Un manifest inclut des fonctions JS, des templates Handlebars exécutables, ou du TypeScript inline. |
| **Cause** | Pensée que le manifest peut contenir de la logique. |
| **Risque** | Violation INV-002 + NB-RULE-05. Le manifest devient un mini-langage de programmation. |
| **Correction** | Extraire toute logique exécutable vers un Template (YAML pur) ou un Workflow Engine step. Le manifest ne contient QUE de la DATA. |
| **Documents mis à jour** | DOC-001, DOC-006 |

---

## SMELL 7 : Template Contenant une Logique Métier

| Champ | Détail |
|-------|--------|
| **Symptômes** | Un template church.yaml contient `IF tithes > 1000 THEN escalate_to_board`. |
| **Cause** | Confusion Template → Workflow Engine. |
| **Risque** | Le Template devient executable au lieu d'être config pure. |
| **Correction** | Déplacer la logique conditionnelle vers le Workflow Engine (qui est une Capability configurée PAR un Template, pas le Template lui-même). |
| **Documents mis à jour** | DOC-001, DOC-005, DOC-006 |

---

## SMELL 8 : Policy Trop Complexe

| Champ | Détail |
|-------|--------|
| **Symptômes** | Une policy contient >3 niveaux de conditions imbriquées. Exemple: `IF amount > threshold AND user.role === 'treasurer' AND time < 17:00 AND day === monday`. |
| **Cause** | Accumulation de règles métier dans une seule Policy. |
| **Risque** | Policy devenue un langage de programmation déguisé. Indétenable. |
| **Correction** | Découper en Policies atomiques. Chaque policy résout UN seul test. Orchestrer via Workflow Engine. |
| **Documents mis à jour** | DOC-001 |

---

## SMELL 9 : Capability Dépendant d'une UI

| Champ | Détail |
|-------|--------|
| **Symptômes** | Une Capability référence un composant React Native, un route Expo, ou un écran spécifique. |
| **Cause** | Inversion de la hiérarchie canonique (UI → Capability au lieu de Capability → UI). |
| **Risque** | Impossibilité de réutiliser la capability sur autre chose que React Native. |
| **Correction** | Supprimer toute référence UI. La Capability retourne des données structurées, pas des composants. |
| **Documents mis à jour** | DOC-001, DOC-005 |

---

## SMELL 10 : Concept Dépendant d'une Technologie

| Champ | Détail |
|-------|--------|
| **Symptômes** | Un concept mentione PostgreSQL, SQLite, React, WebSocket, JWT, ou tout autre nom de technologie. |
| **Cause** | Le Conceptual Model a été contaminé par des détails d'implémentation. |
| **Risque** | Perte de l'indépendance technologique. Remplacer PostgreSQL devient impossible sans changer les Concepts. |
| **Correction** | Retirer toute référence technologique du Conceptual Model. Le concept existe indépendamment. |
| **Documents mis à jour** | DOC-CONCEPTUAL-MODEL-V1, DOC-001 |

---

## SMELL 11 : Domain Model Inventant un Nouveau Concept

| Champ | Détail |
|-------|--------|
| **Symptômes** | Un Domain Object n'a aucun Concept correspondant dans DOC-CONCEPTUAL-MODEL-V1.md. Exemple: "ChurchMember" comme nouveau concept au lieu d'instanciation de Person. |
| **Cause** | Création ad-hoc de concepts dans le Domain Model. |
| **Risque** | Explosion conceptuelle. Chaque org type invente ses propres concepts. |
| **Correction** | Tout Domain Object doit être une instanciation d'un Concept existant. ChurchMember extends Person. BaptismEvent extends Event. |
| **Documents mis à jour** | DOC-006, DOC-001 |

---

## SMELL 12 : Business Pack Modifiant le Comportement d'une Capability

| Champ | Détail |
|-------|--------|
| **Symptômes** | Le Church Pack modifie le comportement du Workflow Engine (ex: ajout d'une étape d'approbation pasteur qui n'existe pas dans School Pack). |
| **Cause** | Un BP agit comme une extension de code au lieu d'une composition de configuration. |
| **Risque** | Les BPs deviennent du code dur. Le Platform Core n'est plus agnostique (INV-002). |
| **Correction** | Le BP NE MODIFIE PAS les Capacities. Il les COMPOSE via un Template. Le Workflow Engine est identique pour tous; seul le YAML du Template diffère. |
| **Documents mis à jour** | DOC-001 |

---

## REFATORING PLAYBOOK — Comment Corriger chaque Smell

### Playbook R-01 : Capability Trop Grosse

1. Identifier toutes les responsabilités de la capacité
2. Si >1 responsabilité → séparer en capacités atomiques
3. Pour chaque sous-capacité : vérifier qu'elle est universelle, réutilisable, indépendante du métier
4. Mettre à jour DOC-005 (dépendances recalculees)
5. Mettre à jour DOC-001 (nouvelles entrées)
6. Mettre à jour DOC-002 (traçabilité mise à jour)

### Playbook R-02 : Runtime qui Connaît le Métier

1. Isoler TODOUS les IFs métier dans le Runtime
2. Pour chaque IF : extraire vers Template (YAML)
3. Remplacer par invocation via Manifest Loader
4. Vérifier que le Runtime ne fait plus que charger et composer
5. Mettre à jour DOC-001 (Runtime Service fiche mise à jour)

### Playbook R-03 : Table SQL qui Définit un Concept

1. Prendre la table incriminée
2. Vérifier si le "concept" qu'elle définit existe dans DOC-CONCEPTUAL-MODEL-V1
3. Si oui → fusionner avec la table existante ou utiliser JSONB
4. Si non → ouvrir revue Conceptual Model (DOC-008 Étape 2)
5. Ne jamais créer de table avant validation Conceptual Model

### Playbook R-04 : API qui Expose la Base

1. Supprimer le direct DB access dans l'endpoint
2. Ajouter Domain Model layer entre API et Data Model
3. L'endpoint appelle le Domain Model, le Domain Model interroge le Data Model
4. Tester que le même endpoint fonctionne avec Data Model différent

### Playbook R-05 : UI qui Connaît les Permissions

1. Retirer toute vérification de permission dans les composants UI
2. Configurer les permissions via Manifest `roles[].permissions`
3. Le Forms Engine masque/affiche les champs selon les permissions
4. L'UI ne voit QUE ce qui lui est rendu

### Playbook R-06 à R-12 : Corrections Générales

Pour chaque smell de la liste :
1. Réduire à la configuration (Template/Manifest/YAML)
2. Appliquer le principe "Configuration First" de la Constitution
3. Vérifier avec les Decision Trees (DOC-009)
4. Mettre à jour les documents canoniques
