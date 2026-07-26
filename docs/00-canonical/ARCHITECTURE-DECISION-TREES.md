# Architecture Decision Trees — Arbres de Décision Officiels

**Doc ID:** DOC-009 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — OBLIGATOIRE POUR TOUS  
**Date:** 2026-07-24  

---

## USAGE

Ces arbres sont des algorithmes decisionnels. Chaque nœud est une question à réponse OUI/NON. Chaque feuille est une décision exécutoire.

Aucun saut de nœud n'est permis. Aucune question optionnelle.

---

## TREE 1 : Dois-je créer une nouvelle Capability ?

```
COMMENCE
  │
  ▼
┌─ Q1 : Le besoin correspond-il à UN problème universel ? ──NON──→ REJETÉ
│   (réutilisable dans ≥5 domaines métier différents)         │
│                                                             │
OUI                                                           │
  │                                                           │
  ▼                                                           │
┌─ Q2 : Une Capacité existante peut-elle résoudre ce besoin,  │
│   seule ou en composition avec d'autres Capacities ?        │
│                                                             │
│   OUI → COMPOSER les Capacities existantes                  │
│         Créer un Business Pack ou Template                  │
│         ARRÊTER                                               │
│                                                             │
│   NON                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q3 : La Capacité proposeée réduirait-elle les duplications ?│
│                                                             │
│   NON → REJETÉ                                              │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q4 : La Capacité sera-t-elle encore pertinente dans 10 ans │
│    sans modification majeure ?                              │
│                                                             │
│   NON → REJETÉ                                              │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q5 : La Capacit´e est-elle indépendante du métier ?        │
│    (ne connaît "église", "école", etc.)                     │
│                                                             │
│   NON → REJETÉ                                              │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q6 : Validation CTO + Architecte Principal obtenue ?       │
│                                                             │
│   NON → EN ATTENTE                                          │
│                                                             │
│   OUI → CRÉER la Capacité                                   │
│         Ajouter à DOC-001 (Element Registry)                │
│         Ajouter à DOC-005 (Dependency Graph)                 │
│         Mettre à jour DOC-002 (Traceability Matrix)          │
│         ARRÊTER                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## TREE 2 : Dois-je créer une table SQL ?

```
COMMENCE
  │
  ▼
┌─ Q1 : Un Domain Object correspondant existe dans             │
│    DOC-006 (Concept → Aggregate Mapping) ?                   │
│                                                             │
│   NON → STOP. Aucun Domaine → aucune table.                 │
│         Utiliser JSONB dans une table existante.              │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q2 : L'état de cet Aggregate ne peut PAS être stocké        │
│    en JSONB dans une table existante ?                       │
│                                                             │
│   OUI → STOP. Stocker en JSONB plutôt que créer une table.  │
│                                                             │
│   NON                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q3 : La création de cette table est-elle justifiée par      │
│    un besoin de performance (index composé, GIN, etc.) ?    │
│                                                             │
│   NON → STOP. Pas de justification de perf = pas de table.  │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q4 : La table respecte-t-elle toutes les règles suivantes : │
│    - Pas de Concept inventé                                 │
│    - Toujours org_id FK                                    │
│    - Toujours id UUID + version INTEGER                     │
│    - Timestamps always UTC                                  │
│    - RLS enabled on all tables with org_id                  │
│                                                             │
│   NON → REJETÉ                                              │
│                                                             │
│   OUI → APPROUVÉ                                            │
│         Créer migration                                     │
│         Mettre à jour DOC-001                               │
│         Mettre à jour DOC-006                               │
│         ARRÊTER                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## TREE 3 : Dois-je créer un nouveau Concept ?

```
COMMENCE
  │
  ▼
┌─ Q1 : Le concept survit-il SANS technologie ?                │
│    (pas de SQL, pas de TypeScript, pas de React,             │
│     pas d'API, pas de framework)                             │
│                                                             │
│   NON → Ce n'est PAS un Concept. C'est une implémentation.  │
│         Placer au niveau Data Model ou Runtime.               │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q2 : Le concept survit-il SANS Runtime ?                    │
│    (sans moteur, sans compilateur, sans service)             │
│                                                             │
│   NON → Ce n'est PAS un Concept. C'est un Runtime Service.  │
│         Placer au niveau Runtime Services.                    │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q3 : Le concept survit-il SANS SQL / stockage ?             │
│                                                             │
│   NON → Ce n'est PAS un Concept. C'est un Domain Object     │
│         ou un Data Model element.                            │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q4 : Le concept est-il universel ?                          │
│    (réutilisable dans église, ONG, école, entreprise,        │
│     hôpital, mairie, association)                            │
│                                                             │
│   NON → REJETÉ. Trop spécifique.                            │
│         Déplacer vers Business Pack ou Template.              │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q5 : Le concept résout-il un seul problème fondamental ?    │
│                                                             │
│   NON → REJETÉ. Diviser en concepts plus atomiques.          │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q6 : A-t-on vérifié que ce concept n'existe PAS déjà       │
│    dans le Conceptual Model v1 (DOC-CONCEPTUAL-MODEL-V1) ?  │
│                                                             │
│   OUI (déjà existant) → RÉUTILISER le concept existant.      │
│         Ne pas dupliquer.                                   │
│                                                             │
│   NON (nouveau)                                             │
│     │                                                       │
│     ▼                                                       │
┌─ Q7 : Validation CTO + Architecte Principal obtenue ?        │
│                                                             │
│   NON → EN ATTENTE                                          │
│                                                             │
│   OUI → AJOUTER au Conceptual Model                         │
│         Mettre à jour DOC-001                               │
│         Mettre à jour DOC-006                               │
│         Mettre à jour DOC-002                               │
│         ARRÊTER                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## TREE 4 : Dois-je créer un Runtime Service ?

```
COMMENCE
  │
  ▼
┌─ Q1 : Cette responsabilité existerait-elle si le               │
│    Runtime était remplacé par Deno / Bun / Go ?              │
│                                                             │
│   NON → Ce n'est PAS un Runtime Service.                    │
│         C'est soit un Concept, une Capability, ou du métier. │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q2 : Le service fait-il UNIQUEMENT de l'orchestration ?     │
│    (charge, résout, active, compose, coordonne)              │
│                                                             │
│   NON → Si le service contient de la logique métier →       │
│         REJETÉ. Le métier appartient aux Templates.           │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q3 : Le service crée-t-il ou modifie-t-il des               │
│    Concepts ou des Capacities ?                              │
│                                                             │
│   OUI → REJETÉ. Le Runtime ne crée rien.                    │
│                                                             │
│   NON                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q4 : Le service est-il irréductible à un autre service      │
│    existant ?                                                │
│                                                             │
│   NON → FUSIONNER avec le service existant.                 │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q5 : Le service a-t-il une mission unique et claire ?       │
│                                                             │
│   NON → TROP LARGE. Découper en services plus petits.        │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q6 : Validation Architecte Principal obtenue ?              │
│                                                             │
│   NON → EN ATTENTE                                          │
│                                                             │
│   OUI → CRÉER le Runtime Service                            │
│         Ajouter à DOC-001                                   │
│         Mettre à jour DOC-002                               │
│         ARRÊTER                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## TREE 5 : Dois-je créer un Business Pack ?

```
COMMENCE
  │
  ▼
┌─ Q1 : Le besoin correspond-il à un domaine métier             │
│    spécifique (église, école, ONG, entreprise...)?           │
│                                                             │
│   NON → Ce n'est PAS un Business Pack.                      │
│         Peut-être un Template ou une Capability.              │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q2 : Le pack est-il une composition de Capacities existantes│
│    sans en modifier le comportement ?                        │
│                                                             │
│   NON → REJETÉ. Un BP ne MODIFIE jamais les Capacities.      │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q3 : La composition pourrait-elle être utile à                │
│    ≥2 organisations différentes du même domaine ?            │
│                                                             │
│   NON → Trop spécifique. Créer un TEMPLATE à la place.      │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q4 : Le pack ne contient-il AUCUN code exécutable ?          │
│                                                             │
│   NON → REJETÉ. Composition théorique uniquement.            │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q5 : Validation Architecte Principal obtenue ?               │
│                                                             │
│   NON → EN ATTENTE                                          │
│                                                             │
│   OUI → CRÉER le Business Pack                              │
│         Documenter la composition de Capacities             │
│         Lier au Template associé                            │
│         ARRÊTER                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## TREE 6 : Dois-je créer un Template ?

```
COMMENCE
  │
  ▼
┌─ Q1 : Le besoin est-il de la configuration pure               │
│    (vocabulaire, formulaires, workflows, politiques,           │
│     permissions, branding) ?                                 │
│                                                             │
│   NON → Ce n'est PAS un Template.                           │
│         Vérifier Capability ou Domain Model.                  │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q2 : La configuration est-elle réutilisable par               │
│    ≥2 Organisations différentes ?                            │
│                                                             │
│   NON → Trop spécifique. Créer un MANIFEST spécifique à     │
│         l'Organisation.                                      │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q3 : Le template contient-il ZÉRO ligne de code ?            │
│                                                             │
│   NON → REJETÉ. Un Template est du YAML/JSON uniquement.     │
│                                                             │
│   OUI                                                       │
│     │                                                       │
│     ▼                                                       │
┌─ Q4 : Le template est-il instancié depuis un                   │
│    Business Pack existant ?                                  │
│                                                             │
│   NON (non lié à BP)                                        │
│     → Créer un BP d'abord OU                              │
│       Créer directement le Template si usage générique.      │
│                                                             │
│   OUI (lié à BP)                                            │
│     │                                                       │
│     ▼                                                       │
┌─ Q5 : Validation Architecte Principal obtenue ?              │
│                                                             │
│   NON → EN ATTENTE                                          │
│                                                             │
│   OUI → CRÉER le Template                                   │
│         Ajouter à DOC-001                                   │
│         Lier au Business Pack parent                        │
│         ARRÊTER                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ARBORESCENCE DE PRIORITÉ GÉNÉRALE

Quand plusieurs décisions sont possibles, appliquer cette priorité :

```
Priorité 1  → Réutiliser un élément existant (DOC-001)
Priorité 2  → Configurer via Template / Manifest / Policy
Priorité 3  → Composer des Capacities existantes
Priorité 4  → Étendre un Domain Object existant (DOC-006)
Priorité 5  → Créer un nouveau Domain Object
Priorité 6  → Créer une nouvelle table (Data Model)
Priorité 7  → Créer une nouvelle Capability
Priorité 8  → Créer un nouveau Runtime Service
Priorité 9  → Créer un nouveau Concept
Priorité 10 → Modifier la Constitution
```

Règle : **Toujours prendre la priorité la plus haute possible.**
