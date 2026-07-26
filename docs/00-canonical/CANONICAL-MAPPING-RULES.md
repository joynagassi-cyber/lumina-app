# Canonical Mapping Rules — Règles de Transformation entre Couches

**Doc ID:** DOC-004 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** SOURCE DE VÉRITÉ ABSOLUE  
**Date:** 2026-07-24  

---

## PRINCIPE GÉNÉRAL

Les 13 couches de la hiérarchie canonique sont connectées par des **ponts de transformation**. Chaque pont a des règles précises: ce qu'il accepte, ce qu'il produit, ce qui lui est strictement interdit.

**Règle absolue:** Aucune couche ne peut envoyer des données en amont (vers une couche supérieure). Le flux est STRICTEMENT descendant.

```
Vision → Architecture → Conceptual Model → Foundation → Platform Capabilities → Runtime Services → Business Packs → Templates → Organization Manifest → Domain Model → Data Model → API → UI
```

---

## PONT 1: Vision → Architecture Principles

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Intentions, objectifs commerciaux, besoin utilisateur brut |
| **Produit** | Règles non-négociables, principes structurels, contraintes permanentes |
| **Ce qui change** | Du "pourquoi" abstrait vers du "comment structurer" concret mais toujours tech-neutral |
| **Ce qui ne change pas** | La finalité fondamentale de la plateforme |
| **Interdit** | Technologie, features, dates, roadmap, noms de modules |

**Règle de validation:** Si un principe architectural mentionne une technologie → REJETÉ.

---

## PONT 2: Architecture Principles → Conceptual Model

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les contraintes structurelles |
| **Produit** | La liste exhaustive des concepts universels |
| **Ce qui change** | De la structure logique vers les briques conceptuelles |
| **Ce qui ne change pas** | L'indépendance technologique |
| **Interdit** | Tables, écrans, API, moteurs, types de données, implémentations |

**Règle de validation:** Si un concept mentione SQL, JSON, TypeScript, React, API → REJETÉ.

---

## PONT 3: Conceptual Model → Foundation

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les concepts fondamentaux (Identity, Audit, etc.) |
| **Produit** | Les services infrastructurels qui rendent ces concepts opérationnels |
| **Ce qui change** | Concepts statiques → Services dynamiques |
| **Ce qui ne change pas** | Universalité et indépendance métier |
| **Interdit** | Logique métier, formulaires spécifiques, vocabulaire d'un domaine |

**Règle de validation:** Un service de Foundation ne doit jamais contenir `IF type === 'church'`.

---

## PONT 4: Foundation → Platform Capabilities

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les services fondamentaux opérationnels |
| **Produit** | Les capacités composables que la plateforme expose |
| **Ce qui change** | Infrastructure → capacité d'action |
| **Ce qui ne change pas** | Universalité et réutilisabilité |
| **Interdit** | Fonctionnalités métier (finance, membres...), écrans, state management |

**Règle de validation:** Une Capability ne résout QU'UN problème. Si elle en résout deux → DÉCOMPOSER.

---

## PONT 5: Platform Capabilities → Runtime Services

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les capacités disponibles |
| **Produit** | Les orchestrateurs qui les activent dans le bon ordre |
| **Ce qui change** | Ce QUE la plateforme sait faire → COMMENT elle le fait au moment T |
| **Ce qui ne change pas** | Les capacités restent les mêmes, seul le mécanisme d'activation change |
| **Interdit** | Créer de nouvelles capacités, décider quelles capacités activer pour quelle org |

**Question de contrôle:** Cette responsabilité existerait-elle si le Runtime était remplacé par une autre technologie? SI OUI → c'est pas un Runtime Service.

---

## PONT 6: Runtime Services → Business Packs

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les capacités activées + configuration Runtime |
| **Produit** | Des agrégats de Capacities pour un domaine |
| **Ce qui change** | Capacités universelles →组合 spécifiques à un domaine |
| **Ce qui ne change pas** | Les Capacities sous-jacentes restent les mêmes |
| **Interdit** | Créer de nouvelles Capacities, modifier le comportement des Capacities |

**Règle de validation:** Un Business Pack est un POINT VIRTUEL, pas une table, pas un code. C'est une ligne dans un document.

---

## PONT 7: Business Packs → Templates

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les compositions de Capacities pour un domaine |
| **Produit** | De la configuration pure réutilisable (vocab, forms, workflows, policies) |
| **Ce qui change** | Composition théorique → Configuration pratique |
| **Ce qui ne change pas** | Zéro code. Les Templates sont du YAML/JSON uniquement |
| **Interdit** | Code exécutable, logique conditionnelle complexe, imports TypeScript |

**Règle de validation:** Un Template ne contient JAMAIS une seule ligne de code.

---

## PONT 8: Templates → Organization Manifest

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Un Template + une Organisation |
| **Produit** | Un fichier YAML/JSON spécifique à cette org |
| **Ce qui change** | Blueprint générique → Instance concrète |
| **Ce qui ne change pas** | Structure du format, types de champs, schéma de validation |
| **Interdit** | Ajouter de nouveaux types de champs, créer de nouvelles sections, inventer un nouveau concept |

**Règle de validation:** Un Manifest ne peut PAS déclarer de nouvelle Capability. Il ne peut QU'activer celles existantes.

---

## PONT 9: Organization Manifest → Domain Model

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Le manifest compilé + configuration Runtime |
| **Produit** | Les objets manipulés concrètement (instanciations des concepts) |
| **Ce qui change** | Configuration abstraite → Objets concrets avec état |
| **Ce qui ne change pas** | Les types d'objets existaient déjà dans les Capacities |
| **Interdit** | Inventer de nouveaux types, ajouter des comportements non définis par les Capacities |

**Règle de validation:** Tout Domain Object correspond à UN concept du Conceptual Model. S'il n'en a pas → REJETÉ.

---

## PONT 10: Domain Model → Data Model

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les Domain Objects avec leurs états et relations |
| **Produit** | Tables, index, contraintes, optimisations de stockage |
| **Ce qui change** | Objets métiers persistants → structures de stockage physiques |
| **Ce qui ne change pas** | L'intégrité référentielle, les contraintes, les relations |
| **Interdit** | Déterminer quels concepts existent, définir des règles métier, modifier les Capacities |

**Règle de validation:** Une table ne peut JAMAIS être créée sans un Domain Object correspondant. Un Domain Object existe sans nécessairement avoir une table dédiée (peut être stocké en JSONB dans une autre table).

---

## PONT 11: Data Model → API

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les structures de données persistantes |
| **Produit** | Les contrats d'interface (entrées/sorties) |
| **Ce qui change** | Stockage → Communication externe |
| **Ce qui ne change pas** | Les données manipulées restent les mêmes |
| **Interdit** | Exposer directement les tables, définir des règles métier, créer des concepts |

**Règle de validation:** Une API n'expose JAMAIS une table SQL directement. Elle expose le COMPORTEMENT du Domain Model sur les données persistantes.

---

## PONT 12: API → UI

| Propriété | Détail |
|-----------|--------|
| **Reçoit** | Les contrats d'API (Entrée/Sortie) |
| **Produit** | Les interfaces utilisateur (écrans, composants) |
| **Ce qui change** | Contrats abstraits → Écrans concrets |
| **Ce qui ne change pas** | Les données affichées, les actions possibles, les permissions requises |
| **Interdit** | Connaître la structure SQL, inventer de nouvelles données, contourner l'API |

**Règle de validation:** Une UI ne peut PAS accéder directement aux données. Elle passe TOUJOURS par l'API.

---

## RÈGLES D'OR DES TRANSITIONS

### Règle 1 — Flux Descendant Strict

Aucune donnée, décision ou concept ne peut remonter la hiérarchie.

### Règle 2 — Invention Interdite

Aucune couche inférieure ne peut INVENTER un concept. Elle peut seulement l'instancier, le stocker, l'exposer ou le composer.

### Règle 3 — Unicité de Propriétaire

Chaque responsabilité appartient à UNE SEULE couche. Si deux couches revendiquent la même responsabilité → déplacer vers la couche LA PLUS HAUTE (celle la plus proche du Conceptual Model).

### Règle 4 — Remplaçabilité

Toutes les couches en-dessous du Conceptual Model sont techniquement interchangeables. Si remplacer PostgreSQL par Drizzle ou React Native par Flutter ne change rien aux couches supérieures → l'architecture est correcte.

### Règle 5 — Zéro Couplage Inversé

Une couche supérieure ne peut jamais dépendre structurellement d'une couche inférieure. Le Dependency Contract s'applique.
