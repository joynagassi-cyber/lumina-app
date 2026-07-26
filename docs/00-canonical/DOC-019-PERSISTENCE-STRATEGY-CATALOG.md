# DOC-019 — Persistence Strategy Catalog

**Doc ID:** DOC-019 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — CATALOGUE FIGÉ DES STRATÉGIES DE PERSISTANCE  
**Date:** 2026-01-24  

---

## PRÉAMBULE

Ce document est un **catalogue de stratégies de persistance**. Il ne prescrit AUCUNE technologie, AUCun moteur de stockage, AUCun langage, AUCune API.

Ce que ce document définit : pour chaque stratégie autorisée, il précise l'objectif, le cas d'usage, les avantages, les limites, la compatibilité avec l'architecture Lumina, et les critères de sélection.

Ce que ce document ne définit PAS : quelles tables créer, quels ORM utiliser, quels index ajouter, quels scripts de migration écrire, quelle base déployer, comment serialiser, comment connecter. Tout cela appartient aux couches en dessous du modèle de persistance (DOC-017) et du modèle conceptuel (DOC-012).

**Règle fondamentale :** Si une phrase de ce document ne peut pas être lue par un développeur qui n'a jamais vu Lumina sans comprendre le sens général → elle contient un détail technique trop bas niveau et doit être reformulée.

---

## 1. OBJECTIF DE CE CATALOGUE

Chaque stratégie de persistance décrit **COMMENT** l'état d'un Aggregate est persisté, pas **OÙ** ni **AVEC QUOI**. Ce catalogue standardise le vocabulaire des stratégies de persistance au sein de Lumina afin que chaque choix de conservation soit reproductible, justifiable, et indépendant de toute technologie particulière.

Un catalogue, à la différence d'un document de décision, n'est pas un point — c'est un référentiel vivant dans lequel chaque stratégie est autonome. Les stratégies coexistent. Un même Aggregate peut utiliser plusieurs stratégies simultanément. L'architecture ne force jamais une stratégie unique.

**Référence constitutionnelle :** NB-PERSIST-010 (DOC-017) interdit explicitement toute mention de technologies spécifiques dans les documents de niveau domaine et persistance. Ce catalogue respecte cette interdiction de bout en bout.

---

## 2. STRATÉGIES AUTORISÉES

Huit stratégies sont autorisées dans l'architecture Lumina. Chaque section ci-dessous décrit une stratégie complète.

---

### 2.1 Aggregate Completeness (Intégrité d'Aggregate)

**Objectif :** Persister l'intégralité d'un aggregate en une seule unité atomique. L'aggregate est la plus petite unité de cohérence et de transaction ; lorsqu'il est modifié, tout son état est lu puis réécrit.

**Cas d'utilisation :**
- L'aggregate est toujours accédé en entier (pas de sous-partie utilisée isolément)
- Les frontières de l'aggregate sont claires et non chevauchantes avec d'autres aggregates
- Le coût de lecture/réécriture de l'ensemble est acceptable comparé à la complexité d'un accès partiel
- L'atomicité transactionnelle couvre naturellement l'ensemble de l'aggregate

**Avantages :**
- Cohérence garantie : l'état lu et l'état écrit appartiennent toujours au même instant logique
- Simplicité d'implémentation : une opération unique, pas de jonction multi-aggregate
- Prévention des états corrompus partiels : soit tout est persisté, soit rien ne l'est
- Correspondance directe avec le pattern DDD Aggregate root

**Limites :**
- Inefficace si l'aggregate contient de grands sous-graphes dont seules quelques parties sont consultées fréquemment
- Gaspillage de bande passante et d'espace de stockage lors de lectures partielles récurrentes
- Non adapté aux aggregates dont certaines composantes évoluent à des fréquences très différentes

**Compatibilité avec l'architecture Lumina :** Utilisé comme stratégie de base pour tous les aggregates dont le périmètre d'accès correspond à leur frontière naturelle. Application directe du principe DDD tel que défini dans DOC-012. Compatible avec OfflineSyncAggregate (§2.7) pour les modifications locales.

**Critères de sélection :** Choisir cette stratégie lorsque la plupart des lectures accèdent à l'intégralité de l'aggregate ET que les modifications touchent l'ensemble de l'état. Ne pas choisir si des sous-ensembles fréquentiels de l'aggregate seraient mieux servis par des charges partielles.

**Exemples dans Lumina :** OrganizationAggregate (l'org profile + ses org units + ses settings sont lus ensemble), FormAggregate (la définition entière d'un formulaire est rendue en une fois), ConfigurationAggregate (les paramètres sont lus comme un bloc cohérent).

---

### 2.2 Composition (Intégré / Embedded)

**Objectif :** Un aggregate intègre directement un autre aggregate ou objet valeur comme partie de sa propre frontière. L'enfant n'existe pas en dehors du parent.

**Cas d'utilisation :**
- L'objet enfant n'a aucune identité indépendante
- Le cycle de vie de l'enfant est strictement lié au cycle de vie du parent (l'enfant disparaît quand le parent disparaît)
- L'enfant est toujours consulté en conjonction avec le parent
- L'enfant ne fait l'objet d'aucune requête autonome

**Avantages :**
- Simplicité de requête : un seul accès récupère parent + enfants
- Suppression implicite : supprimer le parent supprime automatiquement les enfants
- Cohérence naturelle : impossible d'avoir un orphelin car l'enfant n'existe pas séparément
- Pas de coût de jointure ou de référence externe

**Limites :**
- Impossibilité de requêter l'enfant indépendamment du parent
- L'enfant ne peut pas être partagé entre plusieurs parents
- La duplication d'enfants fréquents dans plusieurs parents augmente le volume de données redondant
- Difficulté à gérer les mises à jour partielles de l'enfant (oblige à réécrire le parent)

**Compatibilité avec l'architecture Lumina :** Conforme au principe d'agrégation DDD. S'aligne sur la règle des boundaries d'aggregate de DOC-012. Les Value Objects du Domain Model sont par définition intégrés (ils n'ont pas d'identité propre). Utilisé conjointement avec Aggregate Completeness pour former la base des aggregates simples.

**Critères de sélection :** Choisir lorsque l'objet intégré n'a pas d'identité séparée ET n'est jamais queryé hors contexte parent. Ne pas choisir si l'objet intégré a besoin d'identités indépendantes, de cycle de vie différent, ou de partage multi-parent.

**Exemples dans Lumina :** `OrgUnit` intégré dans `OrganizationAggregate` (les unités existent uniquement dans le contexte de leur org), `FormField` et `SectionDef` intégrés dans `FormDefinition`, `SessionContext` intégré dans `IdentityAggregate` (lié au cycle de vie de la session utilisateur), `NotificationPreference` intégré dans `NotificationAggregate`, `PendingOperation` dans `OfflineSyncAggregate`.

---

### 2.3 Référence (Liaison par identifiant)

**Objectif :** Un aggregate A référence un aggregate B par son identifiant, sans contenir son contenu. Les deux aggregates maintiennent des frontières indépendantes mais entretenaient une relation via la référence.

**Cas d'utilisation :**
- Deux aggregates partagent une relation mais conservent des frontières et des cycles de vie indépendants
- L'aggregate référencé peut exister sans l'aggregate référençant
- Les deux aggregates peuvent être queryés et mis à jour indépendamment
- Le coût de charger l'entier de l'aggregate référencé n'est pas justifié pour toutes les opérations

**Avantages :**
- Découplage fort : chaque aggregate vit sa propre vie
- Évite la duplication de données à grande échelle
- Permet à plusieurs aggregates de référencer le même objet sans le copier
- Supporte naturellement les relations N:M via des tables/joins intermédiaires

**Limites :**
- Requiert des jointures ou lectures supplémentaires pour reconstruire l'état complet
- Risque de références orphelines si l'aggregate référencé est supprimé
- Indirection excessive peut dégrader les performances si de multiples références en chaîne sont nécessaires
- Complexité accrue de gestion de la cohérence référentielle

**Compatibilité avec l'architecture Lumina :** Conforme à la notion DDD d'References between Aggregates (utilise l'ID plutôt que l'objet complet). Aligné avec RelationshipAggregate qui gère les connexions universelles entre ressources et identités (DOC-012, §2.4). Compatible avec les patterns Offline Sync et Audit.

**Critères de sélection :** Choisir lorsque deux aggregates ont une relation sémantique mais des frontières d'invariant indépendantes. Ne pas choisir si la relation est compositionnelle (has-a pur) ou si les deux sont toujours lus ensemble (préférer Composition).

**Exemples dans Lumina :** `User` référencé depuis `OrganizationAggregate` (un user appartient à une org mais existe indépendamment au sein de celle-ci), liens `OrgUnitParentLink` (chaque org unit est référencé via son parent sans contenir tout l'arbre), ResourceAggregate référence IdentityAggregate via `created_by`.

---

### 2.4 Collection

**Objectif :** Maintenir une collection bornée d'objets à l'intérieur d'une seule frontière d'aggregate. La collection est gérée atomiquement et chaque élément a une identité au sein de la collection mais pas en dehors.

**Cas d'utilisation :**
- La collection est manipulée comme un tout atomique (ajout/suppression/replacement en groupe)
- Les éléments n'ont pas de cycle de vie indépendant en dehors de la collection
- Le nombre d'éléments est prévisible et reste dans des limites opérationnelles raisonnables
- L'ordre ou la structure interne de la collection fait partie du domaine

**Avantages :**
- Opérations groupées atomiques (ajouter/supprimer plusieurs éléments en un seul commit)
- Structure explicite et ordonnée des données apparentées
- Pas de coût de référence externe pour chaque élément
- Maintien naturel de l'ordre d'insertion ou d'un ordre métier

**Limites :**
- La collection ne peut pas croître au-delà des limites opérationnelles (performance de lecture/écriture)
- Impossible de requêter un élément individuel sans charger la collection complète
- Opérations partielles sur un élément nécessitent une réécriture de la collection entière
- Nécessite une gestion explicite des limites de taille

**Compatibilité avec l'architecture Lumina :** Conforme au pattern « bounded collection within an aggregate boundary » de DDD. Aligné avec ResourceAggregate qui contient des collections de resources typedes (TransactionRecord, MemberRecord, EventRecord), NotificationAggregate (collection de messages), et OfflineSyncAggregate (queue d'opérations en attente). Compatible avec les patterns Versioning et Event Log pour les collections à historique.

**Critères de sélection :** Choisir pour les collections dont la taille reste raisonnable et dont les éléments sont toujours gérés collectivement. Ne pas choisir si les éléments doivent être queryés individuellement fréquemment ou si la collection risque de croître au-delà des limites de performance.

**Exemples dans Lumina :** Collection de `TransactionRecord` dans ResourceAggregate, collection de `NotificationMessage` dans NotificationAggregate, collection de `WorkflowStep` dans WorkflowInstance (WorkflowAggregate), collection de `PendingOperation` dans OfflineSyncAggregate, collection de termes dans VocabularyAggregate par namespace.

---

### 2.5 Objet Valeur Intégré (Embedded Value Object)

**Objectif :** Stocker un objet valeur directement à l'intérieur de son parent, sans identité propre, jamais en accès indépendant. L'objet valeur est une caractéristique conceptuellement complète du parent.

**Cas d'utilisation :**
- L'objet valeur n'a pas d'identité en dehors de son parent
- L'objet valeur ne fait l'objet d'aucune mutation indépendante
- L'objet valeur est toujours lu en conjonction avec son parent
- L'objet valeur représente une notion domain pure (montant, date, couleur, adresse email, etc.)

**Avantages :**
- Zéro surcoût de stockage indépendant
- Intégrité conceptuelle : l'objet valeur n'existe que dans son contexte
- Immuable par nature (les objets valeurs du domaine sont immuables)
- Mise à jour parent automatique : modifier l'objet valeur modifie implicitement le parent
- Correspondance directe entre le modèle conceptuel DDD et le modèle de persistance

**Limites :**
- Impossibilité totale de référence croisée (un objet valeur ne peut pointer vers un autre objet valeur)
- Mutation d'un objet valeur entraîne modification du parent (conséquence parfois indésirable)
- Duplication si le même « concept valeur » doit exister dans plusieurs parents (mais ce n'est pas un VO à ce moment-là)

**Compatibilité avec l'architecture Lumina :** Les Value Objects définis dans DOC-012 sont, par définition, des objets intégrés. `EmailAddress`, `AmountInCents`, `PasswordHash`, `LabelPair`, `ColorHex`, `SettingValue`, etc. — tous sont stockés directement dans leur parent sans identité propre. Conformité totale avec le principe DDD de VALUE OBJECT.

**Critères de sélection :** Choisir exclusivement pour les objets du domaine qui, par définition même, n'ont pas d'identité indépendante. Toute tentative de donner une identité à un VO signale qu'il n'est pas un VO mais doit devenir une Entity d'un autre aggregate.

**Exemples dans Lumina :** `Email` et `PasswordHash` intégrés dans User (IdentityAggregate), `AmountInCents` et `ResourceVersion` intégrés dans ResourceAggregate, `LabelPair` (FR+EN) intégrés dans VocabularyAggregate, `SettingKey`/`SettingValue` intégrés dans ConfigurationAggregate, `ChannelType` et `SeverityLevel` intégrés dans NotificationAggregate.

---

### 2.6 Versionning

**Objectif :** Chaque mutation crée une nouvelle version ; les anciennes versions sont conservées pour l'historique, la détection de conflits ou la capacité de restauration. L'état courant est accessible immédiatement ; l'historique complet est reconstructible.

**Cas d'utilisation :**
- L'historique complet des changements est requis pour conformité ou débogage
- La détection de conflits de modification concurrente est nécessaire (verrouillage optimiste)
- La possibilité de revenir à un état antérieur est exigée (rollback)
- Les transitions d'état observables doivent être tracées

**Avantages :**
- Historique complet reconstructible à tout moment
- Détection automatique des conflits de modification concurrente (version mismatch = conflit)
- Capacité de rollback vers n'importe quelle version précédente
- Traçabilité complète : qui a changé quoi, quand, et pourquoi

**Limites :**
- Volume de stockage croissant avec le nombre de versions
- Complexité accrue de lecture (doit déterminer quelle version est « courante »)
- Gestion nécessaire de la rétention (quand archiver/purger les anciennes versions)
- Performance dégradée si trop de versions accumulées

**Compatibilité avec l'architecture Lumina :** Aligné avec INV-010 (versioning sur tout state change) et BR-RES-003 (every resource has version field). Utilisé conjointement avec Aggregate Completeness pour les aggregates à modifications fréquentes (ResourceAggregate avec version optimiste, WorkflowAggregate avec historique d'exécution, LifecycleAggregate avec versionning basé sur les transitions d'état).

**Critères de sélection :** Choisir lorsque l'historique des changements est nécessaire ET que la détection de conflits concurrents est requise. Ne pas choisir lorsque le volume de données deviendra ingérable ou que la conformité n'exige pas la rétention.

**Exemples dans Lumina :** Versionning optimiste sur `Organization` (OrganizationAggregate), `User` (IdentityAggregate), chaque `Resource` modifiable (ResourceAggregate), `WorkflowInstance` states, `ArchiveEntry` lifecycle transitions, `FormDefinition` semantic versioning, `SettingEntry` in-place updates.

---

### 2.7 Journal d'Événements (Append-Only Event Log)

**Objectif :** Toutes les mutations sont enregistrées comme événements immuables dans une séquence ordonnée. L'état courant est reconstructible en rejouant les événements depuis le début (ou depuis un snapshot). Le journal est incrémental et non modifiable.

**Cas d'utilisation :**
- Une trace d'audit complète et immuable est requise
- Les requêtes temporelles (quoi s'est-il passé à t?) sont nécessaires
- La capacité de rejouer l'historique des événements est exigée
- Le découplage temporel entre production et consommation d'événements est utile

**Avantages :**
- Trace d'audit parfaite : chaque changement est enregistré immuablement
- Rejouabilité complète : reconstruction de tout état passé
- Découplage naturel : producteurs et consommateurs d'événements sont indépendants
- Capacit de diagnostiquer n'importe quel problème en examinant l'historique séquentiel
- Support natif des patterns event-sourcing et CQRS

**Limites :**
- Reconstruction de l'état courant coûteuse si le journal est long (nécessite snapshots)
- Requêtes par état courant direct non optimales (doivent traverser le journal)
- Schéma de données évolutif complexe (legacy events doivent rester lisibles)
- Volume de données dominant (chaque mutation = entrée permanente)

**Compatibilité avec l'architecture Lumina :** Aligné avec AuditAggregate (journal immuable, DOC-012 §2.10) et OfflineSyncAggregate (queue d'opérations en attente, DOC-012 §2.13). Les Domain Events définis dans DOC-014 (`OrganizationCreated`, `UserLoggedIn`, `ResourceCreated`, `WorkflowTriggered`, etc.) forment la matière première de ce pattern. NB-PERSIST-006 (DOC-017) restreint l'Immutable Log exclusif à AuditAggregate ; les autres aggregates utilisent Versioned Document pour leur historique.

**Critères de sélection :** Choisir lorsque la traçabilité complète est critique ET que les patterns de lecture permettent la traversée séquentielle. Ne pas choisir lorsque seules les accès à l'état courant actuel sont nécessaires ou que le débit d'écriture est extrême.

**Exemples dans Lumina :** `AuditAggregate` (journal immuable exclusif, NB-PERSIST-006), `PendingOperation` queue dans OfflineSyncAggregate (append-only, operations sont ajoutées séquentiellement), `SessionContext` history dans IdentityAggregate (append-only log of session lifecycles), `WorkflowStep` execution trace dans WorkflowAggregate.

---

### 2.8 Modèle en Lecture / Projection (Read Model / Projection)

**Objectif :** Créer des vues dérivées et optimisées pour la lecture à partir de l'état des aggregates d'écriture. Les modèles en lecture ne contiennent pas de règles métier — ils sont des projections de l'état persisté, reconstruites lorsque la source change.

**Cas d'utilisation :**
- Les patterns de requête ne correspondent pas aux patterns d'écriture (CQRS léger)
- Des agrégations complexes sur plusieurs aggregates sont nécessaires
- Les performances de lecture sont critiques et ne peuvent pas être satisfaites par les aggregates d'écriture bruts
- Le reporting nécessite des données pré-calculées ou pré-agrégées

**Avantages :**
- Performances de lecture optimisées (données prêtes à consommer, pas de recalcul)
- Découplage entre schéma d'écriture et schéma de lecture
- Possibilité de projections différents pour différents besoins (dashboard vs export vs recherche)
- Les aggregates d'écriture restent purs etfocused sur le domaine

**Limites :**
- Cohérence éventuelle : la projection met du temps à refléter les changements
- Complexité accrue de la pile technique (gestion des projections, reprojection en cas de bug)
- Risque de divergence si la projection n'est pas correctement mise à jour
- Double maintenance : logique d'écriture + logique de projection

**Compatibilité avec l'architecture Lumina :** Aligné avec ReportingAggregate (exports configurables, DOC-012 §2.9) et Search Capability (DOC-005, recherche plein texte filtrée par org_id). Les projections alimentent les interfaces de reporting, les index de recherche, et les dashboards de configuration. Conformément à INV-004 (isolement multi-tenant, les projections sont filtrées par org_id).

**Critères de sélection :** Choisir lorsque les patterns de lecture ne correspondent PAS aux patterns d'écriture ET que les performances de requête justifient le coût de maintenance des projections. Ne pas choisir lorsque seules les écritures comptent ou que la cohérence forte immédiate est exigée.

**Exemples dans Lumina :** Report definitions dans ReportingAggregate (projections de transactions approved agrégées), search indexes dans Search Capability (projections de toutes les resources pour le plein texte), balance totals pré-calculés pour les rapports financiers, hierarchie cache pour OrgUnit descendant enumerations.

---

### 2.9 Snapshot

**Objectif :** Capture périodique ou déclenchée de l'état complet à un instant donné. Les snapshots sont des enregistrements indépendants — ils ne dérivent pas de différences, ils capturent l'image complète. Utile pour la reconstruction rapide, le reporting, et la reprise après incident.

**Cas d'utilisation :**
- Les aggregates à longue durée de vie nécessitent des lectures ponctuelles efficaces
- La reconstruction complète après perte de données est exigée
- Le reporting nécessite une image figée à un instant T
- Les checkpoints périodiques pour les processus à long cours sont utiles

**Avantages :**
- Reconstruction rapide de l'état complet sans traverser tout l'historique
- Point de restauration fiable en cas de corruption de données
- Rapports financiers à instant T directement lisibles depuis le snapshot
- Réduction drastique du temps de récupération après incident

**Limites :**
- Fréquence de snapshot élevée = gaspillage de stockage (états presque identiques répétés)
- Fréquence trop basse = reconstruction lente à partir du dernier snapshot + diffs
- Les snapshots sont intrinsèquement en décalage avec l'état en temps réel
- Coût d'écriture significatif (capture complète vs diff)

**Compatibilité avec l'architecture Lumina :** Aligné avec ReportingAggregate (snapshots de rapports générés, DOC-012 §2.9) et WorkflowAggregate (checkpoints d'exécution périodiques). Les snapshots complets sont utilisés conjointement avec Versioned Documents pour éviter de rejouer des historiques longs. Compatible avec le pattern Immutable Log d'AuditAggregate pour les snapshots de configuration avant modification.

**Critères de sélection :** Choisir pour les aggregates nécessitant des lectures ponctuelles efficaces ET dont l'état est trop volumineux à reconstruire entièrement depuis l'historique. Ne pas choisir si les snapshots sont trop fréquents (gaspillage) ou trop rares (reconstruction lente).

**Exemples dans Lumina :** GeneratedReport snapshots dans ReportingAggregate (image complète des totaux financiers à un instant T), WorkflowInstance checkpoints (sauvegarde d'état courant toutes les N étapes), periodic reconciliation snapshots pour ResourceAggregate (validation de cohérence occasionnelle).

---

## 3. MATRICE DE SÉLECTION DES STRATÉGIES

Cette matrice indique quelles stratégies s'appliquent à chaque Aggregate de DOC-012, basée sur les patterns d'accès, les exigences de cohérence, les besoins de synchronisation, les exigences d'audit et les tailles attendues.

| Aggregate | Stratégies Applicables | Justification Principale |
|-----------|----------------------|------------------------|
| **OrganizationAggregate** | Aggregate Completeness + Composition + Référence + Versionning | L'organisation est un singleton par contexte ; les org units sont intégrés en collection hiérarchique ; settings sont Value Objects intégrés ; versionning optimiste pour les modifications rares mais critiques. |
| **IdentityAggregate** | Aggregate Completeness + Référence + Composition + Versionning + Snapshot | User référencé (indépendant de l'org) ; SessionContext intégré (lié à la session) ; versionning optimiste pour les credentials ; snapshots pour les sessions actives. |
| **ResourceAggregate** | Collection + Versionning + Référence + Snapshot | Resources typedes en collection bornée ; versionning optimiste indispensable ; compensating transactions en référence ; snapshots pour la reconciliation financière. |
| **RelationshipAggregate** | Aggregate Completeness + Collection + Composition | Graph structure relationnel géré comme collection intégrée ; pas de versionning séparé (les parents portent la version) ; relations instantanées sans cycle de vie propre. |
| **WorkflowAggregate** | Versionning + Event Log + Snapshot + Collection | Historique d'exécution crucial (event log append-only) ; checkpoints périodiques (snapshot) ; instances de workflow versionnées ; steps intégrés en collection. |
| **FormAggregate** | Aggregate Completeness + Composition + Embedded VO | Définition + enfants inséparables ; semantic versioning remplace le versionning classique ; fields/sections intégrés comme Value Objects. |
| **NotificationAggregate** | Collection + Event Log + Embedded VO | Messages en collection batchable ; delivery records append-only ; preferences intégrées comme Value Objects. |
| **VocabularyAggregate** | Aggregate Completeness + Embedded VO + Collection | Catalogue stable de terms ; translations intégrées en Value Objects pairs FR/EN ; never-delete principle (approaching immutable log behavior for deprecated values). |
| **ReportingAggregate** | Read Model/Projection + Snapshot | Dépend entièrement de projections calculées ; snapshots ponctuels pour les rapports sauvegardés ; pas d'écriture directe (query/compute layer). |
| **AuditAggregate** | Event Log (append-only) exclusivement | Par définition : journal immuable, non modifiable, non suppressible. Seule stratégie autorisée par NB-PERSIST-006. |
| **LifecycleAggregate** | Versionning + Collection + Event Log | Transitions d'état comme versionning logique ; archive entries liés en collection ; tous les états transitaires audités en event log. |
| **ConfigurationAggregate** | Aggregate Completeness + Embedded VO (Key-Value) | Settings comme Value Objects organisés en clé-valeur intégrés ; modifications atomiques par org ; pas de versionning individuel (updates in-place). |
| **OfflineSyncAggregate** | Event Log + Collection + Snapshot | Queue d'opérations en attente (append-only collection) ; timestamps de sync comme snapshots de statut ; push/pull coordination comme event log de synchronisation. |

---

## 4. COMBINATIONS COURANTES DE STRATÉGIES

Une même stratégie suffit rarement. Voici les combinaisons fréquentes observées dans l'architecture Lumina :

### 4.1 Aggregate Completeness + Versionning

L'aggregate est persisté en entier ET chaque mutation crée une nouvelle version. C'est le pattern de base pour les aggregates avec verrouillage optimiste.

**Quand :** Modifications modérées, cohérence forte requise, détention de conflits nécessaire.

**Dans Lumina :** OrganizationAggregate, ResourceAggregate (toute resource mutable), IdentityAggregate.

### 4.2 Composition + Embedded VO

L'aggregate compose des enfants intégrés qui sont eux-mêmes des Value Objects sans identité.

**Quand :** Hiérarchie(parent-enfant) stricte, enfants sans autonomie, accès toujours conjoint.

**Dans Lumina :** FormAggregate (definition + fields + sections), ConfigurationAggregate (settings as KV VOs), VocabularyAggregate (namespace + terms + label pairs).

### 4.3 Event Log + Snapshot

Le journal d'événements conserve l'historique complet ; les snapshots offrent un raccourci pour la reconstruction rapide.

**Quand :** Historicisation longue nécessaire + lectures fréquentes de l'état courant.

**Dans Lumina :** WorkflowAggregate (execution trace + checkpoints), ResourceAggregate (event history + reconciliation snapshots), AuditAggregate (log seul, pas de snapshot nécessaire — l'audit est toujours consulté séquentiellement).

### 4.4 Collection + Event Log

Les éléments sont stockés en collection bornée ET chaque modification de la collection est consignée dans un journal append-only.

**Quand :** Besoin de gérer des lots d'éléments ET de tracer chaque changement de la collection.

**Dans Lumina :** OfflineSyncAggregate (pending operations queue + sync event log), NotificationAggregate (message collection + send attempt log).

### 4.5 Read Model + Snapshot

Les données sont projetées depuis les aggregates d'écriture vers un modèle de lecture optimisé, avec des snapshots périodiques pour les états figés.

**Quand :** Patterns de requête radicalement différents des patterns d'écriture ; performances de lecture critiques.

**Dans Lumina :** ReportingAggregate (computed projections from ResourceAggregate data), Search Capability (full-text index projection from all resources).

---

## 5. COMPATIBILITÉ AVEC LE MODELE OFFLINE-FIRST

L'architecture Lumina est constitutionnellement offline-first (INV-003). Chaque stratégie de persistance doit fonctionner correctement dans un mode déconnecté. Voici comment chaque stratégie s'articule avec OfflineSyncAggregate :

| Stratégie | Comportement Offline | Impact Sync |
|-----------|---------------------|-------------|
| Aggregate Completeness | Écriture locale complète de l'aggregate ; réexpédition globale en ligne | Delta push quand reconnecté ; server-wins pour les conflits critiques |
| Composition | Enfants intégrés persistés localement avec le parent | Push atomique parent + enfants en une opération |
| Référence | Référence locale préservée ; cible potentiellement hors ligne | Resolve references on pull; orphan markers for missing targets |
| Collection | Ajouts/suppressions en file d'attente ; ordre préservé | Batch push (max 50 ops) ; order matters for ordered collections |
| Embedded VO | Mutations locales immédiates ; propagées au parent | Part of parent's delta; no separate sync path |
| Versionning | Version locale incrémented ; détectée en ligne comme conflit potentiel | Conflict detection uses version numbers; per-entity-type strategies |
| Event Log | Évenements appendés localement ; replays sur reconnect | Push event batches sequentially; replay ensures no loss |
| Read Model/Projection | Projections locales recalcullées à partir de données offline | Regeneration on pull; not synced directly |
| Snapshot | Captures locales conservées ; envoyées batchées | Snapshot push on reconnect; prefer latest + diffs |

**Règle NeverBreak pour le sync :** NB-PERSIST-008 (DOC-017) interdit que tout pattern de persistance bloque les opérations utilisateur. Chaque stratégie est conçue pour permettre l'écriture locale immédiate, regardless of laquelle combinaison de stratégies est utilisée.

---

## 6. RULES NEVERBREAK DU CATALOGUE

Ces règles sont immuables. Toute violation constitue une rupture architecturale nécessitant une documentation ADR.

### NB-CAT-001 : Aucune Stratégie Ne Prescrit de Technologie

Aucune des stratégies décrites ci-dessus ne nécessite, recommande ou implique un moteur de stockage spécifique. Embedded, Referenced, Collection, Immutable Log, Versioned Document, et Snapshot sont des concepts de modélisation de persistance abstraits du stockage. Une stratégie « Embedded » fonctionne de la même manière conceptuelle dans un store relationnel (colonnes JSONB imbriquées), un store documentaire (documents嵌套), un event store (events parents-enfants), ou un store clé-valeur (clé unique avec valeur complète).

### NB-CAT-002 : Multiple Stratégies Coexistent Par Aggregate

Un aggregate utilise typiquement plusieurs stratégies simultanément. OrganizationAggregate utilise Aggregate Completeness (cœur), Composition (org units), Référence (vers Identity), et Embedded VO (settings). La combinaison est la norme, pas l'exception. Chaque sous-section produit indique explicitement les stratégies composites.

### NB-CAT-003 : Le Choix de Stratégie Ne Peut Pas Changer les Frontières d'Aggregate

Les stratégies de persistance décrivent COMMENT les données d'un aggregate existant sont conservées. Elles ne changent JAMAIS la frontière de l'aggregate. Si une stratégie de persistance suggère de déplacer des données d'un aggregate à un autre, c'est que la stratégie est mal appliquée — les boundaries sont définies par la cohésion domain et la containment d'invariants (DOC-012), pas par l'efficacité de stockage.

### NB-CAT-004 : Les Patterns de Synchronisation Fonctionnent Indépendamment de la Stratégie

OfflineSyncAggregate (DOC-012 §2.13) fournit le mécanisme de synchronization qui s'applique à TOUTES les stratégies de persistance. Que l'aggregate soit persisté via Aggregate Completeness, Event Log, Snapshot, ou toute autre stratégie, le pattern de sync local-d'abord reste le même : écrire localement d'abord (BR-SYNC-001), batcher les pushes (BR-SYNC-002), résoudre les conflits par type d'entité (matrice §2.3b), never block user operations (NB-PERSIST-008).

### NB-CAT-005 : La Stratégie d'Audit Ne Conflitte Jamais Avec les Invariants du Domaine

AuditAggregate utilise exclusivement le pattern Immutable Log (NB-PERSIST-006). Cette stratégie est invariable et n'entre jamais en conflit avec les autres stratégies de persistance. Les audits sont appendés sans modifier les aggregates audités, sans changer leurs strategies, sans affecter leurs synchronization patterns. L'audit est terminal : il consomme les événements des autres aggregates sans les influencer en retour.

### NB-CAT-006 : Aucune Stratégie N'Oblige à Une Cohérence Spécifique

Les modèles de cohérence (Strong vs Eventual) sont des propriétés des aggregates, pas des stratégies de persistance. Une stratégie « Collection » peut utiliser Strong consistency (ex: RelationshipAggregate DAG integrity) ou Eventual consistency (ex: ResourceAggregate search indexing). La stratégie décrit l'organisation des données ; le model de cohérence décrit leurs garanties. Ils sont orthogonal.

### NB-CAT-007 : Les Snapshots Ne Remplacent Jamais L'Historique

Un snapshot est un raccourci de lecture, pas un remplacement de l'historique. Lorsqu'un aggregate utilise Event Log + Snapshot, le journal contient la vérité historique complète ; le snapshot accélère la reconstruction. Supprimer un snapshot ne supprime jamais l'historique correspondant. Supprimer un événement du journal ne supprime jamais les snapshots (qui contiennent déjà une copie).

---

## 7. MATRICE DE COMPATIBILITÉ ENTRE STRATÉGIES

Toutes les stratégies ne sont pas compatibles entre elles dans un même contexte de persistence. Voici les combinaisons valides et invalides.

| Stratégie A | Stratégie B | Compatible ? | Remarques |
|------------|------------|-------------|-----------|
| Aggregate Completeness | Composition | OUI | Naturellement composite (aggregate intègre ses enfants) |
| Aggregate Completeness | Référence | OUI | L'aggregate complet peut référencer d'autres aggregates |
| Aggregate Completeness | Collection | OUI | Un aggregate complet peut contenir des collections |
| Aggregate Completeness | Embedded VO | OUI | Les VOs sont intrinsèquement intégrés |
| Aggregate Completeness | Versionning | OUI | L'aggregate complet est versionné à chaque mutation |
| Aggregate Completeness | Event Log | OUI | Les mutations de l'aggregate sont logging dans un event log |
| Aggregate Completeness | Read Model | OUI | L'aggregate sert de source pour des read models |
| Aggregate Completeness | Snapshot | OUI | Snapshots complets de l'aggregate sont pris périodiquement |
| Composition | Référence | NON | Si c'est une composition, la référence est intégrée, pas externalisée |
| Composition | Collection | OUI | Les enfants intégrés peuvent former une collection |
| Composition | Embedded VO | OUI | Naturel : composition d'enfants qui sont des VOs |
| Référence | Collection | OUI | Une collection peut contenir des références |
| Référence | Embedded VO | NON | Un VO n'a pas d'identité pour être référencé |
| Collection | Embedded VO | OUI | Les éléments d'une collection peuvent être des VOs |
| Collection | Event Log | OUI | Les mutations de collection logging dans un event log |
| Collection | Versionning | OUI | La collection entière est versionnée |
| Embedded VO | Event Log | NON | Un VO intégré n'est pas logging séparément (ses mutations sont logging via le parent) |
| Embedded VO | Versionning | NON | Les VOs n'ont pas de version propre (le parent est versionné) |
| Event Log | Read Model | OUI | L'event log alimente les read models (CQRS) |
| Event Log | Snapshot | OUI | Snapshots complets pris depuis l'event log |
| Event Log | Versionning | PARTIEL | L'event log EST une forme de versionning (historique séquentiel) |
| Read Model | Snapshot | OUI | Les read models peuvent être snapshotés périodiquement |
| Versionning | Snapshot | OUI | Snapshots comme raccourcis entre les versions |

---

## 8. CHECKLIST DE SÉLECTION DE STRATÉGIE

Lors de la définition de la persistance d'un nouvel aggregate (ou de la révision d'un aggregate existant), suivre ce processus décisionnel :

```
1. L'aggregate est-il toujours accédé en entier?
   → OUI        : Aggregate Completeness comme base
   → NON        : Aller à 2

2. Les enfants ont-ils une identité indépendante?
   → NON        : Composition (intégré)
   → OUI        : Aller à 3

3. Les enfants peuvent-ils exister sans le parent?
   → NON        : Composition (lié生命周期)
   → OUI        : Aller à 4

4. L'objet a-t-il une identité propre?
   → NON        : Embedded VO
   → OUI        : Aller à 5

5. Les objets sont-ils gérés collectivement?
   → OUI        : Collection
   → NON        : Aller à 6

6. L'historique complet est-il requis?
   → OUI        : Aller à 7
   → NON        : Aller à 8

7. L'objet est-il IMMUABLE une fois créé?
   → OUI        : Event Log (Immutable Log)
   → NON        : Versionning

8. Les requêtes nécessitent-elles un schéma différent de l'écriture?
   → OUI        : Read Model / Projection
   → NON        : Aller à 9

9. Un état figé ponctuel est-il utile?
   → OUI        : Snapshot
   → NON        : Revoir les catégories d'aggregate existantes
```

Ce processus ne produit JAMAIS une réponse unique. Le résultat est une liste de stratégies applicables, à combiner selon la matrice §7.

---

## 9. TRACEABILITÉ CROISÉE

Chaque stratégie de ce catalogue référence les documents constitutionnels auxquels elle est liée :

| Section DOC-019 | Document Source | Référence |
|----------------|-----------------|-----------|
| Aggregate definitions | DOC-012 (Canonical Domain Model) | Tous les 13 Aggregates |
| Persistence modes | DOC-017 (Persistence Model) | Section 2 par Aggregate |
| Capability deps | DOC-005 (Capability Dependency Graph) | Foundation services : Storage(18/18), Audit(10/18) |
| Invariants | DOC-015 (Invariant Registry) | INV-001 through INV-010 |
| Commands/Events | DOC-014 (Command/Event Registry) | Events alimentent Event Log strategy |
| NeverBreak rules | DOC-017 §6 | NB-PERSIST-001 through NB-PERSIST-012 |
| Offline-first | INV-003 (CONSTITUTION) | Section 4 Compatibilité Offline-First |

---

## RESUME : CATALOGUE EN UN COUP D'OEIL

| # | Stratégie | Pattern DDD | Usage Principal | Exclusive à? |
|---|-----------|-------------|-----------------|--------------|
| 1 | Aggregate Completeness | Aggregate root | Integrity unit | Non (combine avec d'autres) |
| 2 | Composition (Embedded) | Embedded entity | Parent-child lifecycle | Non |
| 3 | Référence (Linking via ID) | Reference by ID | Cross-aggregate relationships | Non |
| 4 | Collection | Bounded collection | Ordered/grouped items | Non |
| 5 | Embedded Value Object | Value object | Identity-less attributes | Non (always combined) |
| 6 | Versionning | Optimistic concurrency | Change tracking + conflict detection | Non |
| 7 | Event Log (Append-Only) | Event sourcing | Audit trail + replay | AuditAggregate (NB-PERSIST-006) |
| 8 | Read Model / Projection | CQRS projection | Query optimization | Non (source-dependent) |
| 9 | Snapshot | Checkpoint | Fast recovery + reporting | Non |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Catalogue constitutionnel des 9 stratégies de persistance pour les 13 Aggregates de Lumina | CTO + Arch Principal |
