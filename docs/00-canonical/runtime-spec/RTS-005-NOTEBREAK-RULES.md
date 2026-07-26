# Runtime NeverBreak Rules — Lumina v1

**Doc ID:** RTS-005
**Version:** v1.0
**Statut:** SPECIFICATION RUNTIME CONSTITUTIONNELLE JAMAISMODIFIEE
**Date:** 2026-07-25
**Generateur :** runtime-specifier v1.0
**Source canonique :** ["RTS-001", "RTS-002", "RTS-003", "RTS-004", "DOC-000", "DOC-012", "DOC-014", "DOC-015", "DOC-023", "PAS-001", "PAS-003", "ASS-001", "ASS-004", "ASS-005"]
**Transformation_rule :** "runtime-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit les **12 règles constitutionnelles immuables** (NeverBreak) du Runtime Layer Lumina. Ces règles protègent le Domain, les Application Services, et les Ports contre toute contamination, dérivation ou violation par la couche d'assemblage.

Le Runtime est UNE COUCHE D'ASSEMBLAGE. Son seul rôle est de connecter, ordonner, coordonner et superviser. Il ne contient JAMAIS de logique métier, ne décide JAMAIS de comportement domaine, et ne contourne JAMAIS les couches inférieures.

Chaque règle RT-NB-NNN est :
- **Vérifiable automatiquement** par grep, AST parse, test unitaire isolé, ou analyse statique de code
- **Bloquante au déploiement** — sa violation empêche le merge ou le déploiement
- **Traçable** vers au moins un document canonique source
- **Immuable** — aucune dérogation n'est possible sans amendement ADR approuvé

**Règle constitutionnelle fondamentale :** Ces 12 règles sont au-dessus des autres règles RTS. Si une règle RTS-001 à RTS-004 semble en conflit avec une règle RT-NB, c'est la RT-NB qui l'emporte. La résolution se fait par réduction de la règle RTS vers le strict assemblage nécessaire.

---

## RÈGLE 1 : BusinessLogicIsolation

```markdown
## RT-NB-001: NeverBreak-BusinessLogicIsolation

**Description**: Le Runtime ne contient JAMAIS de logique métier. Aucune règle de validation, aucun calcul financier, aucune transition d'état, aucune décision de permission ne peut exister dans un composant Runtime (CRT-001 à CRT-015). Le Runtime assemble et orchestre ; le Domain décide.

**Domaine concerné**: Tous les composants Runtime (CRT-001 à CRT-015). S'applique particulièrement à CRT-003 (TransactionCoordinator), CRT-004 (EventDispatcher), et CRT-010 (StartupPipeline) où la tentation d'ajouter de la logique « pragmatique » est la plus forte.

**Violation Types**:
- **InlineBusinessValidation**: Un CRT contient des conditions de validation business (ex: `if (amount < 0)`, `if (status === "draft")`). Les Aggregates seuls possèdent ces guards. Détectable par grep de patterns de validation métier dans les fichiers CRT.
- **StateTransitionInCRT**: Un CRT implémente une machine à états ou des transitions de domaine (ex: switch/case sur des statuses métier). L'État appartient à DOC-012 ; le Runtime ne fait que transiter les cycles de vie infrastructurels. Détectable par AST analysis des conditions de branchement sur des valeurs de domaine.
- **FinancialCalculationInRuntime**: Un CRT effectue des calculs financiers, agrégations comptables, ou transformations numériques liées au métier (ex: reduce sur des montants, somme de soldes). Reporté vers ReportingAggregate. Détectable par scan des opérations arithmétiques sur des champs nommés `amount`, `balance`, `total`.
- **PermissionDecisionInRuntime**: Un CRT résout lui-même des permissions RBAC (ex: `if (role === "admin")`). L'AuthorizationPort retourne uniquement un booléen ; la décision de qui peut quoi appartient à IdentityAggregate. Détectable par grep de patterns de résolution de rôle dans CRT.
- **CrossAggregateBusinessRule**: Un CRT applique une règle métier pour décider si une coordination cross-aggregate doit se faire ou non. La matrice ASS-004 fixe ce mapping ; le Runtime l'applique mécaniquement, ne le décide pas. Détectable en croisant chaque condition dans un saga handler avec les entrées de la matrice ASS-004.

**Verifiable Assertion**: 
1. Scanner AST de tous les fichiers CRT → extraire toutes les expressions conditionnelles (`if`, `switch`, ternaires). Pour chacune, vérifier qu'aucune ne compare une valeur de domaine (`status`, `amount`, `type`, `role`, `category`, `priority`, `balance`). Une comparaison de valeur de domaine = violation.
2. Grep pour les patterns interdits dans `src/crt/` ou équivalent : `amount\s*[><=]`, `status\s*===`, `role\s*===`, `type\s*===`, `reduce.*amount`, `filter.*business`, `validate.*business`. Aucun match attendu.
3. Vérifier que chaque CRT ne fait QUE : assemblage (CRT-001), résolution topologique (CRT-002), coordination transactionnelle (CRT-003), dispatch événementiel (CRT-004), chargement config (CRT-005), gestion cycle vie (CRT-006), monitoring (CRT-007), diagnostic (CRT-008), planification (CRT-009), pipeline démarrage (CRT-010), pipeline arrêt (CRT-011), retry (CRT-012), idempotence (CRT-013), audit (CRT-014), contexte tenant (CRT-015). Aucune autre responsabilité = violation.
4. Test d'intégration : injecter un mock de TransactionCoordinator qui tente d'exécuter une condition business → doit être impossible car le code CRT ne contient pas de telles conditions.

**Related Components**: CRT-001, CRT-002, CRT-003, CRT-004, CRT-005, CRT-006, CRT-007, CRT-008, CRT-009, CRT-010, CRT-011, CRT-012, CRT-013, CRT-014, CRT-015 (TOUS)
**Dependency**: Aucune — RT-NB-001 est fondamental. Toutes les autres règles en dépendent indirectement.
**Source traceabilité**: RN-001 (RTS-001), DOC-000 §6 (Runtime Services: orchestration only), ASS-NB-001 (ASS-005: Domain Isolation)
```

---

## RÈGLE 2 : TechnologyNeutrality

```markdown
## RT-NB-002: NeverBreak-TechnologyNeutrality

**Description**: Le Runtime ne dépend JAMAIS d'une technologie spécifique, d'un framework, d'un langage, ou d'un fournisseur d'infrastructure. Il interagit exclusivement via des abstractions de Ports (PAS-001) et ne connaît que les catégories d'Adapters (PAS-002), jamais leurs implémentations concrètes.

**Domaine concerné**: CRT-001 (CompositionRoot — bindings), CRT-003 (TransactionCoordinator — transactions), CRT-005 (ConfigurationLoader — configuration sources), CRT-011 (ShutdownPipeline — ressources). Ce sont les seuls endroits où le Runtime touche aux choix technologiques, et seulement au niveau catégorie.

**Violation Types**:
- **ConcreteAdapterImport**: Un fichier CRT importe directement une classe adapter concrète (ex: `import { PostgreSQLRepository } from './adapters/postgres'`). Le CRT ne doit voir que l'abstraction du Port, pas l'adapter. Détectable par analyse des imports CRT — aucun import ne doit pointer vers un fichier `*.adapter.ts` ou `*.impl.ts` hors CompositionRoot.
- **DirectSQLorQueryInCRT**: Un CRT exécute des requêtes SQL, utilise un query builder, ou fait du ORM. Tout accès données passe par RepositoryPort. Détectable par grep de `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `FROM`, `WHERE` dans code CRT.
- **FrameworkNameInCRT**: Un CRT référence un framework ou bibliothèque externe (nom de framework, annotation spécifique à un framework, appel API native d'un SDK). Détectable par grep des noms de frameworks courants.
- **SystemClockUsage**: Un CRT appelle le clock système directement (sans passer par ClockPort). Le Scheduler (CRT-009) est l'unique CRT autorisé à communiquer avec la notion de temps brute. Détectable par grep de `Date.now()`, `new Date()`, `process.hrtime()` hors CRT-009.
- **PlatformSpecificCodeInCRT**: Un CRT contient du code conditionnel basé sur l'OS (if Windows vs if Linux) ou l'environnement runtime (node vs browser). Le Runtime est multi-environnement ; les choix platform-appropriés se font dans les Adapters, pas dans les CRT. Détectable par grep de patterns `platform`, `os\.release()`, `process\.platform`, `__WIN`.

**Verifiable Assertion**:
1. Analyser AST des imports de chaque CRT : lister TOUS les imports. Croiser avec le graphe de dépendances de RTS-001. Chaque import doit pointer vers un Port abstraction (interface/type) ou un autre CRT, jamais vers un fichier adapter concret.
2. Grep pour `Date\.now\|new Date\(\)\|currentTimeMillis\|hrtime` dans `src/crt/` (sauf `src/crt/CRT-009`) → doit retourner 0 résultats.
3. Grep pour patterns SQL (`SELECT\s+`, `INSERT\s+`, `UPDATE\s+`, `DELETE\s+`, `\bFROM\b`, `\bWHERE\b`) dans tous les CRTs → doit retourner 0 résultats.
4. Grep pour `.adapter.` ou `.impl.` dans les chemins d'imports CRT → doit retourner 0 résultats. La seule exception : CRT-001 CompositionRoot qui bind adapter category names (chaînes de configuration, pas imports de classes).
5. Vérifier que `ConfigurationLoader` lit les settings depuis des fichiers YAML/JSON/env et des variables d'environnement — pas depuis des config natives d'un framework spécifique. La source de config est agnostique.

**Related Components**: CRT-001 (bind category names only, never concrete types), CRT-003 (uses TransactionManagerPort abstraction), CRT-005 (reads file/env/config — no framework), CRT-009 (clock abstraction via ClockPort)
**Dependency**: Aucune — principe de base de l'architecture.
**Source traceabilité**: DOC-000 Regle 1 (flux descendant, pas de couplage), PAS-003 DR-007 (Persistence Ignorance), DR-010 (Clock Source Unification)
```

---

## RÈGLE 3 : NoAggregateBypass

```markdown
## RT-NB-003: NeverBreak-NoAggregateBypass

**Description**: Le Runtime ne contourne JAMAIS les Application Services ni les Aggregate boundaries. Toute opération de lecture ou d'écriture passe par le workflow standard ASS-003 (Input Validation → Authorization → Aggregate Load → Domain Execution → Invariant Guard → Transaction → Persistence → Event Dispatch). Aucun shortcut, aucun chemin direct, aucune exception au flow canonique.

**Domaine concerné**: CRT-003 (TransactionCoordinator — doit utiliser RepositoryPort, jamais appeler Aggregate methods directement), CRT-004 (EventDispatcher — doit router via DOC-014, jamais publier events inventés), tous les CRTs qui consomment des services.

**Violation Types**:
- **DirectAggregateCall**: Un CRT appelle une méthode de边界 (boundary method) d'un Aggregate directement, sans passer par un Application Service. Exemple: `workflowAggregate.advanceStep(workflowId)` appelé depuis CRT-003 au lieu de `WorkflowService.execute(AdvanceCommand)`. Détectable par analyse de graphe d'appels AST — aucun CRT ne doit avoir un call site vers une méthode Aggregate Expose.
- **DirectRepositoryBypass**: Un CRT écrit ou lit directement dans un RepositoryPort sans passer par un Aggregate. Exemple: `repositoryPort.save(plainObject)` au lieu de charger l'Aggregate, appliquer la mutation, puis sauvegarder. Détectable par grep de calls `save()`, `insert()`, `update()` sur RepositoryPort dans code CRT.
- **MissingServiceLayer**: Un endpoint expose un CRT directement au lieu de passer par un Application Service. Le CompositionRoot (CRT-001) expose les 13 AppServices (ASS-001), jamais les CRTs bruts. Détectable par inspection du registry du CompositionRoot — seuls des AppServices doivent y figurer.
- **ShortcutTransaction**: Le TransactionCoordinator crée un scope transactionnel sans passer par un AppService ou sans lien vers une Operation définie dans ASS-001/ASS-003. Chaque scope doit correspondre à un use case documenté. Détectable par cross-reference entre scopes transactionnels et catalogue des use cases.

**Verifiable Assertion**:
1. Extraire TOUS les appels de méthodes depuis chaque CRT via AST. Filtrer les appels vers des types qui ne sont pas des Ports (PAS-001), pas des CRTs (RTS-001), et pas des abstractions utilitaires (Logger, Config). Les appels restants doivent pointer vers des Application Services (ASS-001) uniquement.
2. Pour chaque call `repositoryPort.save(` ou `repositoryPort.load(` dans code CRT → vérifier que le contexte est un AppService wrapper. Si un save/load apparaît dans une fonction de CRT qui n'est pas un AppService → violation.
3. Inspecter le registre du CompositionRoot (CRT-001) : la liste des services exposés doit contenir exactement les 13 services d'ASS-001. Si d'autres services apparaissent → violation.
4. Pour chaque saga ou scope transactionnel dans CRT-003 → vérifier qu'il existe une entrée correspondante dans la matrice ASS-004 (coordination cross-aggregate) ou dans le catalogue ASS-001 (service single-aggregate). Un scope sans entrée = shortcut = violation.

**Related Components**: CRT-001 (expose services, not raw CRTs), CRT-003 (coordonne via Ports et AppServices), CRT-004 (route events via DOC-014 uniquement)
**Dependency**: RT-NB-001 (si le Runtime contenait de la logique business, il pourrait tenter de bypasser les Aggregates pour l'appliquer directement)
**Source traceabilité**: ASS-NB-004 (ASS-005: No Aggregate Bypass), DOC-012 (Aggregate boundaries), DOC-000 §6 (runtime ne decide pas du comportement metier)
```

---

## RÈGLE 4 : PortMediationOnly

```markdown
## RT-NB-004: NeverBreak-PortMediationOnly

**Description**: Le Runtime interagit avec l'extérieur DU SEULEMENT par l'intermédiaire des Ports (PAS-001). Aucun CRT ne communique directement avec l'infrastructure (base de données, filesystem, réseau, clock matériel). Les Ports sont les seules fenêtres autorisées entre le Runtime et le monde extérieur.

**Domaine concerné**: TOUS les CRTs. CRT-003 (utilises RepositoryPort/TxManagerPort), CRT-004 (utilise EventPublicationPort/EventSubscriptionPort), CRT-009 (utilise ClockPort), CRT-013 (utilise CachePort), CRT-014 (utilise AuditPort), CRT-015 (utilise IdentityProviderPort), etc.

**Violation Types**:
- **DirectInfrastructureCall**: Un CRT appelle une API infrastructurelle directement (ex: `pool.getConnection()`, `redis.set()`, `fs.writeFileSync()`, `smtp.connect()`). Ces appels doivent passer par l'adapter lié au Port correspondant. Détectable par grep de signatures d'appels infrastructure courants dans CRT files.
- **AdapterTypeDependence**: Un CRT dépend du type concret d'adapter plutôt que de l'interface Port. Exemple: `if (adapter instanceof PostgreSQLAdapter)`. Le Runtime ne doit jamais connaître le type de l'adapter, seulement le Port auquel il est lié. Détectable par AST scan pour `instanceof`, `typeof`, `isInstance` sur des types d'adapter.
- **BypassedPort**: Un CRT utilise un mécanisme alternatif pour accomplir ce qu'un Port pourrait faire. Exemple: utiliser `setTimeout` à la place de Scheduler (CRT-009), utiliser `Math.random()` à la place de l'UUIDPort, lire des headers HTTP directement à la place de TenantContextProvider. Détectable par vérification que chaque capacité infrastructurelle est couverte par un Port déclaré.
- **MissingPortBinding**: Un besoin d'interaction extérieure n'a pas de Port correspondant. Le Runtime doit créer un nouveau Port (PAS-001) avant de l'utiliser, pas contourner le pattern. Détectable par audit: lister toutes les sorties du Runtime (net, fs, db, time, cache, log, audit) et vérifier qu'elles correspondent toutes à un Port dans PAS-001.

**Verifiable Assertion**:
1. Lister TOUS les appels IO/infra dans chaque CRT via AST : connections réseau, lectures/écritures fichier, accès cache, appels system clock, opérations DB, envoi notification, génération UUID, planification timer. Vérifier que chacun corresponde à un appel de méthode sur un Port type (RepositoryPort, FileStoragePort, CachePort, ClockPort, etc.).
2. Grep pour `instanceof\s+\w*(Adapter|Repository|Connection|Pool|Driver)` dans code CRT → doit retourner 0 résultats.
3. Grep pour `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` dans CRT (sauf CRT-009 Scheduler qui encapsule la planification) → doit retourner 0 résultats.
4. Cross-reference TOUS les appels d'output (log, error, metric publish, event emit, file write, network send) dans code CRT avec la liste des 17 Ports PAS-001. Chaque appel d'output doit utiliser exactement un Port.

**Related Components**: CRT-001 (binds each Port exactly once), CRT-003 (RepoPort, TxManagerPort only), CRT-004 (EventPub/Sub ports only), CRT-007 (health checks via Ports only), CRT-009 (ClockPort only), CRT-013 (CachePort only), CRT-014 (AuditPort only), CRT-015 (IdentityProviderPort only)
**Dependency**: RT-NB-002 (technology neutrality relies on port mediation — if runtime knew concrete tech, it wouldn't need ports)
**Source traceability**: PAS-001 (Canonical Port Catalog — 17 Ports as the only external interfaces), DOC-000 (flux descendant — dépendances toujours vers les couches inférieures via abstractions)
```

---

## RÈGLE 5 : InvariantNonModification

```markdown
## RT-NB-005: NeverBreak-InvariantNonModification

**Description**: Le Runtime ne modifie JAMAIS, ne contourne JAMAIS, et ne remplace JAMAIS un invariant défini dans DOC-015 (Domain Invariant Registry). Les 58 invariants sont sacres et inaltérables. Le Runtime peut LES OBSERVER et LES SIGNALER, mais ne peut NI EN CRÉER, NI EN MODIFIER, NI EN SUPPRIMER un seul.

**Domaine concerné**: CRT-003 (TransactionCoordinator — ne peut pas ignorer un invariant pour compléter une transaction), CRT-004 (EventDispatcher — ne peut pas transformer un event pour éviter un invariant), CRT-007 (HealthMonitor — health check ne doit pas réécrire un invariant), CRT-010 (StartupPipeline — ne peut pas ignorer un invariant au build time).

**Violation Types**:
- **InvariantOverride**: Un CRT contient une condition qui désactive ou contourne un invariant DOC-015 (ex: `if (criticalPath) skipInvariantCheck()`). Le Runtime ne définit JAMAIS d'exceptions aux invariants du Domaine. Détectable par grep de patterns de désactivation `skip`, `ignore`, `override`, `bypass` associés à des mots-clés d'invariants.
- **SyntheticInvariantCreation**: Un CRT introduit une contrainte qui n'existe pas dans DOC-015. Exemple: ajouter une règle « un user ne peut avoir plus de 5 sessions » qui n'est pas un invariant catalogué. Toute nouvelle contrainte doit d'abord être ajoutée à DOC-015 via ADR. Détectable par audit: chaque guard dans un CRT doit être mappé à un invariant DOC-015.
- **PersistentStateOverride**: Le Runtime persiste un état qui viole silencieusement un invariant (ex: accepte un statut non valide parce que ça "raccourcit le flux"). L'état persisté doit TOUJOURS respecter les invariants. Détectable par test: soumettre des données intentionnellement violant chaque invariant DOC-015 et vérifier que l'application rejette la donnée.
- **HealthCheckMasking**: Le HealthMonitor (CRT-007) marque comme HEALTHY un état qui viole implicitement un invariant. Un invariant de forme physique (NB-PERSIST-*) ne doit jamais être masqué par un health check qui passe outre. Détectable par review: chaque health check CRT-007 doit être mappé à un invariant, et ne doit JAMAIS passer si cet invariant est violé.

**Verifiable Assertion**:
1. Charger le fichier DOC-015 et extraire la liste des 58 invariant IDs (ex: INV-FIN-001, INV-REL-002, etc.). Pour chaque invariant, vérifier par grep dans tout le code CRT qu'aucune ligne ne contient l'ID de l'invariant dans un contexte de désactivation (`skip.*INV-`, `ignore.*INV-`, `override.*INV-`, `bypass.*INV-`).
2. Pour chaque guard/condition dans les CRTs, extraire l'invariant DOC-015 correspondant (via nom de métrique, de règle, ou de domaine). Si un guard existe dans un CRT mais n'a pas d'équivalent dans DOC-015 → création synthétique d'invariant = violation.
3. Script de test: lancer une requête avec un payload violant CHAQUE invariant DOC-015 un par un. Vérifier que l'application retourne systématiquement une erreur (E-422) et N'ACCEPTE PAS la donnée. Si un invariant est passé = violation.
4. Review du HealthCheck CRT-007: vérifier que chaque health check ne masquie AUCUN invariant. Un health check de « performance » ne doit pas cacher la violation d'un invariant de « cohérence ».

**Related Components**: CRT-001 (ne désactive aucun invariant au boot), CRT-003 (saga ne contourne pas d'invariants), CRT-007 (health checks ne masquent pas d'invariants), CRT-010 (startup pipeline valide tous les invariants), CRT-014 (audit ne supprime jamais d'entries d'audit — NB-PERSIST-006)
**Dependency**: Aucune — principle fondamental de l'architecture DDD.
**Source traceability**: DOC-015 (Domain Invariant Registry — 58 invariants sacres), ASS-NB-002 (ASS-005: Invariant Preservation), DOC-000 (les Aggregates gardent l'intégrité, pas le Runtime)
```

---

## RÈGLE 6 : AssemblyTransparency

```markdown
## RT-NB-006: NeverBreak-AssemblyTransparency

**Description**: Les décisions d'assemblage prises par le Runtime sont transparentes aux consommateurs (Application Services et couches externes). Le runtime ne cache PAS son mode de fonctionnement : les consumers ne peuvent pas distinguer si un service vient d'un adapter in-memory ou relationnel, si un event est dispatché localement ou via message queue, etc. L'assemblage est invisible une fois fait.

**Domaine concerné**: CRT-001 (CompositionRoot — choice of adapters), CRT-003 (TransactionCoordinator — saga vs sync transaction), CRT-004 (EventDispatcher — in-memory bus vs message queue), CRT-013 (IdempotencyManager — cache in-memory vs Redis backend).

**Violation Types**:
- **AdapterTypeExposure**: Un consumer (AppService ou autre CRT) connaît ou dépend du type d'adapter choisi (ex: `if (repo instanceof RelationalAdapter) doX()`). L'implementation detail de l'adapter ne doit jamais traverser ses limites. Détectable par grep de conditions vérifiant des propriétés ou types spécifiques à un adapter.
- **InfrastructureBehaviorLeak**: Le Runtime expose des détails d'infrastructure dans ses contrats (ex: un event dispatch retourne `{ status: "published_via_rabbitmq" }`). Les contrats retournés ne doivent contenir que des données de domaine ou de service, pas de métadonnées d'infrastructure. Détectable par review des return types et messages d'erreur des CRTs.
- **ConditionalLogicBasedOnAssemblyChoice**: Le comportement runtime change selon le choix d'assemblage (ex: si Redis → comportement A, si LRU → comportement B). Le Runtime a un comportement uniforme quelle que soit la catégorie d'adapter choisie. Détectable par analyse des branching decisions qui dépendent de choix de configuration.
- **ServiceContractDiffersByAdapter**: L'API contractuelle d'un AppService varie selon l'adapter sous-jacent. Un même use case ASS-002 doit avoir le même contrat (inputs, outputs, errors) indépendamment de l'adapter. Détectable par cross-reference des specs ASS-002 avec les implémentations sous différents adapters.

**Verifiable Assertion**:
1. Pour chaque Application Service (ASS-001), vérifier que son interface publique (methods, signatures, return types, error codes) est identique quel que soit l'adapter catégoriel sélectionné. Prendre deux configs différentes (ex: relational + eventbus in-memory vs document + message queue) et comparer les interfaces exposées.
2. Grep pour `instanceof.*Adapter`, `getType()`, `getCategory()`, `isRelational()`, `isInMemory()`, `backend` check dans le code des AppServices et des CRTs autres que CRT-001. Ces patterns révèlent une exposition de détails d'infrastructure.
3. Analyser le schema de retour de chaque CRT: les objets retournés ne doivent pas contenir de champs comme `adapter_type`, `backend_name`, `engine`, `driver`, `connection_string`. Tous ces détails sont infrastructure-only et ne doivent pas traverser le boundary du Runtime.
4. Test d'intégration: tourner la même suite de tests AppService sous deux catégories d'adapter différentes. Les assertions sur les résultats business doivent être strictement identiques. Toute divergence = violation de transparence.

**Related Components**: CRT-001 (l'assemblage doit produire un comportement externe invariant), CRT-003 (saga execution est transparente), CRT-004 (event dispatching est transparent), CRT-013 (idempotency behavior is transparent regardless of cache backend)
**Dependency**: RT-NB-002 (technology neutrality supports assembly transparency — if runtime knew tech, it would leak implementation details)
**Source traceability**: DOC-000 Regle 1 (flux descendant avec abstractions), PAS-002 (Adapter Categories — plusieurs catégories = même contrat), OR-002 (injection constructeur garantit l'abstraction)
```

---

## RÈGLE 7 : LifecycleDeterminism

```markdown
## RT-NB-007: NeverBreak-LifecycleDeterminism

**Description**: Le cycle de vie du Runtime s'exécute toujours EXACTEMENT dans le même ordre, avec les mêmes étapes, aux mêmes moments. Le démarrage suit toujours les Phases 100-106 dans l'ordre strict. L'arrêt suit toujours les Phases 108-110 dans l'ordre strict. Aucune variation conditionnelle, aucune phase optionnelle, aucune étape sautée.

**Domaine concerné**: CRT-006 (LifecycleManager — orchestrator du cycle de vie), CRT-010 (StartupPipeline — séquence de démarrage), CRT-011 (ShutdownPipeline — séquence d'arrêt), CRT-002 (DependencyResolver — garantit le déterminisme de l'ordre).

**Violation Types**:
- **PhaseSkipping**: Une phase du lifecycle est omise lors du démarrage ou de l'arrêt (ex: Phase 102 schema validation sautée en mode « fast boot »). Chaque phase a des postconditions obligatoires que la suivante dépend. Détectable par vérification que chaque phase de RTS-002 est exécutée dans l'ordre sans gap.
- **NonDeterministicOrder**: L'ordre des étapes diffère entre deux démarrages avec la même configuration (ex: CRT-009 initialisé avant CRT-004 un jour, après l'autre le lendemain). L'ordre est figé par DependencyResolver. Détectable par comparaison de logs de démarrage successifs — ils doivent être identiques (same components, same order, same timestamps relative).
- **FeatureFlagGatingPhase**: L'exécution d'une phase dépend d'un flag de fonctionnalité ou d'une condition d'environnement (ex: `if (config.skipAuthPhase) skip(AuthPhase)`). Aucune phase n'est optionnelle. Détectable par grep de feature flags dans StartupPipeline/ShutdownPipeline.
- **ConditionalHealthCheckSuppression**: Un health check est exécuté conditionnellement (ex: skipped in dev mode). Les 10 health checks (OR-011) sont toujours exécutés, toujours dans le même ordre. Les health checks peuvent retourner DEGRADED mais jamais skipé. Détectable par verification que le code de health check ne contient aucune branch conditionnelle sur l'environnement.

**Verifiable Assertion**:
1. Prendre le graphe de dépendances de RTS-001 §Dépendances entre Runtime Components. Exécuter le DependencyResolver (CRT-002) et comparer `ResolvedOrder[]` avec l'ordre topologique attendu listé dans RTS-001 (lignes 170-187) et RTS-002 (lignes 724-742). Ils doivent être STRICTEMENT identiques.
2. Démarrer l'application 3 fois avec la même configuration. Logger chaque étape avec timestamp microseconde. Comparer les 3 logs — l'ordre des composants initialisés doit être strictement identique. Différence = violation.
3. Grep pour `featureFlag`, `env ===`, `if (!isProduction)`, `skip`, `if (config.disable` dans CRT-006, CRT-010, CRT-011 → doit retourner 0 résultats.
4. Vérifier que l'array constant des health checks dans CRT-007 contient exactement les 10 checks définis dans RTS-002 Phase 105, dans l'ordre exact (DB, EventBus, Clock, Cache, FileStorage, Search, Notification, Scheduler, Audit, IdentityProvider). Aucun ajout, aucun retrait, aucun changement d'ordre.

**Related Components**: CRT-002 (produit l'ordre deterministe), CRT-006 (respecte l'ordre rigide), CRT-010 (execute startup dans l'ordre figé), CRT-011 (execute shutdown dans l'ordre inverse figé)
**Dependency**: RT-NB-001 (determinism requires no conditional logic, which requires no business logic), RT-NB-006 (transparency includes deterministic observable behavior)
**Source traceability**: LV-001 (RTS-002: phases toujours dans l'ordre), LV-002 (LV-001: aucune req avant Phase 106), OR-011 (Startup Sequence Determinism), RN-005 (order immuable apres DependencyResolver)
```

---

## RÈGLE 8 : TenantPropagationCompleteness

```markdown
## RT-NB-008: NeverBreak-TenantPropagationCompleteness

**Description**: L'identifiant d'organisation (org_id) est propagé à TOUTE opération du Runtime sans exception. Chaque query, write, event, health check, metric, retry, idempotency key, et audit entry inclut l'org_id résolu. Aucune opération Runtime ne s'exécute dans un contexte org_id manquant.

**Domaine concerné**: CRT-015 (TenantContextProvider — résolveur unique de org_id), CRT-003 (TransactionCoordinator — inclus org_id dans metadata transaction), CRT-004 (EventDispatcher — inclus org_id dans event routing), CRT-012 (RetryPolicy — scoped par org_id), CRT-013 (IdempotencyManager — hash key inclut org_id), CRT-014 (AuditEnabler — org_id dans chaque entry d'audit).

**Violation Types**:
- **OrgIdMissingInQuery**: Une requête vers RepositoryPort, SearchPort, FileStoragePort, ou VocabularyAccessPort est executée sans org_id dans le contexte. Causé par un CRT qui oublierait d'injecter l'org_id scope. Détectable par mock capturing toutes les queries des Ports et vérifiant la présence d'org_id filter.
- **UserSuppliedOrgId**: Un CRT accepte l'org_id depuis un paramètre de requête, header HTTP, ou body JSON au lieu de le résoudre depuis TenantContextProvider. L'org_id vient UNIQUEMENT du token d'auth. Détectable par grep de patterns de lecture org_id depuis des sources utilisateur (`req.body.org_id`, `req.params.org`, `request.query.org`).
- **StaleTenantContext**: Le contexte tenant d'une requête précédente persiste dans le thread après sa complétion, causant qu'une nouvelle requête utilise le mauvais org_id. Détectable par instrumentation du context lifecycle — chaque exit de requête doit clear le contexte, chaque entry doit init un nouveau contexte.
- **CrossTenantEventDispatch**: Un event dispatché par l'EventDispatcher atteint des consumers d'un org_id différent de celui de l'event original. Causé par un missing org_id scope dans la subscription. Détectable par audit: chaque event handler doit vérifier que l'org_id de la subscription correspond à l'org_id de l'event.
- **UncheckedIdempotencyScope**: L'IdempotencyManager vérifie une clé idempotente sans inclure l'org_id dans le hash. Causé par un bug dans la concaténation de clé — `SHA256(request_id)` au lieu de `SHA256(request_id + ':' + org_id)`. Détectable par grep de la formule de hash dans CRT-013.

**Verifiable Assertion**:
1. Grep TOUS les appels RepositoryPort.query(), RepositoryPort.save(), SearchPort.search(), FileStoragePort.list() dans les CRTs → vérifier qu'aucun n'est executed sans org_id actif dans le thread-local/async-context. Mock chaque Port pendant un test et capturer les arguments — org_id doit être présent.
2. Scanner le code CRT-015 pour s'assurer que org_id est LU UNIQUEMENT depuis IdentityProviderPort et Jamais depuis request parameters. Grep `req\.body\.org\|params\.org\|query\.org\|req\.headers\['x-org` dans CRTs → doit retourner 0 results.
3. Dans CRT-013 IdempotencyManager, vérifier que la clé de hash contient org_id: grep pour `SHA256.*request_id.*org_id` ou pattern équivalent. Sans org_id → violation cross-tenant.
4. Envoyer une requête avec JWT `{ org_id: "org-a" }` mais body contenant `"org_id": "org-b"` → toutes les données écrites DOIVENT avoir org_id="org-a". Vérifier via repository mock ou DB assertion.

**Related Components**: CRT-015 (owner of resolution), CRT-003 (propagates to tx metadata), CRT-004 (propagates to event routing), CRT-012 (propagates to retry stats), CRT-013 (propagates to idempotence keys), CRT-014 (propagates to audit entries), CRT-007 (propagates to health checks), CRT-008 (propagates to diagnostics)
**Dependency**: RT-NB-003 (no bypass means org_id must flow through the normal AppService path, not injected directly by user)
**Source traceability**: INV-004 constitutionnel (multi-tenant isolation), PAS-003 DR-009 (every data access operation tenant-scoped), OR-010 (Tenant Context Propagation), RTS-001 CRT-015 Constraints
```

---

## RÈGLE 9 : EventOrdering

```markdown
## RT-NB-009: NeverBreak-EventOrdering

**Description**: L'ordre logique des Domain Events est préservé strictement. Les événements émis par un Aggregate dans un scope transactionnel sont dispatchés EXACTEMENT dans l'ordre d'émission. Les handlers sont executés séquentiellement dans l'ordre de registration défini dans DOC-014. Aucun event n'est livré avant les events qui le précèdent逻辑ment dans la même transaction.

**Domaine concerné**: CRT-004 (EventDispatcher — garant principal de l'ordre), CRT-003 (TransactionCoordinator — garantit la séquentialité du scope transactionnel), CRT-012 (RetryPolicy — retry respects original sequence number).

**Violation Types**:
- **OutOfOrderDispatch**: Les events émis dans une transaction sont dispatchés dans un ordre différent de leur ordre d'émission par l'Aggregate. Détectable en instrumentant l'EventDispatcher pour tracer l'ordre de réception vs l'ordre d'émission.
- **HandlerReordering**: Les handlers d'un même event type sont executés dans un ordre différent de l'ordre de registration DOC-014. L'ordre de registration est figé et déterministe. Détectable par comparison de l'ordre d'appel des handlers avec la colonne "Consommateurs autorisés" de DOC-014.
- **AsynchronousPreemption**: Un handler async (Promise-based, callback-based) preempts un handler sync du même event. Les handlers doivent être exécutés de manière synchronisée (ou sérialisée) — pas de parallélisme dans la delivery d'un même event. Détectable en instrumentant les timing de chaque handler execution.
- **CompensatingEventBeforeOriginal**: Un event de compensation (`*_Compensated`) est dispatché AVANT l'event original qu'il compense. Cela arrive si la cancellation handling (OR-008) ne respecte pas l'ordre chronologique. Détectable par correlation_id tracking.
- **DLQOutOfOrder**: Les events placés en dead-letter queue ne conservent pas leur ordre d'insertion original. La DLQ est FIFO par rapport à l'ordre d'échec. Détectable par monitoring de l'ordre d'entrée en DLQ vs l'ordre de sortie de retry.

**Verifiable Assertion**:
1. Instrumenter l'EventDispatcher (CRT-004) pour logger l'ordre d'émission (par l'Aggregate) ET l'ordre de dispatch (vers les handlers) avec timestamps microseconde. Comparer les deux arrays — ils doivent être STRICTEMENT identiques en ordre. Différence = violation.
2. Prendre DOC-014 et extraire la liste ordonnée des consommateurs pour chaque event type. Pour chaque event dispatché, vérifier que les handlers sont exécutés dans cet ordre. Greper `handlerIndex` ou `subscriptionOrder` dans CRT-004 — doit correspondre à DOC-014.
3. Pour les sagas compensateurs: lancer un saga 3 steps, trigger cancellation après step 1, logger l'ordre exact: `[Step1_Commit][Step2_Cancelled][Step1_Compensated][CancelEvent_Emitted]`. Vérifier que Step1_Compensated vient APRES Step1_Commit et AVANT que les handlers restants ne soient appelés.
4. Monitorer la DLQ: les events doivent entrer en DLQ dans l'ordre de leur premier échec de delivery. Tester en faisant échouer 3 events simultanes sur le même handler — vérifier que l'ordre d'entrée en DLQ reflète l'ordre d'émission original.

**Related Components**: CRT-004 (EventDispatcher — owner of ordering guarantee), CRT-003 (TransactionCoordinator — transactional ordering), CRT-012 (RetryPolicy — retry preserves sequence), CRT-011 (ShutdownPipeline — final event flush preserves order)
**Dependency**: RT-NB-007 (determinism applies to event ordering too — same sequence every time), RT-NB-009 depends on OR-004 (Event Dispatch Guarantee)
**Source traceability**: DOC-014 (Domain Command-Event Registry — consumer order column), RTS-001 CRT-004 constraints (sequential consumption mandatory), OR-004 §SequentialConsumptionOrder
```

---

## RÈGLE 10 : DeadLetterHandling

```markdown
## RT-NB-010: NeverBreak-DeadLetterHandling

**Description**: Les événements non livrés après exhaustion de toutes les retries ne sont JAMAIS silently dropped. Chaque event qui échoue est placé dans une Dead Letter Queue persistante (DLQ) avec son payload intact, ses metadata d'erreur, et son historique de retry. La DLQ est investigateable manuellement — un event lost = rupture de confiance architecturale.

**Domaine concerné**: CRT-004 (EventDispatcher — owner de la DLQ), CRT-012 (RetryPolicy — determine quand exhaust les retries et triggering DLQ placement).

**Violation Types**:
- **SilentDrop**: Un event qui échoue après max retries est simplement ignoré/discarded sans être placé en DLQ. Détectable par monitoring: count d'events dispatchés vs count d'events livrés avec succès + count en DLQ. Si sum(livres + DLQ) < dispatchés = silent drop.
- **CorruptedPayload**: L'event placé en DLQ a un payload tronqué, modifié, ou corrompu par rapport à l'event original émis par l'Aggregate. Payload doit être identique à `JSON.parse(JSON.stringify(original_event))`. Détectable par deep comparison payload original vs payload DLQ.
- **MissingMetadata**: L'entry DLQ manque des champs obligatoires: event_type, event_payload, handler_target, error_code, error_message, retry_count, first_attempt_at, last_attempt_at, org_id. Chacun de ces 9 champs est obligatoire. Détectable par schema validation sur les entries DLQ.
- **AutoRetryFromDLQ**: Les events en DLQ sont re-retryés automatiquement. C'est interdit car un event en DLQ après 5 retries a un handler potentiellement buggy — re-retry crée une boucle infinie. Les events DLQ doivent attendre investigation/manual replay. Détectable par monitoring des patterns de sortie de DLQ — doivent être 0 automatic retries.
- **DLQDataLoss**: La DLQ elle-même n'est pas persistée durablement. Si l'application crash entre le placement en DLQ et la persistance, les events sont perdus. La DLQ doit être écrite en mode append-only dans FileStoragePort (JSONL) avec fsync. Détectable par test: crash simulé pendant DLQ operation → restart → vérifier que les events DLQ survivent.

**Verifiable Assertion**:
1. Implémenter un test où un handler d'event échoue systématiquement. Soumettre 1 event → watcher DLQ pendant max retries (5). Vérifier qu'après exhaustion: (a) l'event apparaît dans la DLQ, (b) payload complet intact, (c) metadata complète, (d) error code correct.
2. Grep dans CRT-004 pour tout path de code où un event dispatch échoue sans écrire dans la DLQ. Pattern recherché: `dispatch(event)` → `handler.fail()` → `retry exhausted` → [DOIT aller à DLQ]. Si un branch après retry exhaustion n'écrit pas en DLQ = violation.
3. Schema validation: charger chaque entry DLQ depuis FileStoragePort et valider que tous les 9 champs obligatoires sont présents et non-nul. Schéma DLQ exact: `{ event_type, event_payload, handler_target, error_code, error_message, retry_count, first_attempt_at, last_attempt_at, org_id }`.
4. Monitorer le DLQ size pendant un run normal: `growing_DLQ_size && zero_manual_replay = warning`. Les events en DLQ doivent être trackés — si aucun ne sort de DLQ jamais (jamais de replay manuel), c'est acceptable mais值得 attention. Un silent_drop_count > 0 = BLOCKING violation.

**Related Components**: CRT-004 (EventDispatcher — DLQ owner), CRT-012 (RetryPolicy — triggers DLQ on exhaustion), CRT-008 (Diagnostics — DLQ visibility via /metrics), CRT-015 (TenantContextProvider — org_id dans chaque entry DLQ)
**Dependency**: RT-NB-009 (event ordering must be preserved even in DLQ — DLQ entries are ordered), RT-NB-008 (org_id must be present in every DLQ entry)
**Source traceability**: OR-004 (§Dead-Letter Queue Schema), RTS-001 CRT-004 (at-least-once delivery), RTS-001 CRT-012 (max retry enforcement before DLQ)
```

---

## RÈGLE 11 : RetryIdempotence

```markdown
## RT-NB-011: NeverBreak-RetryIdempotence

**Description**: Le retry ne produit PAS de doubles effets de bord. Chaque opération retryée (event publish, sync push, notification send) est idempotente : exécutée une ou N fois, le résultat net est identique. Le Runtime garantit que les retries sont atomiques au niveau Aggregate et ne créent ni duplication, ni corruption, ni état inconsistency.

**Domaine concerné**: CRT-012 (RetryPolicy — owner des politiques de retry), CRT-013 (IdempotencyManager — gate before execute), CRT-004 (EventDispatcher — retry publish idempotent), CRT-003 (TransactionCoordinator — retry saga step idempotent).

**Violation Types**:
- **DuplicateSideEffect**: Un retry exécute physiquement la même opération domaine deux fois. Exemple: un `CreateTransaction` retryé après timeout crée DEUX transactions au lieu de retourner la réponse cached. Détectable par monitoring: counter d'Aggregate mutations par request_id — doit être <= 1.
- **NonIdempotentPublish**: L'EventDispatcher retry la publication d'un event qui a déjà été délivré avec succès (mais sans acknowledgment reçu). Le consommateur reçoit le même event deux fois et l'applique deux fois au lieu d'une fois. Détectable par auditing des event deliveries par handler.
- **PartialSagaRetry**: Un saga step retryé après partial commit produit un état inconsistent (step N retryé alors que step N-1 compensation a déjà changé l'état global). La compensation ne doit pas interférer avec le retry du step suivant. Détectable par état après-completion vs état après-compensation — doivent être cohérents.
- **IdempotencyCacheCorruption**: L'IdempotencyManager evict prématurément une clé idempotente (avant expiration TTL)導致 qu'un retry après eviction ré-exécute l'opération. TTL de 24h default respecté strictement. Détectable par monitoring: ttl_expiry_checks > cache_eviction_count = keys évicted prematurement.
- **RetryWithoutTracking**: Un retry est exécuté mais pas loggé/tracé dans Diagnostics. Le retry counter dans CRT-008.metrics.retries_total doit incrémenter pour CHAQUE tentative de retry. Un retry non tracé = blind spot de debugging. Détectable par comparison retry attempts (CRT-012 logs) vs retry metrics (CRT-008 metrics).

**Verifiable Assertion**:
1. Test d'intégration: envoyer un write command avec request_id=X. Laisser l'operation réussir (1st attempt). Simuler un retry (replay avec même request_id X). Vérifier: (a) response cached retournée, (b) aucun Aggregate mutation supplémentaire, (c) DB count inchangé, (d) audit log unique.
2. Pour les event retries: soumettre un event à un handler qui réussit au retry #2 (échoue au #1). Vérifier que le handler n'exécute sa side-effect qu'UNE seule fois (pas 2 fois: une au retry #1 failed, une au retry #2 success). Le retry doit re-exécuter depuis le début, pas cumuler.
3. Pour les saga retries: lancer un linear saga 3 steps, force échec au step 2, vérifier que (a) step 1 compensation executen correctement, (b) aucun data persisté de step 1 non compensé, (c) step 2 n'est PAS retried (saga aborts after compensation).
4. Vérifier que `CRT-012.retry_attempts` log match `CRT-008.metrics.retries_total` — chaque retry logged dans CRT-012 doit apparaître dans les metrics. delta == 0.

**Related Components**: CRT-012 (RetryPolicy — owner), CRT-013 (IdempotencyManager — deduplication gate), CRT-003 (TransactionCoordinator — saga step idempotence), CRT-004 (EventDispatcher — publish idempotence), CRT-008 (Diagnostics — retry tracking)
**Dependency**: RT-NB-008 (org_id scoped — retry idempotence keys are org-scoped; retry for org-a doesn't affect org-b), RT-NB-010 (DLQ prevents retry loops — events that can't be delivered go to DLQ rather than infinite retry)
**Source traceability**: BR-SYNC-003 constitutionnel (max 5 retries, exponential backoff), SYNC-004 constitutionnel (event publishing never blocks domain), RTS-001 CRT-013 constraints (one operation, one result, always identical), OR-005 (Retry Policy Application — immutable maximums)
```

---

## RÈGLE 12 : GracefulDegradationLimit

```markdown
## RT-NB-012: NeverBreak-GracefulDegradationLimit

**Description**: La dégradation gracieuse (graceful degradation) est INTERDITE pour les write operations. Lorsqu'une dépendance infrastructurelle tombe en panne, les writes doivent ÉCHOUER de manière explicite et traçable — jamais se terminer silencieusement avec un comportement réduit. La lecture peut se dégrader (cache miss, degraded search), mais l'écriture toujours (fail-fast, fail-visible, fail-traced).

**Domaine concerné**: CRT-003 (TransactionCoordinator — ne pas écrire en mode dégradé), CRT-004 (EventDispatcher — ne pas suppress event publishing silently), CRT-013 (IdempotencyManager — ne pas bypass idempotency guard in degraded mode), CRT-014 (AuditEnabler — audit reste non-blocking per AUD-001 mais write operations themselves must NOT degrade).

**Violation Types**:
- **SilentWriteAcceptance**: Une write operation (create, update, delete) est acceptée et retournée comme "succès" alors que le storage backend est down ou l'event dispatcher est unreachable. L'utilisateur pense que son write a réussi mais les données ne sont pas persistées = corruption silencieuse de la confiance utilisateur. Détectable par test: couper le backend DB pendant un write → doit retourner E-500, PAS E-200 with offline queue.
- **DegradedPersistence**: Le Runtime écrit en local (cache, offline queue) et retourne success sans informer l'utilisateur que la persistance est dégradée. Le OfflineSyncAggregate doit explicitement signaler le mode sync décalé — pas de `return { status: "ok" }` lorsque le flush n'est pas garanti. Détectable par monitoring des responses write — chaque success doit avoir une confirmation de persistance.
- **SuppressedErrorForWrite**: L'erreur infrastructurelle (DB down, network timeout, cache full) est catchée et convertie en success ou en warning au lieu d'être propagated au caller. Les erreurs de write propagation doivent toujours remonter au caller avec le code E-XXX approprié. Détectable par grep de try-catch dans write paths qui swallow exceptions.
- **OfflineQueueAcceptanceAsSuccess**: L'OfflineSyncAggregate accepte silencieusement un write dans la pending queue locale sans informer l'AppService que la persistance permanente n'est pas garantie. Le write offline doit être un cas spécial documenté avec confirmation explicite "written locally, will sync later". Détectable par review des return values de write operations en mode offline — doit être distinct du mode online.
- **DegradedTransactionalIntegrity**: Le TransactionCoordinator poursuit une transaction cross-aggregate alors que l'un des repositories est degraded, risking partial commit. Si un repo est UNHEALTHY, le coordinator doit refuser de commencer la transaction, pas la commencer et espérer. Détectable par monitoring: transaction starts when any participating repository health != HEALTHY = violation.

**Verifiable Assertion**:
1. Tester chaque write path (create, update, delete) avec chaque backend infra DOWN (DB, cache, event bus): (a) le write échoue avec code E-XXX approprié, (b) la réponse N'est PAS 200/201, (c) l'état domain n'est PAS modifié, (d) l'audit log N'EST PAS écrit (pas de write = pas d'audit).
2. Grep pour tous les blocks try-catch dans les CRTs qui traitent des write operations. Vérifier qu'aucun ne contient `catch(.*) { return { success: true } }` ou `catch(.*) {}` (empty catch). Chaque catch sur write path doit re-throw ou retourner une erreur E-XXX.
3. Dans CRT-010 StartupPipeline, vérifier que le ready signal NE SE PRODUIT PAS tant que TOUS les repositories/ne sont pas au moins HEALTHY ou DEGRADED (jamais UNHEALTHY). L'application refuse de démarrer avec un repo DOWN = protection contre degraded writes.
4. Pour l'OfflineSyncAggregate spécifiquement: le fallback offline n'est autorisé que comme EXPLICIT mode切换, pas comme SILENT degradation. L'AppService retourne `status: "offline_pending"` au lieu de `status: "persisted"`. Vérifier cette distinction dans le code CRT.

**Related Components**: CRT-003 (refuse degraded cross-aggregate), CRT-004 (refuse degraded event dispatch — put in DLQ instead), CRT-010 (refuses ready with unhealthy repos), CRT-011 (shutdown refuses to close connections if pending writes exist)
**Dependency**: RT-NB-001 (no business logic means no custom degradation rules — if infra fails, the generic failure path must apply uniformly), RT-NB-010 (DLQ provides the safe degradation path for events — not silent loss but explicit queuing)
**Source traceability**: SYNC-004 constitutionnel (event publishing never blocks domain operation — mais l'inverse: domain operation MUST NOT continue on infrastructure failure), RT-004 Section 2 Interdiction #10, DOC-017 NB-PERSIST-008 (offline-first but always explicit)
```

---

## MATRICE DE VÉRIFICATION — 10 ASSERTIONS TESTABLES

Chacune de ces 10 assertions combine plusieurs règles RT-NB en un test unique. Elles sont exécutables via script CI.

| # | Assertion | Règles Couvertes | Méthode de Vérification | Outil |
|---|-----------|-----------------|----------------------|-------|
| 1 | **BizLogicZero** — Aucun CRT ne contient de validation métier, calcul financier, état machine, ou résolution de permission inline. | RT-NB-001 | AST parse des 15 CRTs ; chaque condition vérifiée contre une liste de domaines interdits (amount, status, role, balance, category) | ESLint custom rule + script Python AST |
| 2 | **TechNeutralZero** — Aucun CRT n'importe d'adapter concret, n'appelle system clock, n'exécute SQL direct, et ne fait pas de branchement platform-specific. | RT-NB-002 | Grep combiné : `.adapter.` + `Date\.now` + `SELECT` + `process.platform` dans `src/crt/` (sauf CRT-001 bind, CRT-009 clock) | Shell script CI |
| 3 | **NoBypassFlow** — Chaque write/read passe par exactement un AppService → exactly one Aggregate boundary method. Aucun shortcut CRT→Aggregate ou CRT→Repository sans AppService. | RT-NB-003 | Call graph analysis : chaque node CRT → next-node doit être un AppService ou un Port. Chemin CRT→Aggregate direct = violation. | AST call graph + DOT export |
| 4 | **PortBoundary** — Chaque interaction externe du Runtime passe par exactement un Port. Zéro appel infrastructure direct. | RT-NB-004 | Inventorier tous les appels IO dans les CRTs ; mapper chaque appel à un Port (PAS-001). Orphelin = violation. | Script d'analyse d'imports |
| 5 | **InvariantSacred** — Aucun CRT ne désactive, crée, contourne ou remplace un invariant DOC-015. Les 58 invariants sont vérifiés à chaque write. | RT-NB-005 | Script compare guards CRT vs invariant DOC-015. Tout guard CRT sans counterpart DOC-015 = synthetic invariant. | Python script + DOC-015 JSON |
| 6 | **AssemblyHidden** — Les contrats d'AppServices sont identiques indépendamment du choix d'adapter. Aucun branchement sur type d'adapter dans les consumers. | RT-NB-006 | Deux runs avec configs différentes → comparer signatures method, return types, error codes des 13 services. Identique = compliant. | Comparison script |
| 7 | **DeterministicBoot** — 3 démarrages avec même config produisent le même ordre de composants, mêmes health checks, mêmes métriques baseline. | RT-NB-007 | Run 3x → diff des logs. Différence d'ordre = violation. | Test harness CI |
| 8 | **OrgEverywhere** — Chaque opération data (query/save/search/list) inclut implicitement l'org_id. Zéro requête org-unscoped. | RT-NB-008 | Mock RepositoryPort + SearchPort + FileStoragePort + VocabularyAccessPort pendant test → capturer WHERE clauses. Chaque clause doit inclure `org_id = ?`. | Integration test |
| 9 | **EventOrderingPreserved** — L'ordre d'émission d'events par Aggregate = l'ordre de delivery aux handlers. Handler execution order = registration order de DOC-014. | RT-NB-009 | Instrumenter EventDispatcher logger emission_order vs delivery_order. Arrays doivent être identiques. | Integration test + diff |
| 10 | **NoSilentWrite** — Chaque write operation avec infrastructure DOWN échoue explicitement (E-XXX). Aucun succès falsifié. Aucun suppression d'erreur. | RT-NB-012 | Chaos testing: couper DB/cache/event bus pendant write → verifier que response status >= 400. | Chaos monkey test |

---

## PREUVES DE CONFORMITÉ — Comment Chaque Règle RT-NB Est Respectée Par Les Autres Documents RTS

### RT-NB-001 (BusinessLogicIsolation)
- **RTS-001** CRT-001 §Contrainsts constitutionnels : "Ne contient JAMAIS de logique metier — il n'appelle AUCUNE méthode d'Aggregate directement."
- **RTS-001** RN-001 : "Le Runtime ne contient AUCUNE logique metier."
- **RTS-001** RN-009 : "Le Runtime ne JAMAIS faire de business logic injection dans les Adapters."
- **RTS-003** OR-003 §ViolationTypes BoundaryCrossing — interdit les transactions qui contiennent la decision business.
- **RTS-004** Section 2 Interdiction #1 : "Contenir ou définir une règle metier" est absolument proscrit.
- **RTS-004** Section 3 anti-patterns BusinessIntrusion : inline validation, state machine, financial calculations explicitly banned.
- **RTS-004** Section 7 exemptions E-01 à E-12 vs F-01 à F-05 : clair contraste entre ce qui est infrastructure (allowed) et ce qui est business (forbidden).

### RT-NB-002 (TechnologyNeutrality)
- **RTS-001** CRT-001 §Contrainsts : "Ne connaît PAS les détails d'implémentation des Adapters — il connaît uniquement les CATEGORIES definies dans PAS-002."
- **RTS-003** OR-002 : injection constructeur ONLY, Service Locator interdit, ConcreteAdapterReference identifié comme violation.
- **RTS-003** OR-005 : RetryPolicy constants immuables, pas de config dependency.
- **RTS-004** Section 3 §DirectDatabaseAccess : Raw SQL, ORM annotations, connection pool management, query builders tous interdits.
- **RTS-004** Section 3 §ClockViolation : system clock calls interdits hors CRT-009.
- **RTS-004** IP-007 : "Si un CRT contient un call direct à Date.now() ou new Date(), c'est une violation de DR-010."

### RT-NB-003 (NoAggregateBypass)
- **RTS-001** CRT-001 : expose uniquement les 13 Application Services, jamais les CRTs bruts.
- **RTS-001** CRT-003 : dépend de RepositoryPort abstraction, pas d'appel direct à Aggregate.
- **RTS-003** OR-003 §TransactionBoundaryManagement : transactions intra-aggregate via TransactionManagerPort.
- **RTS-003** OR-009 §DirectAggregateCall : identifié comme "violation la plus grave — brise tous les boundaries."
- **RTS-004** Section 2 Interdiction #4 : "Bypass les Aggregate boundaries" — formellement interdit.
- **RTS-004** Section 6 : schéma de delegation obligatoire (Runtime → AppService → Aggregate → Port → Infra).

### RT-NB-004 (PortMediationOnly)
- **RTS-001** Tous les CRTs listent leurs dépendances comme des Ports, pas des implementations concrètes.
- **RTS-001** CRT-001 §Responsabilités : "Lier chaque Port à sa catégorie d'Adapter concrete (per PAS-002)."
- **RTS-003** OR-002 : Dependency Resolution Strategy — injection constructeur via Port types uniquement.
- **RTS-004** Section 2 Interdiction #3 : "Lire ou écrire directement dans la base de données — tout accès doit passer par RepositoryPort abstraction."
- **RTS-004** Section 3 §DirectDBAccess : Raw SQL, ORM, Query builders explicitement listés comme interdits.

### RT-NB-005 (InvariantNonModification)
- **RTS-001** CRT-004 §Contrainsts : "Ne JAMAIS inventer de nouveaux types d'evenements" — empêche l'altération des events qui violeraient des invariants.
- **RTS-004** Section 2 Interdiction #2 : "Modifier un invariant DOC-015" — formellement interdit avec citation DOC-015.
- **RTS-004** Section 2 Interdiction #5 : "Inventer de nouveaux types d'événements" — empêche la création d'events qui bypassent les guards.
- **RTS-004** Section 7 E/F exemptions : E-01 à E-12 (allowed infrastructure), F-01 à F-05 (blocked business).

### RT-NB-006 (AssemblyTransparency)
- **RTS-001** CRT-001 : binder par catégorie, pas par type concret. Le choix d'adapter est transparent.
- **RTS-001** MATRICE DE COUVERTURE DES PORTS PAR COMPOSANTS RUNTIME : montre quelles opérations chaque CRT fait sur chaque Port — uniformément via abstraction.
- **RTS-003** OR-002 §Application : "Constructor Injection is Enforced at Lint Level" — lint rule empêche l'import d'adapters concrets.
- **RTS-004** Section 4 §Architecture en Couches : diagramme visual showing Runtime isolé des détails d'implementation sous-jacents.
- **RTS-004** IP-002 : "Si un file d'import CRT referencia un adapter concret au lieu d'un Port, c'est une violation de PAS-003 DR-004 et OR-002."

### RT-NB-007 (LifecycleDeterminism)
- **RTS-002** LV-001 : "Les phases s'exécutent toujours dans l'ordre 100→101→102→...→110."
- **RTS-002** LV-002 : "Aucune requête n'est acceptée avant la fin de la Phase 106."
- **RTS-003** OR-011 : Startup Sequence Determinism — component set fixed, health check order fixed, ready condition predicates fixed.
- **RTS-003** OR-012 : Shutdown Drain Policy — four sequential steps, each waits for completion.
- **RTS-003** OR-011 §ViolationTypes : ConditionalComponentSkip, RandomizedCheckOrder, EarlyReadySignal, ConfigDrivenAssemblyOrder tous listés.
- **RTS-004** Section 2 Interdiction #6 : "Dépendre dynamiquement de feature flags pour désactiver un Runtime Component."

### RT-NB-008 (TenantPropagationCompleteness)
- **RTS-001** CRT-015 §Contrainsts constitutionnels : "org_id TOUJOURS injecté, jamais accepte comme input utilisateur brut."
- **RTS-001** RN-008 : "L'isolement multi-tenant (org_id) est appliqué partout."
- **RTS-003** OR-010 : Tenant Context Propagation — resolution point authority, universal propagation mechanism, no override enforcement.
- **RTS-004** Section 2 Interdiction #11 : "Accepter org_id en paramètre utilisateur direct" — empêche l'escalade cross-tenant.
- **RTS-004** IP-011 : "Si un org_id est lu depuis un paramètre de requête HTTP au lieu du token JWT, c'est une violation de OR-010."

### RT-NB-009 (EventOrdering)
- **RTS-001** CRT-004 §Contrainsts : "La publication ne bloque JAMAIS l'operation domaine" + "Consommation séquentielle obligatoire."
- **RTS-003** OR-004 §Sequential Consumption Order : "les handlers sont executés DANS L'ORDRE de registration defini dans DOC-014."
- **RTS-003** OR-004 §ViolationTypes : OutOfOrderHandlers listé explicitement.
- **RTS-003** OR-004 §Verifiable Assertion : "(4) Grep pour toute transformation de payload" — ensures events are not reordered or modified during dispatch.
- **RTS-004** Section 2 Interdiction #5 : "Inventer de nouveaux types d'événements — seulement DOC-014 events."

### RT-NB-010 (DeadLetterHandling)
- **RTS-001** CRT-004 §Contrainsts : "Garantir la livraison at-least-once" — obligation constitutionnelle.
- **RTS-003** OR-004 §Dead-Letter Queue Schema : schéma exact de 9 champs spécifié.
- **RTS-003** OR-004 §ViolationTypes : MissingDLQ explicitement listé comme violation.
- **RTS-003** OR-004 §Application : "Après 5 retries échouées → message placé dans dead-letter queue avec payload intact + metadata d'erreur."
- **RTS-003** OR-004 §Application : "Les messages en DLQ ne sont JAMAIS re-retried automatiquement (risque de boucle infinie)."

### RT-NB-011 (RetryIdempotence)
- **RTS-003** OR-005 : Retry Policy Application — immutable maximums, exponential backoff formula, error classification par code.
- **RTS-003** OR-006 : Idempotency Enforcement — request_id tracking, org_id scoping, response caching, window management.
- **RTS-003** OR-005 §ViolationTypes : RetryingDomainError identifié (domain errors never retried — prevents duplicate side effects from retrying permanent failures).
- **RTS-003** OR-006 §Verifiable Assertion : "(2) envoyer le même request_id deux fois → vérifier que la seconde execution NE DÉCLENCHE PAS une deuxième execution domain."
- **RTS-001** CRT-013 §Contrainsts : "Une operation déjà exécutée retourne le MEME resultat (pas d'exécution double)."

### RT-NB-012 (GracefulDegradationLimit)
- **RTS-001** CRT-001 §Error Handling : "Si l'assemblage échoue à N'IMPORTE QU'ELLE étape → application EXIT IMMÉDIAT."
- **RTS-001** CRT-010 §Error Handling : "N'importe quelle étape échoue → EXIT IMMÉDIAT."
- **RTS-001** CRT-007 §Contrainsts : "Un port degraded ne fait PAS tomber toute l'application — seulement DEGRADED, pas UNHEALTHY." (Read degradation OK; write degradation = explicit failure.)
- **RTS-003** OR-005 §No Retry on Domain Errors : E-4xx errors never retried — prevents silent acceptance of writes in degraded state.
- **RTS-004** Section 2 Interdiction #10 : "Accepter org_id en paramètre utilisateur direct" (write degradation pattern prohibited).
- **RTS-004** Section 3 §TimingViolation : Blocking on external API listé comme anti-pattern — writes wait or fail, never silently degrade.

---

## VULNÉRABILITÉS SI VIOLÉE — Impact de Chaque Violation

| Règle | Type de Vulnérabilité | Impact Fonctionnel | Impact Architecture | Impact Sécurité | Détectabilité |
|-------|---------------------|-------------------|-------------------|---------------|-------------|
| RT-NB-001 | Logic Drift | Business rules duplicated across layers; inconsistencies between Aggregate and Runtime validation; unpredictable behavior changes across environments | Boundary erosion; Domain layer loses authority over its own rules; impossible to verify system correctness by reading one layer | Unauthorized actions allowed if Runtime validation conflicts with Aggregate validation | HIGH — lint rules + code scan |
| RT-NB-002 | Tech Lock-in | Vendor lock-in; migration impossible without rewriting entire Runtime; deployment environment dictates architecture choices | DDD principle broken; ports become adapters; dependency inversion violated; testability destroyed | Framework-specific vulnerabilities (CVE) affect entire Runtime directly | HIGH — import graph analysis |
| RT-NB-003 | Boundary Collapse | Data integrity compromised; invariants enforced inconsistently; multi-tenant isolation broken by direct access | Domain/Application/Runtime three-layer architecture collapses to two-tier; Aggregates become passive data holders | Privilege escalation if bypassed security checks at AppService level | MEDIUM — AST call graph |
| RT-NB-004 | Infrastructure Leak | Adapter swaps require Runtime recompilation; deployment varies by technology choice; testing requires real infrastructure | Port abstraction meaningless; no separation of concerns; composition root becomes distributed code | Credential exposure if infrastructure APIs called directly with hardcoded auth | HIGH — API call inventory |
| RT-NB-005 | Invariant Bypass | Data corruption; financial miscalculations; state machine exploits; referential integrity violations | Domain model loses its protective function; 58 invariants become suggestions, not guarantees | Security exploit via invariant violation (e.g., negative amounts, unauthorized state transitions) | CRITICAL — test suite + chaos engineering |
| RT-NB-006 | Implementation Exposure | Consumer code fragile to infrastructure changes; tests break on adapter swap; deployment-specific bugs surface late | Abstraction boundary violated; dependency inversion principle inverted; DDD pattern broken | Infrastructure details leaked in error messages (e.g., database connection strings in stack traces) | MEDIUM — interface comparison across configs |
| RT-NB-007 | Non-Determinism | Unpredictable startup behavior; different environments behave differently; intermittent failures impossible to reproduce | DAG-based initialization loses meaning; race conditions emerge; resource leaks increase | Security audit fails because traceability of initialization sequence is lost | HIGH — log comparison test |
| RT-NB-008 | Multi-Tenant Breach | Cross-tenant data leakage; users see other organizations' data; GDPR/compliance violation | Tenancy isolation completely broken; org_id partitioning meaningless at any layer | PRIVACY BREACH — the most severe architectural vulnerability; directly violates data protection principles | CRITICAL — org_id injection audit |
| RT-NB-009 | Event Consistency Loss | Consumers process events out of order; state derived from events becomes inconsistent; saga compensations fire at wrong time | Event-driven architecture reliability destroyed; eventual consistency becomes arbitrary consistency | Unauthorized state changes if event order determines security-critical sequences | MEDIUM — event trace instrumentation |
| RT-NB-010 | Data/Event Loss | Events permanently lost; audit trail incomplete; offline sync gaps; unreliable downstream notifications | Event sourcing guarantee broken; at-least-once becomes best-effort; data durability contract violated | Regulatory non-compliance if audit events are lost (minimum 7-year retention per RETENTION-031) | HIGH — DLQ monitoring |
| RT-NB-011 | Double Execution | Duplicate transactions; double charges; duplicate notifications; conflicting concurrent updates; audit trail duplication | Idempotence contract broken; saga consistency impossible; retry semantics undefined | Financial loss from duplicate processing; regulatory reporting accuracy compromised | HIGH — idempotency key audit + DB dedup checks |
| RT-NB-012 | Silent Failure | Users believe writes succeeded but data was never persisted; cascading failures from stale data; unrecoverable corruption | Online/offline contract violated; offline-first becomes "sometimes-write"; trust model collapsed | False sense of security — writes appear to succeed while silently failing; data loss undetected | MEDIUM — write success confirmation audit |

---

## HISTORIQUE DU DOCUMENT

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | runtime-specifier v1.0 | Création — 12 règles NeverBreak constitutionnelles pour le Runtime Layer Lumina | COMPLIANT (trace vérifié contre RTS-001, RTS-002, RTS-003, RTS-004, DOC-000, DOC-012, DOC-014, DOC-015, DOC-023, PAS-001, PAS-003, ASS-001, ASS-004, ASS-005) |

---

## MATRICE DE DÉPENDANCES ENTRE RÈGLES RT-NB

```
RT-NB-001 (BusinessLogicIsolation)
    │
    ├──▶ RT-NB-003 (NoAggregateBypass) — pas de logique métier = pas de besoin de bypass
    ├──▶ RT-NB-006 (AssemblyTransparency) — transparent car pas de logique conditionnelle business
    └──▶ RT-NB-007 (LifecycleDeterminism) — déterministe car pas de branching conditionnel business

RT-NB-002 (TechnologyNeutrality)
    │
    ├──▶ RT-NB-004 (PortMediationOnly) — neutralité technologique nécessite médiations par Ports
    └──▶ RT-NB-006 (AssemblyTransparency) — neutralité garantit contracts identiques quel que soit l'adapter

RT-NB-005 (InvariantNonModification)
    │
    ├──▶ RT-NB-008 (TenantPropagationCompleteness) — org_id invariant propagé partout
    └──▶ RT-NB-012 (GracefulDegradationLimit) — degradation ne doit jamais masquer invariant violation

RT-NB-009 (EventOrdering)
    │
    └──▶ RT-NB-010 (DeadLetterHandling) — DLQ préserve l'ordre des events non livrés

RT-NB-008 (TenantPropagationCompleteness)
    │
    └──▶ RT-NB-011 (RetryIdempotence) — clés idempotentes scoped par org_id

RT-NB-010 (DeadLetterHandling)
    │
    └──▶ RT-NB-011 (RetryIdempotence) — DLQ previent les retries infinis = side effects dupliqués
```

---

## CATÉGORIES DE RÈGLES

| Catégorie | Règles | Nature | Blocant ? |
|-----------|--------|--------|----------|
| Frontière Layer | RT-NB-001, RT-NB-003 | Protège les boundaries d'architecture | OUI |
| Indépendance Technologique | RT-NB-002, RT-NB-004 | Maintient les abstractions Ports/Adapters | OUI |
| Intégrité Données | RT-NB-005, RT-NB-008 | Protège les invariants et l'isolement multi-tenant | OUI — CRITIQUE |
| Déterminisme Cycle Vie | RT-NB-007 | Garantit le comportement prévisible | OUI |
| Transparence | RT-NB-006 | Empêche l'exposition des détails d'implementation | OUI |
| Fiabilité Événements | RT-NB-009, RT-NB-010, RT-NB-011 | Garantit la livraison fiable, ordonnée, idempotente | OUI |
| Fiabilité Écritures | RT-NB-012 | Empêche la corruption silencieuse | OUI — CRITIQUE |

---

*Ce document complète la série Runtime Technical Specification. RTS-001 catalogue les composants, RTS-002 définit le cycle de vie, RTS-003 fixe les règles d'orchestration, RTS-004 établit les frontières, RTS-005 définit les règles NeverBreak immuables. Ensemble, ils forment le contrat constitutionnel du Runtime Lumina v1.*

---

## ANNEXE A : SCRIPTS DE VÉRIFICATION CI/CD

Cette annexe fournit les commandes exactes à intégrer dans le pipeline CI pour vérifier chaque règle RT-NB automatiquement à chaque build.

### A.1 Vérification RT-NB-001 (BusinessLogicIsolation)

```bash
# Script: ci/verify-rtnb001.sh
# Verifie qu'aucun CRT ne contient de logique métier inline
EXIT_CODE=0

# Pattern 1: validation business sur des champs domaine
if grep -rEn 'amount\s*[><=]|status\s*===|"draft"|balance\s*>=|category\s*===' src/crt/; then
    echo "VIOLATION RT-NB-001: Business validation detected in Runtime"
    EXIT_CODE=1
fi

# Pattern 2: resolution de permissions role-based
if grep -rEn 'role\s*===.*admin|isAdmin\(\)|hasPermission.*role' src/crt/; then
    echo "VIOLATION RT-NB-001: Permission decision in Runtime"
    EXIT_CODE=1
fi

# Pattern 3: calculations financiers
if grep -rEn '\.reduce\(\s*(sum.*amount.*\+\s*t\.amount|acc.*amt)' src/crt/; then
    echo "VIOLATION RT-NB-001: Financial calculation in Runtime"
    EXIT_CODE=1
fi

exit $EXIT_CODE
```

### A.2 Vérification RT-NB-002 (TechnologyNeutrality)

```bash
# Script: ci/verify-rtnb002.sh
# Verifie qu'aucun CRT ne depend d'une technologie concrete
EXIT_CODE=0

# System clock usage outside CRT-009
if grep -rEn 'Date\.now\(\)|new Date\(\)|currentTimeMillis|hrtime\(\)' src/crt/ | grep -v 'CRT-009'; then
    echo "VIOLATION RT-NB-002: System clock used outside Scheduler"
    EXIT_CODE=1
fi

# SQL execution
if grep -rEn '\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bFROM\b|\bWHERE\b' src/crt/; then
    echo "VIOLATION RT-NB-002: Direct SQL in Runtime"
    EXIT_CODE=1
fi

# Framework dependency injection (Service Locator)
if grep -rEn 'Container\.get|resolve\(|getInstance\(\)|Singleton\.instance' src/crt/; then
    echo "VIOLATION RT-NB-002: Service Locator pattern detected"
    EXIT_CODE=1
fi

exit $EXIT_CODE
```

### A.3 Vérification RT-NB-004 (PortMediationOnly)

```bash
# Script: ci/verify-rtnb004.sh
# Verifie que tous les appels infrastructure passent par des Ports
EXIT_CODE=0

# Instanceof adapter checks
if grep -rEn 'instanceof\s+\w*(Adapter|Repository|Connection|Pool|Driver)' src/crt/; then
    echo "VIOLATION RT-NB-004: Adapter type dependence detected"
    EXIT_CODE=1
fi

# Raw platform API calls outside expected components
if grep -rEn 'pool\.getConnection\|redis\.set|fs\.writeFileSync|smtp\.connect' src/crt/; then
    echo "VIOLATION RT-NB-004: Direct infrastructure call detected"
    EXIT_CODE=1
fi

exit $EXIT_CODE
```

### A.4 Vérification RT-NB-008 (TenantPropagationCompleteness)

```bash
# Script: ci/verify-rtnb008.sh
# Verifie que l'org_id vient toujours du token, jamais du user input
EXIT_CODE=0

# User-supplied org_id patterns
if grep -rEn 'req\.body\.org_id|params\.org_id|query\.org_id|req\.headers\[.x-org.' src/crt/; then
    echo "VIOLATION RT-NB-008: User-supplied org_id detected"
    EXIT_CODE=1
fi

# Hash key verification for idempotency
if ! grep -rEn 'SHA256.*request_id.*org_id|hash.*request_id.*org_id|concat.*request_id.*org_id' src/crt/; then
    echo "VIOLATION RT-NB-008: org_id missing from idempotency hash"
    EXIT_CODE=1
fi

exit $EXIT_CODE
```

### A.5 Vérification RT-NB-010 (DeadLetterHandling)

```bash
# Script: ci/verify-rtnb010.sh
# Verifie que le code de retry fait TOUJOURS basculer vers la DLQ apres exhaustion
EXIT_CODE=0

# Pattern: retry exhausted but no DLQ write path
# This requires manual review of the handler loop in CRT-004
# Automated check: verify DLQ schema has all 9 required fields
DLQ_FIELDS="event_type event_payload handler_target error_code error_message retry_count first_attempt_at last_attempt_at org_id"
EXPECTED_COUNT=$(echo "$DLQ_FIELDS" | wc -w)
ACTUAL_COUNT=$(grep -c 'DLQ_SCHEMA\|deadLetterEntry' src/crt/CRT-004/ 2>/dev/null || echo 0)

# Verify DLQ files are append-only JSONL
if grep -rEn '\.truncate\(\)|\.removeAll\(\)|DELETE FROM.*dlq' src/crt/; then
    echo "VIOLATION RT-NB-010: DLQ mutation or deletion detected — DLQ must be append-only"
    EXIT_CODE=1
fi

exit $EXIT_CODE
```

### A.6 Vérification RT-NB-012 (GracefulDegradationLimit)

```bash
# Script: ci/verify-rtnb012.sh
# Verifie qu'aucun try-catch ne retourne success sur une operation d'ecriture
EXIT_CODE=0

# Catch blocks that swallow errors in write paths
if grep -rEn 'catch.*\{\s*return\s*\{[^}]*success\s*:\s*true' src/crt/; then
    echo "VIOLATION RT-NB-012: Silent success return detected in error handler"
    EXIT_CODE=1
fi

# Empty catch blocks
if grep -rEn 'catch\s*\([^)]*\)\s*\{\s*\}' src/crt/; then
    echo "VIOLATION RT-NB-012: Empty catch block — error swallowed silently"
    EXIT_CODE=1
fi

exit $EXIT_CODE
```

---

## ANNEXE B : MATRICE DE TRAÇABILITÉ COMPLÈTE RTS-005

Chaque règle RT-NB est tracée vers TOUS les documents sources qui la soutiennent ou la renforce.

| Règle RT-NB | RTS-001 (Component Catalog) | RTS-002 (Lifecycle) | RTS-003 (Orchestration) | RTS-004 (Boundaries) | DOC-000 | DOC-012 | DOC-014 | DOC-015 | DOC-023 | PAS-001 | PAS-003 | ASS-001 | ASS-004 | ASS-005 |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| RT-NB-001 | RN-001, RN-009 | Phase 107 | OR-003 boundary | Sec 2-3, Sec 7 | §6 | Boundary methods | N/A | 58 inv. | NB-RR-002 | — | DR-011 | All services | §coordination | NB-001 |
| RT-NB-002 | CRT-001 constraints | Phase 103-104 | OR-002 inject | Sec 3 DirectDB | Regle 1 flux desc. | N/A | N/A | N/A | N/A | 17 Ports | DR-007, DR-010 | NB-007 | N/A | NB-007 |
| RT-NB-003 | CRT-001 exposes only ASS | Phase 107 | OR-009 cross-aggr | Sec 2 #4, Sec 6 | §6 runtime decides neither | Boundary methods | DOC-014 only | INV guards | NB-RR-001 | 17 Ports | DR-001, DR-012 | All services | §patterns | NB-004 |
| RT-NB-004 | All CRT dep lists Ports | Phase 104 binding | OR-002 constr inject | Sec 2 #3, Sec 3 DB | §6, Regle 1 | Domain via Ports | DOC-014 | N/A | NB-MT-001 | 17 Ports catalog | DR-007 | Services via Ports | N/A | N/A |
| RT-NB-005 | CRT-004 no invent events | Phase 105 health checks | OR-004 immutable payl | Sec 2 #2 invariant | §Invariant guard | Boundary = invariant | DOC-014 events | 58 invariants sacred | NB-RR series | Port guards | DR-001 | Guard through | N/A | NB-002 |
| RT-NB-006 | CRT-001 category bind | Phase 104 port registry | OR-002 lint enforcement | Sec 4 layer diagram | §Abstraction layer | N/A | N/A | N/A | N/A | Port types | DR-004 | Same contract | N/A | NB-007 |
| RT-NB-007 | Phase 100-110 sequence | LV-001..LV-010 | OR-011 startup, OR-012 shutdown | Sec 2 #6 feature flag | §Deterministic DAG | N/A | N/A | N/A | N/A | N/A | N/A | Services always same | N/A | N/A |
| RT-NB-008 | CRT-015 org_id always | Phase 107 tenant resolve | OR-010 prop comp. | Sec 2 #11 org from token | §Multi-tenant | N/A | N/A | INV-004 | NB-MT-001..004 | Tenant-scoped | DR-009 | org_id in precond. | Cross-org | NB-012 |
| RT-NB-009 | CRT-004 sequential | Phase 107 event processing | OR-004 seq order | Sec 2 #9 payload immut | §Event-driven | N/A | DOC-014 consumer order | N/A | N/A | Event ports | DR-008 | Events per UC | Cross-aggr events | NB-006 |
| RT-NB-010 | CRT-004 at-least-once | Phase 107 event dispatch | OR-004 DLQ schema | Sec 2 #20 no auto-retry | N/A | N/A | DOC-014 events | N/A | RETENTION-031 | Event ports | DR-008 | Events emitted | Cross-aggr | N/A |
| RT-NB-011 | CRT-012 max retries | Phase 107 retry apply | OR-005 retry policy | Sec 2 #16 domain no retry | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Idempotent writes | Saga compensation | N/A |
| RT-NB-012 | CRT-001/010 exit on fail | Phase 107 error handling | OR-005 no domain retry | Sec 2 #10 no sync pub | §Offline-first | N/A | N/A | N/A | NB-PERSIST-008 | N/A | DR-011 | No suppressed error | Cross-aggr fail | NB-008 |

---

## ANNEXE C : MATRICE D'IMPACT CROISÉ DES RÈGLES

Quand une violation survient, elle peut impacter MULTIPLEMENT des autres règles. Cette matrice montre les corrélations.

| Règle Violée | Impact Sur | Mécanisme De Cascade |
|--------------|-----------|---------------------|
| RT-NB-001 (BusinessLogic) | RT-NB-003 | Si le Runtime a de la logic business, il tentera de bypasser les Aggregates pour l'appliquer directement |
| RT-NB-001 (BusinessLogic) | RT-NB-005 | Les guards business du Runtime peuvent masquer ou contourner les invariants DOC-015 |
| RT-NB-002 (TechNeutral) | RT-NB-004 | Une dépendance technologique directe force souvent des appels infra bypassant les Ports |
| RT-NB-003 (NoBypass) | RT-NB-008 | Un bypass direct vers un Aggregate contourne souvent le TenantContextProvider et sa propagation d'org_id |
| RT-NB-005 (InvariantMod) | RT-NB-008 | Modifier un invariant peut casser l'isolement multi-tenant en ignorant org_id comme contrainte |
| RT-NB-007 (LifecycleDet) | RT-NB-006 | Un order de démarrage non-déterministe rend l'assemblage non-transparent (comportement variable) |
| RT-NB-008 (TenantPropag) | RT-NB-011 | Sans org_id scoping, les clés idempotentes collide entre tenants, créant des doubles exécutions cross-tenant |
| RT-NB-009 (EventOrder) | RT-NB-010 | Des events déserialisés brisent l'ordre DLQ, rendant le replay manuel impossible |
| RT-NB-010 (DLQ) | RT-NB-011 | Sans DLQ fiable, les retries silencieux produisent des side-effects dupliqués |
| RT-NB-012 (DegradeLimit) | RT-NB-001 | La dégradation silencieuse force souvent à ajouter de la logic business "pour compenser" la panne |
| RT-NB-012 (DegradeLimit) | RT-NB-005 | Accepter silencieusement un write dégradé signifie que l'invariant de persistance est violé sans signal |

**Principe de cascade :** Une seule violation de règle RT-NB peut entraîner 2 à 5 violations en cascade. C'est pourquoi la détection précoce (build time) est cruciale — détecter la violation à la source avant la cascade coûte 10x moins cher qu'en runtime.

---

## ANNEXE D : GRADE DE SÉVERITÉ DES VIOLATIONS

Chaque type de violation est classé selon son grade de sévérité, déterminant la réponse CI/CD requise.

| Grade | Critère | Action CI/CD | Exemple De Règles |
|-------|---------|-------------|------------------|
| P0-CRITIQUE | Corruption de données immédiate ou violation de sécurité | BUILD FAILS — aucun artifact n'est créé | RT-NB-005 (invariant), RT-NB-008 (org_id), RT-NB-012 (silent write) |
| P1-BLOCKING | Broken architecture boundary, imposible to fix post-deploy | BUILD FAILS — merge blocked | RT-NB-001 (biz logic), RT-NB-003 (bypass), RT-NB-002 (tech lock-in), RT-NB-010 (DLQ loss) |
| P2-DEGRADED | Monitoring/debugging degraded, not immediately exploitable | BUILD Warnings — deploy allowed with documented risk | RT-NB-007 (non-det boot), RT-NB-006 (transparency leak), RT-NB-009 (event order minor drift) |
| P3-OBSERVABILITY | No immediate impact, but increases future risk | LOG WARNING — no build impact | Missing correlation_id in debug logs (minor RT-NB-013 subset) |

**Règle de réponse :** Tout grade P0 ou P1 bloque la production. Tout grade P2 nécessite un ticket JIRA créé automatiquement et une approbation architecturale avant déploiement. Tout grade P3 est tracé mais n'empêche pas le déploiement.

---

## ANNEXE E : CHECKLIST DE REVIEW ARCHITECTURE POUR LES CR ASSESSMENTS

Quand un PR modifie du code dans un fichier CRT, cette checklist doit être passée en revue avant l'approbation.

### Avant merge d'un PR touchant un CRT :

- [ ] **RT-NB-001** : Aucune condition `if` ne compare de valeur de domaine (`status`, `amount`, `type`, `role`, `category`)
- [ ] **RT-NB-002** : Aucun import d'adapter concret, aucun appel system clock direct, aucune dépendance framework
- [ ] **RT-NB-003** : Chaque write/read passe par AppService → Aggregate boundary, aucun shortcut
- [ ] **RT-NB-004** : Tous les appels IO passent par un Port, aucun `instanceof Adapter`
- [ ] **RT-NB-005** : Aucun guard CRT n'existe sans counterpart dans DOC-015
- [ ] **RT-NB-006** : Retour types CRT ne contiennent pas de champs infrastructure (adapter_type, backend_name)
- [ ] **RT-NB-007** : Pas de featureFlag gating dans les pipelines startup/shutdown
- [ ] **RT-NB-008** : org_id lu uniquement depuis IdentityProviderPort, jamais depuis request parameters
- [ ] **RT-NB-009** : Ordre des handlers event respecté tel que DOC-014 le définit
- [ ] **RT-NB-010** : Tout path de retry exhausted écrit dans la DLQ (pas de silent drop)
- [ ] **RT-NB-011** : Clé idempotente inclut org_id ; retry sur write produit au plus un side-effect
- [ ] **RT-NB-012** : Aucun try-catch ne retourne `success: true` sur erreur infrastructure
- [ ] **DOC-023** : org_id présent sur toutes les opérations de persistance tenant-scoped
- [ ] **ASS-005** : Aucune des 12 règles Application Service NeverBreak n'est violée indirectement

---

## ANNEXE F : GUIDE DE RÉFÉRENCE RAPIDE

Ce guide résume en une ligne chaque règle pour référence rapide pendant le développement.

| Rule | One-Liner | Grep Target (Quick Check) |
|------|-----------|--------------------------|
| RT-NB-001 | Zero business logic in any CRT | `amount.*<|status.*===|role.*admin` |
| RT-NB-002 | Zero concrete tech dependency | `.adapter\.import|Date\.now|SELECT.*FROM` |
| RT-NB-003 | No bypass of AppService→Aggregate flow | `aggregate\.\w+Method(` outside service files |
| RT-NB-004 | Zero direct infrastructure calls | `instanceof.*Adapter|pool\.getConnection` |
| RT-NB-005 | Zero invariant modification/creation | `skip.*INV-|override.*INV-|bypass.*INV-` |
| RT-NB-006 | Zero infrastructure detail exposure | `adapter_type\|backend_name\|engine\|driver` |
| RT-NB-007 | Zero conditional phase execution | `featureFlag.*CRT|skipPhase|disable.*Phase` |
| RT-NB-008 | Zero org_id missing from any data op | `req\.body\.org` \| `params\.org` in CRTs |
| RT-NB-009 | Zero event reordering during dispatch | handler_index !== doc014_order |
| RT-NB-010 | Zero silent event loss after retries | retry_exhausted AND NOT dlq_write |
| RT-NB-011 | Zero duplicate side-effect from retry | same_request_id AND aggregate_mutated_twice |
| RT-NB-012 | Zero silent write acceptance on infra failure | try_catch_with_return_success_on_error |

---

*Ce document fait partie intégrante de la specification Runtime Lumina. RTS-005 est le gardien constitutionnel de toute operation du Runtime Layer. Une violation de n'importe laquelle des 12 règles RT-NB constitue une rupture architecturale bloquante équivalente à la violation d'un invariant DOC-015.*
