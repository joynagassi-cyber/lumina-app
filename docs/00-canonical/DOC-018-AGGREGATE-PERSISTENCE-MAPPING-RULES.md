# DOC-018 — Aggregate → Persistence Mapping Rules

**Doc ID:** DOC-018 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — RÈGLES DE TRANSFORMATION IMMUABLES  
**Date:** 2026-07-24  

---

## PRINCIPE

Ce document définit les règles de transformation canoniques qui régissent chaque transition entre le **Domain Model** (Aggregates, Entities, Value Objects) et la **Couche de Persistance** (Persistence Objects, Storage Units).

Il ne décrit AUCUNE technologie de stockage spécifique. Il ne décrit AUCUN SQL, AUCUN schéma de table, AUCUN ORM. Il décrit UNIQUEMENT les règles de mappage entre concepts.

**Règle constitutionnelle fondamentale :** Le Domain Model est l'autorité absolue. La persistance existe POUR le Domain Model, pas l'inverse. Aucune décision de conception ne peut être justifiée par « le storage impose ».

---

## 1. OFFICIAL PIPELINE

### 1.1 Le Pipeline Canonique de Transformation

Quatre étapes successives transforment un objet métier en données stockées :

```
Aggregate → Entity → Persistence Object → Storage Unit
```

Chaque flèche représente une **transformation formelle** avec des règles précises :
- Ce qui est transformé
- Ce qui reste identique
- Ce qui est strictement interdit
- La règle de validation automatisée correspondante

Le pipeline est **unidirectionnel**. Aucune donnée ne remonte du bas vers le haut.

### 1.2 Définitions Formelles des Étapes

| Étape | Objet Source | Objet Cible | Nature de la Transformation |
|-------|-------------|-------------|----------------------------|
| **Étape 0** | Concept (du Conceptual Model) | Aggregate (du Domain Model) | Intentionnelle — le Concept est instancié comme un Aggregate avec Entities, VOs, Services, Policies |
| **Transition 1** | Aggregate (domaine brut) | Entités + Value Objects | *Extraction structurelle* — séparation de l'agrégat en composants identifiables |
| **Transition 2** | Entity (domain pure) | Persistence Object (PO) | *Augmentation storage-aware* — ajout de métadonnées de persistance sans altérer le sémantique métier |
| **Transition 3** | Persistence Object | Storage Unit (document, row, event, snapshot) | *Adaptation au medium* — mapping vers le format concret du moteur de stockage |

### 1.3 Principes Régissant Chaque Transition

Pour TOUTE transition du pipeline :

| Principe | Règle | Justification |
|----------|-------|---------------|
| **Non-rétroactivité** | Aucune couche inférieure ne dicte le design de la couche supérieure | Préserve l'indépendance technologique |
| **Réversibilité conceptuelle** | On peut toujours reconstruire l'Aggregate complet depuis un PO | Le PO contient TOUS les champs nécessaires à la reconstruction |
| **Séparation des responsabilités** | Chaque transition a EXACTEMENT UN propriétaire | Pas de responsabilité partagée entre transitions |
| **Immutabilité du sens** | Le sémantique métier d'un champ ne change JAMAIS entre transitions | "amount" reste "amount" — sa signification ne varie pas |

---

## 2. TRANSITION RULES

### 2.1 Transition 1 — Aggregate → Entity Extraction

#### Objectif

Identifier, à partir d'un Aggregate défini dans `CANONICAL-DOMAIN-MODEL.md`, quelles parties de son état deviennent des **Entities distinctes** et quelles parties restent des **Value Objects intégrés**.

#### Règles d'Extraction

| Règle | Description | Application |
|-------|-------------|-------------|
| **EE-001: Singularité Identitaire** | Une Entity existe quand l'objet a une identité propre indépendante de l'Aggregate parent | `Organization` est une Entity dans `OrganizationAggregate` car elle a un nom, un type, un statut qui l'identifient indépendamment |
| **EE-002: Cycle de Vie Indépendant** | Une Entity existe quand l'objet a un cycle de vie distinct (création, mise à jour, archivage, suppression propres) | `OrgUnit` a un cycle de vie différent de `Organization` — création via `CreateOrgUnit`, déplacement via `UpdateOrgUnitParent`, archivage via `ArchiveOrganization` |
| **EE-003: Relationnalité** | Une Entity existe quand elle est référencée depuis D'AUTRES Aggregates | `User` (Entity dans `IdentityAggregate`) est référencée depuis `ResourceAggregate` (`created_by`), `AuditAggregate` (`userId`) |
| **EE-004: Invariance de Valeur** | Un Value Object existe quand l'objet est identifié PAR sa valeur, pas par un ID | `OrganizationName` est un VO car « Chorus des Espoirs » est identifié par sa valeur textuelle — on ne crée pas de compte pour « Chorus des Espoirs », on lui attribue un org_id |
| **EE-005: Immuabilité Sémantique** | Un Value Object existe quand l'objet ne change jamais, il est recréé | `EmailAddress` est un VO — pour changer d'email, on crée un nouvel `EmailAddress`, on n'« update » pas l'ancien |
| **EE-006: Granularité DDD** | Les Value Objects appartiennent exclusivement à leur Aggregate père — ils ne sont pas référencables externes | `PasswordHash` appartient à `IdentityAggregate`. Un autre Aggregate ne peut pas dire « donne-moi le PasswordHash de cet user » — c'est interdit |
| **EE-007: Domain Services Ne Sont Pas Des Entities** | Les services domainaires (résolveurs, calculateurs, validateurs) n'ont pas d'état persisté | `OrgHierarchyResolver` est un service stateless — jamais une Entity |
| **EE-008: Policies Appartiennent à L'Aggregate** | Les règles de politique sont associées à l'Aggregate mais ne sont pas des Entities séparées | `VisibilityPolicy` réside dans `OrganizationAggregate` — ce n'est pas une Entity distincte |

#### Validation d'Extraction

Toute extraction doit satisfaire AU MOINS une règle EE-001 à EE-003 pour devenir Entity.
Toute extraction doit satisfaire AU MOINS une règle EE-004 à EE-005 pour devenir Value Object.

```
Fonction de validation (pseudo-code):
  function validateEntityExtraction(aggregate, proposedEntity):
    if not matchesAnyRule(proposedEntity, [EE-001, EE-002, EE-003]):
      return REJECT: "L'entité proposée n'a ni identité propre, ni cycle de vie indépendant, ni référence externe"
    if not ensuresSeparation(proposedEntity, aggregate.valueObjects):
      return REJECT: "Le périmètre de l'entité empiète sur celui d'un Value Object"
    return APPROVE
```

#### Vérification Automatique

Le script de vérification `validate-entity-extraction` doit :
1. Parcourir chaque Aggregate de `CANONICAL-DOMAIN-MODEL.md`
2. Pour chaque propriété listée sous "Entities", vérifier que ≤ 1 règle EE-001/EE-002/EE-003 est satisfaite
3. Pour chaque propriété listée sous "Value Objects", vérifier que ≤ 1 règle EE-004/EE-005 est satisfaite
4. Signaler en WARNING toute Entity qui n'est PAS référencée depuis un autre Aggregate (règle EE-003 non satisfaite) — cela peut indiquer un Value Object mal classé

---

### 2.2 Transition 2 — Entity → Persistence Object Augmentation

#### Objectif

Transformer une Entity de domaine brute en un **Persistence Object (PO)** enrichi de métadonnées de stockage, sans jamais altérer son sémantique métier.

#### Structure d'un Persistence Object

Un Persistence Object est composé de trois couches imbriquées :

```
┌─────────────────────────────────────┐
│  COUCHE 1: Domaine pur (identique)  │ ← Exactement les mêmes champs, mêmes types, mêmes contraintes
│  - toutes les Entity fields         │
│  - tous les Value Objects           │
│  - structure et relations natives   │
├─────────────────────────────────────┤
│  COUCHE 2: Métadonnées de Persis.   │ ← Ajoutées UNIQUEMENT par la couche persistance
│  - version (pour optimistic lock)   │
│  - sync_timestamp (pour conflict   │
│    resolution)                      │
│  - consistency_marker (pour offline │
│    sync state tracking)             │
│  - conflict_hints (stratégie de     │
│    résolution par défaut)           │
│  - traceability_id (corrélation     │
│    domain↔storage)                  │
├─────────────────────────────────────┤
│  COUCHE 3: Optimisations Storage    │ ← Dépendantes du medium, jamais visibles par le Domain
│  - index hints (non mappés au       │
│    domain)                          │
│  - partitioning keys                │
│  - compression markers              │
│  - replication scopes               │
└─────────────────────────────────────┘
```

#### Règles d'Augmentation

| Règle | Description | Exemple Correct | Exemple Incorrect |
|-------|-------------|-----------------|-------------------|
| **PA-001: Couche Domaine Intacte** | Les champs du domaine apparaissent tel quel dans le PO | `TransactionRecord.amount` (bigint, > 0) dans le PO garde exactement ce champ, ce type, cette contrainte | `TransactionRecord.amount` devient `transaction_value_float` dans le PO — le type change, la sémantique change |
| **PA-002: Métadonnées Ajoutées Seulement** | Seules les métadonnées de persistance (couche 2) sont ajoutées | Ajout de `__version: number`, `__syncTimestamp: Date` | Ajout de `isActive: boolean` — ce n'est pas une méta de persistance, c'est du domaine |
| **PA-003: Noms de Champs Domaines Immutable** | Un champ de domaine NEVER change de nom entre l'Entity et le PO | `resource_type` → `resource_type` (identique) | `resource_type` → `rtype` dans le PO — le nom change |
| **PA-004: Type Domains Immutable** | Un type de domaine NEVER change entre l'Entity et le PO | `AmountInCents` (BIGINT) → `amount_cents` (BIGINT) — le type de données reste compatible | `AmountInCents` (BIGINT) → `amount_float` (FLOAT) — change la précision, change la sémantique |
| **PA-005: Contraintes Domaines Conservées** | Toute contrainte métier du domaine (validation, invariant) doit persister dans le PO | Si `Email` est unique par `org_id`, le PO conserve cette unicité sémantique | Le PO supprime l'unicité de `email` — la contrainte métier est perdue |
| **PA-006: Optimisations Cachées** | Les optimisations de storage (couche 3) sont STRICTEMENT inaccessibles depuis le Domain Layer | Index sur `(org_id, resource_type)` — invisible du code domain | Domain logic lit `has_been_indexed` — violation de dépendance |
| **PA-007: Aucun New Field from Storage** | La couche persistance ne peut JAMAIS introduire un nouveau champ qui modifie le comportement du Domain | `__traceabilityId: string` est ajouté mais ne change RIEN au comportement | `requires_double_approval: boolean` est ajouté par la persistance — c'est du domaine, pas de la persistance |
| **PA-008: Reconstruction Complète** | À tout moment, un PO doit pouvoir être entièrement reconverti en Entity de domaine (tous les champs) | Depuis un PO de `TransactionRecord`, on reconstruit l'Entity avec TOUT l'état original | Depuis un PO, on ne peut pas reconstruire `compensates_for` car le champ a été élagué |

#### Validation d'Augmentation

```
Fonction de validation (pseudo-code):
  function validateEntityToPO(entity, persistenceObject):
    // Vérifier que tous les champs domaine sont intacts
    for field in entity.allFields():
      poField = persistenceObject.find(field.name)
      if poField == null:
        return REJECT: "Champ domaine '{field.name}' disparu dans le PO"
      if poField.type != field.semanticType():
        return REJECT: "Type sémantique changé pour '{field.name}': {field.type} → {poField.type}"
    
    // Vérifier que seules les métadonnées de persistance sont ajoutées
    for addedField in persistenceObject.extraFields(entity):
      if not isStorageMetadataOnly(addedField):
        return REJECT: "Champ '{addedField.name}' n'est pas une métadonnée de persistance (c'est peut-être du domaine)"
    
    return APPROVE
```

#### Vérification Automatique

Le script de vérification `validate-entity-to-po` doit :
1. Pour chaque Entity de chaque Aggregate de `CANONICAL-DOMAIN-MODEL.md`
2. Identifier tous les champs de la couche Domaine (ENTITÉ + VALUE OBJECTS)
3. Vérifier qu'ils apparaissent TOUS dans le PO correspondant
4. Vérifier qu'aucun champ de persistance n'empiète sur le comportement du domaine
5. Vérifier que la reconstruction Entity ← PO est complète (zéro perte d'information)
6. Reject tout PO où `semanticType(field.domain)` ≠ `semanticType(field.persistenceObject)`

---

### 2.3 Transition 3 — Persistence Object → Storage Unit Mapping

#### Objectif

Transformer un Persistence Object en **Storage Unit** — l'unité concrète de stockage utilisée par le moteur de données.

Cette transition est là où se prennent les compromis de performance, mais les RÈGLES elles-mêmes doivent rester indépendantes du storage.

#### Modes de Mapping

| Mode de Mapping | Description | Utilisation Typique | Règle Clé |
|-----------------|-------------|---------------------|-----------|
| **1:1 Document** | Un PO = un Storage Unit complet | Documents NoSQL, tables avec JSONB | Le Storage Unit contient TOUS les champs du PO + métadonnées de storage |
| **1:N Row Split** | Un PO = plusieurs Storage Units (normalisation) | Tables relationnelles avec foreign keys | Chaque Row contient un sous-ensemble du PO, la jointure reconstruct le PO complet |
| **1:N Event** | Un PO = une séquence d'Events | Event Sourcing | Chaque Event capture un state diff ; la reconstruction du PO se fait par replay |
| **1:1 Snapshot** | Un PO = un snapshot dans un Store de snapshots | State Snapshots dans Event Sourcing | Snapshot capture l'état complet du PO à un instant T |

#### Règles de Mapping au Storage

| Règle | Description | Application |
|-------|-------------|-------------|
| **SM-001: Intégrité Sémantique** | Le Storage Unit ne peut jamais perdre, transformer ou ambiguïser un champ du PO | Si le PO a `amount_cents: BIGINT`, le Storage Unit contient soit directement ce BIGINT, soit une colonne BIGINT qui le porte. Un FLOAT est interdit |
| **SM-002: Réconstructibilité** | Le PO peut toujours être entièrement reconstruit depuis le Storage Unit(s) | En mode 1:N (normalisé), la requête de reconstruction doit retourner TOUS les champs du PO, pas un sous-ensemble |
| **SM-003: Atomicité de Boundary** | Toutes les données d'un même Aggregate ont leur atomicité garantie au niveau storage | Soit tout l'Aggregate est écrit, soit rien ne l'est. On ne peut pas avoir `Organization` écrit et `OrgUnit` non-écrit dans le même commit |
| **SM-004: Isolation par Org** | Les Storage Units sont physiquement ou logiquement isolés par `org_id` | Chaque Storage Unit porte une information d'appartenance org. Les requêtes sans `org_id` sont invalides |
| **SM-005: Séparation Domaine/Méta** | Les métadonnées de persistence (couche 2 du PO) peuvent être stockées différemment des champs domaines (couche 1) | L'index sur `resource_type` (couche 3) n'a pas besoin d'exister dans le PO domain — c'est un détail de storage |
| **SM-006: Versioning Conserve l'Histoire** | Le mécanisme de version du PO est préservé au niveau storage | Si le PO a `version: integer`, le Storage Unit doit supporter soit la version courante, soit le versionning complet (historique) |
| **SM-007: Sync Metadata Persisté** | Les métadonnées de synchronisation (`__syncTimestamp`, `__consistencyMarker`) sont stockées avec les données | Sans ces champs persistés, l'offline sync (INV-003) est impossible |
| **SM-008: No Storage Logic in Domain** | Le format de stockage ne modifie jamais la logique du domaine | Le fait que le PO soit stocké en JSONB vs colonnes séparées ne change RIEN au comportement de l'Aggregate |

#### Validation de Mapping

```
Fonction de validation (pseudo-code):
  function validatePOTostorageUnit(po, storageUnit):
    // Vérifier que tous les champs du PO sont représentés
    for field in po.allFields():
      if not storageUnit.contains(field):
        return REJECT: "Champ '{field.name}' du PO absent du Storage Unit"
    
    // Vérifier la réconstructibilité
    reconstructedPO = storageUnit.reconstruct()
    if po.differsFrom(reconstructedPO):
      return REJECT: "Le PO reconstruit diffère du PO original — perte d'information"
    
    // Vérifier l'atomicité de boundary
    if storageUnit.crossesAggregateBoundary():
      return REJECT: "Le Storage Unit contient des données de plusieurs Aggregates — violation de boundary"
    
    // Vérifier l'isolement org
    if storageUnit.lacksOrgIsolation():
      return REJECT: "Le Storage Unit n'a pas d'isolement org_id — risque de cross-org data leak"
    
    return APPROVE
```

#### Vérification Automatique

Le script de vérification `validate-po-to-storage` doit :
1. Pour chaque PO défini dans `DOC-017-PERSISTENCE-MODEL.md`
2. Pour chaque Storage Unit qui le contient (dans le schéma de stockage)
3. Vérifier que la reconstruction PO ← Storage Unit produit TOUS les champs originaux
4. Vérifier qu'aucun Storage Unit ne mélange des Aggregates différents
5. Vérifier que chaque Storage Unit a une information d'isolement `org_id`
6. Vérifier que le mécanisme de version est préservé (optimistic locking ou event history)

---

## 3. MAPPING CONSTRAINTS (Règles d'Or de la Persistance)

Les sept contraintes suivantes s'appliquent de manière universelle, à TOUTES les transitions et TOUTS les Aggregates. Leur violation est toujours un rejet immédiat.

---

### M-001: Un Persistence Object ne crée jamais un Aggregate

**Nature:** Contrainte d'existence  
**Seuil:** CRITIQUE

Un Persistence Object est une représentation stockable d'un Aggregate préexistant. Il ne PEUT pas définir un nouvel Aggregate qui n'existerait pas dans le Domain Model.

**Violation typique :** Créer un PO `CrossOrgConsolidationPO` sans que `ConsolidationAggregate` n'existe dans `CANONICAL-DOMAIN-MODEL.md`.

**Règle de détection :** Tout PO doit pointer vers un Aggregate existant dans `CANONICAL-DOMAIN-MODEL.md`.

```
function validateM001(persistenceObject):
  aggregate = findAggregateByPO(persistenceObject)
  if aggregate == null:
    return REJECT: "PO '{persistenceObject.name}' n'a pas d'Aggregate Domain correspondant"
  return APPROVE
```

---

### M-002: Un Persistence Object ne crée jamais un Concept

**Nature:** Contrainte conceptuelle  
**Seuil:** CRITIQUE

Même si l'Aggregate existe, le PO ne peut pas inventer un nouveau **Concept** du `Conceptual Model`. Les Concepts sont uniquement définis dans le `Conceptual Model`.

**Violation typique :** Un PO ajoute un champ `consolidationStrategy` qui crée implicitement un nouveau Concept `ConsolidationStrategy` sans qu'il existe dans `DOC-CONCEPTUAL-MODEL-V1`.

**Règle de détection :** Tout champ métier dans un PO doit correspondre à un Concept catalogué ou à un Value Object existant.

```
function validateM002(persistenceObject):
  for field in persistenceObject.businessFields():
    if not isKnownConceptOrValueObject(field):
      return REJECT: "Champ métier '{field.name}' dans PO '{persistenceObject.name}' ne correspond à aucun Concept catalogué"
  return APPROVE
```

---

### M-003: La persistance ne définit jamais les règles métier

**Nature:** Contrainte de responsabilité  
**Seuil:** CRITIQUE

Toutes les règles métier (`Business Rules` listées dans `CANONICAL-DOMAIN-MODEL.md`, invariants de `DOMAIN-INVARIANT-REGISTRY.md`) résident dans le Domain. La persistance les **préserve**, elle ne les **définit** pas.

**Violation typique :** Une contrainte CHECK dans le storage « amount > 0 » alors que la règle correspondante (`FIN-002`) est définie dans le Domain comme invariant. La DB la *réplique* pour défense en profondeur, mais elle ne la *définit* pas.

**Règle de détection :** Toute règle métier apparaissant DANS la définition d'un PO (et non dans l'Aggregate correspondant) est une violation.

```
function validateM003(persistenceObject):
  aggregate = findAggregateForPO(persistenceObject)
  domainRules = aggregate.businessRules()
  storageRules = persistenceObject.storageConstraints()
  
  for rule in storageRules:
    if not ruleExistsIn(domainRules, rule):
      return REJECT: "Règle métier '{rule}' définie au niveau storage — doit être dans l'Aggregate"
  
  return APPROVE
```

---

### M-004: Les invariants restent dans le Domain

**Nature:** Contrainte d'autorité  
**Seuil:** CRITIQUE

Les Domain Invariants (DOC-015) sont les sources uniques de vérité pour chaque règle immuable. Le storage peut les **répliquer** (pour défense en profondeur) mais jamais les **modifier**, **affaiblir**, ou **remplacer**.

**Violation typique :** Un invariant critique `FIN-001` (immutabilité comptable) est affaibli au niveau storage par une contrainte `CHECK` qui permet `UPDATE` sur une transaction « approved ».

**Règle de détection :** Chaque invariant de `DOMAIN-INVARIANT-REGISTRY.md` doit avoir un gardien dans l'Aggregate. Le storage peut avoir un gardien second (dupliqué), mais jamais un gardien premier (remplaçant).

```
function validateM004(invariantRegistry, aggregates, persistenceLayers):
  for invariant in invariantRegistry.criticalInvariants():
    domainGuard = findDomainGuard(invariant, aggregates)
    storageGuard = findStorageGuard(invariant, persistenceLayers)
    
    if domainGuard == null:
      return REJECT: "Invariant '{invariant.id}' n'a pas de gardien dans le Domain"
    
    if storageGuard != null and isWeakerThan(storageGuard, domainGuard):
      return REJECT: "Storage guard pour '{invariant.id}' est plus faible que le domain guard"
  
  return APPROVE
```

---

### M-005: Les Events ne sont jamais définis par la persistance

**Nature:** Contrainte de source  
**Seuil:** CRITIQUE

Les Domain Events (DOC-014) sont définis exclusivement dans le Domain. La persistance les **transporte** (serialisation), mais ne les **définit** jamais.

**Violation typique :** Un PO ajoute un champ `eventType` qui sert à déterminer quelle logique appliquer — la logique d'événement devrait être dans le Domain, pas dans le format de stockage.

**Règle de détection :** Tout événement listé dans un PO doit exister dans le `DOMAIN-COMMAND-EVENT-REGISTRY.md`.

```
function validateM005(persistenceObject):
  for domainEvent in persistenceObject.emittedEvents():
    if not registryContains(event, DOMAIN_EVENT_REGISTRY):
      return REJECT: "Event '{event.name}' émis depuis le PO n'existe pas dans le registre officiel"
  return APPROVE
```

---

### M-006: Les Policies ne sont jamais déplacées vers la persistance

**Nature:** Contrainte de localisation  
**Seuil:** CRITIQUE

Les Policies qui régissent le comportement des Aggregates résident dans le Domain. On ne déplace JAMAIS une policy du Domain vers la couche de persistance.

**Violation typique :** Implémenter `MaxDepthPolicy` (depth ≤ 5) uniquement dans un trigger DB, sans garde correspondante dans le Domain Layer. La garde DB est une défense en profondeur, pas un remplacement.

**Règle de détection :** Toute Policy listée dans un Aggregate (DOC-013, AGGREGATE-BOUNDARY-SPECIFICATION.md) doit avoir une implémentation explicite dans le code Domain.

```
function validateM006(aggregates, persistenceLayer):
  for aggregate in allAggregates():
    for policy in aggregate.policiesUsed():
      if not hasDomainImplementation(policy):
        return REJECT: "Policy '{policy.name}' n'a pas d'implémentation dans le Domain — seule présence storage détectée"
  return APPROVE
```

---

### M-007: Aucun Aggregate ne dépend du mode de stockage

**Nature:** Contrainte d'indépendance  
**Seuil:** CRITIQUE

Un Aggregate doit fonctionner identiquement quel que soit le storage choisi (PostgreSQL, SQLite, Document DB, Event Store). La signature des Commands, des Events, des Entities et des Value Objects ne doit jamais varier avec le storage.

**Violation typique :** Définir `GetTransactionsSince(timestamp)` comme méthode d'Aggregate lorsque l'implémentation sous-jacente change selon que le storage supporte les queries temporelles ou non.

**Règle de détection :** Si on change le storage de PostgreSQL à un store alternative, aucun test de l'Aggregate ne doit être modifié.

```
function validateM007(aggregate, storageImplementations):
  for implementation in storageImplementations:
    // L'Aggregate se comporte-t-il identiquement ?
    behaviorSnapshotA = aggregate.behaviorWith(storage: implementation.A)
    behaviorSnapshotB = aggregate.behaviorWith(storage: implementation.B)
    
    if behaviorSnapshotA.differsFrom(behaviorSnapshotB):
      return REJECT: "Comportement de l'Aggregate '{aggregate.name}' dépend du storage"
  
  return APPROVE
```

---

### M-008: La cohérence transactionnelle suit les Aggregates, pas le storage

**Nature:** Contrainte de boundary transactionnel  
**Seuil:** CRITIQUE

Une transaction ACID au niveau storage ne doit jamais跨越 des boundaries d'Aggregates différents. La cohérence forte est garantie PAR Aggregate. Entre Aggregates, la cohérence est éventuelle (via Events).

**Violation typique :** Une seule transaction DB qui insère dans `organizations`, `users`, et `audit_logs` simultanément. Les three sont trois Aggregates distincts — cette transaction cross-aggregate est interdite.

**Règle de détection :** Une transaction de storage ne doit contenir d'écritures que pour des PO appartenant AU MÊME Aggregate.

```
function validateM008(transaction, persistenceObjects):
  aggregates = set(persistenceObjects.map(po => po.aggregate))
  if aggregates.size > 1:
    return REJECT: "Transaction cross-aggregate détectée: {aggregates.toList()}"
  return APPROVE
```

---

## 4. VALIDATION AUTOMATIQUE PAR TRANSITION

### 4.1 Pipeline de Validation Complet

```
┌──────────────────────────────────────────────────────────────────┐
│                    VALIDATION PIPELINE                           │
│                                                                  │
│  Domain Model Stable? ──NON──→ STOP                              │
│          │ OUI                                                   │
│          ▼                                                        │
│  Transition 1: ValidateEntityExtraction()                        │
│  ├─ EE-001 à EE-008 appliquées                                  │
│  ├─ Chaque Entity identifiée satisfait ≥1 de EE-001/002/003     │
│  ├─ Chaque VO identifié satisfait ≥1 de EE-004/005              │
│  └─ Result: PASS / FAIL / WARN                                  │
│          │                                                        │
│          ▼ (si PASS ou WARN avec justification)                  │
│  Transition 2: ValidateEntityToPO()                              │
│  ├─ PA-001 à PA-008 appliquées                                  │
│  ├─ Tous les champs domaine intacts                              │
│  ├─ Métadonnées de persistance uniquement ajoutées               │
│  ├─ Reconstruction complète vérifiée                             │
│  └─ Result: PASS / FAIL                                         │
│          │                                                        │
│          ▼ (si PASS)                                             │
│  Transition 3: ValidatePOtoStorageUnit()                         │
│  ├─ SM-001 à SM-008 appliquées                                  │
│  ├─ Intégrité sémantique conservée                               │
│  ├─ Réconstructibilité PO ← Storage Unit vérifiée               │
│  ├─ Atomicity de boundary respectée                              │
│  └─ Result: PASS / FAIL                                         │
│          │                                                        │
│          ▼ (si PASS)                                             │
│  Global Constraints: M-001 à M-008                               │
│  ├─ M-001: Pas d'Aggregate inventé via PO                       │
│  ├─ M-002: Pas de Concept inventé via PO                        │
│  ├─ M-003: Pas de rules métier définies par persistance          │
│  ├─ M-004: Invariants conservés dans le Domain                   │
│  ├─ M-005: Events non définis par la persistance                 │
│  ├─ M-006: Policies non déplacées vers la persistance            │
│  ├─ M-007: Independent of storage mode                           │
│  └─ M-008: Transactional consistency follows Aggregates           │
│          │                                                        │
│          ▼                                                        │
│  RESULTAT GLOBAL: APPROVED / REJECTED                            │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Spécifications des Scripts de Validation

#### Script: `validate-entity-extraction`

**Entrée :** `CANONICAL-DOMAIN-MODEL.md` (registres des 13 Aggregates)  
**Sortie :** Rapport par Aggregate —_entities_, _value_objects_, warnings

**Checks exécutés :**
1. Pour chaque Aggregate, compter les Entity et VO listés
2. Vérifier que chaque Entity correspond à EE-001 OU EE-002 OU EE-003
3. Vérifier que chaque VO correspond à EE-004 OU EE-005
4. Vérifier que les Domain Services ne sont pas listés comme Entities
5. Vérifier que les Policies ne sont pas listées comme Entities
6. Signaler en WARNING toute Entity non référencée depuis un autre Aggregate
7. Vérifier que la somme Entities + VOs couvre TOUT l'état de l'Aggregate (pas de state perdu)

**Score de conformité :** (Entities validées + VOs validés) / (Total Entities + Total VOs) × 100  
**Seuil d'approbation :** ≥ 90%

---

#### Script: `validate-entity-to-po`

**Entrée :** Chaque Entity de `CANONICAL-DOMAIN-MODEL.md` + son Persistence Object correspondant de `DOC-017-PERSISTENCE-MODEL.md`  
**Sortie :** Rapport par PO — _champs perdus_, _champs ajoutés illégalement_, _types modifiés_

**Checks exécutés :**
1. Field parity check : chaque field domain → field équivalent dans PO
2. Semantic type preservation : le type logique ne change pas (BIGINT ≠ FLOAT, ENUM ≠ STRING libre)
3. Storage metadata identification : lister toutes les propriétés ajoutées, valider que chacune est bien une méta de storage (PA-002)
4. Domain-only field contamination : aucun champ de domaine ne ressemble à un champ de storage (PA-007)
5. Reconstruction completeness : simulation de reconstruction PO → Entity, vérifier zéro perte
6. Naming convention : les champs domaines gardent leurs noms canoniques (PA-003)

**Score de conformité :** (champs domains préservés correctement / total champs domain) × 100  
**Seuil d'approbation :** 100% — aucune tolérance pour la perte de champs

---

#### Script: `validate-po-to-storage-unit`

**Entrée :** Persistence Objects + schéma de storage (quel qu'il soit)  
**Sortie :** Rapport par Storage Unit — _champs manquants_, _boundary violations_, _org isolation gaps_

**Checks exécutés :**
1. Full coverage : tous les champs du PO sont dans le Storage Unit (SM-001)
2. Reconstructibility test : query complète → reconstruire PO entier (SM-002)
3. Cross-aggregate detection : le Storage Unit ne contient que des PO du même Aggregate (SM-003)
4. Org isolation check : chaque write read inclut org_id (SM-004)
5. Storage vs domain layer separation : les index/partitions ne sont pas exposés au domain (SM-006)
6. Sync metadata persisted : les champs de sync sont bien stockés (SM-007)

**Score de conformité :** (Storage Units conformes / total Storage Units) × 100  
**Seuil d'approbation :** 100%

---

#### Script: `validate-global-constraints`

**Entrée :** Domain Model + Persistence Model + Command/Event Registry + Invariant Registry  
**Sortie :** Rapport global — violations M-001 à M-008

**Checks exécutés :**
1. **M-001** : Liste tous les PO, vérifie l'existence de l'Aggregate correspondant dans CANONICAL-DOMAIN-MODEL.md
2. **M-002** : Pour chaque PO, vérifie que les business fields correspondent à des Concepts/V Os catalogués
3. **M-003** : Compare les storage constraints avec les business rules du Domain — détecter celles définies au mauvais niveau
4. **M-004** : Pour chaque CRITIQUE invariant, vérifier qu'un guardian domain existe
5. **M-005** : Pour chaque événement émis par un PO, vérifier qu'il est dans le registres DOC-014
6. **M-006** : Pour chaque Policy d'un Aggregate, vérifier qu'elle est implémentée au moins dans le Domain
7. **M-007** : Vérifier que le modèle de données est compatible avec au moins deux modes de storage alternatifs
8. **M-008** : Scanner toutes les transactions de storage — aucune ne doit écrire dans des Aggregates différents

**Score de conformité :** (contraintes non-violées / 8) × 100  
**Seuil d'approbation :** 100% — chaque règle M-001 à M-008 doit être strictement respectée

---

## 5. VIOLATION PATTERNS

Cette section liste les violations les plus courantes observées lors des implémentations réelles, avec leur signature de détection et leur traitement recommandé.

### VP-01: Persistence-Driven Design

**Signatures :**
- Un PO est créé en premier, l'Aggregate est ensuite adapté pour correspondre
- Le schema de storage dicte la structure de l'Entity (colonnes → classes)
- Les queries SQL sont écrites avant les Commands Domain

**Détection automatique :** Vérifier l'ordre chronologique de création des fichiers — si le fichier de Persistence Model precede le fichier de Domain Model pour le même Aggregate → flag.

**Traitement :** Rejeter. Recaler : le Domain Model doit Toujours précéder le Persistence Model dans le pipeline décisionnel (étape 6 avant étape 7 du DOC-008).

---

### VP-02: Entity Blending (Domain + Storage Fields Mélangés)

**Signatures :**
- Une classe Entity contient à la fois des champs métier ET des champs `__version`, `__syncTimestamp` mélangés
- Pas de séparation claire entre couuche Domaine et couche Persistance dans le code
- Les Value Objects contiennent des métadonnées de storage

**Détection automatique :** Scanner les définitions d'Entités pour détecter les champs `_` ou `__` prefixés (convention de nommage PO) dans des classes qui devraient être pures domain.

**Traitement :** Rejeter. Séparer : l'Entity reste pure domain, le PO est un objet distinct qui compose l'Entity + métadonnées.

---

### VP-03: Event Definition Migration

**Signatures :**
- La définition d'un Domain Event apparaît dans un fichier de migration/storage
- Le payload d'un event est déterminé par le schema de table, pas par le Domain
- Un event change de forme parce que le storage a changé

**Détection automatique :** Comparer les events définis dans `DOMAIN-COMMAND-EVENT-REGISTRY.md` avec ceux émis depuis les couches de storage. Toute divergence de payload → flag.

**Traitement :** Rejeter. Les events sont définis dans le Domain. Le storage les sérialise, il ne les définit pas.

---

### VP-04: Policy Drift

**Signatures :**
- Une Policy listée dans `AGGREGATE-BOUNDARY-SPECIFICATION.md` n'a pas de guard code correspondant
- Une Policy est implémentée au niveau storage (trigger, constraint) mais pas au niveau domain
- L'implemention storage est plus permissive que la Policy domain

**Détection automatique :** Cross-reference la liste des `Policies utilisées` de chaque Aggregate avec les guards implémentés dans le Domain Layer et la liste des constraints du storage.

**Traitement :** Critique si la Policy est uniquement au storage. Ajouter le guard Domain. Le storage guard reste en défense en profondeur, mais ne remplace jamais le guard domain.

---

### VP-05: Aggregation Boundary Breach

**Signatures :**
- Un Storage Unit contient des données de deux Aggregates différents (cross-aggregate join dans la même ligne/table sans clear ownership)
- Une transaction write touche des PO de trois Aggregates simultanément
- Un PO contient une référence directe à l'état interne d'un autre Aggregate

**Détection automatique :** Analyzer les queries write — si une seule transaction inclut des writes dans des PO de `AggregateA` et `AggregateB` → flag.

**Traitement :** Rejeter. Coherency inter-Aggregate se fait via Events (coherency éventuelle), jamais via transactions cross-aggregate.

---

### VP-06: Semantic Type Loss

**Signatures :**
- `AmountInCents` (BIGINT) stocké comme `amount` (FLOAT) dans le storage
- `EmailAddress` (validé par regex) stocké comme `email` (string libre) sans validation
- `JWTToken` (ephemeral, encrypted) stocké en clair

**Détection automatique :** Pour chaque field du Domain Model avec un type spécifique (BIGINT, enum, regex-validated), vérifier que le type équivalent dans le PO préserve la même sémantique.

**Traitement :** Critique pour les types financiers (BIGINT→FLOAT). Major pour les types validés. Rejeter et corriger le mapping.

---

### VP-07: Org Isolation Gap

**Signatures :**
- Une query de retrieval de PO n'inclut pas `org_id` dans le filter
- Un Storage Unit n'a pas d'index ou contrainte garantissant l'isolement org
- Un PO peut être lu sans connaître `org_id`

**Détection automatique :** Scanner toutes les operations de lecture/écriture de PO — chacune doit injecter `org_id` soit explicitement, soit via contexte transitoire (Request Context).

**Traitement :** Critique. INV-004 (isolement multi-tenant) est un invariant fondamental. Chaque PO read/write doit être taggé avec `org_id`.

---

### VP-08: Reconstruction Failure

**Signatures :**
- Après un roundtrip Entity → PO → Storage → Read PO → Entity, l'état final diffère de l'état initial
- Des champs `null` apparaissent après la lecture storage alors qu'ils étaient sets
- Les Value Objects intégrés sont perdus lors de la déserialization

**Détection automatique :** Test de roundtrip systématique pour chaque Aggregate: build Entity → serialise en PO → simule write/read storage → deserialize en PO → compare avec original.

**Traitement :** Major si perte de champs mineurs. Critique si perte de champs business ou de Value Objects. Le roundtrip doit produire un objet identique (equality check).

---

## ANNEXE A: Matrice de Responsabilité par Transition

| Transition | Propriétaire | Artéfacts validés | Script de validation |
|------------|-------------|-------------------|---------------------|
| Aggregate → Entity | Architecte Domain | `CANONICAL-DOMAIN-MODEL.md`, Boundary specs | `validate-entity-extraction` |
| Entity → PO | Architecte Persistance | PO definitions, mapping specs | `validate-entity-to-po` |
| PO → Storage Unit | Architecte Data | Schema de storage, migration files | `validate-po-to-storage-unit` |
| Global M-001 à M-008 | Chief Architect | L'ensemble du pipeline | `validate-global-constraints` |

## ANNEXE B: Relations Croisées avec les Documents Constitutionnels

| Doc Cible | Référence | Relation avec DOC-018 |
|-----------|-----------|----------------------|
| `CANONICAL-DOMAIN-MODEL.md` (DOC-012) | Source des 13 Aggregates | Fournit les Entités et VOs en entrée de la Transition 2 |
| `AGGREGATE-BOUNDARY-SPECIFICATION.md` (DOC-013) | Frontières des Aggregates | Fournit les Policies en entrée de la validation M-006 |
| `DOMAIN-COMMAND-EVENT-REGISTRY.md` (DOC-014) | Commands et Events | Fournit les Events en entrée de la validation M-005 |
| `DOMAIN-INVARIANT-REGISTRY.md` (DOC-015) | Invariants business | Fournit les garants en entrée de la validation M-004 |
| `CANONICAL-MAPPING-RULES.md` (DOC-004) | Règles de ponts canoniques | Le Pont 9 (Manifest → Domain) et Pont 10 (Domain → Data) sont les parents hiérarchiques du pipeline DOC-018 |
| `ARCHITECTURE-DECISION-CONSTITUTION.md` (DOC-008) | Pipeline décisionnel 9 étapes | L'étape 6 (Domain Model) précède l'étape 7 (Data Model) — DOC-018 régit la transition entre les deux |

## ANNEXE C: Règles Spécifiques par Aggregate (Extraits)

### OrganizationAggregate
- Entity `Organization` → PO: ajout de `__version`, `__syncTimestamp`
- Entity `OrgUnit` → PO: ajout de `__version`, `__syncTimestamp`, `__parentLinkReference` (lien vers autre PO `Organization` — ne crossing aggregate boundary in write path)
- Value Object `OrganizationSettings` → PO: stocké comme JSONB structuré (mode 1:1)

### IdentityAggregate
- Entity `User` → PO: ajout de `__version`, `__syncTimestamp`, `__lastLoginAt` (tracking, pas domaine)
- Value Object `PasswordHash` → PO: toujours chiffré, jamais en clair (PA-001, SM-001)
- Value Object `SessionContext` → PO: TTL basé sur `expiresAt` — pas de delete, только expiration naturelle

### ResourceAggregate
- Entity `TransactionRecord` → PO: ajout de `__version`, `__syncTimestamp`, `__consistencyMarker`
- Value Object `AmountInCents` → PO: BIGINT préservé strictement (VP-06 critique)
- Value Object `ResourceState` → PO: state machine conservée, transitions validées au level domain AVANT write (VP-04)

### OfflineSyncAggregate
- Entity `PendingOperation` → PO:本身就 est un PO — entité spécialisée avec `sync_status`, `push_batch_index`
- Value Object `ConflictStrategy` → PO: stocké comme enum string (LWW/server_wins/etc.)
- Value Object `OperationPayload` → PO: snapshot JSON brut du resource concerné (PA-008: reconstruction complète requise)

---

**Fin du document DOC-018.**

Ce document est constitutional. Toute modification nécessite un amendement signé par le CTO et l'Architecte Principal, suivant le pipeline de la `ARCHITECTURE-DECISION-CONSTITUTION.md` (DOC-008).
