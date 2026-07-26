# Domain Command & Event Registry — Registre Officiel

**Doc ID:** DOC-014 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — COMMANDES ET ÉVÉNEMENTS UNIQUES  
**Date:** 2026-07-24  

---

## PRINCIPE

Un **Command** représente une INTENTION (quelque chose qui VA SE PASSER).
Un **Event** représente un FAIT PASSÉ (quelque chose qui S'EST PASSÉ).

Les Commands déclenchent des Domain Events. Les Events ne causent JAMAIS de Commands directs (sauf via autre Aggregate).

Chaque Command a: Aggregate cible, acteur autorisé, préconditions, validation, résultat.
Chaque Event a: Aggregate source, condition d'émission, données transportées, consommateurs autorisés.

---

## REGISTRE DES COMMANDS

### Commands OrganizationAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `CreateOrganization` | OrganizationAggregate | SuperAdmin | Aucun | name non vide, type enum valide, org_id auto-généré | `OrganizationCreated` |
| `UpdateOrganizationSettings` | OrganizationAggregate | Admin | Org existante | format: currency ISO 4217, timezone IANA, accent hex #RRGGBB | Setting updated + `SettingUpdated` |
| `CreateOrgUnit` | OrganizationAggregate | Admin | Org existante | name non vide, unit_type enum valide, parent si applicable, depth ≤ 5 | `OrgUnitCreated` |
| `UpdateOrgUnitParent` | OrganizationAggregate | SuperAdmin | Unité existante | NO cycle créé (topological sort), depth ≤ 5 | `OrgUnitParentChanged` |
| `TransferChildOrg` | OrganizationAggregate | SuperAdmin | Org enfant existante | nouvelle parent existe, no cycle | `ChildOrgTransferred` |
| `MergeOrganizations` | OrganizationAggregate | SuperAdmin | 2 orgs existantes | les deux dans même héritage DAG | `ChildOrgMerged` |
| `ArchiveOrganization` | OrganizationAggregate | SuperAdmin | Org existante | status change active → archived | `OrganizationArchived` |
| `SuspendOrganization` | OrganizationAggregate | SuperAdmin | Org existante | status change active → suspended | `OrganizationSuspended` |

### Commands IdentityAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `CreateUser` | IdentityAggregate | SuperAdmin ou Admin | Org existante | email unique par org, password_hash fort, role enum valide | `UserCreated` |
| `UpdateUserProfile` | IdentityAggregate | Self ou Admin | User existant | email unique par org (si email changed) | `UserUpdated` |
| `ChangeUserRole` | IdentityAggregate | SuperAdmin seulement | User existant, nouveau rôle valide | role hierarchie respectée | `UserRoleChanged` |
| `ResetPassword` | IdentityAggregate | Self (demande) ou Admin (force) | User existant | password_hash fort (regex complexity) | `PasswordResetRequested` |
| `LoginUser` | IdentityAggregate | N/A (system) | Credentials valides | email trouve, hash match, org_id correct | `UserLoggedIn` + `SessionCreated` |
| `LogoutUser` | IdentityAggregate | Self ou System | Session active | Session trouvée et active | `UserLoggedOut` |
| `RefreshAccessToken` | IdentityAggregate | Self | Refresh token valide, non expiré | Token found in DB, not expired | `SessionCreated` (new refresh) |
| `RevokeSession` | IdentityAggregate | Self ou SuperAdmin | Session existe | Session trouvée | `SessionRevoked` |
| `AssignPermissionGrant` | IdentityAggregate | SuperAdmin | Role existe, permission string valide | format resource:action:level respecté | Permission updated |

### Commands ResourceAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `CreateTransaction` | ResourceAggregate | Treasurer ou Admin | Org existante, category from vocab | amount > 0 BIGINT, date ≤ today, scope_type valid | `ResourceCreated` |
| `UpdateDraftTransaction` | ResourceAggregate | Creator ou Admin | Transaction draft seulement | Draft status enforced (approved immutable!) | `ResourceUpdated` |
| `SubmitForApproval` | ResourceAggregate | Creator ou任何 role avec write | Draft only | Status transition draft→pending | `ApprovalRequested` |
| `ApproveTransaction` | ResourceAggregate | Treasurer/Pastor/Admin | Pending only | Permission grant valid, step approved | `ResourceStateChanged`, `ApprovalGranted` |
| `RejectTransaction` | ResourceAggregate | Approver | Pending only | Reason required (comment obligatoire) | `ResourceStateChanged`, `ApprovalRejected` |
| `CompensateTransaction` | ResourceAggregate | Tresorier+Admin | Approved transaction exists | compensation linked via compensates_for | `TransactionCompensated` |
| `CreateMember` | ResourceAggregate | Admin | Org existante | firstName+lastName obligatoires, email unique par org si fourni | `ResourceCreated` |
| `UpdateMember` | ResourceAggregate | Admin | Member existant | firstName+lastName toujours obligatoires | `ResourceUpdated` |
| `TransitionMemberStatus` | ResourceAggregate | Admin | Member existant | status transition valide (active↔inactive/deceased/transferred) | `ResourceStateChanged` |
| `SearchResources` | ResourceAggregate | Any authenticated user | Permissions read on resource type | Filters validated (type, state, date range) | Resource list returned (read-only) |
| `ExportResources` | ResourceAggregate | Any with reporting:read | Data exported filtered by org_id | Format validated (pdf/csv/json) | Export generated |

### Commands RelationshipAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `AddMemberToGroup` | RelationshipAggregate | Admin | Member et group existent | No duplicate membership (PK check) | `MemberJoinedGroup` |
| `RemoveMemberFromGroup` | RelationshipAggregate | Admin | Membership exists | Keep history in audit trail | `MemberLeftGroup` |
| `SetOrgUnitParent` | RelationshipAggregate | SuperAdmin | Both units in same org | No cycle (Kahn's algo), depth ≤ 5 | `OrgUnitParentChanged` |
| `GetDescendants` | RelationshipAggregate | Lecture seule | Unit exists | Max depth 5 enforced | Descendant list (read-only) |

### Commands WorkflowAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `TriggerWorkflow` | WorkflowAggregate | Système (auto) ou Admin | Definition exists, trigger event matched | Workflow definition loaded from manifest | `WorkflowTriggered` |
| `ApproveStep` | WorkflowAggregate | Approver | Step is approval type, assigned to approver | Role matches assign_to_role | `StepApproved` |
| `RejectStep` | WorkflowAggregate | Approver | Step is approval type, assigned to approver | Reason required | `StepRejected` |
| `CancelWorkflow` | WorkflowAggregate | Approver or Admin | Workflow running | Only running workflows can be cancelled | `WorkflowCancelled` |
| `ResubmitForApproval` | WorkflowAggregate | Requester (creator) | Workflow rejected or in_revision | Returns to draft/pending state | `WorkflowTriggered` (re-trigger) |

### Commands FormAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `LoadFormDefinition` | FormAggregate | Any authenticated | Form ID exists in manifest | Form version matches or latest | Form definition returned |
| `ValidateFormData` | FormAggregate | Client + Server | Form loaded, data submitted | Client validation = Server validation (must match exactly) | ValidationResult (valid/invalid + errors) |
| `RenderForm` | FormAggregate | UI layer | Form definition loaded, optional data context | Conditional visibility evaluated against context | React Native render tree (JSON) |

### Commands NotificationAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `SendNotification` | NotificationAggregate | Système (workflow trigger) ou Admin | Channel available, user exists | Rate limit checked, quiet hours respected (unless critical) | `NotificationSent` |
| `MarkAsRead` | NotificationAggregate | Self only | Notification belongs to user | Read_at set to NOW() | `NotificationMarkedRead` |
| `UpdatePreferences` | NotificationAggregate | Self or Admin | Preferences valid JSON | Channels subset of [in_app,push,email,sms] | Preferences updated |
| `SetRateLimit` | NotificationAggregate | Admin | Max per hour > 0 | Integer value | Rate limit applied |

### Commands VocabularyAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `AddTermValue` | VocabularyAggregate | Admin | Namespace exists | Key unique within namespace | Term added |
| `DeprecateTermValue` | VocabularyAggregate | Admin | Value exists, NOT deprecated yet | Deprecation is irreversible | `TermValueDeprecated` |
| `ResolveLabel` | VocabularyAggregate | Any | Namespace + termKey exist | Lang supported | Label string returned |

### Commands ReportingAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `GenerateReport` | ReportingAggregate | Any with report:read | Report type defined | Only synced=1 transactions included | Report generated |
| `CalculateBalance` | ReportingAggregate | System | Period defined | Scope resolves to org_units, transfers handled | Balance totals |
| `ExportReport` | ReportingAggregate | Any with report:read | Report generated | Format valid (pdf/csv/json) | Export file |

### Commands LifecycleAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `ArchiveResource` | LifecycleAggregate | Admin | Resource exists, archivable type configured in manifest | resource_type in manifest.lifecycle.types[] | Resource archived + `ResourceArchived` |
| `TrashResource` | LifecycleAggregate | Admin | ArchiveEntry exists, state = archived | State transition archived→trashed allowed | `ResourceTrashed` |
| `PurgeResource` | LifecycleAggregate | System (scheduled) | Trash date passed, purge_date reached | Purge is IRREVERSIBLE | `ResourcePurged` |
| `RestoreFromTrash` | LifecycleAggregate | Admin | Entry in trashed state | State transition trashed→archived allowed | `ResourceRestoredFromTrash` |
| `ListArchiveEntries` | LifecycleAggregate | Admin | Trashed entries excluded from normal query | Filters: type, tags, state, date range | Archive list (read-only) |

### Commands ConfigurationAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `UpdateSetting` | ConfigurationAggregate | Admin | Key exists in settings schema | Value format validated (currency, timezone, hex) | Setting updated + `SettingUpdated` |
| `ResetToDefaults` | ConfigurationAggregate | Admin | Settings not at defaults | All keys reset to template defaults | `SettingsResetToDefaults` |

### Commands OfflineSyncAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `PushPendingOperations` | OfflineSyncAggregate | System (auto) | Pending operations in queue | Batch size ≤ 50, exponential backoff if failed | `BatchPushed` |
| `PullRemoteChanges` | OfflineSyncAggregate | System (auto) | Network available | Since timestamp provided, org_id injected | `DeltaReceived` |
| `ResolveConflict` | OfflineSyncAggregate | System (auto) or Admin | Conflict detected during pull | Strategy per entity type: LWW, server-wins, immutable, uuid-dedup | `ConflictResolved` |

### Commands AuditAggregate

| Command | Aggregate Cible | Acteur | Préconditions | Validation | Résultat |
|---------|----------------|--------|--------------|-----------|---------|
| `LogAction` | AuditAggregate | SYSTEM ONLY (auto) | Any domain state change occurred | entityType + entityId + userId always required, old/new values captured | Entry appended (immutable) |
| `QueryAuditLogs` | AuditAggregate | Admin or Auditor | Filter criteria specified | Date range validated, results scoped to org_id | Log entries returned (read-only) |

---

## REGISTRE DES DOMAIN EVENTS

### Events OrganizationAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `OrganizationCreated` | OrganizationAggregate | CreateOrganization success | orgId, name, type, settings | OfflineSyncAggregate (initial sync), AuditAggregate (log), NotificationAggregate (welcome) |
| `OrganizationSuspended` | OrganizationAggregate | SuspendOrganization success | orgId, suspendedAt, reason | ResourceAggregate (write locked), AuditAggregate |
| `OrganizationArchived` | OrganizationAggregate | ArchiveOrganization success | orgId, archivedAt | ResourceAggregate (read only), AuditAggregate |
| `OrgUnitCreated` | OrganizationAggregate | CreateOrgUnit success | orgUnitId, parentId, unitType, depthLevel | RelationshipAggregate, AuditAggregate |
| `OrgUnitParentChanged` | OrganizationAggregate | SetOrgUnitParent success | orgUnitId, oldParent, newParent, depthLevel | RelationshipAggregate (update descendants), AuditAggregate |
| `ChildOrgTransferred` | OrganizationAggregate | TransferChildOrg success | childOrgId, newParentId | AuditAggregate |
| `ChildOrgMerged` | OrganizationAggregate | MergeOrganizations success | sourceOrgId, targetOrgId | AuditAggregate |

### Events IdentityAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `UserCreated` | IdentityAggregate | CreateUser success | userId, email, role, orgId | AuditAggregate, NotificationAggregate (welcome) |
| `UserUpdated` | IdentityAggregate | UpdateUserProfile success | userId, changedFields | AuditAggregate |
| `UserRoleChanged` | IdentityAggregate | ChangeUserRole success | userId, oldRole, newRole, effectiveDate | AuditAggregate, PermissionResolver (rebuild JWT) |
| `PasswordResetRequested` | IdentityAggregate | ResetPassword success | userId, resetTimestamp | AuditAggregate |
| `UserLoggedIn` | IdentityAggregate | LoginUser success | userId, orgId, deviceInfo, loginTimestamp | AuditAggregate, NotificationAggregate |
| `UserLoggedOut` | IdentityAggregate | LogoutUser success | userId, sessionEndedAt | AuditAggregate |
| `SessionCreated` | IdentityAggregate | LoginUser OR RefreshAccessToken success | sessionId, refreshTokenHash, expiresAt, userId | AuditAggregate |
| `SessionExpired` | IdentityAggregate | System cleanup (check expiresAt) | sessionId, userId, expiredAt | AuditAggregate |
| `SessionRevoked` | IdentityAggregate | RevokeSession success | sessionId, revokedBy, revokedAt | AuditAggregate |

### Events ResourceAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `ResourceCreated` | ResourceAggregate | Create* success | resourceId, resourceType, orgId, createdBy | AuditAggregate, OfflineSyncAggregate (push) |
| `ResourceUpdated` | ResourceAggregate | Update* success | resourceId, resourceType, changes (diff), version | AuditAggregate, OfflineSyncAggregate (push) |
| `ResourceStateChanged` | ResourceAggregate | Transition or Approval success | resourceId, resourceType, oldState, newState, transitionedBy | AuditAggregate, WorkflowAggregate (step complete), LifecycleAggregate (if archiveable) |
| `ResourceDeleted` | ResourceAggregate | Delete* success | resourceId, resourceType, deletedBy, deleteTimestamp | AuditAggregate, OfflineSyncAggregate (push) |
| `TransactionCompensated` | ResourceAggregate | CompensateTransaction success | originalTxId, compensationTxId, reason | AuditAggregate, ReportingAggregate (balance recalculated) |
| `ApprovalRequested` | ResourceAggregate | SubmitForApproval success | resourceId, requestedBy, thresholdInfo | WorkflowAggregate (trigger workflow), NotificationAggregate (alert) |
| `ApprovalGranted` | ResourceAggregate | ApproveStep success AND status transition | resourceId, approvedBy, approvedAt, comment | AuditAggregate, OfflineSyncAggregate |
| `ApprovalRejected` | ResourceAggregate | RejectStep success | resourceId, rejectedBy, reason, timestamp | AuditAggregate, WorkflowAggregate (reject flow) |

### Events RelationshipAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `MemberJoinedGroup` | RelationshipAggregate | AddMemberToGroup success | memberId, groupId, joinedAt | AuditAggregate, NotificationAggregate (optional) |
| `MemberLeftGroup` | RelationshipAggregate | RemoveMemberFromGroup success | memberId, groupId, leftAt | AuditAggregate |
| `OrgUnitReparented` | RelationshipAggregate | SetOrgUnitParent success | unitId, oldParentId, newParentId | AuditAggregate |
| `ChildOrgTransferred` | RelationshipAggregate | TransferChildOrg success | childOrgId, oldParentId, newParentId | AuditAggregate |
| `ChildOrgMerged` | RelationshipAggregate | MergeOrganizations success | sourceOrgId, targetOrgId | AuditAggregate |
| `DescendantEnumerationRequested` | RelationshipAggregate | GetDescendants called | rootUnitId, depthRequested | ReportingAggregate (if calculating consolidated balance) |

### Events WorkflowAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `WorkflowTriggered` | WorkflowAggregate | TriggerWorkflow success | instanceId, triggerEvent, resourceType, resourceId | NotificationAggregate (alert assignees), AuditAggregate |
| `StepExecuted` | WorkflowAggregate | Step completes (auto type) | instanceId, stepId, stepType | AuditAggregate |
| `StepApproved` | WorkflowAggregate | ApproveStep success | instanceId, stepId, approvedBy, comment | ResourceAggregate (if approval triggers state change) |
| `StepRejected` | WorkflowAggregate | RejectStep success | instanceId, stepId, rejectedBy, reason | ResourceAggregate (return to draft), WorkflowAggregate (cancel) |
| `StepEscalated` | WorkflowAggregate | Timeout exceeded, escalation rule triggered | instanceId, stepId, escalationTarget, timeoutDuration | NotificationAggregate (alert escalated party) |
| `WorkflowCompleted` | WorkflowAggregate | Last step completed successfully | instanceId, completedAt, totalSteps | AuditAggregate, ResourceAggregate (final state change) |
| `WorkflowFailed` | WorkflowAggregate | Step fails irrecoverably | instanceId, failedStep, error, retryCount | AuditAggregate |
| `WorkflowCancelled` | WorkflowAggregate | CancelWorkflow success | instanceId, cancelledBy, reason | AuditAggregate |

### Events FormAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `FormSubmitted` | FormAggregate | ValidateFormData passes + data persisted | formId, formData, submittedAt, resourceId | ResourceAggregate (data becomes Resource), WorkflowAggregate (triggers approval) |
| `FormValidationFailed` | FormAggregate | ValidateFormData rejects | formId, fieldName, errorCode, userMessage | UI layer (show inline errors) |
| `FormSubmittedForApproval` | FormAggregate | Form submission triggers workflow | formId, resourceId, workflowId | WorkflowAggregate, NotificationAggregate |

### Events NotificationAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `NotificationQueued` | NotificationAggregate | SendNotification queued | notificationId, channel, recipientId | OfflineSyncAggregate (sync if offline) |
| `NotificationSent` | NotificationAggregate | SendNotification succeeds | notificationId, channel, sentAt | AuditAggregate |
| `NotificationFailed` | NotificationAggregate | SendNotification fails | notificationId, channel, errorMessage, retryCount | AuditAggregate, system (retry) |
| `NotificationMarkedRead` | NotificationAggregate | MarkAsRead success | notificationId, readAt | AuditAggregate |
| `PreferencesUpdated` | NotificationAggregate | UpdatePreferences success | userId, channels, severityMin, rateLimitH | AuditAggregate |

### Events VocabularyAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `TermAdded` | VocabularyAggregate | AddTermValue success | namespace, termKey, valueKey | None (pure lookup data) |
| `TermValueDeprecated` | VocabularyAggregate | DeprecateTermValue success | namespace, termKey, deprecatedValue | Forms engine (stop rendering), AuditAggregate |
| `TranslationResolved` | VocabularyAggregate | ResolveLabel success | namespace, termKey, lang, resolvedLabel | Forms Engine (render label), None persistent |

### Events ReportingAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `ReportGenerated` | ReportingAggregate | GenerateReport success | reportId, reportType, periodStart, periodEnd, income, expense, netResult, format | AuditAggregate, NotificationAggregate (if scheduled report) |
| `ReportExported` | ReportingAggregate | ExportReport success | reportId, format, exportedBy, exportedAt | AuditAggregate |
| `BalanceCalculated` | ReportingAggregate | CalculateBalance success | scope, periodStart, periodEnd, totals, categoryBreakdown | ReportingAggregate (report generation), AuditAggregate |

### Events LifecycleAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `ResourceArchived` | LifecycleAggregate | ArchiveResource success | archiveId, resourceType, resourceId, archivedAt, archivedBy | AuditAggregate, NotificationAggregate (optional) |
| `ResourceTrashed` | LifecycleAggregate | TrashResource success | archiveId, trashedAt, trashReason | AuditAggregate |
| `ResourcePurged` | LifecycleAggregate | PurgeResource success | archiveId, purgedAt | AuditAggregate (purge logged permanently) |
| `ResourceRestoredFromTrash` | LifecycleAggregate | RestoreFromTrash success | archiveId, restoredAt, restoredBy | AuditAggregate |
| `PurgeScheduled` | LifecycleAggregate | SchedulePurge success | archiveId, purgeDate, type | System scheduler (cron job) |

### Events ConfigurationAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `SettingUpdated` | ConfigurationAggregate | UpdateSetting success | settingKey, oldValue, newValue, updatedAt | Manifest compiler (invalidate cache), Branding capability (if accent changed) |
| `SettingsResetToDefaults` | ConfigurationAggregate | ResetToDefaults success | resetAt, resetBy | AuditAggregate |

### Events OfflineSyncAggregate

| Event | Aggregate Source | Condition d'émission | Données transportées | Consommateurs autorisés |
|-------|-----------------|---------------------|---------------------|------------------------|
| `SyncStarted` | OfflineSyncAggregate | Push + Pull begin | orgId, startedAt | AuditAggregate |
| `BatchPushed` | OfflineSyncAggregate | Push pending ops success | batchCount, pushedAt | AuditAggregate |
| `DeltaReceived` | OfflineSyncAggregate | Pull remote changes success | table, count, sinceTimestamp | AuditAggregate |
| `ConflictDetected` | OfflineSyncAggregate | Conflict resolution needed | resourceType, resourceId, clientVersion, serverVersion | AuditAggregate, UI layer (side-by-side diff) |
| `ConflictResolved` | OfflineSyncAggregate | Conflict strategy applied | resourceType, resourceId, winner (client/server), strategyUsed | AuditAggregate |
| `SyncCompleted` | OfflineSyncAggregate | All ops confirmed | orgId, completedAt, pushCount, pullCount | AuditAggregate |
| `ConnectionLost` | OfflineSyncAggregate | Network connectivity lost | lostAt, lastKnownState | UI layer (offline mode), AuditAggregate |
| `ConnectionRestored` | OfflineSyncAggregate | Network connectivity regained | regainedAt, pendingOpsCount | OfflineSyncAggregate (trigger re-push) |
