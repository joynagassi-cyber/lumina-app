# Architecture Decision Constitution (ADC) — Règles de Gouvernance Décisionnelle

**Doc ID:** DOC-008 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — OBLIGATOIRE POUR TOUS  
**Date:** 2026-07-24  

---

## PRINCIPE FONDAMENTAL

Ce document ne décrit PAS la plateforme.

Il décrit COMMENT une décision d'évolution de la plateforme est prise.

Toute proposition de modification de Lumina — par un humain ou un agent IA — DOIT suivre le pipeline décisionnel défini ci-dessous, dans l'ordre exact indiqué.

Aucun contournement n'est permis.

Aucune dérogation n'est accordée sauf par amendement écrit de cette Constitution, signé par le CTO et l'Architecte Principal.

---

## LE PIPELINE DÉCISIONNEL — 9 ÉTAPES OBLIGATOIRES

### Étape 1 : Réutiliser

**Question :** Ce besoin existe-t-il déjà dans Lumina ?

Vérifier :
- DOC-001 Canonical Element Registry → l'élément existe-t-il catalogué ?
- DOC-005 Capability Dependency Graph → une Capacité couvre-t-elle ce besoin ?
- DOC-006 Concept → Aggregate Mapping → un Domain Object existe-t-il ?

Si OUI → **ARRÊTER. Réutiliser l'élément existant.** Créer un lien vers lui. Ne pas réinventer.

Si NON → continuer à l'étape 2.

---

### Étape 2 : Valider le Concept

**Question :** Le besoin correspond-il à un Concept existant dans le Conceptual Model ?

Vérifier :
- DOC-CONCEPTUAL-MODEL-V1.md → le Concept existe-t-il ?
- Le Concept est-il universel (survit sans technologie, sans Runtime, sans SQL, sans React Native) ?

Si OUI → **Ne PAS créer de nouveau Concept.** Utiliser le Concept existant. Continuer à l'étape 3.

Si NON → Ouvrir une demande de revue du Conceptual Model.

La revue demande :
1. Démontrer que le concept survit dans 5+ domaines métier différents
2. Démontrer qu'il existe indépendamment de toute technologie
3. Démontrer qu'il ne résout pas >1 problème
4. Obtenir validation CTO + Architecte Principal

Après validation : ajouter au Conceptual Model → mettre à jour DOC-001 → passer à l'étape 3.

---

### Étape 3 : Vérifier les Capacités Existantes

**Question :** Une Capability existante peut-elle résoudre ce besoin seule ou en composition ?

Vérifier :
- DOC-005 (Capability Dependency Graph) → lister toutes les Capacities
- Pour chaque Capacité, vérifier si sa mission couvre le besoin
- Tester la composition de 2+ Capacities

Si OUI → **NE PAS créer de nouvelle Capacité.** Composer les Capacities existantes dans un Business Pack ou un Template.

Si NON → Ouvrir une demande de nouvelle Capacité.

La demande de nouvelle Capacité doit démontrer :
1. La Capacité résout UN seul problème universel
2. La Capacité est indépendante du métier
3. La Capacité est utilisée par ≥2 Business Packs différents
4. La Capacité réduit les duplications (quelle duplication précise supprime-t-elle ?)
5. La Capacité sera encore pertinente dans 10 ans

Toutes ces conditions sont OBLIGATOIRES. Si l'une échoue → REJETÉ.

Validation : CTO + Architecte Principal.

Après validation : ajouter à DOC-001 et DOC-005 → passer à l'étape 4.

---

### Étape 4 : Vérifier que c'est uniquement de la configuration

**Question :** Le besoin peut-il être résolu par la configuration plutôt que par du code ?

Si le besoin est :

| Besoin | Solution |
|--------|----------|
| Changement d'apparence | Branding (template YAML) |
| Nouveau champ de saisie | Forms (template YAML) |
| Nouveau workflow d'approbation | Workflow (template YAML) |
| Nouveau terme/valeur | Vocabulary (template YAML) |
| Nouvelle règle de seuil | Policy (template YAML) |
| Nouvelles permissions | Manifest (roles section) |
| Nouveau type d'unité org | Template (unit_type enum extension) |

→ **CRÉER un TEMPLATE en YAML/JSON. JAMAIS du code.**

Passer à l'étape 7 (le code n'est jamais nécessaire ici).

Si le besoin nécessite du code → passez à l'étape 5.

---

### Étape 5 : Vérifier le besoin d'un Runtime Service

**Question :** Le Runtime doit-il être modifié ?

Le Runtime ne PEUT être modifié que si le comportement d'orchestration change.

Exemples de MODIFICATIONS autorisées du Runtime :
- Nouvel ordre d'initialisation des Capacities
- Nouveau mécanisme de composition d'Applications
- Nouvelle politique de HotSwap

Exemples de modifications INTERDITES du Runtime :
- Ajouter une logique métier
- Décider quelle Capacité activer pour quelle Organisation
- Modifier une Capacité existante
- Créer un nouveau concept

Si la modification du Runtime est autorisée → ajouter au DOC-001 → passer à l'étape 6.

Si la modification est interdite → **REJETÉ**.

---

### Étape 6 : Domain Model

**Question :** Le Domain Model est-il suffisant pour supporter ce changement ?

Créer un Aggregate (DDD) pour encapsuler l'état cohérent.

Règles :
- Un Aggregate correspond à UN Concepts du Conceptual Model
- Un Aggregate contient des Entities et Value Objects
- Un Aggregate implémente les Policies nécessaires
- **Ne JAMAIS créer un nouveau Concept**

Ajouter à DOC-006 (Concept → Aggregate Mapping). Passer à l'étape 7.

---

### Étape 7 : Data Model

**Question :** Des tables SQL supplémentaires sont-elles strictement nécessaires ?

Chaque table doit répondre à cette question :
> Quelle couche supérieure (Domain Model / Aggregate / Value Object) a TELLE BESOIN de persistance propre qui ne peut pas être stockée en JSONB dans une table existante ?

Règles :
- **AUCUNE table sans Aggregate correspondant dans DOC-006**
- **AUCUNE table qui définit un nouveau Concept**
- Privilégier JSONB dans une table existante avant de créer une nouvelle table
- Chaque nouvelle table doit être justifiée par son Aggregate parent

Après justification → créer la migration → mettre à jour DOC-001 → passer à l'étape 8.

---

### Étape 8 : API

**Question :** L'API existe-t-elle déjà ?

Si OUI → étendre l'endpoint existant. Ne jamais dupliquer.

Si NON → créer un endpoint conforme au contrat de l'API existante.

Règles :
- L'API expose le COMPORTEMENT du Domain Model, jamais une table SQL directement
- Tout endpoint doit inclure x-org-id header
- Tout endpoint exposant des données utilisateur doit avoir RLS équivalent côté serveur

Après création → mettre à jour DOC-002 (Traceability Matrix). Passer à l'étape 9.

---

### Étape 9 : UI

**Question :** L'UI peut-elle être configurée plutôt que codée ?

Ordre de préférence (du plus au moins preferred) :
1. Configuration via Manifest (feature toggles, routing)
2. Rendu via Forms Engine (formulaires dynamiques)
3. Labels via Vocabulary (traductions, enums)
4. Thème via Branding (couleurs, logo)
5. Code JSX/TSX (UNIQUEMENT si aucun des 4 ci-dessus ne fonctionne)

Si une UI nouvelle est requise :
- Elle ne connaît JAMAIS la structure SQL
- Elle dialogue UNIQUEMENT avec les contrats d'API
- Elle ne crée AUCUN concept nouveau
- Elle consomme UNIQUEMENT des Capacities exposées

---

## RÈGLES DE PRIORITÉ DES ÉTAPES

Les étapes sont EXÉCUTOIRES dans l'ordre 1 → 9.

Une étape peut BLOQUER la suite.

Une étape peut RENDRE inutiles les étapes suivantes.

Exemple : si l'étape 4 conclut "configuration uniquement" → les étapes 5 à 9 sont sautées. Exemple : si l'étape 3 conclut "Capacité existante" → les étapes 4 à 9 sont sautées.

**Le principe général est : prendre la voie LA PLUS HAUTE possible dans la hiérarchie canonique.**

---

## REGISTRE DES DÉCISIONS CONSTITUTIONNELLES

Chaque modification apportée à ce document doit être tracée dans le registre suivant :

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création | CTO + Arch Principal |

---

## AMENDEMENT DE LA CONSTITUTION

Seul un amendement écrit, signé par le CTO ET l'Architecte Principal, peut modifier cette Constitution.

Un amendement doit :
1. Documenter le motif exact
2. Identifier l'article concerné
3. Proposer le texte remplacé
4. Démontrer que l'amendement améliore la plateforme (réduction complexité, augmentation réutilisabilité)
5. Avoir une expiration automatique après 2 versions majeures (sauf renouvellement)

Aucun amendement temporaire ne peut durer plus de 2 versions majeures.
