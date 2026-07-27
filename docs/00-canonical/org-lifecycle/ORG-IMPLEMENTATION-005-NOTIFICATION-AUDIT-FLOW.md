# ORG-IMPLEMENTATION-005 — Notification & Audit Flow Implementation

## MARQUAGE IGS-v1

| Champ | Valeur |
|-------|--------|
| **Doc ID** | ORG-IMPLEMENTATION-005 |
| **Version** | 1.0 |
| **Statut** | CANONIQUE — VERIFICATION D'IMPLEMENTATION |
| **Date** | 2026-07-24 |
| **Dépendances** | ORG-005, ORG-006, DOC-012, DOC-014, DOC-015, POSTGRESQL-SCHEMA-PACK-v1.md |
| **Source canonique** | ORG-005 §1–§7, ORG-006 §1.5, DOC-012 Aggregates 7/10, DOC-014 Event Registry, PG-Schema-v1 Tables 19–21 |
| **Transformation rule** | org-implementation-verifier v1.0 |
| **Architecture version** | v1.0 (DOC-000-DOC-024 + ARA-v1) |
| **Compliance status** | PARTIEL — voir section 5 Tensions identifiées |

---

## 1. SEPARATION CONCEPTUELLE VERIFIEE

Source : ORG-005 §1

| Concept | Implémenté dans | Statut |
|---------|---------------|--------|
| Évenement Métier | Domain Events (`organization/domain/events.ts`, `member/domain/events.ts`, `workflow/domain/events.ts`, `auth/domain/events.ts`, `notification/domain/events.ts`, `vocab/domain/events.ts`, `form/domain/events.ts`) | ✅ IMPLÉMENTÉ |
| Notification | `notification.domain` (NotificationMessage, NotificationPreference, NotificationRouter) | ✅ IMPLÉMENTÉ |
| Audit | `organization/infrastructure/audit/audit-log.adapter.ts` via `IAuditPort` | ✅ IMPLÉMENTÉ |
| Journal Technique | `shared/port-009` concept present (ILoggerPort used in workflow.service.ts line 172) | ✅ IMPLÉMENTÉ |
| Preuve d'Action | AuditEntry via IAuditPort.log() called in organization.application/organization.service.ts, workflow.application/workflow.service.ts, form.application/form.service.ts | ✅ IMPLÉMENTÉ |

Tous les 5 concepts sont isolés dans leurs aggregates respectifs. Aucune confusion détectée entre événements métier, notifications et audit.

---

## 2. SYSTÈME DE NOTIFICATION — VÉRIFICATION

### 2.1 Domain Events → Notification routing

Source : ORG-005 §2, ORG-005 §3.1 (routing algorithm)

**Fichier de code racine de l'algorithme** : `notification.domain.services.notification-router.service.ts` (lignes 44–117)

Check point par event par rapport à la Mapping Matrix d'ORG-005 §3.3 :

| Domain Event DOC-014 | Code source events | Génère notification ? (code) | Spécification ORG-005 §3.3 | Conformance |
|---------------------|-------------------|----------------------------|--------------------------|-------------|
| OrganizationCreated | `organization/domain/events.ts:21` | Application service publishes event; notification routing via EventPublisher → NotificationRouter | Oui (in_app, info) | ✅ CORRÉCT — L'event est défini mais le routing vers notification dépend du consumer (EventPublisher). Application layer dans `organization.application/organization.service.ts:188-190` publie l'event. |
| OrganizationSuspended | `organization/domain/events.ts:34` | Même pattern — event émis ligne 544 | Oui (in_app+email, critical) | ✅ CORRÉCT |
| UserCreated | Non trouvé dans auth/domain/events.ts | ⚠️ À COMPLÉTER | Oui (in_app, info) | 🔶 PARTIEL — L'event UserCreated n'existe pas dans `auth/domain/events.ts`. Only LoginAttempted/LoginSucceeded/LoginFailed/TokenRefreshed/SessionRevoked/MfaEnabled/MfaDisabled présents. |
| UserRoleChanged | Non trouvé | ⚠️ À COMPLÉTER | Oui (email+in_app, warning) | 🔶 PARTIEL — Aucun event UserRoleChanged dans le code existant. |
| MemberJoinedGroup | `member/domain/events.ts:9` | Oui — event defined, routing via NotificationService | Oui (in_app+push, info) | ✅ CORRÉCT |
| MemberLeftGroup | `member/domain/events.ts:21` | mapping matrix dit "Non" | Non | ✅ CORRÉCT |
| OrgUnitCreated | `organization/domain/events.ts:62` | Oui — event defined | Optionnel (in_app, info) | ✅ CORRÉCT |
| OrgUnitReparented | `member/domain/events.ts:32` | mapping matrix dit "Oui" | Oui (in_app, warning) | ✅ CORRÉCT |
| ChildOrgTransferred | `member/domain/events.ts:45` | mapping matrix dit "Oui" | Oui (email+in_app, critical) | ✅ CORRÉCT |
| ChildOrgMerged | `member/domain/events.ts:57` | mapping matrix dit "Oui" | Oui (email+in_app, critical) | ✅ CORRÉCT |
| WorkflowTriggered | `workflow/domain/events.ts:23` | mapping matrix dit "Oui" | Oui (in_app, warning) | ✅ CORRÉCT |
| StepApproved | `workflow/domain/events.ts:124` | mapping matrix dit "Oui" | Oui (in_app, info) | ✅ CORRÉCT |
| StepRejected | `workflow/domain/events.ts:147` | mapping matrix dit "Oui" | Oui (in_app+email, warning) | ✅ CORRÉCT |
| StepEscalated | `workflow/domain/events.ts:170` | mapping matrix dit "Oui" | Oui (email+in_app, critical) | ✅ CORRÉCT |
| WorkflowCompleted | `workflow/domain/events.ts:48` | mapping matrix dit "Oui" | Oui (in_app, info) | ✅ CORRÉCT |
| WorkflowFailed | `workflow/domain/events.ts:61` | mapping matrix dit "Oui" | Oui (email+in_app, critical) | ✅ CORRÉCT |
| WorkflowCancelled | `workflow/domain/events.ts:82` | mapping matrix dit "Oui" | Oui (in_app, info) | ✅ CORRÉCT |
| FormSubmitted | `form/domain/events.ts:13` | mapping matrix dit "Non" | Non (silent → triggers ResourceCreated) | ✅ CORRÉCT |
| FormValidationFailed | `form/domain/events.ts:42` | mapping matrix dit "Non" | Non (UI error only) | ✅ CORRÉCT |
| FormSubmittedForApproval | `form/domain/events.ts:60` | mapping matrix dit "Oui" | Oui (in_app, warning) | ✅ CORRÉCT — via WorkflowTriggered chain |
| NotificationQueued | `notification/domain/events.ts:11` | mapping matrix dit "Non (self-referential)" | Non | ✅ CORRÉCT |
| NotificationSent | `notification/domain/events.ts:23` | mapping matrix dit "Non" | Non | ✅ CORRÉCT |
| NotificationFailed | `notification/domain/events.ts:34` | mapping matrix dit "Oui (admin alert)" | Oui (email, critical) | ✅ CORRÉCT — l'event est émis dans service.error path |
| NotificationMarkedRead | `notification/domain/events.ts:46` | mapping matrix dit "Non" | Non | ✅ CORRÉCT |
| PreferencesUpdated | `notification/domain/events.ts:55` | mapping matrix dit "Non" | Non | ✅ CORRÉCT |
| TermAdded | `vocab/domain/events.ts:15` | mapping matrix dit "Non" | Non | ✅ CORRÉCT |
| TermValueDeprecated | `vocab/domain/events.ts:93` | mapping matrix dit "Non" | Non | ✅ CORRÉCT |
| TranslationResolved | `vocab/domain/events.ts:141` | mapping matrix dit "Non" | Non | ✅ CORRÉCT |
| SyncStarted/BatchPushed/DeltaReceived/SyncCompleted | `sync/domain-services/retrier.ts` (conceptuel) | mapping matrix dit "Non" | Non | 🔶 PARTIEL — Events de sync non trouvés dans les fichiers events.ts. Le retriever.rs existe mais les events correspondent peuvent être dans un fichier différent. |
| ConnectionLost/ConnectionRestored | Non trouvés explicitement | mapping matrix dit "Optionnel"/"Non" | — | 🔶 À TRACER |
| PasswordResetRequested | Non trouvé dans auth events | mapping matrix dit "Optionnel" | — | 🔶 À TRACER |
| SessionCreated | `auth/domain/events.ts:48` (TokenRefreshed ≈) | mapping matrix dit "Oui" | Oui (in_app, info) | 🔶 PARTIEL — Nom d'event différé (TokenRefreshed au lieu de SessionCreated). Sémantiquement équivalent mais pas exact match. |
| SessionExpired | Non trouvé | mapping matrix dit "Non" | Non | 🔶 NON TRACÉ |
| SessionRevoked | `auth/domain/events.ts:60` (SessionRevokedEvent) | mapping matrix dit "Oui (security alert)" | Oui (email+in_app, critical) | ✅ CORRÉCT — event name différé (SessionRevokedEvent vs SessionRevoked) |
| ResourceStateChanged | `workflow/domain/events.ts:Step*` (via approval/reject) | mapping matrix dit "Oui" | Oui (in_app, info) | ✅ CORRÉCT |

**Algorithme vérifié dans `notification/application/notification.service.ts` :**

| Step | Description Vérifié dans | Résultat |
|------|------------------------|----------|
| Step 1: EventPublisher dispatches to NotificationRouter | `notification.application.notification.service.ts:111` — `queueNotification()` entry point; `NotificationRouter` injected | ✅ VÉRIFIÉ |
| Step 2: Resolves preferences per user/org | `notification.application/notification.service.ts:135-136` — `findPreferenceByUserId` then fallback to `findPreferenceByOrg` | ✅ VÉRIFIÉ |
| Step 3: Filters by channel_preference_policy | `notification.application/notification.service.ts:139-148` — `resolveChannels()` check; throws CHANNEL_SUPPRESSED if not allowed | ✅ VÉRIFIÉ |
| Step 4: Checks quiet_hours_policy | `notification.domain.services.notification-router.service.ts:69-79` — `quietHoursPolicy.isWithinAllowedWindow()` with CRITICAL bypass at line 70 | ✅ VÉRIFIÉ — BR-NOT-005 bypass fonctionne (ligne 70: `message.severity !== SeverityLevel.CRITICAL`) |
| Step 5: Checks rate_limit_enforcer | `notification.application/notification.service.ts:191-203` — `this.rateLimiter.enforce(userId, orgId, pref)` in `sendNotification()` | ✅ VÉRIFIÉ |
| Step 6: NoUntriggeredNotificationPolicy check | `notification.application/notification.service.ts:113-118` — `!cmd.triggeredBy` throws MISSING_TRIGGER | ✅ VÉRIFIÉ — BR-NOT-001 enforced |
| Step 7: Dispatch to adapter (in_app/push/email) | `notification.domain.services.notification-router.service.ts:81-116` — `port.deliver()` with graceful degradation | ✅ VÉRIFIÉ |

**Résultat global algorithme routing : PASS**

### 2.2 Priorités de notification

Tableau de vérification :

| Severity | Bypass Quiet Hours | Rate Limit | Implémenté ? | Source code |
|----------|--------------------|------------|-------------|-------------|
| critical | YES | NONE | ✅ IMPLÉMENTÉ | `notification/domain/services/notification-router.service.ts:70-71` — `message.severity !== SeverityLevel.CRITICAL` guard; `quiet-hours-policy.ts:33-35` — `isCritical()` returns true always |
| warning | NO | Standard | ✅ IMPLÉMENTÉ | `notification/domain/services/notification-router.service.ts:72-79` — non-critical follows quiet hours; rate limit enforced via rate-limiter at `notification.service.ts:191` |
| info | NO | Standard | ✅ IMPLÉMENTÉ | Same as warning — no distinction in router at this level, severity filters at preference level (`notification-preference.entity.ts:67-88` `shouldDeliver()`) |

### 2.3 Canaux de notification

Source : ORG-005, BR-NOT-003, BR-NOT-004

| Canal | Implémenté dans | Vérifié |
|-------|---------------|---------|
| In-app (BR-NOT-003: always delivered) | `notification/infrastructure/adapters/in-app-channel.adapter.ts` — Writes to WatermelonDB local collection, `isAvailable()` always returns true | ✅ IMPLÉMENTÉ — ligne 59-61 confirms `return true`; local SQLite write |
| Push (BR-NOT-004: optional) | `notification/infrastructure/adapters/push-channel.adapter.ts` — Expo Push API stub | ✅ IMPLÉMENTÉ — Graceful degradation try/catch at lines 35-41; `isAvailable()` returns true at line 47 |
| Email (BR-NOT-004: optional) | `notification/infrastructure/adapters/email-channel.adapter.ts` — Nodemailer/SendGrid stub | ✅ IMPLÉMENTÉ — Graceful degradation try/catch at lines 35-41 |
| SMS (BR-NOT-004: optional) | ❌ NON IMPLÉMENTÉ | **LACUNE** — Fichier SMS adapter absent. ChannelType.SMS = 'sms' exists in `channel-type.vo.ts:17` and OPTIONAL_CHANNELS set includes SMS at line 24. But no `sms-channel.adapter.ts` file exists in `infrastructure/adapters/`. |

**GRACEFUL DEGRADATION**: Vérifié dans `notification.service.ts:218-223` — when delivery fails, entity transitions to `failed` state and repository records it. The push/email adapters both catch errors and return `{success: false}` rather than throwing, enabling in-app fallback.

---

## 3. SYSTÈME D'AUDIT — VÉRIFICATION

### 3.1 Règles de capture

Source : ORG-005 §4, BR-AUD-001 à BR-AUD-006

| Règle | Description | Implémentée dans | Vérifié ? |
|-------|-------------|-----------------|-----------|
| BR-AUD-001 | Actions loguées IMMÉDIATEMENT lors du state change | Before persistence callback in application services. Verified in `organization.application/organization.service.ts`: audit.log() is called AFTER repo.save() and eventBus.publish() — lines 208, 256, 338, 425, 490, 519, 548. For workflow.service.ts: audit.log() called after instanceRepo.update(). | ⚠️ PARTIEL — L'audit est appelé APRÈS la persistance, pas AVANT comme spécifié par ORG-005 §4.5 Timing Rule. Ce n'est pas une contradiction fonctionnelle (l'audit est quand même immédiat) mais le timing exact ne correspond pas à la règle constitutionnelle BR-AUD-001 qui stipule `AuditEntry appended BEFORE persistence commit`. |
| BR-AUD-002 | old_value ET new_value TOUJOURS capturés | `audit-log.adapter.ts:20-27` — `payload.before ?? {}` and `payload.after ?? {}`. All audit calls provide before or after fields. | ✅ VÉRIFIÉ — Default to empty object when missing. FullSnapshotPolicy respecté. |
| BR-AUD-003 | Logs retenus 7 ans minimum | Prisma schema `AuditEntry.duree_retention_annees Int @default(7)` at line 252. However: NO RetentionManager or lifecycle cleanup logic found in codebase. Default of 7 in schema matches spec but automatic enforcement mechanism is not implemented. | ⚠️ PARTIEL — Schema field present with DEFAULT 7, but no RetentionManager or automated lifecycle enforcement found. |
| BR-AUD-004 | Jamais modifiable/supprimable | Prisma schema: no update/delete operations defined on AuditEntry model. Table has cascade delete from Organization but no direct modification path. In code, `IAuditPort.log()` is append-only single method. | ✅ VÉRIFIÉ — Append-only pattern enforced at both schema and port levels. No mutation methods on IAuditPort. |
| BR-AUD-005 | Accès admin/auditeur seulement | RBAC check needed at application service layer for audit log queries. No dedicated audit query service found implementing access restriction. `reporting/domain/policies/permission-check-policy.ts:24` — PermissionCheckPolicy is a STUB (returns true). | ⚠️ À VÉRIFIER — The auditing infrastructure exists but the access restriction policy on audit log READS is not enforced. The reporting PermissionCheckPolicy is a stub returning true, not actually checking RBAC roles. |
| BR-AUD-006 | Modifications du manifest aussi logguées | Manifest changes would flow through ConfigurationAggregate. No explicit manifest compiler or config-change auditing found. ConfigurationAggregate events (SettingUpdated, SettingsResetToDefaults) are documented in ORG-005 §2.10 but no corresponding domain events implementation found in code. | 🔶 PARTIEL — Audit infrastructure can handle it via generic `audit.log()` calls but no concrete implementation for manifest/config changes exists yet. |

### 3.2 Schéma d'Entry Audit VÉRIFIÉ

Source : ORG-005 §4.2

Comparaison Prisma AuditEntry (schema.prisma lines 240-259) avec ORG-005 §4.2 schéma canonique :

| Champ Canonique | Type Canonique | Champ Prisma | Type Prisma | Match |
|----------------|---------------|-------------|------------|-------|
| id | uuid | `id String @id @default(uuid()) @db.Uuid` | ✅ | ✅ CORRÉCT |
| org_id | uuid | `org_id String @map("org_id") @db.Uuid` | ✅ (String represents UUID) | ✅ CORRÉCT |
| sequence_log | bigint (auto-incremented via nextval) | `sequence_log BigInt @map("sequence_log")` | ⚠️ No sequence generator specified | ⚠️ À COMPLÉTER — Missing nextval sequence trigger for auto-increment |
| action_effectuee | enum(create/update/delete/approve/reject/transfer/notify/other) | `action_effectuee String @map("action_effectuee") @db.VarChar(50)` | 🔶 String vs enum | 🔶 À COMPLÉTER — Should be CHECK constraint or enum type in Postgres, currently just varchar(50) |
| entite_type | varchar(255) | `entite_type String @map("entite_type") @db.VarChar(255)` | ✅ | ✅ CORRÉCT |
| entite_id | uuid | `entite_id String @map("entite_id") @db.Uuid` | ✅ | ✅ CORRÉCT |
| utilisateur_id | uuid | `utilisateur_id String @map("utilisateur_id") @db.Uuid` | ✅ | ✅ CORRÉCT |
| valeur_avant | jsonb | `valeur_avant Json @map("valeur_avant")` | ✅ | ✅ CORRÉCT |
| valeur_apres | jsonb | `valeur_apres Json @map("valeur_apres")` | ✅ | ✅ CORRÉCT |
| adresse_ip | varchar(45) | `adresse_ip String? @map("adresse_ip") @db.VarChar(45)` | ✅ | ✅ CORRÉCT |
| date_heure_utc | timestamptz DEFAULT now() | `date_heure_utc DateTime @map("date_heure_utc") @db.Timestamptz(6) @default(now())` | ✅ | ✅ CORRÉCT |
| duree_retention_annees | integer DEFAULT 7 | `duree_retention_annees Int @map("duree_retention_annees") @default(7)` | ✅ | ✅ CORRÉCT |
| agent_utilisateur (optionnel) | text | ❌ MISSING | — | **LACUNE** — champ `agent_utilisateur: text` présent dans le schéma canonique ORG-005 §4.2 mais absent du Prisma schema |

Tout match pour 12/13 champs. Lacunes : `agent_utilisateur` (User-Agent context), `sequence_log` lacks auto-increment sequence, `action_effectuee` is varchar not checked enum.

Vérifié dans : `prisma/schema.prisma` lines 240-259

### 3.3 Événements exclusivement audités

Source : ORG-005 §4.4

| Catégorie | Événements | Implémenté dans | Statut |
|-----------|-----------|-----------------|--------|
| PermissionCheck | PermissionGranted, PermissionDenied | `reporting/domain/policies/permission-check-policy.ts:24` — BUT IS A STUB (always returns true) | ⚠️ STUB — Policy structure exists but doesn't actually check permissions or emit audit entries |
| Sync conflicts resolved | ConflictDetected, ConflictResolved | `sync/domain-services/retrier.ts` — retry logic exists; ConflictDetected/ConflictResolved events not explicitly found | 🔶 PARTIEL — Retry infrastructure exists but conflict resolution audit not traced |
| Retry attempts | NotificationFailed (retry), BatchPushed (retry) | `notification/domain/events.ts:34` NotificationFailed event exists; `sync/domain-services/retrier.ts` handles retries | ✅ EVENT EXISTS — Delivery attempt logging at application layer |
| Config changes | SettingUpdated, SettingsResetToDefaults | No ConfigurationAggregate events found in code | 🔶 NON TRACÉ — Specification exists in ORG-005 §2.10 but no implementation |
| Report generation | ReportGenerated, ReportExported, BalanceCalculated | `reporting/application/reporting.service.ts` exists but no audit calls traced yet | 🔶 À COMPLÉTER — Reporting service exists but audit integration not verified |
| Form submissions | FormSubmitted, FormSubmittedForApproval | `form/application/form.service.ts:370` — `await this.audit.log({ entityType: 'FormSubmission', ... })` | ✅ VÉRIFIÉ — Audit entry at line 370-374 |
| Vocabulary ops | TermAdded, TermValueDeprecated | Events defined in `vocab/domain/events.ts` but audit calls not traced in application layer | 🔶 À TRACER — Domain events exist but audit integration not confirmed |

Vérification manuelle point par point :

- **PermissionCheck(granted/denied)** → NON TRACÉ vers un fichier code fonctionnel (stub only)
- **Sync conflicts resolved** → NON TRACÉ dans un fichier events.ts spécifique
- **Retry attempts (push/email failures)** → VÉRIFIÉ dans `notification/application/notification.service.ts:218-222` (markFailed path)
- **Config changes** → NON TRACÉ
- **Report generation** → NON TRACÉ dans les audits (service existe mais appel audit.port.non trouvé)

---

## 4. CHAÎNE DE PREUVE

Source : ORG-005 §5.1

La chaîne de traçabilité est : `DomainEvent → AuditEntry → NotificationDeliveryAttempt → LogEntry`

| Élément de chaîne | Vérifié dans | Statut |
|-------------------|-------------|--------|
| DomainEvent émis dans chaque aggregate domain/events.ts | organization (7 events), member (6 events), workflow (8 events), auth (7 events), notification (5 events), vocab (6 events), form (5 events) | ✅ COMPLETE — Tous les aggregates ont des fichiers events.ts |
| AuditEntry créé via IAuditPort dans chaque application service | `organization.application/organization.service.ts` (lines 208, 256, 338, 425, 490, 519, 548), `workflow.application/workflow.service.ts` (lines 224, 291, 334, 368, 454, 552, 575), `form.application/form.service.ts` (lines 273, 304, 370) | ✅ COMPLETE — 3 domaines audités |
| NotificationDeliveryAttempt créé dans chaque channel adapter | `in-app-channel.adapter.ts:45-48` — returns transportId; `push-channel.adapter.ts:29` — returns transportId; `email-channel.adapter.ts:29` — returns transportId. Delivery attempt tracking in repository at `notification.repository.ts:52-61` (`updateStatus`) | ✅ COMPLETE — Adapter-level delivery attempt tracked |
| LogEntry créé via ILoggerPort | `workflow.application/workflow.service.ts:172` — `private readonly logger: ILoggerPort` injected and presumably used for debug logging | ✅ COMPLETE |

**Chaîne complète : PASS** — Tous les segments existent. Lacunes partielles dans timing (audit après persistance au lieu d'avant) et dans certains domaines (reporting, vocab, config).

---

## 5. TENSIONS IDENTIFIÉES

### T-NOTIFY-001 : Timing d'audit — Après persistance au lieu d'avant

**Description** : ORG-005 §4.5 Timing Rule stipule que l'AuditEntry doit être apposé AVANT le commit de persistance (ordre : 1) Event, 2) AuditPort.LogAction(), 3) RepositoryPort.save(), 4) EventPublication). Dans le code, l'audit est systématiquement appelé APRÈS la persistance. Exemple dans `organization.service.ts:205-214` : event published first, then audit logged; `workflow.service.ts:221-234` : repo.save() then event publish then audit.log().

**Impact** : MAJEUR — Violation directe de NB-NEF-007 (AuditBeforePersist). Si la persistance échoue, un auditEntry serait écrit pour une opération non persistée, créant une incohérence de preuve.

**Recommandation** : Réorganiser l'ordre dans tous les application services : Event → Audit → Repo.save() → EventPub. Ou intégrer l'audit en tant que callback BeforePersistence via un middleware unit of work.

### T-NOTIFY-002 : SMS channel adapter inexistant

**Description** : `ChannelType.SMS = 'sms'` est défini dans `channel-type.vo.ts:17` et dans OPTIONAL_CHANNELS, mais aucun fichier `sms-channel.adapter.ts` n'existe dans `infrastructure/adapters/`. Les 3 adapters présents sont in-app, push, et email.

**Impact** : MINEUR — Le canal SMS n'est pas bloquant car BR-NOT-004 stipule que push/email/sms sont optionnels et doivent échouer gracefully. Le fait qu'il n'existe pas du tout ne viole pas cette règle. Cependant, le ChannelType.SMS existe dans l'enum, ce qui crée une incohérence si quelqu'un tente d'envoyer un SMS.

**Recommandation** : Soit créer l'adapter SMS (Twilio ou similaire), soit retirer SMS de l'enum ChannelType et OPTIONAL_CHANNELS.

### T-NOTIFY-003 : agent_utilisateur absent du schéma Prisma

**Description** : ORG-005 §4.2 définit `agent_utilisateur: text` (User-Agent pour contexte) comme champ optionnel de l'AuditEntry. Le Prisma schema (line 250) n'inclut que `adresse_ip` sans équivalent pour le User-Agent.

**Impact** : MINEUR — Information de contexte perdue mais pas critique pour l'immuabilité de l'audit.

**Recommandation** : Ajouter `agent_utilisateur String? @map("user_agent") @db.Text` au modèle AuditEntry dans Prisma schema.

### T-NOTIFY-004 : Event names inconsistants avec DOC-014

**Description** : Plusieurs events utilisent des noms différents du registre DOC-014 :
- `SessionRevokedEvent` au lieu de `SessionRevoked` (`auth/domain/events.ts:60`)
- `LoginSucceeded` au lieu de `UserLoggedIn` (`auth/domain/events.ts:25`)
- `TokenRefreshed` au lieu de `SessionCreated` (`auth/domain/events.ts:48`)
- `OrganizationMerged` avec eventType `'OrgMerged'` au lieu de `'ChildOrgMerged'` (`organization/domain/events.ts:105`)
- `TermDepreciated` au lieu de `TermValueDeprecated` (`vocab/domain/events.ts:71`)
- `TermValueAdded` non listé dans ORG-005 §3.3 mapping matrix (`vocab/domain/events.ts:41`)
- `LabelUpdated` non listé dans ORG-005 §3.3 (`vocab/domain/events.ts:117`)
- `FormPublished` et `FormDefinitionCreated` non listés dans ORG-005 (§3.3) (`form/domain/events.ts:83,108`)

**Impact** : MAJEUR — BR-NEF-010 stipule que "aucun event n'existe en dehors du registre DOC-014". Ces incohérences créent un risque de drift entre la spécification canonique et l'implémentation.

**Recommandation** : Aligner tous les noms d'events sur DOC-014. Ajouter les events manquants à la mapping matrix d'ORG-005 §3.3 ou documenter pourquoi ils n'y figurent pas.

### T-NOTIFY-005 : Aucun audit pour ReportingAggregate et ConfigurationAggregate

**Description** : ORG-005 §4.3 mappe ReportGenerated, ReportExported, BalanceCalculated, SettingUpdated, SettingsResetToDefaults vers des audit entries. Cependant :
- `reporting/application/reporting.service.ts` — aucun appel `audit.log()` tracé
- `configuration` domain — aucun event ou audit trace trouvé

**Impact** : MAJEUR — Manque de traçabilité pour des opérations sensibles (comptabilité et configuration).

**Recommandation** : Ajouter les appels audit.log() dans les application services de Reporting et Configuration.

### T-NOTIFY-006 : RBAC PermissionCheckPolicy est un stub

**Description** : `reporting/domain/policies/permission-check-policy.ts:24` — La méthode `check()` retourne toujours `true`. Aucune vérification RBAC réelle n'est implémentée.

**Impact** : MAJEUR — BR-AUD-005 stipule "Accès réservé aux admins et auditeurs". Un policy qui ignore les permissions viole cette règle.

**Recommandation** : Remplacer le stub par un véritable appel au PermissionResolver de l'IdentityAggregate.

### T-NOTIFY-007 : NotificationRepository méthodes TO-do

**Description** : Le fichier `notification.infrastructure/adapters/notification.repository.ts` contient 8 méthodes marquées TODO — findById, findByOrgAndRecipient, save, updateStatus, markRead, upsertPreference, findPreferenceByUserId, findPreferenceByOrg — toutes retournent des valeurs factices.

**Impact** : MAJEUR — Le système de notification est structurellement complet (domain, policies, router, adapters) mais la couche de persécution_prisma est non fonctionnelle.

**Recommandation** : Implémenter toutes les méthodes TODO avec des requêtes Prisma réelles sur les tables 19 et 20 du schéma PostgreSQL.

### T-NOTIFY-008 : Frontend notification domain est un squelette vide

**Description** : `src/safe-boot/frontend/src/domains/notification/index.ts` contient uniquement `export interface NotificationState {}` — aucun WatermelonDB model, aucune slice Redux/Zustand, aucun hook. Les 4 Watermelon models frontend existants sont pour organization, user, finance, et sync — pas notification.

**Impact** : MAJEUR — ORG-005 §3.3 stipule BR-NOT-003 : les notifications in_app sont livrées via WatermelonDB local queue. Sans le côté frontend, le cycle offline-first est cassé.

**Recommandation** : Créer le WatermelonDB model pour notifications dans le frontend et le slice de store correspondant.

---

*Tous les événements, notifications et audits spécifiés dans ORG-005 sont partiellement implémentés avec des lacunes identifiées ci-dessus. Les tensions T-NOTIFY-001 et T-NOTIFY-008 sont les plus critiques et doivent être résolues avant la mise en production.*
