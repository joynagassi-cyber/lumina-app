# Incident Response Model — Lumina v1

**Doc ID:** OPS-SPEC-006
**Version:** v1.0
**Statut:** SPÉCIFICATION OPS DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-001", "ASS-001", "DOC-015"]
**Transformation_rule :** "ops-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit le modèle de réponse aux incidents abstrait pour l'ensemble de l'architecture Lumina v1. Il couvre les définitions de sévérité, les types d'incidents, le processus de réponse, les rôles de l'équipe, le protocole de communication, les cibles MTTR, le template post-incident et la gestion de l'historique -- sans prescrire aucun outil concret de gestion d'incidents. Les spécifications opérationnelles restent indépendantes de toute plateforme d'implémentation.

**Lien avec OPS-SPEC-004** : Ce document définit COMMENT répondre aux alertes générées par le modèle d'alerting (OPS-SPEC-004). Chaque P0/P1 alerte déclenche automatiquement un incident selon ce modèle.

**Lien avec OPS-SPEC-001/002/003** : L'incident response s'appuie sur les logs (OPS-SPEC-001), les métriques (OPS-SPEC-002) et les traces (OPS-SPEC-003) pour la détection, le triage et la investigation.

---

## SECTION 1 : DÉFINITIONS DE SÉVÉRITÉ D'INCIDENT

Les critères de sévérité d'un incident sont déterminés par quatre dimensions, chacune pondérée différemment selon le contexte.

### Dimensions d'Évaluation

| Dimension | Description | Échelle | Impact sur Sévérité |
|-----------|-------------|---------|-------------------|
| **Utilisateurs affectés** | Nombre ou pourcentage d'utilisateurs/organisations impactés par l'incident | 0% < 1% < 5% < 25% < 100% | Plus l'impact est large, plus la sévérité est élevée |
| **Risque intégrité données** | Possibilité de corruption, perte ou exposition de données | Aucune < Modéré < Élevé < Critique | Un risque critique automatically élève à P0 |
| **Impact revenu/opérationnel** | Impact sur les opérations métier (transactions bloquées, reports impossibles, etc.) | Aucun < Mineur < Significatif < Critique | Bloquer transactions financières = P0 minimum |
| **Implications sécurité** | Faille de sécurité active ou potentielle (brèche, contournement, exfiltration) | Aucune < Suspectée < Confirmée < Active | Sécurité active = P0 immediate |

### Définitions de Sévérité d'Incident

| Sévérité | Utilisateurs Affectés | Risque Intégrité Données | Impact Opérationnel | Implications Sécurité | Exemple Concret |
|----------|----------------------|------------------------|--------------------|--------------------|---------------|
| **P0** | > 25% ou tous | Critique (perte de données) | Blocage complet d'une fonctionnalité critique | Faille active ou suspicion confirmée | DB inaccessible, corruption détectée, breach INV-004 |
| **P1** | 5-25% | Élevé (données potentiellement corrompues) | Fonctionnalité dégradée significativement | Suspicion non-confirmée | Service down partiel, validation mismatch DUAL-008 |
| **P2** | 1-5% | Modéré (données non critiques affectées) | Fonctionnalité impacted partiellement | Aucune | Latence élevée, sync backlog, handler failures |
| **P3** | < 1% | Aucune | Impact mineur, contournable | Aucune | Retry storm isolé, slow job |
| **P4** | N/A (affecté uniquement l'infrastructure interne) | Aucune | Aucun impact utilisateur | Aucune | Info alert only, monitoring |

### Règles de Montée en Sévérité

- **SEC-INC-001** : Toute implication de sécurité transforme automatiquement l'incident en P0 minimum. La sécurité prime sur toutes les autres dimensions.
- **SEC-INC-002** : Si l'intégrité des données est compromise (même pour < 1% d'utilisateurs), l'incident est P0 minimum.
- **SEC-INC-003** : Un incident P3 qui évolue (plus d'utilisateurs affectés, risque données croissant) doit être immédiatement re-classifié P2, P1, voire P0.
- **SEC-INC-004** : La montée en sévérité est toujours possible ; la descente de sévérité requiert une approbation de l'Incident Commander.

---

## SECTION 2 : TYPES D'INCIDENTS

Six types d'incidents couvrent l'ensemble des scénarios opérationnels de Lumina.

### Type 1 : Service Outage (Indisponibilité)

Définition : Une ou plusieurs fonctionnalités de l'application ne sont plus accessibles ou répondent de manière incorrecte.

**Causes courantes** :
- Composant runtime crashing (CRT-001 assembly failure, CRT-006 lifecycle failure)
- Base de données inaccessibile (RepositoryPort adapter fail)
- Cache down (CachePort unavailable)
- Event bus indisponible (EventDispatcher CRT-004 unable to publish)
- Startup pipeline stuck (CRT-010)

**Signaux détectables** :
- `health.overall.composition_status != 1`
- `system.http.responses_duration_seconds{p99} == null` (no responses)
- `runtime.lifecycle.state != 2` (not running)
- HTTP 5xx rate > 10%

**Priorité** : Selon l'étendue (nombre d'utilisateurs touchés) et l'invariant affecté.

### Type 2 : Data Corruption (Corruption de Données)

Définition : Des données stockées ont été altérées de manière non-intentionnelle, soit par bug applicatif, soit par erreur infrastructurelle.

**Causes courantes** :
- Bug dans un Aggregate (validation incorrecte, invariant violé)
- Race condition dans la persistance (RepositoryPort adapter)
- Migration de schéma incorrecte
- Corruption au niveau stockage (hardware failure)

**Signaux détectables** :
- Invariant violation détecté (DOC-015)
- Checksum/mismatch sur les données persistées
- Balance calculation error (BAL-001)
- Old/new values incomplets dans l'audit (OLDNEW-002)

**Priorité** : TOUJOURS P0 minimum dès qu'une corruption est confirmée. Le risque d'intégrité des données est intrinsèquement critique.

### Type 3 : Security Breach (Intrusion de Sécurité)

Définition : Accès non autorisé aux données, contournement des mécanismes de sécurité, ou exposition de données sensibles.

**Causes courantes** :
- Violation INV-004 (multi-tenant isolation breached)
- Token forgery ou replay attack
- Diagnostic endpoint exposant des données sensibles (BR-ID-001 violation)
- Credential leak (password, token, API key dans les logs)

**Signaux détectables** :
- `runtime.tenant.org_isolation_violations_total > 0` (SEC-003, OPS-SPEC-004)
- `runtime.diagnostics.sensitive_data_filters_triggered_total` > threshold
- `business.identity.auth.login_failure_rate` > 60% (SEC-002 brute force signal)
- Authentication anomalies

**Priorité** : TOUJOURS P0. Toute suspicion de breach est traitée comme confirmée jusqu'à preuve du contraire.

### Type 4 : Performance Degradation (Dégradation de Performance)

Définition : L'application fonctionne mais avec des performances significativement dégradées par rapport aux baseline.

**Causes courantes** :
- Resource exhaustion (CPU, mémoire, connexions)
- Lock contention dans la base de données
- GC pressure excessive
- Network latency increase (inter-datacenter, CDN)
- Sync queue growing due to server-side bottleneck

**Signaux détectables** :
- `system.http.responses_duration_seconds{p99} > 500ms` sustained
- `system.connection_pool.active/max > 0.8`
- `system.cpu.utilization_percent > 90%`
- `system.memory.gc_pause_ms{p99} > 2000ms`
- `business.sync.operations_pending_push_count` growing

**Priorité** : P2 initial, monte à P1 si p99 > 2000ms sustained, ou si le taux d'erreur augmente.

### Type 5 : Capacity Exhaustion (Épuisement de Capacité)

Définition : Les ressources système (stockage, connexions, threads, rate limits) approchent ou atteignent leurs limites maximales.

**Causes courantes** :
- Stockage plein (disque de backup ou données)
- Pool de connexions saturé
- Rate limiter configur trop restrictif (notification channels)
- Taille du WAL dépassant la capacité de stockage
- Cache full (IdempotencyManager eviction rate increase)

**Signaux détectables** :
- `system.connection_pool.active/max > 0.95` (INF-005)
- `system.disk.usage_percent > 90%`
- `runtime.idempotency.evictions_total` spike
- WAL disk usage approaching storage limit

**Priorité** : P2 si approche (80-95%), P1 si > 95%, P0 si capacity reached et operations bloquant.

### Type 6 : Deployment Failure (Échec de Déploiement)

Définition : Un déploiement nouveau a introduit un regression, rendu l'application inopérante, ou cassé la compatibilité ascendante.

**Causes courantes** :
- Break change dans un Aggregate boundary
- Migration de schéma incompatible
- Configuration deployée incorrecte (CFG-004 mismatch)
- Adapter category misconfiguration

**Signaux détectables** :
- `runtime.lifecycle.startup_failures_total` incrementing
- `runtime.startup.validation_fail_count` > 0
- Error rate spike post-deployment
- New invariant violations detected
- Health check failures starting post-deployment

**Priorité** : P0 si deployment causes complete outage. P1 si regression partiel. P2 si regression mineur avec workaround.

---

## SECTION 3 : PROCESSUS DE RÉPONSE AUX INCIDENTS

Processus standard en six étapes couvrant le cycle de vie complet d'un incident.

### Étape 1 : Détection

L'incident est détecté par un des mécanismes suivants :

| Mécanisme | Source | Délai typique |
|-----------|--------|--------------|
| Alerting automatique (OPS-SPEC-004) | Règles OPS-SPEC-004 Section 3 | Secondes à minutes |
| Monitoring continu (CRT-007) | HealthMonitor health checks | Poll interval (configurable, default 30s) |
| Report utilisateur | Support ticket, feedback | Variable (minuten à heures) |
| Detection proactive | Diagnostics (CRT-008), team review | Variable |
| Log anomaly detection | OPS-SPEC-001 ERROR/CRITICAL patterns | Minutes |

**Action** : L'alerte crée automatiquement un brouillon d'incident dans le registre d'incidents. L'Incident Commander est assigné (rotation on-call par défaut).

### Étape 2 : Triage

L'Incident Commander évalue et classe l'incident :

```
1. Quel est le type d'incident ? (Section 2 de ce document)
2. Quelle est la sévérité estimée ? (Section 1 de ce document)
3. Quel(s) Aggregate(s) et Invariant(s) sont affectés ? (DOC-015)
4. Combien d'utilisateurs/organisations sont touchés ?
5. Y a-t-il un risque de propagation ?
6.Quelle est l'action immédiate requise ?
```

**Sorties du triage** :
- Sévérité finale (P0-P4)
- Incident Commander assigné (si pas déjà en place)
- Communications Lead assigné (si P0 ou P1)
- Technical Lead assigné (si P0 ou P1)

**Durée typique** : 0-15 minutes.

### Étape 3 : Contenainment

Actions immédiates pour empêcher l'aggravation de l'incident :

**Contenainment types selon le type d'incident** :

| Type | Contenainment Actions |
|------|---------------------|
| Service Outage | Basculer en read-only (LifecycleManager), activer circuit breaker, switch vers replica |
| Data Corruption | Mettre en pause les écritures concernées (Aggregate-specific write lock), isoler les données corrompues |
| Security Breach | Révoquer les sessions suspectes, invalider les tokens compromis, block IP/source, activer audit renforcé |
| Performance Degradation | Augmenter les timeouts, activer le fallback mode (reduced features), activer le caching aggressif |
| Capacity Exhaustion | Augmenter les pools temporairement, purger les données non-critiques, activer le throttling |
| Deployment Failure | Rollback immediate vers le dernier version stable, activer le feature flag de désactivation |

**Règle absolue** : Le contenainment priorise la stabilité du système over la continuité parfaite du service. Il vaut mieux avoir un service réduit qu'un service corrompu.

### Étape 4 : Éradication

Identification et résolution de la cause racine :

```
1. Analyser les logs (OPS-SPEC-001) de la période d'incident
2. Reconstituer la trace complète (OPS-SPEC-003) de l'opération défaillante
3. Identifier l'invariant violé (DOC-015)
4. Appliquer la correction (bug fix, config change, data repair)
5. Valider la correction via health checks (CRT-007)
```

**Validation post-eradication** :
- Tous les health checks passing (CRT-007, Section 5 de OPS-SPEC-002)
- Les métriques retour à la normale (pas de spike d'erreurs, latence acceptable)
- Aucun nouvel invariant violé pendant 30 minutes de monitoring intensif

### Étape 5 : Récupération

Rétablissement normal du service :

1. Retirer les measures de contenainment progressivement
2. Monitorer la récupération via métriques et health checks
3. Vérifier la cohérence des données restaurées (ops-synchrone)
4. Confirmer la stabilité avec les utilisateurs/parties prenantes
5. Clôturer l'incident formellement dans le registre

### Étape 6 : Post-Incident Review

L'after-action review (AAR) est obligatoire pour P0 et P1 (défini dans Section 7 de ce document). Optionnelle pour P2, basée sur l'impact.

**Délai** : AAR complétée sous 48 heures pour P0/P1.

---

## SECTION 4 : ROLES DE L'ÉQUIPE

Quatre roles sont définis pour la réponse aux incidents. Un minimum de deux personnes (Incident Commander + Technical Lead) est requis pour P0/P1.

### Role 1 : Incident Commander (IC)

**Responsabilité principale** : Coordonner la réponse à l'incident, prendre les décisions tactiques, gérer la communication inter-équipe.

**Attributions** :
- Assigner les roles (Tech Lead, Comm Lead, Observer)
- Déterminer et mettre à jour la sévérité de l'incident
- Decider les actions de contenainment (avec le Technical Lead)
- Prendre la décision de rollback/deploy
- Communiquer avec le Communications Lead sur le statut
- Activer/désactiver les canaux d'escalade (OPS-SPEC-004 Section 5)
- Prendre la décision de clôture de l'incident

**Qualités requises** : Calme sous pression, connaissance architecturale de Lumina, autorité decisionnelle.

**Rotation** : On-call rotation basé sur le planning d'équipe. Si IC on-call n'est pas disponible, second dans la rotation prend le relais.

**Règles IC** :
- IC-001 : L'Incident Commander a l'autorite finale sur TOUTES les decisions de réponse à l'incident (y compris contre l'avis technique si necessaire pour la stabilité).
- IC-002 : L'IC ne fait PAS de debugging technique -- il se concentre sur la coordination.
- IC-003 : L'IC met à jour le statut de l'incident toutes les 15 minutes minimum (P0), 30 minutes (P1), 60 minutes (P2).

### Role 2 : Communications Lead (CL)

**Responsabilité principale** : Gérer la communication externe et interne pendant l'incident.

**Attributions** :
- Informer les stakeholders internes (management, support, team)
- Préparer les notifications externes (clients, partenaires) si applicable
- Maintenir le channel d'incident ouvert et à jour
- Filtrer les informations sensibles (ne pas communiquer de détails techniques non-approuvés)
- Documenter les communications faites (qui, quand, quoi)

**Qualités requises** : Communication claire, discretion, capacité à traduire technique en business language.

**Assignation** : Automatically assigned when P0 or P1 incident is declared.

### Role 3 : Technical Lead (TL)

**Responsabilité principale** : Diagnostiquer et résoudre la cause technique de l'incident.

**Attributions** :
- Analyser les logs, métriques, et traces de l'incident
- Identifier la cause racine
- Proposer et implémenter la correction
- Valider la correction via tests et monitoring
- Documenter la solution technique pour l'AAR

**Qualités requises** : Profonde connaissance technique de l'architecture Lumina (RTS-001, ASS-001, DOC-015), expérience de debugging distribué.

**Assignation** : Assigné par l'Incident Commander. Peut être le premier responder (IC) s'il a les compétences techniques nécessaires, mais idéalement un role separé.

### Role 4 : Observer (OBS)

**Responsabilité principale** : Documenter chronologiquement l'incident pour l'AAR future.

**Attributions** :
- Tenir un journal temporel (timeline) de TOUTES les actions prises
- Logger les decisions importantes et leur justification
- Noter les timestamps précis (detection, triage, contenainment, resolution, closure)
- Capturer les snippets de conversation/clés de debug pertinents
- Surveiller la métriques en temps réel pour alerter l'IC sur les changements
- Documenter les tentatives infructueuses (pour éviter de les repeater)

**Qualités requises** : Attention aux details, organization, neutralité.

**Assignation** : Assigné automatiquement pour P0, recommandé pour P1, optionnel pour P2+.

### Matrice de Roles par Sévérité

| Sévérité | IC | CL | TL | OBS |
|----------|----|----|----|-----|
| P0 | Mandatory | Mandatory | Mandatory | Mandatory |
| P1 | Mandatory | Assigned | Assigned | Recommended |
| P2 | Assigned (may be兼任 TL) | Optional | Assigned | Optional |
| P3 | Assigned (may be兼任 TL) | Optional | Assigned | No |
| P4 | N/A (automated response) | No | No | No |

---

## SECTION 5 : PROTOCOLE DE COMMUNICATION

### Communication Interne

**Pendant un incident P0/P1** :
- Un channel d'incident dédié est ouvert (nommé `incident-{date}-{short_id}`).
- Tout le monde communique via ce channel (pas d'email, pas de conversation privée).
- L'Incident Commander fait des update reguliers (toutes les 15 min pour P0, 30 min pour P1).
- Les mises à jour suivent le format STRUCTURE :

```
Status: RESOLVING / INVESTIGATING / MITIGATING / DETECTED
Impact: [description de l'impact actuel]
Actions: [ce qui est en cours ou vient d'être fait]
Next update: [timestamp de la prochaine mise à jour]
```

### Communication Externe

**Policy de notification clients/partners** :

| Sévérité | Notification externe | Délai | Contenu |
|----------|---------------------|-------|---------|
| P0 | OBLIGATOIRE | < 30 minutes depuis detection | Impact, ETA resolution, workaround si applicable |
| P1 | RECOMMANDÉE | < 2 heures | Impact, ETA resolution |
| P2 | Optionnelle | > 24 heures (dans next status report) | Résumé de l'incident résolu |
| P3 | Jamais (sauf demande client) | -- | -- |
| P4 | Jamais | -- | -- |

**Principe de communication externe** : Toujours informer QUELS services sont affectés et POURQUOI (en termes génériques, sans exposer de détails techniques internes ou de vulnérabilités). NE JAMAIS promettre un délai de resolution spécifique.

### Escalade de Communication

En plus de l'escalade technique (OPS-SPEC-004 Section 5), l'escalade communication suit ce flux :

```
P0 Detected:
  → On-call IC notified (immediate push)
  → Team lead notified (within 5 min)
  → Engineering manager notified (within 15 min)
  → VP Engineering + Executive sponsor (within 30 min if unresolved)
  → Customer-facing notification sent (within 30 min per policy above)
```

---

## SECTION 6 : CIBLES MTTR (Mean Time To Recovery)

MTTR = temps entre la détection de l'incident et le début de recovery effectif (pas nécessairement la résolution complète, mais le moment où le sistem commence à revenir à la normale).

| Sévérité | Cible MTTR | Description |
|----------|-----------|-------------|
| **P0** | < 1 heure | Containment dans 15 min, remediation dans 45 min |
| **P1** | < 4 heures | Containment dans 30 min, remediation dans 3.5h |
| **P2** | < 8 heures | Resolution dans la journée ouvrable |
| **P3** | < 24 heures | Resolution sous 2 jours ouvrables |
| **P4** | Prochain jour ouvrable | Planifié, pas urgent |

### MTTR Tracking

Chaque incident doit avoir son MTTR tracké :

| Metric | Description |
|--------|-------------|
| `incident_mttr.minutes` | Temps entre detection et begin recovery |
| `incident_resolution.minutes` | Temps entre detection et resolution complete |
| `incident_mttr.target_met` | Boolean : MTTR target atteint ou non |
| `incident.severity_distribution` | Distribution des severites par periode |

**Règle** : Si le MTTR d'un incident dépasse sa cible, l'Incident Commander doit documenter la raison dans l'AAR. Des MTTR systématiquement dépassés indiquent un besoin d'investissement en infrastructure ou en formation.

---

## SECTION 7 : TEMPLATE POST-INCIDENT REVIEW (AAR)

Template standardisé pour after-action review, obligatoire pour P0 et P1.

```markdown
# After-Action Review — Incident {incident_id}

## 1. INFORMATION GENERALE

- **Date de l'incident**: YYYY-MM-DD HH:MM UTC
- **Severity**: P0 / P1 / P2
- **Type**: Outage / Corruption / Breach / Performance / Capacity / Deployment
- **Duration**: X heures X minutes (detection → resolution)
- **MTTR Target**: < X heures (per section 6)
- **MTTR Actual**: X heures X minutes
- **Target Met**: YES / NO (avec raison si NO)
- **Users Affected**: XX% (approximately)
- **Organizations Affected**: N (or all)

## 2. TEAM

- **Incident Commander**: [Name]
- **Communications Lead**: [Name]
- **Technical Lead**: [Name]
- **Observer**: [Name]

## 3. TIMELINE

| Time (UTC) | Event | Action Taken |
|-----------|-------|-------------|
| HH:MM | Incident detected (source: alert/monitor/user report) | ... |
| HH:MM | Severity assessed as P? | ... |
| HH:MM | IC assigned | ... |
| HH:MM | Containment initiated | ... |
| HH:MM | Containment effective | ... |
| HH:MM | Root cause identified | ... |
| HH:MM | Fix deployed/applied | ... |
| HH:MM | Recovery verified | ... |
| HH:MM | Incident resolved/closed | ... |

## 4. ROOT CAUSE ANALYSIS

- **What happened?** (Description objective, chronologique)
- **Why did it happen?** (Cause racine technique)
- **How was it not caught earlier?** (Gaps in monitoring/alerting)
- **What invariant was violated?** (DOC-015 invariant code if applicable)

## 5. IMPACT ASSESSMENT

- **Direct impact**: [what users/business processes were affected]
- **Data impact**: [was any data corrupted/lost/exposed]
- **Reputational impact**: [customer notifications sent, PR impact]
- **Financial impact**: [if measurable, estimate cost]

## 6. RESPONSE EFFECTIVENESS

| Metric | Target | Actual | Assessment |
|--------|--------|--------|------------|
| Detection time | < 5 min | X min | Good / Needs Improvement |
| Triage time | < 15 min | X min | Good / Needs Improvement |
| Containment time | < 30 min | X min | Good / Needs Improvement |
| Communication quality | Every 15 min (P0) | Every X min | Good / Needs Improvement |
| Role coverage | All assigned | All/no | Good / Needs Improvement |

## 7. LESSONS LEARNED

1. [Lesson 1]
2. [Lesson 2]
3. [Lesson 3]

## 8. ACTION ITEMS

| # | Action | Owner | Deadline | Status |
|---|--------|-------|----------|--------|
| 1 | [Specific action item] | [Name] | [Date] | Open / Done |
| 2 | ... | ... | ... | ... |

## 9. MONITORING/ALERTING UPDATES

- [New alert rule created? OPS-SPEC-004]
- [Existing alert rule tuned? OPS-SPEC-004]
- [Missing metric identified? OPS-SPEC-002]

## 10. DOCUMENT UPDATES

- [Architecture docs need updating? RTS-001, ASS-001]
- [Invariant needs reinforcement? DOC-015]
- [Runbook/process needs creating/updating]
```

---

## SECTION 8 : REGISTRE D'INCIDENTS ET ANALYSE DE TENDANCES

### Registre d'Incidents

Chaque incident (de P1 à P0) est enregistré dans le registre d'incidents avec :

| Champ | Description |
|-------|-------------|
| `incident_id` | UUID unique |
| `created_at` | Timestamp de création (détection) |
| `resolved_at` | Timestamp de résolution |
| `severity` | P0, P1, P2, P3 |
| `type` | Outage, Corruption, Breach, Performance, Capacity, Deployment |
| `status` | OPEN / CONTAINED / RESOLVING / RESOLVED / CLOSED |
| `ic_name` | Nom de l'Incident Commander |
| `affected_aggregates` | Liste des Aggregates touchés |
| `violated_invariants` | Liste des invariants DOC-015 violés (si applicable) |
| `mttr_minutes` | Temps de MTTR en minutes |
| `aar_completed` | Boolean : AAR complétée |
| `aar_url` | Référence vers le document AAR (si disponible) |

### Analyse de Tendance

Le registre d'incidents alimente l'analyse de tendance trimestrielle (définie dans OPS-SPEC-004 Section 6.3) :

| Métrique de Tendance | Description |
|---------------------|-------------|
| Incidents par trimestre | Total et par sévérité |
| MTTR moyen par sévérité | Évolution dans le temps |
| Top composants concernés | CRT-NNN les plus fréquemment touchés |
| Top invariants violés | DOC-015 les plus fragiles |
| Couverture d'alerte | Règles OPS-SPEC-004 jamais triggered vs règles souvent triggered |
| AAR completion rate | Pourcentage de P0/P1 avec AAR completee |
| Recurrence rate | Même cause racine repetee dans differentes incidents |

**Objectif** : Chaque trimestre, analyser les tendances pour identifier les investissements Prioritaires (infra à renforcer, invariants à durcir, alertes à créer).

---

## SECTION 9 : COMPLIANCE ET VALIDATION

### Règles non-négociables de conformité

1. **IP-001** : Tout incident P0 ou P1 active automatiquement les roles IC, CL, TL, et OBS (au minimum IC + TL). Vérifiable par process enforcement.

2. **IP-002** : Toute incident P0/P1 doit avoir une AAR complétée sous 48 heures. Vérifiable par tracking du champ `aar_completed` vs `created_at`.

3. **IP-003** : Le MTTR est calculé et comparé à la cible par sévérité (Section 6). Les écarts sont documentés dans l'AAR.

4. **IP-004** : La communication interne suit le format structuré (Section 5) avec mises à jour régulières. Vérifiable par audit du channel d'incident.

5. **IP-005** : Aucun outil concret de gestion d'incidents n'est prescrit par ce document (canaux abstraits uniquement). Vérifiable par recherche textuelle.

6. **IP-006** : Les incidents sont analysés trimestriellement pour les tendances. Vérifiable par rapport trimestriel existant.

7. **IP-007** : Les regles de contenment prioritisent la stabilité sur la disponibilité (Section 3, Règle absolue).

8. **IP-008** : L'escalade de sévérité est toujours possible ; la descente nécessite IC approval (Section 1, Règles de montée).

### Matrice de traçabilité OPS-SPEC-006

| Section du Document | Source OPS-SPEC-001 | Source OPS-SPEC-002 | Source OPS-SPEC-003 | Source OPS-SPEC-004 | Source DOC-015 |
|--------------------|--------------------|--------------------|--------------------|--------------------|---------------|
| Section 1: Severity | -- | Metrics correlation | -- | Severity mapping | Invariant impact |
| Section 2: Types | Log signals | Metric signals | -- | Alert rule signals | Invariant codes |
| Section 3: Process | Logs analysis | Metrics monitoring | Trace reconstruction | Alert triggering | Invariant validation |
| Section 4: Roles | Observer reads logs | Observer reads metrics | TL reads traces | IC follows escalation | ACL validates |
| Section 5: Comm | -- | -- | -- | Escalation alignment | -- |
| Section 6: MTTR | -- | Tracking metrics | -- | SLA correlation | -- |
| Section 7: AAR Template | Log references | Metric references | Trace references | Alert review | Invariant review |
| Section 8: Registry | -- | Trend metrics | -- | Rule effectiveness | Invariant trends |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | ops-specifier v1.0 | Création — Modèle de réponse aux incidents abstrait pour Lumina v1 | COMPLIANT (trace vérifié contre RTS-001, ASS-001, DOC-015, OPS-SPEC-004) |

---

*Ce document définit le modèle de réponse aux incidents abstrait pour l'architecture Lumina v1. Il ne prescrit AUCUN outil concret (pas de PagerDuty, OpsGenie, Jira Incident, etc.). L'implémentation technique de la gestion d'incidents (creation de tickets, assignment, tracking, reporting) est déterminée par l'outil de gestion opérationnel choisi lors de la Phase 104 (ASSEMBLAGE ADAPTATORS, RTS-002).*
