# Runtime Lifecycle Specification — Lumina v1
**Doc ID:** RTS-002
**Version:** v1.0
**Statut:** SPÉCIFICATION RUNTIME DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-000", "DOC-012", "RTC-001", "ASS-003"]
**Transformation_rule :** "runtime-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit le cycle de vie complet du Runtime Lumina, découpé en **10 phases séquentielles** couvertes par le **LifecycleManager (CRT-006)**. Chaque phase spécifie ses préconditions, actions, postconditions, erreurs possibles et récupérations, composants actifs et durée (startup / ongoing / shutdown).

L'ordre est strict : aucune phase ne peut débuter tant que la précédente n'a pas signalé son achèvement. Le **DependencyResolver (CRT-002)** garantit cet ordre topologique. Le **StartupPipeline (CRT-010)** couvre les phases 1-7 (démarrage). Le **ShutdownPipeline (CRT-011)** couvre les phases 9-10 (arrêt). La **Phase 8 (Traitement Normal)** est l'état stable de l'application entre startup et shutdown.

```
┌──────────────────────────────────────────────────────────┐
│                      PROCESSUS APPLICATION               │
├──────────────────────────────────────────────────────────┤
│ Phase 1: INITIALISATION NULLE              [startup]     │
│   → zéro composant actif, vérifications OS/mémoire       │
├──────────────────────────────────────────────────────────┤
│ Phase 2: CHARGEMENT CONFIGURATION          [startup]     │
│   → ConfigurationLoader charge settings                  │
├──────────────────────────────────────────────────────────┤
│ Phase 3: VALIDATION SCHEMA DATA            [startup]     │
│   → 32 tables vérifiées via PersistenceVerificationPort  │
├──────────────────────────────────────────────────────────┤
│ Phase 4: ASSEMBLAGE COMPOSANTS           [startup]     │
│   → CompositionRoot crée les 15 Runtime Components       │
├──────────────────────────────────────────────────────────┤
│ Phase 5: ASSEMBLAGE ADAPTATORS             [startup]     │
│   → Ports liés à leurs Adapters concrets                 │
├──────────────────────────────────────────────────────────┤
│ Phase 6: VALIDATION RUNTIME                [startup]     │
│   → HealthMonitor ping toutes les connexions             │
├──────────────────────────────────────────────────────────┤
│ Phase 7: OUVERTURE RUNTIME               [startup]     │
│   → READY signalé, Scheduler commence, requêtes acceptées│
├──────────────────────────────────────────────────────────┤
│ Phase 8: TRAITEMENT NORMAL                   [ongoing]   │
│   → Operations, Sagas, Events, Retry, Idempotence        │
├──────────────────────────────────────────────────────────┤
│ Phase 9: SIGNAL D'ARRÊT              [shutdown]         │
│   → Drain opérations, plus de nouvelles requêtes         │
├──────────────────────────────────────────────────────────┤
│ Phase 10: NETTOYAGE                    [shutdown]         │
│   → Fermeture connexions, sauvegarde state, exit propre  │
└──────────────────────────────────────────────────────────┘
```

---

## PHASES SÉQUENTIELLES

### Phase 100: INITIALISATION NULLE

**Préconditions**:
- Processus applicatif créé par le système d'exploitation (OS)
- Aucun composant Lumina n'est encore instancié (état total nul)
- Variables d'environnement `PATH`, `HOME` (ou équivalent OS) sont résolues
- MémoireRAM disponible ≥ seuil minimum configurable (défaut : 256 Mo)

**Actions**:
1. Le runtime hôte alloue un bloc mémoire réservé pour ses structures internes de base : contexte tenant global, buffers de logging initial, ring buffer circulaire de taille fixe (configurable, défaut 1024 entries)
2. Il appelle les fonctions de vérification OS spécifiques à la plateforme courante :
   - Sur Linux/Unix : `uname()` pour version kernel, `/proc/meminfo` pour RAM disponible, `/proc/cpuinfo` pour nombre de CPUs
   - Sur macOS : `sysctlbyname()` pour version Darwin, `host_statistics64()` pour mémoire et CPU
   - Sur Windows : `GetVersionExW()` pour version NT, `GlobalMemoryStatusEx()` pour RAM, `GetSystemInfo()` pour CPUs
3. Il vérifie que la version minimale du runtime cible est satisfaite (version de JVM si Java, CLR si .NET, node --version si JavaScript, Python si Python):
   - Minimum JVM: version 17 (LTS)
   - Minimum .NET: version 7.0 SDK compatible
   - Minimum Node.js: version 20 LTS
   - Minimum Python: version 3.11
   - Version inférieure → EXIT IMMÉDIAT avec code E-BOOT-002
4. Il réserve les handles de signaux OS qui seront utilisés par LifecycleManager pour intercepter les demandes d'arrêt :
   - Unix : `SIGINT` (Ctrl+C terminal), `SIGTERM` (kill/ordonnanceur), `SIGQUIT` (core dump signal)
   - Windows : `CTRL_CLOSE_EVENT` (fermeture console), `CTRL_LOGOFF_EVENT` (déconnexion), `CTRL_BREAK_EVENT` (Ctrl+Break)
   - Les handlers de signaux sont installés AVANT toute autre opération pour éviter les races conditions
5. Il initialise le Logger de niveau DEBUG avec un buffer circulaire en mémoire (ring buffer de taille fixe, contenu ring buffer non persisté). Le logger supporte trois sorties simultanées : stderr (console), fichier local (rolling log file), et mémoire tampon pour debug dumps
6. Il exécute un test de write rapide sur le répertoire de données local (`$LUMINA_DATA_DIR` ou `$XDG_DATA_HOME/lumina`) pour vérifier les permissions d'écriture. Le test consiste à créer un fichier temporaire `boot-test-<pid>`, écrire une string, le lire, puis le supprimer
7. Il mesure le temps système disponible (disque libre en Go) et la charge CPU actuelle (load average sur 1min/5min/15min ou équivalent Windows) comme baseline avant toute activité applicative
8. Si une variable d'environnement `LUMINA_BOOT_TRACE=1` est présente, le runtime active le tracing détaillé de chaque opération boot (chaque allocation, chaque verification, cada check est loggé au niveau TRACE avec timestamp microseconde)
9. Il instancie un thread de monitoring de santé minimal (sans connexion aux composants Lumina) qui surveillera la disponibilité mémoire du processus lui-même. Ce thread utilise un intervalle de polling de 5 secondes et alerte si la consommation mémoire dépasse 80% duRSS limit (prévention des OOM killer OS)
10. Il vérifie qu'aucune autre instance de Lumina n'est déjà en cours d'exécution :
    - Mécanisme Unix : fichier lock `$DATA_DIR/.lumina.lock` avec contenu = PID courant. Si le fichier existe, le PID est lu et vérifié via `kill -0`. Si le process existe → EXIT (E-BOOT-004). Si inactif → lock corrompu, supprimé et continuation
    - Mécanisme Windows : mutex nommé `Global\LuminaRuntime-{instance-id}` avec timeout d'acquisition de 500ms. Si acquisition échoue → EXIT (E-BOOT-004)
11. Il valide que le répertoire `$DATA_DIR/lumina-data/` existe et est accessible en lecture+écriture. Si inexistant, il est créé automatiquement (mkdir -p, chmod 750)
12. Il réserve les descriptors de fichiers utilisés pour le ring buffer de logs et le fichier de lock. Ces descriptors sont fermés proprement à la Phase 110

**Postconditions**:
- Zéro composant Lumina actif (état total nul)
- Vérifications OS complétées : version runtime confirmée, platform compatibility validée
- Vérifications mémoire complétées : RAM disponible >= 256 Mo (configurable), load baseline mesurée
- Handles de signaux OS enregistrés et prêts à intercepter SIGINT/SIGTERM/SIGQUIT
- Logger de niveau DEBUG fonctionnel (buffer circulaire uniquement, output vers stderr + fichier)
- Permission write testée et validée sur `$DATA_DIR/lumina-data/`
- Mutex/lock anti-double-instance acquis (aucune autre instance Lumina en cours)
- Thread monitoring de santé minimal actif (surveillance mémoire du processus lui-même)
- Baseline system metrics capturée (CPU, RAM, disk space, load average)

**Erreurs possibles**:
- Insufficient memory (< 256 Mo disponibles) → EXIT IMMÉDIAT avec code erreur E-BOOT-001 et message clair vers stderr contenant le seuil attendu vs mesuré
- OS incompatibility (version kernel trop ancienne, features manquantes) → EXIT IMMÉDIAT avec code erreur E-BOOT-002 et nom de l'OS incompatible
- Runtime host version insuffisante (JVM < 17, Node < 20, etc.) → EXIT IMMÉDIAT avec code erreur E-BOOT-002 et version minimale requise vs installée
- Insufficient disk write permission → EXIT IMMÉDIAT avec code erreur E-BOOT-003 et chemin du répertoire problématique
- Another instance already running (PID détecté actif) → EXIT avec code erreur E-BOOT-004 et message demandant de fermer l'autre instance (PID affiché)
- Corrupted lock file (processus mort mais lock présent) → WARNING, lock corrompu supprimé automatiquement, continuation
- Missing required environment variables ($LUMINA_DATA_DIR non défini, etc.) → EXIT avec code erreur E-BOOT-005, liste des variables manquantes fournie avec valeurs par défaut proposées
- Disk space < 100 Mo disponibles → EXIT avec code erreur E-BOOT-006, avertissement sur espace disque insuffisant pour les opérations futures

**Composants actifs**: Aucun composant de RTS-001. Seulement le boilerplate bootstrap du runtime hôte (logger ring buffer, signal handlers, health monitoring thread).
**Durée**: startup (transitoire, typiquement < 500ms pour un système compatible avec ressources suffisantes)

---

### Phase 101: CHARGEMENT CONFIGURATION

**Préconditions**:
- Phase 1 complète (vérifications OS/mémoire réussies)
- Aucune instance concurrente en cours
- Logger fonctionnel (phase 100)
- Les sources de configuration sont accessibles : fichiers de configuration, variables d'environnement, template de valeurs par défaut

**Actions**:
1. Le **ConfigurationLoader (CRT-005)** est instancié en premier (dépendances : aucune)
2. Il charge les fichiers de configuration dans l'ordre de priorité :
   - Priorité 1 (haute) : Fichiers de configuration spécifiques à l'environnement (ex : `lumina.production.json`, `lumina.staging.json`)
   - Priorité 2 : Variables d'environnement (elles écrasent les fichiers)
   - Priorité 3 (basse) : Valeurs par défaut du template manifest
3. Pour chaque setting défini dans le template canonique (CFG-001/002/003), il vérifie :
   - Format ISO 4217 pour les codes devise
   - Format IANA timezone pour les fuseaux horaires
   - Format hex color (#RRGGBB ou #RGBA) pour les couleurs de marque
   - Validité email pour les paramètres de notification SMTP
4. Il détecte les conflits entre sources (ex : même clé dans fichier ET variable d'environnement) et applique la stratégie de résolution de DOC-019 §2.12
5. Il remplit automatiquement toutes les clés manquantes avec les valeurs par défaut du template
6. Il construit une vue immuable de configuration (`ConfigSnapshot`) qui sera partagée via `ConfigurationPort (Port-008)`
7. Il valide les paramètres critiques : URL de base de données, credentials (format seulement, pas de connection réelle), timeouts, intervalle de polling health check
8. Il expose `ConfigSnapshot.readOnly()` au rest of the assembly pipeline

**Postconditions**:
- `ConfigurationLoader` instancié et configuré
- `ConfigSnapshot` immuable disponible via `ConfigurationPort`
- Toutes les clés obligatoires résolues (depuis config > env > default)
- Validation de format appliquée : aucun setting invalide ne traverse cette couche
- Conflits entre sources résolus selon la stratégie documentée

**Erreurs possibles**:
- Key missing with no default → EXIT IMMÉDIAT avec code E-CONFIG-001
- Invalid format (ISO 4217 échec, IANA TZ invalide, hex color invalide) → EXIT IMMÉDIAT avec code E-CONFIG-002 et nom du setting invalide
- File not readable → EXIT avec code E-CONFIG-003, tentative de fallback env var
- Too many conflicts (> 50% overlap entre sources) → WARNING logger, mais continue avec env var en prioritaire

**Composants actifs**: CRT-005 (ConfigurationLoader)
**Durée**: startup (transitoire, typiquement < 100ms)

---

### Phase 102: VALIDATION SCHEMA DATA

**Préconditions**:
- Configuration chargée et validée (Phase 101 complète)
- Les identifiants et paramètres de connexion à la base de données sont disponibles dans `ConfigSnapshot`
- Le `PersistenceVerificationPort` est initialisé avec sa catégorie d'adapter sélectionnée (cf. PAS-002)

**Actions**:
1. Le **CompositionRoot (CRT-001)** demande au DependencyResolver (CRT-002) de résoudre l'ordre d'initialisation des composants restants (Phase 102 dépend du ConfigLoader et du PersistenceVerificationPort)
2. Un adapter temporaires pour `PersistenceVerificationPort` est instancié avec les paramètres de connexion fournis par `ConfigurationLoader`
3. La vérification s'exécute : le port interroge la base de données pour vérifier que les **32 tables canoniques** (définies dans DOC-021 — Physical Data Model) sont toutes présentes
4. Pour chaque table, les colonnes suivantes sont vérifiées :
   - Nom de colonne conforme au mapping physique (DOC-022)
   - Type de données compatible avec le PO correspondant (DOC-017)
   - Présence des colonnes système : `created_at`, `updated_at`, `org_id`, `deleted_at` (pour les tables soft-delete)
   - Clés primaires et étrangères conformes au schéma relationnel
5. Les **indexes critiques** listés dans DOC-023 (Canonical Relational Rules) sont vérifiés (indices sur `org_id`, `created_at`, `uuid` pour performance de requête)
6. Les contraintes de foreign key sont vérifiées pour la cohérence référentielle
7. Les triggers et procédures stockées (s'ils existent) sont vérifiés pour leur présence et leur signature
8. Un rapport de validation est généré : tableau de conformité table par table
9. En mode `LUMINA_MIGRATE=true`, les tables manquantes sont créées automatiquement (schema migration). En mode normal, tout manquant provoque une erreur
10. La validation produit un flag boolean `schema_valid=true/false` consommé par la suite du pipeline

**Postconditions**:
- Les 32 tables sont confirmées présentes (ou créées en mode migration)
- Colonnes, types, index, FK, triggers tous validés
- Rapport de validation persisté dans les logs du runtime
- Flag `schema_valid` positionné, permettant la suite de l'assemblage

**Erreurs possibles**:
- Table manquante (mode validation stricte) → EXIT IMMÉDIAT avec code E-DATA-001 et liste des tables manquantes
- Colonne manquante dans une table existante → EXIT avec code E-DATA-002, colonne et table concernées
- Type de donnée incompatible → EXIT avec code E-DATA-003
- Index critique manquant → WARNING (la table existe mais performance dégradée), pas d'exit
- Connection DB échoue → EXIT avec code E-DATA-004, tentative de retry unique avec backoff 2s

**Composants actifs**: CRT-001 (CompositionRoot), CRT-002 (DependencyResolver), CRT-005 (ConfigurationLoader), CRT-007 (HealthMonitor — indirect via PersistenceVerificationPort sous-jacent)
**Durée**: startup (transitoire, typiquement < 2s selon taille de la DB)

---

### Phase 103: ASSEMBLAGE COMPOSANTS

**Préconditions**:
- Schema data validé (Phase 102 complète)
- `ConfigurationLoader` fournit les settings nécessaires à chaque composant
- `DependencyResolver` a produit l'ordre topologique d'initialisation
- Les 17 Ports (PAS-001) sont définis comme abstractions

**Actions**:
Le **CompositionRoot (CRT-001)**, guidé par l'ordre du **DependencyResolver (CRT-002)**, crée les 15 Runtime Components dans l'ordre topologique strict suivant :

1. **CRT-002 DependencyResolver** — déjà instancié, graph analysé, ordre figé
2. **CRT-005 ConfigurationLoader** — déjà chargé à la phase précédente
3. **ClockPort adapter** — crée l'implémentation canonique de clock (monotonic + wall-clock)
4. **UUIDPort adapter** — crée l'implémentation de génération UUIDv7 (RFC 9562)
5. **CRT-003 TransactionCoordinator** — instancié avec référence à RepositoryPort et TransactionManagerPort
6. **EventDispatcher (CRT-004)** — instancié avec références à EventPublicationPort, EventSubscriptionPort, LoggingPort
7. **CRT-012 RetryPolicy** — instancié avec politiques par type d'opération (events: max 5, cache: 1, repo: 0)
8. **CRT-013 IdempotencyManager** — instancié avec reference to CachePort
9. **CRT-014 AuditEnabler** — instancié avec reference to AuditPort
10. **CRT-015 TenantContextProvider** — instancié avec reference to IdentityProviderPort
11. **CRT-008 Diagnostics** — instancié avec references to LoggingPort, HealthMonitor placeholder
12. **CRT-009 Scheduler** — instancié avec ClockPort, TransactionCoordinator, EventDispatcher references
13. **CRT-007 HealthMonitor** — instancié avec Scheduler pour intervalle de polling, references to all Ports
14. **CRT-010 StartupPipeline** — assemblé avec TOUS les composants ci-dessus (order strict, non modifiable)
15. **CRT-011 ShutdownPipeline** — assemblé avec TOUS les composants ci-dessus (ordre inverse de l'initialisation)

Chaque composant est créé uniquement avec des références aux Ports (abstractions), jamais aux Adapters concrets. Les dépendances croisées entre composants runtime sont résolues par injection directe (pas de DI framework).

Pour chaque composant créé :
- Son contexte interne est initialisé (state empty, buffers alloués)
- Ses handlers/registrations sont configurés (EventDispatcher subscriptions per DOC-014)
- Ses seuils et timeouts sont alimentés depuis `ConfigurationPort` (CRT-005)
- Une entry de log est écrite dans le Logger de phase 100 (niveau INFO)

Les 13 Application Services (ASS-001) sont **référencés** ici mais ne sont pas encore exposés — ils le seront une fois tous les composants prêts.

**Postconditions**:
- 15 Runtime Components tous instanciés et configurés
- Ordre d'initialisation déterministe et vérifié (aucun cycle dans le graphe)
- Configuration injectée dans chaque composant via ConfigurationPort
- Handlers d'événements enregistrés pour EventDispatcher (DOC-014)
- 13 Application Services référencés mais non encore exposés

**Erreurs possibles**:
- Cycle détecté dans le graphe de dépendances → EXIT IMMÉDIAT, le DependencyResolver échoue, aucun composant n'est créé après l'erreur
- Composant nécessite une dépendance non cataloguée → EXIT IMMÉDIAT, liste des dépendances manquantes fournie
- Injection de configuration échoue (setting absent) → EXIT, le Component ne peut être instancié sans sa configuration requise

**Composants actifs**: CRT-001 (CompositionRoot), CRT-002 (DependencyResolver), CRT-003 (TransactionCoordinator), CRT-004 (EventDispatcher), CRT-005 (ConfigurationLoader), CRT-007 (HealthMonitor), CRT-008 (Diagnostics), CRT-009 (Scheduler), CRT-010 (StartupPipeline), CRT-011 (ShutdownPipeline), CRT-012 (RetryPolicy), CRT-013 (IdempotencyManager), CRT-014 (AuditEnabler), CRT-015 (TenantContextProvider)
**Durée**: startup (transitoire, typiquement < 500ms pour 15 composants)

---

### Phase 104: ASSEMBLAGE ADAPTATORS

**Préconditions**:
- 15 Runtime Components créés (Phase 103 complète)
- Configuration contient les choix d'adapters pour chaque Port (ex : relational vs document, in-memory vs file-based)
- Catégories d'adapters définies dans PAS-002 sont accessibles au CompositionRoot

**Actions**:
Le **CompositionRoot (CRT-001)** lie maintenant chaque Port abstrait (PAS-001) à son Adapter concret (PAS-002) en exécutant les étapes suivantes :

1. Pour chacun des 17 Ports, il sélectionne l'Adapter concret basé sur le choix fait dans la configuration :
   - **RepositoryPort** → binding : `relational.adapter` (SQLite/PostgreSQL) ou `document.adapter` (FileStorage JSON) selon config key `runtime.storage_strategy`
   - **EventPublicationPort** → binding : `eventbus.adapter` (in-memory pub/sub pour monolithique) ou `messagequeue.adapter` (RabbitMQ/Kafka si remote sync actif et `runtime.eventbus_mode=message_queue`)
   - **EventSubscriptionPort** → binding : correspond au même EventBus (le même adapter qu'EventPublicationPort, pattern shared bus)
   - **IdentityProviderPort** → binding : `session.adapter` (local JWT signé HMAC-SHA256) ou `network.adapter` (remote auth server via HTTPS) selon `runtime.auth_mode`
   - **AuthorizationPort** → binding : `rbac.adapter` (rules définies dans organization config, modèle RBAC standard)
   - **ClockPort** → binding : `monotonic.adapter` (clock monotonic pour intervals) + `wallclock.adapter` (UTC + timezone locale pour horodatage affiché). Déjà initialisé en Phase 103, vérification de cohérence
   - **UUIDPort** → binding : `uuidv7.adapter` (RFC 9562, sortable par timestamp). Déjà initialisé en Phase 103, vérification de cohérence
   - **ConfigurationPort** → binding : immutable ConfigSnapshot construit en Phase 101. Pas d'adapter nécessaire, c'est une vue in-memory
   - **LoggingPort** → binding : `console.adapter` (stderr) + `file.adapter` (rolling log file $DATA_DIR/logs/) + `audit.adapter` (fichier audit séparé $DATA_DIR/audit/)
   - **AuditPort** → binding : `repository.adapter` (AuditAggregate persistance via RepositoryPort abstraction, pas de DB directe)
   - **NotificationPort** → binding : configuration multi-cible — `email.adapter` (SMTP TLS), `push.adapter` (FCM/APNs), `inapp.adapter` (notification interne via EventDispatcher)
   - **SearchPort** → binding : `fulltext.adapter` (SQLite FTS5 si mode embedded, Elasticsearch si mode distributed) selon `runtime.search_backend`
   - **FileStoragePort** → binding : `filesystem.adapter` (system local) ou `blob.adapter` (S3-compatible API) selon `runtime.filestorage_backend`
   - **CachePort** → binding : `lru.adapter` (in-memory LRU, configurable max entries) ou `redis.adapter` (remote Redis, avec fallback automatique vers `lru.adapter` si Redis inaccessible, per BR-SYNC-003)
   - **TransactionManagerPort** → binding : `sql.adapter` (SQL transactions ACID si relational backend) ou `noop.adapter` (pas de transaction si document store, consistency eventuelle)
   - **PersistenceVerifyPort** → binding : `schema.adapter` (introspection DB via information_schema ou équivalent). Déjà utilisé en Phase 102, réutilisé ici pour validation post-bind
   - **VocabularyAccessPort** → binding : `repository.adapter` (VocabularyAggregate persistance via RepositoryPort abstraction)

Pour chaque binding :
- L'adapter category name (ex: `relational`, `lru`, `uuidv7`) est lu depuis `ConfigSnapshot`
- L'adapter correspondant est instancié avec les paramètres de configuration de ce setting
- Le binding est enregistré dans un registre global `PortRegistry` du CompositionRoot
- Une entry de log est écrite : `binding port=RepoPort adapter=relational status=bound`

2. Chaque liaison (bind) est enregistrée dans un registre internal `PortRegistry` du CompositionRoot (un `Map<PortId, AdapterInstance>` immuable après construction)
3. Une verification croisée exhaustive est effectuée après les 17 bindings : chaque Port a exactement UN adapter lié (pas zéro, pas deux). En cas de violation → EXIT avec code E-ASSEMBLY-002
4. Pour les adapters réseau (NotificationPort, IdentityProviderPort en mode network, EventPublicationPort en mode message_queue), un test de connectivité léger est effectué immédiatement :
   - SMTP : connexion TCP sur le port configuré + EHLO handshake, sans authentification
   - FCM/APNs : requête HTTP HEAD vers le endpoint de health de l'APNs gateway
   - RabbitMQ/Kafka : connexion TCP + simple queue status check
   - Remote Auth Server : HTTP GET sur `/health` endpoint de l'auth server
   - Réussite = le test retourne sans erreur. Échec = adapter passé en mode degraded/fallback
5. Les stratégies de fallback sont configurées pour chaque adapter ayant un fallback disponible (défini dans PAS-002) :
   - CachePort Redis → fallback LRU : si le test de connectivité échoue, le `lru.adapter` devient l'active adapter automatiquement
   - EventPublicationPort MessageQueue → fallback EventBus : si Kafka non disponible, l'in-memory EventBus prend le relais
   - FileStoragePort Blob → fallback FileSystem : si S3 inaccessible, écriture locale automatique
6. Le **TransactionCoordinator (CRT-003)** et l'**EventDispatcher (CRT-004)** reçoivent leurs références adapter finales et se préparent à opérer. Le TransactionCoordinator initialise son contexte de pool de transactions. L'EventDispatcher confirme ses handlers et se prépare à dispatch.
7. Les bindings sont exportés dans le Diagnostics pour observabilité future : `Diagnostics.registerBoundPorts(portRegistry.snapshot())`

**Postconditions**:
- Les 17 Ports ont chacun exactement un Adapter concret lié (vérifié par la cross-check)
- PortRegistry complet et cohérent : Map<PortId, AdapterInstance> immuable
- Connectivité des adapters réseau vérifiée (ou dégradée avec fallback activé)
- Stratégies de fallback configurées pour tous les adapters supports (Redis→LRU, MQ→EventBus, Blob→FileSystem)
- Les ports critiques (Repo, Event, TxManager) alimentent leurs consommateurs avec les références adapter finales
- Diagnostics informed of all port bindings for runtime observability

**Erreurs possibles**:
- Adapter category non trouvée dans config (clé inconnue dans `runtime.*_backend`) → EXIT avec code E-ASSEMBLY-001 et nom du Port concerné
- Deux categories conflictuelles pour un même Port (impossible car PortRegistry Map unique, mais vérification défensive) → EXIT avec code E-ASSEMBLY-002
- Test de connectivité adapter réseau échoue ET pas de fallback disponible (ex: NotificationPort email seul configuré, SMTP unreachable) → EXIT avec code E-ASSEMBLY-003
- Adapter lié mais non instancié (bug CompositionRoot) → EXIT avec code E-ASSEMBLY-004
- Cross-check échoue (Port sans adapter ou avec double adapter) → EXIT avec code E-ASSEMBLY-005, PortRegistry dump fourni pour debugging

**Composants actifs**: CRT-001 (CompositionRoot — orchestrator principal du binding), CRT-003 (TransactionCoordinator — reçoit refs adapter finales), CRT-004 (EventDispatcher — reçoit refs adapter finales), CRT-008 (Diagnostics — reçoit port registry snapshot)
**Durée**: startup (transitoire, typiquement < 200ms pour les adapters locaux, +2s si adapters réseau avec tests de connectivité)

---

### Phase 105: VALIDATION RUNTIME

**Préconditions**:
- Tous les Ports liés à leurs Adapters (Phase 104 complète)
- Tous les 15 Runtime Components instanciés
- HealthMonitor (CRT-007) instancié mais pas encore en polling continu
- Scheduler (CRT-009) prêt pour planification

**Actions**:
Le **HealthMonitor (CRT-007)** exécute un diagnostic complet de santé de TOUTES les connexions et services internes, sans encore entrer en mode polling :

1. **HealthCheck — Database/Repository** : le HealthMonitor envoie un `ping` via RepositoryPort. Réponse attendue : confirmation de connexion active. Vérification également : lecture d'une table système (ex : `sqlite_master` ou information_schema) pour confirmer l'accès en lecture/write
2. **HealthCheck — Event Bus** : le HealthMonitor publie un événement test `HealthCheckPing` via EventPublicationPort, puis vérifie qu'il arrive via EventSubscriptionPort (ring test interne). L'événement test n'a AUCUN handler permanent (c'est un événement fantôme)
3. **HealthCheck — Clock** : le ClockPort adapter est interrogé. Vérification : monotonic clock fonctionne, wall-clock retourne un timestamp raisonnable, différence avec system clock < 60 secondes
4. **HealthCheck — Cache** : écriture puis lecture d'une clé test dans CachePort. Vérification : mise en cache fonctionnelle, retrieval correct
5. **HealthCheck — File Storage** : écriture d'un blob test dans FileStoragePort, lecture puis suppression. Vérification : espace disque disponible, permissions OK
6. **HealthCheck — Search Engine** : indexation puis recherche d'un terme test via SearchPort. Vérification : FTS ou index disponible
7. **HealthCheck — Notification Adapters** : si adapter email/push configuré, tentative de connexion au serveur (SMTP STARTTLS, APNs token, etc.) sans envoyer de notification réelle
8. **HealthCheck — Scheduler** : planification et exécution immédiate d'un job test avec un délai de 0ms. Vérification : le Scheduler execute bien une tâche planifiée
9. **HealthCheck — AuditPort** : écriture d'un audit entry test dans AuditPort. Vérification : AuditAggregate accepte l'entrée (NB-PERSIST-007 : l'entry test ne déclenche pas de recursive audit)
10. **HealthCheck — IdentityProviderPort** : validation que le provider retourne un contexte d'authentification (même vide = pas d'utilisateur connecté, mais le provider fonctionne). Si mode remote, tentative de health-check endpoint auth server

Après chaque health check individuel, le résultat est agrégé : chaque Port vote HEALTHY/DEGRADED/UNHEALTHY. Le verdict global est calculé selon les règles de CRT-007.

**Postconditions**:
- Verdict de santé global obtenu : HEALTHY, DEGRADED ou UNHEALTHY
- Chaque Port a un statut individuel détaillé
- Si verdict = HEALTHY : l'application passe à l'ouverture
- Si verdict = DEGRADED : l'application peut passer à l'ouverture AVEC alertes (les composants dégradés sont marqués mais l'app reste opérationnelle)
- Si verdict = UNHEALTHY : EXIT IMMÉDIAT avec code E-HEALTH-001 et détail des ports morts
- Les résultats sont exposés via l'endpoint de health check standard

**Erreurs possibles**:
- Health check DB timeout → port DEGRADED, continue avec les autres checks
- Health check event bus échoue → UNHEALTHY car l'event-driven architecture ne peut fonctionner sans events
- Health check scheduler échoue → DEGRADED (jobs planifiés indisponibles mais operations synchrones continuent)
- Health check notification échoue → DEGRADED (notifications failles mais application fonctionne sans)

**Composants actifs**: CRT-007 (HealthMonitor — exécuteur principal), CRT-009 (Scheduler — fournisseur de timing), CRT-001 (CompositionRoot — consommateur du verdict), CRT-008 (Diagnostics — reçoit les détails de santé)
**Durée**: startup (transitoire, typiquement < 3s pour 10 health checks séquentiels)

---

### Phase 106: OUVERTURE RUNTIME

**Préconditions**:
- Validation runtime terminée (Phase 105 complète)
- Verdict de santé >= DEGRADED (pas UNHEALTHY)
- Tous les 15 Runtime Components et 17 Ports-assemblés sont opérationnels
- StartupPipeline (CRT-010) entièrement assemblé

**Actions**:
Le **StartupPipeline (CRT-010)**, invoqué par le **LifecycleManager (CRT-006)**, exécute la séquence d'ouverture finale :

1. **Signal READY** : le StartupPipeline envoie un signal `READY` au LifecycleManager via un callback interne `LifecycleManager.onReady()`. Ce signal signifie que TOUT est prêt et que l'application peut accepter des requêtes externes. Le LifecycleManager change son état interne de `STARTING` à `RUNNING`.

2. **Scheduler activation** : le Scheduler (CRT-009) commence à exécuter ses tâches planifiées avec les intervalles configurés :
   - Health monitoring polling (interval configuré via ConfigurationPort, défaut 30s, configurable entre 5s et 300s)
   - PushPendingOperations (OfflineSyncAggregate, periodic configurable, défaut 60s — pousse les ops locales vers le remote server)
   - PurgeSchedule (LifecycleAggregate, daily cron à minuit heure locale du tenant pour purge des soft-deleted entities après retention period)
   - Session cleanup (IdentityAggregate, periodic défaut 15min — revokes expired sessions, compacts active sessions table)
   - Balance calculation refresh (ReportingAggregate, periodic défaut 5min — recalcul balances pour orgs actives)
   - Conflict detection scan (OfflineSyncAggregate, periodic défaut 10min — scan local queue pour conflicts de synchro)
   - Chaque job est lancé dans un contexte transactionnel autonome (via TransactionCoordinator CRT-003)

3. **Acceptation des requêtes** : le API layer (externe au Runtime mais coordonnées par CompositionRoot) est activé pour recevoir des requêtes HTTP/gRPC/CLI :
   - La phase d'acceptation passe de `blocked` à `open`
   - L'IdempotencyManager (CRT-013) est activé pour intercepter les request_ids et prévenir les double-exécutions
   - Le TenantContextProvider (CRT-015) est activé pour résoudre org_id à partir de chaque requête entrante
   - L'AuthorizationPort est appelé pour chaque requête RBAC check avant routing vers les Application Services

4. **Registration des EventSubscriptions** : l'EventDispatcher (CRT-004) active officiellement ses subscriptions définies dans DOC-014. Tous les handlers consommateurs sont signalés comme "active" dans le Diagnostics registry. Mappings actifs :
   - `ResourceCreated` → OfflineSyncAggregate (push push), AuditAggregate (log)
   - `ApprovalGranted` → WorkflowAggregate (step complete), AuditAggregate (log)
   - `ApprovalRequested` → WorkflowAggregate (instance create), NotificationAggregate (alert)
   - `OrgUnitCreated` → RelationshipAggregate (cache update), AuditAggregate (log)
   - `SettingUpdated` → Manifest compiler (invalidate cache), Branding capability (reload), AuditAggregate (log)
   - TOUT state change → AuditAggregate.LogAction (universal side-effect per ASS-004, every domain mutation logged)

5. **Exposition des Application Services** : les 13 Application Services (ASS-001) sont officiellement exposés aux couches extérieures (API layer) via le registry du CompositionRoot. Chaque service est accessible sous le pattern `{ServiceName}.execute(command)` et `{ServiceName}.query(filter)`. Les services exposés :
   - OrganizationService, IdentityService, ResourceService, RelationshipService
   - WorkflowService, FormService, NotificationService, VocabularyService
   - ReportingService, AuditService, LifecycleService, ConfigService, OfflineSyncService

6. **Audit entry de démarrage** : l'AuditEnabler (CRT-014) écrit un entry "Application started" dans l'AuditAggregate avec timestamp exact, version Lumina, et environnement courant (production/staging/dev). Cette entry contient les métadonnées de startup nécessaires au diagnostic post-mortem.

7. **Diagnostics ready** : le Diagnostics service (CRT-008) commence à collecter les métriques de performance et expose les endpoints de diagnostic :
   - `/health` — standard health probe (pour Kubernetes/load balancer)
   - `/metrics` — Prometheus-compatible metrics endpoint
   - `/debug/dump` — full state dump pour debugging (sans données sensibles)
   - Les métriques de base sont initialisées : uptime_seconds=0, requests_processed=0, events_dispatched=0, errors_total=0

8. **TenantContextProvider ready** : le provider est opérationnel pour résoudre org_id depuis les requêtes entrantes. Il initialise sa cache interne de résolutions org_id (TTL configurable) et son map de contextes thread-local. Le Context provider vérifie également que le `AuthorizationPort` a bien ses rules RBAC chargées.

9. **RetryPolicy activation** : le RetryPolicy (CRT-012) est activé pour tous les types d'opérations définis dans RTS-001. Chaque type d'opération (event publish, sync push, cache access, notification send) a maintenant sa stratégie de retry生效.

Le **LifecycleManager** passe de l'état `STARTING` à l'état `RUNNING` de manière visible par les diagnostics externes. Le compteur `uptime_seconds` démarre à zéro et incrémente en continu dans les métriques du Diagnostics service.

**Postconditions**:
- Application état : RUNNING (visible via lifecycle state probe)
- Requêtes entrantes acceptées et traitées via tous les 13 Application Services
- Scheduler tourne avec toutes les 6 tâches planifiées configurées
- EventDispatcher dispatche les Domain Events selon les mappings DOC-014
- 13 Application Services exposés et accessibles (organisation, identity, resource, etc.)
- Health monitoring en polling continu (tous les 30s défaut)
- Audit entry de démarrage écrit dans l'AuditAggregate
- Endpoints diagnostics actifs (`/health`, `/metrics`, `/debug/dump`)
- RetryPolicy actif pour tous les types d'opérations
- IdempotencyGuard prêt à prevent double-execution sur request_ids

**Erreurs possibles**:
- Scheduler job planning échoue (cron syntax error pour un job) → DEGRADED, le job invalide est sauté, les autres continuent à tourner. Log WARNING avec détail du cron invalide
- EventSubscription registration échoue pour un handler spécifique → DEGRADED pour ce handler uniquement, les autres handlers continuent de fonctionner. Log WARNING avec nom du handler défaillant
- Application Service exposition échoue (port déjà pris ou collision de noms) → EXIT avec code E-OPEN-001, liste des services non exposés fournie
- Audit entry write fails during startup → silently ignored (audit non-blocking per AUD-001 constitutionnel)
- Metrics endpoint bind fail → Diagnostics continues without external metrics endpoint (internal metrics still collected)

---

### Phase 107: TRAITEMENT NORMAL

**Préconditions**:
- Phase 106 ouverte (RUNNING)
- Application accepte des requêtes entrantes
- Health monitor en polling continu
- Scheduler exécutant ses tâches planifiées

**Actions**:
Pendant cette phase, l'application opère normalement. C'est l'état stable qui dure jusqu'au signal d'arrêt. Les mécanismes actifs sont :

**Traitement de Commandes (Write Operations)** :
1. Requête entrante → TenantContextProvider résout org_id (INV-004)
2. Input Validation (ASS-003 Step 1)
3. Authorization Check (RBAC, API-CONTRACT-004) (ASS-003 Step 2)
4. Idempotency check via CRT-013 : si même request_id vu récemment → réponse en cache retournée (pas d'exécution double)
5. Aggregate Load via RepositoryPort (ASS-003 Step 3)
6. Domain Execution via Aggregate boundary method (ASS-003 Step 4)
7. Invariant Guard (ASS-003 Step 5)
8. Transaction begin → Persistence via RepositoryPort (ASS-003 Steps 6)
9. AuditEnabler (CRT-014) capture before/after state, écrit via AuditPort
10. Transaction commit
11. EventDispatcher publie les Domain Events via EventPublicationPort
12. Si event publishing échoue → RetryPolicy (CRT-012) appliqué (max 5 retries, backoff exponentiel)
13. Response retournée à l'appelant (ASS-003 Step 8)

**Traitement de Queries (Read Operations)** :
1. Requête entrante → TenantContextProvider résout org_id
2. Input Validation → Authorization Check
3. Aggregate Load via RepositoryPort
4. Read method execution (no mutation, no persistence, no events)
5. Response retournée
6. Si CachePort est configuré pour les lectures → cache hit/miss logique appliquée

**Saga Transactions (Cross-Aggregate)** :
1. TransactionCoordinator (CRT-003) crée un scope transactionnel
2. Exécution séquentielle des Aggregates dans l'ordre défini (Pattern Linear Orchestration, ASS-003)
3. Chaque Aggregate a SON PROPRE scope transactionnel
4. En cas d'échec d'un step → rollback du step courant + exécution des actions compensatrices en ordre inverse
5. Les événements de compensation sont dispatchés via EventDispatcher
6. Saga log enregistré dans l'AuditAggregate (non bloquant)

**Push Pending Operations (Offline Sync)** :
1. Scheduler déclenche PushPendingOperations périodiquement
2. OfflineSyncAggregate batch ≤ 50 operations
3. Push via RepositoryPort (abstracted) au remote server
4. Response processing : confirmed ops marqués, conflicts détectés et résolus, failed ops retryées
5. RetryPolicy (CRT-012) appliqué entre les batches (backoff exponentiel, max 5 retries per BR-SYNC-003)

**Event Processing (Consommateurs)** :
1. EventDispatcher dispatche les événements vers tous les handlers subscribers
2. Chaque handler exécuté isolément : échec d'un handler ne bloque PAS les autres
3. Livraisons at-least-once garanties : les dupliacts tolérés par les consommateurs
4. Ordre d'émission respecté (consuming séquentiel, ASS-003)
5. Diagnostics (CRT-008) collecte les métriques de traitement d'événements

**Health Monitoring en Continu** :
1. HealthMonitor (CRT-007) poll toutes les T secondes (configurable)
2. Mêmes checks que Phase 105 exécutés en continu
3. Changements de statut → logs + métriques diagnostics + update status probe kubernetes
4. Health degraded pendant > 3 polls consécutifs → alerte Diagnostics level WARN
5. Health unhealthy pendant > 5 polls → alerte Diagnostics level ERROR

**Diagnostics Continus** :
1. Métriques de performance collectées en continu : temps de réponse P50/P95/P99, taux d'erreur, nombre de transactions actives, taille queue offline sync
2. Dump d'état disponible sur demande (endpoint `/debug/dump`)
3. Aucun credential/token/hash exposé (BR-ID-001)

**Postconditions**:
- Application traitant normalement ses charges de travail
- Events dispatchés, Sagas exécutés, Retries appliqués, Idempotence garantie
- Health monitoring en continu
- Métriques collectées et exposées

**Erreurs possibles**:
- Invariant violé → exception domain → mapped to E-422-NNN_INV-XXX (ASS-003)
- Persist échoue → transaction rollback → E-500-002 (ASS-003)
- Event publish exhausted retries → event perduré, retry re-scheduled par Scheduler → WARNING logger
- CachePort failure → grace degradation : cache bypass, pas d'impact sur la fonctionnalité
- RepositoryPort unreachable → fallback to offline queue (OfflineSyncAggregate)
- org_id resolution failure → 401 Unauthorized (INV-004)

**Composants actifs**: CRT-001 (CompositionRoot — exposed services), CRT-003 (TransactionCoordinator — sagas), CRT-004 (EventDispatcher — event routing), CRT-007 (HealthMonitor — polling health), CRT-008 (Diagnostics — metrics), CRT-009 (Scheduler — background jobs), CRT-012 (RetryPolicy — retry logic), CRT-013 (IdempotencyManager — dedup), CRT-014 (AuditEnabler — write audit), CRT-015 (TenantContextProvider — org_id resolution), ConfigurationPort/ClockPort/RepositoryPort/EventPort/CachePort/etc. (tous les Ports en opération)
**Durée**: ongoing (continu, dure tant que l'application est running)

---

### Phase 108: SIGNAL D'ARRÊT

**Préconditions**:
- Phase 107 active (RUNNING, traitant des requêtes)
- LifecycleManager (CRT-006) a reçu un signal d'arrêt : SIGINT, SIGTERM, SIGQUIT, CTRL_CLOSE_EVENT, ou appel explicite à `ShutdownPipeline.start()`

**Actions**:
Le **LifecycleManager (CRT-006)** déclenche le **ShutdownPipeline (CRT-011)** qui exécute la séquence suivante :

1. **Stop accepting new requests** : l'API layer rejette IMMÉDIATEMENT toute nouvelle requête entrante. Toutes les nouvelles connexions reçoivent un code HTTP 503 Service Unavailable. Le TenantContextProvider cesse de résoudre org_id pour les nouvelles requêtes
2. **Drain in-flight requests** : le LifecyleManager marque toutes les requêtes en cours comme "finalizing". Aucune action d'écriture ne peut commencer, mais les opérations en cours continuent
3. **Grace period monitoring** : un timer configurable (défaut : 30 secondes) démarre. Pendant cette période, les requêtes en cours peuvent se terminer normalement. Si le timer expire → force shutdown (Phase 109 commence immédiatement, mêmes opérations mais brutales)
4. **OfflineSyncAggregate flush final** : le Scheduler arrête tous les jobs périodiques sauf le flush final de PushPendingOperations. Les opérations locales pending sont poussées une dernière fois (batch ≤ 50 ops). Si le push échoue → retry unique avec backoff court (1s). Les ops toujours pending sont sauvegardées en local
5. **EventDispatcher shutdown** : aucun nouvel événement n'est absorbé. Les événements actuellement en cours de dispatch sont complétés. Une entry "EventDispatcher shutting down" est loggée. Aucun nouveau handler n'est exécuté après ce point
6. **Transactional integrity checkpoint** : le TransactionCoordinator s'assure qu'aucune transaction cross-aggregate n'est en cours. Si une transaction est ouverte au moment du shutdown → elle est rollbackée (pas de commit possible car shutdown)
7. **Audit final entry** : l'AuditEnabler écrit une entry "Application shutdown initiated" avant toute fermeture de ressources
8. **Diagnostics snapshot** : le Diagnostics service (CRT-008) prend un snapshot final de toutes les métriques avant la fermeture
9. **HealthMonitor stops polling** : le HealthMonitor (CRT-007) arrête son polling. Dernière lecture de santé loggée avec état HEALTHY/DEGRADED/UNHEALTHY à l'instant T

Le **LifecycleManager** passe de l'état `RUNNING` à l'état `SHUTTING_DOWN`.

**Postconditions**:
- Plus aucune nouvelle requête acceptée
- Requêtes en cours还在 draining (ou force shutdown si grace period expiré)
- Operations offline sync poussées une dernière fois
- EventDispatcher en cours de fermeture
- TransactionCoordinator en phase de verification
- Audit entry de shutdown initié

**Erreurs possibles**:
- Grace period timeout → force shutdown malgré tout (Phase 109 forcée)
- In-flight request dépasse grace period → request avortée, transaction rollback
- Flush offline sync échoue → warnings logger, les ops pending survivent et seront retryées au prochain démarrage
- Audit write échoue pendant shutdown → silently ignored (audit is non-blocking per AUD-001)

**Composants actifs**: CRT-006 (LifecycleManager — orchestrator), CRT-011 (ShutdownPipeline — executor), CRT-009 (Scheduler — stopping jobs), CRT-004 (EventDispatcher — shutting down), CRT-003 (TransactionCoordinator — draining txns), CRT-014 (AuditEnabler — final audit), CRT-008 (Diagnostics — snapshot), CRT-007 (HealthMonitor — stopping), CRT-012 (RetryPolicy — last retries)
**Durée**: shutdown (transitoire, typiquement 1-30s selon grace period)

---

### Phase 109: NETTOYAGE

**Préconditions**:
- Phase 108 complète (signal d'arrêt traité, drain terminé ou forcé)
- Plus aucune requête en cours
- Plus aucune transaction ouverte
- Plus aucun event en cours de dispatch

**Actions**:
Le **ShutdownPipeline (CRT-011)** effectue le nettoyage systématique de TOUS les composants dans l'ordre inverse de l'initialisation (Phase 103) :

1. **Scheduler shutdown** : le Scheduler (CRT-009) est stoppé de manière définitive. Tous les timers/jobs cancelés. ClockPort refermé. Confirmation que le dernier job planifié a été exécuté ou cancelé proprement
2. **EventPublicationPort close** : l'EventDispatcher (CRT-004) publie son dernier lot d'événements (s'il y en avait dans la queue). Puis la publication est fermée. EventSubscriptionPort est également clos
3. **RetryPolicy persistence** : le RetryPolicy (CRT-012) persiste sa configuration courante et les statistiques de retry dans FileStoragePort (pour diagnostic ultérieur). Ensuite fermé
4. **IdempotencyManager eviction** : l'IdempotencyManager (CRT-013) fait un flush de son cache idempotent restant dans CachePort. Les clés restantes sont évictées (plus utiles après shutdown)
5. **AuditPort close** : l'AuditEnabler (CRT-014) écrit un entry "Application shutdown completed" via AuditPort. Le AuditPort est ensuite fermé (flush buffers audit en dernier lieu)
6. **Connection pools close** : toutes les connexions ouvertes via RepositoryPort sont fermées une par une. Pool de connections database flushé. Chaque fermeture est logged
7. **FileStoragePort close** : les buffers d'écriture sont flushés. Fichiers de données locaux sont verrouillés/confirmés. Espace libéré
8. **SearchPort close** : les indexes sont fermés proprement (flush + sync on disk)
9. **NotificationPort close** : les files d'attente de notifications sont flushées. Connections SMTP/push refermées
10. **CachePort close** : le cache est vidé et fermé
11. **Diagnostics snapshot final** : le Diagnostics (CRT-008) écrit le rapport final de shutdown dans les logs, incluant uptime total, nombre de requêtes traitées, nombre d'événements dispatchés, taux d'erreur global, nombre de retries consumés
12. **TenantContextProvider destroy** : le contexte tenant est cleared. Toutes les résolutions org_id sont invalidées
13. **TransactionCoordinator teardown** : le coordinator est détruit. Tout contexte transactionnel résiduel est lost (il ne devrait rien rester)
14. **ConfigurationPort close** : le ConfigSnapshot est invalidé. La configuration n'est plus accessible
15. **Logger close** : le logger de phase 100 est enfin fermé, flushant tout contenu du ring buffer restant dans les logs persistés

Pendant le nettoyage :
- Si une fermeture échoue → WARNING logger, continu avec le composant suivant. Pas d'exception propagée car le shutdown est en cours
- Les ressources critiques (DB connections, file descriptors) sont libérées en priorité absolue
- Le memory reserved par le ring buffer de logger (phase 100) est libéré en dernier

**Postconditions**:
- Toutes les connexions externes fermées
- Toutes les ressources libérées (threads, file descriptors, memory)
- Estado critiqué sauvegardé (offline ops pending, retry stats, diagnostics snapshot)
- Audit entry "Application shutdown completed" écrit
- Aucun Handle ou connexion résiduel

**Erreurs possibles**:
- Connection pool close timeout → force close, connection leak possible (WARNING logger)
- FileStorage flush échoue → data potential loss for last writes (WARNING logger)
- CachePort eviction error → ignored, memory will be garbage-collected anyway
- AuditPort write during shutdown échoue → silently ignored (AUD-001: audit is never blocking)
- Ring buffer overflow pendant shutdown → oldest entries lost, acceptable car diagnostic only

**Composants actifs**: CRT-011 (ShutdownPipeline — executor principal), CRT-009 (Scheduler — shutdown), CRT-004 (EventDispatcher — shutdown), CRT-012 (RetryPolicy — persist config), CRT-013 (IdempotencyManager — evict), CRT-014 (AuditEnabler — final audit), CRT-008 (Diagnostics — final report), CRT-001 (CompositionRoot — tear-down oversight), CRT-005 (ConfigurationLoader — deconfliction)
**Durée**: shutdown (transitoire, typiquement < 2s)

---

### Phase 110: EXIT PROPRE

**Préconditions**:
- Phase 109 complète (nettoyage terminé, ressources libérées)
- Exit code calculé (succès ou erreur selon raison du shutdown)
- Plus aucun thread ou task asynchrone en cours

**Actions**:
Le **LifecycleManager (CRT-006)** coordonne la sortie définitive du processus :

1. **Exit code determination** :
   - Exit 0 : shutdown normale initiée par SIGINT/SIGTERM (ctrl+c administrateur ou deployment graceful)
   - Exit 130 : shutdown initiée par SIGINT externe (control-c terminal)
   - Exit 143 : shutdown initiée par SIGTERM (deployment manager, orchestrateur)
   - Exit 137 : kill -9 forced par l'orchestrateur (Kubernetes OOM killer par exemple)
   - Exit 2 : shutdown prématurée (startup échec, Phase 105 health check UNHEALTHY)
   - Exit 3 : crash non géré (exception non attrapée en Phase 107)
2. **Final log entry** : dernière ligne de log écrite avec l'exit code, le timestamp exact d'arrêt, et l'uptime total
3. **SignalOS send** : le LifecycleManager envoie un signal de terminaison au système d'exploitation via l'appel standard d'exit du language hôte
4. **Process termination** : le processus se termine proprement. Le shell/orchestrateur récupère l'exit code et le traite (restart, alert, log)
5. **Post-shutdown cleanup** (hors Runtime Lumina) : le système d'exploitation récupère la mémoire et les file descriptors. Les fichiers temporaires créés pendant l'exécution (si any) sont gérés par le cleanup OS natif

Après cet appel : le processus Lumina n'existe plus. Toute relance nécessite un nouveau démarrage depuis la Phase 100 (Initialisation Nulle).

**Postconditions**:
- Processus terminé
- Exit code retourné au launcher
- Mémoire et ressources tous libérés par le système d'exploitation
- Logs de shutdown persistés
- Exit code correctement traité par le processus parent

**Erreurs possibles**:
- Exit code non reçu par le launcher → processus zombie potentiel (très rare, nécessite intervention OS)
- Mémoire non libérée avant exit → leak possible dans le runtime hôte (pas dans le Runtime Lumina)

**Composants actifs**: CRT-006 (LifecycleManager — orchestrator final)
**Durée**: shutdown (transitoire, < 10ms)

---

## TRANSITIONS ENTRE PHASES

| De \ Vers | 100 | 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109 | 110 |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Initialisation Nulle | — | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Chargement Config | ✗ | — | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Validation Schema | ✗ | ✗ | — | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Assemblage Composants | ✗ | ✗ | ✗ | — | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Assemblage Adaptators | ✗ | ✗ | ✗ | ✗ | — | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Validation Runtime | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✓ | ✗ | ✗ | ✗ | ✗ |
| Ouverture Runtime | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✓ | ✗ | ✗ | ✗ |
| Traitement Normal | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✓ | ✗ | ✗ |
| Signal d'Arrêt | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — | ✓ | ✗ |
| Nettoyage | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — | ✓ |
| Exit Propre | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — |

✓ = transition directe autorisée | ✗ = transition impossible

---

## MATRICE DE RESPONSABILITÉS PAR PHASE

| Phase | Composant Principal | Composants Secondaires | Pipeline |
|-------|---------------------|----------------------|----------|
| 100 — Initialisation Nulle | Bootstrap Runtime | Aucun | N/A (avant composants) |
| 101 — Chargement Configuration | CRT-005 ConfigurationLoader | CRT-001 (consommateur) | StartupPipeline |
| 102 — Validation Schema Data | CRT-001 CompositionRoot | CRT-002, CRT-005, CRT-007 (via Port) | StartupPipeline |
| 103 — Assemblage Composants | CRT-001 CompositionRoot | CRT-002 DependencyResolver | StartupPipeline |
| 104 — Assemblage Adaptators | CRT-001 CompositionRoot | CRT-003, CRT-004 | StartupPipeline |
| 105 — Validation Runtime | CRT-007 HealthMonitor | CRT-001, CRT-009, CRT-008 | StartupPipeline |
| 106 — Ouverture Runtime | CRT-006 LifecycleManager | CRT-010, CRT-009, CRT-004, CRT-013, CRT-014, CRT-015, CRT-012 | StartupPipeline |
| 107 — Traitement Normal | Tous (opérationnel) | CRT-001, CRT-003, CRT-004, CRT-007, CRT-008, CRT-009, CRT-012, CRT-013, CRT-014, CRT-015 | Ongoing |
| 108 — Signal d'Arrêt | CRT-006 LifecycleManager | CRT-011, CRT-009, CRT-004, CRT-003, CRT-014, CRT-008, CRT-007 | ShutdownPipeline |
| 109 — Nettoyage | CRT-011 ShutdownPipeline | CRT-009, CRT-004, CRT-012, CRT-013, CRT-014, CRT-008, CRT-001, CRT-005 | ShutdownPipeline |
| 110 — Exit Propre | CRT-006 LifecycleManager | N/A | ShutdownPipeline |

---

## INVARIABLES DU CYCLE DE VIE

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| LV-001 | Les phases s'exécutent toujours dans l'ordre 100→101→102→...→110 | StartupPipeline (CRT-010) enforce l'ordre séquentiel |
| LV-002 | Aucune requête n'est acceptée avant la fin de la Phase 106 | LifecycleManager bloque l'acceptation jusqu'à READY signal |
| LV-003 | Le shutdown EST TOUJOURS propre (jamais brutal) | ShutdownPipeline (CRT-011) implémente le drain obligatoire |
| LV-004 | Aucune donnée n'est perdue pendant le shutdown | OfflineSyncAggregate flush final obligatoire (Phase 108 Step 4) |
| LV-005 | L'ordre de shutdown EST L'INVERSE DE L'INITIALISATION | ShutdownPipeline suit l'ordre inverse du DependencyResolver |
| LV-006 | HealthMonitor ne peut pas empêcher le démarrage | Dégradation ≠ unhealthy : app démarre même avec ports dégradés |
| LV-007 | Un restart après shutdown redémarre depuis la Phase 100 | Aucun state persisté entre sessions — chaque session est fraîche |
| LV-008 | Le Diagnostic capture un snapshot AVANT chaque shutdown | Diagnostics (CRT-008) snap en Phase 108 Step 8 |
| LV-009 | Audit Entry de shutdown EST TOUJOURS écrit | AuditEnabler (CRT-014) forced write avant toute fermeture |
| LV-010 | Le RetryPolicy est persisté pendant le shutdown | RetryPolicy (CRT-012) flush config en Phase 109 Step 3 |

---

## ORDRE TOPOLIQUE D'INITIALISATION (Référence RTS-002)

Cet ordre est PRODUIT par le DependencyResolver (CRT-002) à la Phase 103 et CONSUMÉ par le StartupPipeline (CRT-010) à la Phase 106 :

| Étape | Composant | Phase RTS-002 | Dépend de |
|-------|-----------|--------------|-----------|
| 1 | CRT-005 ConfigurationLoader | 101 | Aucune |
| 2 | CRT-002 DependencyResolver | 103 | Aucune (résolu AVANT la création des composants) |
| 3 | ClockPort adapter | 103 | CRT-005 |
| 4 | UUIDPort adapter | 103 | CRT-005 |
| 5 | CRT-003 TransactionCoordinator | 103 | CRT-005, RepositoryPort |
| 6 | CRT-004 EventDispatcher | 103 | CRT-005, EventPubPort, EventSubPort |
| 7 | CRT-012 RetryPolicy | 103 | CRT-005, LoggingPort |
| 8 | CRT-013 IdempotencyManager | 103 | CRT-005, CachePort |
| 9 | CRT-014 AuditEnabler | 103 | CRT-005, AuditPort |
| 10 | CRT-015 TenantContextProvider | 103 | CRT-005, IdentityProviderPort |
| 11 | CRT-008 Diagnostics | 103 | CRT-005, LoggingPort |
| 12 | CRT-009 Scheduler | 103 | CRT-005, ClockPort, TxCoordinator, EventDispatcher |
| 13 | CRT-007 HealthMonitor | 103 | CRT-005, Scheduler, tous les Ports |
| 14 | CRT-010 StartupPipeline | 103/106 | TOUS les composants ci-dessus |
| 15 | CRT-011 ShutdownPipeline | 103/106 | TOUS les composants ci-dessus |
| 16 | CRT-001 CompositionRoot (bind) | 104 | TOUS les composants + 17 Ports |
| 17 | CRT-006 LifecycleManager (start) | 106 | CRT-010, CRT-011 |

---

## GESTION DES ERREURS CRITIQUES PAR PHASE

| Phase | Erreur Critique | Récupération | Comportement |
|-------|----------------|-------------|-------------|
| 100 | Insuffisant mémoire | Aucune | EXIT IMMÉDIAT (E-BOOT-001) |
| 101 | Setting requis manquant | Aucune (default absent) | EXIT IMMÉDIAT (E-CONFIG-001) |
| 101 | Setting format invalide | Correction impossible | EXIT IMMÉDIAT (E-CONFIG-002) |
| 102 | Tables manquantes | Mode migration si activé | Sinon EXIT IMMÉDIAT (E-DATA-001) |
| 102 | Connection DB échoue | Retry unique 2s | Sinon EXIT (E-DATA-004) |
| 103 | Cycle dans graphe | Aucune (impossible à corriger) | EXIT IMMÉDIAT (E-ASSEMBLY-000) |
| 104 | Adapter catégorie inconnue | Aucune | EXIT IMMÉDIAT (E-ASSEMBLY-001) |
| 105 | Healthcheck UNHEALTHY | Correction configuration nécessaire | EXIT IMMÉDIAT (E-HEALTH-001) |
| 105 | Healthcheck DEGRADED | Accepté, démarrage avec alerte | Continue à Phase 106 |
| 106 | Job cron syntax error | Job invalide supprimé | Continue DEGRADED |
| 107 | Invariant violé | Rollback transaction | E-422-NNN_INV-XXX |
| 107 | Persist échoue | Rollback transaction | E-500-002 |
| 107 | Event publish exhaust retries | Event re-scheduled par Scheduler | WARNING, operation réussi quand même |
| 108 | Grace period timeout | Force shutdown | Continue à Phase 109 |
| 109 | Resource close timeout | Force release | WARNING, ressource leaked |
| 110 | Exit failed | Intervention OS | Process zombie |

---

## DÉPENDANCES CROISÉES AVEC LES DOCUMENTS CANONIQUES

| Document | Liens avec le cycle de vie |
|----------|--------------------------|
| DOC-000 | Hiérarchie des couches → définit l'ordre bottom-up de l'assemblage |
| DOC-012 | 13 Aggregates → chaque Aggregate est instancié pendant Phase 103 |
| DOC-014 | Events → EventDispatcher subscriptions configurées à Phase 106 |
| DOC-015 | 58 Invariants → vérifiés pendant Phase 107 (Domain Execution) |
| DOC-017 | Persistence Model → schemas vérifiés à Phase 102 |
| DOC-019 | Persistence Strategy → adapter selection à Phase 104 |
| PAS-001 | 17 Ports → bindés à Phase 104 |
| PAS-002 | Adapter Categories → choix d'adapter à Phase 104 |
| PAS-003 | Dependency Rules (DR-001..DR-012) → respectés par DependencyResolver |
| ASS-001 | 13 AppServices → exposés à Phase 106 |
| ASS-003 | Workflow Standard → pattern exécuté à Phase 107 |
| ASS-004 | Cross-Aggregate Coordination → Sagas exécutés à Phase 107 |
| RTC-001 | Runtime Constraints → tous les invariants LV-001..LV-010 |

---

## NOTES D'IMPLÉMENTATION

1. **Atomicité des phases** : aucune phase ne peut laisser l'application dans un état intermédiaire. Si une phase échoue après avoir partiellement progressé, tout rollback doit être effectué avant l'exit.

2. **Observabilité** : chaque étape de chaque phase produit une entrée de log. Les logs sont structuraux (JSON avec fields : `phase`, `step`, `component`, `status`, `duration_ms`).

3. **Testabilité** : le DependencyResolver doit produire un ordre reproductible. Les tests unitaires doivent pouvoir simuler l'ordre topologique sans lancer l'application entière.

4. **Extensibilité** : l'ajout d'un nouveau Runtime Component au catalogue doit :
   - Ajouter le composant à la liste CRT-NNN de RTS-001
   - Mettre à jour le graphe de dépendances du DependencyResolver
   - Ajouter l'étape correspondante dans RTS-002 à la phase appropriée
   - Documenter les nouveaux health checks requis

5. **Monitoring Kubernetes** : le readiness probe doit appeler l'endpoint exposé par HealthMonitor après la Phase 106. Le liveness probe doit vérifier que l'application ne bloque pas en Phase 107.

6. **Rollforward recovery** : si l'application crash pendant Phase 107 (traitement normal), le prochain démarrage redémarre depuis la Phase 100. Les offline pending operations (sauvegardées en local) sont reprises automatiquement par le Scheduler à Phase 107.

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | runtime-specifier v1.0 | Création — Specification du cycle de vieRuntime en 10 phases pour Lumina v1 | COMPLIANT (trace vérifié contre RTS-001 DOC-000, DOC-012, DOC-014, DOC-015, DOC-017, DOC-019, PAS-001, PAS-002, PAS-003, ASS-001, ASS-003, ASS-004) |

---

*Ce document définit les 10 phases du cycle de vie Runtime Lumina. Le catalogue des 15 composants est dans RTS-001. Les détails de chaque contrat de composant sont dans RTS-003 à RTS-006. Les patterns de workflow sont dans ASS-003.*
