# ORG-005 — Notification, Audit & Event Flow Model

## MARQUAGE IGS-v1

| Champ | Valeur |
|-------|--------|
| **Doc ID** | ORG-005 |
| **Version** | 1.0 |
| **Statut** | CANONIQUE — SPECIFICATION D'ORCHESTRATION EVENTS |
| **Date** | 2026-07-24 |
| **Dépendances** | DOC-012 (Canonical Domain Model), DOC-013 (Aggregate Boundaries), DOC-014 (Command-Event Registry), DOC-015 (Invariant Registry), DOC-023 (Canonical Relational Rules) |
| **Source canonique** | DOC-012 §2.7/§2.10, DOC-013 Boundary #7/#10, DOC-014 Event Registry, DOC-015 NOT-*/AUD-*, DOC-023 §6 |
| **Transformation rule** | org-lifecycle-specifier v1.0 |
| **Architecture version** | v1.0 (DOC-000-DOC-024 + ARA-v1) |
| **Compliance status** | COMPLIANT |

---

## 1. DISTINCTIONS FONDAMENTALES

| Concept | Description | Stocké dans | Exemple |
|---------|------------|-------------|---------|
| Événement Métier | Ce qui s'est passé dans le domaine — fait irréversible | Domain Events registry (DOC-014) | MemberJoinedGroup |
| Notification | Message envoyé à un utilisateur — action sur un événement | NotificationAggregate (DOC-012 §2.7) | Push to Jean: "Bienvenue dans Église X" |
| Audit | Preuve immuable d'une action — qui/quand/comment | AuditAggregate (DOC-012 §2.10) | Who did what when where why |
| Journal Technique | Logs système pour debugging — informationnelle | Infrastructure logger (Port-009) | WARN rate_limit exceeded |
| Preuve d'Action | Élément juridique d'une action | Audit entry + digital signature | Report export with hash |

**Ces 5 concepts NE DOIVENT JAMAIS ÊTRE CONFONDUS.**

### Règle de Non-Confusion

| Situation | Événement | Notification | Audit |
|-----------|-----------|-------------|-------|
| `CreateTransaction` success | ResourceCreated (DOC-014) | Non générée par défaut | LogAction(auto) avec old={} new={txn} |
| `ApproveTransaction` success | ResourceStateChanged + ApprovalGranted | Notification to requester ("Votre transaction a été approuvée") | LogAction(action='approve', old={status:'pending'}, new={status:'approved'}) |
| `SendNotification` success | NotificationSent (DOC-014) | La notification elle-même | LogAction(action='notify', old=null, new={notifId}) |
| `LogAction` (auto) | ActionLogged (interne seulement, DOC-014) | Jamais | L'entry audit elle-même |

**Règle constitutionnelle :** Un Event peut déclencher une Notification ET un AuditEntry. Une Notification ne génère JAMAIS d'Event métier (c'est un effet secondaire du routing). Un AuditEntry est toujours implicite (auto-invoked, DOC-014: `actor=SYSTEM ONLY`).

---

## 2. SYSTÈME D'ÉVÉNEMENTS MÉTIER LIÉS À L'ORGANISATION

Chaque événement ci-dessous existe dans DOC-014. Cette section documente leur RÔLE dans l'organigramme de notification et d'audit, pas leur définition structurelle (celle-ci est dans DOC-014).

### 2.1 Événements de Cycle de Vie Organisation

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Priorité | Audité | Source Invariant DOC-015 |
|-------------------|----------------------|-----------|--------|----------|--------|-------------------------|
| OrganizationCreated | CreateOrganization | Superadmin (creator) | in_app | info | YES (action='create', entite='organization') | INV-004 |
| OrganizationActivated | System (post-create login) | Membres initiaux | push+email | low | NON (c'est un workflow trigger, pas un state change) | N/A |
| OrganizationSuspended | SuspendOrganization | Tous les membres de l'org | in_app+email | critical | YES (action='other', valeur_apres=status:suspended) | BR-ORG-006 |
| OrganizationArchived | ArchiveOrganization | Admin de l'org + auditeurs | in_app+email | high | YES (action='other', valeur_apres=status:archived) | — |
| ChildOrgTransferred | TransferChildOrg | Ancien+ Nouveau responsable | in_app | warning | YES (action='transfer') | REL-001 |
| ChildOrgMerged | MergeOrganizations | Tous membres des deux orgs | email+in_app | critical | YES (action='transfer') | BR-ORG-005 |

**Note sur OrganizationActivated :** Ce n'est PAS un domaine event de DOC-014. C'est un concept d'infrastructure/workflow — déclenché automatiquement par le premier login post-création. Il produit un WorkflowTriggered dans WorkflowAggregate qui peut générer une notification de bienvenue.

### 2.2 Événements de Membership/Invitation

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| UserCreated | CreateUser | Nouvel user (welcome) | in_app | YES (action='create', entite='user') | EMAIL-001 |
| UserUpdated | UpdateUserProfile | Self | none (silent) | YES (action='update') | EMAIL-001 |
| UserRoleChanged | ChangeUserRole | Membre affecté | email+in_app | YES (action='other', old_role→new_role) | Role hierarchy |
| PasswordResetRequested | ResetPassword | Self | email (si channel configured) | YES (action='other') | BR-ID-001 |
| UserLoggedIn | LoginUser | Self (session info) | in_app | YES (action='other') | INV-004, INV-008 |
| UserLoggedOut | LogoutUser | Self | none | YES (action='other') | — |
| SessionCreated | LoginUser OR RefreshAccessToken | Self | in_app | YES (action='other') | — |
| SessionExpired | System cleanup | None | none | YES (action='other') | — |
| SessionRevoked | RevokeSession | Self + revokeurs | in_app | YES (action='other') | — |
| InviteCreated | CreateUser (via flow) | Target email | email | YES (action='create') | EMAIL-001 |
| InviteAccepted | LoginUser (first login) | Inviter | in_app | YES (implicit via UserLoggedIn) | — |
| InviteExpired | Time-out (system) | System (log only) | none | YES (action='other') | — |
| InviteRejected | System (rejected by admin) | Inviter | in_app | YES (action='reject') | — |
| MembershipCreated | AddMemberToGroup | Nouveau membre (welcome) | in_app+push | YES (via MemberJoinedGroup audit) | MULTI-020 |
| MembershipRemoved | RemoveMemberFromGroup | Membre affecté | email+in_app | YES (action='delete', entite='membership') | HISTORY-022 |
| MembershipStatusChanged | TransitionMemberStatus | Membre affecté | email+in_app | YES (action='update') | STATUS-010 |

### 2.3 Événements de Hiérarchie

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| OrgUnitCreated | CreateOrgUnit | Branch manager (if assigned) | in_app | YES (action='create') | BR-ORG-001, BR-ORG-002 |
| OrgUnitReparented | SetOrgUnitParent (Relationship) | Ancien+ Nouveau responsables | in_app | YES (action='transfer') | REL-001, REL-002 |
| OrgUnitParentChanged | UpdateOrgUnitParent (Organization) | Admin responsible | in_app | YES (action='other') | BR-ORG-003 |
| DescendantEnumerationRequested | GetDescendants | System (internal) | none | NON (read-only query, no state change) | REL-002 |

### 2.4 Événements de Ressources (Financial/Membership/Events)

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| ResourceCreated | CreateTransaction, CreateMember | System (sync only) | none | YES (action='create') | FIN-002, MEM-001 |
| ResourceUpdated | UpdateDraftTransaction, UpdateMember | None | none | YES (action='update') | VERSION-001, FIN-001 |
| ResourceStateChanged | Approve/Reject/Transition | Requester/Creator | in_app | YES (action='approve'/'reject'/'other') | STATUS-010, BR-RES-001 |
| TransactionCompensated | CompensateTransaction | None | none | YES (action='other') | COMP-001 |
| ApprovalRequested | SubmitForApproval | Approvers list | in_app | YES (action='other') | WF-001 |
| ApprovalGranted | ApproveStep | Requester | in_app | YES (action='approve') | CHAINS-003 |
| ApprovalRejected | RejectStep | Requester | in_app+email | YES (action='reject') | — |
| FormSubmitted | FormAggregate output → ResourceCreated | System (via ResourceAggregate) | none | YES (implicit) | DUAL-008 |
| FormValidationFailed | ValidateFormData fails | UI layer only | none | NO (no state change — validation failure) | DUAL-008 |

### 2.5 Événements de Workflow

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| WorkflowTriggered | TriggerWorkflow | Assignees per approval chain | in_app | YES (action='other') | LOG-005, WF-006 |
| StepExecuted | Auto step completes | System | none | YES (action='other') | LOG-005 |
| StepApproved | ApproveStep | Next assignee / requester | in_app | YES (action='approve') | CHAINS-003 |
| StepRejected | RejectStep | Requester | in_app+email | YES (action='reject') | — |
| StepEscalated | Timeout exceeded | Escalation target | email+in_app | YES (action='other') | ESCALATE-002 |
| WorkflowCompleted | Last step done | Creator | in_app | YES (action='other') | LOG-005 |
| WorkflowFailed | Irrecoverable step failure | Admin | email+in_app | YES (action='other') | RETRY-004 |
| WorkflowCancelled | CancelWorkflow | Requester | in_app | YES (action='other') | — |

### 2.6 Événements de Notification

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| NotificationQueued | SendNotification (offline) | OfflineSyncAggregate (sync if offline) | none (internal) | YES (action='notify') | NOT-001, SYNC-004 |
| NotificationSent | SendNotification succeeds | None external | none | YES (action='notify') | — |
| NotificationFailed | SendNotification fails | Retry system | none | YES (action='notify', with error details) | NOT-002 |
| NotificationMarkedRead | MarkAsRead | None | none | YES (action='other') | — |
| PreferencesUpdated | UpdatePreferences | System | none | YES (action='update') | CHANNEL-003, RATE-002 |

### 2.7 Événements de Reporting

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| ReportGenerated | GenerateReport | Scheduled consumer (if applicable) | in_app (scheduled) | YES (action='other') | BAL-001, MONTH-001 |
| ReportExported | ExportReport | None | none | YES (action='other') | EXPORT-001 |
| BalanceCalculated | CalculateBalance | System | none | YES (action='other') | SYNCED-001 |

### 2.8 Événements de Vocabulary

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| TermAdded | AddTermValue | None (pure lookup data) | none | YES (action='create') | STABLE-003 |
| TermValueDeprecated | DeprecateTermValue | Forms engine (stop rendering) | none | YES (action='other') | VOC-001 |
| TranslationResolved | ResolveLabel | Forms Engine (render) | none (transient) | NO (read-only resolve, no state change) | TRANSLATION-002 |

### 2.9 Événements de Lifecycle

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| ResourceArchived | ArchiveResource | Resource creator (optional) | in_app | YES (action='create') | LIF-001, LIF-003 |
| ResourceTrashed | TrashResource | None | none | YES (action='delete') | LIF-003 |
| ResourcePurged | PurgeResource | None (irreversible) | none | YES (action='delete') | LIF-003, LIF-005 |
| ResourceRestoredFromTrash | RestoreFromTrash | None | none | YES (action='update') | LIF-003 |
| PurgeScheduled | SchedulePurge | System scheduler | none | YES (action='other') | LIF-005 |

### 2.10 Événements de Configuration

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| SettingUpdated | UpdateSetting | Manifest compiler (invalidate cache) | none | YES (action='update') | CFG-001..004 |
| SettingsResetToDefaults | ResetToDefaults | None | none | YES (action='other') | CFG-004 |

### 2.11 Événements de Sync

| Événement DOC-014 | Déclencheur (Command) | Notifié À | Canaux | Audité | Source Invariant |
|-------------------|----------------------|-----------|--------|--------|-----------------|
| SyncStarted | Push/Pull begins | None | none | YES (action='other') | SYNC-001 |
| BatchPushed | Push pending ops success | None | none | YES (action='other') | SYNC-002 |
| DeltaReceived | Pull remote changes success | None | none | YES (action='other') | SYNC-004 |
| ConflictDetected | Conflict needs resolution | UI layer (side-by-side diff) | none | YES (action='other') | — |
| ConflictResolved | Conflict strategy applied | None | none | YES (action='other') | SYNC-001 |
| SyncCompleted | All ops confirmed | None | none | YES (action='other') | — |
| ConnectionLost | Network lost | UI layer (offline mode banner) | none | YES (action='other') | SYNC-004 |
| ConnectionRestored | Network regained | OfflineSyncAggregate (trigger re-push) | none | YES (action='other') | SYNC-001 |

---

## 3. FLUX DE NOTIFICATION

### 3.1 Algorithme de Routing

Pour chaque DomainEvent qui génère une notification potentielle :

```
1. EventPublisher dispatches the event to NotificationRouter (NotificationAggregate)
   └─ Only events listed in §3.3 Mapping Matrix proceed to routing
   └─ Events NOT in the matrix produce NO notification (only audit)

2. NotificationRouter resolves recipient preferences per user/org
   └─ Reads NotificationPreference from NotificationAggregate
   └─ Respects channels[], severityMin, rateLimitH per user and org

3. Filters by channel_preference_policy
   └─ USER_PREF_FIRST: user-level preference overrides org-level default
   └─ If user has not set preferences → fall back to org defaults

4. Checks quiet_hours_policy
   └─ Quiet hours configurable per org (ConfigurationAggregate setting)
   └─ EXCEPTION: severity=critical ALWAYS bypasses (BR-NOT-005, DOC-015 QUIET-004)

5. Checks rate_limit_enforcer
   └─ Per-user max_per_hour (from NotificationPreference)
   └─ Per-org fallback max (from org settings)
   └─ EXCEPTION: severity=critical has NO rate limit (DOC-015 RATE-002)

6. Applies NoUntriggeredNotificationPolicy (NOT-001, DOC-015)
   └─ Every notification MUST have a trigger_source
   └─ trigger_source = originating command name or domain event name

7. For each selected channel: dispatches to the appropriate adapter
   ├─ in_app    → WatermelonDB local queue (always delivered — BR-NOT-003)
   ├─ push      → Expo Push API (optional — BR-NOT-004)
   ├─ email     → Nodemailer/SendGrid (optional — BR-NOT-004)
   └─ sms       → Twilio/external SMS provider (optional — BR-NOT-004)

8. Each delivery attempt logged in notification_logs
   └─ success/failure timestamped
   └─ retry count tracked
   └─ error message captured on failure
```

### 3.2 Priorités de Notification

| Severity | Bypass Quiet Hours | Rate Limit | Priority Queue | Canaux Autorisés |
|----------|--------------------|------------|----------------|-----------------|
| critical | YES | NONE (unlimited) | YES | in_app, push, email, sms |
| warning | NO | Standard (rate limit applies) | Standard | in_app, push, email, sms |
| info | NO | Standard (rate limit applies) | Standard | in_app, push, email, sms |

**Règle constitutionnelle :** severity=critical est réservé aux événements qui exigent une ACTION IMMÉDIATE de l'utilisateur. Dans Lumina, ce sont uniquement : OrganizationSuspended, ChildOrgTransferred (cross-org), et toute notification venant d'un WorkflowAggregate step escalade.

### 3.3 Event → Notification Mapping Matrix

Seuls les événements ci-dessous génèrent des notifications. Les événements non listés sont purement internes (audit uniquement).

| Domain Event DOC-014 | Génère Notification ? | Channel(s) | Severity | Trigger Source Invariant |
|---------------------|----------------------|------------|----------|-------------------------|
| OrganizationCreated | Oui | in_app | info | NOT-001 (trigger: CreateOrganization) |
| OrganizationSuspended | Oui | in_app+email | critical | BR-ORG-006, QUIET-004 (bypass) |
| OrganizationArchived | Oui | in_app+email | warning | — |
| UserCreated | Oui | in_app | info | NOT-001 (trigger: CreateUser) |
| UserRoleChanged | Oui | email+in_app | warning | Role hierarchy change |
| UserLoggedIn | Optionnel | in_app | info | First-time login welcome |
| UserLoggedOut | Non | — | — | — |
| SessionCreated | Oui (welcome device) | in_app | info | — |
| SessionRevoked | Oui (security alert) | email+in_app | critical | Unauthorized revocation |
| SessionExpired | Non | — | — | System event |
| ResourceCreated | Non | — | — | Silent (sync only) |
| ResourceUpdated | Non | — | — | Silent |
| ResourceStateChanged | Oui | in_app | info | Status transition for requesters |
| TransactionCompensated | Non | — | — | Silent |
| ApprovalRequested | Oui | in_app | warning | DOC-015 WF-001 |
| ApprovalGranted | Oui | in_app | info | DOC-015 CHAINS-003 |
| ApprovalRejected | Oui | in_app+email | warning | Reason included |
| MemberJoinedGroup | Oui | in_app+push | info | NOT-001 (trigger: AddMemberToGroup) |
| MemberLeftGroup | Non | — | — | Silent (removed member doesn't need notice) |
| OrgUnitCreated | Optionnel | in_app | info | If branch manager assigned |
| OrgUnitReparented | Oui | in_app | warning | DOC-015 REL-001 |
| ChildOrgTransferred | Oui | email+in_app | critical | BR-ORG-005, QUIET-004 (bypass) |
| ChildOrgMerged | Oui | email+in_app | critical | BR-ORG-005, QUIET-004 (bypass) |
| WorkflowTriggered | Oui | in_app | warning | DOC-015 LOG-005 |
| StepApproved | Oui | in_app | info | Next step notification |
| StepRejected | Oui | in_app+email | warning | Reason included |
| StepEscalated | Oui | email+in_app | critical | DOC-015 ESCALATE-002, QUIET-004 (bypass) |
| WorkflowCompleted | Oui | in_app | info | — |
| WorkflowFailed | Oui | email+in_app | critical | DOC-015 RETRY-004, QUIET-004 (bypass) |
| WorkflowCancelled | Oui | in_app | info | — |
| FormSubmitted | Non | — | — | Silent (triggers ResourceCreated) |
| FormValidationFailed | Non | — | — | UI error only, not a notification |
| FormSubmittedForApproval | Oui | in_app | warning | Via WorkflowTriggered chain |
| NotificationQueued | Non (self-referential) | — | — | Internal tracking |
| NotificationSent | Non (self-referential) | — | — | Internal tracking |
| NotificationFailed | Oui (admin alert only) | email | critical | Retry exhausted, QUIET-004 (bypass) |
| NotificationMarkedRead | Non | — | — | User action, silent |
| PreferencesUpdated | Non | — | — | Silent |
| ReportGenerated | Optionnel | in_app | info | If scheduled report |
| ReportExported | Non | — | — | Silent |
| BalanceCalculated | Non | — | — | Silent |
| ResourceArchived | Optionnel | in_app | info | If user-initiated archive |
| ResourceTrashed | Non | — | — | Silent |
| ResourcePurged | Non | — | — | Silent (irreversible, admin audit trail suffices) |
| ResourceRestoredFromTrash | Non | — | — | Silent |
| PurgeScheduled | Non | — | — | System scheduling |
| SettingUpdated | Non | — | — | Silent (manifest cache only) |
| SettingsResetToDefaults | Non | — | — | Silent |
| SyncStarted/BatchPushed/DeltaReceived/SyncCompleted | Non | — | — | Silent (user-transparent) |
| ConflictDetected | Oui (user resolution needed) | in_app+push | warning | Action required |
| ConflictResolved | Non | — | — | Silent (auto-resolved) |
| ConnectionLost | Optionnel | in_app | info | Offline mode banner |
| ConnectionRestored | Non | — | — | Silent (auto-resume) |
| TermAdded/TermValueDeprecated/TranslationResolved | Non | — | — | Pure lookup data, no notification |
| DescendantEnumerationRequested | Non | — | — | Internal read operation |
| PasswordResetRequested | Optionnel | email | info | Security notification |
| UserUpdated | Non | — | — | Silent |

### 3.4 Algorithme de Décision "Notification vs. Pas Notification"

```
DecisionTree(EventHandler):
    if event is a READING operation (Query, not Command):
        → NO notification, NO audit (except read access logged separately)
    
    if event is an AUDIT-only event (ActionLogged):
        → NO notification, ALREADY audited
    
    if event.name in NotificationMappingMatrix (§3.3):
        → Apply Routing Algorithm (§3.1)
        → Also generate AuditEntry if event has state change
    
    if event is a STATE CHANGE (any Command producing Domain Event):
        → NO notification (unless in mapping matrix)
        → YES AuditEntry (action = derive from command name)
    
    if event is TRANSIENT (validation fail, resolve label, etc.):
        → NO notification, NO audit
        → May produce UI feedback only
```

---

## 4. SYSTÈME D'AUDIT

### 4.1 Règles de Capture

| Règle | Description | Source Invariant |
|-------|------------|-----------------|
| BR-AUD-001 | Actions loguées IMMÉDIATEMENT lors du state change (before persistence) | AUD-001, DOC-015 |
| BR-AUD-002 | old_value ET new_value ALWAYS captureés (FullSnapshotPolicy) | OLDNEW-002, DOC-015 |
| BR-AUD-003 | Logs retenus minimum 7 ans (RetentionManager configurable) | RETENTION-031, DOC-015 |
| BR-AUD-004 | Impossible de modifier ou supprimer un log | AUD-001 constitutionnel |
| BR-AUD-005 | Accès réservé aux admins et auditeurs (AccessRestrictionPolicy) | ACCESS-033, DOC-015 |
| BR-AUD-006 | Modifications du manifest aussi logguées (audit.log_manifest_changes: true) | DOC-023 §6.1 |

### 4.2 Schéma d'Entry Audit

La structure physique d'une entrée audit est :

```
{
  id: uuid              -- surrogé, auto-généré
  org_id: uuid          -- portée multi-tenant (DOC-023 §8)
  sequence_log: bigint  -- ordre d'insertion (DOC-023 §5.2)
  action_effectuee: enum  -- create | update | delete | approve | reject | transfer | notify | other
  entite_type: varchar(255)  -- e.g. 'organization', 'membership', 'user_role', 'workflow_instance'
  entite_id: uuid      -- ID de l'entité spécifique auditable
  utilisateur_id: uuid -- qui a fait l'action (SYSTEM pour LogAction auto)
  valeur_avant: jsonb  -- full snapshot AVANT le changement
  valeur_apres: jsonb  -- full snapshot APRES le changement
  adresse_ip: varchar(45) -- IPv4 ou IPv6, optionnel
  agent_utilisateur: text -- User-Agent pour contexte, optionnel
  date_heure_utc: timestamptz -- ClockPort.now() (DOC-012 Port-006)
  duree_retention_annees: integer DEFAULT 7  -- configurable via Policy (DOC-023 §6.4)
}
```

**Règles structurelles :**
- `valeur_avant` et `valeur_apres` sont TOUJOURS présents. Pour un `create`, valeur_avant = `{}`. Pour un `delete`, valeur_apres = `{}`. (OLDNEW-002, DOC-015)
- Aucune donnée sensible (password_hash, JWTToken, PhoneNumber en clair) ne peut apparaître dans les snapshots. Le port d'audit filtre automatiquement les champs sensibles (DOC-012 Port-010, Port-009 Privacy constraint).
- L'_org_id est injecté automatiquement depuis le contexte utilisateur (DOC-023 §8.1, NB-MT-001).

### 4.3 Mapping Actions Audit → Domain Commands

| Domain Event DOC-014 | action_effectuee | entite_type | Entité source |
|---------------------|------------------|-------------|--------------|
| OrganizationCreated | create | organization | OrganizationAggregate |
| OrganizationSuspended | other | organization | OrganizationAggregate |
| OrganizationArchived | other | organization | OrganizationAggregate |
| OrgUnitCreated | create | org_unit | OrganizationAggregate |
| OrgUnitParentChanged | transfer | org_unit | OrganizationAggregate |
| ChildOrgTransferred | transfer | organization | RelationshipAggregate |
| ChildOrgMerged | transfer | organization | OrganizationAggregate |
| UserCreated | create | user | IdentityAggregate |
| UserUpdated | update | user | IdentityAggregate |
| UserRoleChanged | other | user_role | IdentityAggregate |
| PasswordResetRequested | other | user | IdentityAggregate |
| UserLoggedIn | other | session | IdentityAggregate |
| UserLoggedOut | other | session | IdentityAggregate |
| SessionCreated | create | session | IdentityAggregate |
| SessionExpired | other | session | IdentityAggregate |
| SessionRevoked | delete | session | IdentityAggregate |
| ResourceCreated | create | resource_type | ResourceAggregate |
| ResourceUpdated | update | resource_type | ResourceAggregate |
| ResourceStateChanged | other | resource_state | ResourceAggregate |
| TransactionCompensated | other | transaction | ResourceAggregate |
| ApprovalRequested | other | approval | ResourceAggregate |
| ApprovalGranted | approve | approval | ResourceAggregate |
| ApprovalRejected | reject | approval | ResourceAggregate |
| MemberJoinedGroup | create | membership | RelationshipAggregate |
| MemberLeftGroup | delete | membership | RelationshipAggregate |
| OrgUnitReparented | transfer | org_unit | RelationshipAggregate |
| WorkflowTriggered | create | workflow_instance | WorkflowAggregate |
| StepExecuted | other | workflow_step | WorkflowAggregate |
| StepApproved | approve | workflow_step | WorkflowAggregate |
| StepRejected | reject | workflow_step | WorkflowAggregate |
| StepEscalated | other | workflow_step | WorkflowAggregate |
| WorkflowCompleted | other | workflow_instance | WorkflowAggregate |
| WorkflowFailed | other | workflow_instance | WorkflowAggregate |
| WorkflowCancelled | delete | workflow_instance | WorkflowAggregate |
| NotificationSent | notify | notification | NotificationAggregate |
| NotificationFailed | notify | notification | NotificationAggregate |
| NotificationMarkedRead | update | notification | NotificationAggregate |
| PreferencesUpdated | update | notification_preference | NotificationAggregate |
| TermAdded | create | term_value | VocabularyAggregate |
| TermValueDeprecated | other | term_value | VocabularyAggregate |
| ReportGenerated | other | report | ReportingAggregate |
| ReportExported | other | report | ReportingAggregate |
| BalanceCalculated | other | balance | ReportingAggregate |
| ResourceArchived | create | archive_entry | LifecycleAggregate |
| ResourceTrashed | delete | archive_entry | LifecycleAggregate |
| ResourcePurged | delete | archive_entry | LifecycleAggregate |
| ResourceRestoredFromTrash | update | archive_entry | LifecycleAggregate |
| PurgeScheduled | other | purge_schedule | LifecycleAggregate |
| SettingUpdated | update | setting | ConfigurationAggregate |
| SettingsResetToDefaults | other | settings | ConfigurationAggregate |
| SyncStarted | other | sync_session | OfflineSyncAggregate |
| BatchPushed | create | sync_batch | OfflineSyncAggregate |
| DeltaReceived | update | sync_delta | OfflineSyncAggregate |
| ConflictDetected | other | conflict | OfflineSyncAggregate |
| ConflictResolved | update | conflict | OfflineSyncAggregate |
| SyncCompleted | other | sync_session | OfflineSyncAggregate |
| ConnectionLost | other | connectivity | OfflineSyncAggregate |
| ConnectionRestored | other | connectivity | OfflineSyncAggregate |

### 4.4 Événements Exclusivement Audités (Pas de Notification)

Certains événements ne Génèrent PAS de notification mais SONT TOUJOURS audités :

| Catégorie | Événements | Raison |
|-----------|-----------|--------|
| PermissionCheck | PermissionGranted, PermissionDenied | Traçabilité de sécurité (RBAC) |
| SyncConflicts | ConflictDetected, ConflictResolved | Audit des résolutions automatique |
| RetryAttempts | NotificationFailed (retry), BatchPushed (retry) | Traçabilité infrastructure |
| ConfigChanges | SettingUpdated, SettingsResetToDefaults | Conformité (CFG-*) |
| ReportOps | ReportGenerated, ReportExported, BalanceCalculated | Preuve comptable |
| FormOps | FormSubmitted, FormSubmittedForApproval | Workflow pipeline |
| VocabularyOps | TermAdded, TermValueDeprecated | Audit des métadonnées |
| Read-Only | QueryAuditLogs, SearchResources, GetSettings, GetDescendants | Aucun state change = aucun audit |

**Règle constitutionnelle :** FormValidationFailed N'EST PAS audité car c'est un échec de validation (aucun state change). Il produit un retour UI uniquement (API-CONTRACT-002 ErrorContract).

### 4.5 Règles d'Immédiateté

```
Timing Rule (BR-AUD-001):
    AuditEntry appended BEFORE persistence commit.
    Order:
      1. Domain aggregate emits Event
      2. Application Service calls AuditPort.LogAction() ← parallele à la persistance
      3. RepositoryPort.save() persists the entity
      4. EventPublicationPort.publish() publishes the event

    La séquence garantit que si la persistance échoue, l'audit n'est pas écrit.
    Si l'audit échoue, la persistance réussit mais l'échec est loggué via LoggingPort (Port-009).
```

---

## 5. TRACABILITÉ COMPLETE

### 5.1 Chaîne de Preuve

```
DomainEvent (DOC-014)
  ├──→ AuditEntry (AuditAggregate, BR-AUD-001 à BR-AUD-006)
  │     └──→ Stored in: audit_logs table (DOC-023 §6)
  │           Retention: 7 years min (DOC-015 RETENTION-031)
  │           Access: admin/auditor only (DOC-015 ACCESS-033)
  │
  ├──→ Notification? (Mapping Matrix §3.3)
  │     ├──→ Yes → NotificationRouter (§3.1)
  │     │         ├──→ Filter by preferences (CHANNEL-003)
  │     │         ├──→ Filter by quiet hours (QUIET-004, critical bypass)
  │     │         ├──→ Enforce rate limit (RATE-002)
  │     │         ├──→ Dispatch to adapter (in_app/push/email/sms)
  │     │         └──→ Log delivery attempt (NotificationAggregate)
  │     │               ├──→ success → NotificationSent event (DOC-014)
  │     │               └──→ failure → NotificationFailed event (DOC-014)
  │     │                     └──→ AuditEntry(action='notify')
  │     └──→ No → Silent (only audit if state change)
  │
  └──→ OfflineSync? (syncable entities only)
        ├──→ ResourceAggregate, IdentityAggregate, OrganizationAggregate, LifecycleAggregate
        ├──→ PendingOperation created (OfflineSyncAggregate)
        └──→ Pushed via PushCoordinator when online
```

### 5.2 Matrice de Couverture Événements

| Aggregate | Total Events (DOC-014) | Generating Notification | Always Audited | Both (Notification + Audit) |
|-----------|----------------------|------------------------|----------------|----------------------------|
| OrganizationAggregate | 7 | 5 | 7 | 5 |
| IdentityAggregate | 9 | 4 | 7 | 4 |
| ResourceAggregate | 8 | 4 | 8 | 4 |
| RelationshipAggregate | 6 | 3 | 5 | 3 |
| WorkflowAggregate | 8 | 7 | 8 | 7 |
| FormAggregate | 3 | 0 | 1 | 0 |
| NotificationAggregate | 5 | 0 | 5 | 0 |
| VocabularyAggregate | 3 | 0 | 2 | 0 |
| ReportingAggregate | 3 | 0 | 3 | 0 |
| LifecycleAggregate | 5 | 1 | 5 | 1 |
| ConfigurationAggregate | 2 | 0 | 2 | 0 |
| OfflineSyncAggregate | 8 | 1 | 8 | 1 |
| **TOTAL** | **67** | **25** | **63** | **25** |

Note : 67 events au lieu de ~60 dans DOC-014 car certains commands émettent plusieurs events (ex: LoginUser → UserLoggedIn + SessionCreated).

### 5.3 Mapping des Notifications vers les Use Cases

Chaque notification est tracée vers un use case spécifique dans ASS-001 :

| Notification | UC Source | Command DOC-014 |
|-------------|-----------|----------------|
| Welcome after OrganizationCreated | UC-ORG-01 | CreateOrganization |
| Welcome after first login | UC-ID-02 | LoginUser |
| Role changed alert | UC-ID-03 | ChangeUserRole |
| Transaction approval request | UC-RES-02 | SubmitForApproval |
| Transaction approved/rejected | UC-RES-02/03 | ApproveTransaction/RejectTransaction |
| Workflow escalation | UC-WF-02 | Escalation (timeout) |
| Membership added | UC-REL-01 | AddMemberToGroup |
| Org suspended | UC-ORG-04 | SuspendOrganization |
| Org transferred | UC-REL-02 | TransferChildOrg |
| Sync conflict needs attention | Sync (auto) | Conflict detected |

---

## 6. INTERACTIONS CROSS-AGGREGATES

### 6.1 WorkflowAggregate → NotificationAggregate

Le WorkflowAggregate NE connait pas la syntaxe de notification. Il produit des DomainEvents (StepApproved, StepRejected, StepEscalated, etc.) qui sont consommés par NotificationService via EventSubscriptionPort (Port-003).

### 6.2 NotificationAggregate → AuditAggregate

Toutes les tentatives de livraison de notification sont auditées :
- NotificationSent → LogAction(action='notify', entite_type='notification', valeur_apres={notifId, sentAt})
- NotificationFailed → LogAction(action='notify', entite_type='notification', valeur_apres={notifId, error, retryCount})
- MarkAsRead → LogAction(action='update', entite_type='notification', valeur_apres={readAt})

### 6.3 AuditAggregate → NotificationAggregate

L'AuditAggregate NE déclenche JAMAIS de notification. Il est append-only et ne produit que ActionLogged (internal). Cependant :
- Un Admin puede consultar los logs de audit vía QueryAuditLogs (UC-AUD-01) y desde esa interfaz pode enviar una notificación manual si es necesario (a través de SendNotification con trigger_source='manual_audit_review').

### 6.4 OfflineSyncAggregate → NotificationAggregate

Les notifications sont synchronisées offline-first :
- NotificationQueued (event DOC-014) → OfflineSyncAggregate crée une PendingOperation(sync_action='create', entity_type='notification')
- Lors de la reconnect, la notification est pushed via NotificationPort.send()
- Si la livraison réussit → NotificationSent event + sync_status='confirmed'
- Si échec → NotificationFailed event + retry avec exponential backoff (SYNC-003)

### 6.5 ReportingAggregate → NotificationAggregate

Les rapports planifiés déclenchent des notifications :
- GenerateReport (command) → ReportGenerated (event) → Si rapport est "scheduled", NotificationService envoie un in_app au requester
- La génération elle-même est auditée (ReportGenerated event → AuditEntry)

---

## 7. NEVER BREAK RULES SPÉCIFIQUES

| Règle | Description | Source |
|-------|------------|--------|
| **NB-NEF-001** | JamaisConfondre_Event_Notification_Audit | Ces 5 concepts (§1) restent isolés dans leur aggregate respectif |
| **NB-NEF-002** | NotificationSansTriggerInterdit | NOT-001 : chaque notification a un trigger_source explicite |
| **NB-NEF-003** | AuditSansOldNewInterdit | OLDNEW-002 : jamais d'entry sans valeurs_avant ET valeurs_apres |
| **NB-NEF-004** | CriticalBypassQuietHours | QUIET-004 : severity=critical ignore les quiet hours |
| **NB-NEF-005** | InAppAlwaysDelivered | BR-NOT-003 : les notifications in_app ne dépendent PAS du réseau |
| **NB-NEF-006** | PushEmailOptionalGraceful | BR-NOT-004 : push/email/sms échouent gracefully, jamais en erreur bloquante |
| **NB-NEF-007** | AuditBeforePersist | BR-AUD-001 : l'audit est appendé AVANT le commit de la persistance |
| **NB-NEF-008** | NoSelfAudit | NB-PERSIST-007 : AuditAggregate ne s'audite pas lui-même |
| **NB-NEF-009** | RateLimitNonBloquant | NOT-002 : le rate limit ne bloque pas l'opération métier, il limite juste la notification |
| **NB-NEF-010** | EventRegistryAuthoritatif | DOC-014 : aucun event n'existe en dehors du registre DOC-014 |

---

## 8. SYNTHÈSE EXÉCUTIVE

Ce document spécifie le modèle de flux entre trois systèmes interdépendants :

1. **Domain Events** (DOC-014) — faits irréversibles qui traversent les frontières d'aggregate
2. **Notifications** (NotificationAggregate, DOC-012 §2.7) — communication utilisateur déclenchée par des événements
3. **Audit** (AuditAggregate, DOC-012 §2.10) — preuve immuable de toute modification d'état

Les règles fondamentales sont :
- Chaque DomainEvent a une destination claire : notification (mapping matrix §3.3), audit (toujours pour state change), ou silence (read/transient)
- Le routing de notification suit un algorithme déterministe (§3.1) respectant les préférences utilisateur, les horaires de silence, et les limites de taux
- L'audit capture toujours avant/après (§4.2) avec immutabilité constitutionnelle (NB-PERSIST-006, DOC-023 §6)
- La chaîne de preuve complète va : DomainEvent → AuditEntry → NotificationDeliveryAttempt → LogEntry

**Total événements couverts : 67** (tous listés dans DOC-014)
**Notifications générées : 25 types distincts** (sur 67 événements)
**Toujours audités : 63 types** (tous les state changes + certains read metadata)
**Invariants référencés : 30+** (NOT-001..004, AUD-001..006, BR-NOT-003..004, QUIET-004, RATE-002, etc.)

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Notification, Audit & Event Flow Model pour 13 Aggregates | CTO + Arch Principal |
