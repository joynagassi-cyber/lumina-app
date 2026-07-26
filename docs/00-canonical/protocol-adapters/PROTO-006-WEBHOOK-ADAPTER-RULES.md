# Webhook Adapter Rules Specification — Lumina v1

**Doc ID:** PROTO-006
**Version:** v1.0
**Statut:** SPÉCIFICATION PROTOCOLE ADAPTÉ DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-014", "ASS-003", "ASS-004", "PROTO-001"]
**Transformation_rule :** "webhook-adapter-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## SOMMAIRE

1. [Principes Fondamentaux](#1-principes-fondamentaux)
2. [Format du Payload d'Evenements](#2-format-du-payload-devenements)
3. [Contract d'Enregistrement des Webhooks](#3-contract-denregistrement-des-webhooks)
4. [Garanties de Livraison et Planning de Retry](#4-garanties-de-livraison-et-planning-de-retry)
5. [Verification de Signature](#5-verification-de-signature)
6. [Registre des Types d'Evenements](#6-registre-des-types-devenements)
7. [Sante et Monitoring des Webhooks](#7-sante-et-monitoring-des-webhooks)
8. [Matrice de Traçabilité](#8-matricedetracabilite)

---

## 1. PRINCIPES FONDAMENTAUX

Le Webhook Adapter est un adapter de protocole dans le sens defini par **PROTO-001** : il transforme les donnees du domaine en evenements webhook conformes au Canonical Response definie par **API-CONTRACT-002** Section 2.2. Le webhook est une voie de SORTIE uniquement — il ne traite AUCUNE commande entrante venant de clients externes.

### Regle W-001: Les Webhooks Reçoivent des Domain Events, PAS des Commands

Les webhooks sont exclusivement des canaux de publication d'evenements. Ils reflechent l'etat des Domain Events generes par les Aggregates via EventPublicationPort (**PAS-001 Port-003**).

Un webhook NE peut pas :
- Recevoir une commande d'un client externe
- Trigger une mutation de donnees directement
- Etre la source d'un Canonical Request

Un webhook PEUT :
- Publier les Domain Events tels qu'émis par les Aggregates
- Notifier des consumers externes sur les changements d'etat
- Transmettre les evenements vers des systemes tiers

Cette regle decoule de **ASS-003 Workflow Specification** Step 7 (Event Publishing) : les Domain Events sont emis par les Aggregates et publies via EventPublicationPort, qui alimente le webhook adapter.

### Regle W-002: Format Payload Suit l'Abstraction CloudEvents

Le format de payload webhook suit l'abstraction conceptuelle de CloudEvents : chaque event contient un ensemble standard de metadatas (specversion, type, source, id, time, subject, datacontenttype, dataschema, data). Ce format n'est lie a AUCUNE implémentation CloudEvents specifique (HTTP POST binding, AMQP binding, etc.). C'est une structure conceptuelle que le webhook adapte.

Tous les champs obligatoires de CloudEvents 1.0 sont representes. Des champs optionnels extensions Lumina sont ajoutes pour la traçabilité et le sync.

### Regle W-003: Les 60+ Domain Events de DOC-014 Sont tous Subscriber-eligible

Le registre de Domain Events defini dans **DOC-014** contient 60+ evenements provenant de 13 Aggregates. Chacun de ces evenements POUVAIT théoriquement être subscribe via webhook. La Section 6 definit lesquels sont effectivement subscribable (certains sont des internal-only events avec un volume trop éleve).

### Regle W-004: Retries avec Exponential Backoff et Jitter

Chaque tentative de livraison webhook suit un planning retry definit selon **RTS-003 Orchestration Rules** section RetryPolicy. Le retry utilise un backoff exponentiel avec un jitter aleatoire pour éviter le thundering herd. Chaque retry est consigné dans un log de delivery.

### Regle W-005: Verification de Signature Assure l'Authenticité

Chaque payload webhook est signe avec HMAC-SHA256. Le consommateur du webhook doit verifier la signature AVANT de traiter le payload. Une signature invalidée entraîne une réponse HTTP 401 immédiate sans retry.

### Regle W-006: Gestion Dead-Letter — Les Evenements Ne Sont Jamais Silencieusement Perdu

Si le nombre maximal de retries est atteint, l'evenement est déplace vers une file dead-letter. Il n'est JAMAIS supprime silencieu-sement. Un consumer peut recupérer les evenements dead-letter via un endpoint de查询 ou via AuditAggregate.

---

## 2. FORMAT DU PAYLOAD D'EVENEMENTS

### 2.1 Structure Conceptuelle de CloudEvents

Chaque webhook payload respecte la structure conceptuelle suivante. Elle n'est pas liee a une implementation technique spécifique mais define un contrat qui s'adapte a tout transport webhook (HTTP POST, message queue, etc.).

```json
{
  "specversion": "1.0",
  "type": "lumina.resource.transaction.created",
  "source": "/lumina/resource-aggregate",
  "id": "5a6b7c8d-9e0f-1a2b-3c4d-5e6f7a8b9c0d",
  "time": "2026-07-25T10:30:00Z",
  "subject": "transaction/5a6b7c8d-...",
  "datacontenttype": "application/json",
  "dataschema": "https://lumina.local/schema/v1/events/resource/transaction-created.json",
  "data": {
    "transaction_id": "5a6b7c8d-...",
    "org_id": "12345678-...",
    "created_by": "user-abc123",
    "amount_cents": 50000,
    "type": "income",
    "status": "pending",
    "transaction_date": "2026-07-25",
    "version": 1,
    "sync_status": "pending"
  }
}
```

### 2.2 Description de Chaque Champ

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `specversion` | string | Oui | Version de l'abstraction CloudEvents. Toujours `"1.0"` pour Lumina v1. Permet aux consumers de gerer evolutivement les schemas futures. |
| `type` | string | Oui | Identifiant categoriel de l'evenement. Format: `lumina.{aggregate}.{entity}.{action}`. Ex: `lumina.resource.transaction.approved`. Mapping vers l'event de DOC-014. |
| `source` | string | Oui | URI identifiant le Canonical Source (l'Aggregate qui a émis l'evenement). Format: `/lumina/{aggregate-name}`. Ex: `/lumina/resource-aggregate`, `/lumina/identity-aggregate`. |
| `id` | string (UUID v4) | Oui | Identifiant unique de l'evenement. Garanti unique meme across retries (IDempotency). Utilise pour deduplication cote consumer. |
| `time` | string (ISO 8601) | Oui | Horodatage ISO 8601 UTC de l'emission de l'evenement par l'Aggregate. Format: `YYYY-MM-DDTHH:mm:ssZ`. Reflete ClockPort (**PAS-001 Port-006**). |
| `subject` | string | Oui | Identificateur de la ressource cible de l'evenement. Format: `{entity-type}/{entity-id}`. Ex: `transaction/c3d4e5f6-...`, `user/b2c3d4e5-...`. |
| `datacontenttype` | string | Oui | Type MIME du payload data. Toujours `"application/json"` pour Lumina v1. |
| `dataschema` | URI | Non | URI du schema JSON Schema pour ce type d'evenement. Permet validation side-consumer. Nul si le consumer n'a pas besoin de validation automatique. |
| `data` | object | Oui | Contenu de l'evenement — les donnees metier spécifiques. Sa structure exacte depend du type d'evenement. Contient les champs pertinents definis dans DOC-014 pour cet event. |

### 2.3 Structure du Champ `data` Par Type d'Evenement

#### ResourceAggregate Events

**ResourceCreated** (CreateTransaction, CreateMember) :
```json
"data": {
  "resource_id": "uuid",
  "org_id": "uuid",
  "resource_type": "transaction | member",
  "created_by": "uuid",
  "version": 1,
  "sync_status": "pending",
  ...fields specific to resource type
}
```

**ResourceUpdated** (UpdateDraftTransaction, UpdateMember) :
```json
"data": {
  "resource_id": "uuid",
  "org_id": "uuid",
  "resource_type": "transaction | member",
  "updated_by": "uuid",
  "version": 2,
  "changes": { "field_name": "new_value" },
  "sync_status": "pending"
}
```

**ResourceStateChanged** (ApproveTransaction, TransitionMemberStatus, TrashResource) :
```json
"data": {
  "resource_id": "uuid",
  "org_id": "uuid",
  "resource_type": "transaction | member | archive",
  "old_state": "draft",
  "new_state": "pending",
  "transitioned_by": "uuid",
  "version": 3,
  "sync_status": "pending"
}
```

**ApprovalRequested** :
```json
"data": {
  "resource_id": "uuid",
  "org_id": "uuid",
  "requested_by": "uuid",
  "threshold_amount_cents": 50000,
  "approval_chain_depth": 1
}
```

**ApprovalGranted** :
```json
"data": {
  "resource_id": "uuid",
  "org_id": "uuid",
  "approved_by": "uuid",
  "approved_at": "2026-07-25T10:00:00Z",
  "comment": "Validated and approved"
}
```

**ApprovalRejected** :
```json
"data": {
  "resource_id": "uuid",
  "org_id": "uuid",
  "rejected_by": "uuid",
  "reason": "Amount exceeds threshold without proper justification"
}
```

**TransactionCompensated** :
```json
"data": {
  "original_transaction_id": "uuid",
  "compensation_transaction_id": "uuid",
  "reason": "Duplicate entry detected"
}
```

#### IdentityAggregate Events

**UserCreated** :
```json
"data": {
  "user_id": "uuid",
  "org_id": "uuid",
  "email": "user@example.cd",
  "role": "pastor",
  "first_name": "Jean",
  "last_name": "Mbala",
  "password_hash": "***"
}
```

**UserLoggedIn** / **SessionCreated** :
```json
"data": {
  "user_id": "uuid",
  "session_id": "uuid",
  "org_id": "uuid",
  "device_info": "mobile-android",
  "login_timestamp": "2026-07-25T08:00:00Z"
}
```

**UserLoggedOut** / **SessionRevoked** / **SessionExpired** :
```json
"data": {
  "user_id": "uuid",
  "session_id": "uuid",
  "ended_at": "2026-07-25T18:00:00Z"
}
```

**UserRoleChanged** :
```json
"data": {
  "user_id": "uuid",
  "old_role": "treasurer",
  "new_role": "admin",
  "effective_date": "2026-07-25",
  "changed_by": "uuid"
}
```

**PasswordResetRequested** :
```json
"data": {
  "user_id": "uuid",
  "reset_timestamp": "2026-07-25T09:00:00Z",
  "initiated_by": "self | admin"
}
```

#### OrganizationAggregate Events

**OrganizationCreated** :
```json
"data": {
  "org_id": "uuid",
  "name": "Église Lumina Central",
  "type": "church",
  "settings": { "currency": "CDF", "timezone": "Africa/Lubumbashi" }
}
```

**OrgUnitCreated** :
```json
"data": {
  "org_unit_id": "uuid",
  "org_id": "uuid",
  "name": "Secteur Nord",
  "unit_type": "sector",
  "parent_id": "uuid-or-null",
  "depth_level": 1
}
```

**OrgUnitParentChanged** / **ChildOrgTransferred** / **ChildOrgMerged** :
```json
"data": {
  "affected_unit_or_org_id": "uuid",
  "org_id": "uuid",
  "old_parent_id": "uuid-or-null",
  "new_parent_id": "uuid-or-null",
  "depth_level": 2
}
```

**OrganizationArchived** / **OrganizationSuspended** :
```json
"data": {
  "org_id": "uuid",
  "archived_at": "2026-07-25T10:00:00Z",
  "reason": "Optional reason for suspension/archive"
}
```

**SettingUpdated** :
```json
"data": {
  "setting_key": "currency",
  "old_value": "USD",
  "new_value": "CDF",
  "updated_by": "uuid",
  "updated_at": "2026-07-25T10:00:00Z"
}
```

#### RelationshipAggregate Events

**MemberJoinedGroup** :
```json
"data": {
  "member_id": "uuid",
  "group_id": "uuid",
  "joined_at": "2026-07-25T10:00:00Z"
}
```

**MemberLeftGroup** :
```json
"data": {
  "member_id": "uuid",
  "group_id": "uuid",
  "left_at": "2026-07-25T11:00:00Z"
}
```

**OrgUnitReparented** :
```json
"data": {
  "unit_id": "uuid",
  "old_parent_id": "uuid",
  "new_parent_id": "uuid",
  "depth_level": 2
}
```

**DescendantEnumerationRequested** :
```json
"data": {
  "root_unit_id": "uuid",
  "depth_requested": 3
}
```

#### WorkflowAggregate Events

**WorkflowTriggered** :
```json
"data": {
  "instance_id": "uuid",
  "definition_key": "tx-approval-major",
  "trigger_event": "transaction.created",
  "resource_type": "transaction",
  "resource_id": "uuid",
  "current_step": 1,
  "assigned_to_role": "treasurer"
}
```

**StepApproved** / **StepRejected** :
```json
"data": {
  "instance_id": "uuid",
  "step_id": "uuid",
  "step_type": "approval",
  "approved_by": "uuid",
  "comment_or_reason": "text"
}
```

**WorkflowCompleted** / **WorkflowCancelled** / **WorkflowFailed** :
```json
"data": {
  "instance_id": "uuid",
  "completed_at": "2026-07-25T12:00:00Z",
  "total_steps": 3,
  "steps_completed": 3,
  "error_or_cancel_reason": "null"
}
```

**StepEscalated** :
```json
"data": {
  "instance_id": "uuid",
  "step_id": "uuid",
  "escalation_target_role": "admin",
  "timeout_duration_hours": 72
}
```

**StepExecuted** :
```json
"data": {
  "instance_id": "uuid",
  "step_id": "uuid",
  "step_type": "auto",
  "executed_at": "2026-07-25T10:00:00Z"
}
```

#### FormAggregate Events

**FormSubmitted** :
```json
"data": {
  "form_id": "fin-monthly-report",
  "form_data": { ... validated form fields ... },
  "submitted_by": "uuid",
  "submitted_at": "2026-07-25T10:00:00Z",
  "resource_id": "uuid"
}
```

**FormValidationFailed** :
```json
"data": {
  "form_id": "fin-monthly-report",
  "field_name": "amount_cents",
  "error_code": "E-400-002",
  "user_message": "Amount must be a positive integer"
}
```

**FormSubmittedForApproval** :
```json
"data": {
  "form_id": "fin-monthly-report",
  "resource_id": "uuid",
  "workflow_id": "uuid"
}
```

#### NotificationAggregate Events

**NotificationQueued** :
```json
"data": {
  "notification_id": "uuid",
  "channel": "in_app",
  "recipient_id": "uuid",
  "severity": "high",
  "trigger_source": "approval-requested"
}
```

**NotificationSent** / **NotificationFailed** / **NotificationMarkedRead** :
```json
"data": {
  "notification_id": "uuid",
  "channel": "in_app",
  "sent_at": "2026-07-25T10:00:00Z",
  "read_at": "2026-07-25T10:05:00Z",
  "error_message": "null or network unreachable"
}
```

**PreferencesUpdated** :
```json
"data": {
  "user_id": "uuid",
  "channels": ["in_app", "email"],
  "severity_min": "medium",
  "rate_limit_per_hour": 24,
  "updated_at": "2026-07-25T10:00:00Z"
}
```

#### VocabularyAggregate Events

**TermAdded** :
```json
"data": {
  "namespace": "finance",
  "term_key": "income-types",
  "value_key": "tithes",
  "labels": { "fr": "Dîmes", "en": "Tithes" }
}
```

**TermValueDeprecated** :
```json
"data": {
  "namespace": "finance",
  "term_key": "income-types",
  "deprecated_value_key": "old-category-key",
  "deprecated_at": "2026-07-25T10:00:00Z"
}
```

**TranslationResolved** :
```json
"data": {
  "namespace": "finance",
  "term_key": "income-types",
  "lang": "fr",
  "resolved_label": "Dîmes"
}
```

#### ReportingAggregate Events

**ReportGenerated** :
```json
"data": {
  "report_id": "uuid",
  "report_type": "balance-sheet",
  "period_start": "2026-07-01",
  "period_end": "2026-07-31",
  "income_cents": 500000,
  "expense_cents": 200000,
  "net_result_cents": 300000,
  "format": "json"
}
```

**ReportExported** :
```json
"data": {
  "report_id": "uuid",
  "format": "pdf",
  "exported_by": "uuid",
  "exported_at": "2026-07-25T11:00:00Z"
}
```

**BalanceCalculated** :
```json
"data": {
  "scope": "org",
  "period_start": "2026-07-01",
  "period_end": "2026-07-31",
  "total_assets_cents": 2500000,
  "total_liabilities_cents": 1200000,
  "net_result_cents": 1300000,
  "balanced": true
}
```

#### LifecycleAggregate Events

**ResourceArchived** :
```json
"data": {
  "archive_id": "uuid",
  "resource_type": "transaction",
  "resource_id": "uuid",
  "archived_at": "2026-07-25T10:00:00Z",
  "archived_by": "uuid",
  "tags": ["quarterly-closed"]
}
```

**ResourceTrashed** :
```json
"data": {
  "archive_id": "uuid",
  "trashed_at": "2026-07-25T10:05:00Z",
  "trash_reason": "End of quarter cleanup"
}
```

**ResourcePurged** :
```json
"data": {
  "archive_id": "uuid",
  "purged_at": "2026-08-01T00:00:00Z"
}
```

**ResourceRestoredFromTrash** :
```json
"data": {
  "archive_id": "uuid",
  "restored_at": "2026-07-25T10:10:00Z",
  "restored_by": "uuid"
}
```

**PurgeScheduled** :
```json
"data": {
  "archive_id": "uuid",
  "purge_date": "2027-01-01"
}
```

#### OfflineSyncAggregate Events

**BatchPushed** :
```json
"data": {
  "batch_count": 10,
  "pushed_at": "2026-07-25T10:00:00Z",
  "org_id": "uuid"
}
```

**DeltaReceived** :
```json
"data": {
  "table": "transactions",
  "count": 5,
  "since_timestamp": "2026-07-25T09:00:00Z"
}
```

**ConflictDetected** / **ConflictResolved** :
```json
"data": {
  "resource_type": "transaction",
  "resource_id": "uuid",
  "client_version": 3,
  "server_version": 5,
  "strategy_used": "LWW | server-wins | immutable",
  "winner": "server"
}
```

**SyncCompleted** :
```json
"data": {
  "org_id": "uuid",
  "completed_at": "2026-07-25T10:00:00Z",
  "push_count": 10,
  "pull_count": 5
}
```

**ConnectionLost** / **ConnectionRestored** :
```json
"data": {
  "lost_at": "2026-07-25T10:00:00Z",
  "last_known_state": "online | offline",
  "pending_ops_count": 3
}
```

**SyncStarted** :
```json
"data": {
  "org_id": "uuid",
  "started_at": "2026-07-25T10:00:00Z"
}
```

### 2.4 Regles Spécifiques au Payload

1. **Aucun champ sensible en clair** : password_hash, refresh_token_hash, credentials sont toujours masqués avec `***` dans le champ `data`.
2. **org_id toujours present** : Tous les payloads de data incluent `org_id` pour isolation tenant. Ceci decoule de **PAS-003 DR-009**.
3. **Sync_status inclus** : Tous les payloads de resources incluent `sync_status` (pending, synced, failed) pour tracking offline-first.
4. **Version inclusive** : Toutes les ressources ont un `version` pour optimist locking.

---

## 3. CONTRACT D'ENREGISTREMENT DES WEBHOOKS

### 3.1 Vue d'Ensemble

L'enregistrement webhook est gere par l'Application Service approprié (chaque Aggregate expose son port EventSubscription). Le contract definit CI-DESSOUS decrit comment un consumer externe enregistre un webhook.

**Important** : L'enregistrement webhook lui-même passe par un endpoint API standard (CreateWebhookSubscription → Application Service → RepositoryPort). La specification ci-dessous decrit la STRUCTURE des donnees d'enregistrement, PAS l'implémentation.

### 3.2 Validation de l'URL du Endpoint

L'URL du endpoint webhook doit :
- Être une URL HTTPS valide (le HTTP pur est rejecte pour securité)
- Avoir un certificat TLS valide
- Être accessible depuis le réseau du serveur Lumina
- Ne pas pointer vers une adresse privée/réseau interne (10.x.x.x, 192.168.x.x, 127.0.0.1, localhost)

Validation :
```
url.match(/^https:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)*(:[0-9]+)?\/.*$/)
```

### 3.3 Structure d'Enregistrement

Le request body pour enregister un webhook :

```json
{
  "webhook_url": "https://example.com/webhook/lumina",
  "event_types": [
    "transaction.created",
    "transaction.approved",
    "transaction.rejected",
    "user.logged_in",
    "workflow.triggered"
  ],
  "secret": "random-base64-encoded-string-at-least-256-bits",
  "metadata": {
    "app_name": "MyApp",
    "contact_email": "admin@example.com",
    "description": "Receives transaction and workflow events from Lumina"
  }
}
```

### 3.4 Champs d'Enregistrement

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `webhook_url` | string (HTTPS URL) | Oui | URL où les evenements seront POSTés |
| `event_types` | string[] | Oui | Liste des types d'evenements à subscrire (peut être vide = unsubscribe total) |
| `secret` | string (base64, ≥256 bits) | Oui | Secret partagé pour la signature HMAC-SHA256 |
| `metadata.app_name` | string | Non | Nom de l'application consommer |
| `metadata.contact_email` | string | Non | Email de contact pour alertes de sante |
| `metadata.description` | string | Non | Description optionnelle |

### 3.5 Limitation de Taux (Rate Limiting)

Chaque subscription webhook est limitée à :
- **100 evenements par minute** par subscription
- **10,000 evenements par heure** cumulative
- **Max 20 subscriptions actives** par organization

Au-dela de ces limites, le Webhook Manager retourne une erreur E-422-001-RATE-002.

### 3.6 Callback URL pour Delivery Status

Optionnel, le consumer peut specifier un `callback_url` pour recevoir des notifications de statut de livraison :

```json
{
  "webhook_url": "https://example.com/webhook/lumina",
  "event_types": [...],
  "secret": "...",
  "delivery_status_callback": "https://example.com/webhook-status",
  "metadata": { "app_name": "MyApp" }
}
```

Le delivery status callback recoit des evenements webhooks internes decrivant le statut de livraison (delivered, failed, retrying).

### 3.7 Réponse d'Enregistrement

```json
{
  "subscription_id": "sub-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "webhook_url": "https://example.com/webhook/lumina",
  "event_types": ["transaction.created", "workflow.triggered"],
  "status": "active",
  "created_at": "2026-07-25T10:30:00Z",
  "rate_limit": {
    "per_minute": 100,
    "per_hour": 10000,
    "max_subscriptions": 20
  }
}
```

---

## 4. GARANTIES DE LIVRAISON ET PLANNING DE RETRY

### 4.1 Comportement de Retry Détaillé

Le Webhook Manager tente de livrer chaque evenement au endpoint URL enregistre. Si la premiere tentative échoue, le planning suivant est appliqué :

| Tentative | Délai après échec précédent | Délai total approximatif | Jitter |
|-----------|--------------------------|-------------------------|--------|
| 1 | Immédiat (sur occurrence de l'event) | 0s | 0s |
| Retry 1 | 30 secondes | 30s | ±0s |
| Retry 2 | 2 minutes | 2m 30s | ±60s (uniform random) |
| Retry 3 | 10 minutes | 12m 30s | ±5min |
| Retry 4 | 1 heure | ~1h 12m | ±30min |
| Retry 5 | 6 heures | ~7h 12m | ±2h |

- **Nombre maximum de retries : 5**
- **Jitter** : uniforme distribue aleatoirement sur l'intervalle spécifié pour éviter le thundering herd lorsque plusieurs webhooks échouent simultanément
- **Backoff exponentiel base** : 30s → 120s → 600s → 3600s → 21600s (ratio ~4x entre tentatives consecutives)

### 4.2 Gestion Dead-Letter

Apres 5 retries echouées, l'evenement est deplacé vers une file dead-letter :

- L'evenement est conserve dans la file dead-letter pendant **30 jours**
- Un consumer peut recuperer les evenements dead-letter via `lumina audit list --type dead-letter` ou via l'API standard
- Si aucun consumer n'interagit avec le dead-letter dans les 30 jours, l'evenement est automatiquement purgé
- Le purge est consigné dans l'AuditAggregate comme un event `DeadLetterPurged`

### 4.3 Logging de Livraison

Chaque tentative de livraison webhook consigne les informations suivantes dans l'AuditAggregate (LogAction SYSTEM-ONLY) :

| Champ | Description |
|-------|-------------|
| `timestamp` | Horodatage UTC de la tentative |
| `attempt_number` | Numero de tentative (1-5) |
| `http_status_received` | Code HTTP recu en réponse (200, 404, 500, etc.) |
| `response_body_summary` | Premieres 256 caracteres de la reponse (tronquée pour éviter la surcharge) |
| `next_retry_time` | Horodatage de la prochaine tentative (nul si dead-letter) |
| `webhook_url` | URL cible de la livraison |
| `event_type` | Type de l'evenement |
| `event_id` | UUID de l'evenement |

Exemple de log entry :
```json
{
  "timestamp": "2026-07-25T10:30:30Z",
  "attempt_number": 2,
  "http_status_received": 503,
  "response_body_summary": "<html><body>Service temporarily unavailable</body></html>",
  "next_retry_time": "2026-07-25T10:32:30Z",
  "webhook_url": "https://example.com/webhook/lumina",
  "event_type": "transaction.created",
  "event_id": "5a6b7c8d-..."
}
```

### 4.4 Garantie de Livraison

| Garantie | Description |
|----------|-------------|
| **At-least-once** | Chaque evenement est livre au moins une fois. Les dupes sont possibles (le consumer doit faire la deduplication via `id`). |
| **Pas de loss** | Aucun evenement n'est silencieusement perdu — apres max retries, il va en dead-letter |
| **Order preservation** | Les evenements du MÊME aggregate etalement sur le MÊME entity respectent l'ordre d'emission. Les evenements cross-aggregate ne保证ent pas l'ordre. |

---

## 5. VERIFICATION DE SIGNATURE

### 5.1 Mécanisme HMAC-SHA256 Abstrait

La signature webhook est calculée et verifiée de maniere abstraite — aucune dépendance à une bibliothèque crypto spécifique. Le concept est le suivant :

**Calcul de la signature (côté serveur Lumina) :**

1. Le payload webhook brut est serialisé en JSON (sans whitespace supplémentaire — compact JSON).
2. Le timestamp d'emission (champ `time` du payload) est extrait.
3. La chaine brute a signer est concatenatee ainsi : `${timestamp}.${body_json}`
   - Exemple : `2026-07-25T10:30:00Z.{"specversion":"1.0","type":"...","data":{...}}`
4. HMAC-SHA256 est calcule sur cette chaine en utilisant le `secret` partage comme cle.
5. Le resultat est encode en hexadécimal.

**Envoi de la signature (headers HTTP) :**

```
POST /webhook/lumina HTTP/1.1
Host: example.com
Content-Type: application/json
X-Lumina-Event-ID: 5a6b7c8d-...
X-Lumina-Signature: sha256=a1b2c3d4e5f6...7890
X-Lumina-Timestamp: 2026-07-25T10:30:00Z
```

Deux headers sont utilises :
- `X-Lumina-Signature` : algorithme + hash hex (`sha256=<hex>`)
- `X-Lumina-Timestamp` : horodatage exact du payload (pour replay detection)

### 5.2 Verification (côté consumer)

Le consumer webhook doit :

1. Extraire `X-Lumina-Signature` et `X-Lumina-Timestamp` des headers entrants.
2. Extraire le body brut de la requête HTTP (avant parsing JSON — bytes exacts).
3. Construire la chaine `${timestamp}.${body_bytes}` en utilisant les valeurs extraites.
4. Calculer HMAC-SHA256 sur cette chaine avec le secret partage (stocke lors de l'enregistrement).
5. Comparer le hash calculé avec le hash recu dans `X-Lumina-Signature`.
6. **Verifier aussi le timestamp** : la différence entre `X-Lumina-Timestamp` et l'horloge locale doit être ≤ 5 minutes. Au-dela → replay attack possible → reject immediatement.

### 5.3 Comportement en Cas d'Échec de Verification

Si la signature ne correspond PAS :

| Action | Détail |
|--------|--------|
| HTTP Response | `401 Unauthorized` |
| Body | `{"error": "Invalid signature. Possible tampering."}` |
| Retry? | **NON** — aucun retry pour signature invalidée |
| Audit log | Consigné comme event `SuspiciousWebhookDeliveryAttempt` dans AuditAggregate |
| Alert | Optionnellement, alerte envoyee au contact_email du metadata |

La non-retry pour signatures invalidées est intentionnelle : elle previent les attaques par injection de payloads malveillants.

### 5.4 Rotation du Secret

Les secrets peuvent etre rotates sans interruption de service :
- Le consumer stocke potentiellement deux secrets (ancien et nouveau) pour la periode de transition
- Le serveur Lumina signe toujours avec le secret actif actuel
- La rotation est déclenchée via `PUT /subscriptions/{subId}/rotate-secret` → retourne un nouveau secret avec une période de grace de 24h

---

## 6. REGISTRE DES TYPES D'EVENEMENTS

### 6.1 Liste Complète des Domain Events (DOC-014) et Statut de Subscription

Tous les evenements definis dans **DOC-014** sont listés ci-dessous avec leur statut de subscription webhook :

| # | Event Name | Aggregate | Webhook Subscription | Tombstone? |
|---|-----------|-----------|---------------------|------------|
| 1 | OrganizationCreated | Organization | ✅ Enable | No |
| 2 | OrganizationSuspended | Organization | ✅ Enable | No |
| 3 | OrganizationArchived | Organization | ✅ Enable | No |
| 4 | OrgUnitCreated | Organization | ✅ Enable | No |
| 5 | OrgUnitParentChanged | Organization | ✅ Enable | No |
| 6 | ChildOrgTransferred | Organization | ✅ Enable | No |
| 7 | ChildOrgMerged | Organization | ✅ Enable | No |
| 8 | SettingUpdated | Organization | ✅ Enable | No |
| 9 | UserCreated | Identity | ✅ Enable | No |
| 10 | UserUpdated | Identity | ✅ Enable | No |
| 11 | UserRoleChanged | Identity | ✅ Enable | No |
| 12 | PasswordResetRequested | Identity | ✅ Enable | No |
| 13 | UserLoggedIn | Identity | ✅ Enable | No |
| 14 | UserLoggedOut | Identity | ✅ Enable | No |
| 15 | SessionCreated | Identity | ✅ Enable | No |
| 16 | SessionExpired | Identity | ❌ Internal only | N/A |
| 17 | SessionRevoked | Identity | ✅ Enable | No |
| 18 | ResourceCreated | Resource | ✅ Enable | No |
| 19 | ResourceUpdated | Resource | ✅ Enable | No |
| 20 | ResourceStateChanged | Resource | ✅ Enable | No |
| 21 | ResourceDeleted | Resource | ✅ Enable | Yes (tombstone) |
| 22 | TransactionCompensated | Resource | ✅ Enable | No |
| 23 | ApprovalRequested | Resource | ✅ Enable | No |
| 24 | ApprovalGranted | Resource | ✅ Enable | No |
| 25 | ApprovalRejected | Resource | ✅ Enable | No |
| 26 | MemberJoinedGroup | Relationship | ✅ Enable | No |
| 27 | MemberLeftGroup | Relationship | ✅ Enable | No |
| 28 | OrgUnitReparented | Relationship | ✅ Enable | No |
| 29 | ChildOrgTransferred | Relationship | ✅ Enable | No |
| 30 | ChildOrgMerged | Relationship | ✅ Enable | No |
| 31 | DescendantEnumerationRequested | Relationship | ✅ Enable | No |
| 32 | WorkflowTriggered | Workflow | ✅ Enable | No |
| 33 | StepExecuted | Workflow | ❌ Internal only | N/A |
| 34 | StepApproved | Workflow | ✅ Enable | No |
| 35 | StepRejected | Workflow | ✅ Enable | No |
| 36 | StepEscalated | Workflow | ✅ Enable | No |
| 37 | WorkflowCompleted | Workflow | ✅ Enable | No |
| 38 | WorkflowFailed | Workflow | ✅ Enable | No |
| 39 | WorkflowCancelled | Workflow | ✅ Enable | No |
| 40 | FormSubmitted | Form | ✅ Enable | No |
| 41 | FormValidationFailed | Form | ✅ Enable | No |
| 42 | FormSubmittedForApproval | Form | ✅ Enable | No |
| 43 | NotificationQueued | Notification | ✅ Enable | No |
| 44 | NotificationSent | Notification | ✅ Enable | No |
| 45 | NotificationFailed | Notification | ✅ Enable | No |
| 46 | NotificationMarkedRead | Notification | ✅ Enable | No |
| 47 | PreferencesUpdated | Notification | ✅ Enable | No |
| 48 | TermAdded | Vocabulary | ✅ Enable | No |
| 49 | TermValueDeprecated | Vocabulary | ✅ Enable | No |
| 50 | TranslationResolved | Vocabulary | ❌ Internal only | N/A |
| 51 | ReportGenerated | Reporting | ✅ Enable | No |
| 52 | ReportExported | Reporting | ✅ Enable | No |
| 53 | BalanceCalculated | Reporting | ✅ Enable | No |
| 54 | ActionLogged | Audit | ❌ Internal only | N/A |
| 55 | ResourceArchived | Lifecycle | ✅ Enable | No |
| 56 | ResourceTrashed | Lifecycle | ✅ Enable | No |
| 57 | ResourcePurged | Lifecycle | ✅ Enable | Yes (tombstone) |
| 58 | ResourceRestoredFromTrash | Lifecycle | ✅ Enable | No |
| 59 | PurgeScheduled | Lifecycle | ✅ Enable | No |
| 60 | SyncStarted | OfflineSync | ✅ Enable | No |
| 61 | BatchPushed | OfflineSync | ✅ Enable | No |
| 62 | DeltaReceived | OfflineSync | ✅ Enable | No |
| 63 | ConflictDetected | OfflineSync | ✅ Enable | No |
| 64 | ConflictResolved | OfflineSync | ✅ Enable | No |
| 65 | SyncCompleted | OfflineSync | ✅ Enable | No |
| 66 | ConnectionLost | OfflineSync | ✅ Enable | No |
| 67 | ConnectionRestored | OfflineSync | ✅ Enable | No |

**Total : 67 Domain Events definis dans DOC-014**
- **58 subscribable via webhook** (✅)
- **4 internal-only events** (❌) : SessionExpired, StepExecuted, TranslationResolved, ActionLogged

### 6.2 Raisons de la Restriction Internal-Only

Les evenements marqués ❌ internal-only ne sont pas subscribable pour les raisons suivantes :

| Event | Raison |
|-------|--------|
| **SessionExpired** | Volume extremement éleve (chaque session expiree = un event). Trop de bruit pour les consumers externes. Detection via heartbeat API est preferable. |
| **StepExecuted** | Evenement informatif seul (step auto-type execute). Apporte peu de valeur hors du systeme WorkflowAggregate. |
| **TranslationResolved** | Event informationnel du VocabularyAggregate. Résultat de lecture seule, pas de mutation sous-jacente. |
| **ActionLogged** | Evenement du AuditAggregate — lui-même est append-only. Logguer des logs d'audit en webhook créerait une boucle infinie de logs. |

### 6.3 Payload Tombstone pour les Events DELETE

Quand un evenements de suppression (ResourceDeleted, ResourcePurged) est publie via webhook, le champ `data` contient un tombstone — un objet minimal representant l'entité supprimée, pas son contenu complet :

```json
{
  "specversion": "1.0",
  "type": "lumina.resource.deleted",
  "data": {
    "resource_id": "c3d4e5f6-...",
    "resource_type": "transaction",
    "org_id": "a1b2c3d4-...",
    "deleted_at": "2026-07-25T10:00:00Z",
    "deleted_by": "uuid"
  }
}
```

Le tombstone ne contient AUCUN data metier sensible — seulement les identifiants et l'horodatage de suppression.

---

## 7. SANTE ET MONITORING DES WEBHOOKS

### 7.1 Health Check Periodic

Le Webhook Manager effectue un ping périodique vers chaque endpoint webhook enregistre :

| Parametre | Valeur |
|-----------|--------|
| **Fréquence** | Toutes les 5 minutes |
| **Méthode** | HTTP GET sur le webhook_url (endpoint doit retourner 200 OK) |
| **Timeout** | 10 secondes |
| **Payload** | Requète GET simple (pas de body) — head-check |

Le consumer peut implementer un endpoint health check dédié (ex: `GET https://example.com/webhook/lumina/health`) qui retourne `{"status": "ok", "last_event_received": "2026-07-25T10:30:00Z"}`.

### 7.2 Seuil de Dégradation

| Seuil | Comportement |
|-------|-------------|
| **N consecutive failures = 3** | Webhook marque comme `degraded` — nouveau evenements continuent d'être enqueue mais la delivery est ralentie à 1/min |
| **N consecutive failures = 10** | Webhook marque comme `offline` — les evenements continuent d'être enqueue mais AUCUNE tentative de delivery active. Meme les retries s'arrêtent. |
| **N successful pings = 3** | Retour à l'état `active` — retry normal reprend |

### 7.3 Comportement des Evenements Enqueue en Mode Degraded/Offline

| État | Queue Behavior |
|------|---------------|
| **Active** | Delivery immédiate au premier essai |
| **Degraded** | Delivery avec delay de 1 minute entre tentatives |
| **Offline** | Evenements continuent d'etre enqueue (la file ne se remplit pas indefiniment — max 1000 entries, oldest evicted) |

Quand un webhook repasse à `active`, les evenements enqueue pendant la periode degradee/offline sont livrés en priorité.

### 7.4 Monitoring et Alertes

Le Webhook Manager consigne automatiquement dans l'AuditAggregate :

- Nombre de deliveries ratees par subscription
- Temps moyen de livraison (entre emission event et reception confirmée)
- Nombre d'evenements en attente dans la queue dead-letter
- Statut de sante actuel de chaque subscription (active, degraded, offline)

Les alertes peuvent etre configurees via :
1. Le channel email du consumer (contact_email dans metadata)
2. Un webhook callback vers `delivery_status_callback` si specifié
3. Via `lumina notifications send` programmé par le systeme (NOT-001 trigger)

### 7.5 Endpoints de Monitoring

Bien que l'implémentation exacte soit protocol-agnostique, les endpoints suivants permettent de vérifier la sante des webhooks :

| Operation | Aggregate Equivalent | Description |
|-----------|-------------------|-------------|
| `lumina health webhooks` | Query pattern | Status de toutes les subscriptions webhook |
| `lumina health webhooks <sub-id>` | Query pattern | Details d'une subscription spécifique |
| `lumina audit list --type webhook_delivery` | QueryAuditLogs | Historique de livraison webhook |

---

## 8. MATRICE DE TRACABILITE

Chaque section de PROTO-006 est tracable vers les documents sources canoniques :

| Section PROTO-006 | Document Source | Reference Exacte |
|-------------------|----------------|-----------------|
| Header / Principes | PROTO-001 §4.1.5 | Webhook Adapter Parser |
| W-001 | ASS-003 Step 7 | Event Publishing via EventPublicationPort |
| W-001 | PAS-001 Port-003 | EventSubscriptionPort |
| W-002 | CloudEvents Spec 1.0 | Abstraction conceptuelle |
| W-003 | DOC-014 | 67 Domain Events registry |
| W-004 | RTS-003 | RetryPolicy specification |
| W-005 | PROTO-001 §7.4 | Transparent Error Translation (adapté) |
| W-006 | AUD-001 | Immutable audit trail (dead-letter persisté) |
| §2 Format payload | API-CONTRACT-002 §2.2 | Canonical Response (events_emitted) |
| §2.2 Champ par champ | DOC-014 | Domain Event data structures |
| §2.4 Regles payload | PAS-003 DR-009 | Tenant isolation (org_id) |
| §3 Contract d'enregistrement | ASS-001 | Application Services registry |
| §3.2 Validation URL | Security Best Practice | HTTPS enforcement |
| §3.4 Rate limiting | RATE-002 invariant | Per-notification rate limit |
| §4 Retry schedule | RTS-003 | Exponential backoff with jitter |
| §4.2 Dead letter | AUD-001 | Immutable, recoverable storage |
| §4.3 Delivery logging | DOC-014 LogAction | AuditAggregate append-only |
| §5 Signature | PROTO-001 §7.4 | Cryptographic verification abstracted |
| §6 Event registry | DOC-014 | Full 67-event list with subscription status |
| §7 Health monitoring | ASS-004 | Cross-aggregate coordination for alerts |

### Couverture des Domain Events par Webhook

| Aggregate | Total Events | Subscribable | Internal-Only | Coverage % |
|-----------|-------------|-------------|--------------|------------|
| OrganizationAggregate | 8 | 8 | 0 | 100% |
| IdentityAggregate | 9 | 8 | 1 | 89% |
| ResourceAggregate | 8 | 8 | 0 | 100% |
| RelationshipAggregate | 6 | 6 | 0 | 100% |
| WorkflowAggregate | 8 | 6 | 2 | 75% |
| FormAggregate | 3 | 3 | 0 | 100% |
| NotificationAggregate | 5 | 5 | 0 | 100% |
| VocabularyAggregate | 3 | 2 | 1 | 67% |
| ReportingAggregate | 3 | 3 | 0 | 100% |
| AuditAggregate | 1 | 0 | 1 | 0% |
| LifecycleAggregate | 5 | 5 | 0 | 100% |
| OfflineSyncAggregate | 7 | 7 | 0 | 100% |
| **TOTAL** | **67** | **58** | **9** | **87%** |

Note : Les 9 evenements non-subscribable sont TOUS des evenements internes du systeme (audit logs, session management, translation resolution, internal step execution) dont le volume ou la nature rendrait la publication webhook non-appropriée.

---

**FIN DU DOCUMENT PROTO-006**

---

## ANNEXE A: Tableau de Correspondance Event Type → Webhook type Field

Format complet du `type` field pour chaque evenements subscribable :

| Event DOC-014 | Webhook type field |
|--------------|-------------------|
| OrganizationCreated | `lumina.organization.created` |
| OrganizationSuspended | `lumina.organization.suspended` |
| OrganizationArchived | `lumina.organization.archived` |
| OrgUnitCreated | `lumina.organization.org-unit.created` |
| OrgUnitParentChanged | `lumina.organization.org-unit.parent-changed` |
| ChildOrgTransferred | `lumina.organization.child-transferred` |
| ChildOrgMerged | `lumina.organization.merged` |
| SettingUpdated | `lumina.organization.setting-updated` |
| UserCreated | `lumina.identity.user-created` |
| UserUpdated | `lumina.identity.user-updated` |
| UserRoleChanged | `lumina.identity.user-role-changed` |
| PasswordResetRequested | `lumina.identity.password-reset` |
| UserLoggedIn | `lumina.identity.user-logged-in` |
| UserLoggedOut | `lumina.identity.user-logged-out` |
| SessionCreated | `lumina.identity.session-created` |
| SessionRevoked | `lumina.identity.session-revoked` |
| ResourceCreated | `lumina.resource.created` |
| ResourceUpdated | `lumina.resource.updated` |
| ResourceStateChanged | `lumina.resource.state-changed` |
| ResourceDeleted | `lumina.resource.deleted` |
| TransactionCompensated | `lumina.resource.compensated` |
| ApprovalRequested | `lumina.resource.approval-requested` |
| ApprovalGranted | `lumina.resource.approval-granted` |
| ApprovalRejected | `lumina.resource.approval-rejected` |
| MemberJoinedGroup | `lumina.relationship.member-joined` |
| MemberLeftGroup | `lumina.relationship.member-left` |
| OrgUnitReparented | `lumina.relationship.unit-reparented` |
| ChildOrgTransferred | `lumina.relationship.child-transferred` |
| ChildOrgMerged | `lumina.relationship.child-merged` |
| DescendantEnumerationRequested | `lumina.relationship.descendants-enumerated` |
| WorkflowTriggered | `lumina.workflow.triggered` |
| StepApproved | `lumina.workflow.step-approved` |
| StepRejected | `lumina.workflow.step-rejected` |
| StepEscalated | `lumina.workflow.step-escalated` |
| WorkflowCompleted | `lumina.workflow.completed` |
| WorkflowFailed | `lumina.workflow.failed` |
| WorkflowCancelled | `lumina.workflow.cancelled` |
| FormSubmitted | `lumina.form.submitted` |
| FormValidationFailed | `lumina.form.validation-failed` |
| FormSubmittedForApproval | `lumina.form.submitted-for-approval` |
| NotificationQueued | `lumina.notification.queued` |
| NotificationSent | `lumina.notification.sent` |
| NotificationFailed | `lumina.notification.failed` |
| NotificationMarkedRead | `lumina.notification.marked-read` |
| PreferencesUpdated | `lumina.notification.preferences-updated` |
| TermAdded | `lumina.vocab.term-added` |
| TermValueDeprecated | `lumina.vocab.term-deprecated` |
| ReportGenerated | `lumina.reporting.report-generated` |
| ReportExported | `lumina.reporting.report-exported` |
| BalanceCalculated | `lumina.reporting.balance-calculated` |
| ResourceArchived | `lumina.lifecycle.resource-archived` |
| ResourceTrashed | `lumina.lifecycle.resource-trashed` |
| ResourcePurged | `lumina.lifecycle.resource-purged` |
| ResourceRestoredFromTrash | `lumina.lifecycle.resource-restored` |
| PurgeScheduled | `lumina.lifecycle.purge-scheduled` |
| SyncStarted | `lumina.sync.started` |
| BatchPushed | `lumina.sync.batch-pushed` |
| DeltaReceived | `lumina.sync.delta-received` |
| ConflictDetected | `lumina.sync.conflict-detected` |
| ConflictResolved | `lumina.sync.conflict-resolved` |
| SyncCompleted | `lumina.sync.completed` |
| ConnectionLost | `lumina.sync.connection-lost` |
| ConnectionRestored | `lumina.sync.connection-restored` |

---

**FIN DU DOCUMENT PROTO-006**
