# Runtime Boundaries Specification — Lumina v1

**Doc ID:** RTS-004
**Version:** v1.0
**Statut:** SPÉCIFICATION RUNTIME DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-000", "DOC-012", "RTS-001", "ASS-005"]
**Transformation_rule :** "runtime-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit les **frontières absolues du Runtime Layer** de l'architecture Lumina. Il établit :

1. Ce que le Runtime **PEUT** faire (liste exhaustive d'autorisations)
2. Ce que le Runtime **NE PEUT JAMAIS** faire (liste exhaustive d'interdictions)
3. Les patterns d'implémentation **INTERDITS** dans le Runtime
4. Les mécanismes structurels qui **GARANTISSENT** la séparation des couches

Toutes les règles ci-dessous sont **vérifiables automatiquement** par analyse statique, grep pattern matching, ou test unitaire isolé. Aucune règle ne repose sur l'exécution de l'application entière pour être validée.

**Règle constitutionnelle fondamentale :** Le Runtime est LA COUCHE D'ASSEMBLAGE unique. Il connecte, orchestre, fait vivre — mais ne décide JAMAIS du comportement métier. Le "quoi assembler et dans quel ordre" appartient au Runtime ; le "comment chaque composant fonctionne" appartient aux Aggregates (DOC-012), Application Services (ASS-001), et Adapters (PAS-002).

---

## SECTION 1 : LE RUNTIME PEUT FAIRE

Liste exhaustive de TOUTES les actions que le Runtime EST formellement autorisé à entreprendre. Chaque item inclut l'action détaillée, le composant responsable (identifié CRT-NNN de RTS-001), et la règle qui l'autorise.

### 1.1 Assemblage et Infrastructure

| # | Action autorisée | Composant responsable | Règle source |
|---|------------------|---------------------|-------------|
| 1 | Assembler chaque Port a son Adapter concrete en suivant l'ordre topologique défini par DependencyResolver | CRT-001 CompositionRoot | RTS-001 CRT-001, PAS-002 |
| 2 | Résoudre les dépendances entre composants Runtime via tri topologique (Kahn's algorithm) | CRT-002 DependencyResolver | RTS-001 CRT-002, DR-006 |
| 3 | Créer toutes les instances de composants Runtime dans l'ordre correct au démarrage | CRT-001 CompositionRoot | RTS-001 CRT-001 §Responsabilités |
| 4 | Lier chaque Port (PAS-001) à sa catégorie d'Adapter concrete sans connaître l'implémentation | CRT-001 CompositionRoot | PAS-002, PAS-003 DR-004 |
| 5 | Exposer les 13 Application Services (ASS-001) aux couches extérieures (API gateway) | CRT-001 CompositionRoot | ASS-001, RTS-001 CRT-001 |
| 6 | Initialiser les 17 Ports avec leurs adapters selectionnés pendant la Phase 104 | CRT-010 StartupPipeline | RTS-001 CRT-010, PAS-001 |
| 7 | Configurer les mécanismes transversaux : RetryPolicy, IdempotencyManager, AuditEnabler | CRT-001 CompositionRoot | RTS-001 CRT-001 §Responsabilités |
| 8 | Valider l'assemblage complet au terme du StartupPipeline et EXIT si invalide | CRT-010 StartupPipeline | RTS-001 CRT-010 §Error Handling |
| 9 | Refuser tout composant non catalogué dans le graphe de dépendances | CRT-002 DependencyResolver | RTS-001 CRT-002, RN-005 |

### 1.2 Transactions et Coordination

| # | Action autorisée | Composant responsable | Règle source |
|---|------------------|---------------------|-------------|
| 10 | Gérer begin/commit/rollback des transactions intra-aggregate via TransactionManagerPort | CRT-003 TransactionCoordinator | RTS-001 CRT-003, PAS-001 Port-015 |
| 11 | Enregistrer et exécuter les actions compensatrices en cas d'échec cross-aggregate (Saga pattern) | CRT-003 TransactionCoordinator | RTS-001 CRT-003, ASS-004 |
| 12 | Assurer l'atomicité au niveau de l'Aggregate root (pas au-dela) | CRT-003 TransactionCoordinator | RTS-001 CRT-003, OR-003 |
| 13 | Gérer les timeouts transactionnels avec rollback automatique configurable | CRT-003 TransactionCoordinator | RTS-001 CRT-003, OR-003 §Application |
| 14 | Fournir un contexte transactionnel aux Application Services pour opérations cross-aggregate | CRT-003 TransactionCoordinator | RTS-001 CRT-003, OR-009 |
| 15 | Appliquer optimistic locking (version column check) sur toutes les données partagées | CRT-003 TransactionCoordinator | RTS-001 CRT-003, OR-007 |

### 1.3 Événements et Diffusion

| # | Action autorisée | Composant responsable | Règle source |
|---|------------------|---------------------|-------------|
| 16 | Recevoir les Domain Events des Application Services après persistence réussie | CRT-004 EventDispatcher | RTS-001 CRT-004, DOC-014 |
| 17 | Publier chaque événement vers tous les subscribers inscrits sur EventSubscriptionPort | CRT-004 EventDispatcher | RTS-001 CRT-004, OR-004 |
| 18 | Garantir la livraison at-least-once avec retry exponentiel max 5 fois | CRT-004 EventDispatcher / CRT-012 RetryPolicy | RTS-001 CRT-004, BR-SYNC-003 |
| 19 | Garantir l'ordre d'émission : handlers executés dans l'ordre de registration DOC-014 | CRT-004 EventDispatcher | RTS-001 CRT-004, OR-004 |
| 20 | Isoler les handlers : échec d'un handler ne bloque PAS les autres | CRT-004 EventDispatcher | RTS-001 CRT-004, OR-004 §HandlerIsolation |
| 21 | Router les événements vers les consommateurs definis dans DOC-014 (colonne "Consommateurs autorisés") | CRT-004 EventDispatcher | RTS-001 CRT-004, DOC-014, OR-009 |
| 22 | Placer les événements après 5 retries échouées dans une dead-letter queue persistante | CRT-004 EventDispatcher / CRT-012 RetryPolicy | RTS-001 CRT-004, OR-004 §DLQ |
| 23 | Ne JAMAIS modifier le payload d'un événement lors de la publication (immutabilité) | CRT-004 EventDispatcher | RTS-001 CRT-004, AUD-001 constitutionnel |

### 1.4 Configuration et Cycle de Vie

| # | Action autorisée | Composant responsable | Règle source |
|---|------------------|---------------------|-------------|
| 24 | Charger la configuration depuis fichiers, variables d'environnement, templates de défaut | CRT-005 ConfigurationLoader | RTS-001 CRT-005, CFG-001..004 |
| 25 | Valider le format de chaque setting (ISO 4217, IANA timezone, hex colors) | CRT-005 ConfigurationLoader | RTS-001 CRT-005, DOC-019 §2.12 |
| 26 | Appliquer les defaults du manifest/template pour toute cle manquante | CRT-005 ConfigurationLoader | RTS-001 CRT-005, CFG-004 |
| 27 | Orchestrer le cycle de vie complet : démarrage, execution, arret propre | CRT-006 LifecycleManager | RTS-001 CRT-006, LV-001 |
| 28 | Intercepter les signaux OS (SIGINT, SIGTERM) et déclencher ShutdownPipeline | CRT-006 LifecycleManager | RTS-001 CRT-006, OR-012 |
| 29 | Garantir un shutdown toujours propre (graceful) — jamais de kill brutal | CRT-006 LifecycleManager / CRT-011 ShutdownPipeline | RTS-001 CRT-006, LV-003 |
| 30 | Signaler READY uniquement quand tous health checks OK + StartupPipeline complété | CRT-006 LifecycleManager / CRT-010 StartupPipeline | RTS-001 CRT-006, OR-011 |

### 1.5 Monitoring, Diagnostic et Planification

| # | Action autorisée | Composant responsable | Règle source |
|---|------------------|---------------------|-------------|
| 31 | Interroger périodiquement tous les Points de Santé definis par les Ports | CRT-007 HealthMonitor | RTS-001 CRT-007, RTS-002 Phase 105 |
| 32 | Agreger les résultats individuels en un verdict global HEALTHY/DEGRADED/UNHEALTHY | CRT-007 HealthMonitor | RTS-001 CRT-007, OR-011 |
| 33 | Collecter et exposer les informations de diagnostic sans données sensibles | CRT-008 Diagnostics | RTS-001 CRT-008, BR-ID-001 |
| 34 | Fournir un dump d'état complet pour le debugging (structuré, machine-lisible) | CRT-008 Diagnostics | RTS-001 CRT-008, OR-015 |
| 35 | Planifier et executer des tâches periodiques (cron-like) defini dans les specs canoniques | CRT-009 Scheduler | RTS-001 CRT-009, DOC-014 |
| 36 | Fournir une source de temps canonique via ClockPort pour TOUTES les opérations temporelles | CRT-009 Scheduler | RTS-001 CRT-009, DR-010 |
| 37 | Exposer les programmes de planification pour le Diagnostics service | CRT-009 Scheduler | RTS-001 CRT-009 |

### 1.6 Retry, Idempotence et Audit

| # | Action autorisée | Composant responsable | Règle source |
|---|------------------|---------------------|-------------|
| 38 | Définir et appliquer des politiques de retry par type d'opération avec backoff exponentiel | CRT-012 RetryPolicy | RTS-001 CRT-012, BR-SYNC-003 |
| 39 | Distinguer erreurs transitoires (retry) des erreurs permanentes (no retry) par code erreur | CRT-012 RetryPolicy | RTS-001 CRT-012, OR-005 |
| 40 | Identifier chaque operation entrante avec un idempotency key et hasher par org_id | CRT-013 IdempotencyManager | RTS-001 CRT-013, INV-004 |
| 41 | Retourner le résultat cached si l'operation a déjà été executée avec la même clé | CRT-013 IdempotencyManager | RTS-001 CRT-013, OR-006 |
| 42 | Activer l'audit automatiquement pour TOUTES les operations d'écriture | CRT-014 AuditEnabler | RTS-001 CRT-014, ASS-NB-001 |
| 43 | Capturer before/after state pour chaque operation d'écriture (OLDNEW-002) | CRT-014 AuditEnabler | RTS-001 CRT-014, OLDNEW-002 constitutionnel |
| 44 | Garantir que l'audit ne bloque JAMAIS l'opération domaine (AUD-001 constitutionnel) | CRT-014 AuditEnabler | RTS-001 CRT-014, AUD-001 |

### 1.7 Contexte Multi-Tenant

| # | Action autorisée | Composant responsable | Règle source |
|---|------------------|---------------------|-------------|
| 45 | Résoudre l'org_id depuis le contexte d'authentication (IdentityProviderPort) | CRT-015 TenantContextProvider | RTS-001 CRT-015, INV-004 |
| 46 | Injecter org_id dans TOUTES les operations de lecture et d'écriture via les Ports | CRT-015 TenantContextProvider | RTS-001 CRT-015, PAS-003 DR-009 |
| 47 | Valider que l'org_id résolu correspond bien à celui de l'utilisateur authentifié | CRT-015 TenantContextProvider | RTS-001 CRT-015, INV-004 |
| 48 | Bloquer toute opération sans org_id résolu (erreur 401 Unauthorized) | CRT-015 TenantContextProvider | RTS-001 CRT-015, OR-010 |

**Total : 48 actions autorisées.** Chaque action est tracée vers au moins un composant RTS-001, une règle PAS-003, et un invariant constitutionnel.

---

## SECTION 2 : LE RUNTIME NE PEUT JAMAIS FAIRE

Liste exhaustive des interdictions absolues. Chaque interdiction inclut la formulation claire, l'impact si violée, et la règle constitutionnelle contre-violée.

| # | Interdiction | Impact si violée | Règle constitutionnelle contre-violée |
|---|-------------|-----------------|---------------------------------------|
| 1 | ❌ Contenir ou définir une règle métier — le Domaine seul possède la logique (la validation business, les state machines, les calculs financiers) | Corruption de la boundary domain/application ; logique business dupliquée et incohérente across layers | DOC-012 §2 (Domain owns all business rules), ASS-NB-001 (Domain Isolation), RN-001 |
| 2 | ❌ Modifier un invariant DOC-015 (Domain Invariant Registry) — les 58 invariants sont sacres et inaltérables | Violation fondamentale de cohérence ; les guards métier peuvent être bypassés | DOC-015 (Domain Invariant Registry), ASS-NB-002 (Invariant Preservation), INV-004 |
| 3 | ❌ Lire ou écrire directement dans la base de données — tout accès doit passer par RepositoryPort abstraction | Couplage technologique direct ; impossible de swap database ; violation DDD | PAS-003 DR-007 (Persistence Ignorance), ASS-NB-003 (No Direct Persistence), RN-001 |
| 4 | ❌ Bypass les Aggregate boundaries — chaque command/query doit passer par une Aggregate boundary method | Les Aggregates perdent leur rôle de guard d'intégrité ; multi-tenant isolation cassée | DOC-012 (Aggregate boundaries), ASS-NB-004 (No Aggregate Bypass), PAS-003 DR-001 |
| 5 | ❌ Inventer de nouveaux types d'événements Domain Events — seuls DOC-014 events sont autorisés | Le event bus reçoit des événements inconnus ; downstream consumers cassés | DOC-014 (Domain Command-Event Registry), PAS-003 DR-008, RN-006 |
| 6 | ❌ Dépendre dynamiquement de feature flags pour désactiver un Runtime Component — les 15 CRTs sont toujours créés | Comportement non-déterministe ; assemblage différent selon environnement ; violation OR-011 | OR-011 (Startup Sequence Determinism), RTS-001 CRT-002 Contrainsts |
| 7 | ❌ Injecter de la logique métier dans les Adapters — ports et adapters ne contiennent QUE de la technique (serialization, type-checking, retry) | Business logic spread across layers ; impossible to verify all guards centrally | PAS-003 DR-011 (No Business Logic in Ports/Adapters), RN-009 |
| 8 | ❌ Utiliser le pattern Service Locator pour résoudre des dépendances — injection constructeur UNIQUEMENT | Couplage indirect non-tracé ; impossible d'analyser statiquement le graphe de deps | OR-002 (Dependency Resolution Strategy), PAS-003 DR-004 |
| 9 | ❌ Modifiter le payload d'un événement lors de la publication — l'immutabilité est absolue | Consommateur voir des données altérées ; invariants DOC-015 bypassés silencieusement | AUD-001 constitutionnel, RTS-001 CRT-004, OR-004 |
| 10 | ❌ Bloquer une opération domaine sur la publication d'événements — event publishing est toujours asynchrone post-commit | Lenteur perçue par l'utilisateur ; violation offline-first ; blocage en mode disconnected | SYNC-004 constitutionnel, OR-004 (Post-commit Publication Only) |
| 11 | ❌ Accepter org_id en paramètre utilisateur direct — uniquement depuis le token d'authentication | Escalade de privilèges cross-tenant ; data leak entre organisations | INV-004 constitutionnel, PAS-003 DR-009, OR-010 |
| 12 | ❌ Exécuter des transactions cross-aggregate synchrones — préférer toujours le pattern Saga ou événementiel | Lock contention跨 aggregates ; single point of failure ; distributed transaction anti-pattern | ASS-NB-008 (Transaction Boundaries), OR-003, OR-009 |
| 13 | ❌ Hardcoder des valeurs de configuration — toujours passer par ConfigurationLoader (CRT-005) | Config non portable ; impossible d'override via environment ; violation de CFG-004 | RTS-001 CRT-005, DOC-019 §2.12 |
| 14 | ❌ Appeler directement une méthode d'un autre Aggregate depuis un Aggregate — coordonner via EventDispatcher ou Application Service | Circular dependencies ; broken Aggregate boundaries ; impossible test individual | PAS-003 DR-012 (Cross-Aggregate Coordination Via Events), OR-009 |
| 15 | ❌ Écrire dans AuditAggregate depuis lui-même (auto-audit de l'audit) — prévention de récursion infinie | Récursion infinie d'audit entries ; boucle sans fin ; crash par exhaustion mémoire | NB-PERSIST-007 constitutionnel, RTS-001 CRT-014 |
| 16 | ❌ Retried les erreurs de domaine (E-422 invariant violation, E-400 validation, E-403 auth) — les erreurs de domaine sont permanentes | Retry d'erreur logique = boucle infinie d'échecs ; perf dégradée ; logs polluted | RTS-001 CRT-012, OR-005 §NoRetryOnDomainErrors |
| 17 | ❌ Exposer des données sensibles (passwords, tokens, PII, hashes) via les diagnostics (/health, /metrics, /debug/dump) | Violation foudroyale de confidentialité ; non-conformité GDPR ; fuite de credentials | BR-ID-001 constitutionnel, RTS-001 CRT-008, OR-015 |
| 18 | ❌ Accepter des méthodes POST/PUT/PATCH/DELETE sur les endpoints de diagnostics — diagnostics sont IREVOCALEMENT read-only | Mutation d'état via endpoint de monitoring ; corruption non-tracée ; contournement des Application Services | OR-015 §ReadOnly Endpoints Guarantee, RTS-001 CRT-008 |
| 19 | ❌ Utiliser le system clock directement — toutes les timestamps doivent venir de ClockPort.now() via CRT-009 | Non-reproductibilité en test ; timestamps inconsistants ; violation DR-010 | DR-010 (Clock Source Unification), RTS-001 CRT-009 |
| 20 | ❌ Rétrograder un événement vers une dead-letter queue ET le re-retry automatiquement — risque de boucle infinie | Loop infini sur handler buggy ; saturation storage ; performance dégradée | OR-004 §DLQ (manual investigation only), RTS-001 CRT-004 |
| 21 | ❌ Modifier l'ordre topologique résolu par DependencyResolver — l'ordre est immuable après calcul | Ordre d'assemblage différent entre démarrages ; violation de déterminisme ; races conditionnelles aléatoires | RN-005, OR-001 (Assembly Order Enforcement), OR-011 |
| 22 | ❌ Créer des concepts nouveaux (Entités, Value Objects, Domain Services) non catalogués dans DOC-001 ou DOC-012 | Architecture drift ; undocumented elements ; perte de traçabilité complète | ASS-NB-005 (Concept Creation), DOC-001 Element Registry |
| 23 | ❌ Utiliser un backoff linéaire pour les retries — le backoff exponentiel est OBLIGATOIRE | Prévisibilité de debugging perdue ; patrons de retry non standardisés ; violation BR-SYNC-003 | RTS-001 CRT-012, OR-005 §ExponentialBackoff |
| 24 | ❌ Appliquer le retry sur les opérations Repository — les erreurs DB sont traitées différemment (0 retries) | Masquage de problèmes schema/data ; retry inutile sur erreur permanente | RTS-001 CRT-012, OR-005 (§Max retry par operation type) |

**Total : 24 interdictions absolues.** Chacune est tracée vers un invariant constitutionnel, une règle PAS-003, ou une règle RTS-003.

---

## SECTION 3 : PATTERNS D'IMPLÉMENTATION INTERDITS

Tableau exhaustif de TOUTES les pratiques d'implémentation interdites dans le Runtime Layer. Chaque entry spécifie le pattern, la category, un exemple concret interdit, l'alternative autorisée, et le mécanisme de détection.

### 3.1 Direct Database Access

| Pattern Interdit | Category | Exemple Interdit | Alternative Autorisée | Détection |
|------------------|----------|------------------|---------------------|-----------|
| Raw SQL queries | DirectDBAccess | `db.query("SELECT * FROM users WHERE id=$1")` | `repositoryPort.load(UserAggregate, id)` via RepositoryPort | grep `"SELECT"\|"INSERT"\|"UPDATE"\|"DELETE"` dans CRT files |
| ORM annotations | FrameworkDependence | `@Entity("users")`, `@Table(name="transactions")`, `@Column(type="uuid")` | Pure PO (Plain Object) passed through ports; schema defined in infrastructure layer only | grep `@Entity\|@Table\|@Column\|@ManyToOne` dans CRT/AppService files |
| Connection pool management | InfraCoupling | `pool.getConnection()`, `db.disconnect()`, `session.close()` | RepositoryPort abstraction manages connections internally; CRT only calls `save/load/delete` | grep `getConnection\|pool.acquire\|disconnect` dans CRT files |
| Query builder chains | DirectDBAccess | `builder.select("users").where("org_id", orgId).orderBy("created_at")` | `searchPort.search(UserAggregate, { orgId, orderBy: "created_at" })` via SearchPort | grep `\..where(\|\.\select(\|\.\from(` dans CRT files |
| Schema migration within Runtime | InfraCoupling | Running `ALTER TABLE` or creating indexes during runtime assembly | Migrations are pre-applied; Runtime only connects to existing schema | grep `ALTER\|CREATE TABLE\|CREATE INDEX\|DROP TABLE` dans CRT files |
| Raw file I/O for data | DirectDBAccess | `fs.readFileSync("/data/users.json")`, writing JSON directly | FileStoragePort operations (FileStoragePort.read(), list(), write()) | grep `fs\.readFileSync\|fs\.writeFileSync\|new FileReader` dans CRT files |
| System time calls | ClockViolation | `Date.now()`, `new Date()`, `System.currentTimeMillis()`, `process.hrtime()` | `ClockPort.now()`, injected via CRT-009 Scheduler (DR-010) | grep `Date\.now\|new Date(\)\|currentTimeMillis` dans CRT files (excluding CRT-009) |
| Direct cache manipulation | DirectDBAccess | `redis.set(key, value)`, `memcached.get(key)` | CachePort operations only; TTL managed by IdempotencyManager (CRT-013) | grep `redis\.\|memcached\.\|cache\.set\|cache\.get\.` dans CRT files |

### 3.2 Business Logic Intrusion

| Pattern Interdit | Category | Exemple Interdit | Alternative Autorisée | Détection |
|------------------|----------|------------------|---------------------|-----------|
| Inline business validation | BusinessIntrusion | `if (amount < 0) throw new Error("Invalid amount")` | Amount validation in ResourceAggregate boundary method | grep `throw.*Error.*amount\|if.*amount.*<.*0` dans CRT files |
| State machine logic | BusinessIntrusion | `if (status === "draft") { status = "pending"; }` | State transitions exclusively in Aggregate Expose methods | grep `status\s*===\|state\s*==\|switch.*status` dans CRT files |
| Financial calculations | BusinessIntrusion | `const total = transactions.reduce((sum, t) => sum + t.amount, 0)` | ReportingAggregate.BalanceCalculator for all financial computations | grep `\s*\*\s*(1\+0\.2\|1\.2)\|reduce.*amount\|transactions\.forEach.*amount` dans CRT files |
| Permission resolution logic | BusinessIntrusion | `if (role === "admin") { allow(); } else if (role === "treasurer") { checkScope(); }` | AuthorizationPort.resolve(Actor, Resource) returns boolean only | grep `role\s*===\|checkPermission.*role\|isAdmin\|hasAdminRole` dans CRT files |
| Workflow step advancement | BusinessIntrusion | `if (currentStep === 0) nextStep = 1; else if ...` | WorkflowAggregate.AdvanceStep boundary method only | grep `currentStep\s*===\|stepIndex\s*==\|nextStep\s*=\s*[0-9]` dans CRT files |
| Cross-org data access | BoundaryBreach | `query.where("org_id", user_provided_org_id_param)` | org_id always from TenantContextProvider; never from request parameters | grep `req\.body\.org_id\|params\.org_id\|query\.org_id` dans CRT files |
| Domain event creation | EventInvention | `eventBus.publish("MyCustomEvent", { ... })` | Only DOC-014 registry events published through EventPublicationPort | grep `publish\|emit.*new.*Event` dans CRT files (excluding CRT-004) |

### 3.3 Architectural Anti-Patterns

| Pattern Interdit | Category | Exemple Interdit | Alternative Autorisée | Détection |
|------------------|----------|------------------|---------------------|-----------|
| Service Locator | ArchAntiPattern | `Container.get(MyPort)`, `resolve("RepositoryPort")`, `Port.getInstance()` | Constructor injection: `constructor(private readonly repo: RepositoryPort)` | grep `Container\.get\|resolve\(\|"getInstance\|Singleton\.instance` dans CRT files |
| Global mutable state | ArchAntiPattern | `let currentOrgId = null;`, `global.portRegistry = {}` | Thread-local/async-context via CRT-015 TenantContextProvider | grep `let\s+\w*[Aa]gg[Reg\|global\.\w*\s*=|var\s+\w*[Cc]urrent` dans CRT files |
| Feature flag gating CRTs | ArchAntiPattern | `if (!flags.disableAudit) { create(AuditEnabler); }` | All 15 CRTs always created; no conditional assembly | grep `featureFlag\|disable[A-Z]\|flags\.enable.*CRT` dans CRT files |
| Conditional component skip | ArchAntiPattern | `if (env === "test") skip(ClockPort);` | ClockPort always initialized; testing via ClockPort adapter replacement only | grep `skip\(\|avoid\(\|omit\(\|never.*create.*CRT` dans CRT files |
| Dynamic order override | ArchAntiPattern | `order.sort(() => Math.random() - 0.5)` | Fixed array const `PIPELINE_STEPS = [CRT-005, CRT-002, ...]` | grep `shuffle\|sort.*random\|Math\.random\|order\.reverse.*dynamic` dans CRT files |
| Circular imports between CRTs | ArchAntiPattern | CRT-003 imports CRT-004 imports CRT-003 | DAG dependency graph resolved once; strict acyclic import graph | Static import analysis (AST); verified at build time by DependencyResolver |
| Sync event publication blocking domain | TimingViolation | `await eventBus.publish(event); doBusinessLogic();` | Events published AFTER commit; async fire-and-forget (SYNC-004) | grep `await.*publish\|await.*dispatch\|eventBus\.sync` dans CRT files |
| Blocking on external API | TimingViolation | `const result = await externalApi.call(payload); save(result);` | Offline-first: local write first, sync pushed later by OfflineSyncAggregate (BR-SYNC-007) | grep `await.*fetch\|await.*api\.\w*\(` dans CRT handler code (excluding infrastructure adapters) |

### 3.4 Data and Security Anti-Patterns

| Pattern Interdit | Category | Exemple Interdit | Alternative Autorisée | Détection |
|------------------|----------|------------------|---------------------|-----------|
| Logging sensitive data | SecurityViolation | `logger.info({ userId, password: req.body.password });` | Sanitized logs; correlation_id only; never raw credentials | AST scan for `logger\.\w*\(` with `password\|secret\|token\|credential` keys |
| Storing passwords in logs | SecurityViolation | `console.log("Login attempt:", email, passwordHash)` | Login events logged with email only, never password or hash | grep `passwordHash\|log.*password\|log.*secret\|log.*token` dans CRT files |
| Returning full Aggregate state via diagnostics | SecurityViolation | `return { snapshot: JSON.stringify(aggregate.dump()) };` | RuntimeState snapshot filtered via schema deny-list (OR-015) | grep `JSON\.stringify.*aggregate\|dump\(\)\.toString` dans CRT-008 |
| User-supplied SQL fragment | SecurityViolation | `query.where("name", userInput + "%")` | Parameterized queries through RepositoryPort only | grep `\+\s*'%\'\|\|.*WHERE\|concat.*userInput` dans CRT files |
| Executing eval or function constructor | SecurityViolation | `eval(userFormData)`, `new Function(template)` | Form rendering via FormAggregate.FormRenderer (never user code execution) | grep `eval(\|Function(\|vm\.runInContext` dans CRT files |

### 3.5 Concurrency and Transaction Anti-Patterns

| Pattern Interdit | Category | Exemple Interdit | Alternative Autorisée | Détection |
|------------------|----------|------------------|---------------------|-----------|
| Lock ordering violation | ConcurrencyViolation | Acquiring Table B then Table A when global order is alphabetical | All tables accessed in alphabetical order; deadlock prevention via resource ordering (OR-007) | Call graph analysis of table lock sequences across transactions |
| Blocking reads | ConcurrencyViolation | `SELECT * FROM users FOR UPDATE`, `WITH (NOLOCK)` | Read committed, no locks on reads; MVCC isolation level only | grep `FOR\s+UPDATE\|FOR\s+SHARE\|NOLOCK\|LOCK\s+IN` dans requêtes CRT |
| Missing optimistic lock version | ConcurrencyViolation | `UPDATE transactions SET ... WHERE id=$1` (no version check) | Every update includes `AND version = $expected_version`; conflict triggers retry | grep `UPDATE\|WHERE.*id\s*=` dans CRT files; verify presence of `AND version` clause |
| Leaked connection | ConcurrencyViolation | Connection acquired but never released (missing finally block) | try-finally pattern: acquire → use → release in finally every time | AST analysis: every `.acquire()` must have matching `.release()` in finally block |
| Orphaned transaction scope | ConcurrencyViolation | `beginTransaction()` called without matching `commit()/rollback()` in finally | Every begin() has matching commit/rollback in finally; orphan detection via logging | Monitor open transaction count; alert if > 0 after grace period |
| Dirty reads | ConcurrencyViolation | Reading uncommitted data from another transaction (isolation < READ COMMITTED) | READ COMMITTED minimum isolation; snapshot isolation for critical reads | grep `READ\s+UNCOMMITTED\|SERIALIZABLE` dans config (only READ COMMITTED allowed) |

**Total patterns interdits couverts : 30+ patterns répartis en 5 catégories.** Chacun est détectable par grep statique, AST parsing, ou analyse de grappe d'appels.

### 3.6 Cross-Aggregate and Coordination Anti-Patterns

| Pattern Interdit | Category | Exemple Interdit | Alternative Autorisée | Détection |
|------------------|----------|------------------|---------------------|-----------|
| Direct Aggregate-to-Aggregate call | CrossAggregateBreach | `this.workflowAggregate.advanceStep(instanceId)` from within ResourceAggregate | Event-driven: emit StepApproved → WorkflowAggregate handles via CRT-004 | Call graph analysis across Aggregate boundaries; verify no direct method calls between Aggregate classes |
| Shared mutable state between Aggregates | CrossAggregateBreach | `let sharedCounter = 0;` incremented by multiple Aggregate operations | Each Aggregate owns its own state; cross-aggregate state communicated via events | Global variable scan in domain layer; verify each Aggregate has isolated internal state |
| Transaction spanning multiple Aggregates synchronously | CrossAggregateBreach | `transaction.begin(); aggA.save(); aggB.save(); transaction.commit()` | Saga pattern via CRT-003: begin A, emit event, B consumes and saves separately | Transaction scope duration monitoring; AST for `beginTransaction` with multiple Aggregate ops |
| Application Service bypassing Aggregate for bulk read | CrossAggregateBreach | `repo.findAllByOrg(orgId)` from AppService without Aggregate loading | Load Aggregate via RepositoryPort, then query through Aggregate boundary methods | AST analysis of AppService → RepositoryPort calls; verify all go through Aggregate.load() |
| Cross-org data merging via direct query | CrossAggregateBreach | `query("SELECT * FROM transactions WHERE org_id IN ($1, $2)")` | Each operation scoped to single org_id; cross-org aggregation done via ReportingAggregate | grep `org_id\s*IN\s*\(` or `WHERE.*org_id.*OR.*org_id` in query patterns |
| Event type filtering by business condition | CrossAggregateBreach | `if (event.type === "ResourceCreated" && !isDraft(event.data)) publish(event)` | EventDispatcher publishes all events; DOC-014 routing is structural, not conditional | Inspect EventDispatcher code for any conditional filtering based on event payload content |

### 3.7 Offline-First and Sync Anti-Patterns

| Pattern Interdit | Category | Exemple Interdit | Alternative Autorisée | Détection |
|------------------|----------|------------------|---------------------|-----------|
| Blocking user operation on sync | OfflineViolation | `while (!syncComplete()) { yield(); }` before accepting next user command | OfflineSyncAggregate runs background; user writes accepted immediately locally | Monitor user-operation latency during sync; should show zero dependency on sync completion |
| Sync service modifying resource data directly | OfflineViolation | `pendingOp.apply()` writes directly to resource tables bypassing Aggregate | PendingOperation pushes to local storage; actual mutation via Aggregate boundary before queuing | Trace data mutations in sync handlers; verify every write goes through an Aggregate first |
| Conflict resolution with server-wins override of immutable records | OfflineViolation | `if (serverVersion > localVersion) overwrite(localRecord)` for approved transactions | Immutable transactions: local conflict resolved by compensation, never overwritten by server | Audit conflict resolution logic against entity-type strategy map from DOC-019 |
| Ad-hoc batch sizes in sync push | OfflineViolation | `syncQueue.pushAll(queueItems)` without batching constraint | BatchPolicy: max 50 per batch as defined in SYNC-001/SYNC-002 | Monitor push batch sizes; alert if any batch exceeds 50 items |
| Sync pull without delta timestamp tracking | OfflineViolation | `syncPull.fetchAll()` downloading entire dataset instead of deltas since last sync | PullRemoteChanges(sinceTimestamp) using incremental snapshot comparison | Log analysis of pull operations; verify each includes a `since` timestamp parameter |
| Offline queue with unbounded growth | OfflineViolation | `pendingOps.push(op)` with no eviction, purging, or size cap | IdempotencyManager TTL on keys; Scheduled purge task on LifecycleAggregate | Monitor pending_operations count over time; should plateau and stabilize under capacity |

---

## SECTION 3-BIS : MATRICE D'IMPORTATION PAR COUCHE — DÉTAIL COMPLET

Cette section fournit une matrice détaillée des importations autorisées et interdites entre TOUTES les couches de l'architecture Lumina. Chaque cellule est tracée vers une règle PAS-003 ou un invariant RTS-001.

### 3.B.1 Matrice Complète des Imports Autorisés

```
                              Importe vers →
                   ┌────────────┬──────────┬─────────┬────────┬──────────┬───────────┐
                   │   Domain   │  AppSvc  │  Ports  │Adapters│  Infra   │  Runtime  │
                   ├────────────┼──────────┼─────────┼────────┼──────────┼───────────┤
Domain Layer      │     ✓     │    ✓    │    ✓    │   ✗    │    ✗     │     ✗     │
                   │ DOC-012    │ DOC-012  │ PAS-001 │ DR-003 │ DR-001   │ RT-NB-003 │
                   │ owns self  │ calls    │ defines  │ imp    │ dep      │ deps flow │
                   │            │ services │ ports    │ plement│ downward │ down only │
                   ├────────────┼──────────┼─────────┼────────┼──────────┼───────────┤
AppService Layer  │     ✓     │    ✓    │    ✓    │   ✗    │    ✗     │     ✓     │
                   │ ASS-001    │ ASS-001  │ PAS-001 │ DR-002 │ DR-002   │ CRT-001/  │
                   │ orchestrates │ defines  │ consumes│ imp    │ dep      │ CRT-015   │
                   │ aggregates │ contracts│ via repo│ pments │ downward │ context   │
                   ├────────────┼──────────┼─────────┼────────┼──────────┼───────────┤
Port Layer        │     ✗     │    ✗    │    ✓    │   ✗    │    ✗     │     ✓     │
                   │ PAS-001    │ PAS-001  │ defs   │ impl   │ DR-001   │ wires     │
                   │ interfaces │ cannot   │ only     │ ments  │ independence│ services│
                   │ consumed   │ import   │ defines  │ from   │          │ exposes   │
                   │ by above   │ below    │ nothing  │ infra  │          │ bindings  │
                   ├────────────┼──────────┼─────────┼────────┼──────────┼───────────┤
Adapter Layer     │     ✗     │    ✗    │    ✓    │   ✓    │    ✓     │     ✗     │
                   │ PAS-002    │ PAS-002  │ impls  │ same   │ infra    │ DR-004    │
                   │ implements │ depends  │ ports   │ layer  │ lib only │ runtime   │
                   │ contracts  │ on none  │ concret│ only   │ imp      │ opaque to │
                   │ below ports│ import   │ lements│ for    │ plements │ adapters  │
                   ├────────────┼──────────┼─────────┼────────┼──────────┼───────────┤
Infrastructure  │     ✗     │    ✗    │    ✗    │   ✓    │    ✓     │     ✗     │
Layer              │ infra    │ infra    │ infra   │ impl   │ self     │ DR-006    │
                   │ passive    │ passive  │ passive │ of     │ dep      │ highest   │
                   │ consumer   │ consumer │ consumer│ other  │ end;     │ layer;    │
                   │ of adapter │ consumer │ consumer│ layers │ knows    │ knows     │
                   │ contracts  │ consumer │ consumer│ only   │ adap     │ nothing   │
                   ├────────────┼──────────┼─────────┼────────┼──────────┼───────────┤
Runtime Layer     │     ✗     │    ✓    │    ✓    │   ✓    │    ✗     │     ✓     │
                   │ RN-001,    │ CRT-001  │ CRT-001 │ CRT-001│ DR-006   │ CRT-001   │
                   │ RN-003     │ exposes  │ binds   │ wires  │ runtime  │ assembles │
                   │ no biz     │ services │ adapters│ ports  │ imports  │ upper     │
                   │ logic      │ to above │ to ports │ to     │ from     │ layers    │
                   │ assembly   │          │ impl     │ infra  │ lower    │ knows     │
                   │ only       │          │          │ dep    │ layers   │ infra     │
                   └────────────┴──────────┴─────────┴────────┴──────────┴───────────┘

Légende :
  ✓ = Autorisé (dépendance descendante, conforme)
  ✗ = Interdit (violation architecturale, blocant)
```

### 3.B.2 Détail des Violations Possibles par Couple de Couches

| De → Vers | Violation Typique | Règle Pas-003 Violée | Sévérité | Exemple Concret |
|-----------|------------------|---------------------|----------|----------------|
| Domain → Runtime | Un Aggregate importe CompositionRoot pour résoudre un service | DR-001 (Domain Independence) | CRITIQUE | `import { CompositionRoot } from '../crt'; CompositionRoot.getService(...)` |
| Domain → Adapter | Un Aggregate utilise directement une classe d'adapter | DR-001 + DR-003 | CRITIQUE | `const repo = new PostgreSQLRepository(); repo.load(id);` |
| Domain → Infrastructure | Un Aggregate ouvre une connexion DB directe | DR-001 + DR-007 | CRITIQUE | `this.db.query('SELECT...');` dans une méthode Aggregate |
| AppSvc → Adapter | Un Service appelle un adapter concret | DR-002 (Serv Dep Direction) | CRITIQUE | `const redisAdapter = new RedisCache();` dans un service |
| AppSvc → Infra | Un Service connecte à une API externe directe | DR-002 | CRITIQUE | `fetch('https://api.external.com/...')` dans AppService |
| Port → Domain | Une interface Port importe une classe Domain | DR-001 inverse | CRITIQUE | `import { Transaction } from '../domain/';` dans un fichier port |
| Port → Runtime | Un Port importe un Runtime Component | DR-004 inversé | CRITIQUE | `import { RetryPolicy } from '../runtime/';` dans un port definition |
| Adapter → Domain | Un adapter accède directement aux Entities | DR-003 + DR-007 | HAUTE | `entity.pendingOps.push(op);` — modification directe state |
| Adapter → AppSvc | Un adapter importe un AppService | DR-006 (No inverted deps) | HAUTE | `import { ResourceService } from '../services/';` dans un adapter |
| Adapter → Runtime | Un adapter appelle un CRT directement | DR-004 + DR-006 | HAUTE | `DependencyResolver.instance().get(RepoPort);` |
| Infra → Toutes | L'infrastructure importe quoi que ce soit au-dessus | DR-006 | CRITIQUE | `import { RepositoryPort } from '../ports/';` dans infrastructure code |
| Runtime → Domain | Le Runtime manipule des Entities directement | RT-NB-001 (Biz Logic Isolation) | CRITIQUE | `aggregate._internalState.pendingOps.push(op);` |

---

## SECTION 4 : SÉPARATION DES COUCHES GARANTIE

### 4.1 Architecture en Couches — Vue Visuelle

```
┌─────────────────────────────────────────────────────────────────────────┐
│  COUCHE EXTERNE : API / CLI / Evenements Externes                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ HTTP Gateway │  │   CLI Shell  │  │ Mobile App (offline-first)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────────┘  │
│         │                  │                          │                  │
│         ▼                  ▼                          ▼                  │
├─────────────────────────────────────────────────────────────────────────┤
│  COUCHE RUNTIME  ███████████████████████████████████████                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  CRT-001 CompositionRoot ─── assemble, bind, expose services      │  │
│  │  CRT-002 DependencyResolver ─── topo sort, validate DAG           │  │
│  │  CRT-003 TransactionCoordinator ─── saga, commit, rollback        │  │
│  │  CRT-004 EventDispatcher ─── publish, route, DLQ                  │  │
│  │  CRT-005 ConfigurationLoader ─── load, validate, default          │  │
│  │  CRT-006 LifecycleManager ─── startup, signals, shutdown          │  │
│  │  CRT-007 HealthMonitor ─── poll, aggregate verdict                │  │
│  │  CRT-008 Diagnostics ─── collect, expose metrics (read-only)      │  │
│  │  CRT-009 Scheduler ─── cron, clock source, job coordination       │  │
│  │  CRT-010 StartupPipeline ─── phased init sequence                 │  │
│  │  CRT-011 ShutdownPipeline ─── graceful drain, reverse close       │  │
│  │  CRT-012 RetryPolicy ─── exponential backoff, error classification │  │
│  │  CRT-013 IdempotencyManager ─── deduplication, response caching   │  │
│  │  CRT-014 AuditEnabler ─── before/after capture, audit dispatch    │  │
│  │  CRT-015 TenantContextProvider ─── org_id resolution & injection  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  SEULE DIRECTION DE DÉPENDANCE AUTORISÉE ▼ (flux descendant)            │
├─────────────────────────────────────────────────────────────────────────┤
│  COUCHE APPLICATION SERVICES                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  ASS-001 : 13 Application Services (CRUD + orchestration)         │  │
│  │  ASS-003 : Workflow Specification (orchestrate aggregates via     │  │
│  │           Ports — never bypass Aggregate boundaries)               │  │
│  │  ASS-004 : Cross-Aggregate Coordination (patterns: linear,        │  │
│  │           parallel, saga — per coordination matrix)               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              ▲                                           │
│                              │                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  COUCHE DOMAIN                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  DOC-012 : 13 Aggregates (Organization, Identity, Resource,       │  │
│  │           Relationship, Workflow, Form, Notification, Vocabulary,  │  │
│  │           Reporting, Audit, Lifecycle, Configuration, OfflineSync) │  │
│  │  DOC-014 : Domain Events Registry (commands + events contract)    │  │
│  │  DOC-015 : 58 Domain Invariants (sacred, immutable)               │  │
│  │  DOC-NEVERBREAK : 10 NeverBreak Rules (deployment blocking)       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              ▲                                           │
│                              │                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  COUCHE PORTS (ABSTRACTIONS)                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  PAS-001 : 17 Ports (Repository, EventPub, EventSub,              │  │
│  │           IdentityProvider, Authorization, Clock, UUID,            │  │
│  │           Configuration, Logging, Audit, Notification, Search,     │  │
│  │           FileStorage, Cache, TxManager, PersistenceVerify,        │  │
│  │           VocabularyAccess)                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              ▲                                           │
│                              │           depends on                      │
├─────────────────────────────────────────────────────────────────────────┤
│  COUCHE ADAPTERS                                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  PAS-002 : Adapter Categories (in-memory, relational, document,   │  │
│  │           cache, file-storage, event-bus, notification)            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              ▲                                           │
│                              │           depends on                      │
├─────────────────────────────────────────────────────────────────────────┤
│  COUCHE INFRASTRUCTURE                                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL / SQLite / Redis / S3-compatible / SMTP /              │  │
│  │  Notification Providers / File System / Clock Hardware              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

RÈGLE ABSOLUE : Aucune flèche ne pointe VERS LE HAUT.
Les dépendances ne peuvent aller que de l'extérieur vers l'intérieur.
Le Runtime (couche grise) ne contient QUE du glue code — zéro business logic.
```

### 4.2 Règles de Dépendance entre Couches

| De la couche → Vers la couche | Autorisé ? | Justification |
|-------------------------------|-----------|---------------|
| API → Runtime | ✅ OUI | L'API consomme les Application Services exposés par CompositionRoot |
| API → Application Services | ✅ OUI | L'API appelle les services via leurs interfaces |
| Runtime → Ports | ✅ OUI | Le Runtime connecte chaque Port à son Adapter (CompositionRoot) |
| Runtime → Application Services | ✅ OUI | Le Runtime expose les services aux couches externes |
| Application Services → Domain Aggregates | ✅ OUI | Les services orchestrent les invocations d'Aggregates |
| Application Services → Ports | ✅ OUI | Les services communiquent avec les Aggregates via les Ports |
| Domain → Ports | ✅ OUI | Les Aggregates émettent Domain Events via EventPublicationPort |
| Domain → Infrastructure | ❌ NON | Violation directe de DR-001 (Domain Independence) |
| Domain → Application Services | ⚠️ RESTREINT | Un Aggregate peut déclencher un event qui un service consume, mais aucun appel direct de méthode |
| Adapters → Infrastructure | ✅ OUI | C'est le role des adapters (SQL driver, AWS SDK, etc.) |
| Ports → Adapters | ⚠️ N/A | Les Ports sont des interfaces; les Adapters les implémentent |
| **Inverse de toute flèche ci-dessus** | ❌ NON | Violation systématique des règles de flux descendant |

### 4.3 Implications Pratiques

**IP-001 : Si un développeur ajoute une validation business dans un Runtime component, c'est une violation de RT-NB-001 (RN-001).**
Détectable par : `grep -rn "if.*amount\|if.*status.*==\|validate.*business\|rule.*check" src/runtime/`
Impact : Le build CI échoue si des patterns de validation business sont détectés dans les fichiers CRT-.*/

**IP-002 : Si un file d'import CRT referencia un adapter concret au lieu d'un Port, c'est une violation de PAS-003 DR-004 et OR-002.**
Détectable par : `grep -rn "\.adapter\.\|\.impl\.\|import.*SQLRepository\|import.*InMemoryRepo" src/crt/`
Impact : Impossibilité de swap adapter sans recompilation du Runtime — violation du principe de dépendance inversée.

**IP-003 : Si un Domain Aggregate import un module du Runtime, c'est une violation de DR-001.**
Détectable par : analyse AST des imports ; vérification que aucun fichier sous `domain/` importe depuis `runtime/` ou `crt/`
Impact : Circuit de dépendance ; le Domain ne devrait dépendre que de lui-même et des Ports (interfaces).

**IP-004 : Si un Adapter contient une logique de state-machine (transition d'état métier), c'est une violation de PAS-003 DR-011.**
Détectable par : `grep -rn "switch.*type\|case.*draft\|case.*pending\|case.*approved" src/adapters/`
Impact : Regle métier spread dans infrastructure ; impossible de garantir qu'elle s'applique à tous les adapters.

**IP-005 : Si un Application Service fait un SELECT SQL direct au lieu de passer par RepositoryPort, c'est une violation de ASS-NB-003.**
Détectable par : `grep -rn "SELECT\|INSERT\|UPDATE\|DELETE" src/services/`
Impact : Couplage technologique ; si on change de base de données, chaque service doit être modifié.

**IP-006 : Si un Runtime component utilise global variables ou singletons globaux pour résoudre des dépendances, c'est une violation de OR-002.**
Détectable par : lint rule interdiction de `Container.get()`, `resolve()`, `getInstance()` dans code CRT
Impact : Graphe de dépendances invisible à l'analyse statique ; impossible de vérifier la compliance avec le DAG.

**IP-007 : Si un CRT contient un call direct à `Date.now()` ou `new Date()`, c'est une violation de DR-010.**
Détectable par : `grep -rn "Date\.now\|new Date()\|Process\.hrtime" src/crt/` (sauf CRT-009 Scheduler qui encapsule ClockPort)
Impact : Tests non reproductibles ; timestamps diffèrent selon l'environnement d'exécution.

**IP-008 : Si un endpoint de diagnostic accepte une mutation (POST/PUT), c'est une violation de OR-015.**
Détectable par : vérification de la configuration router HTTP ; seuls GET autorisés sur `/health`, `/metrics`, `/debug/dump`
Impact : Contournement des Application Services ; état modifié sans audit, sans validation domaine, sans transaction.

**IP-009 : Si un EventDispatcher modify le payload d'un événement, c'est une violation de OR-004 (Event Immutability).**
Détectable par : test d'intégration qui compare payload original vs payload dispatché — doivent être identiques (à part champs techniques ajoutés par dispatcher)
Impact : Consommateurs voient des données altérées ; incohérence de données non-détectable à la source.

**IP-010 : Si un TransactionCoordinator crée une transaction cross-aggregate sans pattern Saga, c'est une violation de OR-003 et OR-009.**
Détectable par : croiser chaque scope transactionnel avec la matrice ASS-004 ; chaque combo (primaryAggregate, secondaryAggregate, triggerEvent) doit mapper à un pattern valide
Impact : Distributed transaction anti-pattern ; lock contention cross-aggregate ; single point of failure.

**IP-011 : Si un org_id est lu depuis un paramètre de requête HTTP au lieu du token JWT, c'est une violation de OR-010.**
Détectable par : `grep -rn "req\.body\.org\|req\.params\.org\|req\.query\.org" src/`
Impact : Escalade de privilèges cross-tenant ; user peut injecter org_id d'une autre organisation.

**IP-012 : Si un fichier CRT contient un import d'un autre CRT qui n'est pas dans son dependency graph doc dans RTS-001, c'est une violation de RN-005.**
Détectable par : comparer les imports réels entre CRTs avec le graphe de dépendances documenté dans RTS-001 §Dépendances entre Components
Impact : Graphe de dépendances.Runtime diverge de la specification canonique ; order d'initialisation non garanti.

### 4.4 Scénarios de Violation Courants et Prévention

| # | Erreur fréquente | Comment survient-elle | Comment la détecter | Comment la prévenir |
|---|-----------------|----------------------|--------------------|--------------------|
| V-01 | "Je vais juste faire cette petite validation ici" | Un développeur ajoute `if (quantity <= 0) throw new Error(...)` dans CRT-003 | Grep pour pattern `throw.*Error` dans CRT-003 ;审查 code review | Lint rule interdisant throws dans CRT files sauf assertions d'infrastructure |
| V-02 | "L'adapter SQL a besoin de mapper le statut" | Mapper draft→0, pending→1 dans le Repository adapter au lieu de passer par Aggregate | Grep `draft.*0\|pending.*1\|approved.*2` dans adapters | Mapping enum→value dans l'adapter uniquement ; domain state machine reste dans Aggregate |
| V-03 | "Le logger est plus simple ici" | Logger.info("User login: " + username + ", password: " + password) dans CRT-015 | Grep `password\|secret\|credential` dans log calls CRT | Audit des logs en CI ; template sanitization dans logger wrapper |
| V-04 | "J'ai besoin de savoir l'heure pour cette opération" | new Date().toISOString() dans CRT-014 pour timestamp d'audit | Grep `new Date()` ou `Date.now()` dans CRT files (sauf CRT-009) | ClockPort injecté via constructor ; compilation error si utiliser system clock |
| V-05 | "Les sagas complexes ont besoin de logic de décision" | if (eventType === "X" && amount > 10000) do special handling dans saga executor | Grep `amount\s*>\s*[0-9]+` dans CRT saga code | La logique de seuil appartient à ResourceAggregate.BusinessRule ; saga coordonne, ne décide pas |
| V-06 | "On va skipper l'idempotence pour le health check" | if (endpoint === "/health") return { ok: true }; sans idempotency check | Vérifier que tous les paths passent par IdempotencyManager | ConfigurationPort définit les endpoints exemptés ; le whitelist est figé |
| V-07 | "C'est plus rapide d'appeler Repository directement" | repository.find(...) dans un CRT au lieu de passer par TransactionCoordinator | Analyse de graphe d'appels AST ; détecter tout call à repositoryPort directement depuis CRT | Lint rule : seul CompositionRoot peut binder RepositoryPort ; autres CRTs utilisent abstractions |
| V-08 | "Il faut transformer l'événement avant de le publish" | filter les fields "sensitive" du payload avant EventPublicationPort.publish() | Comparer payload entrant vs sortant de EventDispatcher ; vérification d'identité | EventDispatcher ne fait que forward ; immutabilité garantie par deep comparison test |
| V-09 | "Le retry pour les erreurs 5xx devrait être configuré" | Change max retries from 5 to 10 based on environment variable | Vérifier que les constantes MAX_RETRIES_* sont immuables (compile-time const, pas config) | Constants définies comme constantes lecture-seule ; pas de readenv pour retry params |
| V-10 | "J'ai besoin d'injecter un flag feature dans le lifecycle" | `if (config.enableNewWorkflow) register(NewWorkflowService)` pendant le StartupPipeline | Scanner le code CRT-010 StartupPipeline pour toute référence à `config.enable` ou `featureFlag` | Feature flags n'affectent que les Application Services, jamais les Runtime Components (OR-011) |
| V-11 | "Les diagnostics doivent montrer les stats de retry brutes" | Exposer le nombre de retries par org_id dans `/metrics` | Grep les champs retournés par Diagnostics.snapshot() pour `org_id` ou tenant-scoped data | RuntimeState schema filtering : org_id explicitement exclu du snapshot schema (BR-ID-001) |
| V-12 | "On a besoin d'un lock explicite pour la cohérence" | `acquireLock("organization_table")` dans un CRT au lieu d'utiliser optimistic locking | grep `lock(\|mutex(\|Semaphore(` dans code CRT | Optimistic locking par défaut ; explicit locks interdits (OR-007) |

### 4.5 Mécanismes de Garantie Structurelle

#### 5.1 Vérifications au Build Time (CI Pipeline)

| Mécanisme | Ce qu'il vérifie | Tool / Méthode | Blocant ? |
|-----------|-----------------|----------------|-----------|
| Lint rule : no-business-logic-in-crt | Aucun throw, if-validate, ou state-transition dans les fichiers CRT | ESLint/TSLint custom rule | OUI — bloque le merge |
| Lint rule : no-service-locator | Aucune invocation de Container.get(), resolve(), getInstance() | ESLint no-restricted-syntax | OUI — bloque le build |
| Lint rule : no-date-now-in-crt | Aucune utilisation de Date.now() ou new Date() (sauf CRT-009) | ESLint custom regex | OUI — bloque le build |
| Import graph validation | Le graphe d'imports entre CRT respecte le DAG canonique | Compiler du language + script personnalisé | OUI — compile-time error |
| Schema-sensitive data filter | Les endpoints de diagnostics n'incluent aucun champ sensible | Test unitaire sur Diagnostics.snapshot() | OUI — bloque le déploiement |
| Event type registry cross-reference | Tous les events publiés existent dans DOC-014 | Script de comparaison events dispatchés vs DOC-014 registry | OUI — bloque le déploiement |
| NeverBreak rules CI check | Taille fichier ≤ 400 lignes, org_id header sur toutes les requêtes DB | Scripts shell exécutés dans CI | OUI — bloque le merge |
| API route constraint | Endpoints de diagnostics acceptent seulement GET | Test d'intégration exécuté à chaque PR | OUI — bloque le déploiement |

#### 5.2 Vérifications au Run Time (Health Checks)

| Mécanisme | Ce qu'il vérifie | Tool / Méthode | Alert type |
|-----------|-----------------|----------------|-----------|
| HealthMonitor CRT-007 | Latency snapshot Diagnostics < 100ms p99 | Measurement intégré dans CRT-008 | DEGRADED si > 100ms |
| Resource leak detector | Aucune resource non-releasee après 120 secondes | CRT-007 polling sur CRT-008 metrics counter | WARNING → DEGRADED → UNHEALTHY si persistent |
| Correlation ID propagation | Tous les logs critiques incluent correlation_id | CRT-008 validation structurale des logs | INFO (logging only) |
| Dead Letter Queue growth | Nombre de messages en DLQ ne croît pas indéfiniment | CRT-007 surveille DLQ size via CRT-008 metrics | DEGRADED si croissance > seuil |
| Idempotency window correctness | Clés expirées correctement evicted du cache | CRT-013 self-test périodique | INFO (logging only) |
| Transaction scope tracking | Pas de transaction ouverte > timeout配置ré | CRT-003 heartbeat monitoring | ERROR → ROLLBACK si timeout |

#### 5.3 Vérifications Post-Déploiement (Monitoring)

| Mécanisme | Ce qu'il vérifie | Tool / Méthode | Action |
|-----------|-----------------|----------------|--------|
| Log aggregation analysis | Patterns interdits détectés dans les logs déployés | ELK/Datadog alerts sur regex banned patterns | Alert + Ticket création |
| Dependency graph drift | Le graphe d'imports runtime vs specification canonique | Script CI diff entre import graph réel et CRT-001 dependency map | ADR requis pour tout changement |
| Event bus consumer lag | Les handlers consomment dans les délais DOC-014 | Metrics CRT-008 handler_dispatch_latency | DEGRADED si > SLA |
| Cross-org query audit | Requête DB sans org_id filtré détectée dans les logs SQL | Base query log analysis sur RepositoryPort adapter layer | P0 incident automatique |
| NeverBreak rule ASS-NB-001 enforcement | Aucun code de validation business détecté dans AppService specs | Script de cross-reference use-case → Aggregate boundary method | WARNING + mandatory code review |
| NeverBreak rule ASS-NB-012 enforcement | Vérification que chaque Command/Query inclut org_id précondition | Pattern matching sur spec use cases pour présence org_id field | BLOCKING — violation corrigeable uniquement |
| Async event publication non-blocking | EventDispatcher publish ne bloque jamais le thread handler | Mesure temps entre Aggregate.commit() et EventDispatcher.publish() ; doit être < 5ms | DEGRADED si blocage détecté > 5ms |
| Saga compensation order inversion | Actions compensatrices exécutées dans l'ordre strictement inverse des actions originales | Log sequence comparison:补偿 events timestamps reverse of original commit order | ERROR → manual intervention required |

### 4.6 Implications Pratiques — ASS-005 NeverBreak Mapping

Chaque implication pratique ci-dessous est directement tracée vers une règle ASS-005 NeverBreak du document ASS-005-APPLICATION-SERVICE-NEVERBREAK-RULES. Le Runtime garantit que ces règles sont respectées en structurant son assemblage en conséquence.

#### IP-NB-001 : Domain Isolation (ASS-NB-001)
- **Impact Runtime** : Le CompositionRoot (CRT-001) expose les 13 Application Services mais n'interagit JAMAIS avec les Aggregates directement. Les Application Services seuls invoquent les Aggregates.
- **Vérifiable par** : AST scan montrant zéro appel Aggregate méthode depuis un fichier CRT. Tous les appels Aggregate passent obligatoirement par un Application Service.
- **Conséquence** : Si un CRT contient `aggregate.someMethod()`, c'est une violation CRITIQUE de ASS-NB-001.

#### IP-NB-002 : Invariant Preservation (ASS-NB-002)
- **Impact Runtime** : Le Runtime ne résout jamais les invariants DOC-015. Il transmet simplement les données aux Aggregates qui seuls les évaluent. TenantContextProvider injecte org_id (qui active INV-004) mais ne vérifie PAS le contenu.
- **Vérifiable par** : Chaque invariant DOC-015 est associé à exactement un Aggregate Expose method dans DOC-013.
- **Conséquence** : Un Runtime component qui lit un invariant DOC-015 ET prend une décision basé dessus = violation.

#### IP-NB-003 : No Direct Persistence (ASS-NB-003)
- **Impact Runtime** : Aucun CRT ne contient de requête SQL, d'appel ORM, ou de gestion de session. TransactionCoordinator (CRT-003) utilise RepositoryPort abstraction, pas l'implémentation.
- **Vérifiable par** : Regex grep pour SELECT/INSERT/UPDATE/DELETE dans tous les fichiers CRT. Doit retourner zéro match.
- **Conséquence** : Changer la base de données = modifier uniquement les Adapters + Infrastructure, jamais les CRTs.

#### IP-NB-004 : No Aggregate Bypass (ASS-NB-004)
- **Impact Runtime** : Every command from DOC-014 maps to exactly one Aggregate boundary via Application Service. Le Runtime ne connaît que les Ports et Services, jamais les entités internes des Aggregates.
- **Vérifiable par** : Pour chaque operation de DOC-014, vérifier qu'elle passe par exactement une route CRT→AppService→AggregateBoundary.
- **Conséquence** : Bypasser l'Aggregate boundary = break INV-004 multi-tenant isolation (les guards sont dans l'Aggregate).

#### IP-NB-005 : Concept Creation Control (ASS-NB-005)
- **Impact Runtime** : Le Runtime ne crée aucun Entity, VO, ou Domain Event nouveau. Tout ce qui traverse le Runtime est catalogué dans DOC-001/DOC-012/DOC-014.
- **Vérifiable par** : Cross-reference tous les types mentionnés dans les CRTs avec DOC-012 et DOC-014 registry.
- **Conséquence** : Types non-catalogués dans les documents canoniques → violation architecturelle.

#### IP-NB-006 : Event Authenticity (ASS-NB-006)
- **Impact Runtime** : Le EventDispatcher (CRT-004) ne reçoit QUE des événements du catalogue DOC-014. Aucun événement externe peut être injecté sur le bus domaine.
- **Vérifiable par** : Registry cross-reference au démarrage — chaque event type dispatché existe dans DOC-014.
- **Conséquence** : Event non-présent dans DOC-014 rejeté et logged comme violation.

#### IP-NB-007 : Framework Independence (ASS-NB-007)
- **Impact Runtime** : Aucun CRT ne référence Spring, Express, Django, Hibernate, EF Core, ou tout autre framework/langage. Terminologie purement domain-port-adapter.
- **Vérifiable par** : Text search pour nom de framework dans fichiers CRT. Doit retourner zéro match.
- **Conséquence** : La régénération du code pour différentes stacks reste possible car le Runtime est technologie-agnostique.

#### IP-NB-008 : Transaction Boundaries (ASS-NB-008)
- **Impact Runtime** : TransactionCoordinator implémente le pattern Saga pour TOUTES les opérations cross-aggregate. Aucune transaction synchronisée ne spanne plusieurs Aggregates.
- **Vérifiable par** : Croiser chaque scope transactionnel CRT-003 avec la matrice ASS-004 coordination patterns.
- **Conséquence** : Un use case cross-aggregate utilisant une transaction synchrone = violation ASS-NB-008.

#### IP-NB-009 : Side-Effect-Free Reads (ASS-NB-010)
- **Impact Runtime** : Les query operations (read-side) ne produisent jamais de Domain Events. Le EventDispatcher ne dispatche jamais pendant un query path.
- **Vérifiable par** : Compter les Domain Events Émis par chaque query use case → doit être zéro.
- **Conséquence** : Un query qui produit un event = cache invalidation storm potentiel, audit log bloat, event cascade inattendue.

#### IP-NB-010 : Actor Authorization (ASS-NB-011)
- **Impact Runtime** : Le TenantContextProvider (CRT-015) fournit org_id + userId. L'AuthorizationPort (bindé par CRT-001) valide les permissions AVANT de déléguer à l'Application Service.
- **Vérifiable par** : Chaque use case a un RBAC role mapping. AuthorizationPort est appelé avant chaque AppService execution.
- **Conséquence** : Opération exécutée sans check AuthorizationPort = security hole à l'application layer.

#### IP-NB-011 : Tenant Isolation (ASS-NB-012)
- **Impact Runtime** : org_id est résolu UNIQUEMENT depuis la session authentifiée (IdentityProviderPort → CRT-015). Jamais depuis un paramètre HTTP, body JSON, ou input utilisateur. Injecté dans TOUTES les opérations data.
- **Vérifiable par** : Chaque Command et Query a org_id dans ses preconditions. Pas de path de code où org_id vient de user input.
- **Conséquence** : Cross-org data leak = violation GDPR/compliance critique.

#### IP-NB-012 : Command/Event Traceability (ASS-NB-009)
- **Impact Runtime** : Chaque opération Runtime traçable vers exactement un command/event DOC-014. Un à un, pas d'invention.
- **Vérifiable par** : Pour chaque operation dans les specs, vérifier la reference DOC-014 source exacte.
- **Conséquence** : Perte de traçabilité entre specification et implementation = impossible de valider la complétude.
| NeverBreak rule ASS-NB-001 enforcement | Aucun code de validation business détecté dans AppService specs | Script de cross-reference use-case → Aggregate boundary method | WARNING + mandatory code review |
| NeverBreak rule ASS-NB-012 enforcement | Vérification que chaque Command/Query inclut org_id précondition | Pattern matching sur spec use cases pour présence org_id field | BLOCKING — violation corrigeable uniquement |
| Async event publication non-blocking | EventDispatcher publish ne bloque jamais le thread handler | Mesure temps entre Aggregate.commit() et EventDispatcher.publish() ; doit être < 5ms | DEGRADED si blocage détecté > 5ms |
| Saga compensation order inversion | Actions compensatrices exécutées dans l'ordre strictement inverse des actions originales | Log sequence comparison:补偿 events timestamps reverse of original commit order | ERROR → manual intervention required |

---

## SECTION 5 : MATRICE DE COMPLIANCE ET DE TRAÇABILITÉ

### 5.1 Mapping Sections ↔ Documents Canoniques

| Section RTS-004 | Docs Sources | Règles Consultées |
|-----------------|-------------|-------------------|
| Section 1 (Peut faire) | DOC-000 §6, DOC-012, PAS-001, PAS-002, PAS-003, ASS-001, ASS-003, ASS-004, DOC-014, DOC-015, DOC-019 | RN-001..010, OR-001..015, DR-001..012, LV-001..LV-010, BR-SYNC-003, BR-NOT-004, BR-ID-001, AUD-001, OLDNEW-002, NB-PERSIST-007, SYNC-004, CFG-001..004 |
| Section 2 (Ne peut jamais faire) | DOC-000, DOC-012, DOC-014, DOC-015, PAS-003, ASS-005 | ASS-NB-001..012, RN-001..010, DR-001..012, BR-ID-001, NB-RULE-01..10 |
| Section 3 (Patterns interdits) | PAS-003 DR-001..012, RTS-001, RTS-003 | DR-001 (Domain Independence), DR-004 (Runtime Assembly), DR-007 (Persistence Ignorance), DR-008 (Event Boundary), DR-009 (Tenant Isolation), DR-010 (Clock Unification), DR-011 (No Biz Logic in Ports), DR-012 (Cross-Aggregate), OR-002 (No Service Locator), OR-005 (Retry Policy), OR-015 (Diagnostics) |
| Section 4 (Séparation garantie) | DOC-000, PAS-003, DOC-012, DOC-017 | DOC-000 §1 (Hiérarchie des couches), DOC-000 Regle 1 (flux descendant), PAS-003 DR-006 (No inverted deps), DOC-004 (Mapping Rules) |

### 5.2 Couverture des 15 Runtime Components par les Restrictions

| CRT | Restrictions Applicables (de Section 2 + Section 3) |
|-----|---------------------------------------------------|
| CRT-001 CompositionRoot | #1, #3, #4, #7, #8, #14, #22 — NE DOIT PAS contenir de biz logic (seulement assembly/bind), NE INVENT PAS de concepts |
| CRT-002 DependencyResolver | #6, #13, #21 — Ordre FIGÉ, pas de config dynamique, pas de feature flag gating |
| CRT-003 TransactionCoordinator | #1, #3, #4, #5, #10, #12, #13 — Pas de validation business dans saga pattern, pas de SQL direct |
| CRT-004 EventDispatcher | #5, #9, #10 — Payload immuable, events DOC-014 uniquement, async post-commit |
| CRT-005 ConfigurationLoader | #13 — Config toujours chargée, jamais hardcodée, validée format |
| CRT-006 LifecycleManager | #6, #8 — 15 CRTs TOUJOURS créés, diagnostics toujours GET-only |
| CRT-007 HealthMonitor | #1, #17 — Health checks READ-ONLY, metrics sans données sensibles |
| CRT-008 Diagnostics | #17, #18 — Always read-only, never sensitive data, NEVER audits itself (#15) |
| CRT-009 Scheduler | #19 — Clock via ClockPort uniquement, jobs Atomic par Aggregate |
| CRT-010 StartupPipeline | #6, #10 — 15 CRTs always created, ordered deterministic |
| CRT-011 ShutdownPipeline | #10 — Flush before close, reverse order guaranteed, exit codes explicit |
| CRT-012 RetryPolicy | #16, #23, #24 — Max retry constants immutable, exponential backoff mandatory, no repo retry |
| CRT-013 IdempotencyManager | #11 — org_id scoped hash, reads exempt, TTL enforced |
| CRT-014 AuditEnabler | #15 — Never self-audit, capture old+new values, non-blocking |
| CRT-015 TenantContextProvider | #11 — org_id from token ONLY, never user input, 401 if unresolved |

---

## SECTION 6 : CHAMBRE DE COMPENSATION — QUAND LE RUNTIME DOIT DÉLÉGUER

Même si le Runtime est défini par ce qui IL NE FAIT PAS, certaines situations appellent une délégation forcée vers les couches inférieures. Voici le mécanisme contractuel de délégation :

### 6.1 Délegation Obligatoire (Doit Déléguer)

| Situation | Vers quelle couche déléguer | Pourquoi le Runtime ne peut pas traiter |
|-----------|---------------------------|----------------------------------------|
| Validation d'un montant financier | ResourceAggregate | Calcul financier = business rule (DOC-012) |
| Transition d'état d'une ressource | ResourceAggregate / LifecycleAggregate | State machine = invariant (DOC-015) |
| Résolution de permission RBAC | AuthorizationPort → IdentityAggregate | Access control = business policy (DOC-012) |
| Calcul de bilan comptable | ReportingAggregate | Finance = métier pur (DOC-012) |
| Template de notification | NotificationAggregate + VocabularyAggregate | Templates = config métier (DOC-012) |
| Format de formulaire | FormAggregate | Form definition = métier (DOC-012) |
| Catégorisation de transaction | VocabularyAggregate | Category lookup = vocabulaire (DOC-012) |
| Conflit de sync offline | OfflineSyncAggregate | Conflict strategy = métier (DOC-012) |
| Approbation workflow | WorkflowAggregate | Approval chain = business policy (DOC-012) |
| Suppression rétentive (trash/purge) | LifecycleAggregate | Retention period = métier (DOC-012) |
| Agrégation cross-org pour reporting | ReportingAggregate | Data scope = policy (DOC-012) |
| Héritage de configuration entre orgs | OrganizationAggregate + ConfigurationAggregate | Template inheritance = config business (DOC-012) |

### 6.2 Mécanisme de Délegation

Le Runtime delegate toujours via les **abstractions Port**, jamais par appel direct à un Aggregate. Le schema de delegation est :

```
Runtime Component (ex: CRT-003 TransactionCoordinator)
    │
    ├──▶ Application Service (ex: ASS-001 — WorkflowService)
    │       │
    │       ├──▶ Aggregate Boundary Method (ex: WorkflowAggregate.ApproveStep)
    │       │       │
    │       │       ├──▶ Invariant Check (ex: WF-005 approved immutable)
    │       │       └──▶ State Transition (ex: running → completed)
    │       │
    │       └──▶ Event Emission (ex: StepApproved → DOC-014)
    │
    └──▶ Port Abstraction (ex: RepositoryPort.save via Adapter)
            │
            └──▶ Infrastructure (PostgreSQL, SQLite, File Storage)
```

Chaque flèche dans ce schéma représente un **contrat d'interface**. Le Runtime ne traverse jamais une flèche horizontale (cross-cutting) — il suit toujours le flux vertical descendant.

---

## SECTION 7 : EXEMPTIONS ET CAS FRONTIÈRE

Certaines situations existent sur la frontière exacte entre ce que le Runtime PEUT et NE PEUT PAS faire. Voici les clarifications :

| # | Situation frontalière | Classification | Justification |
|---|----------------------|---------------|---------------|
| E-01 | Logger des informations structurées (JSON) sur les états internes du Runtime | ✅ AUTORISÉ | Ce n'est pas du business logic — c'est de l'observabilité technique (CRT-008, OR-013) |
| E-02 | Exécuter un callback de health check qui appelle `ping()` sur la base de données | ✅ AUTORISÉ | C'est une opération infrastructure de monitoring, pas de la logique métier (CRT-007) |
| E-03 | Construire un graphe de dépendances à partir de métadonnées déclaratives | ✅ AUTORISÉ | C'est du glue-code d'infrastructure (CRT-002), pas du business logic |
| E-04 | Décider quel adapter utiliser parmi une catégorie donnée | ✅ AUTORISÉ | C'est du choix d'infrastructure, résolu au composition root (CRT-001), pas du business logic |
| E-05 | Appliquer un retry sur une opération d'I/O échouée | ✅ AUTORISÉ | C'est de la tolérance aux pannes infrastructure (CRT-012), pas de la logique métier |
| E-06 | Vérifier qu'une clé idempotente existe dans le cache | ✅ AUTORISÉ | C'est de la mécanicacité de déduplication, pas de la logique métier (CRT-013) |
| E-07 | Capturer avant/après state pour audit technique | ✅ AUTORISÉ | C'est du tracing technique obligatoire, pas de la logique métier (CRT-014) |
| E-08 | Injecter org_id dans une requête RepositoryPort | ✅ AUTORISÉ | C'est de l'isolation multi-tenant technique (CRT-015, PAS-003 DR-009) |
| E-09 | Convertir un événement domain en plusieurs publications vers différents handlers | ✅ AUTORISÉ | C'est du routing technique garantissant at-least-once (CRT-004, OR-004) |
| E-10 | Gérer le cycle de vie d'un saga (begin, step, compensate, end) | ✅ AUTORISÉ | C'est de l'orchestration transactionnelle, pas de la logique métier (CRT-003, OR-003) |
| E-11 | Arrêter proprement toutes les connections après un signal SIGTERM | ✅ AUTORISÉ | C'est du cleanup infrastructure (CRT-011, OR-012), pas de la logique métier |
| E-12 | Mesurer la latence d'un snapshot Diagnostics et alerter si > 100ms | ✅ AUTORISÉ | C'est du monitoring qualité de service (CRT-008, OR-015), pas de la logique métier |
| F-01 | Décider si une transaction financière est valide (montant > 0, balance suffisante) | ❌ INTERDIT | Validation financière = business rule pur → ResourceAggregate |
| F-02 | Décider si un utilisateur a le droit d'approver un workflow | ❌ INTERDIT | Authorization = business policy → AuthorizationPort → IdentityAggregate |
| F-03 | Décider quel event dispatcher doit recevoir un événement particulier | ❌ INTERDIT SAUF DOC-014 mapping | Event routing est FIXE par DOC-014 registry — le Runtime applique le mapping, ne le décide pas |
| F-04 | Décider si un org doit avoir le mode offline activé | ❌ INTERDIT | Activation offline = feature business policy → Application Service + Manifest config |
| F-05 | Décider combien de retries effectuer pour une opération spécifique | ❌ INTERDIT | Retry counts = constantes immuables CRT-012 — pas configurables par business rule |

**Total : 12 exemptions autorisées (E-01..E-12) et 5 exclusions formelles (F-01..F-05).**

---

## SECTION 8 : MATRICE COMPLIANCE PAR COMPOSANT

### 8.1 Compliance Matrix — Quel Component Vérifie Quelle Règle

| # | Règle RTS-004 | Vérifié par CRT | Comment vérifié | Fréquence |
|---|--------------|-----------------|-----------------|----------|
| M-01 | RN-001 : No business logic in Runtime | CRT-008 Diagnostics | Lint rule scan sur tous les fichiers CRT | Build time + hourly |
| M-02 | RN-005 : Assembly order immuable | CRT-002 DependencyResolver | Compare `ResolvedOrder` avec graphe statique DOC-000 | Boot only |
| M-03 | OR-001 : Assembly Order Enforcement | CRT-001 CompositionRoot | Vérifie que chaque composant a ses dépendances bindées avant installation | Boot only |
| M-04 | OR-002 : Constructor Injection Only | CRT-001 CompositionRoot | Lint rule interdit Service Locator patterns | Build time |
| M-05 | OR-003 : Transaction Boundary Management | CRT-003 TransactionCoordinator | Trace de chaque begin()/commit()/rollback() | Operation time |
| M-06 | OR-004 : Event Dispatch Guarantee | CRT-004 EventDispatcher | DLQ monitoring, at-least-once verification | Operation time |
| M-07 | OR-005 : Retry Policy Application | CRT-012 RetryPolicy | Max retries constants immutable, backoff formula validation | Build time |
| M-08 | OR-006 : Idempotency Enforcement | CRT-013 IdempotencyManager | org_id scoped hash verification, TTL expiry tests | Operation time |
| M-09 | OR-007 : Concurrency Control | CRT-003 TransactionCoordinator | Optimistic locking schema check, connection pool monitoring | Health check |
| M-10 | OR-010 : Tenant Context Propagation | CRT-015 TenantContextProvider | org_id present dans toutes les requêtes données | Build time |
| M-11 | OR-011 : Startup Sequence Determinism | CRT-010 StartupPipeline | N démarrages identiques en logs | Build time + boot |
| M-12 | OR-012 : Shutdown Drain Policy | CRT-011 ShutdownPipeline | Reverse order close verification, exit code propagation | Every shutdown |
| M-13 | OR-013 : Logging Traceability | CRT-008 Diagnostics | correlation_id présent dans toutes les log entries | Operation time |
| M-14 | OR-014 : Resource Cleanup Guarantee | CRT-003/CRT-004/CRT-009 | acquired_resources_total == released_resources_total | Health check |
| M-15 | OR-015 : Diagnostics Completeness | CRT-008 Diagnostics | Snapshot latency < 100ms p99, no sensitive data | Health check + build |
| M-16 | DR-007 : Persistence Ignorance | CRT-001/Build system | Grep SQL/ORM annotations dans Domain + AppService | Build time |
| M-17 | DR-008 : Event Boundary Respect | CRT-004/Build system | Tous les events publiés map à DOC-014 | Build time |
| M-18 | DR-009 : Tenant Isolation | CRT-015/Build system | Toutes les opérations data incluent org_id | Build time |
| M-19 | DR-010 : Clock Source Unification | CRT-009/Build system | Aucune system clock call hors CRT-009 | Build time |
| M-20 | DR-011 : No Biz Logic in Ports/Adapters | Build system | Grep business rule patterns dans Port/Adapter specs | Build time |
| M-21 | DR-012 : Cross-Aggregate Coordination | CRT-003/Runtime | Pas d'appel direct Aggregate→Aggregate détecté | Build time + runtime trace |
| M-22 | ASS-NB-001 : Domain Isolation | Build system | Scan use cases ASS-002 pour inline business logic | Build time |
| M-23 | ASS-NB-002 : Invariant Preservation | Build system | Chaque invariant guard est dans un Aggregate method | Build time |
| M-24 | ASS-NB-003 : No Direct Persistence | Build system | Aucun SELECT/INSERT/UPDATE/DELETE dans App Services | Build time |
| M-25 | ASS-NB-004 : No Aggregate Bypass | Build system | Chaque command mapped à exactly one Aggregate boundary | Build time |
| M-26 | ASS-NB-005 : Concept Creation | Build system | Every entity/VO in ASS-002 exists in DOC-001/DOC-012 | Build time |
| M-27 | ASS-NB-006 : Event Authenticity | Build system | Every event published in ASS-002 exists in DOC-014 | Build time |
| M-28 | ASS-NB-007 : Framework Independence | Build system | Aucun framework name dans specs applicatives | Build time |
| M-29 | ASS-NB-008 : Transaction Boundaries | Build system | Multi-aggregate ops suivent patterns ASS-003 | Build time |
| M-30 | ASS-NB-009 : Command/Event Traceability | Build system | Each UC-XXX references exact DOC-014 entry | Build time |

### 8.2 Missing Compliance Checks — Newly Added from ASS-005 NeverBreak Rules

| # | Règle RTS-004 | Vérifié par CRT | Comment vérifié | Fréquence |
|---|--------------|-----------------|-----------------|----------|
| M-31 | ASS-NB-010 : Side-Effect-Free Reads | Build system + CRT-004 | Count Domain Events Emitted per query-type use case; must be zero | Build time |
| M-32 | ASS-NB-011 : Actor Authorization | CRT-001 CompositionRoot | Verify every use case in specs has RBAC role assignment from API-CONTRACT-004 | Build time |
| M-33 | ASS-NB-012 : Tenant Isolation | CRT-015 TenantContextProvider | Every Command and Query type use case has org_id in preconditions chain | Build time + runtime audit |
| M-34 | RT-NB-006 : Technical events separate from Domain Events | CRT-004 EventDispatcher | Technical event routing path distinct from domain event bus — different subscriber sets | Runtime monitoring |
| M-35 | RT-NB-007 : Audit is terminal consumer only | CRT-014 AuditEnabler | Verify AuditAggregate never emits Domain Events that trigger other Aggregate mutations | AST analysis of AuditAggregate boundaries |
| M-36 | RT-NB-010 : Offline-first applies to ALL operations | CRT-006 LifecycleManager | No user-facing operation waits for sync completion; user op latency measured independently of sync state | Runtime latency measurement |
| M-37 | RN-003 : Dependencies always flow downward | Build system | Layer dependency graph analysis: lower layers (Domain) never import upper layers (Runtime, Adapters) | Build time |
| M-38 | RN-004 : Each Port has exactly one concrete adapter chosen at startup | CRT-001 CompositionRoot | After composition root, binding matrix contains exactly one adapter category per port | Boot-time validation |

---

## SECTION 8 : RÉSUMÉ EXÉCUTIF DES FRONTIÈRES RUNTIME

| Catégorie | Count | Nature | Vérifiable par |
|-----------|-------|--------|----------------|
| Actions autorisées (Section 1) | 48 | Obligations du Runtime | Code review + traceability matrix |
| Interdictions absolues (Section 2) | 24 | Prohibitions constitutives | Grep patterns + lint rules |
| Patterns interdits (Section 3) | 30+ | Anti-patterns techniques | AST analysis + static analysis |
| Exemptions frontalières (Section 7) | 12 autorisées + 5 refusées | Clarifications边界 | Code review |
| Implications pratiques (Section 4.3) | 12 | Concrétisations | Lint rules + tests unitaires |
| Délegations obligatoires (Section 6) | 12 | Cas de délegation forcée | Contract validation |

**Principe fondamental récapitulatif :** Le Runtime Lumina est un ASSEMBLER, pas un DECIDEUR. Il connecte, il ordonne, il surveille, il coordonne — mais il ne valide JAMAIS, ne calcule JAMAIS, ne décide JAMAIS de règles métier. Toute action du Runtime est déterministe, reproductible, et tracée vers un document canonique.

---

## SECTION 9 : HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | runtime-specifier v1.0 | Création — Runtime Boundaries Specification pour Lumina v1 | COMPLIANT (trace vérifié contre DOC-000, DOC-012, DOC-014, DOC-015, DOC-019, PAS-001, PAS-002, PAS-003, ASS-001, ASS-004, ASS-005, DOC-NEVERBREAK) |

---

## SECTION 10 : DOCUMENTS CONSORTS

Ce document fait partie de la série Runtime Technical Specification :

- **RTS-001** — Runtime Component Catalog (catalogue des 15 CRTs)
- **RTS-002** — Lifecycle Phases (phases séquentielles du cycle de vie)
- **RTS-003** — Orchestration Rules (15 règles OR-001..OR-015)
- **RTS-004** — Runtime Boundaries (ce document — ce que le Runtime PEUT et NE PEUT PAS faire)
- **RTS-005** — Runtime Error Contracts (schémas d'erreurs et codes E-XXX)
- **RTS-006** — Runtime Integration Testing (stratégies de test d'intégration pour chaque CRT)

---

*Ce document définit les frontières absolues du Runtime Layer Lumina. Toute dérivation implémentation doit respecter ces limites. Une violation de n'importe quelle interdiction de la Section 2 constitue un BLOCKING error de déployment, équivalent à la violation d'un invariant DOC-015.*

---

## ANNEXE E : TRACÉ COMPÉRATIF ASS-005 → RTS-004

Ce tableau cross-reference chaque règle NeverBreak ASS-005 avec les contraintes RTS-004 correspondantes. Aucun ass-NB rule ne doit rester sans coverage dans RTS-004.

| ASS-NB Rule | RTS-004 Coverage | Section(s) RTS-004 Concernée(s) | Type de Couverture |
|-------------|------------------|--------------------------------|--------------------|
| ASS-NB-001 Domain Isolation | RT-FRO-001, IP-NB-001, M-31 | Sec 2 #1, Sec 4.6, Sec 8.2 | Interdit + Implication + Vérification |
| ASS-NB-002 Invariant Preservation | RT-FRO-002, IP-NB-002 | Sec 2 #2, Sec 4.6 | Interdit + Implication |
| ASS-NB-003 No Direct Persistence | RT-FRO-003, IP-NB-003 | Sec 2 #3, Sec 4.6 | Interdit + Implication + Grep |
| ASS-NB-004 No Aggregate Bypass | RT-FRO-004, IP-NB-004 | Sec 2 #4, Sec 4.6 | Interdit + Implication |
| ASS-NB-005 Concept Creation | RT-FRO-005, IP-NB-005 | Sec 2 #22, Sec 4.6 | Interdit + Implication |
| ASS-NB-006 Event Authenticity | RT-FRO-006, IP-NB-006 | Sec 2 #5, Sec 4.6, Sec 5.1 | Interdit + Implication + Build check |
| ASS-NB-007 Framework Independence | RT-FRO-007, IP-NB-007 | Sec 2 #6, Sec 4.6, Sec 5.1 | Interdit + Implication + Text scan |
| ASS-NB-008 Transaction Boundaries | RT-FRO-008, IP-NB-008 | Sec 2 #12, Sec 4.6, Sec 8.2 M-05 | Interdit + Implication + Cross-ref |
| ASS-NB-009 Command/Event Traceability | — | Sec 2, Sec 4.6 IP-NB-012, Sec 8.2 M-30 | Coverage via Sec 2 items + cross-ref |
| ASS-NB-010 Side-Effect-Free Reads | RT-FRO-020, IP-NB-009 | Sec 2 #20, Sec 4.6, Sec 8.2 M-31 | Interdit + Implication + Counting |
| ASS-NB-011 Actor Authorization | — | Sec 4.6 IP-NB-010, Sec 8.2 M-32 | Implication + Verification pattern |
| ASS-NB-012 Tenant Isolation | RT-FRO-011, IP-NB-011 | Sec 2 #11, Sec 4.6, Sec 8.2 M-33 | Interdit + Implication + Enforced |
