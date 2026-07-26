# Runtime Orchestration Rules — Lumina v1

**Doc ID:** RTS-003
**Version:** v1.0
**Statut:** SPECIFICATION RUNTIME DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Generateur :** runtime-specifier v1.0
**Source canonique :** ["RTS-001", "RTS-002", "DOC-000", "DOC-014", "PAS-001", "ASS-003", "ASS-004"]
**Transformation_rule :** "runtime-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit les **15 règles d'orchestration_runtime** qui gouvernent le comportement de chaque Runtime Component durant la Phase 107 (Traitement Normal) du cycle de vie Lumina, et les transitions entre les phases du LifecycleManager. Ces règles sont complémentaires des Règles Non-Négociables (RN-001 à RN-010) du catalogue RTS-001, des phases séquentielles du cycle de vie RTS-002, et des invaries LV-001 à LV-010.

Les règles s'appliquent aux 15 Runtime Components catalogués dans RTS-001 et couvrent sept domaines fonctionnels :

| Domaine | Règles | Composants concernés | Phase RTS-002 |
|---------|--------|---------------------|---------------|
| Assemblage & Dépendances | OR-001, OR-002 | CRT-001, CRT-002 | Phase 103/104 |
| Transactions | OR-003, OR-007 | CRT-003, CRT-009 | Phase 107 |
| Événements | OR-004, OR-005 | CRT-004, CRT-012 | Phase 107 |
| Idempotence & Retry | OR-005, OR-006 | CRT-012, CRT-013 | Phase 107 |
| Coordination cross-aggregate | OR-008, OR-009, OR-010 | CRT-003, CRT-004, CRT-015 | Phase 107 |
| Cycle de vie déterministe | OR-011, OR-012 | CRT-010, CRT-011, CRT-006 | Phase 106/108/109 |
| Observabilité & Ressources | OR-013, OR-014, OR-015 | CRT-008, CRT-014, CRT-011 | Phase 106-109 |

**Règle constitutionnelle**: Chaque règle est **vérifiable automatiquement** (section *Verifiable Assertion*). Une règle non vérifiable n'est pas une règle RTS — c'est un conseil. Chaque règle doit pouvoir être testée sans lancer l'application entière (analyse statique, grep, ou test unitaire isolé). Les assertions nécessitant l'exécution d'un test d'intégration sont marquées explicitement par le suffix `[integration]`.

---

## DOMAINE 1 — ASSEMBLAGE ET DÉPENDANCES

---

### OR-001: Assembly Order Enforcement

**Description**: L'ordre d'assemblage des composants Runtime doit être strictement topologique et déterministe — jamais dynamique, jamais conditionnel.

**Contexte**: S'applique au **CompositionRoot (CRT-001)** et au **DependencyResolver (CRT-002)** pendant la Phase 103 (Assemblage Composants) de RTS-002. C'est la concrétisation de la règle RN-005 (DR-006).

**Règle**: Le DependencyResolver produit un ordre topologique unique et immuable au démarrage. Le CompositionRoot installe les composants EXACTEMENT dans cet ordre. Aucun composant ne peut être installé avant que toutes ses dépendances ne soient résolues. L'ordre ne change jamais entre deux démarrages successifs avec la même configuration.

**Application**:
- Le DependencyResolver exécute un tri topologique (Kahn's algorithm) une seule fois au démarrage et stocke le résultat dans un tableau immuable `ResolvedOrder[]`.
- Le CompositionRoot itère sur `ResolvedOrder` séquentiellement : pour chaque `CRT-NNN`, il vérifie que TOUS les Ports dont `CRT-NNN` dépend ont déjà été bindés. Si ce n'est pas le cas → EXIT IMMÉDIAT.
- Aucun `await`, `Promise`, callback asynchrone, ou condition dynamique ne peut modifier l'ordre : l'installation est purement séquentielle et synchrone.
- Exemple concret : CRT-003 (TransactionCoordinator) dépend de RepositoryPort et TransactionManagerPort. Il est listé à la position 5 dans `ResolvedOrder`. Les positions 1-4 doivent obligatoirement contenir les adaptateurs de ces deux Ports. Si ClockPort adapter (position 3) apparaît après CRT-003 → violation détectée et exit.

**Violation Types**:
- **OrderedInstallationBeforeDependencies**: Un composant est installé avant qu'une de ses dépendances ne le soit. Détectable par inspection statique de l'ordre dans CompositionRoot vs graphe de dépendances du DependencyResolver.
- **DynamicOrderOverride**: L'ordre d'assemblage est modifié dynamiquement (via config, flag, ou condition runtime). Toute modification de l'ordre résolu statiquement est interdite.
- **SkippedDependency**: Un composant est installé mais une de ses dépendances n'a pas été bindée. Le Port attendu est nul ou non instancié au moment de l'installation.

**Verifiable Assertion**: Script statique qui compare deux structures de données : (1) l'array `ResolvedOrder` sorti du DependencyResolver, (2) la dépendance清单 de chaque CRT depuis RTS-001. Pour chaque élément `ResolvedOrder[i]`, vérifier que tous ses依赖 sont présents dans `ResolvedOrder[0..i-1]`. Si un依赖 manque → violation. Implémentable comme test unitaire exécuté au build time, sans lancer l'application.

**Related Components**: CRT-001 (CompositionRoot), CRT-002 (DependencyResolver), CRT-010 (StartupPipeline)

---

### OR-002: Dependency Resolution Strategy

**Description**: Toutes les dépendances entre Runtime Components doivent être résolues par injection constructeur uniquement — le pattern Service Locator est strictement interdit.

**Contexte**: S'applique à TOUS les Runtime Components (CRT-001 à CRT-015) ainsi qu'à tous leurs interactions avec les Ports. C'est la mécanicatisation du principe de flux descendant de DOC-000.

**Règle**: Chaque Runtime Component reçoit toutes ses dépendances via son constructeur (ou via une méthode `configure()` appelée avant toute utilisation). Aucun composant ne peut chercher une dépendance "à la demande" via un registre global, une variable singleton accessible globalement, ou une invocation directe sur une classe concrete.

**Application**:
- **Dependency Resolution at Build Time** : le graphe de dépendances de chaque CRT est défini dans RTS-001 et ne change pas. Le DependencyResolver (CRT-002) lit ce graphe au startup et produit l'ordre topologique. Le graphe de dépendances est stocké dans une constante immuable `CONST_DEPENDENCY_GRAPH` de type `Map<CrtId, CrtId[]>`.
- **Construction Phase** : chaque composant Runtime doit être instanciable via `new CrtName(dep1, dep2, ...)` avec exactement les Ports ou autres CRTs qu'il déclare dans RTS-001. Aucun paramètre optionnel, aucune variation de signature.
- **No Dynamic Feature Flags on Runtime Components** : les feature flags peuvent désactiver des Application Services ou modifier leur comportement, mais ils ne peuvent JAMAIS désactiver un Runtime Component. Les 15 CRTs sont toujours créés.
- **Port Registry Lifetime** : le `PortRegistry` créé par CompositionRoot pendant la Phase 104 a une durée de vie égale à celle du processus. Après assemblage, le registry devient en lecture seule. Toute tentative de modification → exception `ImmutablePortRegistryError`.
- **Constructor Injection is Enforced at Lint Level** : un lint rule (ou ESLint plugin) interdit l'import direct d'un adapter concrete dans un fichier CRT. Seul l'import du Port abstraction est permis. Pattern enforce: `import type { RepositoryPort } from './ports';` — pas `import { SQLRepositoryAdapter } from './adapters/sql';`.
- Exemple concret : CRT-003 (TransactionCoordinator) constructor signature exacte : `constructor(private readonly repositoryPort: RepositoryPort, private readonly transactionManagerPort: TransactionManagerPort)`. Cette signature ne change PAS selon l'environnement (dev/prod/staging). La même signature est utilisée partout.

**Violation Types**:
- **ServiceLocatorUsage**: Un composant appelle une méthode statique, globale ou registry-based pour résoudre une dépendance au lieu de l'avoir reçue via son constructeur. Détection par lint rule (no-static-get, no-global-access for port types).
- **ConcreteAdapterReference**: Un Runtime Component référence un adapter concret par type compile-time au lieu d'utiliser l'abstraction du Port correspondant. Détection par inspection du code source : si un import pointe vers un fichier `*.adapter.ts` ou `*.adapter.js` hors du répertoire binding, c'est une violation.
- **MissingConstructorDependency**: Un composant déclare une dépendance mais ne l'utilise pas dans son constructeur (ou utilise `any`). Vérifiable par analyse statique des signatures de constructeurs vs déclaration de dépendances dans RTS-001.
- **OptionalParameterInConstructor**: Un paramètre de constructeur d'un CRT est optionnel (valeur par défaut ou nullable). Tous les dépendances doivent être présentes obligatoirement au moment de l'instanciation.

**Verifiable Assertion**: Analyse statique du code source exécutée au build time (CI pipeline) : (1) Pour chaque classe CRT-NNN, extraire les paramètres du constructeur via AST parsing. (2) Comparer avec la liste des dépendances du composant dans RTS-001 §COMPOSANT N. (3) Pour chaque dépendance déclarée dans RTS-001 mais absente du constructeur → violation MissingConstructorDependency. (4) Scanner toutes les invocations de méthodes statiques `*Port.*getInstance()`, `*Port.instance`, `Container.get()`, `resolve('*')`, `lookup('*')` dans le code de tous les CRTs → violation ServiceLocatorUsage. (5) Vérifier qu'aucun CRT n'importe un fichier dont le chemin contient `.adapter.` ou `.impl.` → violation ConcreteAdapterReference. (6) Tester que chaque CRT peut être instancié uniquement via son constructeur avec des mocks des Ports correspondants (integration test de compilation).

**Related Components**: CRT-001 (CompositionRoot — implémente le binding), CRT-003, CRT-004, CRT-005, CRT-007, CRT-008, CRT-009, CRT-012, CRT-013, CRT-014, CRT-015 (tous consomment l'injection constructeur)

---

## DOMAINE 2 — TRANSACTIONS

---

### OR-003: Transaction Boundary Management

**Description**: Chaque scope transactionnel doit avoir une frontière claire définie par l'operation elle-même, avec rollback immédiat sur échec et compensation orientée saga pour les opérations cross-aggregate.

**Contexte**: S'applique au **TransactionCoordinator (CRT-003)** pendant la Phase 107 (Traitement Normal). C'est la concrétisation des responsabilités du CRT-003 décrites dans RTS-001.

**Règle**: Les transactions intra-aggregate utilisent des scopes atomiques begin/commit/rollback gérés par TransactionManagerPort. Les transactions cross-aggregate utilisent le pattern Saga avec actions compensatrices. Aucun scope transactionnel ne peut s'étendre au-delà du boundary d'un Aggregate root. Le choix entre rollback simple et saga compensation dépend de la matrice de coordination ASS-004.

**Application**:
- **Intra-Aggregate Transaction** : le TransactionCoordinator crée un scope avec `begin()`, l'Application Service exécute les changements de l'Aggregate, `commit()` persiste via RepositoryPort, ou `rollback()` annule toutes les modifications. Le scope transactionnel couvre EXACTEMENT la durée d'une operation sur un seul Aggregate root. Tout begin() doit avoir un matching commit() ou rollback().
- **Cross-Aggregate Linear Saga** (ASS-004 Pattern Linear) : séquence d'Aggregates exécutés séquentiellement dans un order strict défini par la matrice ASS-004. Chaque step a SON PROPRE sous-scope transactionnel indépendant. À l'échec du step N, on rollback le step N puis on exécute les actions compensatrices des steps 1 à N-1 en ordre inverse. Chaque compensation est une operation autonome dans sa propre transaction.
- **Cross-Aggregate Parallel Saga** (ASS-004 Pattern Parallel) : plusieurs Aggregates modifiés en parallèle (non dépendants). Chaque Aggregate est traité dans une transaction atomique indépendante. Si l'un échoue, les autres réussissent quand même — pas de rollback global car chaqueAggregate est déjà commité dans sa propre transaction. Les failures sont signalés via events.
- **Cross-Aggregate Compensating Saga** (ASS-004 Pattern Saga) : utilisé pour les séquences où les étapes sont fortement couplées mais doivent réussir/failure ensemble, et où le rollback n'est pas possible (ex :-approved transactions). Chaque step définit UNE action compensatrice exacte. La compensation suit EXACTEMENT la matrice ASS-004 : ResourceAggregate→OfflineSyncAggregate = compensation par suppression de PendingOperation record ; OrganizationAggregate→RelationshipAggregate = compensation par suppression du lien parent créé.
- **Transaction Timeout** : configurable via ConfigurationPort (`LUMINA_TRANSACTION_TIMEOUT_MS`, défaut 30000ms, min 5000ms, max 120000ms). Un timeout déclenche automatiquement un rollback + compensation + l'émission d'un event `TransactionTimedOut`. Le timeout est vérifié avec un heartbeat qui check toutes les 500ms.
- **No Event-Blocking Transactions** : les Domain Events générés pendant un scope transactionnel ne sont JAMAIS publiés avant le commit de ce scope. La publication se fait toujours en post-commit, après que toutes les données persistées soient visibles pour d'autres transactions.
- Exemple concret : WorkflowService.ApproveTransaction trigger un cross-aggregate linear saga : (1) ResourceAggregate.load(resourceId) → load in txn scope A, (2) ResourceAggregate.approve() → commit scope A, (3) WorkflowAggregate.completeStep(workflowInstanceId) → commit scope B, (4) emit ApprovalGranted. Si étape (3) échoue → compensation = WorkflowAggregate.rollbackStep(workflowInstanceId) dans scope C, puis resource state reste approved (pas de compensation possible car approved est immutable WF-005).

**Violation Types**:
- **BoundaryCrossing**: Une transaction s'étend au-delà du boundary d'un Aggregate root (modifie deux Aggregates dans la même transaction SQL/scope `begin()`/`commit()`). Détectable par inspection des appels RepositoryPort dans un même scope transactionnel.
- **MissingCompensation**: Une operation cross-aggregate échoue mais aucune action compensatrice n'est définie pour au moins un step qui a déjà commité. Vérifiable par croiser la matrice ASS-004 avec le code du saga executor.
- **BlockingOnEventBus**: La transaction attend la confirmation de publication d'événements avant de commit. Les events doivent être publishés APRÈS commit (post-commit event publishing), sinon la transaction reste bloquée plus longtemps que nécessaire et risque de timeout.
- **OrphanedTransaction**: Un scope `begin()` est appelé mais aucun `commit()` ou `rollback()` n'est appelé au final — la transaction reste ouverte indéfiniment. Causé par une exception non attrapée qui bypass le finally block.

**Verifiable Assertion**: (1) Pour chaque handler d'application service, identifier tous les appels `RepositoryPort.save()` et `RepositoryPort.insert()` dans un même scope `beginTransaction()/commit()`. Si > 1 Aggregate root est touché dans le même scope → violation boundary crossing. Implémenter comme test qui trace tous les calls de persistence dans un saga et vérifie qu'ils appartiennent à des scopes transactionnels séparés. (2) Pour chaque saga défini (pattern linear/parallel/saga dans ASS-004), vérifier qu'une compensation est definie pour chaque step qui effectue un write. Utiliser grep sur les fichiers de composition pour trouver les définitions de sagas et vérifier la présence de `.compensate()` ou `.rollback()` par step. (3) Analyser AST pour s'assurer qu'aucun appel `EventPublicationPort.publish()` n'apparaît entre `beginTransaction()` et `commit()/rollback()` dans le même scope function.

**Related Components**: CRT-003 (TransactionCoordinator — owner), CRT-004 (EventDispatcher — post-commit publishing guard), Application Services (WorkflowService, LifecycleService, OfflineSyncService per ASS-001), tous les Cross-Aggregate interactions listées dans ASS-004

---

### OR-007: Concurrency Control

**Description**: Les transactions doivent être isolées les unes des autres, les lectures ne doivent pas bloquer les écritures, et l'optimistic locking doit être appliqué systématiquement sur les données partagées.

**Contexte**: S'applique au **TransactionCoordinator (CRT-003)** et au **Scheduler (CRT-009)** pendant la Phase 107. Ce rule complète OR-003 en traitant des problèmes de concurrence qui dépassent le scope d'une seule transaction.

**Règle**: Toutes les transactions opèrent avec l'isolation level READ COMMITTED minimum. L'optimistic locking (version column check during update) est activé par défaut sur toutes les tables canoniques. Les lectures sont toujours non-bloquantes : elles utilisent des snapshots ou des index couvrants, jamais des locks partageurs qui bloquent les写 operations.

**Application**:
- **Isolation Level** : chaque requête SQL est enveloppée dans une transaction READ COMMITTED minimum. Pour les opérations de lecture critique (ex : vérifier un invariant avant write), utiliser READ COMMITTED WITH SNAPSHOT (PostgreSQL) ou BEGIN IMMEDIATE (SQLite) pour éviter dirty reads sans bloquer les écritures concurrentes.
- **Optimistic Locking Schema** : chaque table canonique dispose d'une colonne `version INTEGER NOT NULL DEFAULT 0`. Lors d'un UPDATE, la clause WHERE inclut `AND version = <expected_version>`. Si 0 rows affected → version conflict. Le RetryPolicy (CRT-012) gère le retry automatiquement avec backoff exponentiel (max 3 retries pour optimistic lock conflict — distinct des max 5 retries pour errors transitoires).
- **Non-blocking Reads Strategy** : toutes les query operations (ASS-003 Step read path) utilisent SELECT SANS LOCK de quelque type que ce soit. Concrètement : pas de `FOR UPDATE`, `FOR SHARE`, `LOCK IN SHARE MODE`, ou `WITH (NOLOCK)` (SQL Server). Sur SQLite : `READ UNCOMMITTED` ou snapshot isolation via `BEGIN CONCURRENT`. Sur PostgreSQL : MVCC natif en READ COMMITTED garantit qu'un SELECT ne bloque jamais un UPDATE. Sur FileStorage JSON : lecture standard sans exclusive lock, le fichier est lu en entier puis parsé.
- **Read Your Own Writes** : pendant le lifetime d'une transaction, les lectures dans cette transaction voient les modifications déjà faites par la même transaction. Implémenté via un cache transaction-local qui intercepte les reads et retourne les writes bufferés avant de interroger la DB.
- **Deadlock Prevention via Resource Ordering** : les tables sont toujours accédées dans un ordre global fixe défini par leur nom alphabétique (AuditAggregate, FormAggregate, IdentityAggregate, LifecycleAggregate, etc.). Si deux transactions accèdent à Tables A et B, TOUTES les deux demandent A puis B. Cette règle élimine TOUS les deadlocks à la source — aucun besoin de deadlock detection/rollback.
- **Connection Pool Isolation** : chaque opération utilise une connection du pool sans la "retenir" plus longtemps que nécessaire. Les connections retournées au pool après chaque commit/rollback, jamais après l'entière requête HTTP (ce qui causserait des pools sous-utilisés).
- Exemple concret : deux utilisateurs modifient le même Transaction (même resource_id) simultanément. Utilisateur A charge l'aggregate (version=5). Utilisateur B charge le même aggregate (version=5) en parallèle. Utilisateur A commit → UPDATE transactions SET ... WHERE id=? AND version=5 → success, version devient 6. Utilisateur B commit → UPDATE transactions SET ... WHERE id=? AND version=5 → 0 rows affected → optimistic lock conflict → TransactionCoordinator intercepte → retry avec backoff 100ms → rechargement version=6 → recommencer l'operation.

**Violation Types**:
- **BlockingRead**: Une opération de lecture acquiert un lock partageur (SELECT ... FOR SHARE, SELECT ... FOR UPDATE, WITH UPDATE) qui empêche les écritures concurrentes. Détectable par analyse des requêtes SQL émises ou des appels RepositoryPort.
- **MissingVersionColumn**: Une table canonique utilisée en update ne possède pas de colonne `version NOT NULL DEFAULT 0`. Vérifiable par introspection du schéma de base de données (query information_schema.columns WHERE table_name = ... AND column_name = 'version').
- **LockOrderViolation**: Deux transactions acquièrent des locks sur des ressources dans un ordre différent, créant un risque réel de deadlock. Détectable en analysant l'ordre des opérations d'écriture dans chaque transaction et vérifiant la cohérence de l'ordre alphabétique.
- **DirtyRead**: Une transaction lit des données non encore commitées par une autre transaction (isolation level < READ COMMITTED). Vérifiable par audit des levels d'isolation configurés pour chaque transaction.
- **LeakedConnection**: Une connection de pool n'est pas retournée au pool après utilisation. Détectable par monitoring CRT-007 (unused connection > 60s).

**Verifiable Assertion**: (1) Query la base de données pour vérifier que chaque table canonique possède une colonne `version` de type `INTEGER` with default `0`. Commande SQL : `SELECT table_name FROM sqlite_master WHERE type='table'` puis pour chaque table `PRAGMA table_info(table_name)` pour trouver la colonne version. (2) Scanner le code source complet pour les patterns `SELECT.*FOR UPDATE`, `SELECT.*FOR SHARE`, `SELECT.*LOCK`, `WITH (NOLOCK)`, `BEGIN IMMEDIATE` dans des chemins de lecture → violation blocking read. (3) Configurer un test de concurrence : lancer 10 threads écrivant le même resource simultanément et vérifier que le système ne deadlock pas (aucune transaction bloquée indefiniment > grace period). (4) Vérifier que tous les chemins SELECT utilisent `READ COMMITTED` ou équivalent en isolation : grep pour `isolationLevel`, `SET ISOLATION`, `SET TRANSACTION ISOLATION`.

**Related Components**: CRT-003 (TransactionCoordinator — owner of concurrency control), CRT-007 (HealthMonitor — monitoring des deadlocks et connection leaks), CRT-012 (RetryPolicy — retry sur optimistic lock conflict avec max 3 retries), RepositoryPort (interface de persistence), CRT-009 (Scheduler — isolation des jobs planifiés)

---

## DOMAINE 3 — ÉVÉNEMENTS

---

### OR-004: Event Dispatch Guarantee

**Description**: Chaque événement publié doit être livré au moins une fois (at-least-once) à tous les consommateurs inscrits, avec une dead-letter queue pour les événements récalcitrants.

**Contexte**: S'applique à l'**EventDispatcher (CRT-004)** et au **RetryPolicy (CRT-012)** pendant la Phase 107. C'est une extension du contrat de CRT-004 dans RTS-001 et des mappings DOC-014.

**Règle**: Après un commit transactionnel réussi, le EventDispatcher publie TOUS les Domain Events associés. Chaque événement est délivré au moins une fois à chaque handler inscrit. Les duplicats sont tolérés par les consommateurs (cf. OR-006). Si un événement ne peut être livré après exhaustion des retries, il est placé dans une dead-letter queue pour investigation manuelle.

**Application**:
- **Post-commit Publication Only** : les Domain Events sont collectés pendant l'exécution de l'Aggregate (ASS-003 Step 4 — Domain Execution), mais ils ne sont JAMAIS publiés avant le commit transactionnel réussi (ASS-003 Step 7). La publication se fait EXACTEMENT après `commit()` et UNIQUEMENT si `commit()` a retourné succès. Si le commit échoue, les events collectés sont discardés silencieusement — jamais publiés pour une transaction rollbackée.
- **At-least-once Delivery Semantics** : pour CHAQUE handler inscrit sur un event type, le EventDispatcher tente la livraison. Le handler retourne soit `Success` soit `Error`. En cas d'Error → retry selon CRT-012 (max 5 retries, backoff exponentiel : 100ms, 200ms, 400ms, 800ms, 1600ms). En cas de Success → acknowledgment immediate. Après 5 retries échouées → message placé dans dead-letter queue avec payload intact + metadata d'erreur.
- **Dead-Letter Queue Schema** : chaque entrée DLQ est un record persisté avec les champs exacts : `{ event_type: string, event_payload: JSON, handler_target: string, error_code: string, error_message: string, retry_count: number, first_attempt_at: ISO8601, last_attempt_at: ISO8601, org_id: string }`. La DLQ est stockée dans FileStoragePort (fichier JSONL) pour persistance durable ou CachePort (LRU adapter, max 10000 entries) pour mode embedded. Les messages en DLQ ne sont JAMAIS re-retried automatiquement (risque de boucle infinie si le handler a un bug permanent).
- **Sequential Consumption Order** : les handlers sont exécutés DANS L'ORDRE de registration défini dans DOC-014 (colonne "Consommateurs autorisés"). Chaque handler termine COMPLÈTEMENT (succès ou DLQ) avant que le suivant ne commence. Cet ordre n'est jamais modifié à runtime. La séquentialité garantit que les consommateurs peuvent raisonner sur la causalité des événements.
- **Handler Isolation via Try-Catch Per-Handler** : chaque handler est enveloppé dans son propre try-catch-finally. Si handler N jette une exception, le catch log l'erreur, le finally libère les resources du handler N, et l'EventDispatcher passe IMMÉDIATEMENT au handler N+1. Aucun handler ne peut bloquer les autres, même en cas de crash non attrapé.
- **Event Immutability Guarantee** : le EventDispatcher ne modifie JAMAIS le payload d'un événement. Le payload émis est exactement le `JSON.parse(JSON.stringify(event))` produit par l'Aggregate — pas de filter, pas de transform, pas de enrichir (sauf les champs techniques ajoutés par l'EventDispatcher lui-même comme `dispatched_at`, `handler_index`). Les champs de domaine originaux sont intacts.
- **Diagnostics Integration** : chaque dispatch d'événement est loggé avec `correlation_id`, `event_type`, `handler_count`, `success_count`, `failure_count`, `dlq_placed_count`. Ces métriques sont exposées via Diagnostics endpoint `/metrics` sous la forme `events_dispatched_total{type="ResourceCreated"}`.
- Exemple concret : ResourceAggregate emit `ResourceCreated { id: "r-1", type: "transaction", org_id: "org-a" }` après commit réussi. EventDispatcher itère sur [OfflineSyncAggregate.PushHandler (index=0), AuditAggregate.LogHandler (index=1)]. Handler 0 traite avec succès → acknowledge. Handler 1 échoue (DB temporarily unavailable) → retry 1 (100ms) → retry 2 (200ms) → ... → retry 5 (1600ms) → toujours échec → placement en DLQ. EventDispatcher loggue: `dispatched event=ResourceCreated handlers=2 success=1 failure=1 dlq=1`. Response retournée au caller sans attendre du tout (SYNC-004 : event publishing never blocks domain operation).

**Violation Types**:
- **PreCommitPublish**: Un événement est publié AVANT que la transaction ne commit. Causé par un appel à `EventPublicationPort.publish()` ou `eventDispatcher.dispatch()` dans le flow ASS-003 avant le commit. L'événement pourrait être livré pour une transaction qui échouera ensuite, créant une incohérence de données permanente.
- **HandlerBlocking**: Un handler échoue et bloque l'exécution des handlers restants. L'échec d'un handler ne doit JAMAIS empêcher la livraison aux autres handlers inscrits sur le même événement. Causé par un missing try-catch ou un throw non attrapé dans une boucle de handlers.
- **PayloadModification**: Le EventDispatcher modifie, filtre ou transforme le payload d'un événement avant publication. Détection par comparaison du payload original et du payload dispatché — ils doivent être identiques (à part les champs techniques ajoutés par le dispatcher).
- **MissingDLQ**: Un événement qui échoue après exhaustion de 5 retries n'est pas placé dans une dead-letter queue. Il est simplement lost → violation de garantie at-least-once. Causé par un handler de retry qui n'a pas de fallback DLQ.
- **Out-of-OrderHandlers**: Les handlers ne sont pas exécutés dans l'ordre de registration DOC-014. Les événements causaux peuvent être mal interprétés si le handler B s'exécute avant le handler A alors que A doit voir l'état post-A avant de réagir.

**Verifiable Assertion**: (1) Scanner le code source entier pour les appels `EventPublicationPort.publish()` ou `eventDispatcher.dispatch()` dans les handlers AppServices → vérifier qu'aucun n'apparaît AVANT le call à `commit()` dans le flow ASS-003. Méthode : identifier le bloc function du command handler et vérifier l'ordre : begin() → execute() → commit() → publishEvents(). (2) Pour chaque handler call dans l'EventDispatcher, vérifier qu'il est entouré d'un `try/catch/finally` dédié. Grep pour le pattern de loop de handlers et valider que chaque iteration a son own try-catch. (3) Tester en simulation : implémenter un handler de test qui échoue systématiquement → vérifier que (a) le message apparait dans la DLQ après 5 retries, (b) les handlers suivants sont tout de même exécutés, (c) le payload est intact dans la DLQ. (4) Grep pour toute transformation de payload : chercher `JSON.stringify(event.payload` avec des filtres de clés, `.map(` sur event fields, ou `.omit/`.pick/ sur le payload.

**Related Components**: CRT-004 (EventDispatcher — owner of dispatch guarantee), CRT-012 (RetryPolicy — retry for failed deliveries), CRT-008 (Diagnostics — DLQ visibility et metrics), CRT-014 (AuditEnabler — consumes events, subject to order guarantees), all Application Services (producers of Domain Events via Aggregate boundary methods)

---

### OR-005: Retry Policy Application

**Description**: Chaque type d'opération a une politique de retry définie,avec backoff exponentiel. Les limites maximales sont fixes et ne sont jamais modifiées dynamiquement.

**Contexte**: S'applique au **RetryPolicy (CRT-012)** pendant la Phase 107. C'est la mécanique d'application des politiques de retry cataloguees dans RTS-001 §COMPOSANT 12.

**Règle**: Les maximums de retry par type d'opération sont des constantes immuables : events publish = max 5, external calls (notification send, remote auth, push sync) = max 5, cache access = max 1, repository operations = max 0 (pas de retry). Le backoff est TOUJOURS exponentiel : `delay_ms = base_delay * (2 ^ attempt_number)`, avec `base_delay = 100ms` par défaut. Pas de jitter n'est ajouté (prévisibilité pour debugging).

**Application**:
- **Immutable Maximums by Operation Type** : les maximums de retry sont des constantes codées en dur dans le Runtime, jamais modifiables par configuration au runtime. Valeurs : `MAX_RETRIES_EVENT_PUBLISH = 5`, `MAX_RETRIES_SYNC_PUSH = 5` (BR-SYNC-003 constitutionnel), `MAX_RETRIES_NOTIFICATION_SEND = 5` (BR-NOT-004 constitutionnel), `MAX_RETRIES_CACHE_ACCESS = 1`, `MAX_RETRIES_REPOSITORY_OPERATIONS = 0`. Toute tentative de modification de ces valeurs à l'exécution jette `ImmutableRetryPolicyError`.
- **Exponential Backoff Formula** : la formule exacte est `delay_ms = BASE_DELAY_MS * Math.pow(2, attempt_number)`. Avec `BASE_DELAY_MS = 100ms` par défaut (configurable via `LUMINA_RETRY_BASE_DELAY_MS` entre 10ms et 5000ms). Pas de jitter n'est ajouté — prévisibilité absolue pour debugging. Les délais exacts pour 5 retries : 100ms, 200ms, 400ms, 800ms, 1600ms. Total time sous max retries ≈ 3.1 secondes.
- **Error Classification** : chaque erreur est classifiée avant application du retry : (a) Transient (timeout, connection refused, rate limit 429) → retry ; (b) Permanent (invariant violé E-422, auth failure E-403, validation error E-400) → NO RETRY ; (c) Recoverable (schema mismatch, locked table) → retry max 5 fois puis error permanent. La classification se fait par code d'erreur, jamais par message ou heuristic.
- **Retry State Persistence** : pendant le shutdown (Phase 109), le RetryPolicy persiste ses statistiques courantes (total retries, retries per type, last retry timestamp) dans FileStoragePort. Ces données sont utilisées pour le diagnostic post-mortem via CRT-008 Diagnostics endpoint `/debug/dump`.
- **No Retry on Domain Errors** : toute erreur dont le code commence par E-4xx (client error) ou E-422 (domain invariant violation) est immédiatement propagée sans retry. Le RetryPolicy vérifie le code d'erreur AVANT toute tentative de backoff.
- **Scheduler Job Retries** : les tâches planifiées (CRT-009) qui échouent utilisent le même retry policy mais avec un délai minimum de 60 secondes entre les retries (pas 100ms comme pour les events). Formula : `max(60000, BASE_DELAY_MS * 2^attempt)`.
- Exemple concret : EventDispatcher tente de livrer `ResourceCreated` à OfflineSyncAggregate.PushHandler. Handler échoue avec `E-503-007` (connection timeout — error transient). Retry 1: wait 100ms → retry → success. Handler total reussi en 1 retry. Si au contraire le handler échoue 5 fois consécutifs → event placé en DLQ selon OR-004. L'opération de commande originale retourne succès quand même car le domain event est publié de manière asynchrone (SYNC-004).

**Violation Types**:
- **LinearBackoff**: Le délai entre retries augmente linéairement (100ms, 200ms, 300ms, 400ms) au lieu d'exponentiellement (100ms, 200ms, 400ms, 800ms). Détectable par measurement des intervals entre retry attempts.
- **ExceededMaxRetries**: Plus de 5 retries sont effectuées pour un même event/type d'operation. Jamais acceptable — 5 est le ceiling absolu (BR-SYNC-003 constitutionnel). Même pour des errors récurrents, il faut passer en DLQ.
- **RetryingDomainError**: Un retry est tenté pour une erreur de domaine (invariant violation E-422, validation failure E-400, authorization failure E-403). Les erreurs de domaine ne sont JAMAIS transitoires — elles reflètent un état logique impossible à réparer par retry.
- **MissingRetryForApplicableOperation**: Une opération applicable au retry (event publish, sync push, notification send) n'utilise PAS le RetryPolicy CRT-012 mais implémente son propre retry logic ad-hoc avec des paramètres différents.
- **JitterInBackoff**: Un temps aléatoire (jitter) est ajouté aux delays de retry. Le jitter rend les logs de debugging impossibles à re-produire et masque les patterns de failure systématiques.

**Verifiable Assertion**: (1) Vérifier que la formule de calcul de delay est EXACTEMENT `base_delay * Math.pow(2, attempt)` ou équivalent binaire `base_delay << attempt` dans le code CRT-012. Grep pour `Math.pow(2` ou `<<` (bit shift for power of 2). Si on trouve `+ delay` ou `delay * attempt` ou `Math.random()` → violation linear backoff ou jitter. (2) Pour chaque operation type, vérifier que le max retry constant est défini et ≤ 5. Comparer avec la table des constantes immuables. (3) Tester avec un handler qui échoue systématiquement → mesurer le nombre exact de retries (doit être ≤ 5 pour event/sync/notification, exactement 1 pour cache, exactement 0 pour repository) ET les intervals entre retries (doivent doubler à chaque fois). (4) Vérifier que les erreurs de type E-422, E-400, E-403 ne déclenchent AUCUN retry : grep for error code mapping/classification dans CRT-012 et valider qu'aucun pattern E-4xx ne passe dans la boucle de retry.

**Related Components**: CRT-012 (RetryPolicy — owner and enforcer), CRT-004 (EventDispatcher — principal consumer, calls retry on handler failure), OfflineSyncService (consume retry for sync pushes), NotificationService (consume retry for notification sends), CRT-009 (Scheduler — consume retry for scheduled job failures), CRT-008 (Diagnostics — expose retry statistics via `/metrics`)

---

## DOMAINE 4 — IDENTITÉ ET IDEMPOTENCE

---

### OR-006: Idempotency Enforcement

**Description**: Tous les write commands doivent être protégés contre l'exécution double par tracking de request_id, avec une fenêtre de déduplication configurable (défaut 5 minutes).

**Contexte**: S'applique à l'**IdempotencyManager (CRT-013)** et à l'**API layer** pendant la Phase 107. Essentiel pour l'offline-first architecture où les reconnects provoquent des replay de commandes.

**Règle**: Chaque write command entrant doit porter un request_id unique généré par le client. Le IdempotencyManager vérifie que ce request_id n'a pas déjà été exécuté dans la fenêtre de déduplication. Si oui → retourne la réponse cacheée de l'exécution précédente (identique). Si non → enregistre le request_id, exécute, cache la réponse. La fenêtre par défaut est de 5 minutes, configurable via ConfigurationPort.

**Application**:
- **Request ID Generation** : le client (API caller, mobile app, CLI) génère un UUIDv7 unique comme request_id et l'envoie dans le header `X-Idempotency-Key` (RFC 9518 pattern). Si le header est absent → le runtime en génère un automatiquement et l'ajoute dans la réponse `X-Generated-Idempotency-Key`, mais le client perd la garantie de idempotence entre sessions/restarts.
- **Window Management** : par défaut 5 minutes (300 secondes). Configurable via `LUMINA_IDEMPOTENCY_WINDOW_SECONDS` (min : 60s = 1 minute, max : 86400s = 24 heures, défaut : 300s). La fenêtre est basée sur wall-clock time (ClockPort.wallNow()), pas monotonic time. Au-delà du window, la clé idempotente est évictée par le CachePort TTL mechanism et une nouvelle exécution est autorisée.
- **Multi-Tenant Scope Enforced** : les request_ids sont SCOPPED par org_id (INV-004). Un même request_id pour deux orgs différents est traité comme deux executions totalement distinctes. Clé de hash utilisée pour le cache : `SHA256(request_id || ':' || org_id)`. L'org_id vient exclusivement du TenantContextProvider (CRT-015), jamais du body de la requête.
- **Read Operations Exempt** : les queries (read operations — ASS-003 Step query path) ne SONT PAS soumises à l'idempotence guard. Le IdempotencyManager n'est appelé QUE dans le chemin write (command path). Les reads sont inherently idempotent (SELECT ne modifie rien) et n'ont pas besoin de guarding.
- **Response Caching Schema** : la réponse cachee inclut EXACTEMENT ces champs : `{ status_code: number, headers: { [key: string]: string } excluding_sensitive_keys, body: JSON or null, execution_timestamp: ISO8601, aggregate_name: string, command_name: string }`. Si l'exécution originale a échoué (error response) → la même erreur (même status code, même error code, même message template) est retournée pour les replays. Pas de re-validation de domaine.
- **Offline Sync Replay Handling** : lorsque l'app offline se reconnecte, elle re-send toutes les operations pending dans la queue locale. Si le remote server (ou le localStorage en mode embedded) a déjà traité certaines d'entre elles, l'idempotence guard retourne les réponses cached sans re-exécuter le domain logic. Cela réduit la charge sur les Aggregates et previent les double-comptes/double-inscriptions.
- **Cache Eviction Strategy** : les clés idempotentes expirent selon TTL + LRU si le CachePort atteint sa capacité maximale. Priorité d'éviction : les clés les plus anciennes en premier, puis les moins récemment utilisées. Jamais d'éviction basée sur le contenu de la réponse.
- Exemple concret : Client A crée un draft transaction, request_id="u7-abc123-456". Le réseau coupe APRES que le server ait traité la demande mais AVANT que la réponse ne revienne au client. Client A retry avec le MÊME request_id="u7-abc123-456" (c'est le même UUIDv7 car c'est le client qui le génère, pas le server). IdempotencyManager voit "SHA256(u7-abc123-456::org-a)" déjà existant dans le cache → retourne la réponse cached exactement (201 Created avec le transaction UUID "t-789"). L'Aggregate ResourceAggregate N'EST PAS chargé, le domain logic CreateDraftTransaction N'EST PAS exécuté deux fois, et la transaction n'est PAS créée en double dans la base.

**Violation Types**:
- **DoubleExecution**: Un write command est exécuté physiquement alors qu'un request_id identique a déjà été exécuté et est toujours dans la fenêtre de déduplication. Causé par un manque de vérification idempotente avant execution ou par un bug dans le cache (clé perdue prématurément).
- **CrossTenantLeak**: Un request_id d'un org est reconnu comme dupliqué pour un autre org (ex : client envoie le même request_id à org-a et org-b, et le systeme rejette la deuxième comme duplicate). Causé par un scope de hash qui n'inclut pas l'org_id.
- **ExpiredKeyStillValid**: Une clé idempotente expirée (au-delà du window TTL) est encore reconnue comme dupliquée. Causé par un TTL incorrect configuré dans CachePort ou par une eviction manquée.
- **ReadOperationGuarded**: Un read operation (query) est soumis à l'idempotence guard, dégradant les performances de lecture inutilement et ajoutant une overhead de cache inutile.
- **UserControlledRequestId**: Le client peut spécifier un request_id arbitraire et utiliser cela comme attack vector (ex : un attacker envoie des request_ids qui collidient avec ceux d'autres utilisateurs). Bien que le hashing inclut l'org_id, le systeme doit valider le format du request_id (UUIDv7 uniquement).

**Verifiable Assertion**: (1) Vérifier que la clé de hash idempotente inclut l'org_id : grep pour `request_id.*org_id` ou `hash(request_id, org_id)` ou `SHA256.*request_id.*org_id` ou `concat.*request_id.*:` dans CRT-013. Sans org_id dans le hash → violation cross-tenant. (2) Tester en intégration : envoyer le même request_id deux fois avec interval < window défault (300s) → vérifier que la seconde execution NE DÉCLENCHE PAS une deuxième execution domain (l'Aggregate n'est pas touché, la DB count ne change pas). (3) Envoyer le même request_id avec interval > window (ex : 301s) → vérifier que la seconde execution EST une NOUVELLE execution (l'Aggregate est traité, la DB count change). (4) Vérifier que les read operations (ASS-003 query path, tous les methods `find*`, `get*`, `list*`, `query*`) n'appellent PAS le IdempotencyManager. Grep pour `idempotencyManager.check()` et valider qu'il n'apparaît que dans les handlers de command (create*, update*, delete*, approve*, archive*).

**Related Components**: CRT-013 (IdempotencyManager — owner of deduplication logic), CRT-015 (TenantContextProvider — fournit l'org_id pour le scope de hash), API Layer (injection du header X-Idempotency-Key), tous les Application Services qui traitent des write commands, CachePort (storage backend pour les clés idempotentes)

---

## DOMAINE 5 — COORDINATION ET PROPAGATION

---

### OR-008: Cancellation Handling

**Description**: Lorsqu'une requête ou un scope transactionnel est annulé, la cancellation doit se propager vers toutes les dépendances en cascade, avec rollback transactionnel et dispatch d'événements de compensation.

**Contexte**: S'applique à toutes les couches pendant la Phase 107, principalement au **TransactionCoordinator (CRT-003)**, **EventDispatcher (CRT-004)**, et **LifecycleManager (CRT-006)**. Important lors des cancellations de requêtes long-running (timeout HTTP, user abort) et lors du shutdown graceful.

**Règle**: Quand une cancellation est signalée (pour n'importe quelle raison), elle se propage atomiquement : (1) le scope transactionnel courant est rollbacké, (2) aucune compensation n'est initiée (la transaction n'a pas commité, donc rien à compenser), (3) si le scope était dans une phase de processing d'événements, les handlers restants sont skipés, (4) une entry d'audit "Operation cancelled" est écrite.

**Application**:
- **Cascade Propagation Model** : la cancellation se propage comme une vague qui remonte la pile d'exécution. Si le handler N d'un événement est annulé, TOUS les handlers restants N+1...M sont SKIPPÉS (ne sont pas invoqués). Si le processing de l'étape K d'un saga est annulé, toutes les étapes futures K+1...M final sont IGNORÉES ET toutes les étapes précédentes 1...K-1 (qui ont déjà commité) sont COMPENSÉES en ordre inverse.
- **Transaction Rollback on Cancellation Before Commit** : si la cancellation survient AVANT le commit d'une transaction, le rollback est immédiat et complet via `TransactionCoordinator.rollback()`. Toutes les opérations faites dans le scope sont anulées — pas de données partielles persistées. Les connections du pool sont retournées immédiatement.
- **Compensation Events on Partial Saga Completion** : si la cancellation survient APRÈS commit d'un ou plusieurs steps (saga incomplet, certains steps ont réussi), les compensations sont exécutées EN ORDRE INVERSE des steps déjà commités. Chaque compensation est une operation autonome dans sa PROPRE transaction. Les compensation events sont dispatchés via EventDispatcher (OR-004) avec un prefixe `*_Compensated` (ex : `ResourceCreated_Compensated`).
- **Async Job Cancellation** : pour les tâches planifiées (Scheduler jobs CRT-009), la cancellation se fait via un flag `isCancelled` vérifié à chaque checkpoint (toutes les 100ms max pendant une itération de job). Un job annulé ne bloque PAS l'arrêt du Scheduler ni des autres jobs planifiés. Le job courant est stoppé proprement, pas killed brutalement.
- **Grace Period Force Cancellation** : pendant le shutdown (Phase 108, OR-012 Step 2), toute requête in-flight non terminée au moment de la grace period expire est force-canceled. La cancellation force inclut : rollback de la transaction courante + écriture d'une audit entry "Force cancelled during shutdown" (CRT-014) + emission d'un event `OperationCancelled { reason: "shutdown_timeout", request_id, correlation_id }`.
- **Audit Trail for Cancellations** : chaque cancellation (soft ou force) écrit une entry d'audit avec les champs : `{ action: "OperationCancelled", entityType: string, entityId: string|null, userId: string|null, orgId: string, reason: "user_abort" | "shutdown_timeout" | "manual_cancel", correlationId: string, timestamp: ISO8601 }`. Ces entries sont consultables via Diagnostics endpoint `/debug/audit?filter=cancellation`.
- Exemple concret : User A émet un `CreateOrgUnit { name: "Dept Finance", parent: "org-root" }` qui trigger un linear saga : step 1 = OrganizationAggregate.createOrgUnit() → commit OK, version org=1. step 2 = RelationshipAggregate.createLink(parentId, newOrgId) →正在 processing, lock acquis sur table relationships. User abort la requête (network drop ou bouton cancel). Cancellation cascade: step 2 is SKIPPED (RelationAggregate n'est jamais appelé), step 1 EST COMPENSÉ (OrganizationAggregate.deleteOrgUnit(orgId_created_in_step_1) dans une nouvelle transaction). Event OrgUnitCancelled est émis. L'audit log contient une entry pour la compensation et une pour la cancellation.

**Violation Types**:
- **PartialCommitAfterCancel**: Des steps d'un saga commité avant la cancellation ne sont pas compensés. Résultat : des données orphannées persistent dans le système.
- **BlockingCancelledHandler**: Un handler en cours d'exécution ne respecte pas le flag de cancellation et continue jusqu'au bout, bloquant potentiellement les handlers restants.
- **SilentCancellation**: Une cancellation n'est pas enregistrée dans l'audit log. Impossible de tracer pourquoi une operation a été abandonnée.
- **CompensationAfterRollback**: Tentative de compensation d'un step qui a été rollbacké (donc n'a rien fait). Inutile et potentiellement nuisible.

**Verifiable Assertion**: (1) Pour chaque saga handler, vérifier la présence d'un block try/catch/finally qui, en cas d'erreur/cancellation, execute les compensations en order inverse. Grep pour `compensate` ou `rollback` dans les saga definitions. (2) Tester : lancer un saga avec 3 steps, trigger cancellation après step 1 → vérifier que step 1 est compensé et steps 2-3 ne sont PAS exécutés. (3) Vérifier que l'audit log contient une entry pour chaque cancellation (grep pour "cancelled" or "abort" dans les sources CRT-014). (4) Vérifier que le flag `isCancelled` est checked toutes les ~100ms dans les tâches long-running du Scheduler.

**Related Components**: CRT-003 (TransactionCoordinator — rollback + compensation), CRT-004 (EventDispatcher — skip remaining handlers), CRT-006 (LifecycleManager — shutdown cancellation), CRT-014 (AuditEnabler — log cancellations), CRT-011 (ShutdownPipeline — force shutdown propagation)

---

### OR-009: Cross-Aggregate Coordination

**Description**: Chaque interaction cross-aggregate doit suivre exactement le pattern défini dans la matrice ASS-004 — linear, parallel, ou saga — et aucun pattern alternatif n'est autorisé.

**Contexte**: S'applique au **TransactionCoordinator (CRT-003)** pendant la Phase 107 pour toutes les opérations qui touchent plus d'un Aggregate. C'est le bridge entre la specification de coordination (ASS-004) et son execution runtime (CRT-003).

**Règle**: Avant qu'une operation cross-aggregate ne démarre, le TransactionCoordinator identifie le pattern de coordination requis depuis la matrice ASS-004. Le pattern est choisi selon ces critères : (a) Linear — si les étapes sont fortement dépendantes et doivent réussir ensemble, (b) Parallel — si les étapes sont indépendantes et peuvent réussir/failure séparément, (c) Saga — si les étapes sont asynchrones ou longues. Une fois le pattern choisi, il ne peut JAMAIS être changé dynamiquement.

**Application**:
- **Pattern Linear Orchestration** : utilisé pour les séquences où chaque étape dépend du résultat de la précédente et où toutes les étapes doivent réussir ensemble. Exemple ASS-004 : OrgUnitCreated → RelationshipAggregate.createLink. Séquentiel et atomique : échec à l'étape N → rollback du step N puis compensation des steps 1 à N-1 en ordre inverse. Le Coordinator s'assure que chaque étape commit dans sa propre transaction AVANT de passer à la suivante (pas de multi-Aggregate transaction).
- **Pattern Parallel Orchestration** : utilisé pour les séquences où les étapes sont indépendantese mais doivent toutes produire un effet. Exemple ASS-004 : ResourceDeleted → (OfflineSyncAggregate.queue la suppression, AuditAggregate.log la suppression). Les deux handlers peuvent tourner en parallèle dans des transactions séparées. Si l'un échoue, l'autre réussit malgré tout — il n'y a pas de rollback global car chaque Aggregate est atomique dans sa propre transaction.
- **Pattern Saga (Compensating)** : utilisé pour les séquences asynchrones ou nécessitant des compensations complexes. Exemple ASS-004 : Approval workflow on transactions. WorkflowAggregate ne modifie PAS le ResourceAggregate — il réagit via events. Chaque step du saga a UNE action compensatrice exacte définie dans la matrice.
- **Matrice Binding at Startup** : le TransactionCoordinator charge la matrice ASS-004 au startup (Phase 106) dans un cache interne `CoordinationMatrix<TriggerKey, PrimaryAggregate, SecondaryAggregate, PatternType, CompensationActions[]>`. Ce cache est une constante READ-ONLY construite une seule fois — Jamais modifié à runtime. Modification = re-build + re-déploiement.
- **Trigger Event Mapping** : chaque événement trigger (ex : `ResourceCreated`, `ApprovalGranted`, `ResourceDeleted`, `SettingUpdated`) est mappé à un pattern SPECIFIQUE et des compensations SPECIFIQUES dans la matrice ASS-004. L'EventDispatcher consulte la matrice AVANT de dispatch pour déterminer si un saga coordinator doit être invoqué.
- **No Dynamic Pattern Switching** : une fois qu'un pattern est choisi pour une interaction cross-aggregate (déterminé par la matrice), il ne peut JAMAIS être changé dynamiquement. Aucune feature flag, config override, ou condition runtime ne peut modifier le pattern d'une interaction documentée dans ASS-004.
- Exemple concret : `ApprovalGranted` event trigger (de ResourceAggregate). Matrice ASS-004 dit : primary=WorkflowAggregate, secondary=ResourceAggregate(read-only), pattern=saga, compensation=N/A (workflow step seulement, no rollback possible sur transaction approved — invariant WF-005). TransactionCoordinator NE S'IMPLIQUE PAS ici — c'est un event-driven side-effect gestionné uniquement par l'EventDispatcher. Le flow exact : ResourceAggregate émet ApprovalGranted → EventDispatcher route vers WorkflowAggregate.stepApproved() (saga) + AuditAggregate.log() (side-effect).

**Violation Types**:
- **WrongPatternSelection**: Un pattern autre que celui spécifié dans ASS-004 est utilisé pour une interaction donnée. Exemple : utiliser Linear au lieu de Saga pour une opération asynchrone.
- **UnmappedInteraction**: Une interaction cross-aggregate n'est pas couverte par la matrice ASS-004. Toute nouvelle interaction doit être documentée dans ASS-004 AVANT d'être implémentée.
- **MissingCompensationStep**: Une opération saga a des steps mais aucune compensation définie pour au moins un step qui commit avant l'échec.
- **DirectAggregateCall**: Un Aggregate appelle directement une méthode d'un autre Aggregate au lieu de passer par le EventDispatcher ou TransactionCoordinator. C'est la violation la plus grave — brise tous les boundaries.

**Verifiable Assertion**: (1) Charger la matrice ASS-004 et valider que CHAQUE entry a un pattern valide (linear, parallel, ou saga) ET des compensations définies si le pattern est saga ou linear. Les entries avec pattern=parallel n'ont PAS besoin de compensations (chaque Aggregate est autonome). (2) Scanner le code source COMPLET pour des imports ou appels directs entre Aggregates — aucun `new ResourceAggregate()` ou `resourceAggregate.approveTransaction()` appelé depuis un autre Aggregate n'est acceptable. La seule exception : les reads-only cross-references (Resource→Vocabulary per ASS-004) qui passent par RepositoryPort abstraction. (3) Pour chaque trigger cross-aggregate (tous les events de DOC-014 qui ont des consommateurs dans ASS-004), vérifier qu'il existe une entry couvrante dans la matrice ASS-004. Un event trigger sans entry = violation unmapped interaction. (4) Test d'intégration : lancer chaque interaction cross-aggregate définie dans ASS-004 en mode debug logging et vérifier que le pattern respecté est bien celui spécifié (tracer le flow du TransactionCoordinator via correlation_ids).

**Related Components**: CRT-003 (TransactionCoordinator — pattern executor), CRT-004 (EventDispatcher — trigger routing), CRT-008 (Diagnostics — pattern monitoring), Application Services (source des triggers cross-aggregate)

---

### OR-010: Tenant Context Propagation

**Description**: Le org_id doit être résolu AVANT toute requête et propagé à TOUS les composants du Runtime sans exception. Aucune opération ne peut exécuter sans org_id résolu dans le contexte courant.

**Contexte**: S'applique au **TenantContextProvider (CRT-015)** et à TOUS les composants qui consomment des données tenant-scoped (CRT-003, CRT-004, CRT-007, CRT-009, CRT-012, CRT-013, CRT-014). C'est la matérialisation de INV-004 et DR-009.

**Règle**: Le org_id est résolut depuis le contexte d'authentication (IdentityProviderPort) AU DEBUT de chaque requête, avant que le TransactionCoordinator ou l'EventDispatcher ne soit invoqué. Une fois résolu, l'org_id est propagé via un thread-local (ou async-context-local) accessible par tous les composants. Si la résolution échoue → 401 Unauthorized IMMÉDIAT, aucune operation ne procede.

**Application**:
- **Resolution Point and Authority** : l'org_id est résolu EXCLUSIVEMENT dans l'API gateway / middleware AVANT que la requête n'atteigne l'Application Service. Le TenantContextProvider (CRT-015) extrait l'org_id UNIQUEMENT du token JWT (claim `org_id` signé par IdentityProviderPort). AUCUNE autre source n'est autorisée : pas de header custom, pas de paramètre URL, pas de cookie, pas de body field.
- **Thread-Local / Async-Local Storage** : l'org_id est stocké dans le contexte local du thread ou de l'async execution context. En Node.js : `AsyncLocalStorage<string>`. En Java : `ThreadLocal<String>`. En Python : `contextvars.ContextVar[str]`. Chaque requête a SON propre contexte tenant — strictement pas de sharing inter-tenant. Le contexte est créé au début de la requête et détruit à la fin (ou en cas d'erreur).
- **Universal Propagation Mechanism** : les wrappers des Ports (RepositoryPort, SearchPort, FileStoragePort, VocabularyAccessPort) injectent automatiquement l'org_id comme filtre WHERE dans TOUTES les requêtes qui touchent des données tenant-scoped. L'injection se fait au niveau de l'adapter binding — le code métier ne voit jamais l'org_id directement. Les adapters appliquent `WHERE org_id = ?` avec la valeur du contexte courant.
- **No Override Enforcement** : l'org_id résolu NE PEUT PAS être écrasé, modifié, ou contourné par un paramètre de requête, un header custom, ou un champ de formulaire. Toute tentative de modification déclenche une erreur E-403-010 (tenant override forbidden). La validation est faite dans le middleware, avant toute other processing.
- **Null Context Rejection** : si aucun org_id n'est disponible (non-authenticated request, token expiré, token invalide) → la requête est rejetée IMMÉDIATEMENT avec 401 Unauthorized. Sauf pour les endpoints public explicitement exemptés : health check (`/health`) et metrics (`/metrics`). Ces deux endpoints n'exigent PAS d'auth.
- **Multi-Component Consistency** : tous les composants consommateurs d'org_id (CRT-003 TransactionCoordinator, CRT-012 RetryPolicy, CRT-013 IdempotencyManager, CRT-014 AuditEnabler) lisent l'org_id DU MEME contexte thread-local. Ils ne le récupèrent jamais individuellement — c'est une seule source de vérité.
- Exemple concret : Request API `POST /transactions` avec JWT `{ sub: "user-1", org_id: "org-abc", role: "admin", iat: 1720000000 }`. Middleware appelle `TenantContextProvider.resolve(JWT)` → valide signature, extrait org_id="org-abc", stocke dans AsyncLocalStorage. Application Service CreateTransactionService.execute(command) est appelé. À l'intérieur, `repositoryPort.insert(transactionPO)` appelle l'adapter relational qui injecte implicitement `WHERE org_id = 'org-abc'`. La requête INSERT finale dans la DB est `INSERT INTO transactions (id, type, amount, org_id, version, created_at) VALUES (...)`. L'org_id dans la row vient DU TOKEN, PAS du body JSON de la requête. Si le body contient `"org_id": "org-bad"`, cette valeur est IGNORÉE — l'org_id dans la DB sera "org-abc".

**Violation Types**:
- **MissingOrgPropagation**: Une requête vers RepositoryPort, SearchPort, FileStoragePort, ou VocabularyAccessPort est executée SANS org_id dans le contexte courant. Causé par un composant qui n'injecte pas l'org_id scope dans ses operations de persistence. Violation directe de INV-004 (multi-tenant isolation constitutionnel).
- **UserSuppliedOrgId**: L'org_id est lu depuis un paramètre de requête, un header custom, ou un champ de formulaire au lieu d'être résolu depuis le token d'authentication. Permet l'escalade de privilèges cross-tenant — un user peut écrire des données dans un autre org.
- **CrossTenantLeak**: Des données d'un tenant sont lues ou modifiées parce que l'org_id du contexte courant n'était pas correctement injecté dans les filtres WHERE des requêtes de persistence. Les colonnes org_id sont absentes des clauses WHERE des SELECT/UPDATE/DELETE.
- **ResolutionWithoutAuth**: L'org_id est résolu (retourné non-null) sans qu'un utilisateur ne soit authentifié (token absent, expired, ou invalid). Le resolution doit ÉCHOUER en 401, pas retourner un org_id null ou une valeur par défaut.
- **StaleContext**: Le contexte tenant d'une requête précédente persiste dans le thread après sa complétion, causant qu'une nouvelle requête utilise le mauvais org_id. Causé par un missing `asyncLocalStorage.exit()` ou equivalent cleanup.

**Verifiable Assertion**: (1) Grep pour TOUS les appels RepositoryPort.query(), RepositoryPort.save(), RepositoryPort.delete(), SearchPort.search(), FileStoragePort.list() → vérifier que chacun inclut implicitement l'org_id dans la requête finale (WHERE org_id = ? ou équivalent). Tester avec un mock qui capture la requête SQL générée. (2) Scanner le code source pour toute assignation `context.orgId = request.params.orgId` ou `context.orgId = req.body.org_id` ou `context.orgId = req.headers['x-org-id']` → violation directe. (3) Lancer une requête GET /api/resources SANS JWT token → vérifier que la réponse HTTP est 401 Unauthorized (pas 200 avec liste vide, pas 500, pas 403). (4) Tester : envoyer une requête POST avec JWT org_id="org-a" MAIS body contenant `"org_id": "org-b"` → les données écrites DOIVENT avoir org_id="org-a" (du token), VRAIMENT PAS "org-b". Vérifier en inspectant la DB ou le mock repository.

**Related Components**: CRT-015 (TenantContextProvider — owner of resolution), CRT-003 (TransactionCoordinator — reads org_id from context for transaction metadata), CRT-013 (IdempotencyManager — includes org_id in idempotence hash key), CRT-014 (AuditEnabler — includes org_id in audit entries), CRT-007 (HealthMonitor — uses org_id context pour health check queries), tous les adapters de RepositoryPort, SearchPort, FileStoragePort, VocabularyAccessPort (injection automatique de filtre org_id)

---

## DOMAINE 6 — CYCLE DE VIE DÉTERMINISTE

---

### OR-011: Startup Sequence Determinism

**Description**: La séquence de démarrage doit être identique d'un démarrage à l'autre, avec le même ordre de composants, le même ordre de health checks, et les mêmes conditions de readiness. Aucune variation dynamique n'est permise.

**Contexte**: S'applique au **StartupPipeline (CRT-010)**, **LifecycleManager (CRT-006)**, et à TOUS les composants créés pendant la Phase 106. C'est la matérialisation de l'invariant LV-001 (phases executées toujours dans le même ordre).

**Règle**: La séquence de démarrage est strictement deterministe : les mêmes composants sont initialisés dans le même ordre à chaque démarrage, les health checks sont exécutés dans le même ordre fixe (défini dans RTS-002 Phase 105), et les conditions de readiness sont évaluées de manière identique. Aucun paramètre de configuration, aucune feature flag, aucune condition d'environnement ne peut modifier l'ordre ou le set des composants initialisés.

**Application**:
- **Component Set Fixed** : les 15 Runtime Components (CRT-001 à CRT-015) sont TOUJOURS créés, TOUJOURS dans le même ordre (RTS-002 Phase 103). Aucun composant n'est optionnel. Aucun composant ne peut être ajouté ou retiré dynamiquement. L'ensemble des 15 CRTs est constant `CONST_RUNTIME_COMPONENTS = [CRT-001, CRT-002, ..., CRT-015]`.
- **Health Check Order Fixed** : les 10 health checks de la Phase 105 sont exécutés dans CET ordre exact et immuable : (1) DB/Repository via ping, (2) Event Bus via loopback test HealthCheckPing, (3) ClockPort via monotonic + wall-clock consistency, (4) CachePort via write+read test key, (5) FileStoragePort via blob write+read+delete, (6) SearchPort via index+search test term, (7) Notification adapters via connection test (no actual send), (8) Scheduler via 0ms-delayed job test, (9) AuditPort via audit entry test write, (10) IdentityProviderPort via context resolution test. Cet ordre ne change JAMAIS entre deux démarrages.
- **Ready Condition Predicates** : l'application devient READY UNIQUEMENT quand ces 3 prédicats sont tous vrais : (a) tous les health checks retournent HEALTHY ou DEGRADED (jamais UNHEALTHY — au moins un UNHEALTHY provoque EXIT), (b) le StartupPipeline CRT-010 a signalé complétion complète via `StartupPipeline.complete()`, (c) le LifecycleManager CRT-006 a changé son état interne de STARTING à RUNNING. Le signal READY est émis EXACTEMENT quand ces trois conditions sont vérifiées — pas avant, pas après.
- **Feature Flags Ignored at Runtime Assembly** : aucune feature flag, config override, ou condition environnementale ne peut modifier l'ordre d'assemblage, le set des composants créés, ou l'ordre des health checks. Les feature flags affectent UNIQUEMENT le comportement des Application Services (qui CONSOMMENT le Runtime), jamais le Runtime lui-même. Le runtime est toujours complet et identique.
- **Deterministic Diagnostics Baseline** : le snapshot Diagnostics (CRT-008) pris à la fin du démarrage contient TOUJOURS les mêmes métriques de base dans le même ordre exact : `{ uptime_seconds: 0, requests_processed: 0, events_dispatched: 0, errors_total: 0, health_checks_run: 10, health_checks_passed: <N where N>=healthy_count>, sagas_completed: 0, retries_total: 0, idempotent_hits: 0, resource_leaks: 0 }`. Ces valeurs initiales sont les références absolues pour tous les calculs différentiels ultérieurs.
- **Reproducibility Test** : démarrer l'application N fois (N≥3) avec exactement la même configuration produit EXACTEMENT les mêmes logs d'initialisation (mêmes composants dans le même ordre, mêmes health checks dans le même ordre, mêmes timestamps relatifs). Toute différence = violation déterminisme. Ce test est exécuté en CI pipeline sur chaque build.
- Exemple concret : Démarrage #1 et démarrage #2 (même config JSON identique). L'ordre d'initialisation est IMMUABLE : CRT-005 → CRT-002 → ClockPort → UUIDPort → CRT-003 → CRT-004 → CRT-012 → CRT-013 → CRT-014 → CRT-015 → CRT-008 → CRT-009 → CRT-007 → CRT-010 → CRT-011 → CRT-001(bind) → CRT-006(start). 17 étapes, toujours les mêmes, toujours dans le même ordre. Démarrage #3 après reboot machine → EXACTEMENT le même ordre.

**Violation Types**:
- **ConditionalComponentSkip**: Un composant runtime n'est pas initialisé conditionnellement (ex : `if (!featureFlags.disableAudit) { createAuditEnabler(); }`). Les 15 composants doivent TOUJOURS être créés, sans exception.
- **RandomizedCheckOrder**: L'ordre des health checks varie d'un démarrage à l'autre. L'ordre doit être codé en dur dans un array constant, jamais généré dynamiquement depuis une config ou une source externe.
- **EarlyReadySignal**: L'application signale READY avant que le StartupPipeline ne soit entièrement complété. Le signal READY ne peut être envoyé qu'après l'étape finale du pipeline ET après que le LifecycleManager ait confirmé la complétion.
- **ConfigDrivenAssemblyOrder**: L'ordre d'assemblage est modifié par un setting de configuration externe. L'ordre est figé dans le graphe statique du DependencyResolver — la configuration ne peut PAS influencer cet ordre.
- **NonDeterministicMetrics**: Les métriques de baselineDiagnostiques varient d'un démarrage à l'autre (ex : `health_checks_run` = 9 un jour, 10 un autre). Le baseline doit toujours contenir exactement les mêmes champs avec les mêmes valeurs initiales.

**Verifiable Assertion**: (1) Démarrer l'application N fois (N≥3) avec la même config → logger chaque étape d'initialisation avec timestamp microseconde. Comparer les logs : ils doivent être identiques (même ordre de composants, même ordre de health checks). (2) Grep pour `if.*featureFlag.*CRT-` ou `if.*config.*create(Component` dans le code du StartupPipeline → violation conditionnelle. (3) Vérifier que le code du StartupPipeline n'a AUCUNE boucle `for each in randomOrder()` ou `shuffle()` — l'ordre est toujours un array constant `const PIPELINE_STEPS = [...]`. (4) Tester la condition READY : ajouter un health check qui échoue → vérifier que READY n'est JAMAIS signalé (l'application fait EXIT).

**Related Components**: CRT-006 (LifecycleManager — READY signal), CRT-010 (StartupPipeline — sequence owner), CRT-007 (HealthMonitor — health check execution), CRT-008 (Diagnostics — deterministic baseline metrics)

---

### OR-012: Shutdown Drain Policy

**Description**: Le shutdown suit un drain graduel en trois étapes : stop accepting → drain in-flight → flush buffers → close connections. Aucune étape ne peut commencer avant que la précédente ne soit signalée complète.

**Contexte**: S'applique au **ShutdownPipeline (CRT-011)** et au **LifecycleManager (CRT-006)** pendant les Phases 108 et 109. C'est la matérialisation de l'invariant LV-003 (shutdown toujours propre) et LV-004 (pas de data loss).

**Règle**: Le shutdown suit exactement 4 étapes séquentielles : (1) Stop accepting — toutes les nouvelles requêtes sont rejetées (503), (2) Drain in-flight — attendre que les requêtes en cours terminent (grace period, défaut 30s), (3) Flush buffers — pousser les opérations pending, vider les caches, persistier les politiques de retry, (4) Close connections — fermer toutes les connexions externes dans l'ordre inverse de l'initialisation. Chaque étape attend explicitement sa complétion avant de passer à l'étape suivante.

**Application**:
- **Step 1 — Stop Accepting (Atomic Transition)** : LifecycleManager appelle `acceptRequests(false)` de manière atomique. L'API layer retourne IMMÉDIATEMENT HTTP 503 Service Unavailable pour TOUTES les nouvelles requêtes entrantes. Le TenantContextProvider cesse de résoudre org_id pour les nouvelles requêtes. Les requêtes DÉJÀ dans le pipeline de traitement continuent normalement — elles ne sont pas interrompues. La grace period timer (configurable, défaut 30000ms) démarre automatiquement à ce moment précis (T+0).
- **Step 2 — Drain In-Flight Requests** : le LifecycleManager surveille en continu les requêtes in-flight via un counter incrementé au début du traitement et décrémenté à la fin. Chaque requête in-flight est marquée avec un timestamp de début (`request_start_at`). Si une requête dépasse la grace period → elle est force-canceled immédiatement selon OR-008 (rollback transaction + compensation si nécessaire + audit entry "Force cancelled during shutdown"). Les requêtes qui terminent normalement avant le timeout sont comptabilisées dans le diagnostic shutdown.
- **Step 3 — Flush All Buffers (Sequential)** : (a) OfflineSyncAggregate push pending ops une dernière fois — batch ≤ 50 operations par push, max 3 retries CRT-012. (b) EventDispatcher finalize — aucun nouvel événement n'est absorbé, les événements actuellement en cours de dispatch sont complétés, les handlers restants sont skipés. (c) RetryPolicy persist sa configuration courante ET ses statistiques (total_retries, retries_by_type, last_retry_timestamp) dans FileStoragePort. (d) IdempotencyManager evict tout le cache idempotent — toutes les clés restantes sont clariées de CachePort. (e) Diagnostics prend un snapshot final complet incluant uptime total, requests_total, errors_total, events_dispatched_total, retries_consumed, sagas_completed, sagas_compensated, resource_leaks.
- **Step 4 — Close Connections (Reverse Order, LV-005)** : toutes les ressources externes et internes sont fermées dans l'ordre EXACTEMENT inverse de l'initialisation (LV-005) : (1) Scheduler.stop() → clock fermé, (2) EventPublicationPort.close() + EventSubscriptionPort.close(), (3) RetryPolicy.persistAndClose(), (4) IdempotencyManager.evictAndClose(), (5) AuditPort.flushAndClose(), (6) ConnectionPools.close() (DB, file system, network), (7) FileStoragePort.flushBuffersAndClose(), (8) SearchPort.closeIndexesAndSync(), (9) NotificationPort.flushAndCloseAllAdapters(), (10) CachePort.evictAndClose(), (11) Diagnostics.finalSnapshotAndClose(), (12) TenantContextProvider.destroy(), (13) TransactionCoordinator.teardown(), (14) ConfigurationPort.invalidateSnapshot(), (15) Logger.flushRingBufferAndClose(). Chaque fermeture est loggée avec status (ok/error/delayed) et durée en ms.
- **Timeout and Grace Period** : configurable via `LUMINA_SHUTDOWN_GRACE_PERIOD_MS` (min 5000ms, max 120000ms, default 30000ms). Si la grace period expire ET qu'il reste des requêtes in-flight → force shutdown immédiate : skip drain des requêtes restantes, go directement à l'étape 4 (close connections). Les transactions ouvertes à ce point sont rollbackées silencieusement (pas de compensation possible car shutdown en cours).
- **Exit Code Determination** : (a) Exit 0 = shutdown normale initiée par SIGTERM admin, (b) Exit 143 = SIGTERM via orchestrateur (Kubernetes), (c) Exit 130 = SIGINT (ctrl+c terminal), (d) Exit 2 = shutdown prématurée (health check UNHEALTHY), (e) Exit 3 = crash non géré pendant Phase 107. Le exit code est TOUJOURS passé explicitement au processus parent.
- Exemple concret complet : SIGTERM reçu à T+0ms. T+0ms : acceptRequests(false) → 503 pour nouvelles requêtes. Grace timer démarre à 30s. T+2s : 3 requêtes in-flight terminées normalement (counter passe de 5 à 2 puis 0). T+30s : grace period expire, il reste 1 requête in-flight → force-cancelled (rollback tx), counter → 0. T+30ms : flush begin → OfflineSyncAggregate push 42 pending ops (batch of 50, success). T+35s : EventDispatcher finalized, 0 events pending. T+37s : RetryPolicy persisted stats to FileStorage. T+39s : all connection pools closed (DB, search, notification adapters). T+41s : all resources closed in reverse init order. T+42s : logger ring buffer flushed and closed. Exit code 143 sent to OS.

**Violation Types**:
- **PrematureClose**: Une connexion externe (DB, filesystem, network) est fermée alors que des requêtes in-flight l'utilisent encore. Causé par un close prématuré dans l'étape 4 avant que l'étape 2 ne soit complète.
- **DataLossOnShutdown**: Des operations pending (offline sync) ne sont pas flushées avant la fermeture des connections. Résultat : données perdues entre le dernier flush et le crash.
- **OutOfOrderClose**: Les connexions sont fermées dans un ordre différent de l'ordre inverse de l'initialisation. Exemple : fermer le Logger avant le RepositoryConnectionPool → le Logger ne peut plus loguer la fermeture des connections.
- **SilentExitCode**: L'exit code n'est pas propagé au processus parent (OS/ne reçoit pas le code de sortie). L'orchestrateur (Kubernetes, systemd) ne peut pas déterminer la raison du shutdown.

**Verifiable Assertion**: (1) Vérifier que l'ordre de fermeture dans CRT-011 ShutdownPipeline est EXACTEMENT l'inverse de l'ordre d'initialisation dans CRT-010 StartupPipeline. Extraire les deux arrays séquentiels et comparer element-by-element : `reverse(init_order) === shutdown_order`. Grep pour les close/teardown calls dans ShutdownPipeline et comparer avec l'array d'initialization dans StartupPipeline. (2) Tester le shutdown en lançant des requêtes in-flight au moment du SIGTERM → vérifier qu'elles sont drainées (terminent normalement) avant que les connections ne soient fermées. Temps total shutdown = grace_period + flush_time ≤ 45s typical. (3) Vérifier que le flush offline sync est bien exécuté AVANT la fermeture des connection pools : dans le code source, grep 'flush.*offline\|push.*pending\|OfflineSyncFlush' doit apparaître AVANT `close.*pool\|teardown.*connection\|pool.*close` dans la séquence d'étapes du shutdown pipeline. (4) Vérifier que l'exit code est TOUJOURS passé explicitement à `process.exit(code)` ou équivalent OS-native — jamais `process.exit()` sans argument, jamais un kill brutal du process parent.

**Related Components**: CRT-011 (ShutdownPipeline — owner of drain sequence), CRT-006 (LifecycleManager — orchestrator of shutdown signal and grace period), CRT-009 (Scheduler — stopped first in drain), CRT-004 (EventDispatcher — finalized after request drain), CRT-012 (RetryPolicy — persisted to storage), CRT-013 (IdempotencyManager — evicted after persistence), CRT-014 (AuditEnabler — final audit entry written), CRT-008 (Diagnostics — final snapshot taken), CRT-007 (HealthMonitor — stops polling before connections close)

---

## DOMAINE 7 — RÈGLES COMPLÉMENTAIRES DÉRIVÉES

---

### OR-013: Logging Traceability

**Description**: Chaque événement critique du Runtime doit être loggé avec un correlation_id unique qui traverse TOUS les composants impliqués dans le traitement.

**Contexte**: S'applique à TOUS les Runtime Components (CRT-001 à CRT-015) et aux Applications Services via leurs logs. Essentiel pour le debugging, l'audit, et le tracing distribué.

**Règle**: Chaque requête entrante se voit assigner un correlation_id (UUIDv7) au tout début du traitement. Ce correlation_id est propagé à travers TOUS les composants implicaties : TransactionCoordinator (scopes), EventDispatcher (events handlers), RetryPolicy (retry attempts), HealthMonitor (polling cycles). Aucune log entry critique ne doit être écrite sans correlation_id.

**Application**:
- **Correlation ID Generation** : généré au début de chaque requête par l'API layer/gateway. UUIDv7 pour sorting temporel naturel et facilité de debugging chronologique. Stocké dans le contexte AsyncLocalStorage du runtime hôte. Le correlation_id est propagé implicitement via le thread-local / async-context — aucun composant n'a besoin de le passer explicitement en paramètre.
- **Universal Propagation** : chaque Runtime Component lit le correlation_id du contexte courant ET l'insère dans TOUS ses logs structurels au format JSON avec les champs obligatoires : `{"correlation_id": string, "component": "CRT-NNN", "phase": "init|operation|shutdown|health", "status": "started|success|error|cancelled", "duration_ms": number}`. Aucun log CRT ne doit être écrit sans ces champs.
- **Health Monitor Scope Correlation** : chaque polling cycle du HealthMonitor a SON PROPRE correlation_id dérivé du parent : prefixé `hm-{cycle_number}` où cycle_number est un counter monotonique incrémenté à chaque poll. Les health check results incluent ce correlation_id `hm-N`, permettant de correler les polls avec les événements d'applications environnants.
- **Saga Scope Correlation** : chaque saga execution a un correlation_id DERIVÉ du correlation_id de la requête initiale, suffixé avec le nom du pattern : `{parent_correlation_id}-saga:{pattern_name}:{step_index}`. Exemple : `7c39e9f0-saga:linear:2`. Les compensations inheritent ce même correlation_id avec suffix `_compensate` : `7c39e9f0-saga:linear:2_compensate`.
- **Audit Integration** : les entries d'audit (CRT-014) incluent le correlation_id de la requête qui les a générées. Permet de relier une audit entry à sa requête parent via un filtre Diagnostics. Schema : `{ action, entityType, entityId, userId, orgId, correlationId, timestamp, beforeState: JSON|null, afterState: JSON|null }`.
- **Error Stack Trace Correlation** : lorsqu'une erreur survient, le stack trace complet inclut le correlation_id en première ligne. Format d'erreur structuré : `{ error_type, error_code, message, stack_trace, correlation_id, request_id, timestamp, component }`. Ce format permet le filtering et la recherche rapide d'erreurs par correlation_id dans les logs aggregés.
- **Shutdown Traceability** : pendant le shutdown (OR-012), toutes les entries de log du drain utilisent le correlation_id spécial `shutdown-{signal_type}` (ex : `shutdown-SIGTERM`). Cela permet de distinguer les logs de shutdown des logs opérationnels normaux dans les logs agrégés.
- Exemple concret complet : Requête `CreateTransaction` avec correlation_id `7c39e9f0-a1b2`. Flow loggé : `[7c39e9f0-a1b2][CRT-015][resolve_org][org_id=org-abc]` → `[7c39e9f0-a1b2][CRT-003][begin_txn][scope=ResourceAggregate]` → `[7c39e9f0-a1b2][CRT-003][commit][status=success,duration=12ms]` → `[7c39e9f0-a1b2][CRT-004][dispatch:ResourceCreated][handlers_planned=2,handlers_started=2]` → `[7c39e9f0-a1b2-hm-847][CRT-007][health_check][port=CachePort,status=HEALTHY,duration=2ms]` → `[7c39e9f0-a1b2][CRT-014][audit][action=ResourceCreated,entity=Transaction,event_id=e-123]` → `[7c39e9f0-a1b2][CRT-008][metrics_update][requests_total=15235]`.

**Violation Types**:
- **MissingCorrelationID**: Une log entry critique (BEGIN, COMMIT, ERROR, DISPATCH, CANCEL) est écrite SANS field `correlation_id`. Détection par grep sur les patterns de logger.info(), logger.error(), logger.warn() dans le code CRT — chaque call doit inclure `{ correlation_id: ... }` dans son payload.
- **CorrelationDrift**: Le correlation_id change en cours de traitement (pas propagé correctement entre composants ou entre handlers asynchrones). Même requête apparaît avec DIFFÉRENTS correlation_id dans les logs successifs. Causé par un switch de thread sans propagation du contexte.
- **LostAsyncContext**: Un handler d'événement asynchrone (EventDispatcher handler N executed in a Promise/async callback) exécute SANS le correlation_id de la requête parent. Causé par un handler qui ne capture pas le contexte AsyncLocalStorage au moment de la registration ou qui utilise un `setTimeout`/`setImmediate` coupant le contexte async.
- **NonStructuralLogs**: Un Runtime Component utilise un format de log non-structuré (string simple au lieu de JSON). Empêche le parsing machine et la recherche par correlation_id. Tous les logs CRT doivent être au format JSON structuré obligatoire.

**Verifiable Assertion**: (1) Grep pour TOUS les calls logger.info/logger.error/logger.warn/logger.debug dans chaque CRT → vérifier qu'il n'y A AUCUN call sans `correlation_id:` ou `{ correlation_id: ... }` dans le payload JSON. Chaque call de log doit passer par un wrapper `logWithContext()` qui injecte automatiquement le correlation_id courant. (2) Lancer une requête API avec un correlation_id connu et traquer ce correlation_id à travers TOUT le systeme via grep sur les logs produits. Tous les composants impliqués (CRT-003, CRT-004, CRT-014, CRT-015) doivent logguer avec CE MEME correlation_id. Aucun drift autorisé. (3) Pour les handlers asynchrones d'EventDispatcher (Promise-based, async/await), vérifier qu'ils capturent le correlation_id du contexte parent au moment de leur registration (avant l'await). Test d'intégration : lancer un event avec 3 handlers async → vérifier que les 3 handlers utilisent le même correlation_id parent. (4) Vérifier que les logs ne sont PAS en format string brut (ex : `logger.info("Starting transaction")`) mais en format structuré JSON (ex : `logger.info({ correlation_id: "...", component: "CRT-003", phase: "operation", status: "started" })`).

**Related Components**: CRT-008 (Diagnostics — central logging infrastructure), CRT-003 (TransactionCoordinator — saga correlation IDs), CRT-004 (EventDispatcher — handler propagation), CRT-007 (HealthMonitor — polling correlation IDs), CRT-014 (AuditEnabler — audit correlation IDs)

---

### OR-014: Resource Cleanup Guarantee

**Description**: À chaque operation (successful ou failed), TOUS les resources acquis pendant l'operation doivent être libérés, que ce soit par cleanup explicite ou par RAII/try-finally.

**Contexte**: S'applique à TOUS les Runtime Components qui acquièrent des ressources limitées : DB connections, file descriptors, memory buffers, socket connections, locks, caches.

**Règle**: Chaque operation d'acquisition de resource doit avoir un paired release dans un block finally/defer/cleanup. Aucune resource ne peut être acquise sans un cleanup planifié. Les resources non-releasees sont traçables dans les logs Diagnostics et trigger une alerte si le leak count dépasse 0 sur une période de 60 secondes.

**Application**:
- **Try-Finally Pattern (Explicit Release)** : chaque acquisition de resource est suivie IMMANQUABLEMENT d'un finally block qui garantit la release. Pattern obligatoire : `try { const conn = pool.acquire(); /* use conn */ } finally { if (conn) conn.release(); }`. Le `if (conn)` defensive check previent les NPE si l'acquisition elle-même a échoué.
- **No Implicit Release via GC** : la garbage collection NE LIBÈRE JAMAIS les resources acquises explicitement (DB connections, file descriptors, socket handles, mutex locks). Ces resources doivent être explicitement released par le code applicatif. Le garbage collector peut collecter l'objet JavaScript/Java mais pas libérer le handle OS sous-jacent.
- **Diagnostic Resource Accounting** : le Diagnostics service (CRT-008) maintient un compteur `acquired_resources_total` et un compteur `released_resources_total`. Chaque resource acquise est registrée avec `{ correlation_id, resource_type: "db_connection"|"file_descriptor"|"socket"|"mutex", acquired_at: ISO8601 }`. Chaque release réduit le compteur et loggue `{ correlation_id, resource_type, duration_ms }`. À tout instant, `active_resources = acquired - released`. Si `active_resources > threshold` (configurable via ConfigurationPort, default 100) → alerte WARN dans CRT-007 HealthMonitor.
- **Leak Detection Window** : les resources actives sont contrôlées périodiquement (toutes les 60s par le HealthMonitor CRT-007 via un health check dédié `check_resource_leaks`). Si une ressource est active depuis > 120 secondes (double du timeout grace period, configurable) → flagged comme leak suspect. Les leaks suspects sont loggués au niveau ERROR avec full correlation_id et stack trace.
- **Resource Type Classification** : toutes les resources runtime sont classées par type : (a) DB Connection (transient, auto-retryable), (b) File Descriptor (persistent per-request), (c) Socket Handle (network-bound), (d) Mutex/Lock (scope-bound), (e) Memory Buffer (allocation-bound). Chaque type a sa propre politique de monitoring et son propre seuil d'alerte.
- Exemple concret : Transaction scope dans WorkflowService.ApproveTransaction acquiert une DB connection via RepositoryPort. Le begin() de la transaction accomplit l'acquit de connection. Le commit() ou rollback() de la transaction retourne la connection au pool. Le finally block du scope assure que la connection est retournée au pool MÊME SI une exception est lancée entre begin et commit/rollback. Si le finally block lui-même échoue → log ERROR avec correlation_id complet, mais le cleanup continue vers le下一个 scope. Le leak counter Incrémente dans `diagnostics.active_resources` si la connection n'est pas releasee dans les 120 secondes suivantes.

**Violation Types**:
- **ResourceAcquiredWithoutCleanupPlan**: Une resource est acquise mais aucun block finally/defer/cleanup ne la release. Detected par analyse statique : chaque acquire() doit avoir un matching release() dans un finally.
- **ReleasedTwice**: Une resource est releasee deux fois → peut causer des UB (undefined behavior) ou crashes. Detected par instrumentation des releases.
- **NeverReleased**: Une resource acquise n'est jamais releasee, même après expiration du timeout. Detected par monitoring Diagnostics sur 60 secondes.

**Verifiable Assertion**: (1) Analyse statique AST : pour chaque call `acquire()`, `open()`, `lock()`, `connect()`, `alloc()` dans le code CRT, vérifier qu'il y a UN matching `release()`, `close()`, `unlock()`, `disconnect()`, `dealloc()` CORRESPONDANT dans un block finally/defer/cleanup adjacent. Le call de release doit être au même niveau d'imbracation que l'acquisition, pas en dehors. (2) Runtime monitoring : lancer l'application avec une charge normale soutenue (100 requêtes/sec pendant 60 secondes) et mesurer le leak_counter diaga (CRT-008.metrics.resource_leaks) à la fin de la période. Doit être == 0. Si > 0 → violation active resource leak. (3) Tester avec un handler qui lance une exception non attrapée → vérifier que TOUS les resources acquises dans le handler sont quand même releasees via le finally block (tester avec des mocks qui comptent les releases). (4) Grep pour les patterns `pool.acquire();` sans suivi de `} finally {` → violation potentielle.

**Related Components**: Tous les CRTs qui acquièrent des resources. Surtout CRT-003 (DB connections), CRT-009 (file descriptors pour Scheduled jobs), CRT-004 (socket connections pour event bus).

---

### OR-015: Diagnostics Completeness

**Description**: Les Diagnostics (CRT-008) doivent fournir UNE vue complète et cohérente de l'état du Runtime à TOUT moment, sans latence supérieure à 100ms pour un snapshot complet.

**Contexte**: S'applique uniquement au **Diagnostics service (CRT-008)**. Les endpoints `/health`, `/metrics`, `/debug/dump` sont les points d'accès publique aux diagnostics.

**Règle**: Le Diagnostics service maintient un état interne consolidé (memory-resident, jamais persisté) qui reflète l'état actuel de TOUT le Runtime. Un snapshot complet (toutes les métriques, tous les health checks, toutes les stats de retry/idempotence) est disponible en < 100ms. Les données exposées ne contiennent JAMAIS de données sensibles (passwords, tokens, PII). Les diagnostics sont toujours read-only — ils ne peuvent pas modifier l'état de l'application.

**Application**:
- **Memory-Resident RuntimeState** : le Diagnostics maintient un objet JavaScript `RuntimeState` en mémoire pure (jamais persisté sur disk). Structure : `{ health: { overview: { [port]: HEALTHY|DEGRADED|UNHEALTHY }, individual: { [port]: HealthCheckResult } }, metrics: { uptime_seconds, requests_total, errors_total, events_dispatched, retry_attempts, idempotent_hits, sagas_running, sagas_completed, sagas_compensated, resource_leaks, active_connections }, retries: { by_type: { event_publish: { total, successes, failures, dlq_placed } }, last_retry: ISO8601|null }, idempotence: { active_keys, hits_total, misses_total }, sagas: { running: number, completed: number, compensated: number, failed: number }, shutdown: { in_progress: boolean, phase: string, start_time: ISO8601|null } }`. Cet objet est mis à jour par TOUS les autres CRTs via des callbacks synchones non-blockings.
- **Snapshot Latency SLA** : un appel à `diagnostics.snapshot()` doit retourner une deep copy du RuntimeState EN < 100ms p99. Testé au startup dans la Phase 106 : si le premier snapshot prend > 100ms → le port HealthMonitor correspondant est marqué DEGRADED (pas UNHEALTHY car les diagnostics ne sont pas critiques pour la fonctionnalité, mais la performance degradée est signalée). Le benchmark est exécuté à chaque cycle de health check.
- **No Sensitive Data Inclusion** : les données exposées EXCLuent systématiquement et irrévocablement : passwords (tout champ contenant 'password', 'secret', 'credential'), API keys (champ contenant 'api_key', 'token', 'authorization'), user PII (champ contenant 'email', 'phone', 'ssn', 'name' dans les payload d'events), content hashes (SHA256 de fichiers ou de documents), encrypted blob data. Seul les metadata de performance (timestamp, duration, status_code, error_code) sont inclus. La filtering est appliquée à NIVEAU SCHEMA — pas à niveau de valeur — donc aucun filtrage value-based sujet aux erreurs.
- **Read-Only Endpoints Guarantee** : les endpoints `/health`, `/metrics`, `/debug/dump` sont strictement en lecture seule. Aucun endpoint de diagnostics n'accepte de méthodes POST, PUT, PATCH, ou DELETE. Le Router HTTP des Diagnostics est configuré avec `methods: ['GET']` uniquement. Toute tentative de mutation via un endpoint de diagnostic déclenche une erreur E-405-015 (method not allowed on diagnostics).
- **Consistent Snapshot (Temporal Consistency)** : le snapshot retourne une vue consistent — toutes les métriques reflètent le même point dans le temps T. Implémenté via un lock spin (acquit < 1ms) pendant la copie deep : aucune métrique n'est mise à jour pendant la durée de la copie. Pas de snapshot qui mélange état T1 (metrics) et état T2 (health) d'une autre poll.
- **Diagnostic Sampling** : les dumps complets (`/debug/dump`) ne sont jamais auto-générés en continu (coût trop élevé). Ils sont triggered SOUS DEMANDE via GET /debug/dump ou par le HealthMonitor toutes les 5 minutes (auto-dump minimal, sans payloads d'events). L'auto-dump contient seulement les counts et summaries, jamais les payloads bruts.
- Exemple concret complet : `GET /debug/dump` répond avec `{"uptime_s": 3600, "requests_total": 15234, "errors_total": 12, "events_dispatched": 8451, "retry_attempts": 234, "idempotent_hits": 567, "sagas_running": 0, "sagas_completed": 342, "sagas_compensated": 3, "sagas_failed": 1, "resource_leaks": 0, "active_db_connections": 4, "total_db_connections_pooled": 20, "health_overview": {"Database": "HEALTHY", "EventBus": "HEALTHY", "Clock": "HEALTHY", "Cache": "HEALTHY", "FileStorage": "HEALTHY", "Search": "HEALTHY", "Notification": "DEGRADED", "Scheduler": "HEALTHY", "Audit": "HEALTHY", "IdentityProvider": "HEALTHY"}, "dlq_entries_pending": 0, "idempotent_active_keys": 847}`. Zéro password, zéro token, zero contenu de transaction, zero donnée utilisateur.

**Violation Types**:
- **SensitiveDataExposure**: Un endpoint de diagnostics expose des données sensibles (password, API key, user PII, document hash). Violation directe et critique de BR-ID-001 (constitutionnel). Détectable par grep schema patterns (`password`, `secret`, `token`, `api_key`) sur les champs retournés par `snapshot()`.
- **WriteViaDiagnostics**: Un endpoint de diagnostics permet une modification d'état (ex : `POST /debug/dump?action=restart`). Les diagnostics sont IREVOCALEMENT read-only. Toute mutation d'état doit passer par les Application Services normaux.
- **SlowSnapshot**: Un snapshot complet prend > 100ms en p99. Causé par une collecte synchrone de données trop volumineuses, un deep copy inefficace, ou des locks compétitifs qui bloquent la copie. Le HealthMonitor signale ce problème comme DEGRADED.
- **InconsistentView**: Un snapshot montre des métriques provenant de points temporels différents (ex : `uptime_seconds` = T1 mais `requests_total` = T2 après un reset). Causé par une acquisition de locks non atomique pendant le deep copy.
- **SelfAuditViolation**: Le Diagnostics écrit une entry d'audit pour lui-même (audit de l'audit). Violation de NB-PERSIST-007 (NB-AUDIT-007 constitutionnel : AuditAggregate ne s'audite PAS lui-même).

**Verifiable Assertion**: (1) Grep pour les patterns de données sensibles dans les champs exposés par Diagnostics : `password`, `secret`, `token`, `api_key`, `hash`, `credential`, `authorization`. Aucun de ces mots ne doit apparaître dans les CLÉS (pas les valeurs) du JSON retourné par `snapshot()` ou les endpoints `/health`, `/metrics`, `/debug/dump`. (2) Benchmark rigoureux : appeler `diagnostics.snapshot()` 100 times consécutifs avec load moyen, mesurer le p99 latency via performance.now(). Doit être < 100ms. Si p99 > 100ms → violation slow snapshot. (3) Tester qu'aucun POST/PUT/PATCH n'est accepté sur `/health`, `/metrics`, `/debug/dump` → vérifier que tous retournent 405 Method Not Allowed. (4) Valider que le `RuntimeState` est snapshoté avec un spin lock (acquit < 1ms) autour du deep copy — grep pour `lock` ou `mutex` ou `Atomic` dans le code CRT-008. (5) Vérifier que le Diagnostics n'écrit JAMAIS vers AuditPort (pas d'appel à `auditPort.log()` dans CRT-008) — NB-PERSIST-007 constitutionnel.

**Related Components**: CRT-008 (Diagnostics — owner only), CRT-007 (HealthMonitor — health data provider), CRT-012 (RetryPolicy — retry stats provider), CRT-013 (IdempotencyManager — idempotence stats provider), CRT-014 (AuditEnabler — audit summary)

---

## MATRICE DE COUVERTURE COMPLEMENTAIRE

Les règles OR-013, OR-014, OR-015 sont des règles transversales qui s'appliquent à TOUS les composants du Runtime. Elles ne dépendent d'aucune règle précédente mais sont consommées par tous.

| Règle | Type | Scope d'Application | Impact Non-Réspect |
|-------|------|---------------------|-------------------|
| OR-013: Logging Traceability | Observabilité | Tous les CRTs | Debugging impossible post-mortem |
| OR-014: Resource Cleanup Guarantee | Stabilité | Tous les CRTs avec resources | Memory/connection leak → degradation progressive |
| OR-015: Diagnostics Completeness | Conformité | CRT-008 uniquement | Perte de visibilité opérationnelle |

Les 3 premières catégories de règles (OR-001 à OR-012) sont **blockantes** : leur violation entraîne une erreur critique pendant l'exécution. Les 3 dernières catégories (OR-013 à OR-015) sont **dégrada ntes** : leur violation ne bloque pas l'application mais dégradent progressivement la capacité de monitoring et debugging.

---

## MATRICE DE TRAÇABILITÉ RTS-003

| Règle | Doc Source Principal | RTS-001 Component | RTS-002 Phase | ASS-004 Link | Type | Blocking? |
|-------|---------------------|-------------------|--------------|-------------|------|-----------|
| OR-001 | DOC-000 §6, PAS-003 DR-006 | CRT-001, CRT-002 | Phase 103 | N/A | Assemblage | OUI |
| OR-002 | DOC-000 Regle 1 | Tous les CRTs | Phase 103/104 | N/A | Injection | OUI |
| OR-003 | ASS-003, DOC-012 | CRT-003 | Phase 107 | Tous patterns | Transaction | OUI |
| OR-004 | DOC-014, DOC-015 | CRT-004 | Phase 107 | Event-driven | Événements | OUI |
| OR-005 | BR-SYNC-003, BR-NOT-004 | CRT-012 | Phase 107 | Todos | Retry | OUI |
| OR-006 | INV-004, SYNC-004 | CRT-013 | Phase 107 | Offline sync | Idempotence | OUI |
| OR-007 | DOC-015 Invariants | CRT-003, CRT-009 | Phase 107 | N/A | Concurrency | OUI |
| OR-008 | DOC-015, LV-003 | CRT-003, CRT-004 | Phase 107 | Saga pattern | Cancellation | OUI |
| OR-009 | ASS-004 (matrice complète) | CRT-003 | Phase 107 | ALL interactions | Coordination | OUI |
| OR-010 | INV-004, DR-009, RN-008 | CRT-015 | Phase 106/107 | ALL org-scoped | Tenant | OUI |
| OR-011 | RTS-002 LV-001, LV-009 | CRT-006, CRT-010 | Phase 100-106 | N/A | Determinisme | OUI |
| OR-012 | RTS-002 LV-003, LV-004, LV-005 | CRT-011, CRT-006 | Phase 108-110 | N/A | Shutdown | OUI |
| OR-013 | DOC-001, DOC-000 | Tous les CRTs | Phase 107 | N/A | Observabilité | NON |
| OR-014 | DOC-000 Regle 2 | Tous les CRTs | Phase 107 | N/A | Stabilité | NON |
| OR-015 | BR-ID-001, NB-PERSIST-007 | CRT-008 | Phase 106-107 | N/A | Conformité | NON |

---

## NOTE SUR LA VALIDATION DES RÈGLES BLOCKING vs DÉGRADANTES

Les règles RTS-003 sont divisées en deux catégories selon leur impact sur la disponibilité de l'application :

- **Règles Blocking (OUI)** : leur violation entraîne un crash immédiat ou une corruption de données. Ces règles sont vérifiées au Build Time et Runtime. Une violation bloque le déploiement.
- **Règles Dégradantes (NON)** : leur violation ne bloque pas l'application mais dégrade progressivement sa capacité de monitoring et debugging. Ces règles sont vérifiées Runtime et Post-Mortem. Une violation trigger une alerte HealthMonitor DEGRADED mais pas un exit.

Cette distinction permet de prioriser les corrections : les violations blocking sont P0 (correctif mandatory avant tout merge), les violations dégradantes sont P2 (correctif recommandé dans le prochain sprint).

---

## RÉSUMÉ EXÉCUTIF DES 15 RÈGLES

| Règle | Nom court | Domaine | Composant clé | Impact violation |
|-------|-----------|---------|--------------|-----------------|
| OR-001 | Assembly Order | Assemblage | CRT-002 DependencyResolver | Exit boot (wrong init order) |
| OR-002 | Constructor DI | Assemblage | Tous CRTs | Compile-time error (broken deps) |
| OR-003 | Transaction Boundaries | Transactions | CRT-003 TxCoordinator | Data corruption / orphaned writes |
| OR-004 | Event Guarantee | Événements | CRT-004 EventDispatcher | Lost events / duplicate processing |
| OR-005 | Retry Policy | Retry | CRT-012 RetryPolicy | Infinite loops / slow recovery |
| OR-006 | Idempotency | Idempotence | CRT-013 IdempotencyManager | Double charges / duplicate records |
| OR-007 | Concurrency | Transactions | CRT-003 CRT-009 | Deadlocks / data races |
| OR-008 | Cancellation | Coordination | CRT-003 CRT-004 | Orphaned partial commits |
| OR-009 | Cross-Aggregate | Coordination | CRT-003 TxCoordinator | Wrong pattern execution |
| OR-010 | Tenant Context | Coordination | CRT-015 TenantContextProvider | Cross-tenant data leak |
| OR-011 | Startup Determinism | Cycle de vie | CRT-006 CRT-010 | Non-reproducible behavior |
| OR-012 | Shutdown Drain | Cycle de vie | CRT-011 ShutdownPipeline | Data loss on shutdown |
| OR-013 | Logging Traceability | Observabilité | CRT-008 Diagnostics | Impossible debugging |
| OR-014 | Resource Cleanup | Observabilité | Tous CRTs | Memory/connection leaks |
| OR-015 | Diagnostics Completeness | Conformité | CRT-008 Diagnostics | Blind operational monitoring |

---

## ENFORCEMENT STRATEGY

Les règles RTS-003 sont enforcees à trois niveaux avec des outils distincts pour chaque niveau :

| Niveau | Mechanisme | Quando | Tooling | Règles couvertes |
|--------|-----------|--------|---------|-----------------|
| Build Time | Analyse statique AST + grep patterns | Avant compilation (CI pipeline) | Scripts d'analyse TypeScript/JavaScript + ESLint rules | OR-001, OR-002, OR-007, OR-010, OR-014 |
| Runtime | Health checks + monitoring continu | En continu (polling 30s défaut) | CRT-007 (HealthMonitor), Diagnostics metrics | OR-005, OR-006, OR-007, OR-011, OR-013, OR-014, OR-015 |
| Post-Mortem | Audit log review après incident | Après incident critique ou periodic audit | CRT-014 (AuditEnabler) entries + CRT-008 endpoint `/debug/audit` | OR-003, OR-004, OR-008, OR-009, OR-010, OR-012, OR-013 |

Chaque règle a un **Verifiable Assertion** exécutable automatiquement (grep, AST analysis, ou test automatisé). Aucune règle ne repose exclusivement sur la documentation, les bonnes pratiques, ou la discipline humaine. Une règle sans assertion vérifiable automatique est catégorisée comme un *goal* (OR-XXX-G), pas comme une règle (*rule* OR-XXX).

---

## CHECKLIST DE VALIDATION RTS-003

Avant qu'un build ne soit considéré conforme aux règles RTS-003, TOUS les points suivants doivent passer :

| # | Vérification | Commande/Outil | Règles | Status |
|---|-------------|---------------|--------|--------|
| 1 | DependencyResolver graphe sans cycle | Kahn's algorithm + lint rule | OR-001, OR-002 | [ ] |
| 2 | Chaque CRT injecte ses dépendances par constructeur | AST parse constructeurs | OR-001, OR-002 | [ ] |
| 3 | Aucun adapter concrete importé dans un CRT | Grep imports *.adapter | OR-002 | [ ] |
| 4 | Tous les saga steps ont une compensation | Croiser ASS-004 + code sagas | OR-003, OR-009 | [ ] |
| 5 | Event publication APRÈS commit uniquement | Order tracing | OR-003, OR-004 | [ ] |
| 6 | At-least-once delivery testée avec handler failure | Simulation handler 5x fail | OR-004 | [ ] |
| 7 | Retry backoff exponentiel mesuré | Test handler fail + mesure delays | OR-005 | [ ] |
| 8 | Domain errors non retryés | Test E-422 → no retry | OR-005 | [ ] |
| 9 | Idempotence double-request sans double-execution | Same request_id × 2 | OR-006 | [ ] |
| 10 | Multi-tenant isolation org_id | request_id same across orgs | OR-006, OR-010 | [ ] |
| 11 | Optimistic locking version column present | SQL introspection tables | OR-007 | [ ] |
| 12 | No blocking reads (FOR UPDATE / FOR SHARE) | Grep SELECT.*FOR | OR-007 | [ ] |
| 13 | Cancellation trigger → compensation executes | Saga 3 steps + cancel after step 1 | OR-008 | [ ] |
| 14 | All cross-aggregate triggers mapped in ASS-004 | Cross-reference events | OR-009 | [ ] |
| 15 | org_id from token only, never from body | JWT vs body test | OR-010 | [ ] |
| 16 | Deterministic startup (3 runs identical) | Compare bootstrap logs | OR-011 | [ ] |
| 17 | Grace period drain before connection close | SIGTERM + active requests | OR-012 | [ ] |
| 18 | Reverse init order on shutdown | Compare init vs shutdown order | OR-012 | [ ] |
| 19 | Correlation ID propagates through all CRTs | Single request trace | OR-013 | [ ] |
| 20 | Resource leak counter == 0 after 60s load | 100 req/s × 60s + check counter | OR-014 | [ ] |
| 21 | No sensitive data in diagnostic endpoints | Schema grep for password/token | OR-015 | [ ] |
| 22 | Snapshot latency < 100ms p99 | 100× snapshot() benchmark | OR-015 | [ ] |

Tous les [ ] doivent être cochés (coché = test passé) avant merge de toute modification affectant le Runtime.

---

## DÉPENDANCES ENTRE RÈGLES RTS-003

Certaines règles dépend sémantiquement d'autres règles RTS-003. Le respect de la règle en amont est une précondition pour le respect de la règle en aval :

```
OR-001 (Assembly Order) → précondition de OR-002, OR-011, OR-012
OR-002 (Dependency Injection) → précondition de toutes les autres règles
OR-003 (Transaction Boundaries) → précondition de OR-008 (compensation)
OR-004 (Event Dispatch) → consomme OR-005 (retry policy)
OR-005 (Retry Policy) → utilisé par OR-004, OR-006, OR-012
OR-006 (Idempotency) → consomme OR-010 (org_id context)
OR-007 (Concurrency) → complémentaire de OR-003 (transaction isolation)
OR-008 (Cancellation) → consomme OR-003 (rollback) et OR-009 (compensation)
OR-009 (Cross-Aggregate) → consomme OR-003 (saga), OR-004 (events)
OR-010 (Tenant Context) → précondition de OR-006, OR-009, OR-013
OR-011 (Startup Determinism) → précondition de OR-001 verification
OR-012 (Shutdown Drain) → consomme OR-003, OR-004, OR-008, OR-009
OR-013 (Logging) → consommée par toutes les règles (traceability)
OR-014 (Resource Cleanup) → complémentaire de OR-012 (shutdown cleanup)
OR-015 (Diagnostics) → consommée par OR-007 (monitoring), OR-014 (leak detection)
```

Toute modification d'une règle en amont dans cette chaîne doit être validée par les verifiable assertions de TOUTES les règles en aval qui en dépendent.

---

## ENFORCEMENT STRATEGY (détails)

Les règles RTS-003 sont enforcees à trois niveaux avec des outils distincts pour chaque niveau :

| Niveau | Mechanisme | Quando | Tooling | Règles couvertes |
|--------|-----------|--------|---------|-----------------|
| Build Time | Analyse statique AST + grep patterns | Avant compilation (CI pipeline) | Scripts d'analyse TypeScript/JavaScript + ESLint rules | OR-001, OR-002, OR-007, OR-010, OR-014 |
| Runtime | Health checks + monitoring continu | En continu (polling 30s défaut) | CRT-007 (HealthMonitor), Diagnostics metrics | OR-005, OR-006, OR-007, OR-011, OR-013, OR-014, OR-015 |
| Post-Mortem | Audit log review après incident | Après incident critique ou audit periodic | CRT-014 (AuditEnabler) entries + CRT-008 endpoint `/debug/audit` | OR-003, OR-004, OR-008, OR-009, OR-010, OR-012, OR-013 |

Chaque règle a un **Verifiable Assertion** exécutable automatiquement (grep, AST analysis, ou test automatisé). Aucune règle ne repose exclusivement sur la documentation, les bonnes pratiques, ou la discipline humaine. Une règle sans assertion vérifiable automatique est catégorisée comme un *goal* (OR-XXX-G), pas comme une règle (*rule* OR-XXX).

---

## DÉPENDANCES CROISÉES AVEC LES DOCUMENTS CANONIQUES

| Document | Liens avec RTS-003 | Règles concernées |
|----------|-------------------|------------------|
| DOC-000 | Hiérarchie des couches → définit le flux descendant (OR-002) et les régles non négociables du Runtime | OR-001, OR-002, OR-014 |
| DOC-001 | Catalogue des 57 elements → corrobore le mapping correlation_id dans OR-013 | OR-013 |
| DOC-012 | 13 Aggregates, boundaries → définit les limites transactionnelles pour OR-003 | OR-003, OR-007, OR-009 |
| DOC-014 | Commandes et Evenements → define les mappings EventDispatcher pour OR-004 | OR-004, OR-009 |
| DOC-015 | 58 Invariants → OR-007 (optimistic locking), OR-010 (INV-004), OR-008 (WF-005) | OR-007, OR-008, OR-010 |
| DOC-017 | Persistence Model → version columns pour OR-007 optimistic locking | OR-007 |
| DOC-019 | Persistence Strategy → adapter selection pour OR-010 tenant scoping | OR-007, OR-010 |
| PAS-001 | 17 Ports → dépendances définies pour OR-002 constructor injection | OR-002, OR-010 |
| PAS-003 | Dependency Rules (DR-001..DR-012) → DR-006 impose l'ordre topologique (OR-001), DR-009 impose org_id scoping (OR-010) | OR-001, OR-010 |
| ASS-001 | 13 AppServices → consommateurs qui invoquent les règles transactionnelles | OR-003, OR-006, OR-009 |
| ASS-003 | Workflow Standard → définit les chemins read/write couverts par OR-006, OR-003 | OR-003, OR-006 |
| ASS-004 | Cross-Aggregate Coordination → matrice de patterns (OR-009), compensations (OR-003, OR-008, OR-009) | OR-003, OR-008, OR-009 |
| RTS-001 | Catalogue CRT-001..CRT-015 → dépendances de chaque composant pour OR-001, OR-002 | OR-001, OR-002 |
| RTS-002 | Phases 100-110 → context d'application pour OR-011 (startup), OR-012 (shutdown) | OR-011, OR-012 |
| BR-SYNC-003 | Retry max 5 constitutionnel → règle OR-005 retry limits | OR-005 |
| BR-NOT-004 | Notification retry → règle OR-005 notification retries | OR-005 |
| BR-ID-001 | Sensitive data exclusion → règle OR-015 diagnostics safety | OR-015 |
| INV-004 | Multi-tenant isolation → règle OR-010 tenant context | OR-010 |
| LV-001 à LV-010 | Lifecycle invariants → OR-011 (LV-001), OR-012 (LV-003, LV-004, LV-005) | OR-011, OR-012 |

---

## NOTES D'IMPLÉMENTATION POUR LE RUNTIME-SPECIFIER

Lors de la génération ou mise à jour de RTS-003, le runtime-specifier v1.0 doit respecter ces contraintes :

1. **Atomicité des modifications** : l'ajout d'une nouvelle règle OR-NNN doit inclure obligatoirement toutes les sections standard (Description, Contexte, Regle, Application, Violation Types, Verifiable Assertion, Related Components). Une section manquante rend la règle invalide.

2. **Numérotation continue** : les règles doivent être numérotées séquentiellement sans trou. L'insertion d'une règle au milieu du document nécessite le re-numérotage de TOUTES les règles suivantes.

3. **Traçabilité obligatoire** : chaque règle doit référencer au moins UN document canonique source dans sa section Contexte. Si aucune source canonique n'existe pour une règle, elle ne peut pas être ajoutée à RTS-003 — elle doit d'abord être documentée dans un autre document (RTC, INV, etc.).

4. **Verifiable Assertion executable** : chaque assertion vérifiable doit pouvoir être implémentée comme un script autonome sans dépendre de l'état runtime de l'application. Les assertions nécessitant l'exécution de l'application entière (tests d'intégration, benchmarks) sont acceptées mais marquées `[integration]` dans la documentation.

5. **Non-rétroactivité** : l'ajout d'une nouvelle règle à RTS-003 n'affecte PAS les règles existantes. Chaque règle est autonome et peut être validée indépendamment des autres.

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | runtime-specifier v1.0 | Création — 15 règles d'orchestration runtime pour Lumina v1 | COMPLIANT (trace vérifié contre RTS-001, RTS-002, ASS-004, DOC-000, DOC-014, DOC-015, INV-004, BR-SYNC-003) |

---

*Ce document definit 15 regles d'orchestration_runtime pour le Runtime Lumina. Ces regles sont executables automatiquement (verifiable assertions) et completement traceables vers les documents canoniques sources.*
