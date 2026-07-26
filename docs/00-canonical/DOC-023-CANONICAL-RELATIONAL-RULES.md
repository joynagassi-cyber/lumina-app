# DOC-023 — Canonical Relational Rules

**Doc ID:** DOC-023 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — RÉGLES RELATIONNELLES FIGÉES  
**Date:** 2026-07-24  
**Dépendances:** DOC-012 (Domain Model), DOC-017 (Persistence Model), DOC-019 (Persistence Strategy Catalog), DOC-015 (Invariant Registry)  
**Remplace:** Rien — ce document est nouveau.

---

## PRÉAMBULE

Ce document définit les règles canoniques pour structurer les objets physiques de manière relationnelle, sans lien avec aucun moteur de base de données spécifique. Il traduit les décisions d'organisation des relations entre objets du Domaine (DOC-012) en contraintes structurelles pour la modélisation physique, telles que définies dans le modèle de persistance (DOC-017) et le catalogue de stratégies de persistance (DOC-019).

**Ce que ce document fait :** Il fournit un ensemble de règles immuables sur la façon dont les objets physiques sont reliés entre eux, comment ces relations sont structurées, versionnées, auditées, isolées et gérées tout au long de leur cycle de vie.

**Ce que ce document ne fait pas :** Il ne contient AUCUNE syntaxe de création de table, AUCUN type de données spécifique, AUCUNE contrainte DDL, AUCune commande SQL, AUCune spécification ORM. Ce document s'applique identiquement à un store relationnel, un store documentaire, un event store ou un store clé-valeur.

**Règle fondamentale :** Si une phrase de ce document ne peut pas être lue par un architecte qui n'a jamais vu Lumina sans comprendre le sens général → elle contient un détail d'implémentation trop bas niveau et doit être reformulée.

---

## 1. OBJET

Ce document définit les règles canoniques pour structurer les objets physiques de manière relationnelle. Ces règles gouvernent la façon dont les Objets Physiques décrits dans DOC-021 (Physical Data Model, lorsque disponible) sont organisés en structures relationnelles.

L'objectif est d'établir un contrat relationnel immutable : quelle que soit la technologie de stockage utilisée (relationnel, documentaire, événementiel, clé-valeur), les règles ci-dessous s'appliquent toujours.

**Référence constitutionnelle :** Ce document complète DOC-017 (§3.4 Règles pour les Objets de Persistance) qui interdit l'introduction de dépendances inter-aggregates au niveau persistance (NB-PERSIST-009) et DOC-019 (§5 Matrice de compatibilité entre stratégies) qui définit quelles stratégies peuvent coexister.

---

## 2. RÈGLES D'IDENTIFICATEURS

### 2.1 Choix des Identificateurs

Chaque objet physique possède un identificateur principal. La règle de choix est la suivante :

- **Identificateurs naturels :** Lorsqu'un objet du Domaine possède un identifiant défini par son métier (ex : `org_id` pour OrganizationAggregate, `form_id` pour FormAggregate, `namespace_key` pour VocabularyAggregate), cet identifiant naturel est utilisé comme identificateur principal au niveau physique. L'identifiant naturel est immuable après création.
- **Identificateurs surrogés :** Lorsqu'aucun identifiant naturel n'existe dans le Domaine (ex : les entrées d'historique d'AuditAggregate, les opérations en attente d'OfflineSyncAggregate, les messages de notification), un identificateur généré automatiquement est assigné. Cet identificateur surrogé est le seul moyen d'adresser l'objet individuellement.
- **Identifiants composés :** Lorsqu'une relation nécessite une identité composite (ex : un lien de membership combinant membre + unité organisationnelle + groupe), un identificateur composé formé de la concaténation ordonnée des identifiants participants est utilisé. L'ordre des composants est fixe et documenté.

**Décision :** Un objet peut posséder AU PLUS UN identificateur principal au niveau physique. Les autres attributs d'identification sont des clés secondaires, jamais des identificateurs principaux.

### 2.2 Portée Par Agrégat

Chaque identificateur est unique AU SEIN de son Aggregate. Deux Agrégats différents peuvent utiliser le même label d'identifiant (ex : `resource_id` dans ResourceAggregate et `operation_id` dans OfflineSyncAggregate sont dans des portées différentes).

La portée d'un identifiant est définie par son contexte Aggregate et, le cas échéant, par la partition multi-locataire (`_org_id`).

### 2.3 Stabilité des Identificateurs

- Un identifiant principal ne change JAMAIS après création. C'est une règle NeverBreak.
- Un identifiant naturel, une fois créé, est figé. Aucun renommage, aucune modification, aucune évolution de clé n'est autorisée.
- Un identifiant surrogé, une fois généré, est permanent. Aucun réassignement, aucune réutilisation, aucune réincarnation n'est autorisé.

### 2.4 Règles JamaisModifier Pour Les Identificateurs

| # | Règle | Description | Violation |
|---|-------|-------------|-----------|
| NB-ID-001 | JamaisModifier-Identifiant-Naturel | Un identifiant naturel ne peut jamais être renommé ni modifié | Changement de `form_id`, de `namespace_key`, de `setting_key` |
| NB-ID-002 | JamaisModifier-Identifiant-Surrogé | Un identifiant généré ne peut jamais être réutilisé après suppression | Réassignation d'un ID supprimé |
| NB-ID-003 | JamaisModifier-Portée | Un identifiant ne peut jamais sortir de la portée de son Aggregate | Utiliser `resource_id` hors de ResourceAggregate comme référence directe |
| NB-ID-004 | JamaisModifier-OrdreComposé | Dans un identifiant composé, l'ordre des composants est fixe et immuable | Changer l'ordre `(member_id, group_id)` en `(group_id, member_id)` |

**Conséquence fonctionnelle :** Ces quatre règles garantissent qu'un identifiant est un ancre stable et prévisible pour toutes les relations physiques. Toute tentative de modifier un identifiant doit être interceptée au niveau du Domaine (DOC-012) et ne peut atteindre la couche physique que si une violation d'ADR a été préalablement approuvée.

---

## 3. PATTERNS DE RELATION

### 3.1 Relations 1:1 (Un À Un)

#### Quand Modéliser En Référence Séparée

Une relation 1:1 est modélisée par référence séparée lorsqu'un des critères suivants est rempli :

- Les deux parties ont des cycles de vie indépendants (l'une peut exister sans l'autre)
- Les deux parties sont accessibles séparément dans les patterns de requête courants
- Une partie est un Value Object intégré et l'autre est une Entity (le VO n'a pas besoin de référence explicite car il est inline)

#### Quand Intégrer Directement

Une relation 1:1 est intégrée directement (inline dans le même objet physique) lorsqu'aucun des critères de référence séparée n'est rempli. Cela correspond aux Value Objects définis dans DOC-012, qui sont par définition 1:1 avec leur entité parente et stockés inline.

#### Règles Pour Les Relations 1:1 En Référence Séparée

- La référence 1:1 utilise le même mécanisme que les références N:1 (voir §3.2)
- L'objet référencé doit exister avant que la référence ne soit créée
- La suppression de l'objet référencé ne supprime pas l'objet référençant — le référençant devient « orphelin » et doit gérer ce cas explicitement
- Aucune relation 1:1 ne forme une boucle (A référence B ET B référence A)

### 3.2 Relations 1:N (Un À Plusieurs)

#### Lien Parent-Enfant

Les relations 1:N sont le pattern de liaison le plus courant dans Lumina. Chaque relation 1:N suit les règles suivantes :

- **Le côté N porte la référence au côté 1.** L'objet enfant stocke un pointeur vers l'identifiant de son parent. Le parent ne stocke PAS de liste explicite d'identifiants enfants — la relation inverse est reconstruite par requête ou intégrée selon la stratégie de persistance choisie (DOC-019 §2.1–2.2).
- **La référence enfant-parent inclut toujours `_org_id`.** Cela assure l'isolement multi-locataire au niveau de chaque enregistrement enfant (voir §8).
- **La référence enfant-parent est injectée lors de la création** et jamais modifiée après. Le changement de parent est une suppression + recréation, pas une mise à jour.

#### Sémantique De Cascade

| Action Parent | Comportement Enfant | Justification |
|--------------|---------------------|---------------|
| Parent soft supprimé | Enfants héritent le statut tombstone | Conformément au cycle de vie de LifecycleAggregate (§2.11 DOC-017) |
| Parent hard purgé | Enfants hard purgés (si composition) OU enfants deviennent orphelins avec `_tombstone=true` (si référence) | Dépend de la stratégie de persistance : Composition = suppression implicite ; Référence = orphelins marqués |
| Parent mis à jour | Enfants non affectés sauf si modification触及 un champ partagé | Les enfants sont indépendants après création |

#### Propriété Et Composition

- **Composition stricte :** Lorsqu'un enfant n'existe que dans le contexte de son parent et disparaît avec lui (ex : `OrgUnit` dans `OrganizationAggregate`, `FormField` dans `FormAggregate`), la suppression du parent entraîne la suppression de tous les enfants. C'est le pattern Embedded de DOC-017 §4.1.
- **Référence seulement :** Lorsqu'un enfant a son propre cycle de vie (ex : `User` référencé depuis `OrganizationAggregate`), la suppression du parent NE supprime PAS l'enfant. C'est le pattern Referenced de DOC-017 §4.2.

Cette distinction est déterminée par le Domain Model (DOC-012), pas par le choix de stockage.

### 3.3 Relations N:N (Plus À Plus)

#### Objectif Junction

Toute relation N:N doit passer par un objet junction explicite. Il n'existe PAS de liaison N:N implicite ou directe entre deux Agrégats.

L'objet junction est un objet physique autonome qui contient au minimum :
- La référence vers l'objet A
- La référence vers l'objet B
- Un horodatage de création
- L'identifiant de l'opérateur (pour l'audit)
- `_org_id` pour l'isolement multi-locataire

#### Quand L'Objet Junction Devient Son Propre Agrégat

L'objet junction cesse d'être un simple mécanisme de liaison et devient un agrégat autonome lorsque l'un des critères suivants est rencontré :

- L'objet junction possède ses propres métadonnées métier au-delà de la simple liaison (ex : `GroupMembership` avec `MembershipRole` et `join_timestamp`)
- L'objet junction est queryable indépendamment de ses objets sources
- L'objet junction a son propre cycle de vie (peut exister sans les deux parties simultanément)

Dans ce cas, l'objet junction doit être documenté comme un Agrégat à part entière dans DOC-012.

#### Règles Pour Les Relations N:N Via Junction

- Chaque paire (A, B) est unique : un même couple ne peut être lié qu'une seule fois. La duplication est interdite.
- La suppression de A ne supprime pas la liaison. Elle laisse un junction « orphelin » qui doit être nettoyé par un processus planifié.
- La suppression de B a le même effet.
- Le junction est créé atomiquement avec les deux références. L'opération échoue si l'une des références n'existe pas.

**Exemple dans Lumina :** `GroupMembership` est un objet junction entre `IdentityAggregate` (MemberRecord) et `RelationshipAggregate` (OrgUnit), avec métadonnées supplémentaires (`membership_role`, `joined_at`). Il a suffisamment de métadonnées pour justifier son inclusion dans RelationshipAggregate comme entité intégrée (DOC-012, §2.4).

### 3.4 Relations Auto-Référencées

#### Hiérarchies

Les relations auto-référencées servent à modéliser des structures hiérarchiques où un objet d'un certain type référence un autre objet du même type.

- La relation auto-référencée la plus significative dans Lumina est `OrgUnitParentLink` : chaque OrgUnit référence son parent, qui est aussi un OrgUnit.
- Cette relation forme un DAG (graphe acyclique orienté) contrôlé par les règles de DOC-012 (§2.4 RelationshipAggregate, BR-REL-001).

#### Contraintes De Profondeur

- La profondeur maximale d'une hiérarchie auto-référencée est définie par le Domaine. Pour les OrgUnit, c'est 5 niveaux maximum (DOC-015, INV REL-002).
- La profondeur est calculée au niveau du Domaine AVANT d'atteindre la couche physique. Si le calcul montre qu'une insertion dépasserait la limite, l'opération est rejetée par le Domain Model et n'atteint jamais la persistance.
- La profondeur est stockée comme un attribut dérivé sur chaque objet de la hiérarchie, recalculé à chaque modification de la structure parente.

#### DAG Et Détection De Cycles

- Toute relation auto-référencée hiérarchique doit être validée contre la détection de cycles avant d'être persistée.
- La détection de cycles est faite par le Domaine (topological sort / Kahn's algorithm), pas par le moteur de stockage.
- L'échec de validation de cycle est une erreur bloquante de niveau Aggregate.

### 3.5 Références Polymorphiques

#### Quand Les Références Cross-Type Sont Autorisées

Une référence polymorphe (un objet A peut pointer vers un objet de type T1 OU T2 OU T3) est autorisée uniquement lorsque :

- Le Domaine définit explicitement cette multiplicité (ex : `ArchiveEntry` dans LifecycleAggregate référence des resources de différents types via `resource_type` + `resource_id`)
- L'objet référencé est toujours dans le même Aggregate (la polymorphie ne traverse PAS les frontières d'Aggregate sans passer par un domaine service)
- Le type est déclaré et énuméré (pas de types arbitraires)

#### Règles Pour Les Références Polymorphiques

- Chaque référence polymorphe stocke DEUX champs : l'identifiant de l'objet cible ET le type de l'objet cible.
- La validation de existence de la cible est faite au niveau du Domaine. Une référence polymorphe pointant vers un objet inexistant est une erreur de validation.
- Les références polymorphiques ne supportent PAS la récursion (un type ne peut pas se référencer lui-même de manière polymorphe sauf si explicitément défini dans le Domaine).

**Exemple :** `LifecycleAggregate.ArchiveEntry.resource_type` peut être `transaction`, `member`, `event`, ou `archive_entry`. `LifecycleAggregate.ArchiveEntry.resource_id` contient l'identifiant de l'entrée correspondante dans ResourceAggregate.

---

## 4. PATTERNS DE COMPOSITION

### 4.1 Value Objects Intégrés → Stockés Inline

Les Value Objects du Domaine (DOC-012) sont, par définition, des objets sans identité indépendante stockés directement dans leur parent.

**Règles physiques :**
- Les attributes d'un Value Object sont stockés comme des colonnes/champs inline dans le même enregistrement/document que leur parent.
- Aucun identifiant propre n'est assigné au Value Object.
- La mutation d'un Value Object implique la mutation du parent : le champ `_persist_version` du parent est incrémenté.
- Les Value Objects imbriqués (un VO contenant un autre VO) sont aplatís au niveau physique selon une convention de nommage : `parent.vo_field.subfield`.

**Exemples dans Lumina :** `AmountInCents` (ResourceAggregate) est stocké comme un champ monétaire inline dans l'enregistrement TransactionRecord. `EmailAddress` (IdentityAggregate) est stocké inline dans User. `SettingValue` (ConfigurationAggregate) est stocké inline dans SettingEntry.

### 4.2 Collections Possédées → Enregistrements Enfants Avec Référence Parent

Les collections bornées au sein d'un Aggregate (DOC-019 §2.4) sont stockées soit :
- Comme sous-documents intégrés (pour les petites collections ≤ 1000 éléments, DOC-017 §4.1)
- Comme enregistrements enfants séparés avec une référence au parent (pour les collections volumineuses ou nécessitant des requêtes individuelles)

**Règles :**
- Chaque enfant de collection possède une référence explicite au parent via `parent_id`.
- L'ordre de la collection est préservé via un champ `position` ou par horodatage d'insertion.
- L'ajout ou la suppression d'un élément de collection incrémente le champ `_persist_version` du parent.
- La collection complète est exclue des vérifications d'unicité — l'unicité s'applique au niveau de l'élément individuel au sein de la collection.

**Exemples :** Collection de `TransactionRecord` dans ResourceAggregate, collection de `PendingOperation` dans OfflineSyncAggregate, collection de `WorkflowStep` dans WorkflowAggregate.

### 4.3 Sous-objets Facultatifs → Stockés Nullable Ou Comme Enregistrements Légers

Un sous-objet optionnel est un objet fils dont la présence n'est pas garantie au moment de la création du parent.

**Règles :**
- Lorsqu'un sous-objet optionnel est stocké inline dans le parent, tous ses champs sont nullable.
- Lorsqu'un sous-objet optionnel est stocké séparément, l'absence de référence signifie l'absence d'objet — aucune entrée vide n'est créée.
- La transition absent → présent est un create. La transition présent → absent est un delete (pas un set-null).

### 4.4 Immutabilité Des Value Objects Au Niveau Physique

Bien que les Value Objects soient mutables au niveau du Domaine (une nouvelle instance est créée pour représenter l'état modifié), leur représentation physique obéit à des règles d'immutabilité indirecte :

- Un Value Object modifié ne crée PAS un nouvel enregistrement physique. Il modifie les champs inline existants dans l'enregistrement parent.
- L'immutabilité du Value Object au niveau Domaine se traduit par le remplacement complet du VO dans le parent : les anciens valores sont écrasés par les nouveaux.
- Le champ `_persist_version` du parent est incrémenté à chaque remplacement de VO, capturant la mutation au niveau de la version de l'entité parente.

---

## 5. VERSIONNING AU NIVEAU PHYSIQUE

### 5.1 Versionning Optimiste → Attribute De Version Sur L'objet

Le versionning optimiste (DOC-019 §2.6, DOC-017 §4.5) se matérialise physiquement par un attribut numérique séquentiel sur chaque objet versionné.

**Règles physiques :**
- L'attribut de version est un entier strictement croissant, initialisé à 1 à la création.
- Toute opération d'écriture vérifie que la version envoyée correspond à la version stockée. Si non, l'opération échoue avec un code de conflit de verrouillage optimiste.
- En cas de succès, la version est incrémentée avant l'écriture.
- L'attribut de version est stocké dans l'objet physique courant, pas dans une table séparée.

**Objects versionnés dans Lumina :** `Organization`, `User`, `TransactionRecord`, `WorkflowInstance`, `ArchiveEntry`, `FormDefinition` (version sémantique), `SettingEntry` (mise à jour inplace).

### 5.2 Historique Ajout-Seulement → Objet Physique Séparé Pour Les Entrées Historiques

Les patterns ajout-seulement (DOC-017 §4.4, AuditAggregate exclusivement par NB-PERSIST-006) utilisent un objet physique distinct pour chaque entrée d'historique.

**Règles physiques :**
- Chaque entrée d'historique est un enregistrement indépendant dans une collection dédiée.
- Les entrées d'historique ne sont jamais modifiées : niUPDATE, ni DELETE en localisé.
- Un champ de position (auto-incrément ou séquence logique) garantit l'ordre d'apparition.
- La récupération de l'historique complet se fait par lecture séquentielle de la collection d'historique.

### 5.3 Versionning Basé Sur L'État → Journal De Transition D'État

Le versionning basé sur l'état (DOC-017 §2.11, LifecycleAggregate) remplace l'attribut de version numérique par un enregistrement explicite des transitions.

**Règles physiques :**
- Chaque transition d'état est un enregistrement avec : état source, état cible, timestamp, opérateur, motif.
- L'état courant de l'objet est le dernier enregistrement du journal des transitions.
- Pour reconstruire l'historique, on lit toutes les transitions dans l'ordre.
- Les transitions invalides (non autorisées par le graphe d'états) sont rejetées au niveau du Domaine avant d'atteindre la couche physique.

### 5.4 Requêtes Multi-Version → Attributs Temporels Ou Pattern Time-Travel

Pour les objets nécessitant des requêtes de type « état à un instant T » :

**Règles physiques :**
- Deux approches possibles, choisies selon le pattern de requête dominant :
  - **Attributs temporels :** Chaque objet physique possède `valid_from` et `valid_to`. L'objet courant a `valid_to` nul ou infini. Les versions passées ont des bornes définies.
  - **Version-based query :** Chaque version est identifiable par son numéro de version. Les requêtes temporales traduisent le timestamp demandé en numéro de version le plus proche antérieur.
- L'approche choisie est documentée dans le Physical Data Model (DOC-021) pour chaque Aggregate concerné.

---

## 6. STRUCTURE PHYSIQUE D'AUDIT

### 6.1 Objets D'Audit Liés Aux Objets Audités

Chaque entrée d'audit est liée à l'objet audité par :
- `entity_type` : l'identifiant de l'Aggregate source de l'événement
- `entity_id` : l'identifiant de l'objet spécifique audité
- `_org_id` : l'identifiant du locataire

**Règle :** L'audit est toujours ajouté après le fait. L'entrée d'audit est appendée dans AuditAggregate DEPUIS l'Aggregate audité, jamais l'inverse. AuditAggregate ne référence aucun autre Aggregate pour écrire — il ne fait que recevoir des demandes d'écriture via `LogAction`.

### 6.2 Mécanisme Avant/Après

Chaque entrée d'audit capture systématiquement les deux snapshots :

- `old_values` : l'état complet de l'objet audité avant la modification (toujours présent, même pour les créations où il est vide/null)
- `new_values` : l'état complet de l'objet audité après la modification (toujours présent, même pour les suppressions où il est vide/null)

Cette règle est absolue (DOC-015, INV AUD-002) et ne possède aucune exception.

### 6.3 Modèle Ajout-Immuable

Les entrées d'audit suivent le pattern Immuable Ajout (DOC-017 §4.4) :

- Aucune entrée d'audit ne peut être modifiée après écriture.
- Aucune entrée d'audit ne peut être supprimée pendant la période de rétention (minimum 7 ans, DOC-015 INV RETENTION-031).
- Après expiration de la période de rétention, la purge est irréversible et doit elle-même être journalisée (sauf que AuditAggregate ne s'audite pas lui-même, NB-PERSIST-007).
- Les entrées d'audit sont physiquement séparées des données auditées : elles ne partagent jamais le même espace de stockage逻辑que leurs sources.

### 6.4 Politiques De Rétention Au Niveau Physique

- La rétention est configurée via Policy (DOC-017 §6, NB-PERSIST-011).
- Au niveau physique, chaque entrée d'audit porte un champ `_retention_expires_at` calculé lors de l'écriture.
- Un processus de purge planifié identifie et supprime les entrées expirées.
- La purge elle-même est journalisée dans une section dédiée aux opérations administratives.

---

## 7. SUPPRESSION LOGIQUE ET CYCLE DE VIE PHYSIQUE

### 7.1 Pattern Marqueur Tombe Pierre

La suppression logique au niveau physique se manifeste par un champ indicateur sur l'objet :

- `_tombstone = true` indique que l'objet est supprimé logiquement mais physiquement encore présent.
- Les requêtes normales excluent les objets avec `_tombstone = true`.
- Les requêtes de sync incluent les objets tombstoned pour propager la suppression aux appareils synchronisés.

### 7.2 Machine À États Corbeille / Purge

Le cycle de vie physique suit la machine d'états de LifecycleAggregate (DOC-012, §2.11) :

```
active → archived → trashed → purged
              ↑        ↓
              └── restore ──┘
```

**Règles physiques :**
- La transition `trashed → active` (restauration) est possible tant que l'objet n'a pas été purgé.
- La transition `purged → tout` est interdite (DOC-015 INV LIF-003). Une fois purgé, l'objet est physiquement supprimé et ne peut être restauré.
- Chaque état est représenté physiquement par une valeur d'attribut `status` ou par la présence/absence d'enregistrement.

### 7.3 Application De La Période De Rétention

- Chaque entrée avec `_tombstone = true` possède un champ `_purge_date` calculé comme `current_time + configured_retention_period`.
- Le processus de purge planifié (PurgeScheduler, DOC-012 §2.11) identifie les entrées dont `_purge_date` est dépassé.
- Avant purge effective, une entrée d'audit est appendée dans AuditAggregate documenting the deletion.
- La purge physique réelle supprime les données de stockage et rend l'espace disponible.

### 7.4 Structure De Planification De Purge

- La planification de purge est un objet léger stocké dans OfflineSyncAggregate avec les métadonnées de dernier passage et le prochain interval.
- Elle est indépendante du cycle de vie des objets purgés : sa suppression n'empêche pas la purge, elle empêche juste la détection automatisée.

---

## 8. ISOLEMENT MULTI-LOCATAIRE PHYSIQUE

### 8.1 Attribut De Référence Propriétaire Obligatoire

TOUT objet physique de Lumina possède l'attribut `_org_id`. Cet attribut est :

- Injecté automatiquement lors de la création de l'objet (jamais fourni par l'utilisateur final)
- Validé lors de toute opération de lecture : l'_org_id de la requête doit correspondre à l'_org_id stocké
- Partagé par tous les objets physiques, quelle que soit leur stratégie de persistance

**Exception :** AuditAggregate est un cas spécial. Les entrées d'audit portent l'_org_id de l'entité auditée, mais AuditAggregate lui-même n'est pas partitionné par org au niveau système. L'_org_id sur une entrée d'audit sert à filtrer les requêtes d'audit, pas à partitionner le stockage.

### 8.2 Requêtes Inter-Locataires Interdites

- Toute requête physique doit inclure une clause de filtrage par `_org_id`.
- L'omission de `_org_id` dans une requête est une erreur critique.
- Les jointures entre objets de `_org_id` différents sont interdites au niveau physique.
- Si deux objets doivent être joints et qu'ils appartiennent à des locataires différents, la jointure ne peut être effectuée qu'au niveau application (requête séparée par locataire puis combinaison en mémoire), jamais au niveau stockage.

### 8.3 Isolation Au Niveau De La Requête Physique

L'isolement multi-locataire est garanti à la fois par :
- **Application layer :** Chaque requête générée par l'application inclut implicitement `_org_id` via le contexte tenant injecté.
- **Persistance layer :** Les objets de persistance portent `_org_id` comme métadonnée non modifiable.
- **Database layer (si applicable) :** L'implémentation de stockage peut ajouter une contrainte de niveau base de données (par exemple, un trigger qui vérifie `_org_id` ou une politique RLS). Mais ces mécanismes sont complémentaires, pas substitutifs. L'isolement fondamental vient du Domaine et de la couche persistance.

### 8.4 Règles JamaisModifier Pour L'Isolement Multi-Locataire

| # | Règle | Description |
|---|-------|-------------|
| NB-MT-001 | JamaisModifier-AucunOrgSansOrgId | Aucun objet physique ne peut exister sans `_org_id` valide |
| NB-MT-002 | JamaisModifier-RequêteSansFiltreOrg | Aucune requête physique ne peut s'exécuter sans filtre par `_org_id` |
| NB-MT-003 | JamaisModifier-JointureInter-tenant | Aucune jointure physique ne peut relier des objets de `_org_id` différents |
| NB-MT-004 | JamaisModifier-ModificationOrgId | L'_org_id d'un objet ne peut jamais être modifié après création |

**Violation :** Toute violation de ces règles constitue une faille de sécurité architecturale majeure et nécessite un correctif immédiur ainsi qu'une documentation ADR.

---

## 9. RÈGLES JAMAISMODIFIER POUR LE MODÈLE RELATIONNEL

### 9.1 Liste Des Règles JamaisModifier

| # | Règle | Description | Violation |
|---|-------|-------------|-----------|
| NB-RR-001 | JamaisModifier-Boundary-Agrégat | Aucune structure physique ne peut changer la frontière d'un Aggregate. Si une structure relationnelle suggère de déplacer des données entre Agrégats, la structure est incorrecte, pas la boundary. | Extraire des transactions dudit de ResourceAggregate vers un nouvel Aggregate dédié à cause de performances de requête |
| NB-RR-002 | JamaisModifier-Logique-Métier | Aucune structure physique ne peut introduire une logique métier. Les structures relationnelles sont des véhicules de données, pas des moteurs de règle. Si une contrainte relationnelle impose un comportement métier non défini dans DOC-012 ou DOC-015, elle est invalide. | Ajouter une contrainte relationnelle interdisant une transaction sans category alors que la validation existe déjà au niveau Domaine |
| NB-RR-003 | JamaisModifier-Isolement-Multi-tenant | L'isolement multi-locataire (_org_id) ne peut jamais être contourné, désactivé, ou rendu optionnel. Toutes les règles de §8 s'appliquent en permanence. | Créer une vue ou un endpoint système qui lit les données de plusieurs _org_id |
| NB-RR-004 | JamaisModifier-Immutabilité-Audit | L'immuabilité d'AuditAggregate (NB-PERSIST-006) ne peut jamais être affaiblie. Aucune structure physique, aucun index, aucune vue ne peuvent permettre la modification ou la suppression d'entrées d'audit pendant la période de rétention. | Indexer les entrées d'audit de manière à permettre UPDATE par un administrateur DB |
| NB-RR-005 | JamaisModifier-Direction-Relation-Domaine | La direction de toute relation physique doit correspondre au pattern de navigation du Domaine. Si le Domaine navigue de A vers B, la référence physique va de B vers A (l'enfant pointe le parent). L'inverse est interdit. | Stocker `parent_id` dans OrgUnit (correct :孩子指向父) versus stocker `child_ids` dans le parent (incorrect : ça inverse la navigation) |
| NB-RR-006 | JamaisModifier-Hygiène-Identification | Les règles d'identification (§2, NB-ID-001 à NB-ID-004) s'appliquent à tout identifiant physique, sans exception. | Remplacer un identifiant naturel par un surrogé après la création |
| NB-RR-007 | JamaisModifier-Stratégie-Audit-Exclusive | Seul AuditAggregate utilise le pattern Journal Immuable (NB-PERSIST-006, DOC-019 §4.4). Aucun autre Aggregate ne peut adopter ce pattern sans amendement ADR. | Utiliser un journal ajout-seulement pour les PendingOperations d'OfflineSyncAggregate en plus de leur pattern Collection |
| NB-RR-008 | JamaisModifier-Absence-SelfAudit | AuditAggregate ne s'auditte pas lui-même (NB-PERSIST-007). Aucune structure physique ne peut créer de boucle de rétroaction où une entrée d'audit génère une autre entrée d'audit dans AuditAggregate. | Loguer la purge d'anciennes entrées d'audit DANS AuditAggregate |

### 9.2 Validation Des Règles JamaisModifier

Chaque règle JamaisModifier a un mécanisme de validation :

- **NB-RR-001, NB-RR-002, NB-RR-006, NB-RR-007, NB-RR-008 :** Validation architecturale. Vérifiée lors de tout review de code ou de changement de modèle physique. Signalée par la compétence `architecture-guardian`.
- **NB-RR-003, NB-RR-004 :** Validation automatique au niveau application (checks d'_org_id) + validation manuelle périodique (audit de sécurité).
- **NB-RR-005 :** Validation statique lors de la conception de toute nouvelle relation physique. La direction est vérifiée contre le diagramme de relations de DOC-012.

### 9.3 AmendeMENT Des Règles JamaisModifier

Aucune règle JamaisModifier ne peut être modifiée, suspendue ou supprimée sans :

1. Une proposition d'amendement écrite documentant la raison, l'impact et les alternatives examinées.
2. Un Appel à Discussion d'Architecture (ADR) créant une exception temporelle ou permanente.
3. L'approbation du CTO et de l'Architecte Principal.
4. La mise à jour simultanée de DOC-023 pour refléter l'amendement.

Un amendement n'applye RACOURCIQUEMENT que vers l'avant. Les données précédemment conformes ne sont pas rétroactivement invalidées.

---

## 10. MATRICE DES RELATIONS PAR AGGREGAT

Cette matrice résume les patterns relationnels pour chaque Aggregate, en se basant sur DOC-012, DOC-017 et DOC-019.

| Aggregate | Relations Sortantes 1:1 | Relations Sortantes 1:N | Relations N:N (via Junction) | Auto-Référence | Référence Polymorphe |
|-----------|------------------------|------------------------|------------------------------|----------------|---------------------|
| **OrganizationAggregate** | OrganizationSettings (VO inline) | OrgUnit (embedded collection) | — | OrgUnit.parent_id → OrgUnit | — |
| **IdentityAggregate** | SessionContext (VO inline) | — | Membership via GroupMembership (junction dans RelationshipAggregate) | — | — |
| **ResourceAggregate** | ResourceMetadata (VO inline), ResourceVersion (VO inline) | TransactionRecord collection, MemberRecord collection, EventRecord collection, ArchiveEntryRecord collection | Compensation via `compensates_for` (auto-référence dans ResourceAggregate) | Transaction.compensates_for → Transaction | ArchiveEntry.link → {Transaction, Member, Event, ArchiveEntry} |
| **RelationshipAggregate** | — | GroupMembership collection, OrgUnitParentLink collection | GroupMembership (N:N Member ↔ OrgUnit) | OrgUnitParentLink.target_unit → OrgUnit | — |
| **WorkflowAggregate** | — | WorkflowStep collection | — | — | — |
| **FormAggregate** | SectionDef ↔ FieldDef (embedded) | FormField embedded within FormDefinition | — | — | — |
| **NotificationAggregate** | NotificationPreference (VO inline) | NotificationMessage collection | — | — | — |
| **VocabularyAggregate** | LabelPair (VO inline) | Term collection, TermValue collection | — | — | — |
| **ReportingAggregate** | — | GeneratedReport (snapshot) | — | — | — |
| **AuditAggregate** | — | AuditLogEntry collection (append-only) | — | — | entity_type + entity_id (polymorphic reference to audited objects) |
| **LifecycleAggregate** | — | ArchiveEntry collection | — | — | ArchiveEntry.resource_type + resource_id → any ResourceAggregate entity |
| **ConfigurationAggregate** | SettingKey/SettingValue (VO inline) | SettingEntry collection | — | — | — |
| **OfflineSyncAggregate** | SyncStatusTracker (embedded) | PendingOperation collection | — | — | — |

---

## 11. TRACABILITÉ CROISÉE

| Section DOC-023 | Document Source | Référence |
|----------------|-----------------|-----------|
| Aggregate boundaries | DOC-012 (Canonical Domain Model) | 13 Aggregates with defined boundaries |
| Persistence strategies | DOC-017 (Persistence Model) | Section 2 per Aggregate |
| Serialization patterns | DOC-017 §4 | Embedded, Referenced, Collection, Immutable Log, Versioned Document, Snapshot |
| Persistence strategies catalog | DOC-019 | 9 strategies with combinations and compatibility |
| Domain invariants | DOC-015 (Invariant Registry) | 58 invariants governing relational constraints |
| Conflict resolution | DOC-017 §2.3b | Per-entity-type conflict matrix |
| NeverBreak rules | DOC-017 §6, DOC-019 §6 | NB-PERSIST-001 through NB-PERSIST-012, NB-CAT-001 through NB-CAT-007 |

---

## 12. SYNTHÈSE : RÈGLES EN UN COUP D'ŒIL

| Catégorie | Nombre De Règles | Règles Clés |
|-----------|-----------------|-------------|
| Identificateurs | 4 NeverBreak (NB-ID-001 à 004) | Naturels immuables, surrogés permanents, portée par Aggregate |
| Relations 1:1 | Inline vs Référence selon cycle de vie | Référence séparée seulement si cycles indépendants |
| Relations 1:N | Référence côté N vers côté 1 | Cascade de suppression dépend de Composition vs Référence |
| Relations N:N | Junction obligatoire | Junction devient Aggregate quand métadonnées métier propres |
| Auto-référence | DAG avec profondeur max | Détection de cycles par Domaine, pas par base de données |
| Polymorphie | Type + ID obligatoires | Restreinte au même Aggregate, types énumérés |
| Composition | VO inline, collections enfant séparées | Version parent incrémentée à chaque mutation enfant |
| Versionning | Optimiste (numérique), Append-only, État | Stratégie dépend de l'Aggregate (DOC-017 §2) |
| Audit | Before/after mandatory, Append-only exclusive | AuditAggregate exclusif (NB-PERSIST-006) |
| Cycle de vie | Tombstone → Trash → Purge | Purge irréversible (INV LIF-003) |
| Multi-tenant | _org_id obligatoire sur TOUT objet | Requêtes cross-tenant interdites (NB-MT-001 à 004) |
| NeverBreak relationnel | 8 règles (NB-RR-001 à 008) | Boundaries intangibles, isolement absolu, audit inviolable |

---

## RÉSUMÉ EXÉCUTIF

Ce document établit 27 règles relationnelles physiques (regroupées en 4 catégories NeverBreak : Identificateurs, Relations, Composition, Versionning/Audit/Cycle-de-vie/Isolement) qui gouvernent la structuration de toute donnée physique dans Lumina. Ces règles sont :

1. **Stables** — les identificateurs ne changent jamais (NB-ID-001 à 004)
2. **Navigables** — la direction des relations correspond à la navigation du Domaine (NB-RR-005)
3. **Isolées** — chaque objet est partitionné par `_org_id` avec aucune fuite inter-tenant possible (NB-MT-001 à 004)
4. **Traçables** — chaque modification est capturée avec old/new values (AUD-002)
5. **Immuablement auditées** — AuditAggregate utilise exclusivement le pattern Journal Immuable (NB-PERSIST-006)
6. **Boundary-respectueuses** — aucune structure relationnelle ne modifie les frontières d'Aggregate (NB-RR-001)
7. **Technologie-indépendantes** — aucune syntaxe DDL, aucun type de données, aucune dépendance moteur de stockage

Tout nouveau développement, toute modification de modèle physique, toute migration doivent être validés contre ces règles. Une violation constitue une rupture architecturale nécessitant documentation ADR.

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Règles relationnelles canoniques constitutionnelles pour 13 Agrégats, 27 règles NeverBreak organisées en 4 catégories | CTO + Arch Principal |
