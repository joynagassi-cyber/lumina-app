# Request & Response Contract Catalog — Lumina v1

**Doc ID:** API-CONTRACT-002
**Version:** v1.0
**Statut:** CONTRAT CANONIQUE DEFINI PAR GENESIS
**Date:** 2026-07-25
**Generateur :** api-contract-generator v1.0
**Source canonique :** ["DOC-012", "DOC-013", "DOC-014", "DOC-015", "DOC-021"]
**Transformation_rule :** "api-contract-generator v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document definit les contrats de donnees echanges entre clients et services, sans format technique specifique. Les types mentionnes sont des types du domaine, pas des types de serialization.

Chaque operation d'API-CONTRACT-001 a un request contract (input) et un response contract (output).

---

## 2.1 REQUEST CONTRACTS

### Request Contract: CreateOrganization

**Applies to:** OrganizationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| name | STRING | YES | non-empty string | DOC-021 §2.1 |
| type | ENUM | YES | IN('church','school','ngo','company','custom') | DOC-012 |
| settings | JSONB | NO | currency ISO 4217, timezone IANA, accent hex | DOC-021 §2.3 |

Input validation pipeline:
1. Schema validation: all required fields present, correct types
2. Invariant validation: INV-004 (org isolation guaranteed by auto-generated org_id)
3. Domain rule validation: BR-ORG-001 (name non vide, type enum valide)

---

### Request Contract: UpdateOrganizationSettings

**Applies to:** OrganizationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| key | STRING | YES | setting_key from ConfigurationAggregate schema | DOC-021 |
| value | ANY | YES | format depends on key (ISO 4217 / IANA / hex) | DOC-015 CFG-* |

Input validation pipeline:
1. Key must exist in configuration schema
2. Value validated against format rules:
   - currency: ISO 4217 regex
   - timezone: IANA timezone list
   - accent_hex: ^#[0-9a-fA-F]{6}$ + WCAG contrast check
3. Invariant: CFG-004 (every key has default fallback)

---

### Request Contract: CreateOrgUnit

**Applies to:** OrganizationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| name | STRING | YES | non-empty string | DOC-021 §2.2 |
| parent_id | UUID | NO | valid UUID, references existing OrgUnit or null | DOC-021 |
| unit_type | ENUM | YES | IN(valid org_unit_types) | DOC-012 |
| depth_level | INT32 | COMPUTED | automatically computed; must be ≤5 | DOC-013, REL-002 |

Input validation pipeline:
1. parent_id resolves to existing unit within same org
2. DAG cycle detection via topological sort (Kahn's algo)
3. depth_level computed from parent + 1, checked ≤5

---

### Request Contract: UpdateOrgUnitParent

**Applies to:** OrganizationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| unit_id | UUID | YES | exists within same org | DOC-021 |
| new_parent_id | UUID | YES | exists within same org; not self-reference | DOC-021 |

Input validation pipeline:
1. Both units in same org_id
2. No cycle created (Kahn's algo)
3. Depth revalidated after change

---

### Request Contract: TransferChildOrg

**Applies to:** OrganizationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| child_org_id | UUID | YES | exists | DOC-021 |
| new_parent_id | UUID | YES | exists; not the same org | DOC-021 |

Input validation pipeline:
1. child_org_id exists
2. no cycle created
3. SuperAdmin authorization required

---

### Request Contract: MergeOrganizations

**Applies to:** OrganizationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| source_org_id | UUID | YES | exists | DOC-021 |
| target_org_id | UUID | YES | exists; different from source | DOC-021 |

Input validation pipeline:
1. Both organizations in same heritage DAG
2. SuperAdmin authorization
3. Source marked archived post-merge

---

### Request Contract: ArchiveOrganization

**Applies to:** OrganizationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| org_id | UUID | YES | exists; status is not already archived | DOC-021 |

No additional payload needed — state transition active → archived.

---

### Request Contract: SuspendOrganization

**Applies to:** OrganizationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| org_id | UUID | YES | exists; status is active | DOC-021 |

State transition: active → suspended. Write locked post-suspend.

---

### Request Contract: CreateUser

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| email | EMAIL_ADDRESS | YES | unique within org; valid email format | DOC-015 EMAIL-001 |
| password_hash | HASH_STRING | YES | strong hash (complexity regex) | DOC-015 BR-ID-001 |
| role | ENUM | YES | IN('superadmin','admin','treasurer','pastor','staff') | DOC-012 |
| first_name | STRING | YES | non-empty | DOC-021 |
| last_name | STRING | YES | non-empty | DOC-021 |
| phone | PHONE_NUMBER | NO | formatted per region | DOC-015 PHONE-003 |
| org_id | UUID | YES | exists | DOC-021 |

Input validation pipeline:
1. Email uniqueness within org (EMAIL-001)
2. Password hash strength validation (BR-ID-001)
3. Role creation rules: Admin cannot create superadmin (BR-ID-005)

---

### Request Contract: UpdateUserProfile

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| user_id | UUID | YES | exists | DOC-021 |
| updates | JSONB | YES | subset of updatable fields | DOC-021 |

Updatable fields: first_name, last_name, phone, email (subject to EMAIL-001)
password_hash is NOT updatable through this command (use ResetPassword)

---

### Request Contract: ChangeUserRole

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| user_id | UUID | YES | exists | DOC-021 |
| new_role | ENUM | YES | valid role; respects hierarchy | DOC-012 |

SuperAdmin only. Role hierarchy enforced.

---

### Request Contract: ResetPassword

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| user_id | UUID | YES | exists | DOC-021 |
| new_password_hash | HASH_STRING | YES | strong hash (complexity regex) | DOC-015 BR-ID-001 |

Self-request or Admin-force.

---

### Request Contract: LoginUser

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| email | EMAIL_ADDRESS | YES | exists within specified org | DOC-021 |
| password | HASH_INPUT | YES | matches stored password_hash | DOC-015 INV-008 |
| org_id | UUID | YES | valid, matches user's organization | DOC-021 |

---

### Request Contract: LogoutUser

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| session_id | UUID | YES | exists and is active | DOC-021 |

---

### Request Contract: RefreshAccessToken

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| refresh_token_hash | HASH_STRING | YES | exists in DB; not expired | DOC-021 |

---

### Request Contract: RevokeSession

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| session_id | UUID | YES | exists | DOC-021 |

Self or SuperAdmin.

---

### Request Contract: AssignPermissionGrant

**Applies to:** IdentityAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| role_id | UUID | YES | exists | DOC-021 |
| permission_string | STRING | YES | format resource:action:level | DOC-012 |

Format: "resource:action:level" — e.g., "transaction:create:org"

---

### Request Contract: CreateTransaction

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| org_id | UUID | YES | valid UUID, non-null | DOC-021 §8 |
| amount_cents | INT64 | YES | > 0 (FIN-002) | DOC-015 FIN-002 |
| type | ENUM | YES | IN('income','expense','transfer','adjustment') | DOC-021 §3.1 |
| status | ENUM | NO | IN('draft','pending','approved','rejected'), default 'draft' | DOC-021 §3.1 |
| category_ref | UUID | YES | exists in vocab_values | DOC-021 §3.1 |
| scope_type | ENUM | YES | IN('org','group') | DOC-021 §3.1 |
| scope_target_id | UUID | NO | valid UUID if present | DOC-021 §3.1 |
| transaction_date | DATE | YES | <= CURRENT_DATE | DOC-015 DATE-001 |
| description | TEXT | NO | max 1024 chars | DOC-021 §3.1 |
| compensates_for | UUID | NO | valid UUID if present, references existing transaction | DOC-021 §3.1 |
| approved_by | UUID | NO | valid UUID if present | DOC-021 §3.1 |

Input validation pipeline:
1. Schema validation: all required fields present, correct types
2. Existence validation: org_id → organizations, category_ref → vocab_values
3. Invariant validation: FIN-002 (amount > 0), DATE-001 (not future), CAT-001 (vocab category)
4. Domain rule validation: DESC-001 (description min 1 char if amount > 100)

---

### Request Contract: UpdateDraftTransaction

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| transaction_id | UUID | YES | exists; status = 'draft' | DOC-015 FIN-001 |
| updates | JSONB | YES | subset of updatable fields for draft | DOC-021 §3.1 |

Guard: FIN-001 — if transaction is NOT draft, reject immediately. Approved transactions are immutable.

---

### Request Contract: SubmitForApproval

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| transaction_id | UUID | YES | exists; status = 'draft' | DOC-012 |

State transition: draft → pending.

---

### Request Contract: ApproveTransaction

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| transaction_id | UUID | YES | exists; status = 'pending' | DOC-012 |
| approver_id | UUID | YES | valid; has approve permission grant | DOC-012 |

State transition: pending → approved.

---

### Request Contract: RejectTransaction

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| transaction_id | UUID | YES | exists; status = 'pending' | DOC-012 |
| reason | TEXT | YES | non-empty; comment obligatoire | DOC-012 |

State transition: pending → rejected. Reason required.

---

### Request Contract: CompensateTransaction

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| original_transaction_id | UUID | YES | exists; status = 'approved' | DOC-015 COMP-001 |
| compensation_data | JSONB | YES | follows same fields as CreateTransaction | DOC-021 |

Creates a new transaction with compensates_for = original_transaction_id.

---

### Request Contract: CreateMember

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| org_id | UUID | YES | exists | DOC-021 |
| first_name | STRING | YES | non-empty | DOC-015 MEM-001 |
| last_name | STRING | YES | non-empty | DOC-015 MEM-001 |
| email | EMAIL_ADDRESS | NO | unique within org if provided | DOC-015 EMAIL-001 |
| phone | PHONE_NUMBER | NO | formatted per region | DOC-015 PHONE-003 |
| date_of_birth | DATE | NO | age between 0 and 120 years | DOC-015 AGE-004 |
| initial_status | ENUM | NO | IN('active','inactive','deceased','transferred'), default 'active' | DOC-015 STATUS-010 |

---

### Request Contract: UpdateMember

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| member_id | UUID | YES | exists | DOC-021 |
| updates | JSONB | YES | subset of updatable fields | DOC-021 |

Guard: MEM-001 — firstName+lastName always mandatory (cannot be cleared).

---

### Request Contract: TransitionMemberStatus

**Applies to:** ResourceAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| member_id | UUID | YES | exists | DOC-021 |
| new_status | ENUM | YES | IN('active','inactive','deceased','transferred') | DOC-015 STATUS-010 |

Transfert vers autre eglise necessite certificat (TRANS-012).

---

### Request Contract: SearchResources

**Applies to:** ResourceAggregate (Query)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| org_id | UUID | YES | from session context | DOC-021 §8 |
| resource_type | ENUM | NO | filter by type | DOC-012 |
| status | ENUM | NO | filter by state | DOC-012 |
| date_from | DATE | NO | inclusive lower bound | DOC-021 |
| date_to | DATE | NO | inclusive upper bound | DOC-021 |
| category_ref | UUID | NO | filter by vocabulary category | DOC-021 |
| search_text | STRING | NO | full-text search | DOC-021 |

---

### Request Contract: ExportResources

**Applies to:** ResourceAggregate (Query)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| org_id | UUID | YES | from session context | DOC-021 §8 |
| format | ENUM | YES | IN('pdf','csv','json') | DOC-015 EXPORT-001 |
| filters | JSONB | NO | same as SearchResources filters | DOC-021 |

---

### Request Contract: AddMemberToGroup

**Applies to:** RelationshipAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| member_id | UUID | YES | exists | DOC-021 |
| group_id (org_unit_id) | UUID | YES | exists within same org | DOC-021 |

Guard: MULTI-020 — no duplicate membership (PK enforce).

---

### Request Contract: RemoveMemberFromGroup

**Applies to:** RelationshipAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| member_id | UUID | YES | exists | DOC-021 |
| group_id (org_unit_id) | UUID | YES | membership exists | DOC-021 |

HISTORY-022 — history preserved in audit trail.

---

### Request Contract: SetOrgUnitParent

**Applies to:** RelationshipAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| unit_id | UUID | YES | exists within same org | DOC-021 |
| parent_unit_id | UUID | YES | exists; not self; not descendant | DOC-021 |

Rel-001 (Kahn's algo — no cycles), REL-002 (depth ≤5).

---

### Request Contract: TriggerWorkflow

**Applies to:** WorkflowAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| definition_key | STRING | YES | exists in manifest | DOC-012 |
| resource_type | ENUM | YES | valid resource type | DOC-012 |
| resource_id | UUID | YES | exists | DOC-021 |
| trigger_event | STRING | YES | matches workflow trigger definition | DOC-012 |

System auto-trigger or Admin manual trigger.

---

### Request Contract: ApproveStep

**Applies to:** WorkflowAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| instance_id | UUID | YES | workflow instance running | DOC-012 |
| step_id | UUID | YES | step is approval type; assigned to approver | DOC-012 |
| comment | TEXT | NO | optional approval comment | DOC-012 |

CHAINS-003 — approval chain ≤5 levels.

---

### Request Contract: RejectStep

**Applies to:** WorkflowAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| instance_id | UUID | YES | workflow instance running | DOC-012 |
| step_id | UUID | YES | step is approval type; assigned to approver | DOC-012 |
| reason | TEXT | YES | non-empty; mandatory | DOC-012 |

---

### Request Contract: CancelWorkflow

**Applies to:** WorkflowAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| instance_id | UUID | YES | workflow running | DOC-012 |
| reason | TEXT | YES | explanation for cancellation | DOC-012 |

Only running workflows can be cancelled.

---

### Request Contract: ResubmitForApproval

**Applies to:** WorkflowAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| instance_id | UUID | YES | workflow rejected or in_revision | DOC-012 |

RETRY-004 — manual retry only, no auto-retry.

---

### Request Contract: LoadFormDefinition

**Applies to:** FormAggregate (Query)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| form_id | STRING | YES | exists in manifest | DOC-012 |
| version | STRING | NO | semantic version; defaults to latest | DOC-012 FRM-004 |

---

### Request Contract: ValidateFormData

**Applies to:** FormAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| form_id | STRING | YES | loaded form definition exists | DOC-012 |
| form_data | JSONB | YES | data to validate against form schema | DOC-012 |

DUAL-008 — client validation MUST match server validation exactly.

---

### Request Contract: SendNotification

**Applies to:** NotificationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| recipient_user_id | UUID | YES | exists | DOC-021 |
| channel | ENUM | YES | IN('in_app','push','email','sms') | DOC-012 |
| body | TEXT | YES | notification content | DOC-012 |
| severity | ENUM | NO | IN('info','warning','critical'); default 'info' | DOC-012 |
| trigger_source | STRING | YES | identifies what triggered this notification | DOC-015 NOT-001 |

NOT-001 — every notification MUST have a trigger (never spontaneous).

---

### Request Contract: MarkAsRead

**Applies to:** NotificationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| notification_id | UUID | YES | belongs to requesting user (self only) | DOC-012 |

---

### Request Contract: UpdatePreferences

**Applies to:** NotificationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| user_id | UUID | YES | self or admin update | DOC-021 |
| channels | LIST | NO | subset of ['in_app','push','email','sms'] | DOC-012 |
| severity_min | ENUM | NO | IN('info','warning','critical') | DOC-012 |
| rate_limit_per_hour | INT32 | NO | integer > 0 | DOC-012 |

CHANNEL-003 — preferences respected going forward.

---

### Request Contract: SetRateLimit

**Applies to:** NotificationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| user_id | UUID | YES | admin-specified user | DOC-021 |
| max_per_hour | INT32 | YES | > 0 | DOC-015 RATE-002 |

---

### Request Contract: SuppressUntil

**Applies to:** NotificationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| user_id | UUID | YES | admin-specified user | DOC-021 |
| until_time | TIMESTAMP | YES | future timestamp | DOC-012 |

QUIET-004 — critical severity bypasses suppression.

---

### Request Contract: AddTermValue

**Applies to:** VocabularyAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| namespace | STRING | YES | exists in vocabulary | DOC-012 |
| term_key | STRING | YES | unique within namespace | DOC-015 STABLE-003 |
| label_fr | STRING | YES | non-empty French label | DOC-015 TRANSLATION-002 |
| label_en | STRING | YES | non-empty English label | DOC-015 TRANSLATION-002 |
| color_hex | STRING | NO | #RRGGBB pattern | DOC-012 |

---

### Request Contract: DeprecateTermValue

**Applies to:** VocabularyAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| namespace | STRING | YES | exists | DOC-012 |
| term_key | STRING | YES | exists within namespace | DOC-012 |
| value_key | STRING | YES | exists and not already deprecated | DOC-015 VOC-001 |

VOC-001 — deprecation is IRREVERSIBLE. Values are never deleted.

---

### Request Contract: GenerateReport

**Applies to:** ReportingAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| report_type | STRING | YES | defined in reporting definitions | DOC-012 |
| period_start | DATE | YES | valid date | DOC-015 MONTH-001 |
| period_end | DATE | YES | valid date; >= period_start | DOC-015 MONTH-001 |
| scope | ENUM | YES | IN('org','group','all','partial_consolidation') | DOC-012 |
| format | ENUM | NO | IN('pdf','csv','json'); default json | DOC-015 EXPORT-001 |

BAL-001 — balance must balance (Actif = Passif + Resultat).

---

### Request Contract: CalculateBalance

**Applies to:** ReportingAggregate (Query)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| scope | ENUM | YES | IN('org','group','all','partial_consolidation') | DOC-012 |
| period_start | DATE | YES | valid date | DOC-015 |
| period_end | DATE | YES | valid date; >= period_start | DOC-015 |

Only synced=1 (approved) transactions participate (SYNCED-001).

---

### Request Contract: ExportReport

**Applies to:** ReportingAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| report_id | UUID | YES | previously generated report | DOC-012 |
| format | ENUM | YES | IN('pdf','csv','json') | DOC-015 EXPORT-001 |

EXPORT-001 — export includes timestamp + digital signature.

---

### Request Contract: LogAction

**Applies to:** AuditAggregate (SYSTEM ONLY)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| entity_type | STRING | YES | domain entity type identifier | DOC-012 |
| entity_id | UUID | YES | identifier of affected entity | DOC-012 |
| action | ENUM | YES | IN('create','update','delete','approve','reject','transfer','notify','*') | DOC-012 |
| old_values | JSONB | YES | snapshot before change (AUD-002) | DOC-015 OLDNEW-002 |
| new_values | JSONB | YES | snapshot after change (AUD-002) | DOC-015 OLDNEW-002 |
| user_id | UUID | YES | who performed the action | DOC-012 |

Not user-callable — auto-invoked by other aggregates on state change.

---

### Request Contract: QueryAuditLogs

**Applies to:** AuditAggregate (Query)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| filters | JSONB | YES | subset: date_range, entity_type, user_id, action | DOC-012 |
| pagination | JSONB | NO | page_number, page_size (max 100) | DOC-012 |

ACCESS-033 — restricted to admin/auditor roles only.

---

### Request Contract: ArchiveResource

**Applies to:** LifecycleAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| resource_type | STRING | YES | archivable type configured in manifest | DOC-015 LIF-001 |
| resource_id | UUID | YES | exists in ResourceAggregate | DOC-021 |

LIF-001 — states configurable via manifest.lifecycle.types[].

---

### Request Contract: TrashResource

**Applies to:** LifecycleAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| archive_id | UUID | YES | exists; state = 'archived' | DOC-012 |

State transition: archived → trashed.

---

### Request Contract: PurgeResource

**Applies to:** LifecycleAggregate (SYSTEM ONLY)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| archive_id | UUID | YES | exists; state = 'trashed'; purge_date reached | DOC-015 LIF-005 |

LIF-003 — purge is FINAL. IRREVERSIBLE. Not user-callable.

---

### Request Contract: RestoreFromTrash

**Applies to:** LifecycleAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| archive_id | UUID | YES | exists; state = 'trashed' | DOC-012 |

State transition: trashed → archived. LIF-003 guard — must not be purged.

---

### Request Contract: ListArchiveEntries

**Applies to:** LifecycleAggregate (Query)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| filters | JSONB | NO | type, tags, state, date_range | DOC-012 LIF-006 |

LIF-006 — trashed entries excluded from normal query.

---

### Request Contract: SearchArchives

**Applies to:** LifecycleAggregate (Query)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| query_string | STRING | YES | full-text search expression | DOC-021 |
| tags | LIST | NO | filter by tags | DOC-012 |
| type | STRING | NO | filter by archivable type | DOC-012 |

---

### Request Contract: ApplyTags

**Applies to:** LifecycleAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| archive_id | UUID | YES | exists | DOC-021 |
| tags | LIST | YES | array of tag strings | DOC-012 |

---

### Request Contract: SchedulePurge

**Applies to:** LifecycleAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| archive_id | UUID | YES | exists; state = 'trashed' or 'archived' | DOC-021 |
| purge_date | DATE | YES | future date; configured per type | DOC-015 LIF-005 |

---

### Request Contract: UpdateSetting

**Applies to:** ConfigurationAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| key | STRING | YES | from ConfigurationAggregate settings schema | DOC-012 |
| value | ANY | YES | format depends on key | DOC-015 CFG-* |

Format validation:
- currency: ISO 4217
- timezone: IANA
- accent_hex: ^#[0-9a-fA-F]{6}$ + WCAG contrast check

---

### Request Contract: ResetToDefaults

**Applies to:** ConfigurationAggregate

No payload required — resets ALL settings to template defaults.
CFG-004 — every setting has a default fallback.

---

### Request Contract: PushPendingOperations

**Applies to:** OfflineSyncAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| operations | LIST | YES | array of PendingOperation payloads | DOC-012 |

SYNC-002 — batch size ≤50. SYNC-003 — exponential backoff on failure.

---

### Request Contract: PullRemoteChanges

**Applies to:** OfflineSyncAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| since_timestamp | TIMESTAMP | YES | last successful sync timestamp | DOC-012 |

SYNC-004 — user ops never blocked during pull.

---

### Request Contract: ResolveConflict

**Applies to:** OfflineSyncAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| operation_id | UUID | YES | conflicting operation | DOC-012 |
| conflict_data | JSONB | YES | server-side data causing conflict | DOC-012 |
| strategy | ENUM | YES | IN('LWW','server_wins','immutable','uuid_dedup','side_by_side') | DOC-012 |

SYNC-001 — local write always precedes remote. Strategy per entity type.

---

### Request Contract: MarkConfirmed

**Applies to:** OfflineSyncAggregate

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| operation_id | UUID | YES | successfully synced operation | DOC-012 |

Sync status transitions: sent → confirmed.

---

### Request Contract: CheckConnectivity

**Applies to:** OfflineSyncAggregate (Query)

No payload — returns current connectivity state.

---

### Request Contract: GetSyncStatus

**Applies to:** OfflineSyncAggregate (Query)

| Field | Type | Required | Validations | Source |
|-------|------|----------|-------------|--------|
| table_name | STRING | YES | name of tracked table | DOC-012 |

Returns SyncStatusTracker data.

---

## 2.2 RESPONSE CONTRACTS

### Standard Success Response (for all Commands)

Every successful command response contains:

| Field | Type | Condition | Description |
|-------|------|-----------|-------------|
| success | BOOLEAN | Always | true if command accepted |
| version | INT32 | Always | Optimistic lock version (initially 1 for creates) |
| created_at | TIMESTAMP | On creates | Creation timestamp |
| events_emitted | EventList | Always | List of domain events fired |

Successful response represents: command accepted, invariants passed, events emitted.

### Standard Query Response (for all Queries)

Every successful query response contains:

| Field | Type | Condition | Description |
|-------|------|-----------|-------------|
| data | ENTITY_LIST | Always | The requested entities/data |
| count | INT32 | Always | Number of items returned |

---

### Event List Structure (standardized across all aggregates)

| Event | Condition | Payload Summary |
|-------|-----------|-----------------|
| OrganizationCreated | On CreateOrganization | orgId, name, type |
| SettingUpdated | On UpdateSetting (any aggregate) | settingKey, updatedAt |
| OrgUnitCreated | On CreateOrgUnit | orgUnitId, parentId, unitType, depthLevel |
| OrgUnitParentChanged | On UpdateOrgUnitParent | orgUnitId, oldParent, newParent |
| ChildOrgTransferred | On TransferChildOrg | childOrgId, newParentId |
| ChildOrgMerged | On MergeOrganizations | sourceOrgId, targetOrgId |
| OrganizationArchived | On ArchiveOrganization | orgId, archivedAt |
| OrganizationSuspended | On SuspendOrganization | orgId, suspendedAt |
| UserCreated | On CreateUser | userId, email, role, orgId |
| UserUpdated | On UpdateUserProfile | userId, changedFields |
| UserRoleChanged | On ChangeUserRole | userId, oldRole, newRole |
| PasswordResetRequested | On ResetPassword | userId, resetTimestamp |
| UserLoggedIn | On LoginUser | userId, orgId, loginTimestamp |
| UserLoggedOut | On LogoutUser | userId, sessionEndedAt |
| SessionCreated | On LoginUser OR RefreshAccessToken | sessionId, expiresAt, userId |
| SessionRevoked | On RevokeSession | sessionId, revokedBy, revokedAt |
| ResourceCreated | On CreateTransaction OR CreateMember | resourceId, resourceType, orgId, createdBy |
| ResourceUpdated | On Update* commands | resourceId, resourceType, changes(diff), version |
| ResourceStateChanged | On Approve/Reject/Transition | resourceId, resourceType, oldState, newState |
| TransactionCompensated | On CompensateTransaction | originalTxId, compensationTxId |
| ApprovalRequested | On SubmitForApproval | resourceId, requestedBy |
| ApprovalGranted | On ApproveTransaction | resourceId, approvedBy, approvedAt |
| ApprovalRejected | On RejectTransaction | resourceId, rejectedBy, reason |
| MemberJoinedGroup | On AddMemberToGroup | memberId, groupId, joinedAt |
| MemberLeftGroup | On RemoveMemberFromGroup | memberId, groupId, leftAt |
| OrgUnitReparented | On SetOrgUnitParent (Relationship) | unitId, oldParentId, newParentId |
| WorkflowTriggered | On TriggerWorkflow | instanceId, triggerEvent, resourceType |
| StepApproved | On ApproveStep | instanceId, stepId, approvedBy |
| StepRejected | On RejectStep | instanceId, stepId, rejectedBy, reason |
| WorkflowCancelled | On CancelWorkflow | instanceId, cancelledBy, reason |
| FormSubmitted | On ValidateFormData succeeds | formId, submittedAt |
| FormValidationFailed | On ValidateFormData rejects | formId, fieldName, errorCode |
| NotificationSent | On SendNotification succeeds | notificationId, channel, sentAt |
| NotificationMarkedRead | On MarkAsRead | notificationId, readAt |
| PreferencesUpdated | On UpdatePreferences | userId, channels, rateLimit |
| TermAdded | On AddTermValue | namespace, termKey |
| TermValueDeprecated | On DeprecateTermValue | namespace, termKey, deprecatedValue |
| ReportGenerated | On GenerateReport | reportId, reportType, period |
| BalanceCalculated | On CalculateBalance | scope, period, totals |
| ResourceArchived | On ArchiveResource | archiveId, resourceType, archivedAt |
| ResourceTrashed | On TrashResource | archiveId, trashedAt |
| ResourcePurged | On PurgeResource | archiveId, purgedAt |
| ResourceRestoredFromTrash | On RestoreFromTrash | archiveId, restoredAt |
| SettingUpdated (Config) | On UpdateSetting (Configuration) | settingKey, oldValue, newValue |
| SettingsResetToDefaults | On ResetToDefaults | resetAt, resetBy |
| BatchPushed | On PushPendingOperations | batchCount, pushedAt |
| DeltaReceived | On PullRemoteChanges | table, count, sinceTimestamp |
| ConflictResolved | On ResolveConflict | resourceType, resourceId, winner |
| SyncCompleted | On MarkOperationConfirmed | orgId, pushCount, pullCount |

---

## 2.3 ERROR CONTRACT STANDARD

Every error response MUST contain:

| Field | Type | Description |
|-------|------|-------------|
| error_code | STRING | Stable identifier from API-CONTRACT-005 taxonomy |
| message | STRING | Human-readable explanation |
| details | OBJECT | Optional additional context |
| request_id | UUID | Correlation ID for tracing |

Error categories defined in API-CONTRACT-005 (Error Taxonomy).
Error code format: E-XXX-NNN where XXX is HTTP-equivalent category and NNN is sequential code.

---

## 2.4 PAGINATION, FILTERING, SEARCH CONTRACTS

### Pagination Contract

Standard pagination envelope:

| Field | Type | Description |
|-------|------|-------------|
| items | LIST | The actual results |
| total_count | INT64 | Total matching items |
| page_number | INT32 | Current page (1-indexed) |
| page_size | INT32 | Items per page |
| has_next | BOOLEAN | true if more pages available |
| has_prev | BOOLEAN | true if previous pages available |

Max page_size: 100 items per page.

### Filtering Contract

Each query operation supports filtering by org_id (MANDATORY — enforced at boundary level).
Additional filters per Aggregate are documented in respective Query operations above.

### Search Contract

If search is supported, it uses a standardized text-matching interface:

| Field | Type | Description |
|-------|------|-------------|
| query_string | STRING | Full-text search expression |
| fields | LIST | Fields to search within |
| operator | STRING | AND/OR/NOT logic |

Search is available on: SearchResources (ResourceAggregate), SearchArchives (LifecycleAggregate), SearchTerms (VocabularyAggregate).
