# Metrics Model — Lumina v1

**Doc ID:** OPS-SPEC-002
**Version:** v1.0
**Statut:** SPÉCIFICATION OPS DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-001", "ASS-001", "DOC-015"]
**Transformation_rule :** "ops-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit le modèle de métriques abstrait pour l'ensemble de l'architecture Lumina v1. Il couvre les principes, les types, les métriques système, les métriques métier, les health checks et les seuils d'alerte -- sans prescrire aucun outil concret (pas de Prometheus, Grafana, Datadog, InfluxDB, etc.). Les spécifications opérationnelles restent indépendantes de toute plateforme d'implémentation.

Ce modèle s'applique à tous les 15 Runtime Components (CRT-001 à CRT-015) définis dans RTS-001, aux 83 opérations des 13 Application Services définis dans ASS-001, et aux 58 invariants de DOC-015.

**Lien avec OPS-SPEC-001** : Les métriques et les logs sont complémentaires mais distincts. Les logs (OPS-SPEC-001) capturent les événements discrets. Les métriques capturent les états quantifiables et agrégés. Chaque métrique peut être corrélée à un ou plusieurs logs via `correlation_id`.

---

## SECTION 1 : PHILOSOPHIE DES MÉTRIQUES

### Principe 1 : Les Métriques Capturent l'État Quantifiable, Jamais la Logique Décisionnelle

Les métriques documentent QUOI s'est produit et DANS QUELLES QUANTITÉS. Elles ne contiennent JAMAIS de logique de prise de décision. La décision de déclencher une alerte, de scaler, ou de modifier le comportement est externalisée au système de monitoring/alerting (défini dans OPS-SPEC-004).

**Application concrète** :
- Une métrique dit : "127 transactions en attente de synchronisation".
- La décision de notifier l'administrateur parce que 127 > 100 est gérée par l'overlay d'alerting (OPS-SPEC-004), pas par la métrique elle-même.
- Le code applicatif compte, n'agit pas.

### Principe 2 : Append-Only

Toutes les métriques sont append-only (une fois enregistrées, jamais modifiées). Un Counter ne peut jamais décroître (uniquement croître). Un Gauge mesure un snapshot à un instant t ; le snapshot suivant est un nouveau point de données, pas une modification du précédent.

**Application concrète** :
- Quand `business.resource.transaction.created_total` passe de 150 à 151, c'est une nouvelle donnée ajoutée, pas une modification.
- L'historique complet des points de mesure est conservé, sans overwrite.

### Principe 3 : Dimension Corrélation + Multi-Tenant

Chaque métrique possède obligatoirement deux dimensions pour la corrélation et l'isolation multi-tenant :
- `correlation_id` : UUID v7 pour tracer une requête unique
- `org_id` : identifiant de l'organisation concernée

Ces dimensions sont incluses dans TOUS les types de métriques (Counter, Gauge, Histogram, Summary, Timer), y compris les métriques infrastructure non-scopées par org.

### Principe 4 : Nommage Conventionnel Unifié

Le format de nommage des métriques suit strictement ce pattern :

```
{tier}.{category}.{entity_or_scope}.{metric_name}.{statistic_type}
```

- **tier** : `system` (infrastructure) ou `business` (domaine)
- **category** : le domaine concerné (`http`, `transaction`, `health`, `sync`, `error`, etc.)
- **entity_or_scope** : le composant, l'Aggregate, ou l'entité concernée
- **metric_name** : la mesure spécifique (`count`, `duration`, `status`, `pending`, etc.)
- **statistic_type** : le type d'agrégation (`total`, `active`, `rate`, `seconds`, etc.)

**Exemples valides** :
- `system.http.requests_total`
- `business.resource.transaction.created_total`
- `runtime.health.port_status`
- `system.error.count_by_category`
- `business.sync.operations_pending_count`

**Interdits** : Noms de métriques sans préfixe de tier, noms contenant des caractères spéciaux autres que `_` et `-`, noms referencing des outils concrets.

### Principe 5 : Granularité Temporelle Définie

Chaque métrique a une granularité temporelle associée qui définit sa fréquence d'agrégation :

| Granularité | Description | Fréquence de mise à jour |
|-------------|-------------|-------------------------|
| point | Snapshot instantané | Temps réel |
| minute | Agrégation par minute | Toute les 60 secondes |
| hour | Agrégation par heure | Toutes les heures |
| daily | Agrégation journalière | À minuit UTC |
| rollup | Rollup automatisé (daily → monthly) | Mensuel |

---

## SECTION 2 : TYPES DE MÉTRIQUES ABSTRACTS

Définition abstraite des cinq types de métriques autorisés. Aucun type personnalisé n'est autorisé.

### Type 1 : Counter

Un Counter est une métrique scalaire qui ne peut qu'augmenter (ou être réinitialisée au démarrage d'un processus). Elle représente un compteur cumulatif d'événements.

**Utilisation** : Événements qui se produisent et restent comptés à vie.
**Exemples** : nombre total de transactions créées, nombre total de requêtes HTTP reçues, nombre total d'échecs de validation.
**Contrainte** : Ne doit jamais être utilisé pour mesurer une valeur qui fluctue (haut/bas). Utiliser un Gauge dans ce cas.
**Résolution** : `Counter.incr(value=1)` ou `Counter.incr(value=N)` atomique.

### Type 2 : Gauge

Un Gauge est une métrique scalaire qui peut augmenter et diminuer. Elle représente l'état courant d'une ressource ou d'une quantité.

**Utilisation** : Valeurs qui montent et descendent, bornées par un ensemble de contraintes.
**Exemples** : nombre de connexions actives dans le pool, nombre d'opérations en attente, utilisation mémoire actuelle.
**Contrainte** : Ne conserve pas d'historique par défaut -- seulement le dernier point de mesure. Pour conserver l'historique, utiliser un Histogram ou Summary.
**Résolution** : `Gauge.set(value)` ou `Gauge.increment(delta)` / `Gauge.decrement(delta)`.

### Type 3 : Histogram

Un Histogram distribue les valeurs observées dans des buckets configurables. Il calcule automatiquement le count total, la somme, et les statistiques par bucket.

**Utilisation** : Distribution de valeurs continues sur une période, quand on veut comprendre l'étalement des mesures.
**Exemples** : distribution des latences de requête, distribution des tailles de payload, distribution des durées de transaction.
**Contrainte** : Les buckets doivent être pré-définis et documentés. Les modifications de buckets après déploiement invalident la comparabilité historique.
**Résolution** : `Histogram.observe(value)` pour chaque observation individuelle.

**Buckets standards recommandés pour les durées (ms)** : `[5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]`

### Type 4 : Summary

Une Summary est similaire à un Histogram mais calcule des agrégations pré-computées (percentiles) sur une fenêtre glissante. Contrairement à l'Histogram, la Summary calcule les percentiles côté collecteur et les expose directement.

**Utilisation** : Quand les percentiles (p50, p95, p99) sont la source de vérité principale pour le monitoring.
**Exemples** : percentiles de latence de bout en bout, percentiles de temps de réponse API.
**Contrainte** : Plus coûteuse en calcul qu'un Histogram. Utiliser principalement pour les métriques de performance critiques.
**Résolution** : `Summary.observe(value)` comme pour l'Histogram. Les percentiles sont calculés automatiquement.

### Type 5 : Timer

Un Timer est une combinaison d'un Counter + Histogram : il mesure à la fois le nombre total d'opérations (counter) ET la distribution de leurs durées (histogram).

**Utilisation** : Toute opération dont on veut suivre à la fois le volume ET la performance.
**Exemples** : temps total passé dans le traitement d'une requête, durée de chaque transaction, temps d'exécution d'une tâche planifiée.
**Contrainte** : Ne pas utiliser quand seul le volume (Counter pur) ou seule la distribution (Histogram pur) est nécessaire.
**Résolution** : `Timer.start()` / `Timer.stop()` entourant l'opération mesurée, ou `Timer.observe(duration_ms, value)`.

---

## SECTION 3 : MÉTRIQUES SYSTÈME (Niveau Infrastructure)

Chaque Runtime Component produit des métriques spécifiques liées à son rôle. Cette section définit les métriques par composant selon RTS-001.

### 3.1 Métriques par Runtime Component

#### Runtime Component: CRT-001 CompositionRoot

| Metric Name Pattern | Type | Granularité | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.component.{component}.initialized` | Counter | point | Track successful component initialization during startup | CRT-001 lifecycle |
| `runtime.component.assembly.duration_seconds` | Timer | point | Total time to complete assembly of all components | CRT-001 configure() |
| `runtime.component.port_bindings_total` | Counter | point | Total number of Port->Adapter bindings performed | CRT-001 section on binding 17 ports |
| `runtime.component.service_exposure_total` | Counter | point | Total number of Application Services exposed | CRT-001 section on exposing 13 services |

**Usage détaillé** :
- `runtime.component.initialization_order` (Gauge): current position in topological sort (0-15).
- `runtime.component.failed_bind_count` (Counter): number of port-to-adapter bind failures (should be 0 at steady state).
- `runtime.component.total_components_bound` (Gauge): number of successfully bound components (expected: 15).

#### Runtime Component: CRT-002 DependencyResolver

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.dependency_graph.edges_total` | Counter | point | Number of dependency edges analyzed during resolution | CRT-002 graph analysis |
| `runtime.dependency_graph.vertices_total` | Counter | point | Number of vertices (components) in the dependency graph | CRT-002 graph construction |
| `runtime.dependency_resolution_cycles_detected` | Counter | point | Number of cycles detected (should be 0; any > 0 is critical) | CRT-002 cycle detection |
| `runtime.dependency_resolution.topological_sort_duration_ms` | Timer | point | Time to compute topological order | CRT-002 sorting algorithm |

**Usage détaillé** :
- Ces métriques sont ONE-SHOT (produites uniquement au démarrage). Leur valeur n'évolue pas pendant l'exécution.
- `runtime.dependency_resolution.status` (Gauge): 0 = not resolved, 1 = resolved, 2 = cycle detected.

#### Runtime Component: CRT-003 TransactionCoordinator

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.transaction.begin_count` | Counter | daily | Total transaction scope beginnings | CRT-003 begin/commit/rollback |
| `runtime.transaction.commit_count` | Counter | daily | Total successful transaction commits | CRT-003 begin/commit/rollback |
| `runtime.transaction.rollback_count` | Counter | daily | Total transaction rollbacks | CRT-003 begin/commit/rollback |
| `runtime.transaction.saga_step_count` | Counter | daily | Total saga steps executed across all sagas | CRT-003 compensation actions |
| `runtime.transaction.saga_compensation_count` | Counter | daily | Total compensation actions executed | CRT-003 compensation actions |
| `runtime.transaction.timeout_count` | Counter | daily | Total transaction timeouts (auto-rolled-back) | CRT-003 timeout management |
| `runtime.transaction.active_scopes` | Gauge | point | Current number of active (in-flight) transaction scopes | CRT-003 scope-by-scope lifecycle |
| `runtime.transaction.cross_aggregate_count` | Counter | daily | Transactions spanning multiple aggregates | CRT-003 cross-aggregate coordination |
| `runtime.transaction.duration_seconds` | Timer | point | Duration of each transaction scope | CRT-003 timeout + measurement |

**Usage détaillé** :
- `begin_count - commit_count - rollback_count` should equal 0 at steady state. Non-zero gap indicates in-flight or leaked scopes.
- `saga_compensation_count` tracks how often sagas need to unwind. High rate indicates systemic issues in the Saga step ordering.

#### Runtime Component: CRT-004 EventDispatcher

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.events.published_total` | Counter | daily | Total domain events published by this component | CRT-004 event publication |
| `runtime.events.consumed_total` | Counter | daily | Total event handler invocations (across all subscribers) | CRT-004 subscriber dispatch |
| `runtime.events.handler_success_count` | Counter | daily | Handlers that completed without error | CRT-004 handler isolation |
| `runtime.events.handler_failure_count` | Counter | daily | Handlers that threw an error (isolated, does not block others) | CRT-004 handler isolation |
| `runtime.events.dlq_placed_total` | Counter | daily | Events moved to dead-letter queue after exhausted retries | CRT-004 retry exhaustion |
| `runtime.events.in_flight` | Gauge | point | Currently dispatched events waiting for handler completion | CRT-004 dispatch lifecycle |
| `runtime.events.dispatch_order_violations_total` | Counter | point | Order violations detected (should be 0) | CRT-004 sequential consumption invariant |
| `runtime.events.retry_count` | Counter | daily | Total retry attempts for failed event publications | CRT-004 exponential backoff |

**Usage détaillé** :
- `published_total` should approximately equal `consumed_total` over time (some handlers may not subscribe to every event).
- `handler_failure_count` growing independently of `published_total` indicates a specific broken handler, not a systemic issue.
- Dispatch order violations are CRITICAL: CRT-001 constitutionally requires sequential event handling.

#### Runtime Component: CRT-005 ConfigurationLoader

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.config.sources_loaded_total` | Counter | point | Number of configuration sources successfully loaded | CRT-005 load from files/env/templates |
| `runtime.config.defaults_applied_total` | Counter | point | Number of missing keys filled with template defaults | CRT-005 CFG-004 compliance |
| `runtime.config.validation_failures_total` | Counter | point | Configuration values failing format validation | CRT-005 CFG-001/002/003 validation |
| `runtime.config.conflicts_detected_total` | Counter | point | Conflicts between config sources resolved | CRT-005 conflict resolution |
| `runtime.config.reload_count` | Counter | point | Number of explicit configuration reloads (admin-triggered) | CRT-005 lifecycle |
| `runtime.config.source_priority` | Gauge | point | Currently active priority level among sources (0=file, 1=env, 2=default) | CRT-005 ordered sources |

**Usage détaillé** :
- Any `validation_failures_total > 0` after startup should trigger a CRITICAL alert (CRT-005 constitutionally exits on invalid config).
- `defaults_applied_total` growing post-deployment may indicate misconfiguration drift.

#### Runtime Component: CRT-006 LifecycleManager

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.lifecycle.state` | Gauge | point | Current lifecycle state (0=idle, 1=starting, 2=running, 3=shutting_down, 4=stopped) | CRT-006 state orchestration |
| `runtime.lifecycle.startups_total` | Counter | point | Successful application startups | CRT-006 startup pipeline invocation |
| `runtime.lifecycle.startup_failures_total` | Counter | point | Failed application startups (immediate exit) | CRT-006 startup error handling |
| `runtime.lifecycle.shutdowns_total` | Counter | point | Graceful shutdown completions | CRT-006 shutdown pipeline invocation |
| `runtime.lifecycle.shutdown_forces_total` | Counter | point | Forced shutdowns (grace period exceeded) | CRT-006 forced terminate |
| `runtime.lifecycle.os_signals_received` | Counter | point | OS signals captured (SIGINT, SIGTERM, etc.) | CRT-006 signal interception |

**Usage détaillé** :
- `state != 2` during normal operation is abnormal.
- `shutdown_forces_total > 0` indicates a shutdown timeout was breached -- investigate why graceful shutdown could not complete.

#### Runtime Component: CRT-007 HealthMonitor

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.health.check_passed_total` | Counter | minute | Individual health check passings | CRT-007 periodic polling |
| `runtime.health.check_failed_total` | Counter | minute | Individual health check failures | CRT-007 periodic polling |
| `runtime.health.global_status` | Gauge | point | Aggregated health verdict (0=healthy, 1=degraded, 2=unhealthy) | CRT-007 global aggregation |
| `runtime.health.poll_duration_ms` | Timer | point | Time to complete one full health check cycle | CRT-007 polling interval |
| `runtime.health.state_changes_total` | Counter | daily | Transitions between healthy/degraded/unhealthy states | CRT-007 state change logging |

**Usage détaillé** :
- Each port has its own metric: `runtime.health.port.{port_name}.status` (0=unhealthy, 1=healthy).
- Port names come from the port coverage matrix in RTS-001: `RepoPort`, `EventPubPort`, `CachePort`, `ClockPort`, `ConfigurationPort`, `LoggingPort`, `SearchPort`, `FileStoragePort`, `VocabularyAccessPort`, etc.

#### Runtime Component: CRT-008 Diagnostics

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.diagnostics.snapshot_duration_seconds` | Timer | point | Time to produce a diagnostic dump | CRT-008 dump generation |
| `runtime.diagnostics.sensitive_data_filters_triggered_total` | Counter | daily | Schema-based sensitive data filter hits (BR-ID-001 compliance) | CRT-008 sensitivity filtering |
| `runtime.diagnostics.read_only_violations_total` | Counter | point | Attempts to modify application state through diagnostics (should be 0) | CRT-008 read-only invariant |
| `runtime.diagnostics.active_snapshots` | Gauge | point | Number of concurrent diagnostic snapshot operations | CRT-008 concurrent access |

**Usage détaillé** :
- `sensitive_data_filters_triggered_total` counts the raw number of fields filtered, not the number of sensitive data exposures (which should always be 0 per BR-ID-001).

#### Runtime Component: CRT-009 Scheduler

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.scheduler.jobs_scheduled_total` | Counter | daily | Total jobs registered with the scheduler | CRT-009 task registration |
| `runtime.scheduler.jobs_executed_total` | Counter | daily | Jobs that completed successfully | CRT-009 execution |
| `runtime.scheduler.jobs_failed_total` | Counter | daily | Jobs that failed (logged + retried with backoff) | CRT-009 error handling |
| `runtime.scheduler.jobs_timeout_total` | Counter | daily | Jobs exceeding their configured duration | CRT-009 timeout management |
| `runtime.scheduler.jobs_retries_total` | Counter | daily | Retry attempts for failed jobs | CRT-009 backoff exponential |
| `runtime.scheduler.jobs_concurrent` | Gauge | point | Currently executing jobs (should never exceed 1 per job definition) | CRT-009 no-overlap guarantee |
| `runtime.scheduler.clock_drift_ms` | Gauge | point | Drift between ClockPort.now() and wall clock | CRT-009 ClockPort dependency |

**Scheduled tasks tracked** (per CRT-009 Tâches planifiées section):
- HealthMonitor polling
- PushPendingOperations
- PurgeSchedule (daily)
- Session cleanup
- Balance calculation refresh
- Conflict detection scan

#### Runtime Component: CRT-010 StartupPipeline

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.startup.pipeline_steps_total` | Counter | point | Number of pipeline steps defined (expected: 11) | CRT-010 étapes séquentielles |
| `runtime.startup.pipeline_completed_steps` | Gauge | point | Steps completed out of total | CRT-010 execution progress |
| `runtime.startup.step_durations_seconds` | Timer | point | Duration of each individual pipeline step | CRT-010 step timing |
| `runtime.startup.validation_pass_count` | Counter | point | Successful end-of-pipeline validations | CRT-010 final validation |
| `runtime.startup.validation_fail_count` | Counter | point | Failed validations causing immediate exit | CRT-010 error handling |
| `runtime.startup.readiness_signaled_total` | Counter | point | Times readiness signal sent to LifecycleManager | CRT-010 step 11 |

**Usage détaillé** :
- The 11 steps are: (1) ConfigLoader, (2) DependencyResolver, (3) ClockPort init, (4) UUIDPort init, (5) RepositoryPort init, (6) EventPublicationPort + EventSubscriptionPort init, (7) TransactionCoordinator ready, (8) EventDispatcher subscription, (9) App Services exposure (13), (10) Cross-cutting wiring (RetryPolicy, Idempotency, Audit), (11) Assembly validation + readiness signal.
- `pipeline_completed_steps < 11` at steady state means incomplete startup.

#### Runtime Component: CRT-011 ShutdownPipeline

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.shutdown.pipeline_steps_initiated` | Counter | point | How many shutdown steps were started | CRT-011 étapes d'arret |
| `runtime.shutdown.pipeline_steps_completed` | Counter | point | How many shutdown steps finished successfully | CRT-011 shutdown sequence |
| `runtime.shutdown.drain_duration_seconds` | Timer | point | Time to drain in-flight requests (grace period) | CRT-011 grace period |
| `runtime.shutdown.pending_ops_flushed_total` | Counter | point | Pending operations flushed from OfflineSyncAggregate | CRT-011 step 3 |
| `runtime.shutdown.connection_pools_closed_total` | Counter | point | Connection pools closed during shutdown | CRT-011 step 4 |
| `runtime.shutdown.forced_early_total` | Counter | point | Shutdowns terminated early due to timeout | CRT-011 timeout handling |

**Usage détaillé** :
- `pending_ops_flushed_total` should match the count of pending operations before shutdown. Gap indicates potential data loss.
- `forced_early_total > 0` means the grace period was insufficient. Increase timeout if recurring.

#### Runtime Component: CRT-012 RetryPolicy

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.retry.attempts_total` | Counter | daily | Total retry attempts across all operation types | CRT-012 retry policy application |
| `runtime.retry.exhausted_total` | Counter | daily | Operations exhausting max retries (5) | CRT-012 constitutionnel max=5 |
| `runtime.retry.by_operation_type` | Counter | daily | Retry attempts grouped by operation type | CRT-012 strategies par type |
| `runtime.retry.backoff_delay_seconds` | Histogram | point | Distribution of backoff delays applied | CRT-012 exponential backoff |
| `runtime.retry.transient_vs_permanent_ratio` | Gauge | point | Ratio of transient (retried) vs permanent (skipped) errors | CRT-012 error distinction |

**Retry strategies tracked** (per CRT-012 Strategies de retry section) :
- Event Publication: backoff exponential, max 5 retries
- Sync Push: backoff exponential, max 5 retries (BR-SYNC-003)
- Cache Access: 1 retry only (best-effort)
- Repository Operations: 0 retries
- Notification Send: backoff exponential, max 5 retries (BR-NOT-004)

#### Runtime Component: CRT-013 IdempotencyManager

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.idempotency.hits_total` | Counter | daily | Idempotent key cache hits (duplicate request detected) | CRT-013 cache results |
| `runtime.idempotency.misses_total` | Counter | daily | Cache misses (request processed normally) | CRT-013 proceed normally |
| `runtime.idempotency.evictions_total` | Counter | daily | Idempotent keys evicted per TTL policy (LRU or TTL) | CRT-013 eviction strategy |
| `runtime.idempotency.active_keys` | Gauge | point | Currently active idempotent keys in cache | CRT-013 TTL configurable |
| `runtime.idempotency.replay_requests_total` | Counter | daily | Detected replay requests returning cached result | CRT-013 cache hit = replay |

**Usage détaillé** :
- Default TTL is 24 hours per CRT-013 constitutional rule.
- High hit rate relative to miss rate may indicate client-side retry behavior that needs adjustment at the API layer.

#### Runtime Component: CRT-014 AuditEnabler

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.audit.entries_captured_total` | Counter | daily | Before/after state captures by AuditEnabler | CRT-014 write intercept |
| `runtime.audit.write_successes_total` | Counter | daily | Successful audit entries written via AuditPort | CRT-014 AuditPort.log() |
| `runtime.audit.write_failures_total` | Counter | daily | Failed audit writes (non-blocking per AUD-001) | CRT-014 non-blocking error handling |
| `runtime.audit.self_audit_skips_total` | Counter | daily | Self-audit attempts skipped (NB-PERSIST-007) | CRT-014 recursive prevention |
| `runtime.audit.oldnew_capture_completeness` | Gauge | point | Percentage of captures with both old_values AND new_values (expected: 100%) | CRT-014 OLDNEW-002 |

**Usage détaillé** :
- `oldnew_capture_completeness < 100%` is a direct violation of OLDNEW-002 (constitutionnel).
- `write_failures_total` growing is expected (non-blocking) but high rates indicate AuditPort unavailability.

#### Runtime Component: CRT-015 TenantContextProvider

| Metric Name Pattern | Type | Granularity | Purpose | Source RTS-001 |
|---------------------|------|-------------|---------|---------------|
| `runtime.tenant.context_resolved_total` | Counter | daily | Successful org_id resolutions from auth session | CRT-015 org_id resolution |
| `runtime.tenant.context_resolution_failures_total` | Counter | daily | Failed org_id resolutions (returning 401/403) | CRT-015 error handling |
| `runtime.tenant.org_isolation_violations_total` | Counter | point | Cross-tenant org_id injection attempts (should be 0) | CRT-015 INV-004 constitutionnel |
| `runtime.tenant.explicit_overrides_total` | Counter | daily | Directly supplied org_id attempts (from HTTP params) -- should be 0 | CRT-015 constitutional restriction |
| `runtime.tenant.active_contexts` | Gauge | point | Currently active tenant contexts (per-request scoping) | CRT-015 scoped lifecycle |

**Usage détaillé** :
- `org_isolation_violations_total > 0` or `explicit_overrides_total > 0` are direct violations of INV-004 and CRT-015 constitutional rules. These must be P0-level events.
- Resolution failures correlate with authentication issues, not tenant problems.

### 3.2 Métriques Infrastructure Globales

Ces métriques ne sont pas attachées à un composant spécifique mais couvrent l'ensemble du système.

#### Métriques Réseau / HTTP

| Metric Name | Type | Dimensions | Purpose |
|-------------|------|------------|---------|
| `system.http.requests_total` | Counter | method, status_code, endpoint_pattern, org_id | Total HTTP requests received by the API layer |
| `system.http.responses_duration_seconds` | Histogram | method, endpoint_pattern, status_code | Request latency distribution |
| `system.http.in_flight` | Gauge | endpoint_pattern | Currently processing requests |
| `system.http.bytes_sent_total` | Counter | status_code | Response payload size |
| `system.http.bytes_received_total` | Counter | method | Request payload size |
| `system.http.method_distribution` | Counter | method | Breakdown by HTTP method |

**Percentiles standard** : p50, p90, p95, p99 de `system.http.responses_duration_seconds`.

#### Métriques d'Erreurs

| Metric Name | Type | Dimensions | Purpose |
|-------------|------|------------|---------|
| `system.error.count_total` | Counter | error_category, error_code, component, org_id | Total errors by category |
| `system.error.rate` | Gauge | error_category | Error rate as percentage of total requests |
| `system.error.category.domain_violation` | Counter | invariant_code, aggregate_name | Domain invariant violations (DOC-015) |
| `system.error.category.persistence_error` | Counter | port_name, adapter_type | Database/storage operation failures |
| `system.error.category.timeout` | Counter | timeout_type, component | Request/operation timeouts |
| `system.error.category.network` | Counter | target_service | Network connectivity failures |

**Categories d'erreurs** : `domain_violation`, `persistence_error`, `timeout`, `network_error`, `authorization_error`, `configuration_error`, `validation_error`, `resource_exhausted`.

#### Métriques Ressources Système

| Metric Name | Type | Dimensions | Purpose |
|-------------|------|------------|---------|
| `system.connection_pool.active` | Gauge | pool_name (repo, cache, filestorage) | Currently active connections |
| `system.connection_pool.max` | Gauge | pool_name | Maximum allowed connections per pool |
| `system.connection_pool.idle` | Gauge | pool_name | Idle connections waiting reuse |
| `system.connection_pool.wait_time_seconds` | Histogram | pool_name | Time waiting for connection acquisition |
| `system.memory.used_bytes` | Gauge | -- | Current memory usage |
| `system.memory.available_bytes` | Gauge | -- | Available memory for allocation |
| `system.memory.gc_pause_ms` | Histogram | gc_phase | Garbage collection pause durations |
| `system.cpu.utilization_percent` | Gauge | -- | CPU usage percentage |
| `system.threads.active` | Gauge | -- | Active thread count |

#### Métriques de Synchronisation Offline (Infrastructure-Business Borderline)

| Metric Name | Type | Dimensions | Purpose |
|-------------|------|------------|---------|
| `system.sync.pending_operations_count` | Gauge | operation_type (push/pull/conflict) | Items waiting sync (OfflineSyncAggregate) |
| `system.sync.batch_sizes` | Histogram | -- | Distribution of batch sizes used in push |
| `system.sync.confirmations_total` | Counter | -- | Successfully confirmed sync operations |
| `system.sync.failures_total` | Counter | error_type | Sync operation failures |
| `system.sync.gaps_detected_total` | Counter | -- | Sync gaps detected (DOC-015 SYNC-004) |

---

## SECTION 4 : MÉTRIQUES MÉTIER (Niveau Domaine)

Pour chacun des 13 Aggregates (ASS-001), cette section définit les métriques métier clés. Ces métriques suivent la convention `business.{aggregate}.{entity}.{metric}`.

### 4.1 Aggregate: OrganizationAggregate

**Service** : OrganizationService (ASS-001, Service 1, 10 operations)
**Invariants référencés** : REL-001, REL-002, INV-004, BR-ORG-002, BR-ORG-006, CFG-001..004

```markdown
- business.organization.units_created_total (counter, daily rollup)
- business.organization.units_updated_total (counter, daily rollup)
- business.organization.units_archived_total (counter, daily rollup)
- business.organization.units_suspended_total (counter, daily rollup)
- business.organization.hierarchy_depth.max (gauge, point) -- deepest tree depth across all orgs
- business.organization.settings.updated_total (counter, daily rollup)
- business.organization.child_orgs_merged_total (counter, daily rollup)
- business.organization.units_transferred_total (counter, daily rollup)
```

**Détails métier** :
- `units_created_total` increments on `CreateOrganization` and `CreateOrgUnit`.
- `hierarchy_depth.max` must never exceed 5 (REL-002 constitutionnel). If this gauge reaches 5, trigger a WARN alert to prevent depth violations.
- `settings.updated_total` tracks configuration changes via `UpdateOrganizationSettings` which touches CFG-001/002/003/004.

### 4.2 Aggregate: IdentityAggregate

**Service** : IdentityService (ASS-001, Service 2, 9 operations)
**Invariants référencés** : EMAIL-001, BR-ID-001, INV-004, INV-008

```markdown
- business.identity.users_created_total (counter, daily rollup)
- business.identity.users_updated_total (counter, daily rollup)
- business.identity.role_changes_total (counter, daily rollup)
- business.identity.password_resets_total (counter, daily rollup)
- business.identity.sessions.active (gauge, point) -- currently active sessions
- business.identity.login_attempts_total (counter, by result: success/failure/expired)
- business.identity.token_refreshes_total (counter, daily rollup)
- business.identity.session_revocations_total (counter, daily rollup)
- business.identity.permission_grants_total (counter, daily rollup)
- business.identity.auth.login_failure_rate (gauge, minute) -- ratio of failures to total attempts
```

**Détails métier** :
- `login_attempts_total` should be dimensioned by result code for security analysis.
- `auth.login_failure_rate > 0.1` (10% failure rate) during a burst may indicate brute-force activity.
- `email_unique_violations_total` (counter) -- duplicate email within same org (EMAIL-001 invariant).

### 4.3 Aggregate: ResourceAggregate

**Service** : ResourceService (ASS-001, Service 3, 12+ operations including Members and Events)
**Invariants référencés** : FIN-001/002, DATE-001, CAT-001, VERSION-001, CREATEBY-001, COMP-001, SCOPE-001, MEM-001, STATUS-010, DISABLE-011, EXPORT-001

```markdown
- business.resource.transactions.created_total (counter, daily rollup)
- business.resource.transactions.approved_total (counter, daily rollup)
- business.resource.transactions.rejected_total (counter, daily rollup)
- business.resource.transactions.compensated_total (counter, daily rollup)
- business.resource.transactions.in_draft_total (gauge, point) -- unsubmitted drafts
- business.resource.transactions.in_approval_total (gauge, point) -- pending approval
- business.resource.transactions.amount_total (gauge, point) -- sum of approved transaction amounts
- business.resource.members.registered_total (counter, daily rollup)
- business.resource.members.updated_total (counter, daily rollup)
- business.resource.members.status_transitions_total (counter, daily rollup)
- business.resource.events.created_total (counter, daily rollup)
- business.resource.events.status_transitions_total (counter, daily rollup)
- business.resource.export_requests_total (counter, daily rollup) -- EXPORT-001
- business.resource.approval.chain_duration_seconds (timer, point) -- time from creation to final approval
```

**Détails métier** :
- `transactions.created_total - approved_total - rejected_total - compensated_total` should roughly balance with draft/in_approval states.
- `amount_total` is expressed in BIGINT cents (FIN-002). Must always be positive.
- `compensated_total` tracking helps identify processes requiring frequent financial correction.
- Status transitions flow: DRAFT -> PENDING_APPROVAL -> APPROVED/REJECTED -> COMPENSATED (branch from APPROVED). Per STATUS-010, all transitions are valid enum changes.

### 4.4 Aggregate: RelationshipAggregate

**Service** : RelationshipService (ASS-001, Service 4, 6 operations)
**Invariants référencés** : MULTI-020, HISTORY-022, REL-001, REL-002, INV-004

```markdown
- business.relationship.memberships_added_total (counter, daily rollup)
- business.relationship.memberships_removed_total (counter, daily rollup)
- business.relationship.org_unit_reparented_total (counter, daily rollup)
- business.relationship.cycle_detection_attempts_total (counter, daily rollup)
- business.relationship.cycle_detection_failures_total (counter, point) -- should be 0 | 
- business.relationship.group_depth.current_max (gauge, point) -- max depth (must stay <= 5 per REL-002)
- business.relationship.member_group_cross_links (gauge, point) -- total active membership links
- business.relationship.reparent_proposals_accepted_total (counter, daily rollup)
- business.relationship.reparent_proposals_rejected_total (counter, daily rollup) -- would create cycle
```

**Détails métier** :
- `cycle_detection_attempts_total` should equal `reparent_proposals_accepted_total + reproposals_rejected_total`. Mismatch indicates undetected cycles.
- `group_depth.current_max <= 5` is a hard constraint per REL-002.

### 4.5 Aggregate: WorkflowAggregate

**Service** : WorkflowService (ASS-001, Service 5, 6 operations)
**Invariants référencés** : LOG-005, CHAINS-003, WF-001, WF-005, RETRY-004

```markdown
- business.workflow.instances_triggered_total (counter, daily rollup)
- business.workflow.instances_completed_total (counter, daily rollup)
- business.workflow.instances_failed_total (counter, daily rollup)
- business.workflow.instances_cancelled_total (counter, daily rollup)
- business.workflow.instances_escalated_total (counter, daily rollup)
- business.workflow.steps.total_processed (counter, daily rollup)
- business.workflow.steps.approved_total (counter, daily rollup)
- business.workflow.steps.rejected_total (counter, daily rollup)
- business.workflow.steps.expired_timeout_total (counter, daily rollup)
- business.workflow.steps.approver_assignment_duration_seconds (timer, point) -- time from step creation to assignment
- business.workflow.active_instances (gauge, point) -- currently running workflows
- business.workflow.approval_chain_length (histogram, point) -- number of chain levels per workflow (max 5 per CHAINS-003)
- business.workflow.retry_exhausted_total (counter, daily rollup) -- RETRY-004 exhaustions
```

**Détails métier** :
- `approval_chain_length` histogram must never exceed 5 (CHAINS-003 constitutionnel).
- `instances_triggered_total - completed - failed - cancelled - escalated` equals active instances.
- `steps.expired_timeout_total` growing indicates workflow timeout configuration may be too aggressive.

### 4.6 Aggregate: FormAggregate

**Service** : FormService (ASS-001, Service 6, 4 operations)
**Invariants référencés** : FRM-004, DUAL-008, FRM-001, VOCAB-002, FRM-003

```markdown
- business.form.fields_submitted_total (counter, daily rollup)
- business.form.validations_passed_total (counter, daily rollup)
- business.form.validations_failed_total (counter, daily rollup)
- business.form.render_calls_total (counter, daily rollup)
- business.form.visible_field_queries_total (counter, daily rollup)
- business.form.client_server_validation_mismatches_total (counter, point) -- DUAL-008 violations (must be 0)
- business.form.term_resolution_calls_total (counter, daily rollup) -- VOCAB-002 label resolution
```

**Détails métier** :
- `client_server_validation_mismatches_total > 0` is a direct DUAL-008 violation: client and server validation must produce identical results.
- `validations_failed_total / fields_submitted_total` gives form rejection rate -- useful for UX analysis.

### 4.7 Aggregate: NotificationAggregate

**Service** : NotificationService (ASS-001, Service 7, 4 operations, expanded to 6 in ASS-001 detailed table)
**Invariants référencés** : NOT-001, RATE-002, CHANNEL-003, QUIET-004

```markdown
- business.notification.messages_queued_total (counter, daily rollup)
- business.notification.messages_sent_total (counter, daily rollup)
- business.notification.messages_delivered_total (counter, daily rollup)
- business.notification.messages_failed_total (counter, daily rollup)
- business.notification.messages_suppressed_quiet_hours_total (counter, daily rollup) -- QUIET-004
- business.notification.messages_suppressed_ratelimit_total (counter, daily rollup) -- RATE-002
- business.notification.delivery.channels_distribution (counter, by channel) -- per CHANNEL-003 preferences
- business.notification.delivery.success_rate (gauge, minute) -- delivered / sent ratio
- business.notification.preferences.updated_total (counter, daily rollup)
```

**Détails métier** :
- `delivery.success_rate` should approach 1.0. Values below 0.95 indicate delivery issues.
- `messages_suppressed_quiet_hours_total` growing significantly may indicate notification spam perception.
- `messages_queued_total - messages_sent_total - messages_failed_total` should equal currently queued notifications.

### 4.8 Aggregate: VocabularyAggregate

**Service** : VocabularyService (ASS-001, Service 8, 7 operations)
**Invariants référencés** : STABLE-003, TRANSLATION-002, VOC-001

```markdown
- business.vocabulary.namespaces_defined_total (counter, point)
- business.vocabulary.terms_defined_total (counter, daily rollup)
- business.vocabulary.term_values_defined_total (counter, daily rollup)
- business.vocabulary.term_values_deprecated_total (counter, daily rollup) -- VOC-001 IRREVERSIBLE
- business.vocabulary.term_values_active (gauge, point) -- non-deprecated values
- business.vocabulary.resolutions_total (counter, daily rollup) -- ResolveLabel queries
- business.vocabulary.searches_total (counter, daily rollup) -- SearchTerms queries
- business.vocabulary.translations_coverage (gauge, point) -- percentage of terms with FR+EN minimum (TRANSLATION-002)
```

**Détails métier** :
- `term_values_deprecated_total` can only grow (VOC-001: values never deleted, only deprecated -- IRREVERSIBLE).
- `translations_coverage` tracking ensures TRANSLATION-002 minimum (FR+EN) is met for all terms.
- Deprecated values still appear in queries (used for legacy references) -- `active` vs `deprecated` split enables reporting.

### 4.9 Aggregate: ReportingAggregate

**Service** : ReportingService (ASS-001, Service 9, 3 operations)
**Invariants référencés** : BAL-001, MONTH-001, SYNCED-001, EXPORT-001

```markdown
- business.reporting.reports_generated_total (counter, daily rollup)
- business.reporting.snapshots_produced_total (counter, daily rollup)
- business.reporting.balance_calculations_total (counter, daily rollup)
- business.reporting.balance_calculation_errors_total (counter, daily rollup) -- BAL-001 violations (balance must balance)
- business.reporting.period_completeness_violations_total (counter, point) -- MONTH-001
- business.reporting.unsynced_included_in_report_total (counter, point) -- SYNCED-001 violations (should be 0)
- business.reporting.export_formats_distribution (counter, by format) -- EXPORT-001
- business.reporting.computation_duration_seconds (histogram, point) -- report generation time
```

**Détails métier** :
- `balance_calculation_errors_total` measures how often BAL-001 is violated: a report's balances should mathematically reconcile.
- `unsynced_included_in_report_total > 0` is a direct SYNCED-001 violation: only synced=1 records should appear in reports.
- `period_completeness_violations_total` tracks MONTH-001 violations: reporting periods should contain complete data.

### 4.10 Aggregate: AuditAggregate

**Service** : AuditService (ASS-001, Service 10, 3 operations)
**Invariants référencés** : AUD-001, OLDNEW-002, ACCESS-033, RETENTION-031

```markdown
- business.audit.entries_created_total (counter, daily rollup) -- audit is read-only from service perspective; writes via CRT-014
- business.audit.queries_executed_total (counter, daily rollup)
- business.audit.export_trails_generated_total (counter, daily rollup) -- EXPORT per ACCESS-033
- business.audit.access_denied_total (counter, daily rollup) -- ACCESS-033 unauthorized query attempts
- business.audit.retention_compliance_age_years (gauge, point) -- oldest retained entry age
- business.audit.oldnew_completeness_rate (gauge, point) -- percentage with both old AND new values (OLDNEW-002)
```

**Détails métier** :
- `entries_created_total` comes exclusively from CRT-014 AuditEnabler intercepts, not direct calls.
- `access_denied_total` growing may indicate privilege escalation attempts.
- `retention_compliance_age_years >= 7` must hold at all times (RETENTION-031).
- Audit entries themselves are never audited (NB-PERSIST-007 constitutionnel).

### 4.11 Aggregate: LifecycleAggregate

**Service** : LifecycleService (ASS-001, Service 11, 7 operations)
**Invariants référencés** : LIF-001, LIF-003, LIF-005, LIF-006

```markdown
- business.lifecycle.archives_created_total (counter, daily rollup)
- business.lifecycle.resources_trashed_total (counter, daily rollup)
- business.lifecycle.resources_purged_total (counter, daily rollup)
- business.lifecycle.restores_from_trash_total (counter, daily rollup)
- business.lifecycle.purge_schedules_set_total (counter, daily rollup)
- business.lifecycle.active_archives (gauge, point) -- currently archived but not yet trashed/purged
- business.lifecycle.purge_schedule_compliance (gauge, point) -- percentage of entries where purge_date has passed and entry is trashed (LIF-005)
- business.lifecycle.archive_states_distribution (gauge, by state) -- counts per configurable state per LIF-001
```

**Détails métier** :
- States are configurable via manifest (LIF-001), so `archive_states_distribution` dimension adapts dynamically.
- `purge_schedule_compliance` dropping below 100% means scheduled purges are falling behind.
- Purging is SYSTEM-ONLY (never user-callable per UC-LIF-02 preconditions).

### 4.12 Aggregate: ConfigurationAggregate

**Service** : ConfigurationService (ASS-001, Service 12, 4 operations)
**Invariants référencés** : CFG-001, CFG-002, CFG-003, CFG-004

```markdown
- business.configuration.settings_updated_total (counter, daily rollup)
- business.configuration.defaults_reset_total (counter, daily rollup) -- ResetToDefaults
- business.configuration.settings.get_query_total (counter, daily rollup) -- GetSetting reads
- business.configuration.settings.all_get_total (counter, daily rollup) -- GetAllSettings reads
- business.configuration.validation_errors_total (counter, daily rollup) -- CFG-001/002/003 format failures
```

**Détails métier** :
- `validation_errors_total` measures settings updates failing format checks (ISO 4217 currency, IANA timezone, hex+WCAG color).
- `defaults_reset_total` incrementing frequently suggests configuration drift -- admins resetting to defaults repeatedly.

### 4.13 Aggregate: OfflineSyncAggregate

**Service** : OfflineSyncService (ASS-001, Service 13, 6 operations)
**Invariants référencés** : SYNC-001, SYNC-002, SYNC-003, SYNC-004

```markdown
- business.sync.operations_pending_push_count (gauge, point) -- local ops waiting server connection
- business.sync.operations_pending_pull_count (gauge, point) -- remote deltas waiting local merge
- business.sync.push_batches_total (counter, daily rollup)
- business.sync.push_operations_total (counter, daily rollup)
- business.sync.pull_deltas_total (counter, daily rollup)
- business.sync.conflicts_detected_total (counter, daily rollup)
- business.sync.conflicts_resolved_auto_total (counter, daily rollup) -- system-auto resolution
- business.sync.conflicts_resolved_manual_total (counter, daily rollup) -- admin/manual override
- business.sync.confirmations_total (counter, daily rollup) -- MarkOperationConfirmed successes
- business.sync.failures_total (counter, daily rollup) -- exhaustive retries
- business.sync.connectivity.status (gauge, point) -- 1=connected, 0=disconnected
- business.sync.connectivity.outages_total (counter, daily rollup) -- ConnectionLost events
- business.sync.connectivity.recovery_count_total (counter, daily rollup) -- ConnectionRestored events
- business.sync.batch_size_distribution (histogram, point) -- batch sizes (max 50 per SYNC-002)
- business.sync.operation_types_distribution (gauge, by op_type) -- composition of pending queue
```

**Détails métier** :
- SYNC-001: `operations_pending_push_count > 0` with `connectivity.status == 0` is the core offline-first scenario.
- SYNC-002: `batch_size_distribution` should never show values > 50.
- SYNC-003: push failures follow exponential backoff, max 5 retries.
- SYNC-004: `connectivity.status` transitions drive `NotificationAggregate` state change events.

---

## SECTION 5 : MÉTRIQUES DE HEALTH CHECK

Depuis HealthMonitor (CRT-007), chaque port de santé produit ses propres métriques. Le HealthMonitor interroge périodiquement TOUS les Ports définis dans PAS-001.

### 5.1 Métriques par Port de Santé

Chaque port interrogé produit deux métriques :

| Metric Name | Type | Values | Source CRT-001 |
|-------------|------|--------|---------------|
| `health.port.{port_name}.status` | Gauge | 0=unhealthy, 1=healthy | CRT-007 health check iteration |
| `health.port.{port_name}.response_time_ms` | Histogram | Any positive integer | CRT-007 health check response time |

**Ports listés dans la matrice de couverture RTS-001 (§MATRICE COUVERTURE)** :
- `RepoPort` -- database connectivity
- `EventPubPort` -- event publication capability
- `EventSubPort` -- event subscription capability
- `IdentityProviderPort` -- authentication availability
- `AuthorizationPort` -- authorization rule engine
- `ClockPort` -- canonical clock validity
- `UUIDPort` -- identifier generation
- `ConfigurationPort` -- settings read capability
- `LoggingPort` -- log writing capability
- `AuditPort` -- audit log write capability
- `NotificationPort` -- message dispatch
- `SearchPort` -- search index accessibility
- `FileStoragePort` -- file storage write/read
- `CachePort` -- cache availability
- `TxManagerPort` -- transaction coordination
- `PersistenceVerifyPort` -- integrity verification
- `VocabularyAccessPort` -- vocabulary term resolution

**Exemple de valeurs** :
- `health.port.RepoPort.status{org_id="all"}` = 1 (healthy)
- `health.port.CachePort.response_time_ms{bucket="500"}` = 3 (observed value in 500ms bucket)

### 5.2 Métriques Agrégées de Santé

| Metric Name | Type | Values | Purpose |
|-------------|------|--------|---------|
| `health.overall.composition_status` | Gauge | 0=degraded, 1=healthy, 2=critical | Aggregated health across all ports |
| `health.ports_unhealthy_count` | Gauge | 0 to 17 | Number of unhealthy ports simultaneously |
| `health.poll_interval_violations_total` | Counter | -- | Polling missed deadline count |
| `health.state_change_duration_ms` | Histogram | -- | Time spent transitioning between healthy/degraded/unhealthy states |

**Composition logic** (CRT-007 constitutionnel) :
- healthy = all ports return 1
- degraded = one or more non-critical ports return 0
- critical = core ports (RepoPort, IdentityProviderPort, ClockPort) return 0

### 5.3 Thresholds Opérationnels de Santé

| Métrique | Seuil | Severity | Action |
|----------|-------|----------|--------|
| `health.ports_unhealthy_count` >= 2 | P2 | Investigate port degradation sources |
| `health.ports_unhealthy_count` >= 5 | P1 | Activate emergency diagnostics |
| `health.overall.composition_status` = 2 | P0 | Alert operations team immediately |
| `health.port.*.response_time_ms` p99 > 2000ms | P2 | Single-port slowness investigation |
| `health.poll_interval_violations_total` increasing | P1 | Scheduler or resource exhaustion |

---

## SECTION 6 : RÈGLES D'ALERTAGE (RÉFÉRENCE)

Cette section définit les seuils abstraits qui mappent aux règles d'alerte dans OPS-SPEC-004. Ce document définit QUAND alerter ; OPS-SPEC-004 définit COMMENT alerter.

### 6.1 Tableau Récapitulatif des Seuils

| Metric Category | Condition | Severity (OPS-SPEC-004) | Mapping |
|-----------------|-----------|------------------------|---------|
| Latence HTTP | `system.http.responses_duration_seconds{quantile="0.99"} > 500ms` | WARN → P2 | Response latency p99 > 500ms triggers WARN alert (OPS-SPEC-002 §6) |
| Taux d'erreur | `system.error.count_total / system.http.requests_total > 0.01` (1%) | ERROR → P1 | Error rate > 1% triggers ERROR alert |
| Pool de connexions | `system.connection_pool.active / system.connection_pool.max > 0.8` | WARN → P2 | Active connections > 80% max triggers WARN alert |
| Health check | `health.port.*.status == 0` for 3 consecutive polls | CRITICAL → P0 | Health check failures for 3 consecutive checks trigger CRITICAL alert |
| Sync pending | `business.sync.operations_pending_push_count` growing continuously for > 15 min | WARN → P2 | Sync pending queue growing beyond threshold |
| Idempotency replay | `runtime.idempotency.hits_total / (hits + misses) > 0.3` | INFO → P4 | High replay ratio (>30%) indicates client retry issues |
| Audit completeness | `business.audit.oldnew_completeness_rate < 1.0` | CRITICAL → P0 | OLDNEW-002 violation: not all audits have both old and new values |
| Tenant isolation | `runtime.tenant.org_isolation_violations_total > 0` | CRITICAL → P0 | INV-004 breach: cross-tenant data access detected |
| Client/server validation mismatch | `business.form.client_server_validation_mismatches_total > 0` | ERROR → P1 | DUAL-008 violation: client and server validation differ |
| Dispatch order violation | `runtime.events.dispatch_order_violations_total > 0` | CRITICAL → P0 | CRT-004 sequential consumption invariant violated |
| Cycle detection failure | `business.relationship.cycle_detection_failures_total > 0` | CRITICAL → P0 | REL-001 DAG cycle constraint violated |
| Backoff linear | Retry backoff is not exponential | ERROR → P1 | BR-SYNC-003 constitutional rule violated |
| Domain error retry | Domain invariant errors are retried | CRITICAL → P0 | OR-005 RTS-003: domain errors must NEVER be retried |

### 6.2 Seuils Informationnels (Pas d'Alerte, Juste Monitoring)

| Metric | Watch Only Threshold | Raison |
|--------|---------------------|--------|
| `runtime.idempotency.hits_total` | Ratio > 0.1 but < 0.3 | Elevated replay but within acceptable client retry range |
| `runtime.scheduler.jobs_failed_total` | < 5/day | Isolated job failures are expected |
| `runtime.audit.write_failures_total` | Any non-zero | Non-blocking by design (AUD-001), just monitor trend |
| `business.notification.messages_suppressed_quiet_hours_total` | > 50% of sent | May indicate notification fatigue; informational |
| `business.reporting.computation_duration_seconds{p99}` | > 30 seconds | Slow reports are expected for large datasets |

### 6.3 Règles de Consolidation d'Alerte

Pour éviter l'alerte fatigue :
- Même `error_code` + même `component` répété N >= 10 fois dans fenêtre M = 5 minutes → consolider en une seule alerte plutôt que N alertes individuelles.
- `health.port.*.status == 0` pour le MÊME port 3 fois consécutivement → P0 CRITICAL. 1 ou 2 fois → ignored (transient tolerance).
- `system.error.count_total` spike followed by recovery within 60 seconds → log WARN, do not escalate to P1 unless spike persists > 3 minutes.

---

## SECTION 7 : COMPLIANCE ET VALIDATION

### Règles non-négociables de conformité

1. **MP-001** : Chaque Runtime Component (CRT-NNN) de RTS-001 a au moins une métrique définie dans cette spécification. Vérifiable par recoupement section 3.1 contre RTS-001.

2. **MP-002** : Chaque Aggregate de ASS-001 a des métriques métier définies dans Section 4. Vérifiable par recoupement Section 4 contre ASS-001.

3. **MP-003** : Toute métrique contient les dimensions `correlation_id` et `org_id`. Vérifiable par inspection de chaque définition de métrique.

4. **MP-004** : Aucun nom d'outil concret (Prometheus, Grafana, Datadog, etc.) n'apparaît dans ce document. Vérifiable par recherche textuelle.

5. **MP-005** : Les conventions de nommage suivent le pattern `{tier}.{category}.{entity}.{metric}.{stat}`. Vérifiable par regex sur toutes les métriques définies.

6. **MP-006** : Les 5 types abstraits (Counter, Gauge, Histogram, Summary, Timer) sont les seuls utilisés. Vérifiable par inspection des colonnes "Type" de tous les tableaux.

7. **MP-007** : Aucune règle d'alerte n'est définie dans ce document -- seulement les seuils de référence. Les règles complètes sont dans OPS-SPEC-004.

8. **MP-008** : Les métriques append-only respectent le Principe 2. Les Counters ne sont jamais utilisé comme des Gagues (et vice-versa). Vérifiable par analyse sémantique.

### Matrice de traçabilité OPS-SPEC-002

| Section du Document | Source RTS-001 | Source ASS-001 | Source DOC-015 |
|--------------------|---------------|---------------|---------------|
| Section 1: Philosophy | -- | -- | Tous les invariants (principe fondamental) |
| Section 2: Types | -- | -- | -- (types abstraits universels) |
| Section 3.1: CRT metrics (CRT-001 to CRT-015) | CRT-001 through CRT-015 sections | -- | -- |
| Section 3.2: Infrastructure metrics | CRT-007, CRT-008 | -- | -- |
| Section 4.1: OrganizationAggregate | -- | OrganizationService | REL-001, REL-002, INV-004, BR-ORG-002, BR-ORG-006, CFG-001..004 |
| Section 4.2: IdentityAggregate | -- | IdentityService | EMAIL-001, BR-ID-001, INV-004, INV-008 |
| Section 4.3: ResourceAggregate | -- | ResourceService | FIN-001/002, DATE-001, CAT-001, VERSION-001, CREATEBY-001, COMP-001, SCOPE-001, MEM-001, STATUS-010, DISABLE-011, EXPORT-001 |
| Section 4.4: RelationshipAggregate | -- | RelationshipService | MULTI-020, HISTORY-022, REL-001, REL-002, INV-004 |
| Section 4.5: WorkflowAggregate | -- | WorkflowService | LOG-005, CHAINS-003, WF-001, WF-005, RETRY-004 |
| Section 4.6: FormAggregate | -- | FormService | FRM-004, DUAL-008, FRM-001, VOCAB-002, FRM-003 |
| Section 4.7: NotificationAggregate | -- | NotificationService | NOT-001, RATE-002, CHANNEL-003, QUIET-004 |
| Section 4.8: VocabularyAggregate | -- | VocabularyService | STABLE-003, TRANSLATION-002, VOC-001 |
| Section 4.9: ReportingAggregate | -- | ReportingService | BAL-001, MONTH-001, SYNCED-001, EXPORT-001 |
| Section 4.10: AuditAggregate | CRT-014 | AuditService | AUD-001, OLDNEW-002, ACCESS-033, RETENTION-031 |
| Section 4.11: LifecycleAggregate | -- | LifecycleService | LIF-001, LIF-003, LIF-005, LIF-006 |
| Section 4.12: ConfigurationAggregate | CRT-005 | ConfigurationService | CFG-001, CFG-002, CFG-003, CFG-004 |
| Section 4.13: OfflineSyncAggregate | CRT-012, CRT-009 | OfflineSyncService | SYNC-001, SYNC-002, SYNC-003, SYNC-004 |
| Section 5: Health Check Metrics | CRT-007 | -- | -- |
| Section 6: Alert Thresholds Reference | -- | -- | Tous les invariants constitutionnels |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | ops-specifier v1.0 | Création — Modèle de métriques abstrait pour Lumina v1 | COMPLIANT (trace vérifié contre RTS-001, ASS-001, DOC-015) |

---

*Ce document définit le modèle de métriques abstrait pour l'architecture Lumina v1. Il ne prescrit AUCUN outil concret (pas de Prometheus, Grafana, Datadog, InfluxDB, TimescaleDB, etc.). L'implémentation technique des métriques (stockage, agrégation, visualisation) est déterminée par l'adapter de LoggingPort/DiagnosticsPort choisi lors de la Phase 104 (ASSEMBLAGE ADAPTATORS, RTS-002).*
