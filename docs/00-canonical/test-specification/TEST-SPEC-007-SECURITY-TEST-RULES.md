# Security Test Rules — Lumina v1
**Doc ID:** TEST-SPEC-007
**Version:** v1.0
**Statut:** SPECIFICATION DE TESTS DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["DOC-015", "API-CONTRACT-004", "API-CONTRACT-005", "RLS-POLICY-SPECIFICATION-V1.md", "ASS-002"]
**Transformation_rule :** "test-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the rules for security testing across the Lumina application. Security tests verify authentication, authorization, input validation, data exposure prevention, audit trail completeness, secrets management, and session security. They are organized by security boundary and traced to specific invariants, API contracts, and RBAC roles.

Security tests complement rather than replace other test levels. Unit tests verify domain invariant enforcement; integration tests verify correct authz checks at the Application Service layer; security tests verify the complete authentication/authorization stack and probe for common vulnerabilities.

Every decision traces to DOC-015 (security-related invariants), API-CONTRACT-004 (RBAC roles and permissions), API-CONTRACT-005 (error codes for auth/authz failures), RLS-POLICY-SPECIFICATION-V1.md (row-level security policies), and ASS-002 (operations requiring authN/authZ).

---

## SECTION 1: AUTHENTICATION (AUTHN) TESTS

Authentication tests verify that identity verification works correctly for all user types and edge cases.

### 1.1 Login Success Scenarios

| Scenario | Input | Expected Result | Source |
|----------|-------|----------------|--------|
| Valid credentials | Correct email + correct password hash | Session created; JWT issued; UserLoggedIn event emitted | UC-ID-05 |
| Valid superadmin login | superadmin@lumina.test + correct password | Session created; full superadmin privileges | UC-ID-05 |
| Org-scoped login | Valid email for org-A + org_id=A | Session scoped to org-A; org_id resolved | INV-004 (org_id gate) |
| Multi-factor (if implemented) | Credentials + second factor | Session created; MFA state recorded | System capability |

### 1.2 Login Failure Scenarios

| Scenario | Input | Expected Result | Error Code |
|----------|-------|----------------|-----------|
| Wrong password | Correct email + wrong password | Authentication rejected; no session created | E-401-003 INVALID_CREDENTIALS |
| Non-existent email | Unknown email + any password | Authentication rejected; generic message (no user enumeration) | E-401-003 INVALID_CREDENTIALS (same code, not differentiated) |
| Empty email | "" + password | Validation rejected | E-400-001 INVALID_INPUT |
| Empty password | email + "" | Validation rejected | E-400-001 INVALID_INPUT |
| Malformed email | "not-an-email" + password | Validation rejected | E-400-003 INVALID_FORMAT |
| Future-dated org context | Valid email + org_id from future-created org | Auth rejected; org doesn't exist | E-404-002 TENANT_NOT_FOUND |

### 1.3 Token Expiry Tests

| Scenario | Token State | Expected Result |
|----------|------------|-----------------|
| Expired access token | Past TTL | Request rejected with E-401-002 SESSION_EXPIRED |
| Expired refresh token | Past TTL | E-401-002 SESSION_EXPIRED; cannot issue new access token |
| Valid refresh, expired access | Refresh within TTL, access past TTL | New access token issued via refresh (UC-ID-07); old access rejected |
| Revoked refresh token | Session revoked (UC-ID-08) | E-404-003 SESSION_NOT_FOUND |

### 1.4 Session Management Tests

| Scenario | Action | Expected Result |
|----------|--------|-----------------|
| Concurrent sessions | Same user logs in from two contexts simultaneously | Both sessions active (unless concurrent session limit configured) |
| Session logout | User logs out (UC-ID-06) | All tokens invalidated; UserLoggedOut event emitted |
| Session revoke | Superadmin revokes specific session (UC-ID-08) | Revoked session immediately invalid; other sessions unaffected |
| Session reuse after logout | Attempt to use tokens after logout | Tokens rejected as expired/revoked |

---

## SECTION 2: AUTHORIZATION (AUTHZ) TESTS

Authorization tests verify RBAC role enforcement across all operations and boundaries.

### 2.1 RBAC Matrix Verification

Every operation from API-CONTRACT-001 must be tested against every relevant role from API-CONTRACT-004. The complete matrix is covered by these role-operation pairs:

| Role | Operations Tested | Key Authorization Checks |
|------|------------------|-------------------------|
| **superadmin** | CreateOrganization, TransferChildOrg, MergeOrganizations, ArchiveOrganization, SuspendOrganization, ChangeUserRole, AssignPermissionGrant | Can manage ALL orgs; can create any role; bypass RLS (session-configured) |
| **admin** | CreateUser (non-superadmin), UpdateSettings, ManageMembers, CreateTransaction, ApproveTransaction, TriggerWorkflow, ArchiveResource, UpdateSetting, ListArchiveEntries | Org-scoped; cannot create superadmin (BR-ID-005); cannot transfer/merge orgs |
| **treasurer** | CreateTransaction, SubmitForApproval, GenerateReport, CalculateBalance, ExportReport | Finance operations only; cannot manage users or org structure |
| **pastor** | ApproveTransaction, RejectTransaction, SubmitForApproval | Approval operations only; limited to approved role's scope |
| **staff** | SearchResources, GetOrganizationProfile, LoadForm, RenderForm, CheckConnectivity | Read-only access; cannot create/update/delete any entity |
| **system** | LogAction, TriggerWorkflow (auto), PushPendingOperations (auto), PurgeResource (scheduled) | System-initiated; not user-callable; operates on event triggers |

### 2.2 Permission Boundary Tests

For each of the 83 operations, verify:

| Test Case | Authorized Role | Unauthorized Role | Expected for Authorized | Expected for Unauthorized |
|-----------|----------------|-------------------|------------------------|--------------------------|
| UC-ORG-01 (CreateOrg) | superadmin | admin | Success (201) | E-403-001 INSUFFICIENT_PERMISSION |
| UC-ORG-02 (UpdateSettings) | admin | treasurer | Success (200) | E-403-001 INSUFFICIENT_PERMISSION |
| UC-RES-01 (CreateTx) | admin, treasurer | pastor, staff | Success (201) | E-403-001 INSUFFICIENT_PERMISSION |
| UC-RES-04 (ApproveTx) | admin, treasurer | staff | Success (200) | E-403-001 INSUFFICIENT_PERMISSION |
| UC-ID-05 (Login) | N/A (any valid user) | N/A | Session created | E-401-003 INVALID_CREDENTIALS |
| UC-ID-03 (ChangeRole) | superadmin only | admin | Success | E-403-001 INSUFFICIENT_PERMISSION |
| UC-AUD-01 (LogAction) | SYSTEM ONLY | any human role | Audit entry appended | E-403-001 (not callable by humans) |
| UC-AUD-Q01 (QueryAuditLogs) | admin, auditor | treasurer, pastor, staff | Audit entries returned | E-403-001 ACCESS-033 violation |

**Matrix size:** 83 operations x ~6 applicable roles x 2 outcomes = **~1,000 individual authz permutations minimum**. Each permutation is a distinct test.

### 2.3 Row-Level Filtering Verification

Beyond RBAC, RLS filters must be verified:

| Test | Setup | Expected Result |
|------|-------|-----------------|
| Org isolation read | Admin A queries resources | Only org_A resources returned |
| Org isolation write | Admin A attempts to update org_B resource | E-403-002 ORGANIZATION_MISMATCH or E-404-001 |
| Org isolation cross-org delete | Admin A attempts to delete org_B member | E-403-002 or E-404-001 |
| SuperAdmin bypass | SuperAdmin queries across all orgs | All orgs visible (RLS bypass configured at session level) |
| Cross-org membership | Member belongs to group in same org | Membership visible within org; cross-org membership check fails |

---

## SECTION 3: RLS VERIFICATION

Row-Level Security policies from RLS-POLICY-SPECIFICATION-V1.md are verified comprehensively.

### 3.1 Complete RLS Policy Matrix

All 32 tables x 9 PostgreSQL roles = **288 policy combinations**, each verified for SELECT, INSERT, UPDATE, DELETE permissions.

Key verification points per table:

| Table Category | Tables | Verification Method |
|---------------|--------|---------------------|
| Organization tables | organizations, org_units | org_id filter on SELECT; admin/superadmin write; others blocked |
| Identity tables | users, sessions, permission_grants | Email uniqueness constraint; password_hash never returned in query results |
| Resource tables | resource_records | org_id filter; version increment enforced; draft/approved status transitions |
| Relationship tables | group_memberships, org_unit_parent_links | org_id filter on all reads/writes; cycle detection via Kahn's algorithm |
| Workflow tables | workflow_instances, workflow_steps | org_id filter; timeout enforcement (WF-001); manual retry only (RETRY-004) |
| Form tables | form_definitions, form_fields | org_id filter; vocabulary references validated (VOCAB-002) |
| Notification tables | notifications, notification_preferences | org_id filter; user_id ownership (self-only updates) |
| Vocabulary tables | vocab_namespaces, vocab_terms, vocab_values | org_id filter; never-delete enforcement (VOC-001); key immutability (STABLE-003) |
| Audit tables | audit_logs | WRITE-ONLY append; READ restricted to admin/auditor (ACCESS-033); DELETE/UPDATE blocked (AUD-001) |
| Lifecycle tables | archive_entries | org_id filter; purge irreversibility (LIF-003); purge date enforcement (LIF-005) |
| Config tables | settings | org_id filter; format validation (CFG-001/002/003) |
| Sync tables | pending_operations, sync_status_trackers | org_id filter; local-first ordering (SYNC-001); batch size (SYNC-002) |

### 3.2 SuperAdmin Bypass Verification

The superAdmin RLS bypass mechanism is tested specifically:

| Scenario | Test | Expected |
|----------|------|---------|
| SuperAdmin creates org | Org created without org_id injection (auto-generated) | Works correctly |
| SuperAdmin reads all orgs | Query across all organizations returns all data | SuperAdmin sees everything |
| SuperAdmin modifies any entity | Update across any table for any org | Allowed; session bypass active |
| SuperAdmin bypass audit logging | Bypass usage logged in system audit | SET lumina.bypass_rls=true confirmed in audit trail |
| Non-superadmin cannot bypass | Admin user tries to set lumina.bypass_rls = true | Ignored; RLS still enforced |

### 3.3 RLS Post-Deployment Verification

After every migration or schema change:
1. Run RLS policy regression test suite (all 288 combinations)
2. Verify no orphaned policies from previous versions
3. Verify superAdmin bypass configuration persists post-migration
4. Verify new tables have RLS enabled by default (SECURITY DEFINER pattern)

---

## SECTION 4: INPUT VALIDATION TESTS

### 4.1 Injection Attempts

Each string input field across all aggregates is tested with injection patterns:

| Input Type | Fields Tested | Injection Patterns |
|-----------|--------------|-------------------|
| Email fields | user.email, member.email | SQL injection: `' OR '1'='1`; NoSQL: `{ $gt: '' }`; XSS: `<script>alert(1)</script>` |
| Name fields | firstName, lastName, organization name | SQL injection; Unicode confusion characters; zero-width characters |
| Transaction description | Transaction descriptions | SQL injection; extremely long strings (buffer overflow simulation) |
| Setting values | currency, timezone, accent_hex | Format violations: "dollar" (not ISO 4217), "est" (not IANA), "#ZZZ" (not hex) |
| Password fields | password_hash input | Weak password patterns; unicode homoglyph attacks |
| Form data | All form field values | JSON injection; deeply nested objects; array-in-object contexts |
| Parameterized inputs | UUIDs, dates, numbers | Malformed UUIDs; future dates; negative amounts; overflow integers |

### 4.2 Boundary Value Analysis

| Field | Valid Range | Boundary Tests |
|-------|------------|---------------|
| amount_cents | BIGINT > 0 | 1, MAX_BIGINT, 0 (rejected), -1 (rejected), float 1.5 (rejected) |
| transaction_date | <= today | today (accepted), tomorrow (rejected), 1 year ago (accepted), 100 years ago (accepted) |
| approval chain depth | <= 5 levels | 5 (accepted), 6 (rejected), 1 (accepted), 0 (rejected) |
| org unit depth | <= 5 levels | 5 (accepted), 6 (rejected), 0 roots (accepted) |
| push batch size | <= 50 ops | 50 (accepted), 51 (rejected), 1 (accepted), 0 (rejected) |
| retry count | <= 5 attempts | 5 (accepted attempt), 6 (rejected), 1 (accepted) |
| rate limit maxPerHour | integer > 0 | 1 (accepted), MAX_INT (accepted), 0 (rejected), -1 (rejected) |
| firstName/lastName | non-empty string | "A" (accepted), "" (rejected), spaces only (rejected), max length (boundary) |

### 4.3 Enum Validation

All enum fields tested with valid and invalid values:

| Enum Type | Valid Values | Invalid Test Values |
|-----------|-------------|-------------------|
| OrganizationType | church, school, ngo, company, custom | "hospital", "123", "", null |
| UserRole | superadmin, admin, treasurer, pastor, staff | "manager", "owner", "", null |
| ResourceState | draft, pending, approved, rejected, active, inactive, deceased, transferred | "deleted", "archived", "", null |
| ChannelType | in_app, push, email, sms | "webhook", "", null |
| SeverityLevel | info, warning, critical | "urgent", "", null |
| SyncAction | create, update, delete | "merge", "split", "" |
| ConflictStrategy | LWW, server_wins, immutable, uuid_dedup, side_by_side | "random", "", null |
| LifecycleState | draft, active, archived, trashed, purged | "closed", "", null |
| StepType | auto, approval, notification, conditional, delay, parallel | "manual", "", null |

---

## SECTION 5: DATA EXPOSURE TESTS

### 5.1 Sensitive Data Never Returned

Verify that sensitive data is never present in API responses:

| Data Type | Must Be Masked/Hashed | Where to Verify |
|-----------|----------------------|-----------------|
| password_hash | ALWAYS — never in any response body or error message | Every API response involving users |
| refreshToken | Hash stored; plain text NEVER returned after initial login | API responses, logs, error messages |
| JWTToken | Ephemeral; never persisted; never returned in read queries | Session queries, audit logs |
| Email address | Visible to authorized roles only; not exposed in aggregate listings | Search results, profile data outside IdentityAggregate |
| IP address | Stored in audit log but not returned in normal API responses | API responses to user queries |

### 5.2 API Response Inspection

For every response type:

| Test | Description |
|------|------------|
| Response field audit | Every field in every response verified against API-CONTRACT-002 schema; unexpected fields flagged |
| Null handling | Fields with null values handled gracefully; no null pointer exceptions in serialization |
| Empty collection | Fields with no matching data return [] not null (consistent convention) |
| Error response inspection | Error responses contain only error code + message; no stack trace, no internal paths, no DB details |
| Pagination metadata | Total counts accurate; page boundaries enforced; no data duplication across pages |

### 5.3 Log Content Inspection

Test that sensitive data does not appear in:
- Application logs
- Debug output
- Error stack traces
- Audit log entries (password_hash must NOT appear)
- Event payloads (password_hash, refresh tokens excluded)

---

## SECTION 6: AUDIT TRAIL VERIFICATION

### 6.1 AUD-001 Compliance — Every Mutation Creates Audit Entry

All 57 commands from DOC-014 MUST create an audit log entry. Verification:

| Command Category | Sample Commands Verified | Audit Fields Checked |
|-----------------|------------------------|---------------------|
| Organization | CreateOrganization, UpdateSettings, CreateOrgUnit, SuspendOrganization | action, entityType, entityId, userId, timestamp, org_id |
| Identity | CreateUser, UpdateProfile, ChangeRole, ResetPassword, LoginUser, LogoutUser | action (CREATE/UPDATE/CHANGE_ROLE/RESET_PASSWORD/LOGIN/LOGOUT), userId, timestamp |
| Resource | CreateTransaction, UpdateDraft, Approve, Reject, Compensate, CreateMember | action, oldValues + newValues (OLDNEW-002), createdBy |
| Relationship | AddToGroup, RemoveFromGroup, SetOrgUnitParent | action, relationshipType, sourceId, targetId |
| Workflow | Trigger, ApproveStep, RejectStep, Cancel | action, workflowInstanceId, stepIndex |
| Lifecycle | Archive, Trash, Purge, Restore | action, lifecycleState transition (old → new) |
| Configuration | UpdateSetting, ResetDefaults | action, settingKey, oldSettingValue, newSettingValue |
| Sync | PushOps, PullChanges, ResolveConflict | action, syncStatus transition, operation count |

### 6.2 Audit Trail Completeness Test

After executing a sequence of operations:

```
Given:
  - Complete sequence of 5 mutations (create → update → submit → approve → compensate)

When:
  - Invoke QueryAuditLogs for the affected resource

Then:
  - Exactly 5 ActionLogged entries found
  - Each entry has: entityType, entityId, action, userId, timestamp
  - Each entry has BOTH oldValues AND newValues (OLDNEW-002)
  - Entries ordered chronologically by timestamp
  - No entries from other organizations (org_id scoped)
  - Audit log is append-only: no entry has been modified or deleted
```

### 6.3 Audit Retention Verification (RETENTION-031)

| Test | Setup | Expected Result |
|------|-------|-----------------|
| Recent entry | Entry created < 7 years ago | Not eligible for purge; RETENTION-031 enforces |
| Old entry | Entry created >= 7 years ago | Eligible for purge scheduling |
| Purge attempt before 7 years | PurgeScheduler runs; entry aged 6 years 11 months | Entry retained; no purge action |
| Purge execution after 7 years | PurgeScheduler runs; entry aged 7 years 1 month | Purge allowed; entry removed; purge logged |

---

## SECTION 7: SECRETS MANAGEMENT

### 7.1 No Hardcoded Secrets

Verification that no secrets appear in:
- Source code files (*.ts, *.js, *.py, *.json, *.yaml)
- Test fixtures or seed data
- Configuration files committed to version control
- Environment variable defaults in source code

Secrets subject to this rule:
- Database connection strings
- API keys / service account credentials
- JWT signing keys
- Encryption keys (AES, RSA)
- Third-party service credentials (email provider, SMS gateway, push notification)

### 7.2 Secret Rotation

Tests verifying secret rotation does not break functionality:
- Rotate JWT signing key → existing valid tokens rejected (expected: short-lived access tokens mitigate); new requests with fresh login succeed
- Rotate database password → connection pool re-established with new credentials; no data loss
- Rotate encryption key → existing encrypted data re-encrypted or decrypt-fallback path available

### 7.3 Secret Storage in Tests

Test secrets follow stricter rules than production:
- Test database password: injected via environment variable, never in test code
- Test JWT signing key: derived deterministically from test name (for reproducibility), not random per run
- Test API keys: mock service accepts any key in test environment; real keys never used

---

## SECTION 8: SESSION SECURITY

### 8.1 Token Binding

| Test | Expected Result |
|------|-----------------|
| Token replay | Access token used from different session/user context → rejected (E-403-001 or E-401-002) |
| Token reuse after logout | Token captured before logout, used after logout → rejected as expired/revoked |
| Token sharing | Same refresh token used simultaneously from two devices → both sessions remain active (until concurrency limit configured) |
| Token storage | Access token stored in memory-only (never localStorage/sessionStorage in web context) |

### 8.2 Device Fingerprinting

If device fingerprinting is configured:
- New device login with valid credentials → accepted; new session created
- Revoking session on one device does NOT revoke other device sessions (unless UC-ID-08 revoke-any is used)
- Concurrent session limit enforced if configured (e.g., max 5 sessions per user)

### 8.3 Concurrent Session Limits

| Scenario | Limit Configured | Expected Behavior |
|----------|-----------------|-------------------|
| 5 concurrent sessions | Max 5 allowed | 5th session created successfully; 6th either rejected or oldest evicted |
| Session cleanup | User revokes all sessions (UC-ID-08 any) | All sessions invalidated; user must re-authenticate |
| SuperAdmin revokes any | SuperAdmin revokes User X's session | User X immediately logged out from ALL devices |

---

## SECTION 9: SECURITY TEST COVERAGE SUMMARY

| Category | Min Tests | Source |
|----------|-----------|--------|
| Authentication success scenarios | 4 | UC-ID-05, INV-008 |
| Authentication failure scenarios | 7 | UC-ID-05 error paths |
| Token expiry/refresh | 5 | UC-ID-06, UC-ID-07, UC-ID-08 |
| RBAC boundary tests (per operation x role x outcome) | ~1,000 | API-CONTRACT-004 + API-CONTRACT-001 |
| RLS policy verification (32 tables x 9 roles x 4 ops) | ~1,152 | RLS-POLICY-SPECIFICATION-V1.md |
| Injection attempts (per string field x pattern) | ~100 | Input validation Section 4 |
| Boundary value analysis (per numeric/date field) | ~50 | Boundary Value Section 4.2 |
| Enum validation (per enum type x invalid value) | ~30 | Enum validation Section 4.3 |
| Data exposure (response fields x sensitive data type) | ~20 | Section 5 |
| Audit trail completeness (57 commands) | 57 | AUD-001, OLDNEW-002, RETENTION-031 |
| Secrets management | 5 | Section 7 |
| Session security | 8 | Section 8 |
| **TOTAL MINIMUM** | **~1,378** | |

Note: The RBAC matrix (~1,000) dominates the security test count. This reflects the comprehensive nature of authorization testing: every operation must be verified against every applicable role in both allowed and denied configurations.

---

## APPENDIX A: SECURITY TEST TRACEABILITY TO INVARIANTS

| Invariant | Security Test Category | Test Focus |
|-----------|----------------------|------------|
| INV-004 (org isolation) | RLS verification | org_id scoping at every layer |
| INV-008 (credential validation) | AuthN tests | Login success/failure, double validation |
| BR-ID-005 (role creation hierarchy) | AuthZ tests | Admin cannot create superadmin |
| WF-005 (financial not modified directly) | AuthZ tests | Workflow cannot write approved transactions |
| AUD-001 (immutable audit log) | Audit trail tests | Cannot UPDATE or DELETE audit entries |
| OLDNEW-002 (old+new snapshot) | Audit trail tests | Both snapshots always present |
| RETENTION-031 (7-year retention) | Audit retention tests | Purge only after 7 years |
| ACCESS-033 (restricted audit access) | AuthZ tests | Only admin/auditor can read audit logs |
| SYNC-001 (local first) | Data exposure tests | Remote write without local write blocked |
| LOG-005 (execution states logged) | Audit trail tests | All workflow states create audit entries |

---

## APPENDIX B: DOCUMENT REVISION HISTORY

| Version | Date | Author | Change |
|---------|------|--------|--------|
| v1.0 | 2026-07-25 | Agnes-2.0-Flash (Sapiens AI) | Genesis definition of security test rules |

---

*This security test specification defines mandatory verification of all authentication, authorization, input validation, data exposure, audit trail, secrets management, and session security boundaries.*

*FIN DU DOCUMENT TEST-SPEC-007*
