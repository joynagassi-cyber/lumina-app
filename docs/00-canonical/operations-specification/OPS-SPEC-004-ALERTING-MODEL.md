# Alerting Model — Lumina v1

**Doc ID:** OPS-SPEC-004
**Version:** v1.0
**Statut:** SPÉCIFICATION OPS DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-001", "ASS-001", "DOC-015"]
**Transformation_rule :** "ops-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit le modèle d'alertage abstrait pour l'ensemble de l'architecture Lumina v1. Il couvre les catégories d'alerte, les niveaux de sévérité, la matrice des règles, la suppression, l'escalade et le processus post-incident -- sans prescrire aucun outil concret (pas de PagerDuty, OpsGenie, Slack alerts, etc.). Les spécifications opérationnelles restent indépendantes de toute plateforme d'implémentation.

**Lien avec OPS-SPEC-002** : Ce document définit COMMENT alerter sur les métriques définies dans OPS-SPEC-002. Chaque règle d'alerte référence explicitement une métrique OPS-SPEC-002.

**Lien avec OPS-SPEC-001** : Les alertes sont déclenchées par des logs de niveau ERROR ou CRITICAL ainsi que par des seuils de métriques. Chaque alerte génère un entry de log de catégorie appropriée (OPS-SPEC-001 Section 3).

**Lien avec OPS-SPEC-006** : Les sévérités d'alerte (P0-P4) mappent directement aux définitions d'incidents dans OPS-SPEC-006. L'alerte détecte, l'incident response gère la réponse.

---

## SECTION 1 : CATÉGORIES D'ALERTE

Quatre catégories d'alerte couvrent l'ensemble du spectre de surveillance de l'application Lumina.

### Catégorie 1 : Infrastructure (Ressources Système)

Alertes liées aux ressources système sous-jacentes et à la disponibilité des composants infrastructurels. Elles sont produites principalement par CRT-007 (HealthMonitor), CRT-008 (Diagnostics), et les métriques globales `system.*` d'OPS-SPEC-002 Section 3.2.

**Sous-catégories** :
- **Resources** : CPU, mémoire, disque, réseau
- **Connectivity** : base de données, cache, file de messages, stockage fichier
- **Pool Management** : connexions, threads, files d'attente
- **Process Health** : cycle de vie, démarrage/arret, signal OS

**Exemple de sources OPS-SPEC-002** :
- `system.cpu.utilization_percent`
- `system.memory.used_bytes`, `available_bytes`, `gc_pause_ms`
- `system.connection_pool.active`, `max`, `idle`
- `health.port.{port_name}.status`
- `health.overall.composition_status`

### Catégorie 2 : Application (Disponibilité et Performance)

Alertes liées au fonctionnement de l'application elle-même : disponibilité des services, taux d'erreur, performance des requêtes. Produites par l'agrégation des métriques de tous les Runtime Components et Application Services.

**Sous-catégories** :
- **Availability** : Services non accessibles, timeout de démarrage
- **Error Rates** : Taux d'erreurs anormalement élevé
- **Performance** : Latence dégradée, throughput diminué
- **Throughput** : Volume de requêtes anormal (trop bas ou trop haut)

**Exemple de sources OPS-SPEC-002** :
- `system.http.requests_total` par status_code
- `system.http.responses_duration_seconds` par percentiles
- `system.error.count_total` par category
- `runtime.lifecycle.state` (si != running pendant durée excessive)
- `runtime.startup.pipeline_completed_steps` (< 11 = incomplete startup)

### Catégorie 3 : Métier (Transactions et Synchronisation)

Alertes liées à l'intégrité et au bon fonctionnement des opérations métier : transactions, workflow, synchronisation offline, état des données. Produites par les métriques business.* d'OPS-SPEC-002 Section 4.

**Sous-catégories** :
- **Transaction Health** : blocage d'approbation, compensation excessive, anomalies financières
- **Workflow Integrity** : workflows bloqués, étapes expirées, chaînes cassées
- **Sync Health** : backlog de synchronisation croissant, conflits non résolus
- **Data Quality** : invariants métier violés, données inconsistentes

**Exemple de sources OPS-SPEC-002** :
- `business.resource.transactions.approved_total` vs `rejected_total`
- `business.workflow.active_instances` (gauge growing = stuck workflows)
- `business.sync.operations_pending_push_count` (growing = sync lag)
- `business.form.client_server_validation_mismatches_total` (DUAL-008 violation)

### Catégorie 4 : Sécurité (Accès Non Autorisé)

Alertes liées aux violations de sécurité : tentatives d'accès non autorisées, tentatives de contournement multi-tenant, fuites de données diagnostiques. Produites par les métriques de sécurité de CRT-015, CRT-013, et CRT-008.

**Sous-catégories** :
- **Authentication** : Tentatives massives d'échec, tokens expirés, sessions compromises
- **Authorization** : Tentatives d'accès cross-tenant, permission escalations
- **Data Exposure** : Données sensibles dans diagnostics/logs (BR-ID-001 violation)
- **Idempotency Abuse** : Replay massif détecté

**Exemple de sources OPS-SPEC-002** :
- `business.identity.auth.login_failure_rate`
- `runtime.tenant.org_isolation_violations_total`
- `runtime.diagnostics.sensitive_data_filters_triggered_total`
- `runtime.idempotency.replay_requests_total`

---

## SECTION 2 : NIVEAUX DE SÉVÉRITÉ

Cinq niveaux de sévérité sont définis. Chacun a des SLA de réponse, des canaux de notification, et des politiques d'escalade spécifiques.

### P0 -- Critical

| Champ | Valeur |
|-------|--------|
| Définition | Système down, risque de perte de données, faille de sécurité active |
| Impact | Fonctionnalité principale non disponible OU intégrité des données compromise |
| Temps de réponse (MTTR target) | < 1 heure |
| Canal de notification | IMMÉDIAT -- push vers on-call + manager |
| Escalade automatique | Si pas acknowledged en 5 min → notify manager |
| Post-incident | After-action review OBLIGATOIRE (OPS-SPEC-006) |
| Exemples | Base de données inaccessible, corruption de données détectée, breach INV-004 (multi-tenant), AuditEnabler OLDNEW-002 incomplet, Saga compensation failure |

**Règle absolue P0** : Toute alerte P0 doit avoir un incident ouvert dans le registre d'incidents (OPS-SPEC-006 Section 8) ET une after-action review planifiée sous 48 heures.

### P1 -- High

| Champ | Valeur |
|-------|--------|
| Définition | Service dégradé, performance critique dégradée |
| Impact | Fonctionnalité disponible mais significativement réduite OU latence extrêmement élevée |
| Temps de réponse (MTTR target) | < 4 heures |
| Canal de notification | Push vers on-call + channel d'équipe |
| Escalade automatique | Si pas acknowledged en 15 min → notify team lead |
| Post-incident | After-action review RECOMMANDÉE si impact métier significatif |
| Exemples | p99 latency > 2s pendant > 5 minutes, error rate > 5%, health check failures pour 2+ ports critiques, sync backlog > threshold critique |

### P2 -- Medium

| Champ | Valeur |
|-------|--------|
| Définition | Seuil d'avertissement franchi, impact fonctionnalité non-critique |
| Impact | Fonctionnalité affectée partiellement, utilisateurs impactés de manière limitée |
| Temps de réponse (MTTR target) | < 8 heures |
| Canal de notification | Channel d'équipe (asynchrone, pas push intrusif) |
| Escalade automatique | Si pas acknowledged en 1 heure → notify team lead |
| Post-incident | After-action review optionnelle, basée sur impact |
| Exemples | p99 latency > 500ms pendant > 10 minutes, connection pool > 80% capacity, sync pending queue growing, handler failures isolés |

### P3 -- Low

| Champ | Valeur |
|-------|--------|
| Définition | Avertissement informationnel |
| Impact | Aucun impact utilisateur direct, tendance préoccupante |
| Temps de réponse (MTTR target) | < 24 heures |
| Canal de notification | Channel d'équipe (fil d'information) |
| Escalade automatique | Si pas addressé en 24h → notify team lead |
| Post-incident | Pas requis (sauf pattern récurrent) |
| Exemples | Retry count légèrement élevé, idempotency hit rate > 20%, slow reports generation, queue size dans zone jaune |

### P4 -- Info

| Champ | Valeur |
|-------|--------|
| Définition | Monitoring uniquement, aucune action requise |
| Impact | Information pure, jamais une alerte active |
| Temps de réponse | Aucune (notifié mais pas actionné) |
| Canal de notification | Dashboard uniquement (pas de push, pas de channel) |
| Escalade | Jamais |
| Exemples | Health checks passing, normal operation metrics within bounds, routine job completions |

### Tableau Récapitulatif

| Severity | System Down | Data Loss Risk | Security Breach | Response Time | Notification | Escalation | Post-Incident |
|----------|-------------|---------------|-----------------|---------------|--------------|------------|---------------|
| P0 | Possible | YES | Possible | < 1 hour | Push + Manager | 5 min | OBLIGATOIRE |
| P1 | Partial | No | No | < 4 hours | Push + Team | 15 min | RECOMMANDÉE |
| P2 | No | No | No | < 8 hours | Team channel | 1 heure | Optionnelle |
| P3 | No | No | No | < 24 heures | Team info | 24 heures | Pattern only |
| P4 | No | No | No | N/A | Dashboard | Jamais | Jamais |

---

## SECTION 3 : MATRICE DES RÈGLES D'ALERTE

Tableau complet de toutes les règles d'alerte, mappeant chaque métrique OPS-SPEC-002 à sa condition d'alerte.

### 3.1 Règles Infrastructure

| # | Rule Name | Source Metric (OPS-SPEC-002) | Condition | Severity | Channel | Escalation | Exemple Template |
|---|-----------|-----------------------------|-----------|----------|---------|------------|-----------------|
| INF-001 | CPU Saturation | `system.cpu.utilization_percent` | > 90%持续 5 min | P1 | Push + Team | 15 min → lead | `IF cpu > 90% FOR 5m THEN P1` |
| INF-002 | Memory Pressure | `system.memory.used_bytes / total` | > 85%持续 10 min | P2 | Team channel | 1h → lead | `IF memory_used/total > 0.85 FOR 10m THEN P2` |
| INF-003 | GC Pause Degraded | `system.memory.gc_pause_ms{quantile="0.99"}` | > 2000ms持续 3 min | P2 | Team channel | 1h → lead | `IF gc_p99 > 2000ms FOR 3m THEN P2` |
| INF-004 | Connection Pool Exhaustion | `system.connection_pool.active / max` | > 80%持续 5 min | P2 | Team channel | 1h → lead | `IF pool_active/max > 0.80 FOR 5m THEN P2` |
| INF-005 | Connection Pool Critical | `system.connection_pool.active / max` | > 95%持续 2 min | P1 | Push + Team | 15 min → lead | `IF pool_active/max > 0.95 FOR 2m THEN P1` |
| INF-006 | Single Port Unhealthy | `health.port.{port_name}.status` | == 0 for 3 consecutive polls | P2 | Team channel | 1h → lead | `IF health_port_status == 0 FOR 3 cycles THEN P2` |
| INF-007 | Multiple Ports Unhealthy | `health.ports_unhealthy_count` | >= 2 | P2 | Team channel | 1h → lead | `IF unhealthy_ports >= 2 THEN P2` |
| INF-008 | Core Ports Down | `health.port.{core_port}.status` | == 0 where core_port in [RepoPort, ClockPort] | P0 | Push + Manager | 5 min → manager | `IF (RepoPort==0 OR ClockPort==0) THEN P0` |
| INF-009 | Overall Composition Critical | `health.overall.composition_status` | == 2 (critical) | P0 | Push + Manager | 5 min → manager | `IF composition_status == 2 THEN P0` |
| INF-010 | Startup Failure | `runtime.lifecycle.startup_failures_total` | Incrementing (any increase after initial boot) | P0 | Push + Manager | 5 min → manager | `IF startup_failures INCREASING THEN P0` |
| INF-011 | Forced Shutdown | `runtime.lifecycle.shutdown_forces_total` | Any increment | P1 | Push + Team | 15 min → lead | `IF shutdown_forced THEN P1` |
| INF-012 | Scheduler Job Failure Rate | `runtime.scheduler.jobs_failed_total` | > 10% of jobs_executed in 1h window | P2 | Team channel | 1h → lead | `IF failed/executed > 0.10 FOR 1h THEN P2` |

### 3.2 Règles Application

| # | Rule Name | Source Metric (OPS-SPEC-002) | Condition | Severity | Channel | Escalation | Exemple Template |
|---|-----------|-----------------------------|-----------|----------|---------|------------|-----------------|
| APP-001 | HTTP p99 Latency Elevated | `system.http.responses_duration_seconds{quantile="0.99"}` | > 500ms持续 5 min | P2 | Team channel | 1h → lead | `IF http_p99 > 500ms FOR 5m THEN P2` |
| APP-002 | HTTP p99 Latency Critical | `system.http.responses_duration_seconds{quantile="0.99"}` | > 2000ms持续 3 min | P1 | Push + Team | 15 min → lead | `IF http_p99 > 2000ms FOR 3m THEN P1` |
| APP-003 | Error Rate Elevated | `system.error.count_total / requests_total` | > 1%持续 5 min | P2 | Team channel | 1h → lead | `IF error_rate > 0.01 FOR 5m THEN P2` |
| APP-004 | Error Rate Critical | `system.error.count_total / requests_total` | > 5%持续 3 min | P1 | Push + Team | 15 min → lead | `IF error_rate > 0.05 FOR 3m THEN P1` |
| APP-005 | HTTP 5xx Rate | `system.http.requests_total{status_code>=500} / total` | > 0.5%持续 2 min | P1 | Push + Team | 15 min → lead | `IF 5xx_rate > 0.005 FOR 2m THEN P1` |
| APP-006 | Request Timeout Spike | `system.error.category.timeout` | > 5 timeouts in 1 min | P2 | Team channel | 1h → lead | `IF timeout_count > 5 FOR 1m THEN P2` |
| APP-007 | In-Flight Request Backlog | `system.http.in_flight` | > configured_max * 0.9持续 5 min | P2 | Team channel | 1h → lead | `IF in_flight > max*0.9 FOR 5m THEN P2` |
| APP-008 | Retry Exhaustion Storm | `runtime.retry.exhausted_total` | > 20 in 5 min window | P1 | Push + Team | 15 min → lead | `IF retry_exhausted > 20 FOR 5m THEN P1` |
| APP-009 | Event Dispatcher DLQ Growth | `runtime.events.dlq_placed_total` | > 0 in 1 min AND increasing | P1 | Push + Team | 15 min → lead | `IF dlq_placed > 0 AND INCREASING THEN P1` |
| APP-010 | Idempotency Replay Storm | `runtime.idempotency.hits_total / (hits + misses)` | > 30%持续 10 min | P3 | Team info | 24h → lead | `IF replay_ratio > 0.30 FOR 10m THEN P3` |

### 3.3 Règles Métier

| # | Rule Name | Source Metric (OPS-SPEC-002) | Condition | Severity | Channel | Escalation | Exemple Template |
|---|-----------|-----------------------------|-----------|----------|---------|------------|-----------------|
| BIS-001 | Sync Pending Queue Growing | `business.sync.operations_pending_push_count` | Increasing for > 15 min | P2 | Team channel | 1h → lead | `IF sync_pending INCREASING FOR 15m THEN P2` |
| BIS-002 | Sync Queue Critical | `business.sync.operations_pending_push_count` | > threshold config + not decreasing for 30 min | P1 | Push + Team | 15 min → lead | `IF sync_pending > threshold FOR 30m THEN P1` |
| BIS-003 | Offline Connectivity Lost | `business.sync.connectivity.status` | == 0持续 > 30 min (for mobile/offline orgs) | P2 | Team channel | 1h → lead | `IF connectivity == 0 FOR 30m THEN P2` |
| BIS-004 | Conflict Resolution Backlog | `business.sync.conflicts_detected_total - resolved_total` | Gap growing > 10 in 1h | P2 | Team channel | 1h → lead | `IF conflict_gap > 10 FOR 1h THEN P2` |
| BIS-005 | Transaction Approval Backlog | `business.resource.transactions.in_approval_total` | > threshold持续 2h | P2 | Team channel | 1h → lead | `IF approval_backlog > threshold FOR 2h THEN P2` |
| BIS-006 | Workflow Stuck Instances | `business.workflow.active_instances` | Constant (not decreasing) for > 4h with high count | P2 | Team channel | 1h → lead | `IF active_workflow CONSTANT FOR 4h THEN P2` |
| BIS-007 | Workflow Timeout Spike | `business.workflow.steps.expired_timeout_total` | > 10 in 1h window | P2 | Team channel | 1h → lead | `IF step_timeout > 10 FOR 1h THEN P2` |
| BIS-008 | Balance Calculation Errors | `business.reporting.balance_calculation_errors_total` | Any increment | P1 | Push + Team | 15 min → lead | `IF balance_errors > 0 THEN P1` |
| BIS-009 | Report Generation Slow | `business.reporting.computation_duration_seconds{p99}` | > 30s持续 5 reports | P3 | Team info | 24h → lead | `IF report_p99 > 30s FOR 5 reports THEN P3` |
| BIS-010 | Purge Schedule Lag | `business.lifecycle.purge_schedule_compliance` | < 100%持续 24h | P2 | Team channel | 1h → lead | `IF purge_compliance < 1.0 FOR 24h THEN P2` |
| BIS-011 | Notification Delivery Failure | `business.notification.delivery.success_rate` | < 0.95持续 30 min | P2 | Team channel | 1h → lead | `IF delivery_success < 0.95 FOR 30m THEN P2` |
| BIS-012 | Vocabulary Deprecation Rate | `business.vocabulary.term_values_deprecated_total` | > 20 in 1 day (spike) | P3 | Team info | 24h → lead | `IF deprecated_spike > 20/day THEN P3` |

### 3.4 Règles Sécurité

| # | Rule Name | Source Metric (OPS-SPEC-002) | Condition | Severity | Channel | Escalation | Exemple Template |
|---|-----------|-----------------------------|-----------|----------|---------|------------|-----------------|
| SEC-001 | Login Failure Burst | `business.identity.auth.login_failure_rate` | > 30% in 5 min window | P2 | Team channel + Security | 1h → lead | `IF login_failure_rate > 0.30 FOR 5m THEN P2` |
| SEC-002 | Login Failure Critical | `business.identity.auth.login_failure_rate` | > 60% in 5 min window | P1 | Push + Security | 15 min → lead | `IF login_failure_rate > 0.60 FOR 5m THEN P1` |
| SEC-003 | Multi-Tenant Isolation Violation | `runtime.tenant.org_isolation_violations_total` | Any increment (> 0) | P0 | Push + Manager + Security | 5 min → manager | `IF org_isolation_violation > 0 THEN P0` |
| SEC-004 | Explicit Tenant Override Attempt | `runtime.tenant.explicit_overrides_total` | Any increment (> 0) | P0 | Push + Manager + Security | 5 min → manager | `IF explicit_override > 0 THEN P0` |
| SEC-005 | Diagnostic Data Sensitivity Breach | `runtime.diagnostics.sensitive_data_filters_triggered_total` | Filter triggering detected (data that should be filtered still present in output) | P0 | Push + Manager + Security | 5 min → manager | `IF sensitive_data_exposure DETECTED THEN P0` |
| SEC-006 | Audit Completeness Violation | `business.audit.oldnew_completeness_rate` | < 100% | P0 | Push + Manager + Security | 5 min → manager | `IF oldnew_completeness < 1.0 THEN P0` |
| SEC-007 | Dispatch Order Violation | `runtime.events.dispatch_order_violations_total` | Any increment (> 0) | P0 | Push + Manager | 5 min → manager | `IF dispatch_order_violation > 0 THEN P0` |
| SEC-008 | Client/Server Validation Mismatch | `business.form.client_server_validation_mismatches_total` | Any increment (> 0) | P1 | Push + Team | 15 min → lead | `IF validation_mismatch > 0 THEN P1` |
| SEC-009 | Cycle Detection Failure | `business.relationship.cycle_detection_failures_total` | Any increment (> 0) | P0 | Push + Manager | 5 min → manager | `IF cycle_detection_failure > 0 THEN P0` |
| SEC-010 | Access Denied Surge | `business.audit.access_denied_total` | > 50 in 10 min window | P2 | Team channel + Security | 1h → lead | `IF access_denied > 50 FOR 10m THEN P2` |

### 3.5 Règles Constitutionnelles (Invariant-Direct)

Ces règles détectent directement la violation d'invariants constitutionnels de DOC-015.

| # | Rule Name | Invariant Source | Condition | Severity | Channel |
|---|-----------|-----------------|-----------|----------|---------|
| CONST-001 | Domain Error Retried | BR-SYNC-003 / OR-005 RTS-003 | Domain invariant error subjected to retry | P0 | Push + Manager |
| CONST-002 | Linear Backoff Used | BR-SYNC-003 | Backoff not exponential | P1 | Push + Team |
| CONST-003 | Max Retries Exceeded (5+) | BR-SYNC-003 | Retry count > 5 | P1 | Push + Team |
| CONST-004 | Audit Blocks Domain Op | AUD-001 constitutionnel | Audit port unavailability blocking domain operation | P0 | Push + Manager |
| CONST-005 | Self-Audit Performed | NB-PERSIST-007 constitutionnel | AuditAggregate audited itself | P1 | Push + Team |
| CONST-006 | Non-Graceful Shutdown | CRT-006 constitutionnel | Application killed without shutdown pipeline | P1 | Push + Team |
| CONST-007 | Hardcoded Config Value | CRT-005 constitutionnel | Configuration value hardcoded bypassing ConfigurationPort | P2 | Team channel |
| CONST-008 | Health Check Mutates State | CRT-007 constitutionnel | Read-only health check performing writes | P1 | Push + Team |
| CONST-009 | Diag Modifies App State | CRT-008 constitutionnel | Diagnostic endpoint modifies application state | P1 | Push + Team |

---

## SECTION 4 : SUPPRESSION D'ALERTE

### 4.1 Dé-duplication

Si la même règle d'alerte se déclenche plusieurs fois avec les mêmes dimensions (même metric, même condition, same context tags) dans une fenêtre de 15 minutes, seule la première alerte est active. Les suivantes sont consolidées en un compteur de répétitions.

**Mécanisme** :
- Clé de déduplication = `{rule_name, metric_name, dimensions_hash}`.
- Si nouvelle alerte matching clé existe dans les 15 dernières minutes → merge, incrémenter `repeat_count`.
- L'alerte originale reste ; le `repeat_count` est mis à jour.
- Après 15 min sans nouvelle occurrence → nouvelle alerte独立 créée.

### 4.2 Fenêtres de Maintenance

Les fenêtres de maintenance permettent de désactiver temporairement des alertes spécifiques pour des opérations planifiées (déploiement, maintenance base de données, migration).

**Règles** :
- MAINT-001 : Toute fenêtre de maintenance doit être approuvée par un admin et logged (date début, date fin, reason, approbateur).
- MAINT-002 : Les alertes P0 (sécurité, data loss risk, constitutional violations) NE PEUVENT JAMAIS être supprimées durant une maintenance.
- MAINT-003 : Les fenêtres de maintenance maximal duration = 4 heures. Au-delà, extension requiert approbation supplémentaire.
- MAINT-004 : À l'expiration d'une fenêtre, toutes les alertes supprimées sont réactivées automatiquement.

**Exemple** : Déploiement planifié à 2h00 UTC. Fenêtre 01:45 - 02:45 UTC. Suppress APP-005 (HTTP 5xx spike), APP-003 (Error rate elevated). INF-006 (port unhealthy) est allowed car c'est un health check attendu pendant déploiement.

### 4.3 Filtrage de Burst

Pour éviter l'alerte fatigue, les alertes doivent passer un test de burst filtering avant d'être notifiées :

| Métrique | Burst Filtering Rule |
|----------|---------------------|
| Error rate | spike must persist > 2 minutes before alert fires |
| Connection pool | must exceed threshold for 3 consecutive measurements |
| Sync pending | must be monotonically increasing for 5 consecutive measurements |
| Login failure rate | burst must contain > 10 failures in 1 minute to trigger SEC-001 |
| HTTP latency p99 | moving average over 5 data points required |

---

## SECTION 5 : POLITIQUE D'ESCALADE

### 5.1 Politique Standard d'Escalade

Si une alerte n'est pas reconnue (acknowledged) dans le délai SLA défini par son niveau de sévérité, elle est automatiquement escaladée.

| Severity | SLA Acknowledgment | 1ère Escalade | 2ème Escalade |
|----------|--------------------|---------------|---------------|
| P0 | 5 minutes | Notify manager (automatique) | Notify leadership |
| P1 | 15 minutes | Notify team lead | Notify manager |
| P2 | 1 heure | Notify team lead | Notify manager |
| P3 | 24 heures | Notify team lead | Notify manager |
| P4 | N/A | N/A | N/A |

### 5.2 Escalade Temporelle

L'escalade est basée sur le temps NON-passé depuis la reconnaissance :

```
T+0:    Alert created
T+SLA:  Not acknowledged → escalate level 1
T+2*SLA: Still not acknowledged → escalate level 2
T+4*SLA: Still not acknowledged → escalate level 3 (management)
```

Chaque étape d'escalade utilise le même canal de notification que l'étape précédente (push + channel), mais avec le destinataire supplémentaire.

### 5.3 Auto-Closure

Une alerte P3 ou P4 qui n'est pas acknowledged après 4x son SLA est automatiquement fermée comme "Auto-Closed -- No Action Taken". Une alerte P0-P1 ne peut JAMAIS être auto-fermée -- elle nécessite une closure manuelle avec justification.

### 5.4 Escalade de Contenant (Alert Chain)

Une alerte P0 déclenche implicitement une surveillance renforcée pour TOUTES les alertes P2-P3 liées au même composant pendant 1 heure après la résolution du P0. Cela détecte les effets en cascade.

---

## SECTION 6 : PROCESSUS POST-INCIDENT

### 6.1 Obligation d'After-Action Review

Toute alerte P0 et P1 DOIT avoir une after-action review (AAR) complétée sous 48 heures depuis la résolution de l'incident.

**AAR doit inclure** :
1. **Timeline** : Chronologie précise de chaque événement (détection → acknowledgment → containment → resolution → verification)
2. **Root Cause** : Cause racine identifiée (5 Whys ou méthode équivalente)
3. **Impact Assessment** : Nombre d'utilisateurs affectés, durée d'impact, données compromises (le cas échéant)
4. **Response Effectiveness** : Temps de détection, temps de réponse, temps de résolution vs targets MTTR
5. **Lessons Learned** : 3-5 leçons tirées
6. **Action Items** : Actions correctives assignées avec owner et deadline

### 6.2 Template AAR Standardisé

Voir OPS-SPEC-006 Section 7 pour le template détaillé.

### 6.3 Trend Analysis

Les AAR sont analysées trimestriellement pour identifier :
- Patterns récurrents (mêmes causes, mêmes composants)
- Composants les plus sujets aux incidents
- Évolution des MTTR over time
- Couverture des alertes (règles qui n'ont JAMAIS triggered = potentielles règles manquantes)

---

## SECTION 7 : EXEMPLES DE RÈGLES D'ALERTE COMPLÈTES

### Exemple 1 : Règle Infrastructure -- CPU Saturation

```markdown
Rule ID: INF-001
Name: CPU Saturation
Category: Infrastructure
Source Metric: system.cpu.utilization_percent
Threshold: > 90% sustained for 5 minutes
Severity: P1
Notification Channel: Push to on-call + team channel
Dedup Window: 15 minutes
Burst Filter: 3 consecutive readings above threshold
Escalation Path: 
  0m: On-call engineer
  15m: Team lead
  30m: Engineering manager
  60m: VP Engineering
Maintenance Window Compatible: YES
Related Incidents: May cascade from APP-002 (latency critical) or APP-008 (retry storm)
Post-Incident Required: YES (P1)
```

### Exemple 2 : Règle Sécurité -- Multi-Tenant Isolation

```markdown
Rule ID: SEC-003
Name: Multi-Tenant Isolation Violation
Category: Security
Source Metric: runtime.tenant.org_isolation_violations_total
Threshold: > 0 (any single violation)
Severity: P0
Notification Channel: Push to on-call + security team + management
Dedup Window: N/A (each violation is unique)
Burst Filter: NONE (immediate)
Escalation Path:
  0m: On-call engineer + security lead
  5m: Engineering manager + CISO equivalent
  15m: VP Engineering + legal/compliance
Maintenance Window Compatible: NO
Related Incidents: Data exposure, compliance breach
Post-Incident Required: YES (P0, mandatory)
```

### Exemple 3 : Règle Métier -- Sync Queue Critical

```markdown
Rule ID: BIS-002
Name: Sync Queue Critical
Category: Business
Source Metric: business.sync.operations_pending_push_count
Threshold: > configurable_threshold AND monotonic increase for 30 minutes
Severity: P1
Notification Channel: Push to on-call + team channel
Dedup Window: 15 minutes
Burst Filter: Monotonically increasing for 5 consecutive measurements
Escalation Path:
  0m: On-call engineer
  15m: Team lead
  30m: Engineering manager
Maintenance Window Compatible: YES (if deployment triggers expected sync load)
Related Incidents: May indicate server-side processing bottleneck or network partition
Post-Incident Required: YES (P1)
```

### Exemple 4 : Règle Constitutionnelle -- Audit Completeness

```markdown
Rule ID: SEC-006
Name: Audit Completeness Violation (OLDNEW-002)
Category: Security / Compliance
Source Metric: business.audit.oldnew_completeness_rate
Threshold: < 1.0 (any audit missing old OR new values)
Severity: P0
Notification Channel: Push to on-call + security + compliance
Dedup Window: N/A
Burst Filter: NONE
Escalation Path:
  0m: On-call + compliance officer
  5m: Engineering manager
  15m: Legal/compliance leadership
Maintenance Window Compatible: NO
Related Incidents: Regulatory compliance violation (RETENTION-031)
Post-Incident Required: YES (P0, mandatory)
Root Cause Investigation: Must trace back to CRT-014 AuditEnabler implementation
```

---

## SECTION 8 : CANAUX DE NOTIFICATION

### Types de Canaux (Abstraits)

| Type | Description | Utilisé Pour |
|------|-------------|-------------|
| Push immédiat | Notification intrusive (son + vibration + popup) | P0 uniquement |
| Push léger | Notification non-intrusive mais visible | P0, P1 |
| Channel équipe | Message asynchrone dans canal d'équipe | P1, P2 |
| Dashboard highlight | Mise en évidence visuelle sur le tableau de bord | P2, P3, P4 |
| Email résumé | Email quotidien résumant les alertes non résolues | P3, P4 |
| Logs only | Entry loggin seulement, pas de notification externe | P4 uniquement |

### Règles de Canal

- **P0** : Push immédiat + Channel équipe + Email résumé sous 1h
- **P1** : Push léger + Channel équipe
- **P2** : Channel équipe uniquement
- **P3** : Channel équipe (info) + Dashboard highlight
- **P4** : Dashboard highlight seul

---

## SECTION 9 : COMPLIANCE ET VALIDATION

### Règles non-négociables de conformité

1. **AP-001** : Toutes les règles d'alerte référencent explicitement une métrique OPS-SPEC-002. Vérifiable par recoupement Table Section 3 contre Sections 3-4 de OPS-SPEC-002.

2. **AP-002** : Aucun nom d'outil concret (PagerDuty, OpsGenie, Slack, etc.) n'apparaît dans ce document. Vérifiable par recherche textuelle.

3. **AP-003** : Les alertes P0 ont une escalade sous 5 minutes et une AAR obligatoire. Vérifiable par audit de politique.

4. **AP-004** : Les niveaux de sévérité mappent correctement aux MTTR targets d'OPS-SPEC-006. Vérifiable par comparaison Section 2 de ce document avec Section 6 de OPS-SPEC-006.

5. **AP-005** : Les alerts de sécurité (SEC-*) et constitutionnelles (CONST-*) sont toujours P0 ou P1 -- jamais inférieures. Vérifiable par inspection de la Section 3.

6. **AP-006** : La suppression d'alerte inclut dé-duplication, maintenance windows, et burst filtering (Sections 4.1-4.3).

7. **AP-007** : Les canaux de notification sont abstraits -- aucune plateforme spécifique n'est citée.

8. **AP-008** : L'échantillonnage déterministe de OPS-SPEC-003 Section 5 est cohérent avec les alertes P1 (toutes les traces d'erreur échantillonnées à 100%).

### Matrice de traçabilité OPS-SPEC-004

| Section du Document | Source OPS-SPEC-002 | Source OPS-SPEC-001 | Source OPS-SPEC-006 | Source DOC-015 |
|--------------------|--------------------|--------------------|--------------------|---------------|
| Section 1: Catégories | Toutes Sections 3-4 | Toutes Catégories | Section 6: Incident Types | Tous invariants |
| Section 2: Sévérité | MTTR mapping | Level correlation | Section 1: Severity defs | Constitutionnel rules |
| Section 3: Règles Matrix | 1:1 references | ERROR/CRITICAL correlation | P0/P1 → AAR link | CONST- rules |
| Section 4: Suppression | -- | -- | -- | -- |
| Section 5: Escalade | -- | -- | Section 4: Roles | -- |
| Section 6: Post-Incident | -- | -- | Section 7: AAR Template | RETENTION-031 |
| Section 7: Exemples | Full rule templates | Log format reference | MTTR enforcement | Invariant refs |
| Section 8: Canaux | Abstract channels | -- | -- | -- |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | ops-specifier v1.0 | Création — Modèle d'alertage abstrait pour Lumina v1 | COMPLIANT (trace vérifié contre RTS-001, ASS-001, DOC-015, OPS-SPEC-002, OPS-SPEC-006) |

---

*Ce document définit le modèle d'alertage abstrait pour l'architecture Lumina v1. Il ne prescrit AUCUN outil concret (pas de PagerDuty, OpsGenie, Slack alerts, email SMTP spécifique, etc.). L'implémentation technique des canaux de notification et de l'orchestration d'alertes est déterminée par l'adapter de DiagnosticsPort/DeliveryPort choisi lors de la Phase 104 (ASSEMBLAGE ADAPTATORS, RTS-002).*
