# DOC-022 — Règles de Mapping Persistence Object → Modèle Physique des Données

**Doc ID:** DOC-022 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — RÈGLES DE MAPPING PHYSIQUE IMMUABLES  
**Date:** 2026-07-24  

---

## PRÉAMBULE

Ce document définit les règles canoniques de transformation entre les **Persistence Objects** (définis dans DOC-017) et le **Modèle Physique des Données** (PDM, défini dans DOC-021). Il ne définit AUCune syntaxe SQL, AUCun type de données spécifique, AUCune contrainte de schéma. Il définit UNIQUEMENT les principes de mappage qui restent valables quel que soit le moteur physique choisi (relationnel, documentaire, événementiel, clé-valeur).

**Règle fondamentale :** Le Persistence Object est l'autorité absolue. Le Modèle Physique existe POUR représenter les PO fidèlement, pas pour les restructurer. Aucune décision physique ne peut être justifiée par « le schéma impose ».

Ce document est le chaînon final du pipeline canonique :

```
Concept → Aggregate → Entity/VO → Persistence Object → Physical Object → Structure Relationnelle
                                                                    ↑
                                                              Ce document régit cette transition
```

---

## 1. PIPELINE CANONIQUE OFICIEL

### 1.1 La Chaîne de Transformation Finale

Trois transitions distinctes forment la chaîne de persistance complète. DOC-018 a déjà régi les deux premières. Ce document régule la troisième et complète la vue d'ensemble.

| Étape | Source | Cible | Document Régissant | Nature |
|-------|--------|-------|-------------------|--------|
| **Transition A** (DOC-018 §2.1) | Aggregate du Domaine | Entités + Value Objects | DOC-018, règles EE-001 à EE-008 | Extraction structurelle |
| **Transition B** (DOC-018 §2.2) | Entité du Domaine | Persistence Object (PO) | DOC-018, règles PA-001 à PA-008 | Augmentation storage-aware |
| **Transition C** (DOC-022 §2) | Persistence Object | Objet Physique + Structure Relationnelle | DOC-022, règles PM-001 à PM-015 | Adaptation au support physique |

### 1.2 Définitions de la Transition C

| Terme | Définition |
|-------|-----------|
| **Objet Physique** | La représentation concrète du PO dans le modèle physique. Un objet physique n'est jamais identique à un PO (la structure physique doit tenir compte des compromis de performance), mais il est toujours isomorphe au PO (aucune information perdue). |
| **Structure Relationnelle** | L'organisation des objets physiques en relations logiques (appartenance, référence, collection, séquence, agrégation). Ce n'est pas un schéma SQL — c'est une description conceptuelle des liens entre entités physiques. |
| **Transformation** | Le processus de création d'un Objet Physique à partir d'un PO. Chaque transformation respecte les règles PM ci-dessous. |
| **Isostructure** | La propriété selon laquelle un Objet Physique contient exactement les mêmes informations qu'un PO, organisées différemment selon les contraintes physiques, sans ajout ni suppression sémantique. |

### 1.3 Principes Régissant la Transition C

Pour TOUTE application des règles de ce document :

| Principe | Règle | Justification |
|----------|-------|---------------|
| **Isostructure** | L'objet physique contient toutes les informations du PO, aucune de plus (au sens sémantique) | Garantit la reconstruction parfaite du PO depuis le physique |
| **Non-rétroactivité** | Le modèle physique ne modifie JAMAIS un PO existant | Les PO sont l'autorité — le physique les adapte, ne les change pas |
| **Stockage-agnosticisme** | Les règles fonctionnent sur tout moteur physique | Pas de dépendance à PostgreSQL, SQLite, ou tout autre moteur |
| **Composabilité** | Un objet physique peut être organisé en plusieurs structures relationnelles (normalisation) tant que la recomposition reconstruit le PO complet | Permet la flexibilité tout en préservant l'intégrité |
| **Metadata-first** | Les métadonnées de persistance du PO (couche 2 de DOC-017 §3.2) ont des règles de mapping spécifiques, différentes des champs domaine (couche 1) | Les timestamps de sync, les numéros de version, et les flags tombstone ont des traitements physiques particuliers |

---

## 2. RÈGLES DE TRANSITION

### 2.1 Transition Persistable Object → Objet Physique

#### Objectif

Transformer chaque couche du Persistence Object en sa représentation physique équivalente. Le PO porte trois couches (DOC-018 §2.2) ; chacune a des règles de mapping propres.

#### 2.1.1 Couche Domaine → Attributs Physiques Domaines

Tous les champs de domaine du PO (entités, value objects, relations natives) mappent en attributs physiques avec les règles suivantes :

| Règle | Description | Application |
|-------|-------------|------------|
| **PM-DOM-001: Identité de Champ** | Chaque champ domaine du PO devient EXACTEMENT UN attribut physique portant le même nom sémantique | `amount_cents` dans le PO → un seul attribut physique nommé `amount_cents` (ou son équivalent canonique local). Aucun regroupement, aucun fractionnement, aucun renommage sémantique. |
| **PM-DOM-002: Conservation du Type Sémantique** | Le type logique d'un champ domaine est préservé dans l'attribut physique | `AmountInCents` (entier positif) reste un type entier dans le physique. `EmailAddress` (validé par pattern) garde sa validation. `PasswordHash` (chiffé) reste chiffré en stockage. Le choix du type technique (BIGINT, VARCHAR, TEXT, JSONB…) est un détail de mise en oeuvre, mais la sémantique est rigide. |
| **PM-DOM-003: Préservation des Value Objects Imbriqués** | Les Value Objects du PO mappent soit comme attributs plats, soit comme groupes d'attributs structurés — jamais comme des objets physiques séparés | `OrganizationSettings` (currency, timezone, language…) peut devenir un unique JSONB structuré OU plusieurs colonnes plates (`currency`, `timezone`, `language`). Les deux choix sont valides. Le choix doit être justifié par la fréquence d'accès (si on lit toujours tous les settings ensemble → JSONB ; si on filtre souvent par `currency` seulement → colonnes plates). |
| **PM-DOM-004: Relations Natives Conservées** | Les relations entre entités d'un même Aggregate sont mappées comme des références internes | `OrgUnitParentLink.parent_unit_id` dans le PO devient une référence physique vers l'objet physique représentant l'`OrgUnit` parent. Cette référence est interne à l'Aggregate — elle ne traverse JAMAIS les limites d'Aggregate. |
| **PM-DOM-005: Immutabilité de l'Idéntity Domains** | L'identité d'une entité domaine (définie par la boundary de l'Aggregate) se traduit en une clé physique unique au sein de l'org | L'`Organization` identifiée par `org_id` dans le PO devient physiquement identifiable par la combinaison `(org_id, _type)` au minimum. La méthode exacte (colonne unique, index unique, contrainte d'unicité composite) est au choix du modèle physique. |

#### 2.1.2 Couche Métadonnées de Persistance → Attributs Physiques de Persistance

Les métadonnées de persistance (DOC-017 §3.3) mappent avec des règles spécifiques :

| Règle | Description | Mapping PO → Physique |
|-------|-------------|----------------------|
| **PM-MET-001: `_persist_version`** | Devient un attribut numérique de contrôle de concurrence | Cet attribut existe systématiquement sur tout objet physique portant un PO qui utilise le versionning optimiste. |
| **PM-MET-002: `_sync_timestamp`** | Devient un attribut temporel UTC de dernière synchronisation | Cet attribut est indexé pour supporter les requêtes delta pull. |
| **PM-MET-003: `_local_timestamp`** | Devient un attribut temporel UTC de dernière modification locale | Utilisé uniquement pour la résolution de conflits LWW. Non indexé sauf si les conflits LWW sont fréquents. |
| **PM-MET-004: `_conflict_strategy`** | Devient un attribut de stratégie de résolution | Peut être dérivé du type de ressource plutôt que stocké explicitement (optimisation autorisée). |
| **PM-MET-005: `_tombstone`** | Devient un marqueur physique d'exclusion | Exclut l'objet des requêtes normales, inclus dans les opérations de sync de suppression. |
| **PM-MET-006: `_purge_date`** | Devient un attribut temporel de déclenchement de purge | Utilisé par le planificateur de purge ; indexé si la purge est exécutée par requête physique directe. |
| **PM-MET-007: `_log_sequence`** | Devient un attribut séquentiel d'ordre | Uniquement pour les objets en mode Immutable Log (AuditAggregate). Séquence monotone incrémentale. |
| **PM-MET-008: `_org_id`** | Devient l'attribut d'isolement multi-tenant fondamental | Injecté à chaque écriture, validé à chaque lecture. Présent sur TOUS les objets physiques. Indexé systématiquement. |
| **PM-MET-009: `_sync_status`** | Devient un attribut d'état de synchronisation | Utilisé par le push coordinator pour filtrer les opérations. Valeurs : pending, sent, confirmed, failed. |
| **PM-MET-010: `_created_by`** | Devient un attribut d'identité d'audit transversal | Référence l'objet physique User correspondant (dans IdentityAggregate). |

#### 2.1.3 Couche Optimisations Storage → Métadonnées Physiques Cachées

Les optimisations de storage (DOC-018 §2.2, Couche 3) mappent avec des règles d'invisibilité :

| Règle | Description | Application |
|-------|-------------|------------|
| **PM-OPT-001: Invisibilité Domaine** | Toute optimisation de storage (partitioning, compression, index hints, replication scopes) est STRICTEMENT invisible au Domain Layer | Les attributs physiques créés par ces optimisations existent uniquement dans le modèle physique. Aucun code domain ne les lit, ne les écrit, ne les consulte. |
| **PM-OPT-002: Partitioning Key** | Si le PO est partitionné physiquement, la ou les clés de partition doivent être un sous-ensemble des attributs déjà mappés depuis le PO (principalement `org_id`) | On ne crée jamais un attribut physique de partitioning qui n'a pas d'équivalent domain ou meta dans le PO. |
| **PM-OPT-003: Compression Markers** | Les indicateurs de compression sont des métadonnées physiques qui ne modifient pas la structure visible | Un attribut compressé est physiquement compressé mais logiquement identique à l'attribut non-compressé. |

### 2.2 Transition Objet Physique → Structure Relationnelle

#### Objectif

Organiser les Objets Physiques en structures relationnelles cohérentes. Cette section définit les règles d'organisation, pas la syntaxe de création.

#### 2.2.1 Règles d'Organisation Relationnelle

| Règle | Description | Application |
|-------|-------------|------------|
| **PM-REL-001: Atomicité Aggregate** | Les objets physiques provenant du même Aggregate peuvent être regroupés dans la même structure relationnelle, mais ne doivent jamais être mélangés avec des objets d'Aggregates différents dans la même ligne/record/document | L'OrganizationAggregate et ses objets (Organization, OrgUnit, OrganizationSettings) peuvent vivre dans la même structure. Mais ils ne peuvent jamais partager une ligne avec un objet de l'IdentityAggregate. |
| **PM-REL-002: Références Inter-Aggregates par Clé, Pas par Jointure** | Les références entre Aggregates s'expriment par des clés physiques (références vers l'ID de l'autre objet physique), jamais par des jointures implicites au niveau structural | Un objet physique ResourceAggregate qui référence un User stocke l'ID physique de l'utilisateur, pas une jointure intégrée. La jointure est une opération de requête, pas une caractéristique structurelle. |
| **PM-REL-003: Propagation de l'Isolement Org** | Toute structure relationnelle contenant des objets physiques porte avec elle la capacité d'isoler par org_id | Si une structure peut contenir des objets de plusieurs orgs, elle doit inclure org_id comme attribut de partition ou d'isolement. Si chaque structure est mon-org, l'isolement est structurel. |
| **PM-REL-004: Collections Bornées** | Une collection physique doit avoir une borne supérieure connue ou gérable | L'Embedded Collection de OrgUnit dans OrganizationAggregate est bornée à ~100 unités. Un objet physique qui implémente une collection de taille inconnue doit utiliser un pattern de pagination ou de fragmentation. |
| **PM-REL-005: Séquençage pour Immutable Log** | L'Immutable Log (AuditAggregate) exige un ordre physique monotone | L'ordre physique est garanti par un numéro de séquence ou par la position dans un append-only physical structure. Le réarrangement physique est interdit. |
| **PM-REL-006: Versioning Physique** | Le versionning du PO se traduit physiquement soit par un attribut de version sur l'objet, soit par une séparation actuelle/historique | Option A : un attribut `version` incrementé à chaque modification (versioning optimiste). Option B : une structure séparée pour l'historique, une structure pour l'état courant (pattern versioned document). Le choix doit suivre la stratégie de persistence du PO (DOC-017 §2). |

#### 2.2.2 Patterns Structurels Physiques

Cinq patterns structurels mappent les modes de persistance de DOC-017 §4 en structures relationnelles physiques :

| Pattern | Mode de Persistance DOC-017 | Traduction Structurelle |
|---------|---------------------------|----------------------|
| **P-STRUCT-1: Monolithe** | Embedded, Referenced | Un seul objet physique contient le parent ET les enfants embarqués. Les références sont des clés internes. |
| **P-STRUCT-2: Fragmenté** | Collection | Plusieurs objets physiques liés par appartenance à une collection. Chaque fragment a une référence vers le conteneur. |
| **P-STRUCT-3: Chronologique** | Immutable Log | Séquence physique linéaire et ordonnée. Chaque entrée contient son séquence number. Lecture = traversal dans l'ordre. |
| **P-STRUCT-4: Historisé** | Versioned Document | Deux structures : courante (state) + historique (versions précédentes). L'historique est append-only. La courante est mutable. |
| **P-STRUCT-5: Snapshot** | Snapshot | Objet physique complet à un instant T. Indépendant des autres snapshots. Peut être compressé contre le précédent. |

Chaque pattern a des règles d'utilisation dérivées de DOC-017 §4 (quand l'utiliser, quand ne pas l'utiliser). Ces règles s'appliquent directement lors du choix du pattern structurel.

---

## 3. CONTRAINTES DE MAPPING (Règles d'Or du PDM)

Huit contraintes fondamentales gouvernent TOUTE transformation PO → Physique. Leur violation est un rejet immédiat.

---

### PM-001: Un Objet Physique ne change jamais les limites d'Aggregate

**Nature:** Contrainte de boundary  
**Seuil:** CRITIQUE

Un Objet Physique ne peut ni élargir ni réduire la boundary d'un Aggregate. Si le PO de `ResourceAggregate` contient 5 entités dans le domaine, l'Objet Physique doit représenter ces 5 entités — ni 4 (fusion interdite), ni 6 (séparation interdite).

**Violation typique :** Fusionner `TransactionRecord` et `MemberRecord` dans le même objet physique parce que « ça partage des champs communs ». Ces deux entités appartiennent au même Aggregate mais ont des cycles de vie et des schémas sémantiques différents. Les regrouper perd de la clarté structurelle et risque de corrompre les règles d'accès individuels.

**Règle de détection :** Compter le nombre d'Entités d'un Aggregate dans les Objets Physiques correspondants. Le nombre doit être identique.

```
Fonction de validation (pseudo-code) :
  function validatePM001(physicalObject, aggregate):
    domainEntities = countDomainEntities(aggregate)
    physicalRepresentations = countPhysicalRepresentations(physicalObject)
    if physicalRepresentations != domainEntities:
      return REJECT: "L'objet physique représente {physicalRepresentations} entités, alors que l'Aggregate en definit {domainEntities}"
    return APPROVE
```

---

### PM-002: Toutes les métadonnées de PO mappent en attributs physiques

**Nature:** Contrainte de complétude  
**Seuil:** CRITIQUE

Chaque champ de métadonnée de persistance listé dans DOC-017 §3.3 (`_persist_version`, `_sync_timestamp`, `_local_timestamp`, `_conflict_strategy`, `_tombstone`, `_purge_date`, `_log_sequence`, `_org_id`, `_sync_status`, `_created_by`) doit avoir un attribut physique correspondant. Aucune omission n'est tolérée.

**Violation typique :** Omettre `_sync_timestamp` dans l'objet physique parce que « la timestamp native du storage suffit ». La timestamp native du storage ne porte pas la même sémantique (dernière sync vs dernière modification DB) et peut être gérée indépendamment (notamment pour la replication multi-site).

**Règle de détection :** Vérifier que les 10 champs meta de DOC-017 §3.3 ont chacun un équivalent physique.

```
Fonction de validation (pseudo-code) :
  function validatePM002(persistenceObject, physicalRepresentation):
    requiredMetaFields = ["_persist_version", "_sync_timestamp", "_local_timestamp",
                          "_conflict_strategy", "_tombstone", "_purge_date",
                          "_log_sequence", "_org_id", "_sync_status", "_created_by"]
    for field in requiredMetaFields:
      if not physicalRepresentation.contains(field):
        return REJECT: "Métadonnée '{field}' du PO absente de la représentation physique"
    return APPROVE
```

---

### PM-003: Les relations conservent la sémantique de possession du Domaine

**Nature:** Contrainte de sémantique relationnelle  
**Seuil:** CRITIQUE

La nature de la relation entre deux entités physiques doit refléter fidèlement la nature de la relation entre les entités domaine correspondantes :

- Une composition domaine (has-a fort) mappe en embedding physique.
- Une référence domaine (references-a) mapte en référence physique par clé.
- Une collection domaine mapte en fragment physique lié par conteneur.
- Une séquence domaine mapte en structure ordonnée physique.

**Violation typique :** Mapper une relation de composition domaine (OrgUnit fait partie de la hiérarchie Organization) en une référence physique séparée alors que le PO la définit comme Embedded collection. La séparation physique introduit une possibilité d'accès indépendant qui n'existe pas au niveau domaine.

**Règle de détection :** Pour chaque relation physique, vérifier que le mode d'accès autorisé correspond au mode de persistance du PO (DOC-017 §4).

```
Fonction de validation (pseudo-code) :
  function validatePM003(physicalRelation, persistenceMode):
    if persistenceMode == EMBEDDED and physicalRelation.isSeparate():
      return REJECT: "Relation embedded dans le PO mappée en structure séparée physiquement"
    if persistenceMode == REFERENCED and physicalRelation.isEmbedded():
      return REJECT: "Relation référencée dans le PO mappée en structure embarquée physiquement"
    return APPROVE
```

---

### PM-004: La cardinalité suit les motifs de relation du Domaine

**Nature:** Contrainte cardinale  
**Seuil:** CRITIQUE

La cardinalité physique (1:1, 1:N, N:M) entre Objets Physiques doit être cohérente avec la cardinalité des relations domaine :

- 1:N domaine → 1:N physique (parent → collection d'enfants)
- N:1 domaine → N:1 physique (enfant → parent, via clé de référence)
- M:N domaine → structure de jointure physique (table de correspondance)
- 1:1 domaine → 1:1 physique (entité principale + metadata intégrés ou groupés)

**Violation typique :** Mapper une relation 1:N domaine en 1:1 physique (en écrasant les enfants excédentaires) ou une relation 1:1 en N:1 (en permettant des références multiples là où une seule est attendue).

**Règle de détection :** Comparer la cardinalité de chaque relation physique avec la cardinalité de la relation domaine correspondante.

---

### PM-005: Les états du cycle de vie mappent en attributs physiques, pas en objets séparés

**Nature:** Contrainte de cyclage de vie  
**Seuil:** MAJEUR

Les transitions d'état d'un PO (documentées dans DOC-017 §2 pour chaque Aggregate) se traduisent par un attribut d'état physique, jamais par la création d'un nouvel objet physique. `TransactionRecord` passant de `draft` à `pending` ne crée PAS un nouvel objet physique — il met à jour l'attribut `state` de l'objet existant.

**Exception autorisée :** Le pattern Versioned Document (DOC-017 §4.5) crée des entrées physiques distinctes pour l'historique des versions. Dans ce cas, l'attribut `state` est copié dans chaque version physique. C'est l'exception, pas la règle.

**Violation typique :** Créer un objet physique distinct `TransactionRecordPending` à part de `TransactionRecordDraft`. Le changement d'état est un changement d'attribut, pas un changement d'identité.

---

### PM-006: Le versionning ajoute des attributs de version, pas de nouvelles structures

**Nature:** Contrainte de versionning  
**Seuil:** MAJEUR

Le numéro de version du PO (`_persist_version`) se traduit par un attribut de version sur l'objet physique. Si le pattern Versioned Document est utilisé (DOC-017 §4.5), les versions antérieures sont archivées dans une structure historique séparée, mais cette structure historique n'est PAS un nouvel objet physique — c'est l'objet physique dans son état passé.

**Violation typique :** Créer une table/collecte/structure physique dédiée appelée « transaction_versions » avec une colonne `transaction_id` en plus de l'objet physique principal. La version est un attribut, pas une entité séparée.

```
Correct : chaque Transaction a un attribut version_number.
Incorrect : une entité physique TransactionVersion liée à Transaction par référence.
```

---

### PM-007: La traçabilité d'audit utilise des attributs physiques, pas des structures séparées

**Nature:** Contrainte d'audit  
**Seuil:** CRITIQUE

Les champs d'audit transversaux (`_created_by`, `_sync_timestamp`, `_local_timestamp`, `_persist_version`) mappent en attributs physiques de l'objet concerné. Ils ne deviennent PAS des objets physiques séparés.

L'AuditAggregate lui-même (DOC-017 §2.10) est une structure physique séparée (Immutable Log) car c'est un Aggregate autonome. Mais les champs d'audit intégrés aux autres PO ne font PAS l'objet d'Aggregates séparés.

**Violation typique :** Créer un objet physique `TransactionAuditTrail` séparé de `TransactionRecord` physique. Les champs `_created_by` et `_sync_timestamp` sur un PO Resource sont des attributs de l'objet Transaction physique, pas un deuxième objet.

---

### PM-008: L'isolement multi-tenant se traduit par un attribut de référence physique

**Nature:** Contrainte d'isolement  
**Seuil:** CRITIQUE

`_org_id` sur tout PO mappe en un attribut physique présent sur chaque objet physique. Cet attribut sert de pivot pour :

1. L'isolement des données (toute requête physique filtre par org_id)
2. Le partitionnement physique (optionnel, basé sur org_id)
3. La cohérence multi-site (org_id est la frontière de réplication)

**Aucune exception :** Même les objets physiques de l'AuditAggregate (qui n'est pas multi-tenant en soi) portent l'org_id car chaque entrée audit se réfère à un org.

---

## 4. RÈGLES SPÉCIFIQUES PAR MODE DE PERSISTANCE

Chaque模式 de persistance de DOC-017 §4 a des règles de mapping physique supplémentaires.

### 4.1 Mapping Embedded → Objet Physique Unique

| Règle | Description |
|-------|-------------|
| **PM-EMB-001** | Les enfants embarqués mappent en attributs contenus dans le même objet physique que le parent |
| **PM-EMB-002** | L'attribut `_org_id` est implicite dans l'objet physique parent (hérité automatiquement) |
| **PM-EMB-003** | La modification d'un enfant embarqué incrémente le `_persist_version` du parent (physiquement traduit par un update de l'attribut version de l'objet physique parent) |
| **PM-EMB-004** | Taille maximale : 1000 items embeddés dans un même objet physique (soft limit, configurable via Policy) |

**Utilisé pour :** OrgUnit dans OrganizationAggregate, FormField dans FormDefinition, NotificationPreference dans NotificationAggregate.

---

### 4.2 Mapping Referenced → Référence Physique par Clé

| Règle | Description |
|-------|-------------|
| **PM-REF-001** | Le parent physique contient une référence (clé + type) vers l'enfant physique. L'enfant existe comme objet physique indépendant. |
| **PM-REF-002** | La référence inclut TOUJOURS le type (prévient les références ambigües cross-type) |
| **PM-REF-003** | La suppression du parent physique NE supprime PAS l'enfant physique (l'enfant a un cycle de vie indépendant) |
| **PM-REF-004** | La référence à un enfant inexistant retourne vide/null, ne génère JAMAIS d'erreur physique |
| **PM-REF-005** | Les références circulaires entre objets physiques référencés sont interdites |

**Utilisé pour :** User dans IdentityAggregate (référencé depuis ResourceAggregate), OrgUnit référençant d'autres OrgUnit, resource cross-references dans WorkflowAggregate.

---

### 4.3 Mapping Collection → Structures Relationnelles Fragments

| Règle | Description |
|-------|-------------|
| **PM-COL-001** | Chaque élément de la collection devient un objet physique fragment, lié au conteneur par une référence de conteneur |
| **PM-COL-002** | L'ordre d'insertion est conservé physiquement (attribut sequence_number ou position) |
| **PM-COL-003** | L'ajout/retrait d'un élément incrémente le `_persist_version` du conteneur physique |
| **PM-COL-004** | Opérations groupées supportées : add_many, remove_many, replace_range — atomiques au niveau conteneur |
| **PM-COL-005** | La suppression du conteneur physique supprime tous les fragments (sauf s'ils ont un cycle de vie indépendant) |

**Utilisé pour :** TransactionRecord collection dans ResourceAggregate, NotificationMessage collection dans NotificationAggregate, PendingOperation queue dans OfflineSyncAggregate.

---

### 4.4 Mapping Immutable Log → Séquence Physique Linéaire

| Règle | Description |
|-------|-------------|
| **PM-LOG-001** | ZERO modifications physiques : aucun update, aucun delete, aucun remplacement in-place |
| **PM-LOG-002** | Ordre physique garanti par séquence monotone (auto-incrément) ET timestamp UTC |
| **PM-LOG-003** | Les appends physiques sont atomiques (entrée complète ou rien) |
| **PM-LOG-004** | La politique de rétention (min. 7 ans) est un attribut physique, pas un comportement du stockage |
| **PM-LOG-005** | Les consommateurs doivent lire dans l'ordre ; la lecture hors ordre est une erreur physique détectable |
| **PM-LOG-006** | Auto-audit interdit (les entrées Audit ne sont pas elles-mêmes auditées) |

**Utilisé pour :** AuditAggregate exclusivement. Seul l'Aggregate dont le mode de persistance est strictement Immutable Log.

---

### 4.5 Mapping Versioned Document → Structure Courante + Historique

| Règle | Description |
|-------|-------------|
| **PM-VD-001** | Numéro de version physiquement monotoniquement croissant (jamais réutilisé, jamais comblé) |
| **PM-VD-002** | Les versions précédentes ne sont JAMAIS supprimées (peuvent être archivéees en stockage froid) |
| **PM-VD-003** | La version courante est toujours lisible ; les versions historiques sont lisibles sous réserve de rétention |
| **PM-VD-004** | L'écriture échoue si la version attendue ne correspond pas à la version courante (violation de verrou optimiste → traduction physique d'un code de retour d'erreur) |
| **PM-VD-005** | Les transitions d'état suivent un graphe prédéfini (chaque version capture l'état suivant du graphe) |

**Utilisé pour :** WorkflowInstance (historique d'exécution), TransactionRecord (histoire draft→pending→approved), ArchiveEntry (historique d'état du cycle de vie).

---

### 4.6 Mapping Snapshot → Capture Physique Autonome

| Règle | Description |
|-------|-------------|
| **PM-SNAP-001** | Chaque snapshot est un objet physique autonome et indépendant (pas de dépendance vers d'autres snapshots) |
| **PM-SNAP-002** | Les snapshots sont append-only (chaque capture est une nouvelle entrée physique) |
| **PM-SNAP-003** | La fréquence de snapshot est configurable via Policy |
| **PM-SNAP-004** | Les snapshots peuvent être compressés (delta stocké par rapport au snapshot précédent) |
| **PM-SNAP-005** | La récupération préfère le snapshot le plus récent + diffs suivants |
| **PM-SNAP-006** | Chaque snapshot inclut des métadonnées physiques : timestamp de capture, version source, checksum |

**Utilisé pour :** ReportingAggregate (rapports générés), WorkflowInstance (points de contrôle périodiques d'exécution).

---

## 5. MATRICE DE CONTRAINTES CROISÉES

Cette section montre comment les règles PM interagissent avec les règles DOC-018 (Transformations A et B) et DOC-017 (Stratégies de persistance).

### 5.1 Compatibilité Règles PA × PM

| Règle DOC-018 (PA) | Règle DOC-022 (PM) compatibl e | Impact |
|---------------------|-------------------------------|--------|
| PA-001 (Couche Domaine intacte) | PM-DOM-001 à PM-DOM-005 | Chaque champ domaine survive intact à travers les deux transitions |
| PA-002 (Métadonnées ajoutées uniquement) | PM-MET-001 à PM-MET-010 | Les métadonnées deviennent des attributs physiques de persistance |
| PA-003 (Noms domaine immuables) | PM-DOM-001 | Le nom sémantique survit jusqu'à la couche physique |
| PA-004 (Types domaine immuables) | PM-DOM-002 | Le type sémantique est préservé dans l'attribut physique |
| PA-006 (Optimisations cachées) | PM-OPT-001 à PM-OPT-003 | Les optimisations restent strictement invisibles |
| PA-008 (Reconstruction complète) | PM-REL-001 à PM-REL-006 | La recombinaison physique reconstruit le PO complet |

### 5.2 Compatibilité Stratégies DOC-017 × Patterns PM

| Stratégie DOC-017 (§2) | Règles PM applicables | Pattern structurel (PM §2.2.2) |
|------------------------|----------------------|-------------------------------|
| Referenced (Org, User) | PM-REF-001 à PM-REF-005 | P-STRUCT-1: Monolithe |
| Embedded Collection (OrgUnit hierarchy) | PM-EMB-001 à PM-EMB-004 | P-STRUCT-1: Monolithe |
| Collection (Transactions, Notifications) | PM-COL-001 à PM-COL-005 | P-STRUCT-2: Fragmenté |
| Immutable Log (Audit) | PM-LOG-001 à PM-LOG-006 | P-STRUCT-3: Chronologique |
| Versioned Document (Workflow, Lifecycle) | PM-VD-001 à PM-VD-005 | P-STRUCT-4: Historisé |
| Embedded KV (Configuration) | PM-EMB-001 à PM-EMB-004, PM-DOM-003 | P-STRUCT-1: Monolithe |
| Snapshot (Reporting) | PM-SNAP-001 à PM-SNAP-006 | P-STRUCT-5: Snapshot |

---

## 6. VALIDATION AUTOMATIQUE

### 6.1 Pipeline de Validation pour la Transition C

```
┌──────────────────────────────────────────────────────────────────┐
│                  VALIDATION TRANSITION C                         │
│                                                                  │
│  PO Stable ? ──NON──→ STOP                                       │
│       │ OUI                                                      │
│       ▼                                                          │
│  Checks Domaines :                                               │
│  ├─ PM-DOM-001: Identité de champ vérifiée                     │
│  ├─ PM-DOM-002: Types sémantiques préservés                     │
│  ├─ PM-DOM-003: Value Objects imbriqués traités                │
│  ├─ PM-DOM-004: Relations natives conservées                    │
│  └─ PM-DOM-005: Identité domaine préservée                      │
│       │                                                          │
│       ▼                                                          │
│  Checks Métadonnées :                                            │
│  ├─ PM-MET-001 à PM-MET-010: chaque méta → attribut physique   │
│  └─ PM-MET-008: org_id présent sur TOUS les objets physiques    │
│       │                                                          │
│       ▼                                                          │
│  Checks Optimisations :                                          │
│  ├─ PM-OPT-001: invisibilité domaine                            │
│  ├─ PM-OPT-002: partitioning key dérivé du PO                   │
│  └─ PM-OPT-003: compression transparente                        │
│       │                                                          │
│       ▼                                                          │
│  Checks Structurels :                                            │
│  ├─ PM-REL-001: atomicité aggregate                             │
│  ├─ PM-REL-002: références inter-aggregates par clé             │
│  ├─ PM-REL-003: isolement org propagé                           │
│  ├─ PM-REL-004: collections bornées                             │
│  ├─ PM-REL-005: séquencement log                               │
│  └─ PM-REL-006: versionning physique                            │
│       │                                                          │
│       ▼                                                          │
│  Checks Contraintes (PM-001 à PM-008):                           │
│  ├─ PM-001: Boundary aggregate respectée                        │
│  ├─ PM-002: Complétude métadonnées                              │
│  ├─ PM-003: Sémantique de possession conservée                  │
│  ├─ PM-004: Cardinalité conforme au domaine                     │
│  ├─ PM-005: États → attributs, pas objets séparés              │
│  ├─ PM-006: Versioning → attributs, pas nouvelles structures    │
│  ├─ PM-007: Audit → attributs, pas structures séparées         │
│  └─ PM-008: Isolement tenant par attribut physique              │
│       │                                                          │
│       ▼                                                          │
│  Checks Pattern Spécifique :                                     │
│  ├─ Embedded: PM-EMB-001 à PM-EMB-004                          │
│  ├─ Referenced: PM-REF-001 à PM-REF-005                        │
│  ├─ Collection: PM-COL-001 à PM-COL-005                        │
│  ├─ Immutable Log: PM-LOG-001 à PM-LOG-006                     │
│  ├─ Versioned Doc: PM-VD-001 à PM-VD-005                       │
│  └─ Snapshot: PM-SNAP-001 à PM-SNAP-006                        │
│       │                                                          │
│       ▼                                                          │
│  RESULTAT: APPROVED / REJECTED                                 │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Scripts de Validation

#### Script : `validate-po-to-physical`

**Entrée :** Persistence Object de DOC-017 + définition d'Objet Physique cible  
**Sortie :** Rapport par objet — _champs perdus_, _types modifiés_, _attributs meta manquants_

**Checks exécutés :**
1. Field parity check : chaque champ domaine + chaque champ meta du PO → attribut physique équivalent
2. Semantic type preservation : le type logique préserve sa sémantique (PM-DOM-002)
3. Meta completeness : les 10 champs meta de DOC-017 §3.3 tous présents (PM-002)
4. Layer separation : pas de mélange couches Domaine/Persistance/Optimisation dans le physique
5. Boundary integrity : le nombre d'objets physiques par Aggregate = le nombre d'Entités PO (PM-001)
6. Org isolation : chaque objet physique porte org_id (PM-008)

**Score de conformité :** (attributs physiques correctement mappés / total attributs PO) × 100  
**Seuil d'approbation :** 100% — aucune tolérance pour la perte d'attributs

---

#### Script : `validate-physical-to-relation`

**Entrée :** Objets Physiques + définition de Structure Relationnelle cible  
**Sortie :** Rapport par structure — _boundary violations_, _cardinality mismatches_, _embedding errors_

**Checks exécutés :**
1. Aggregate atomicity (PM-REL-001) : aucune structure ne mélange des Aggregates
2. Cross-aggregate references by key only (PM-REL-002) : pas de jointure implicite structurelle
3. Org isolation propagation (PM-REL-003) : chaque structure isole ou partitionne par org_id
4. Collection bounds (PM-REL-004) : toute collection physique a une borne known ou un pattern de gestion
5. Log ordering (PM-REL-005) : l'Immutable Log est physiquement séquentiel
6. Versioning representation (PM-REL-006) : le versionning du PO est représenté physiquement
7. Pattern-specific checks : les règles PM-EMB/PM-REF/PM-COL/PM-LOG/PM-VD/PM-SNAP correspondantes

**Score de conformité :** (structures conformes / total structures) × 100  
**Seuil d'approbation :** 100%

---

#### Script : `validate-global-constraints-pdm`

**Entrée :** Domain Model + Persistence Model + Physical Data Model  
**Sortie :** Rapport global — violations PM-001 à PM-008

**Checks exécutés :**
1. **PM-001** : Pour chaque objet physique, compter les entités domaine mappées → doit être égal au nombre d'Entités du PO
2. **PM-002** : Pour chaque PO, vérifier les 10 métadonnées ont un équivalent physique
3. **PM-003** : Pour chaque relation physique, vérifier que le mode (embedded/referenced/collection) correspond à la stratégie de persistance du PO
4. **PM-004** : Comparer les cardinalités physiques avec les cardinalités domaine
5. **PM-005** : Vérifier qu'aucun état de cycle de vie n'est mappé en objet physique séparé
6. **PM-006** : Vérifier que le versionning utilise des attributs/versioned patterns, pas de nouvelles entités physiques
7. **PM-007** : Vérifier que les champs d'audit sont des attributs intégrés, pas des Aggregates physiques séparés
8. **PM-008** : Vérifier que org_id est présent sur chaque objet physique

**Score de conformité :** (contraintes non-violées / 8) × 100  
**Seuil d'approbation :** 100% — chaque règle PM-001 à PM-008 doit être strictement respectée

---

## 7. PATTERNS DE VIOLATION

Huit patterns de violation couvrent les erreurs les plus courantes lors du mapping PO → Physique.

### VP-PDM-01: Le Design Physique dicte la Structure PO en Retour

**Signatures :**
- Un objet physique est conçu en premier, puis les PO sont adaptés pour l'épouser
- Le schema physique dicte la structure de l'Entité (colonnes → classes domaine)
- Les requêtes physiques sont écrites avant les Commands Domain

**Détection automatique :** Vérifier l'ordre de création des artefacts — si la définition physique précède la définition PO pour le même Aggregate → flag.

**Traitement :** Rejeter. Le flux décisionnel est Domain → Persistence → Physique. Inverser ce flux est une violation constitutionnelle.

---

### VP-PDM-02: Fusion d'Entités pour Simplifier le Schéma

**Signatures :**
- Deux Entités d'un même Aggregate fusionnées en un seul objet physique par « simplicité »
- Création d'un objet physique hybride qui n'existe dans aucun PO
- Perte de granularité d'accès individualisée

**Exemple typique :** `TransactionRecord` et `MemberRecord` fusionnés en `ResourceUnifiedPhysical` pour éviter deux structures physiques distinctes.

**Traitement :** Rejeter. La simplification du schéma ne justifie jamais la fusion d'Entités avec des sémantiques, cycles de vie, et patterns d'accès différents.

---

### VP-PDM-03: Carte Cardinalité Contradictoire avec le Modèle Domaine

**Signatures :**
- Une relation 1:N domaine devient N:1 physique (inversion)
- Une relation M:N domaine est mappée en 1:N sans table de jointure
- La cardinalité physique permet plus de connexions que la stratégie de persistance ne l'autorise

**Détection automatique :** Cross-reference les cardinalités de chaque relation physique avec les cardinalités définies dans les stratégies de persistance (DOC-017 §2).

**Traitement :** Major si l'inversion affecte un chemin de lecture fréquent. Critique si l'inversion permet des états physiquement possibles qui sont invalides domainement.

---

### VP-PDM-04: Métadonnées Perdues lors de la Transformation Physique

**Signatures :**
- `_sync_timestamp` absent de l'objet physique
- `_persist_version` omis parce que « le storage fournit une auto-increment »
- `_org_id` oublié sur un sous-ensemble d'objets physiques
- `_tombstone` non mappé, donc pas d'exclusion des soft-deleted

**Détection automatique :** Scanner chaque objet physique et vérifier la présence des 10 champs meta de DOC-017 §3.3.

**Traitement :** Critique pour `_org_id` et `_persist_version` (sécurité et cohérence). Major pour les autres. Correction immédiate requise.

---

### VP-PDM-05: Nouvelle Structure Physique pour un État de Cycle de Vie

**Signatures :**
- Un état spécifique (ex: « approved ») a sa propre table/colection/structure physique
- Migration d'état = insertion dans une structure différente
- Query différentielle selon l'état (SELECT * FROM transactions_approved vs SELECT * FROM transactions_draft)

**Détection automatique :** Détecter s'il existe plusieurs structures physiques pour une même Entité domaine, différenciées par un état.

**Traitement :** Critique. L'état est un attribut, pas une structure. (Violation de PM-005).

---

### VP-PDM-06: Objet Physique Crée un Nouvel Aggregate Invisible

**Signatures :**
- Une structure physique nouvelle n'a pas d'équivalent PO → pas d'Aggregate domain correspondant
- Création d'un « view model physique », « projection physique », ou «汇总表 physique » sans correspondance PO
- L'objet physique représente un concept qui n'existe dans ni DOC-012, ni DOC-017

**Lien avec DOC-018 :** Ce pattern viole à la fois PM-001 et M-001 (DOC-018). Si un objet physique n'a pas de PO correspondant, il n'a pas d'Aggregate correspondant.

**Traitement :** Rejeter. Tout objet physique doit avoir un PO équivalent. Tout PO doit avoir un Aggregate équivalent. Chaîne ininterrompue.

---

### VP-PDM-07: Split de Value Object Inutile

**Signatures :**
- Un Value Object du PO (ex: `LabelPair` FR+EN) est splité en deux objets physiques séparés
- Un VO imbriqué devient une entité physique autonome avec sa propre clé
- Le VO n'a plus d'identité dans la couche physique

**Lien avec DOC-018 :** Violation de PA-001 (Couche Domaine Intacte) — le VO est un bloc indivisible domain.

**Traitement :** Major. Les VOs doivent rester regroupés physiquement soit comme attributs plats, soit comme groupe structuré (JSONB). Jamais en entités physiques séparées.

---

### VP-PDM-08: Violation d'Isolement Multi-Tenant Physique

**Signatures :**
- Une structure physique contient des données de plus d'une org sans org_id de filtering
- Une query physique peut retourner des données d'une autre org sans filtrer par `_org_id`
- Index physique ne couvre pas `org_id` sur les tables/collections avec données multi-orgs

**Détection automatique :** Scanner toutes les structures physiques contenant des données multi-orgs et vérifier la présence d'org_id comme colonne indexée ou partition.

**Traitement :** Critique. INV-004 (isolement multi-tenant) est un invariant fondamental. Chaque structure physique multi-org doit avoir org_id indexé.

---

## 8. MATRICE D'APPLICATION PAR AGGREGATE

Application concrète des règles PM aux 13 Aggregates de DOC-012.

### 8.1 OrganizationAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| Organization | PM-DOM-005 (org_id identity), PM-MET-001/002/008, PM-001 | P-STRUCT-1: Monolithe |
| OrgUnit | PM-EMB-001 à PM-EMB-004 (embedded), PM-DOM-004 (hierarchy refs), PM-005 (status → attribute) | P-STRUCT-1: Monolithe avec children embedded |
| OrganizationSettings | PM-DOM-003 (VO groupé en JSONB ou colonnes plates) | P-STRUCT-1: Monolithe (embedded VO) |

### 8.2 IdentityAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| User | PM-DOM-005 (identity), PM-MET-001/002/008/010, PM-008 | P-STRUCT-1: Monolithe |
| SessionContext | PM-EMB-001 (embedded), PM-LOG-003 (append-only history) | P-STRUCT-4: Historisé (session lifecycle) |

### 8.3 ResourceAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| TransactionRecord | PM-DOM-002 (BIGINT preserved for AmountInCents), PM-MET-001/002/003/008/009, PM-004 (cardinality), PM-005 (state as attribute), PM-006 (version as attribute or versioned doc) | P-STRUCT-4: Historisé ou P-STRUCT-2: Fragmenté |
| MemberRecord | PM-DOM-002, PM-005, PM-008 | P-STRUCT-2: Fragmenté (collection) |
| EventRecord | PM-DOM-002, PM-005, PM-008 | P-STRUCT-2: Fragmenté (collection) |
| ArchiveEntryRecord | PM-005 (lifecycle states as attributes), PM-006 | P-STRUCT-4: Historisé |

### 8.4 RelationshipAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| GroupMembership | PM-EMB-001 (embedded in aggregate boundary), PM-005 (no lifecycle state — instant) | P-STRUCT-1: Monolithe (embedded collection) |
| OrgUnitParentLink | PM-REF-001 à PM-REF-005 (referenced within same aggregate), PM-REL-002 (self-ref within aggregate) | P-STRUCT-1: Monolithe avec referenced edges |

### 8.5 WorkflowAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| WorkflowInstance | PM-VD-001 à PM-VD-005 (versioned doc pattern), PM-MET-001/008, PM-006 | P-STRUCT-4: Historisé |
| WorkflowStep | PM-EMB-001 (embedded collection within instance) | P-STRUCT-4: Historisé (step embedded in workflow instance) |

### 8.6 FormAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| FormDefinition | PM-DOM-003 (VOs grouped as JSONB), PM-EMB-001/004 (embedded fields/sections) | P-STRUCT-1: Monolithe |

### 8.7 NotificationAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| NotificationMessage | PM-COL-001 à PM-COL-005 (collection), PM-005 (states: queued/sending/sent/failed) | P-STRUCT-2: Fragmenté |
| NotificationPreference | PM-EMB-001 (embedded VO, per-user) | P-STRUCT-1: Monolithe |

### 8.8 VocabularyAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| Namespace | PM-EMB-001 (embedded collection of terms) | P-STRUCT-1: Monolithe |
| TermValue | PM-005 (active→deprecated as attribute, never deleted: PM-LOG-004 equivalent for vocab), PM-001 (never delete) | P-STRUCT-1: Monolithe (terms embedded in namespace) |

### 8.9 ReportingAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| GeneratedReport | PM-SNAP-001 à PM-SNAP-006 (snapshot pattern), PM-005 (no lifecycle — ephemeral) | P-STRUCT-5: Snapshot |

### 8.10 AuditAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| AuditLogEntry | PM-LOG-001 à PM-LOG-006 (immutable log), PM-MET-007 (sequence number), PM-OPT-001 (retention config, not hardcoded) | P-STRUCT-3: Chronologique |

### 8.11 LifecycleAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| ArchiveEntry | PM-VD-001 à PM-VD-005 (versioned: state transitions), PM-005 (lifecycle states as attributes), PM-EMBO-001 (linked resource referenced, not embedded) | P-STRUCT-4: Historisé |

### 8.12 ConfigurationAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| SettingEntry | PM-DOM-003 (KV as single JSONB object or flat key-value table), PM-EMB-004 (bounded set of settings) | P-STRUCT-1: Monolithe (single settings document per org) |

### 8.13 OfflineSyncAggregate

| PO | Règles PM principales | Pattern structural |
|----|----------------------|-------------------|
| PendingOperation | PM-COL-001 à PM-COL-005 (collection FIFО), PM-MET-009 (sync_status attribute), PM-LOG-003 (append-only queue) | P-STRUCT-2: Fragmenté (collection with ordering) |
| SyncStatusTracker | PM-EMB-001 (embedded with queue) | P-STRUCT-2: Fragmenté |

---

## 9. CHECKLIST DE RENDU PO → PHYSIQUE

Pour valider un mapping complet, passer chaque point :

- [ ] PM-001 : Chaque Aggregate a le même nombre d'objets physiques que d'Entités PO
- [ ] PM-002 : Les 10 métadonnées de DOC-017 §3.3 sont toutes présentes
- [ ] PM-003 : Le mode d'accès (embedded/referenced/collection) correspond à la stratégie de persistance
- [ ] PM-004 : Les cardinalités physiques correspondent aux cardinalités domaine
- [ ] PM-005 : Les états du cycle de vie sont des attributs physiques, pas des objets séparés
- [ ] PM-006 : Le versionning utilise des attributs de version, pas de nouvelles structures physiques
- [ ] PM-007 : Les champs d'audit sont des attributs intégrés, pas des structures séparées
- [ ] PM-008 : org_id est présent sur chaque objet physique
- [ ] PM-DOM-001 à PM-DOM-005 : Tous les champs domaine sont mappés
- [ ] PM-MET-001 à PM-MET-010 : Toutes les métadonnées sont mappées
- [ ] PM-OPT-001 à PM-OPT-003 : Les optimisations de storage sont invisibles du domaine
- [ ] PM-REL-001 à PM-REL-006 : Les structures relationnelles sont cohérentes
- [ ] Rules pattern-spécifiques (PM-EMB/PM-REF/PM-COL/PM-LOG/PM-VD/PM-SNAP) appliquées correctement
- [ ] Aucune violation VP-PDM-01 à VP-PDM-08 détectée
- [ ] Script `validate-po-to-physical` passe à 100%
- [ ] Script `validate-physical-to-relation` passe à 100%
- [ ] Script `validate-global-constraints-pdm` passe à 100%

---

## 10. HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Règles de mapping PO → Modèle Physique pour les 13 Aggregates | CTO + Arch Principal |

---

**Fin du document DOC-022.**

Ce document est constitutional. Toute modification nécessite un amendement signé par le CTO et l'Architecte Principal, suivant le pipeline de la `ARCHITECTURE-DECISION-CONSTITUTION.md` (DOC-008).

**Relations documentelles :**
- DOC-017 (Persistence Model) : source des PO, stratégies de persistance, métadonnées — entrée de ce document
- DOC-018 (Aggregate → Persistence Mapping Rules) : régit les Transitions A et B du pipeline — complémentarité
- DOC-021 (Physical Data Model) : sortie de ce document — définit les instances physiques respectant ces règles
- DOC-012 (Canonical Domain Model) : référence ultime — les Aggregates et leurs Entités/VOs sont la source des mappings
