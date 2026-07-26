# Runtime Component Catalog — Lumina v1

**Doc ID:** RTS-001
**Version:** v1.0
**Statut:** SPECIFICATION RUNTIME DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** runtime-specifier v1.0
**Source canonique :** ["DOC-000", "DOC-001", "DOC-012", "DOC-014", "DOC-017", "DOC-019", "PAS-001", "PAS-002", "PAS-003", "ASS-001", "ASS-004"]
**Transformation_rule :** "runtime-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPAUX PRINCIPE DU RUNTIME

Le Runtime est LA COUCHE D'ASSEMBLAGE unique de l'architecture Lumina. Il ne contient AUCUNE logique metier. Il ne contient AUCUNE regle de validation. Son role est exclusif:

1. **Assembler** chaque Port a son Adapter concret (per PAS-002)
2. **Ordonner** l'initialisation des composants selon le DAG defini par DOC-000
3. **Gerer** le cycle de vie complet de l'application (demarrage, execution, arret)
4. **Coordonner** les mecanismes transversaux (transactions, evenements, audit, synchronisation)

**Regle constitutionnelle:** Le Runtime decide QUOI assembler et DANS QUEL ORDRE, mais jamais COMMENT chaque composant interieur fonctionne. Le "comment" appartient aux Aggregates (DOC-012), Application Services (ASS-001), et Adapters (PAS-002).

---

## ARCHITECTURE DU RUNTIME

```
Couche Exterieure (API, CLI, evenements externes)
    |
    v
Runtime Layer -- [ LES 15 COMPOSANTS DEFINIS CI-DESSOUS ]
    |   - Assemblage Port->Adapter (PAS-002)
    |   - Orchestration du cycle de vie
    |   - Coordination transversale
    v
Application Services Layer (ASS-001, ASS-004)
    |
    v
Domain Layer (Aggregates DOC-012, Events DOC-014, Invariants DOC-015)
    |
    v
Ports (PAS-001) -> Adapters (PAS-002) -> Infrastructure
```

Le Runtime est le "glue code" entre toutes ces couches. Il connecte, orchestre, fait vivre -- mais ne decide PAS du comportement metier.

---

## DEPENDANCES DU RUNTIME SUR LES DOCUMENTS CANONIQUES

| Doc Source | Ce que le Runtime en tire |
|------------|--------------------------|
| DOC-000 | Hiérarchie des couches, principes de flux descendant, definition de Runtime Services |
| DOC-001 | Catalogue des 57 elements -- Runtime Services catalogues |
| DOC-012 | 13 Aggregates, leurs dependances, limites de boundary |
| DOC-014 | Commandes et Evenements -- defines ce qui traverse le event bus |
| DOC-015 | 58 Invariants -- defines ce que le Runtime NE DOIT PAS violer |
| DOC-017 | Persistence Model -- definit comment les PO traversent les adapters |
| DOC-019 | Persistence Strategy Catalog -- definit la combinaison de strategies par Aggregate |
| PAS-001 | 17 Ports -- defines les interfaces que le Runtime assemble |
| PAS-002 | Adapter Categories -- definit les categories d'adapters disponibles par Port |
| PAS-003 | Dependency Rules (DR-001 a DR-012) -- definit les regles de dependance que le Runtime enforce |
| ASS-001 | 13 Application Services -- defines les consommateurs du Runtime |
| ASS-004 | Cross-Aggregate Coordination -- defines les interactions event-driven que le Runtime gere via EventDispatcher |

---

## COMPOSANT 1: CompositionRoot

**ID:** CRT-001
**Proprietaire:** Architecture convention
**Statut:** Composant runtime fondamental -- initialise une seule fois au demarrage

**Objectif:** Point d'entree unique ou tous les Ports et Adapters sont assembles. C'est le seul endroit ou le code connait l'existence d'adapters concrets (categories, non implémentations). Tous les autres composants interagissent uniquement avec des abstractions (Ports, Application Services).

**Responsabilités:**
1. Creer toutes les instances de Runtime Components dans l'ordre correct
2. Resoudre l'ordre d'initialisation via DependencyResolver
3. Lier chaque Port a sa categorie d'Adapter concrete (per PAS-002)
4. Exposer les 13 Application Services (ASS-001) aux couches extérieures (API)
5. Initialiser les 17 Ports (PAS-001) avec leurs adapters choisis
6. Configurer les mécanismes transversaux: RetryPolicy, IdempotencyManager, AuditEnabler

**Depends On:**
- DependencyResolver (CRT-002) pour obtenir l'ordre d'initialisation
- ConfigurationLoader (CRT-005) pour charger config avant assemblage

**Consumed By:** Le processus d'application entier (c'est le point d'entrée)

**Lifecycle:** Instance unique, creee au demarrage (`main()`/`bootstrap()`), détruite à l'arrêt. Sa durée de vie couvre celle de l'application entière.

**Contraits constitutionnels:**
- Ne contient JAMAIS de logique métier -- il n'appelle AUCUNE méthode d'Aggregate directement
- Ne connaît PAS les détails d'implémentation des Adapters -- il connaît uniquement les CATEGORIES (in-memory, relational, document, etc.) definies dans PAS-002
- L'ordre d'assemblage est FIXE et documenté ici et dans RTS-002
- Ne doit pas reference plus de 17 Ports + 13 Services + 15 Components Runtime -- toute dépendance supplémentaire est une violation

**Error Handling:** Si l'assemblage échoue à N'IMPORTE QU'ELLE étape → application EXIT IMMÉDIAT, aucun service disponible. Aucune connexion partielle n'est acceptable.

**Code Structure (conceptuelle):**
```
CompositionRoot.configure()
    1. Load Configuration (ConfigLoader)
    2. Resolve Dependencies order (DependencyResolver)
    3. Create Port instances (17 ports per PAS-001)
    4. Bind Port -> Adapter Category (per PAS-002)
    5. Initialize Runtime Components (CRT-003 through CRT-015)
    6. Register Application Services (13 per ASS-001)
    7. Wire cross-cutting concerns (RetryPolicy, Idempotency, Audit)
    8. Validate complete assembly
    9. Return configured container
```

---

## COMPOSANT 2: DependencyResolver

**ID:** CRT-002
**Proprietaire:** Architecture convention
**Statut:** Composant runtime fondamental -- execute une seule fois au demarrage

**Objectif:** Analyse le graphe de dépendances entre TOUS les Runtime Components pour produire un ordre topologique deterministe d'initialisation. Verifie l'absence de cycles.

**Responsabilités:**
1. Construire le graphe de dépendances à partir des métadonnées de chaque Runtime Component
2. Appliquer un algorithme de tri topologique (ex: Kahn's algorithm) pour déterminer l'ordre
3. Vérifier qu'il n'y a AUCUN cycle dans le graphe -- un cycle est une erreur irrecoverable
4. Valider qu'aucun composant ne dépend d'un composant non-catalogué
5. Produire l'ordre figé d'initialisation (documenté dans RTS-002)

**Depends On:** Aucun -- c'est le PREMIER composant à être initialisé (et utilisé)

**Consumed By:** CompositionRoot (unique consommateur)

**Lifecycle:** Singleton, utilisé UNIQUEMENT au démarrage pendant l'assemblage. Après l'initialisation, son résultat (l'ordre topologique) est consommé une fois puis abandonné.

**Contraits constitutionnels:**
- Ne MODIFIE PAS les dépendances entre composants -- il lit, il ne réécrit pas
- Ne fait PAS de résolution dynamique -- l'ordre est STATIQUE et FIGÉ
- Son résultat est immuable après calcul -- toute modification post-calcul est une violation
- Si un cycle est détecté: APPLICATION FAILS IMMEDIATELY, aucun retry possible

**Error Handling:** Cycle détecté dans le graphe de dépendances → APPLICATION FAILS IMMEDIATELY avec le détail du cycle

**Dépendances entre Runtime Components (graphe source du resolver):**

```
DependencyResolver (init: 0 deps)
  ↓
ConfigurationLoader (init: 0 deps)
  ↓
TransactionCoordinator (init: depends on RepoPort, TxCoord port)
EventDispatcher (init: depends on EventBus, LogPort)
HealthMonitor (init: depends on Scheduler for polling interval)
Diagnostics (init: depends on LoggingPort)
Scheduler (init: depends on ClockPort)
StartupPipeline (init: depends on ConfigLoader + Resolver + all components)
ShutdownPipeline (init: depends on all components)
RetryPolicy (init: depends on LoggingPort, FileStoragePort)
IdempotencyManager (init: depends on CachePort)
AuditEnabler (init: depends on AuditPort)
TenantContextProvider (init: depends on IdentityProviderPort)
CompositionRoot (init: depends on ALL above)
LifecycleManager (init: depends on StartupPipeline, ShutdownPipeline, Scheduler)
```

**Ordre topologique attendu (sortie du resolver):**
1. DependencyResolver (no deps)
2. ConfigurationLoader (no deps)
3. ClockPort adapter init
4. UUIDPort adapter init
5. TransactionCoordinator (needs RepoPort, TxCoord)
6. EventDispatcher (needs EventBus adapters)
7. RetryPolicy (needs LoggingPort)
8. IdempotencyManager (needs CachePort)
9. AuditEnabler (needs AuditPort)
10. TenantContextProvider (needs IdentityProviderPort)
11. Diagnostics (needs LoggingPort)
12. HealthMonitor (needs Scheduler)
13. Scheduler (needs ClockPort, TxCoordinator, EventDispatcher)
14. StartupPipeline (needs all above)
15. ShutdownPipeline (needs all above)
16. CompositionRoot (binds everything -- last to be called, not "init'd")
17. LifecycleManager (starts StartupPipeline)

---

## COMPOSANT 3: TransactionCoordinator

**ID:** CRT-003
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de coordination transactionnelle

**Objectif:** Coordonne les transactions qui s'étendent sur plusieurs Aggregates ou RepositoryPort. Encapsule le pattern Saga lorsque des opérations cross-aggregate sont nécessaires.

**Responsabilités:**
1. Gerer le begin/commit/rollback des transactions multi-aggregates
2. Enregistrer et executer les actions compensatrices en cas d'échec (Saga pattern)
3. Assurer l'atomicité au niveau de l'Aggregate root (pas au-dela -- see PAS-001 Port-015)
4. Gérer les timeouts transactionnels (rollback automatique si depasse la duree maximale)
5. Fournir un contexte transactionnel aux Application Services lors d'operations cross-aggregate

**Depends On:** RepositoryPort (CRT-003 n'est pas un adapter -- il utilise RepositoryPort comme abtraction), TransactionManagerPort (Port-015 per PAS-001)

**Consumed By:** Application Services qui executent des operations cross-aggregate (WorkflowService, LifecycleService, OfflineSyncService per ASS-001)

**Lifecycle:** Instance globale pour la gestion de la stratégie de transaction. Utilisée SCOPE-by-scope : chaque opération cross-aggregate crée son propre contexte transactionnel. Les contextes sont jetés après commit/rollback.

**Contraits constitutionnels:**
- Supporte UNIQUEMENT le pattern Saga décrit dans PAS-001 Port-015
- Ne jamaiscrosser les limites d'Aggregate sans TransactionManagerPort explicite
- Prefere la consistence eventuelle (evenementielle) a la transaction synchronisée
- Les transactions cross-aggregate sont RARES -- par défaut, utiliser des evenements

**Error Handling:** Timeout transactionnel → rollback + compensation en ordre inverse. Echec de compensation → log error + retry avec backoff exponentiel.

---

## COMPOSANT 4: EventDispatcher

**ID:** CRT-004
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de diffusion d'événements

**Objectif:** Dispatche les Domain Events émis par les Aggregates vers tous les consommateurs registres. Garanti la livraison "at-least-once" et l'ordre d'émission.

**Responsabilités:**
1. Recevoir les Domain Events des Application Services après persistance réussie
2. Publier chaque événement vers tous les subscribers enregistreés sur EventSubscriptionPort
3. Garantir la livraison at-least-once : les duplicats doivent etre toleres par les consommateurs
4. Garantir l'ordre d'emission : les événements sont dispatchés dans l'ordre exactement ou ils ont été émis par l'Aggregate
5. Isoler les handlers : l'échec d'un handler ne bloque PAS les autres handlers
6. Router les événements vers les consommateurs definis dans DOC-014 (colonne "Consommateurs autorisés")

**Depends On:** EventPublicationPort (Port-002), EventSubscriptionPort (Port-003), LoggingPort (Port-009), AuditPort (Port-010)

**Consumed By:** Tous les Application Services (après persistence), le TransactionCoordinator (pour les evenements de compensation), le RetryPolicy (pour les evenements qui echouent)

**Lifecycle:** Singleton, active des le demarrage apres que tous les subscriptions soient enregistrees. Oper e tout au long de la vie de l'application.

**Contraits constitutionnels:**
- Ne JAMAIS modifier le payload d'un evenement (AUD-001 constitutionnel)
- Ne JAMAIS inventer de nouveaux types d'evenements -- seulement DOC-014 events (PAS-003 DR-008)
- La publication ne bloque JAMAIS l'operation domaine (SYNC-004)
- Les evenements techniques (row inserted, page split) sont SEPARÉS des Domain Events
- Consommation séquentielle obligatoire : les handlers doivent traiter les événements dans l'ordre

**Mappings doc-014 critiques gerees par EventDispatcher:**
- `ResourceCreated` → OfflineSyncAggregate (push), AuditAggregate (log)
- `ApprovalGranted` → WorkflowAggregate (step complete), AuditAggregate
- `OrgUnitCreated` → RelationshipAggregate, AuditAggregate
- `SettingUpdated` → Manifest compiler (invalidate cache), Branding capability
- TOUT state change → AuditAggregate.LogAction (universal side-effect per ASS-004)

**Error Handling:** Handler failure → log error, continue avec handlers restants. Publication échoue → retry avec backoff exponentiel, le command reussit quand meme.

---

## COMPOSANT 5: ConfigurationLoader

**ID:** CRT-005
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de chargement de configuration

**Objectif:** Charge la configuration de l'application depuis toutes les sources autorisees (fichiers, variables d'environnement, templates) et fournit un acces centralise et cohérent.

**Responsabilités:**
1. Charger la configuration depuis les sources prioritaires : fichiers de configuration → variables d'environnement → valeurs par défaut du template
2. Valider le format de chaque setting (ISO 4217, IANA timezone, hex colors) conformement aux invariants CFG-001/002/003
3. Fournir un acces unifié à toute l'application pour les settings organisationnels
4. Appliquer les defaults du manifest/template pour toute cle manquante (CFG-004)
5. Detecter les conflits entre sources et appliquer la strategie de resolution definee dans DOC-019 §2.12

**Depends On:** Aucun -- c'est l'un des premiers composants initialises (avant tout autre composant runtime)

**Consumed By:** CompositionRoot (pour configurer les adapters), tous les Application Services (via ConfigurationPort), HealthMonitor (check thresholds)

**Lifecycle:** Singleton, charge une seule fois au demarrage. Recharge only si explicitement demande (administrateur).

**Contraits constitutionnels:**
- Chaque setting a un default (CFG-004) -- retourne jamais null pour une cle valide
- Format validation empeche les settings invalides avant persistence
- Les sources de configuration sont ORDONNEES : file > env var > default
- Ne JAMAIS hardcoder de valeur de configuration -- toujour passer par cette couche

**Error Handling:** Configuration invalide → application EXIT (impossible de demarrer sans config valide). Setting manquant → utilise default du template.

---

## COMPOSANT 6: LifecycleManager

**ID:** CRT-006
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de gestion du cycle de vie

**Objectif:** Orchestre le cycle de vie complet de l'application : demarrage, execution normale, et arret propre. Est le pont entre le systeme d'exploitation et l'application.

**Responsabilités:**
1. Invoquer StartupPipeline au demarrage pour initialiser tous les composants
2. Maintenir l'application en état d'execution tant qu'elle est necessaire
3. Intercepter les signaux OS (SIGINT, SIGTERM, etc.) pour déclencher ShutdownPipeline
4. Coordonner l'arret ordonné : d'abord stopper la reception de nouvelles requetes, puis finir les requetes en cours, puis liberer les ressources
5. Exposer l'état courant du lifecycle au HealthMonitor et aux diagnostics

**Depends On:** StartupPipeline (CRT-010), ShutdownPipeline (CRT-011), Scheduler (CRT-009) pour le polling interval

**Consumed By:** Processus d'application externe (OS signals, process manager)

**Lifecycle:** Unique instance, couvrant la totalite de la vie du processus applicatif.

**Contraits constitutionnels:**
- L'arret EST TOUJOURS propre (graceful shutdown) -- jamais de kill brutal
- StartupPipeline doit COMPLETER avant que l'application accepte des requetes
- ShutdownPipeline doit COMPLETER avant que le processus quitte
- Le LifecycleManager ne contient AUCUNE logique metier

**Error Handling:** StartupPipeline échoue → EXIT IMMEDIAT, aucun service disponible. ShutdownPipeline timeout → force terminate après délai configurable.

---

## COMPOSANT 7: HealthMonitor

**ID:** CRT-007
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de surveillance de santé

**Objectif:** Surveille en continu la santé de l'application en interrogeant les points de contrôle définis par chaque Port. Produit un diagnostic de santé global utilisable par les systèmes d'orchestration (Kubernetes liveness/readiness probes, load balancers).

**Responsabilités:**
1. Interroger periodicment tous les Points de Sante definis par les Ports (RepositoryPort health, CachePort availability, ClockPort validity, etc.)
2. Agreger les résultats individuels en un verdict global HEALTHY/DEGRADED/UNHEALTHY
3. Exposer les resultats via un endpoint de health check standard
4. Logger les changements d'état de santé (healthy → degraded, degraded → unhealthy, etc.)
5. Alimenter le service de diagnostics avec les donnees de santé collectées

**Depends On:** Tous les Ports (pour interroger leurs points de santé), Scheduler (CRT-009 pour le polling interval), LoggingPort (Port-009) pour les logs de changement d'état

**Consumed By:** Systèmes d'orchestration externes (Kubernetes, load balancer), Diagnostics (CRT-008)

**Lifecycle:** Singleton, demarre avec l'application, poll en continu jusqu'à l'arret.

**Contraits constitutionnels:**
- Health checks sont READ-ONLY -- jamais de mutation pendant le monitoring
- Le verdict global est une fonction deterministe des votes individuels
- Un port degraded ne fait PAS tomber toute l'application -- seulement DEGRADED, pas UNHEALTHY
- Health check interval est configure via ConfigurationPort, jamais hardcoded

**Error Handling:** Health check timed out → consider port degraded (pas unhealthy, car le timeout peut etre transient).

---

## COMPOSANT 8: Diagnostics

**ID:** CRT-008
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de diagnostic

**Objectif:** Collecte, agrège et expose les informations de diagnostic de l'application. Fournit une vue globale du fonctionnement interne pour le debugging, l'audit, et le monitoring.

**Responsabilités:**
1. Collecter les evenements runtime (demarrage, arret, erreurs, changements de configuration)
2. Exposer les metriques de performance (temps de reponse, taux d'erreur, temps de sync)
3. Fournir un dump d'état complet pour le debugging (sans exposer de données sensibles)
4. Intégrer les données du HealthMonitor pour fournir un contexte de santé
5. Garantir que les données diagnostiques ne contiennent JAMAIS de credentials, passwords, tokens, ou donnees personnelles sensibles

**Depends On:** LoggingPort (Port-009), HealthMonitor (CRT-007) pour le contexte de santé, ConfigurationPort (Port-008) pour les seuils de diagnostic

**Consumed By:** Administrateurs, outils de monitoring externes, processus de debugging

**Lifecycle:** Singleton, actif pendant toute la durée de vie de l'application.

**Contraits constitutionnels:**
- BR-ID-001 : Jamais de données sensibles dans les diagnostics (passwords, tokens, hashes)
- Les diagnostics ne PEUVENT PAS modifier l'état de l'application -- toujours read-only
- Format de sortie structuré et machine-lisible toujours disponible

**Error Handling:** Erreur de collecte diagnostique → log silently, pas d'impact sur le fonctionnement normal.

---

## COMPOSANT 9: Scheduler

**ID:** CRT-009
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de planification

**Objectif:** Fournit un mecanisme de planification temporelle pour toutes les tâches periodiques de l'application : polling de santé, push/pull de synchronisation, purge schedulee, compensation retries.

**Responsabilités:**
1. Planifier et executer des tâches periodiques (cron-like) definies dans les specifikations canoniques
2. Fournir une source de temps canonique via ClockPort (port-006) pour TOUTES les opérations temporelles
3. Gerer les timeouts et les retries pour les tâches qui échouent
4. Garantir qu'une tâche periodique ne se superpose PAS (une seule instance a la fois)
5. Exposer les programmes de planification pour le Diagnostics

**Tâches planifiées (définies par les documents canoniques):**
- HealthMonitor polling interval (per CRT-007)
- PushPendingOperations (OfflineSyncAggregate,定期)
- PurgeSchedule (LifecycleAggregate, daily cron)
- Session cleanup (IdentityAggregate, periodic)
- Balance calculation refresh (ReportingAggregate, periodic)
- Conflict detection scan (OfflineSyncAggregate, periodic)

**Depends On:** ClockPort (Port-006), TransactionCoordinator (CRT-003 pour les tâches nécessitant des transactions)

**Consumed By:** HealthMonitor, OfflineSyncService, LifecycleService, IdentityService

**Lifecycle:** Singleton, demarre au boot, tourne jusqu'à l'arret.

**Contraits constitutionnels:**
- TOUT timestamp vient de ClockPort.now(), jamais de system clock direct
- Les jobs periodiques sont atomic au niveau Aggregate (pas de demi-mutation)
- Un job échoue ne bloque pas les autres jobs

**Error Handling:** Job échoue → log, planifier retry avec backoff exponentiel.

---

## COMPOSANT 10: StartupPipeline

**ID:** CRT-010
**Proprietaire:** Architecture convention
**Statut:** Composant runtime d'initialisation

**Objectif:** Definit et execute la sequance ordonnée d'initialisation de l'application. C'est un pipeline à usage unique (single-use) qui configure tout avant que l'application soit operatiornelle.

**Responsabilités:**
1. Executer l'initialisation dans un ordre STRICTEMENT impose par le DependencyResolver
2. Charger la configuration initiale
3. Initialiser tous les 17 Ports (PAS-001) avec leurs adapters selectionnés
4. Mettre en place les mécanismes transversaux : RetryPolicy, IdempotencyManager, AuditEnabler
5. Register tous les handlers d'événements definis dans DOC-014 (colonne "Consommateurs autorisés")
6. Effectuer une validation finale de l'assemblage complet
7. Signaler à LifecycleManager que l'application est pret à recevoir des requêtes

**Etapes séquentielles (fixes, documentees dans RTS-002):**
1. ConfigurationLoader charge les settings
2. DependencyResolver produit l'ordre topologique
3. ClockPort et UUIDPort inicialisés
4. RepositoryPort initialise (premier adapter cree)
5. EventPublicationPort et EventSubscriptionPort initialisés
6. TransactionCoordinator prete
7. EventDispatcher subscribe a tous les events DOC-014
8. Tous les Application Services (13) exposes
9. RetryPolicy, IdempotencyManager, AuditEnabler wirés
10. Validation de l'assemblage complet
11. Signal "ready" a LifecycleManager

**Depends On:** ConfigurationLoader (CRT-005), DependencyResolver (CRT-002), tous les Runtime Components

**Consumed By:** LifecycleManager (CRT-006) qui lance le pipeline

**Lifecycle:** Single-use -- execute une seule fois au démarrage. Après achèvement, ses résultats (components initialized) persistent via les autres Runtime Components.

**Error Handling:** N'importe quelle étape échoue → EXIT IMMEDIAT. Impossible de continuer avec un assemblage partiel.

---

## COMPOSANT 11: ShutdownPipeline

**ID:** CRT-011
**Proprietaire:** Architecture convention
**Statut:** Composant runtime d'arret

**Objectif:** Definit et execute la séquence ordonnée d'arret de l'application. Garanti que toutes les opérations en cours sont terminees, que les données sont correctement persistées, et que les ressources sont libérées proprement.

**Responsabilités:**
1. Stopper la réception de nouvelles requêtes immédiatement
2. Attendre la completion des requêtes en cours (avec timeout)
3. Flush any pending operations dans OfflineSyncAggregate (PushPendingOperations final)
4. Fermer les connexions aux repositories (Database, FileStorage, Cache)
5. Fermer le EventDispatcher (plus de publications)
6. Logger un entry d'audit "Application shutdown completed" via AuditPort
7. Libérer toutes les ressources (threads, connections, caches)

**Etapes d'arret (ordre inversé de l'initialisation):**
1. Accepter plus de requetes = NO
2. Completer les requêtes en cours (timeout grace period)
3. OfflineSyncAggregate: flush des operations pending (dernier push)
4. EventDispatcher: shutdown (no more event publishing)
5. Scheduler: shutdown (stop all scheduled jobs)
6. Connection pools: close all repository connections
7. FileStoragePort: flush buffers
8. AuditPort: final audit entry (shutdown confirmation)
9. Release all resources

**Depends On:** Tous les Runtime Components (doit arreter chacun d'eux dans l'ordre inverse)

**Consumed By:** LifecycleManager (CRT-006) qui déclenche le shutdown

**Lifecycle:** Single-use -- execute une seule fois à l'arret de l'application.

**Error Handling:** Timeout de grace period → force shutdown malgré tout. Aucun data loss ne doit se produire pendant le shutdown -- si les données ne peuvent être persistées, le shutdown bloque (ne continue pas).

---

## COMPOSANT 12: RetryPolicy

**ID:** CRT-012
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de politique de retry

**Objectif:** Definit et applique les politiques de retry pour toutes les operations qui peuvent échouer temporairement : publication d'événements, push de synchronisation, appels réseau, accès cache.

**Responsabilités:**
1. Définir une politique de retry par type d'operation (event publish, sync push, cache access, etc.)
2. Appliquer le backoff exponentiel défini dans BR-SYNC-003 (max 5 retries)
3. Distinguer les erreurs transitoires (retry) des erreurs permanentes (no retry)
4. Logger chaque tentative et échec via LoggingPort
5. Fournir une visibilité sur les stats de retry pour Diagnostics

**Stratégies de retry definies:**
- Event Publication: backoff exponentiel, max 5 retries, type d'erreur transient seulement
- Sync Push: backoff exponentiel, max 5 retries (BR-SYNC-003), entre les batches
- Cache Access: 1 retry seulement (cache is best-effort, ne pas bloquer)
- Repository Operations: 0 retries (les erreurs DB sont traitées différemment)
- Notification Send: backoff exponentiel, max 5 retries (BR-NOT-004)

**Depends On:** LoggingPort (Port-009) pour logger les tentatives, FileStoragePort (Port-013) pour persister les politiques de retry configuration

**Consumed By:** EventDispatcher (retry failed publishes), OfflineSyncService (retry failed pushes), NotificationService (retry failed sends)

**Lifecycle:** Singleton, configure une seule fois au démarrage, appliqué ensuite par tous les consommateurs.

**Contraits constitutionnels:**
- Max retries = 5 partout (BR-SYNC-003 constitutionnel)
- Backoff exponentiel obligatoire (jamais linéaire)
- Les erreurs de domaine (invariant violé) ne SONT JAMAIS retryées -- ce ne sont pas des erreurs transitoires

**Error Handling:** Exhaustion des retries → log error, propaguer l'échec au caller. L'échec du retry ne doit JAMAIS propager une exception brute -- toujours wrapped dans un domain-aware error.

---

## COMPOSANT 13: IdempotencyManager

**ID:** CRT-013
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de gestion d'identité

**Objectif:** Garantit l'idempotence des operations soumises plusieurs fois par error (re-play de requête, reconnect offline qui resends les mêmes ops). Essentiel pour l'offline-first architecture.

**Responsabilités:**
1. Identifier chaque operation entrante avec un idempotency key (genéré par l'appelant ou derive de request_id)
2. Cache les résultats des operations déja executees avec la même clé
3. Retourner le résultat en cache si l'opération a déjà été exécutée avec cette clé
4. Evicter les clés idempotentes selon une stratégie TTL configurée
5. Travailler en conjonction avec CachePort (Port-014) pour la performance

**Scope:** Scoped -- instancié par requête/contexte, pas global singleton.

**Depends On:** CachePort (Port-014) pour stocker les résultats idempotents, IdentityProviderPort (Port-004) pour authentifier le caller

**Consumed By:** API layer (request_id injection), tous les Application Services (guard avant execute)

**Lifecycle:** Par-requête / par-session. Les clés idempotentes expirent après un TTL configurable.

**Contraits constitutionnels:**
- Une operation déjà exécutée retourne le MEME resultat (pas d'exécution double)
- Les clés idempotentes incluent org_id pour l'isolation multi-tenant (INV-004)
- Idempotency check est READ-ONLY -- ne modifie aucun état
- TTL de conservation des clés idempotentes : configurable, default 24 heures

**Error Handling:** Cache miss → procéder normalement. Cache full → evict selon policy LRU.

---

## COMPOSANT 14: AuditEnabler

**ID:** CRT-014
**Proprietaire:** Architecture convention
**Statut:** Composant runtime d'activation de l'audit

**Objectif:** Active automatiquement l'audit pour TOUTES les opérations d'écriture. Sert de pont entre les Domain Events et AuditAggregate.LogAction.

**Responsabilités:**
1. Intercepter TOUTES les operations d'écriture (Commands) et capturer before/after state
2. Appeler AuditPort.log() avec action, entityType, entityId, old_values, new_values, userId, orgId
3. Garantir que old_values ET new_values sont toujours presentes (OLDNEW-002)
4. Ne JAMAIS auditer AuditAggregate lui-même (NB-PERSIST-007, prevention récursion infinie)
5. Gerer les échecs d'audit en tant que NON-BLOCKING : si AuditPort est indisponible, l'operation domaine continue

**Scope:** Scoped -- activé par-operation d'écriture, pas global singleton.

**Depends On:** AuditPort (Port-010), IdentityProviderPort (Port-004) pour identifier l'utilisateur, LoggingPort (Port-009) pour logger les échecs d'audit non-bloquants

**Consumed By:** Tous les Application Services (avant et après persistence)

**Lifecycle:** Par-write-operation. Activé implicitement à chaque Commande, désactivé après LogAction.

**Contraits constitutionnels:**
- AUD-001 constitutionnel : L'audit ne bloque JAMAIS l'opération domaine
- OLDNEW-002 constitutionnel : old_values + new_values TOUJOURS captures
- NB-PERSIST-007 constitutionnel : AuditAggregate ne s'audite PAS lui-même
- RETENTION-031 constitutionnel : minimum 7 ans de rétention
- Self-audit interdit : les entries d'audit ne produisent pas d'autre entry d'audit

**Error Handling:** AuditPort indisponible → log warning, continuer l'opération domaine sans audit. L'échec d'audit N'EST PAS une raison de roll-back l'opération domaine.

---

## COMPOSANT 15: TenantContextProvider

**ID:** CRT-015
**Proprietaire:** Architecture convention
**Statut:** Composant runtime de contexte locataire

**Objectif:** Fournit le contexte d'organisation (org_id) actuel à TOUTES les opérations de l'application. Garantit l'isolement multi-tenant INV-004.

**Responsabilités:**
1. Résoudre l'org_id depuis le contexte d'authentication (IdentityProviderPort)
2. Injecter org_id dans TOUTES les opérations de lecture et d'écriture (RepositoryPort, SearchPort, FileStoragePort, VocabularyAccessPort)
3. Valider que l'org_id résolu correspond bien à celui du utilisateur authentifié
4. Fournir un accessor thread-safe pour acceder au contexte tenant courant
5. Gerer les cas où l'org_id n'est pas disponible (non-authentifié, token expiré)

**Scope:** Scoped -- par-requête / par-thread, pas global singleton.

**Depends On:** IdentityProviderPort (Port-004) pour résoudre l'org_id depuis la session authentifiée

**Consumed By:** Tous les Application Services (via RepositoryPort, SearchPort, FileStoragePort, VocabularyAccessPort), API Layer

**Lifecycle:** Crée au début de chaque requête, détruit à la fin. Thread-local ou context-local.

**Contraits constitutionnels:**
- INV-004 constitutionnel : org_id TOUJOURS injecté, jamais accepte comme input utilisateur brut
- org_id resolvé uniquement depuis la session authentifiée, JAMAIS depuis un paramètre HTTP
- PAS-003 DR-009 constitutionnel : chaque operation d'acces aux donnees tenant-scoped inclut org_id
- Si org_id impossible à résoudre → 401 Unauthorized, aucune operation ne procede

**Error Handling:** org_id non résolu → operation bloquée, erreur 401/403 retournée.

---

## RESUME DES 15 COMPOSANTS RUNTIME

| # | ID | Composant | Scope | Dépend de | Alimenté par |
|---|-----|-----------|-------|-----------|-------------|
| 1 | CRT-001 | CompositionRoot | Singleton | ConfigLoader, Resolver | — |
| 2 | CRT-002 | DependencyResolver | Singleton (one-shot) | — | — |
| 3 | CRT-003 | TransactionCoordinator | Global (scope-per-op) | RepoPort, TxManagerPort | AppServices |
| 4 | CRT-004 | EventDispatcher | Singleton | EventPubPort, EventSubPort | TxCoord after commit |
| 5 | CRT-005 | ConfigurationLoader | Singleton | — | ConfigFile/EnvVars/Templates |
| 6 | CRT-006 | LifecycleManager | Singleton | StartupPipeline, ShutdownPipeline | OS signals |
| 7 | CRT-007 | HealthMonitor | Singleton | All Port health checks | Scheduler interval |
| 8 | CRT-008 | Diagnostics | Singleton | LoggingPort | Runtime events |
| 9 | CRT-009 | Scheduler | Singleton | ClockPort, TxCoordinator, EventDispatcher | System clock |
| 10 | CRT-010 | StartupPipeline | Single-use | ConfigLoader, Resolver, all components | LifecycleManager |
| 11 | CRT-011 | ShutdownPipeline | Single-use | All components | LifecycleManager |
| 12 | CRT-012 | RetryPolicy | Singleton | LoggingPort | EventDispatcher, FileStorage |
| 13 | CRT-013 | IdempotencyManager | Scoped (per-request) | CachePort | API layer request_id |
| 14 | CRT-014 | AuditEnabler | Scoped (per-write) | AuditPort | All write commands |
| 15 | CRT-015 | TenantContextProvider | Scoped (per-request) | IdentityProviderPort | Authentication layer |

---

## MATRICE DE COUVERTURE DES PORTS PAR COMPOSANTS RUNTIME

| Port | CRT-001 | CRT-002 | CRT-003 | CRT-004 | CRT-005 | CRT-006 | CRT-007 | CRT-008 | CRT-009 | CRT-010 | CRT-011 | CRT-012 | CRT-013 | CRT-014 | CRT-015 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| RepoPort | binds | - | consumes | - | - | - | checks | - | - | binds | closes | - | - | - | - |
| EventPubPort | binds | - | - | consumes | - | - | - | - | - | binds | shutdown | - | - | - | - |
| EventSubPort | binds | - | - | consumes | - | - | - | - | - | binds | - | - | - | - | - |
| IdentityProviderPort | binds | - | - | - | - | - | - | - | - | binds | - | - | - | checks | resolves |
| AuthorizationPort | - | - | - | - | - | - | - | - | - | - | - | - | - | - | validates |
| ClockPort | - | - | - | - | - | - | - | - | provides | - | - | - | - | - | checks |
| UUIDPort | binds | - | - | - | - | - | - | - | - | binds | - | - | - | - | - |
| ConfigurationPort | - | - | - | - | consumes | - | checks | uses | - | - | - | - | - | - | - |
| LoggingPort | - | - | - | logs | - | - | logs | consumes | - | - | logs | logs | - | logs | - |
| AuditPort | binds | - | - | - | - | - | - | - | - | binds | closes | - | - | consumes | - |
| NotificationPort | binds | - | - | - | - | - | - | - | - | binds | closes | - | - | - | - |
| SearchPort | binds | - | - | - | - | checks | - | - | - | binds | closes | - | - | - | - |
| FileStoragePort | binds | - | - | - | - | - | - | - | - | binds | closes | stores | - | - | - |
| CachePort | binds | - | - | - | - | - | - | - | - | binds | closes | retries | uses | - | - |
| TxManagerPort | binds | - | consumes | - | - | - | - | - | coordinates | binds | closes | - | - | - | - |
| PersistenceVerifyPort | - | - | - | - | - | - | - | - | - | validates | - | - | - | - | - |
| VocabularyAccessPort | binds | - | - | - | - | - | - | - | - | binds | closes | - | - | - | - |

Key: binds = binds adapter category during composition; consumes = uses during operation; checks = verifies health; provides = supplies clock time; uses = reads config; coordinates = manages transaction scope; closes = cleanup on shutdown; stores = persists retry policies; validates = enforces org_id isolation

---

## REGLER NON-NEGOCIABLES DU RUNTIME

| Regle | Description | Source |
|-------|-------------|--------|
| RN-001 | Le Runtime ne contient AUCUNE logique metier | DOC-000 §6 (Runtime Services: orchestration only) |
| RN-002 | Le Runtime ne决ide PAS du comportement metier -- il decide de l'ordre d'assemblage | DOC-000 §6 |
| RN-003 | Les dependances du Runtime sont TOUJOURS vers les couches inferieures (flux descendant) | DOC-000 Regle 1 |
| RN-004 | Chaque Port a exactement une implementation concrète selectionnee au demarrage (pas de changement a chaud) | PAS-003 DR-004 |
| RN-005 | L'ordre d'assemblage est immuable apres calcul par DependencyResolver | DOC-000 Regle 1, DR-006 |
| RN-006 | Les evenements techniques ne sont PAS des Domain Events | PAS-003 DR-008, DOC-017 NB-PERSIST-003 |
| RN-007 | L'audit est terminal -- il consomme sans influancer en retour | DOC-019 NB-CAT-005 |
| RN-008 | L'isolement multi-tenant (org_id) est applique partout | PAS-003 DR-009, INV-004 |
| RN-009 | Le Runtime ne JAMAIS faire de business logic injection dans les Adapters | PAS-003 DR-011 |
| RN-010 | Le mode offline-first s'applique a TOUT -- aucun composant runtime ne bloque les operations user | DOC-017 NB-PERSIST-008, DOC-019 §4 |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | runtime-specifier v1.0 | Creation — Catalogue des 15 Runtime Components pour Lumina v1 | COMPLIANT (trace verifie contre DOC-000, DOC-001, DOC-012, DOC-014, DOC-017, DOC-019, PAS-001, PAS-002, PAS-003, ASS-001, ASS-004) |

---

*Ce document definit le catalogue des 15 composants Runtime. L'ordre d'assemblage precis est documente dans RTS-002. Les contrats detailles de chaque composant (methodes, erreurs, etats internes) sont documents dans RTS-003 a RTS-006.*
