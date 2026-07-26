# Error Taxonomy — Lumina v1

**Doc ID:** API-CONTRACT-005
**Version:** v1.0
**Statut:** CONTRAT CANONIQUE DEFINI PAR GENESIS
**Date:** 2026-07-25
**Generateur :** api-contract-generator v1.0
**Source canonique :** ["DOC-014", "DOC-015", "DOC-016"]
**Transformation_rule :** "api-contract-generator v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document definit la taxonomie CANONIQUE des erreurs que TOUTE implementation de Lumina DOIT utiliser. Les codes d'erreur sont stables, protocol-agnostiques, et tracables vers des invariants specifiques du DOC-015.

Chaque code d'erreur suit le format: `E-XXX-NNN` ou `E-XXX-NNN_INV-XXX` (avec reference d'invariant optionnelle).

---

## ERROR CATEGORIES

### E-400 BAD_REQUEST — Client Input Errors

The client sent invalid input data. The request schema is malformed or values are outside allowed ranges.

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| E-400-001 | INVALID_INPUT | Required field missing or malformed type | Fix input and retry |
| E-400-002 | INVALID_VALUE | Field value outside allowed range (e.g., amount <= 0) | Correct value within constraints |
| E-400-003 | INVALID_FORMAT | Field doesn't match expected pattern (email, hex, ISO 4217, IANA) | Use correct format |
| E-400-004 | INVALID_ENUM | Enum value not in allowed set | Use valid enum member |
| E-400-005 | INVALID_REFERENCE | UUID references non-existent entity | Use valid entity IDs |
| E-400-006 | INVALID_DATES | Date range invalid (end < start, future date for transaction) | Correct dates |
| E-400-007 | INVALID_PAYLOAD | JSONB payload structure doesn't match expected schema | Restructure payload |

**Mapped invariants:** None (schema-level validation only, before invariant checking)

---

### E-401 UNAUTHORIZED — Authentication Errors

The client is not authenticated or authentication is invalid.

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| E-401-001 | NOT_AUTHENTICATED | No valid session/credentials provided | Authenticate first |
| E-401-002 | SESSION_EXPIRED | Session token expired | Refresh or re-authenticate |
| E-401-003 | INVALID_CREDENTIALS | Email/password hash don't match | Check credentials |

**Mapped invariants:** INV-008 (double validation of credentials — LoginUser)

---

### E-403 FORBIDDEN — Authorization Errors

The client is authenticated but lacks sufficient permissions.

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| E-403-001 | INSUFFICIENT_PERMISSION | User lacks required RBAC permission for this action | Request access upgrade |
| E-403-002 | ORGANIZATION_MISMATCH | org_id from request doesn't match user's session org | Check tenant context |
| E-403-003 | ROLE_VIOLATION | User attempted action outside their role hierarchy (e.g., admin creating superadmin) | Use appropriate role |
| E-403-004 | SUSPENDED_ORG | Organization is suspended; write operations blocked | Wait for org reactivation by SuperAdmin |
| E-403-005 | ARCHIVED_ORG | Organization is archived; operations blocked | Restore org first |

**Mapped invariants:** BR-ORG-006 (suspended org → write locked); role creation rules (BR-ID-005)

---

### E-404 NOT_FOUND — Entity Not Found

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| E-404-001 | ENTITY_NOT_FOUND | Referenced entity (user, transaction, member, etc.) doesn't exist | Use valid entity IDs |
| E-404-002 | TENANT_NOT_FOUND | org_id doesn't exist or user has no access to this org | Verify organization |
| E-404-003 | SESSION_NOT_FOUND | Session ID doesn't exist or already revoked | Re-authenticate |
| E-404-004 | FORM_NOT_FOUND | Form definition key not found in manifest | Check form_id validity |
| E-404-005 | VOCAB_TERM_NOT_FOUND | Namespace/term/value combination doesn't exist | Use valid vocabulary path |
| E-404-006 | WORKFLOW_DEFINITION_NOT_FOUND | Workflow trigger/definition not found in manifest | Check workflow definition key |

---

### E-409 CONFLICT — State Conflicts

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| E-409-001 | OPTIMISTIC_LOCK_CONFLICT | Version mismatch during write operation | Retry with latest version |
| E-409-002 | UNIQUE_VIOLATION | Duplicate unique constraint violated (email, name, etc.) | Use different value |
| E-409-003 | INVALID_TRANSITION | State machine transition not allowed from current state | Check current state; valid transitions documented per aggregate |
| E-409-004 | DUPLICATE_MEMBERSHIP | Member already belongs to specified group (PK constraint) | Skip or remove existing membership |
| E-409-005 | ALREADY_DEPRECATED | Term value already deprecated (irreversible operation) | No action needed — already in target state |
| E-409-006 | ALREADY_PURGED | Entry already purged — cannot restore (LIF-003) | Purge is irreversible; entry no longer exists |

---

### E-422 DOMAIN_VIOLATION — Invariant Violations

Domain invariants from DOC-015 were violated. These errors MUST include the specific invariant ID.

| Code | Name | Description | Resolution | Mapped Invariant |
|------|------|-------------|------------|-----------------|
| E-422-001 | INVARIANT_VIOLATED | Domain invariant check failed | Change input to comply | General — see detail for specific INV |
| E-422-002 | BUSINESS_RULE_BREACH | Business rule from DOC-016 would be violated | Adjust operation parameters | General — see detail for specific BR |

#### Detailed invariant-specific error mappings:

| Extended Code | Name | Triggers From | Detail |
|---------------|------|--------------|--------|
| E-422-001-FIN-001 | APPROVED_TRANSACTION_IMMUTABLE | UpdateDraftTransaction on non-draft tx | Transaction is approved/cancelled — use CompensateTransaction instead | FIN-001 |
| E-422-001-FIN-002 | AMOUNT_NOT_POSITIVE | CreateTransaction with amount_cents <= 0 | Amount must be > 0 in BIGINT cents | FIN-002 |
| E-422-001-DATE-001 | DATE_IN_FUTURE | Transaction with transaction_date > today | Date must be today or earlier | DATE-001 |
| E-422-001-CAT-001 | VOCAB_CATEGORY_MISSING | Category ref doesn't exist in vocabulary | Use valid vocab_values category_ref | CAT-001 |
| E-422-001-DESC-001 | DESCRIPTION_REQUIRED_FOR_LARGE_AMOUNT | Amount > 100 without description | Add description text | DESC-001 |
| E-422-001-VERSION-001 | VERSION_NOT_INCREMENTED | Write operation didn't increment version | Application error — enforce versioning | VERSION-001 |
| E-422-001-CREATEBY-001 | CREATED_BY_MISSING | Resource created without createdBy | injected from auth context at boundary | CREATEBY-001 |
| E-422-001-COMP-001 | COMPENSATION_LINK_MISSING | Compensating transaction without compensates_for | Reference original transaction ID | COMP-001 |
| E-422-001-SCOPE-001 | SCOPE_UNDEFINED | Transaction without scope_type | scope_type is mandatory | SCOPE-001 |
| E-422-001-MEM-001 | NAME_REQUIRED | Member created without firstName or lastName | firstName AND lastName always required | MEM-001 |
| E-422-001-EMAIL-001 | EMAIL_DUPLICATE_ORG | Email already exists within this org | Use different email | EMAIL-001 |
| E-422-001-STATUS-010 | INVALID_MEMBER_STATUS | Status not in active/inactive/deceased/transferred | Use valid status enum | STATUS-010 |
| E-422-001-DISABLE-011 | INACTIVE_CANNOT_TRANSACT | Inactive member tries to create transaction | Member must be active | DISABLE-011 |
| E-422-001-REL-001 | HIERARCHY_CYCLE_DETECTED | SetOrgUnitParent would create DAG cycle | Choose different parent; cycle detected by Kahn's algo | REL-001 |
| E-422-001-REL-002 | DEPTH_EXCEEDED | Org depth > 5 | Max depth is 5 | REL-002 |
| E-422-001-WF-001 | STEP_TIMEOUT_EXCEEDED | Workflow step past 30-day timeout | Timeout enforced; escalate or cancel | WF-001 |
| E-422-001-WF-005 | WORKFLOW_MODIFIES_APPROVED_TX | Workflow attempts direct financial write | Workflows cannot modify approved transactions directly | WF-005 |
| E-422-001-RETRY-004 | AUTO_RETRY_BLOCKED | System attempted automatic workflow retry | Only manual resubmit allowed (RETRY-004) | RETRY-004 |
| E-422-001-FRM-009 | HARDCODED_FORM_DETECTED | FormRenderer encounters hardcoded JSX | All forms must come from FormDefinition | FRM-009 |
| E-422-001-VOCAB-002 | VOCAB_OPTION_MISSING | Select references vocabulary term that doesn't exist | Use vocabulary terms only | VOCAB-002 |
| E-422-001-DUAL-008 | CLIENT_SERVER_VALIDATION_MISMATCH | Client and server produce different validation results | Must use identical validation schema both sides | DUAL-008 |
| E-422-001-LOCK-004 | SENSITIVE_FORM_MODIFIED | Financial form modified after submission | Financial forms are read-only after submission | LOCK-004 |
| E-422-001-NOT-001 | SPONTANEOUS_NOTIFICATION | SendNotification called without trigger_source | Every notification must have a trigger | NOT-001 |
| E-422-001-RATE-002 | RATE_LIMIT_EXCEEDED | Too many notifications per hour for user/org | Wait for rate window to reset | RATE-002 |
| E-422-001-CHANNEL-003 | CHANNEL_PREFERENCE_BLOCKED | Notification channel blocked by user preference | Respect user channel preferences | CHANNEL-003 |
| E-422-001-QUIET-004 | QUIET_HOURS_VIOLATION | Non-critical notification during quiet hours | Critical severity bypasses; others wait | QUIET-004 |
| E-422-001-VOC-001 | DELETE_VALUE_ATTEMPTED | Attempted to delete vocabulary value | Values can only be deprecated, never deleted | VOC-001 |
| E-422-001-TRANSLATION-002 | MINIMUM_TRANSLATIONS_NOT_MET | Term created without both FR and EN labels | Minimum FR+EN translations required | TRANSLATION-002 |
| E-422-001-STABLE-003 | KEY_MODIFICATION_ATTEMPTed | Attempted to change term key | Keys are immutable after creation | STABLE-003 |
| E-422-001-AUD-001 | AUDIT_LOG_MODIFY_ATTEMPTED | Attempted UPDATE or DELETE on audit log | Audit logs are append-only, immutable | AUD-001 |
| E-422-001-AUD-OLDNEW-002 | AUDIT_MISSING_SNAPSHOT | LogAction called without old_values or new_values | Both old AND new snapshots required | OLDNEW-002 |
| E-422-001-LIF-001 | NON_ARCHIVABLE_TYPE | Attempted archive of resource_type not in manifest | Type must be declared in manifest.lifecycle.types[] | LIF-001 |
| E-422-001-LIF-003 | PURGE_ATTEMPTED_ON_ACTIVE_ENTRY | PurgeResource called on non-trashed entry | Entry must be trashed before purge; purge is final | LIF-003 |
| E-422-001-LIF-005 | PURGE_DATE_NOT_REACHED | PurgeResource called before purge_date | Wait until configured purge date | LIF-005 |
| E-422-001-CFG-001 | INVALID_CURRENCY_FORMAT | Setting updated with non-ISO 4217 currency | Use ISO 4217 format (e.g., CDF, USD, EUR) | CFG-001 |
| E-422-001-CFG-002 | INVALID_TIMEZONE | Setting updated with non-IANA timezone | Use IANA format (e.g., Africa/Lubumbashi) | CFG-002 |
| E-422-001-CFG-003 | INVALID_ACCENT_COLOR | Accent color fails hex or WCAG validation | Use #RRGGBB with sufficient contrast | CFG-003 |
| E-422-001-SYNC-001 | REMOTE_WRITE_BEFORE_LOCAL | Sync pushed remote before local write completed | Local write ALWAYS precedes remote | SYNC-001 |
| E-422-001-SYNC-002 | BATCH_SIZE_EXCEEDED | Push batch contains > 50 operations | Maximum batch size is 50 | SYNC-002 |
| E-422-001-SYNC-003 | MAX_RETRIES_EXCEEDED | Operation exceeded 5 retry attempts with exponential backoff | Operation marked as permanently failed | SYNC-003 |
| E-422-001-SYNC-004 | SYNC_BLOCKED_USER_OP | Sync operation blocked a user-initiated action | User ops never depend on sync synchronously | SYNC-004 |

---

### E-500 INTERNAL_ERROR — System Errors

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| E-500-001 | UNEXPECTED_ERROR | Unknown system error — unexpected condition | Log and contact support |
| E-500-002 | PERSISTENCE_FAILURE | Database operation failed (connectivity, constraint violation not covered above) | Retry after exponential backoff |
| E-500-003 | SERIALIZATION_ERROR | Domain event payload couldn't be serialized | Internal error — check event payload structure |
| E-500-004 | DEPENDENCY_FAILURE | Dependent aggregate service unavailable | Retry; may indicate cascading failure |

---

## ERROR MAPPING TABLE: INVARIANT → ERROR CODE

This table maps every DOC-015 invariant that can produce a client-facing error to its canonical error code.

| Doc-015 Invariant | Error Code(s) | Aggregate | Client-Facing? |
|------------------|---------------|-----------|----------------|
| FIN-001 (Immutabilite Comptable) | E-422-001-FIN-001 | ResourceAggregate | Yes |
| FIN-002 (Montant Toujours Positif) | E-422-001-FIN-002 | ResourceAggregate | Yes |
| DATE-001 (Date Jamais Futur) | E-422-001-DATE-001 | ResourceAggregate | Yes |
| CAT-001 (Category Issue du Vocabulaire) | E-422-001-CAT-001 | ResourceAggregate | Yes |
| DESC-001 (Description Obligation si >100) | E-422-001-DESC-001 | ResourceAggregate | Yes |
| VERSION-001 (Version Tjs Incremente) | E-422-001-VERSION-001 | ResourceAggregate | No (internal guard) |
| CREATEBY-001 (CreatedBy Tjs Defini) | E-422-001-CREATEBY-001 | ResourceAggregate | No (injected, not user-caused) |
| COMP-001 (Compensation Link) | E-422-001-COMP-001 | ResourceAggregate | Yes |
| SCOPE-001 (Scope Toujours Defini) | E-422-001-SCOPE-001 | ResourceAggregate | Yes |
| BAL-001 (Bilan Equilibre) | E-500-001 (system internal) | ReportingAggregate | No (computational integrity) |
| MONTH-001 (Rapport Mensuel Complet) | E-400-006 (date range) | ReportingAggregate | Yes |
| EXPORT-001 (Export Horodate) | E-500-001 | ReportingAggregate | No (automatic) |
| ARCHIVED-001 (Rapport Archive Immuable) | E-422-001 (general invariant) | ReportingAggregate | Partial |
| SYNCED-001 (Synced Participent) | E-500-001 | ReportingAggregate | No (filter applied internally) |
| MEM-001 (Prenom+Nom Obl) | E-422-001-MEM-001 | ResourceAggregate | Yes |
| EMAIL-001 (Email Unique Par Org) | E-422-001-EMAIL-001 | IdentityAggregate | Yes |
| PHONE-003 (Tel Format) | E-400-003 | IdentityAggregate | Yes |
| AGE-004 (Age 0-120) | E-400-002 | IdentityAggregate | Yes |
| DUP-005 (Dup Email Detecte) | E-409-002 | IdentityAggregate | Yes |
| STATUS-010 (Etats Valid) | E-422-001-STATUS-010 | ResourceAggregate | Yes |
| DISABLE-011 (Inactive Cannot Transact) | E-422-001-DISABLE-011 | ResourceAggregate | Yes |
| TRANS-012 (Transfert Necertificat) | E-400-001 (missing doc) | RelationshipAggregate | Yes |
| REL-001 (DAG Sans Cycles) | E-422-001-REL-001 | RelationshipAggregate | Yes |
| DEPTH-002 (Profondeur Max 5) | E-422-001-REL-002 | RelationshipAggregate | Yes |
| MULTI-020 (Multi-Membership Autorisee) | E-409-004 | RelationshipAggregate | Yes |
| ATTR-021 (Attribution Validee) | E-422-001 (workflow guard) | WorkflowAggregate | Yes |
| HISTORY-022 (Historique Conserve) | E-500-001 (audit side-effect) | AuditAggregate | No |
| WF-001 (Timeout Max 30j) | E-422-001-WF-001 | WorkflowAggregate | Yes |
| ESCALATE-002 (Escalade Oblige) | E-500-001 | WorkflowAggregate | No (auto-triggered) |
| CHAINS-003 (Approval Chain ≤5) | E-422-001 (chain guard) | WorkflowAggregate | Partial |
| RETRY-004 (Retry Manuel Seulement) | E-422-001-RETRY-004 | WorkflowAggregate | Yes |
| LOG-005 (Execution States Logged) | E-500-001 | WorkflowAggregate | No |
| WF-005 (Financial Not Modified Directly) | E-422-001-WF-005 | WorkflowAggregate | Yes |
| FRM-009 (JSON→UI Only) | E-422-001-FRM-009 | FormAggregate | No (dev-time guard) |
| VOCAB-002 (Select From Vocabulary) | E-422-001-VOCAB-002 | FormAggregate | Yes |
| DUAL-008 (Validation Double) | E-422-001-DUAL-008 | FormAggregate | No (dev-time guard) |
| LOCK-004 (Sensitive Forms Locked) | E-422-001-LOCK-004 | FormAggregate | Yes |
| NOT-001 (Trigger Toujours Present) | E-422-001-NOT-001 | NotificationAggregate | Yes |
| RATE-002 (Rate Limit Enforced) | E-422-001-RATE-002 | NotificationAggregate | Yes |
| CHANNEL-003 (Preferences Respectees) | E-422-001-CHANNEL-003 | NotificationAggregate | Yes |
| QUIET-004 (Quiet Hours) | E-422-001-QUIET-004 | NotificationAggregate | Yes |
| VOC-001 (Never Delete Values) | E-422-001-VOC-001 | VocabularyAggregate | Yes |
| TRANSLATION-002 (Min FR+EN) | E-422-001-TRANSLATION-002 | VocabularyAggregate | Yes |
| STABLE-003 (Keys Stable Forever) | E-422-001-STABLE-003 | VocabularyAggregate | Yes |
| AUD-001 (Journal Immuable) | E-422-001-AUD-001 | AuditAggregate | Yes |
| OLDNEW-002 (Old+New Value) | E-422-001-AUD-OLDNEW-002 | AuditAggregate | No (system-only) |
| RETENTION-031 (Conservation Min 7 Ans) | E-422-001 (retention guard) | AuditAggregate | Partial |
| ACCESS-033 (Acces Restreint) | E-403-001 | AuditAggregate | Yes |
| LIF-001 (States Configurable Par Manifest) | E-422-001-LIF-001 | LifecycleAggregate | Yes |
| LIF-003 (Purge Irrversible) | E-422-001-LIF-003, E-409-006 | LifecycleAggregate | Yes |
| LIF-005 (Purge Date Configurable) | E-422-001-LIF-005 | LifecycleAggregate | Yes |
| CFG-001 (Currency ISO 4217) | E-422-001-CFG-001 | ConfigurationAggregate | Yes |
| CFG-002 (Timezone IANA) | E-422-001-CFG-002 | ConfigurationAggregate | Yes |
| CFG-003 (Accent Color Valid Hex) | E-422-001-CFG-003 | ConfigurationAggregate | Yes |
| CFG-004 (Default Fallback) | E-500-001 | ConfigurationAggregate | No (automatic) |
| SYNC-001 (Local First Absolute) | E-422-001-SYNC-001 | OfflineSyncAggregate | Yes |
| SYNC-002 (Batch Size Max 50) | E-422-001-SYNC-002 | OfflineSyncAggregate | Yes |
| SYNC-003 (Retry Exponential Backoff Max 5) | E-422-001-SYNC-003 | OfflineSyncAggregate | Yes |
| SYNC-004 (User Ops Never Block) | E-422-001-SYNC-004 | OfflineSyncAggregate | No (architectural guard) |

Total invariants mapped to client-facing errors: ~45 out of 58.
Invariants not producing client-facing errors are either:
- System-enforced automatically (VERSION-001, CREATEBY-001, LOG-005, etc.)
- Development-time guards (FRM-009, DUAL-008)
- Read-only filters (BAL-001, MONTH-001, EXPORT-001, SYNCED-001)
