# Tracing Model — Lumina v1

**Doc ID:** OPS-SPEC-003
**Version:** v1.0
**Statut:** SPÉCIFICATION OPS DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-001", "ASS-001", "DOC-015"]
**Transformation_rule :** "ops-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit le modèle de traçage distribué (tracing) abstrait pour l'ensemble de l'architecture Lumina v1. Il couvre la définition des traces et spans, la propagation du contexte à travers les couches, la hiérarchie, les patterns cross-aggregate, la stratégie d'échantillonnage, les attributs standards et la rétention -- sans prescrire aucun outil concret (pas de Jaeger, Zipkin, OpenTelemetry Collector, etc.). Les spécifications opérationnelles restent indépendantes de toute plateforme d'implémentation.

**Lien avec OPS-SPEC-001** : La trace est corrélée au log via le `correlation_id`. Chaque span produit une entry de log avec le même `correlation_id`, permettant de joindre logs et traces. Voir OPS-SPEC-001 Section 2 (champ `correlation_id`) et Section 3 (event_type).

**Lien avec OPS-SPEC-002** : Chaque span peut être instrumenté pour produire des métriques de durée (`runtime.*.duration_seconds`) connectées aux timers/histograms définis dans OPS-SPEC-002 Section 2 Type 5 (Timer).

---

## SECTION 1 : DÉFINITION DU CONCEPT DE TRACE

### Trace vs Span

Dans l'architecture Lumina, une **Trace** représente le parcours complet d'une opération logique à travers toutes les couches de l'application, de l'entrée (API Layer) jusqu'à la persistance et la publication d'événements. Un **Span** représente une unité discrète de travail au sein de cette trace.

```
Trace = ensemble de tous les Spans liés à une opération logique unique
Span = une étape individuelle au sein de la Trace
```

Analogie architecturale :
- Une **Trace** est un fil conducteur (fil d'Ariane) qui relie toutes les étapes d'un processus métier.
- Un **Span** est chaque nœud sur ce fil : un appel API, une méthode Aggregate, une écriture en base, un événement publié.

### Caractéristiques Distinctives

| Propriété | Trace | Span |
|-----------|-------|------|
| Identifiant unique | `trace_id` (UUIDv7, généré une seule fois au début de la requête) | `span_id` (UUIDv7, généré par chaque composant produisant un span) |
| Portée | Couvre TOUTES les couches et composants impliqués | Couvre UN SEUL composant ou service |
| Durée | `end_time - start_time` de la première à la dernière span | `span.end_time - span.start_time` |
| Granularité | Opération logique complète (ex: "CreateTransaction") | Étape discrète (ex: "ResourceAggregate.CreateTransaction") |
| Parent | N/A (c'est le root) | Exactly one parent (sauf la root span qui n'a pas de parent) |

### Scope de la Trace

Une trace couvre TOUS les composants participant au traitement d'une opération logique, selon le flux suivant (défini par l'architecture RTS-001) :

```
Requête entrante → API Layer → Application Service → Aggregate Domain Method → Repository Port/Adapter → EventDispatcher → Event Handlers → Response
```

Chaque flèche ci-dessus peut produire un ou plusieurs spans. Le `trace_id` initial est généré au début du traitement de la requête et se propage à travers toutes les étapes.

---

## SECTION 2 : PROPAGATION DU CONTEXTE DE TRACE

### Flux de Propagation du correlation_id / trace_id

Le `correlation_id` (OPS-SPEC-001) est identique au `trace_id` (ce document). Il est généré au niveau de la couche API et propagé à travers chaque hop. Chaque hop étend la trace en ajoutant un nouveau span enfant.

#### Hop 1 : API Layer → Application Service

```
[Client Request]
    │
    ├── generate trace_id = UUIDv7(correlation_id)
    ├── generate span_id (API-layer span)
    │
    ▼
[API Layer Span]         ← Root span, trace_id = generated here
    │
    └── propagate trace_id + span_id via application context
              │
              ▼
[Application Service Span]   ← Child span, parent_span_id = API layer span_id
```

**Mécanisme** : Le `trace_id` est injecté dans le contexte applicatif au moment de l'appel de l'Application Service. L'Application Service lit le `trace_id` depuis son contexte et crée un span enfant avec un `span_id` dérivé.

**Couverture** : Tous les 13 Application Services d'ASS-001 reçoivent le `trace_id` via leur contexte d'exécution.

#### Hop 2 : Application Service → Aggregate Domain Method

```
[App Service Span]
    │
    ├── load Aggregate by identity
    ├── invoke domain method (CreateTransaction, ApproveStep, etc.)
    │
    ▼
[Aggregate Domain Span]  ← Child of App Service span
    │
    └── emit Domain Events (on state mutation)
```

**Mécanisme** : L'Application Service passe le `trace_id` et le `parent_span_id` (son propre span_id) à l'appel de la méthode domaine. Le spanAggregate a une durée allant du chargement de l'Aggregate jusqu'à la fin de la mutation/domain validation.

#### Hop 3 : Aggregate → Repository Port → Adapter

```
[Aggregate Span]
    │
    ├── validate invariants (DOC-015)
    ├── call repository port for persistence
    │
    ▼
[Repository Port Span]   ← Child of Aggregate span
    │
    └── adapt to concrete storage implementation
              │
              ▼
[Storage Adapter Span]   ← Leaf span, child of Repository Port span
```

**Mécanisme** : Le RepositoryPort crée un span qui englobe la durée de la persistance. L'adapter concret (Database, FileStorage, Cache -- per PAS-002 categories) crée un span enfant si sa durée est mesurable.

#### Hop 4 : Repository → EventDispatcher (CRT-004)

```
[Repository Span] (commit successful)
    │
    ├── TransactionCoordinator commits (CRT-003)
    │
    ▼
[EventPublication Span]  ← Child of the transaction scope
    │
    └── dispatch to subscribers
              │
              ▼
[EventHandler Spans]     ← Each handler gets a child span
```

**Mécanisme** : Après le commit transactionnel (CRT-003), l'EventDispatcher (CRT-004) publie les Domain Events. Chaque handler inscrit reçoit un span dédié. Ces spans sont frères (même parent), pas imbriqués -- CRT-001 constitutionnellement garantit l'isolation des handlers.

**Ordre garanti** : Les handlers s'exécutent séquentiellement (CRT-001 constitutionnel), donc leurs spans sont ordonnés chronologiquement dans la trace.

#### Hop 5 : Propagation Cross-Aggregate (ASS-004 Patterns)

Pour les opérations cross-aggregate, la propagation suit les patterns définis dans ASS-004 (Cross-Aggregate Coordination). Voir Section 4 de ce document.

### Règles de Propagation

| Règle | Description | Source |
|-------|-------------|--------|
| PROP-001 | `trace_id` est immuable après génération initiale | OPS-SPEC-001 §2 (correlation_id) |
| PROP-002 | Chaque hop doit créer au moins un span enfant | Ce document |
| PROP-003 | `parent_span_id` d'un spanenfant doit pointer vers le span du caller direct | Ce document |
| PROP-004 | Le `org_id` résolu par CRT-015 est propagé à TOUS les spans de la trace | CRT-015 INV-004 |
| PROP-005 | Le `user_id` est propagé à TOUS les spans de la trace | OPS-SPEC-001 §2 (user_id) |
| PROP-006 | Un span ne peut JAMAIS changer de `trace_id` durant son exécution | Ce document |
| PROP-007 | La propagation se fait par contexte applicatif, jamais par paramètre HTTP direct | CRT-015 constitutionnel |

---

## SECTION 3 : TEMPLATE DE HIÉRARCHIE DE SPAN

### Structure Standard d'un Span

Chaque span suit EXACTEMENT cette structure (abstraite, indépendante du format de sérialisation) :

```
{
  "trace_id":       "UUIDv7 identique à tous les spans de la même trace",
  "span_id":        "UUIDv7 unique pour ce span",
  "parent_span_id": "UUIDv7 du span parent (null pour la root span)",
  "operation_name": "Description courte de l'opération (ex: CreateTransaction)",
  "start_time":     "ISO8601 avec fuseau horaire",
  "end_time":       "ISO8601 avec fuseau horaire (jamais avant start_time)",
  "duration_ms":    "Entier positif = end_time - start_time en millisecondes",
  "service_name":   "Nom du composant producteur (CRT-NNN ou ASS-NNN)",
  "status":         "OK | ERROR | CANCELLED (unique valeur finale)",
  "tags": {
    "trace_id":       "UUIDv7 (copié pour facilité de requête sans join)",
    "span_id":        "UUIDv7 (copié pour facilité de requête)",
    "parent_span_id": "UUIDv7 (copié, null pour root)",
    "org_id":         "UUID de l'organisation (null si non applicable)",
    "user_id":        "UUID de l'utilisateur (null si opération automatique)",
    "component":      "CRT-NNN identifiant du Runtime Component",
    "aggregate":      "Nom de l'Aggregate concerné (si applicable)",
    "service":        "ASS-NNN nom du service applicatif (si applicable)",
    "error_code":     "Code d'erreur structuré si status=ERROR (facultatif)",
    "http_method":    "Méthode HTTP si span vient d'une requête API",
    "http_status":    "Code de réponse HTTP si applicable"
  },
  "events": [],     // Liste d'events attachés à ce span (voir §3.2)
  "logs": []        // Liste de log entries liées à ce span (lien avec OPS-SPEC-001)
}
```

### Hiérarchie Standard des Spans

La profondeur maximale d'une trace est limitée à 7 niveaux (racine + 6 niveaux enfants) :

```
Level 0: [Root Span]                       -- API Layer / Request Handler
    │
Level 1: [Application Service Span]       -- ASS-NNN service orchestration
    │
Level 2: [Aggregate Domain Span]          -- Domain method execution
    │   ├── Level 3: [Repository Span]     -- Persistence write/read
    │   │   └── Level 4: [Storage Adapter Span]  -- Concrete storage impl
    │   └── Level 3: [Domain Validation Span]  -- Invariant checks (DOC-015)
    │
Level 2: [Transaction Span]               -- CRT-003 scope (cross-aggregate only)
    │   ├── Level 3: [Aggregate Span A]   -- First aggregate in saga
    │   └── Level 3: [Aggregate Span B]   -- Second aggregate in saga
    │
Level 2: [Event Dispatcher Span]          -- CRT-004 event publication
    │   ├── Level 3: [Handler A Span]     -- First subscriber
    │   ├── Level 3: [Handler B Span]     -- Second subscriber
    │   └── Level 3: [Handler N Span]     -- Nth subscriber
    │
Level 2: [Scheduled Job Span]             -- CRT-009 scheduler task
    │
Level 1: [Background Operation Span]      -- System-initiated (non-request)
```

### Règles de Hiérarchie

| Règle | Description |
|-------|-------------|
| HIER-001 | Racine = entrée de requête ou job planifié (pas de parent) |
| HIER-002 | Chaque span a exactement un parent ou none (racine) |
| HIER-003 | Profondeur maximale : 7 (root + 6 descendants) |
| HIER-004 | Les spans frères doivent couvrir des opérations de même niveau d'abstraction |
| HIER-005 | Un span Aggregate ne doit JAMAIS contenir un span API Layer enfant (flux descendant uniquement) |
| HIER-006 | EventDispatcher spans sont frère (pas imbriqués) par isolation constitutionnelle CRT-004 |
| HIER-007 | La durée totale de la racine = somme des durées des branches parallèles max |

### 3.2 Events Attachés aux Spans

Des événements facultatifs peuvent être attachés à un span pour marquer des jalons internes :

```
"events": [
  {
    "name": "invariant_check_result",
    "timestamp": "ISO8601",
    "attributes": {"passed": true, "invariant_code": "FIN-002"}
  },
  {
    "name": "retry_attempted",
    "timestamp": "ISO8601",
    "attributes": {"attempt": 3, "max_retries": 5, "backoff_ms": 250}
  }
]
```

**Events standardisés** :
- `invariant_violated` -- invariant DOC-015 non respecté (status de span → ERROR)
- `retry_attempted` -- tentative de retry CRT-012
- `event_published` -- publication CRT-004
- `compensation_triggered` -- compensation CRT-003 saga
- `conflict_detected` -- synchronisation OfflineSyncAggregate
- `idempotency_hit` -- CRT-013 idempotent key match

---

## SECTION 4 : TRACES CROSS-AGGREGATE (Patterns ASS-004)

Les opérations cross-aggregate (ASS-004) génèrent des traces particulières où un seul `trace_id` couvre plusieurs Aggregates distincts. Trois patterns sont définis : Linéaire, Parallèle, Saga.

### Pattern 1 : Linéaire (Sequential)

Les spans s'enchaînent séquentiellement, un par Aggregate. Chaque span fils attend la fin du span parent avant de commencer.

**Schéma** :
```
[Root: API Request]
    └── [AppService: WorkflowTriggered]
            └── [Aggregate A: Workflow created]
                    └── [Aggregate B: Notification queued]
                            └── [Aggregate C: Audit logged]
```

**Règles** :
- ORDER-001 : Chaque step attend le commit du précédent.
- ORDER-002 : Si un step échoue, toute la chaîne est marquée ERROR, mais les steps précédents ne sont PAS compensés automatiquement (seul le pattern Saga compense).
- ORDER-003 : La durée totale de la trace ~ somme des durées de tous les spans (linéaire = pas de parallélisme).

**Exemple ASS-001** : `CreateOrganization` → `OrganizationCreated` event → AuditAggregate auto-log via CRT-014 → NotificationAggregate via CRT-004 handler.

### Pattern 2 : Parallèle (Fan-Out)

Après l'Aggregate source, les handlers s'exécutent en parallèle (ou séquentiellement mais sans dépendance entre eux). Ils partagent le même `parent_span_id` mais n'ont pas de relation père-fils entre eux.

**Schéma** :
```
[Root: API Request]
    └── [AppService: ResourceCreated]
            └── [Aggregate: Resource created & persisted]
                    ├── [Handler: OfflineSyncAggregate push]
                    ├── [Handler: AuditAggregate log]
                    └── [Handler: NotificationAggregate queue]
```

**Règles** :
- PARALLEL-001 : L'échec d'un handler frère n'impacte PAS les autres (CRT-004 constitutionnel : handler isolation).
- PARALLEL-002 : Chaque handler crée son propre span frère avec le même `parent_span_id`.
- PARALLEL-003 : Le span du caller (Aggregate persistence) termine AVANT que les handlers ne commencent.
- PARALLEL-004 : Si un handler est placé en DLQ (CRT-004), son span est marqué ERROR mais les autres handlers continuent normalement.

### Pattern 3 : Saga (Compensation)

Le pattern Saga est utilisé quand une opération cross-aggregate nécessite des actions compensatrices en cas d'échec. CRT-003 coordonne le begin/commit/rollback/compensation.

**Schéma** :
```
[Root: API Request]
    └── [AppService: CrossAggregateCommand]
            └── [SagaScope: CRT-003 TransactionCoordinator]
                    ├── [Step 1: Aggregate A create]  → SUCCESS
                    ├── [Step 2: Aggregate B update]  → SUCCESS
                    ├── [Step 3: Aggregate C approve] → FAILS
                    │       └── [Compensation Step 2: Aggregate B undo] → SUCCESS
                    │       └── [Compensation Step 1: Aggregate A undo] → SUCCESS
                    └── [SagaOutcome: COMPENSATED]
```

**Règles** :
- SAGA-001 : Chaque step de saga produit un span enfant du SagaScope (CRT-003).
- SAGA-002 : Les compensations s'exécutent EN ORDRE INVERSE (dernier step compensé en premier).
- SAGA-003 : Chaque compensation est un span FRÈRE des steps originaux (pas enfant des steps).
- SAGA-004 : Si une compensation échoue, le SagaScope est marqué CRITICAL et la trace est escaladée (P0 alert, OPS-SPEC-004).
- SAGA-005 : Toutes les compensations doivent réussir pour le Saga sceller en COMPENSATED. Si une ne réussit pas → MANCOMPENSATED (état需要 intervention humaine).
- SAGA-006 : Le `trace_id` reste identique durant toute la saga y compris les compensations.
- SAGA-007 : Les saga steps sont loggués comme `TRANSACTION_SAGA_STEP_EXECUTED` et les compensations comme `TRANSACTION_COMPENSATION_EXECUTED` (catégorie TRANSACTION_LOG, OPS-SPEC-001 Section 3).

**Exemple Saga concret (ASS-004)** : Workflow approbation de transaction → vérifie Balance, notifie parties, met à jour ReportingAggregate, loggue AuditAggregate. Si le ReportingAggregate échoue → compense Notification et Audit (rouler partiellement).

---

## SECTION 5 : STRATÉGIE D'ÉCHANTILLONNAGE

### Principes Fondamentaux

L'échantillonnage des traces est **déterministe**, jamais aléatoire. Cela garantit qu'une trace complète peut toujours être reconstituée si elle a été échantillonnée -- pas de "traces orphelines" où un composant échantillonne mais pas l'autre.

### Stratégie par Niveau

| Condition de la Trace | Taux d'Échantillonnage | Raison |
|-----------------------|----------------------|--------|
| Toute trace contenant un ERROR | 100% (forced) | Nécessité de debugger les erreurs |
| Toute trace déclenchant un P0/P1 alert | 100% (forced) | Investigation post-incident requiert trace complète |
| Trace avec status=CRITICAL (span) | 100% (forced) | Événement critique nécessite traçabilité complète |
| Trace normale (aucune erreur) | Configurable (défaut : 1%) | Sampling operationnel standard |
| Trace en développement (env=dev) | 100% (forced) | Full visibility for debugging |

### Fonction d'Échantillonnage Déterministe

```
is_sampled = (hash(trace_id) mod SAMPLING_RATE) == 0
```

Où :
- `trace_id` = UUIDv7 string representation
- `hash()` = fonction de hash cryptographique (SHA-256 ou équivalent)
- `SAMPLING_RATE` = entier configurable (défaut 100 en prod → 1%, donc 1 sur 100 traces)
- `env` = environnement (production, staging, development)

**Garanties** :
- UN même `trace_id` est toujours échantillonné ou toujours exclu (reproductibilité).
- La distribution est uniforme sur un volume suffisant (> 10000 traces).
- Pas de dépendance à une seed de randomisateur partagée entre instances.

### Échantillonnage Adaptatif

À terme, l'échantillonnage peut devenir adaptatif basé sur la charge système :

| Charge Système | Taux par défaut | Mécanisme |
|---------------|----------------|-----------|
| Normal (< 50% CPU) | 1% | Hash deterministic |
| Modéré (50-80% CPU) | 0.5% | Hash deterministic + rate reduction |
| Élevé (> 80% CPU) | 0.1% | Hash deterministic + aggressive reduction |
| Peak (panic) | 0.01% | Minimal sampling, all errors still forced |

L'adaptativité est contrôlée via `ConfigurationPort` -- jamais hardcoded.

---

## SECTION 6 : ATTRIBUTS STANDARD DES SPANS

### Attributs Obligatoires

CHaque span DOIT inclure ces attributs (tag fields) :

| Attribut | Type | Requis | Source | Description |
|----------|------|--------|--------|-------------|
| `trace_id` | UUIDv7 string | OUI (always) | Généré au début de la requête | Identifiant unique de la trace complète |
| `span_id` | UUIDv7 string | OUI (always) | Généré par le composant créant le span | Identifiant unique de ce span |
| `parent_span_id` | UUIDv7 string ou null | OUI (null = root span) | Référence au span parent | NULL uniquement pour la root span |
| `operation_name` | String | OUI (always) | Nom de l'opération effectuée | Ex: `CreateTransaction`, `EventPublish`, `HealthCheck` |
| `start_time` | ISO8601 +tz | OUI (always) | ClockPort.now() au début du span | Timestamp absolu |
| `duration_ms` | Integer | OUI (always) | Calculé à la fermeture du span | Durée en millisecondes entières |
| `service_name` | String | OUI (always) | CRT-NNN ou ASS-NNN | Composant producteur |
| `tags.org_id` | UUID ou null | OUI (null si non applicable) | CRT-015 TenantContextProvider | Organisation cible |
| `tags.user_id` | UUID ou null | OUI (null si op auto) | IdentityProviderPort | Utilisateur actionnant |
| `tags.error_code` | String ou null | Non (si status != ERROR) | Code d'erreur structuré | Ex: `E-422-001-FIN-002` |

### Attributs Conditionnels

| Attribut | Type | Quand inclus | Description |
|----------|------|-------------|-------------|
| `tags.http_method` | String | Span API entry | Méthode HTTP (GET, POST, PUT, DELETE, PATCH) |
| `tags.http_path` | String | Span API entry | Chemin de l'endpoint (/transactions, /users/login) |
| `tags.http_status` | Integer | Span API exit | Code de réponse HTTP (200, 201, 401, 422, 500, etc.) |
| `tags.aggregate_name` | String | SpanAggregate | Nom de l'Aggregate (OrganizationAggregate, ResourceAggregate, etc.) |
| `tags.command_name` | String | Span Command | Nom de la Commande (CreateTransaction, ApproveStep, etc.) |
| `tags.event_type` | String | Span Event | Type de Domain Event (ResourceCreated, ApprovalGranted, etc.) |
| `tags.saga_step` | Integer | Span Saga step | Index de l'étape de saga (1, 2, 3...) |
| `tags.compensation` | Boolean | Span Compensation | true si span représente une compensation |
| `tags.retry_count` | Integer | Span Retry | Nombre de tentatives si opération retryée |
| `tags.batch_index` | Integer | Span Batch | Index dans un lot de sync (0-49 pour batches ≤50) |
| `tags.clock_source` | String | Span timer-related | ClockPort used for timing (canonical vs wall-clock) |

### Attributs Interdits

| Attribut | Raison d'interdiction |
|----------|----------------------|
| Any field containing password/token/secret/api_key | Données sensibles (BR-ID-001, OPS-SPEC-001 Principe 4) |
| Email address | Données personnelles identifiables |
| Full request/response body | Volume excessif + données sensibles potentielles |
| SQL query strings | données techniques sensibles, ne pertinent pas pour troubleshooting |
| File content/paths (full) | Sécurité + volume |

---

## SECTION 7 : RÉTENTION DES TRACES

### Politique de Rétention

| Type de Trace | Rétention | Justification | Base réglementaire |
|--------------|-----------|---------------|-------------------|
| Operational traces (active requests) | Durée de vie de la session + 1 heure | Traces non-finalisées peuvent être complétées par des evenements tardifs | Opérationnel |
| Operational traces (finalized) | 7 jours | Information opérationnelle standard, suffit pour debugging récent | Conforme OPS-SPEC-001 INFO retention (90 jours) -- les traces sont moins volumineuses, donc 7 jours pour les données détaillées |
| Archived traces (pre-retention exports) | 30 jours ou until retention period expires | Export pour audit ou investigation | DOC-015 audit retention |
| Error traces (contenant ERROR or CRITICAL spans) | 90 jours minimum | Les erreurs nécessitent une traçabilité plus longue pour debugging récurrent | OPS-SPEC-001 Section 4 (INFO retention = 90 jours) |
| Saga traces (compensated ou man-compensated) | 90 jours minimum | Les sagas compensées nécessitent une traçabilité pour analyse post-incident | CRT-003 constitutionnel |
| Traces de P0/P1 incidents | 1 an minimum | Investigation post-incident complète nécessite accès historique long | Incident response (OPS-SPEC-006) |

### Règles de Rétention

1. **PURGE-001** : Les traces opérationnelles normales expirent après 7 jours et sont purgées automatiquement par le `Scheduler` (CRT-009, job `PurgeSchedule`).

2. **PURGE-002** : Les traces d'erreurs (status=ERROR ou CRITICAL à tout niveau) sont conservées 90 jours minimum.

3. **PURGE-003** : Les traces archivéees pour investigation incident peuvent être explicitement prolongées au-delà de leur rétention standard.

4. **PURGE-004** : Aucune trace ne contient de données sensibles. Le filtrage schema-based (BR-ID-001) s'applique au niveau de la capture du span, pas de la rétention.

5. **PURGE-005** : La rétention est configurée via `ConfigurationPort` mais ne peut jamais être inférieure aux minima ci-dessus. Valeurs par défaut : `TRACE_RETENTION_DEFAULT_DAYS=7`, `TRACE_RETENTION_ERROR_DAYS=90`, `TRACE_RETENTION_INCIDENT_DAYS=365`.

6. **PURGE-006** : Les traces finalisées (tous les spans fermés) peuvent être archivées sur cold storage après expiration de la rétention active (coût de stockage optimisé). Elles restent queryable via interface d'archive.

---

## SECTION 8 : INTÉGRATION AVEC LE SYSTÈME DE LOGGING

### Liaison Trace ↔ Log

Chaque span est lié à une ou plusieurs entries de log OPS-SPEC-001 via le champ `correlation_id` commun :

| Élément Trace | Élément Logging Corrélé | Champ Commun |
|--------------|------------------------|-------------|
| `trace_id` | `correlation_id` (OPS-SPEC-001 §2) | Même UUIDv7 |
| `span_id` | `context.correlation_id` (dans logs de span) | Même UUIDv7 |
| `duration_ms` | `duration_ms` (OPS-SPEC-001 §2) | Même valeur |
| `status=ERROR` | `level=ERROR` ou `CRITICAL` (OPS-SPEC-001 §1.2) | Cohérent |
| `tags.error_code` | `context.error_code` (OPS-SPEC-001 §3) | Même code |

### Exemple : Corrélation Complet

```
Span (Trace):
  trace_id: 01kabc123def456ghij789klm0
  span_id:  span-a1b2c3d4
  parent:   null (root)
  operation: POST /transactions
  service_name: API-Layer
  tags.org_id: 550e8400-e29b-41d4-a716-446655440000
  
Corresponding Logs (same trace_id):
  [LOG-1] correlation_id: 01kabc123def456ghij789klm0
          service: CRT-001
          message: "Request received"
          event_type: REQUEST_RECEIVED
          
  [LOG-2] correlation_id: 01kabc123def456ghij789klm0
          service: ResourceService
          message: "Transaction created"
          event_type: DOMAIN_EVENT_PUBLISHED
          
  [LOG-3] correlation_id: 01kabc123def456ghij789klm0
          service: CRT-004
          message: "Event published successfully"
          event_type: DOMAIN_EVENT_CONSUMED
```

---

## SECTION 9 : COMPLIANCE ET VALIDATION

### Règles non-négociables de conformité

1. **TP-001** : Chaque requête entrante produit exactement UNE trace avec UN `trace_id` unique (UUIDv7). Vérifiable par test : chaque requête API doit pouvoir être tracée de bout en bout.

2. **TP-002** : Aucun span ne change de `trace_id` durant son exécution. Vérifiable par inspection du code de propagation.

3. **TP-003** : Tous les attributs obligatoires (Section 6) sont présents dans CHAQUE span. Vérifiable par test d'intégration vérifiant le schéma de chaque span produit.

4. **TP-004** : Aucun attribut interdit (Section 6) n'apparaît dans les spans. Vérifiable par lint rule + test d'intégration.

5. **TP-005** : L'échantillonnage est déterministe (Section 5). Vérifiable par test : mêmes `trace_id` toujours échantillonnés ou toujours exclus.

6. **TP-006** : Les sagas (Pattern 3) suivent l'ordre inverse pour les compensations (SAGA-002). Vérifiable par replay de trace saga.

7. **TP-007** : La corrélation trace↔log fonctionne via `correlation_id`/`trace_id` identique. Vérifiable par jointure automatique.

8. **TP-008** : La propagation respect le flux descendant API → AppService → Aggregate → Repository → EventDispatcher. Vérifiable par structure de hiérarchie de spans.

### Matrice de traçabilité OPS-SPEC-003

| Section du Document | Source RTS-001 | Source ASS-001 | Source DOC-015 |
|--------------------|---------------|---------------|---------------|
| Section 1: Concept | CRT-006 (LifecycleManager expose spans) | Tous services (orchestrent les traces) | Tous invariants (validations creent spans) |
| Section 2: Propagation | CRT-003, CRT-004, CRT-015 | Tous services (propagent via appels) | -- |
| Section 3: Hiérarchie | CRT-001 (structure), CRT-004 (handler isolation) | -- | -- |
| Section 4: Cross-Aggregate | CRT-003 (Saga), CRT-004 (fan-out) | ASS-004 patterns | Tous invariants cross-aggregate |
| Section 5: Échantillonnage | CRT-005 (configurable) | -- | -- |
| Section 6: Attributs | Tous CRTs | Tous services | Tous aggregates |
| Section 7: Rétention | -- | -- | RETENTION-031 (audit) |
| Section 8: Intégration Log | CRT-008 (Diagnostics) | Tous services | -- |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | ops-specifier v1.0 | Création — Modèle de traçage distribué abstrait pour Lumina v1 | COMPLIANT (trace vérifié contre RTS-001, ASS-001, DOC-015) |

---

*Ce document définit le modèle de traçage distribué abstrait pour l'architecture Lumina v1. Il ne prescrit AUCUN outil concret (pas de Jaeger, Zipkin, OpenTelemetry, Honeycomb, New Relic APM, etc.). L'implémentation technique du tracing (stockage de spans, Visualisation, querying) est déterminée par l'adapter de LoggingPort/DiagnosticsPort choisi lors de la Phase 104 (ASSEMBLAGE ADAPTATORS, RTS-002).*
