# Permission Visibility Rules — Lumina v1

**Doc ID:** UI-SPEC-005
**Version:** v1.0
**Statut:** SPECIFICATION UI DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-004", "ASS-001", "DOC-015"]
**Transformation_rule :** "ui-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **canonical permission-to-visibility mapping** for every screen and action in Lumina. Visibility is determined exclusively by RBAC roles defined in API-CONTRACT-004, applied through a deterministic 5-step algorithm. No element appears on any screen unless the user's roles grant them permission to see it.

This specification uses role names and permissions as defined in API-CONTRACT-004. The 9 effective role instances are: superadmin, admin, treasurer, pastor, staff, auditor, assigned_approver, self, and system. The first 5 are formal RBAC roles; the remaining 4 are contextual role instances derived from the base roles.

---

## SECTION 1: RBAC-TO-VISIBILITY MAPPING

### 1.1 Role Summary (from API-CONTRACT-004)

| Role | Permissions Granted | Can Create | Can Approve | Can Administer | Scope |
|------|--------------------|------------|-------------|----------------|-------|
| **superadmin** | ALL permissions (wildcard "*") | All users (any role) | All workflows | All organizations | Global |
| **admin** | transaction:*, member:*, event:*, form:read/write, lifecycle:*, config:*, reporting:read | Members, transactions, events | Transactions | Org units, settings, users (non-superadmin) | Single org |
| **treasurer** | transaction:create, transaction:approve, transaction:read | Transactions only | Transactions within threshold | None | Single org |
| **pastor** | transaction:read, workflow:approve, notification:read | None | Workflows (approval steps) | None | Single org |
| **staff** | resource:read (query only on all types) | None | None | None | Single org |
| **auditor** | audit:read, audit:export | N/A | N/A | N/A | Single org (read-only of audit) |
| **assigned_approver** | workflow:read, workflow:approve (for assigned steps only) | N/A | Workflow steps assigned to them | N/A | Single org |
| **self** | user:update:self, password:reset:self, notification:read:self, notification:pref:self | N/A | N/A | Own profile only | Self |
| **system** | sync:push, sync:pull, sync:resolve (auto-triggered) | N/A | N/A | N/A | All orgs (background) |

### 1.2 Visibility Matrix: Screen Access

The following matrix shows which roles can SEE each screen. "YES" means the screen is visible in the navigation rail and accessible via deep link. "NO" means the screen is hidden entirely.

| Screen ID | SuperAdmin | Admin | Treasurer | Pastor | Staff | Auditor | Assigned Approver | Self | System |
|-----------|-----------|-------|-----------|--------|-------|---------|------------------|------|--------|
| SCR-ORG-001 DashboardOrg | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-ORG-002 SettingsOrg | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-ID-001 UserList | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-ID-002 UserDetail | YES | YES | NO | NO | NO | NO | NO | YES (own) | NO |
| SCR-ID-003 Login | YES | YES | YES | YES | YES | YES | YES | YES | NO |
| SCR-ID-004 Profile | YES | YES | YES | YES | YES | NO | NO | YES | NO |
| SCR-RES-001 TransactionList | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-RES-002 TransactionDetail | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-RES-003 TransactionCreate | YES | YES | YES | NO | NO | NO | NO | NO | NO |
| SCR-RES-004 TransactionEdit | YES | YES | YES | NO | NO | NO | NO | NO | NO |
| SCR-MEM-001 MemberList | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-MEM-002 MemberDetail | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-MEM-003 MemberCreate | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-EVT-001 EventList | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-EVT-002 EventDetail | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-EVT-003 EventCreate | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-REL-001 GroupMembershipList | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-REL-002 OrgHierarchy | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-WF-001 WorkflowQueue | YES | YES | NO | NO | NO | NO | YES | NO | NO |
| SCR-WF-002 WorkflowInstance | YES | YES | NO | NO | NO | NO | YES | NO | NO |
| SCR-FRM-001 FormBuilder | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-FRM-002 FormPreview | YES | YES | YES | YES | YES | NO | NO | NO | NO |
| SCR-NOT-001 Inbox | YES | YES | YES | YES | YES | NO | YES | YES | NO |
| SCR-NOT-002 NotificationPreferences | YES | YES | YES | YES | YES | NO | YES | YES | NO |
| SCR-VOC-001 CategoryList | YES | YES | YES | YES | YES | YES | YES | YES | NO |
| SCR-VOC-002 NamespaceManage | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-RPT-001 ReportDashboard | YES | YES | YES | NO | NO | NO | NO | NO | NO |
| SCR-RPT-002 ReportSnapshot | YES | YES | YES | NO | NO | NO | NO | NO | NO |
| SCR-AUD-001 AuditLogViewer | YES | YES | NO | NO | NO | YES | NO | NO | NO |
| SCR-LIF-001 ArchiveBrowser | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-LIF-002 PurgeScheduler | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-CFG-001 SettingsConfig | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-CFG-002 SettingManage | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-SYNC-001 SyncStatusPanel | YES | YES | YES | YES | YES | YES | YES | YES | NO |
| SCR-SYNC-002 PendingOpsViewer | YES | YES | NO | NO | NO | NO | NO | NO | NO |
| SCR-CRD-001 ApprovalDetail | YES | YES | NO | NO | NO | NO | YES | NO | NO |
| SCR-CRD-002 ArchiveDetailView | YES | YES | NO | NO | NO | NO | NO | NO | NO |

**Key visibility rules applied:**
- staff role: see ONLY read screens (lists, details) — never create/edit/action screens
- auditor role: see ONLY AuditAggregate screens + SyncStatusPanel (monitoring)
- assigned_approver: see ONLY workflow-related screens where they have an active assignment
- self: see ONLY their own profile, inbox, preferences, and Login screen
- superadmin: see EVERYTHING across ALL organizations
- admin: see everything within their single org scope

---

## SECTION 2: ROW-LEVEL PERMISSIONS

Even when a screen is visible to a role, not all rows within that screen's data may be visible. Row-level scoping filters the data displayed in DataTables based on the user's position in the organizational hierarchy.

### 2.1 Row-Level Scoping Rules

| Data Type | Scoping Rule | Visible Rows | Hidden Rows |
|-----------|-------------|-------------|-------------|
| **Users** (SCR-ID-001, SCR-ID-002) | Admin sees all users in their org; superadmin sees all users across all orgs; self sees only own row | org.users WHERE org_id = session.org_id (admin); all orgs (superadmin); own row (self) | Users from other orgs (admin); all users except self (self) |
| **Transactions** (SCR-RES-001) | Creator and approvers see all; general readers see only approved or scoped transactions | All transactions in org (admin, treasurer); approved transactions only (pastor, staff); transactions with matching scope_target | Draft/pending transactions (pastor, staff if scope doesn't match their group) |
| **Members** (SCR-MEM-001) | Admin sees all; others see members in groups they belong to (via RelationshipAggregate) | All members (admin); members in user's groups (treasurer, pastor, staff) | Members in groups the user does not belong to |
| **Events** (SCR-EVT-001) | Admin sees all; others see published events and events in groups they join | All events (admin); published/completed events (pastor, staff); draft events only for creators | Draft events (pastor, staff non-creators); cancelled events (viewable but grayed) |
| **Group Memberships** (SCR-REL-001) | Admin sees all memberships; others see memberships involving their own groups or themselves | All groups+members (admin); groups the user belongs to + all members of those groups (others) | Groups the user is not a member of (and is not admin) |
| **Workflows** (SCR-WF-001) | Admin sees all; assigned approvers see only their assigned steps | All workflows (admin); only workflow steps assigned to current user (assigned_approver) | Workflows not assigned to the current user |
| **Notifications** (SCR-NOT-001) | Each user sees only their own notifications | Notifications WHERE destinataire_user_id = session.user_id | All other users' notifications |
| **Archives** (SCR-LIF-001) | Admin sees all; trashed entries excluded from normal view per LIF-006 | Archived entries (admin); trashed entries invisible unless specifically querying trash state | Trashed entries (LIF-006); purged entries (permanently removed) |
| **Audit Entries** (SCR-AUD-001) | Admin/auditor see all entries in their org | All audit entries WHERE org_id = session.org_id | Entries from other orgs; audit entries themselves are never audited (NB-PERSIST-007) |

### 2.2 Row-Level Permission Enforcement

Row-level filtering is applied at the API query layer (RepositoryPort.findByCriteria), NOT at the UI layer. The UI receives only the rows the user is authorized to see. This ensures:

1. No row-level data leaks through network inspection
2. Pagination cursor encodes the filtered result set — skipping ahead cannot reveal unauthorized rows
3. Row counts shown in the UI match the actual filtered count
4. Export operations (ExportResources, ExportAuditTrail) respect the same row-level filters

---

## SECTION 3: FIELD-LEVEL PERMISSIONS

Within individual screens, certain fields may be hidden or rendered read-only for specific roles. Field-level permissions are more granular than screen-level permissions.

### 3.1 Field-Level Permission Matrix

| Field / Element | SuperAdmin | Admin | Treasurer | Pastor | Staff | Notes |
|----------------|-----------|-------|-----------|--------|-------|-------|
| **password_hash** (users table) | HIDDEN (admin view) | HIDDEN | HIDDEN | HIDDEN | HIDDEN | Never displayed in any context — never even loaded by UI; stored only in credentials table |
| **credentials.hidden** fields | VISIBLE | HIDDEN | HIDDEN | HIDDEN | HIDDEN | Non-admin users never see credential-related fields |
| **session tokens** (refresh tokens) | VISIBLE | HIDDEN | HIDDEN | HIDDEN | HIDDEN | Ephemeral tokens exist only in memory during auth flow |
| **transaction: amount** | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | Always visible to anyone with transaction:read |
| **transaction: compensates_for** | VISIBLE | VISIBLE | VISIBLE | HIDDEN | HIDDEN | Compensation linkage visible only to admin and above |
| **transaction: version** | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | Version number always visible (INV-010 transparency) |
| **user: email** | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | Email always visible |
| **user: phone** | VISIBLE | VISIBLE | VISIBLE | VISIBLE (if in same group) | VISIBLE (if in same group) | Phone may be restricted by group scope |
| **user: role** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | HIDDEN | Only admin/superadmin can see/manage roles |
| **audit: old_values** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | HIDDEN | Full audit snapshot visible only to admin/auditor |
| **audit: new_values** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | HIDDEN | Full audit snapshot visible only to admin/auditor |
| **audit: ipAddress** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | HIDDEN | IP address masked from non-admin roles |
| **settings: currency** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | HIDDEN | Configuration only visible to admin/superadmin |
| **settings: timezone** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | HIDDEN | Configuration only visible to admin/superadmin |
| **settings: accent_hex** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | HIDDEN | Configuration only visible to admin/superadmin |
| **notification: preferences** | VISIBLE | VISIBLE (any user) | VISIBLE (own) | VISIBLE (own) | VISIBLE (own) | Self for non-admin; any for admin |
| **form definition (editor)** | VISIBLE | VISIBLE | HIDDEN | HIDDEN | HIDDEN | FormBuilder only for admin/superadmin |
| **form definition (preview)** | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | FormPreview readable by all authenticated users |

### 3.2 Field Rendering Modes

For each field, the UI renders one of these modes based on the user's permissions:

| Mode | Visual Appearance | User Sees |
|------|------------------|-----------|
| **VISIBLE_EDITABLE** | Standard input field (TextInput, Dropdown, etc.) with data pre-filled for edit mode | Full read and write access |
| **VISIBLE_READONLY** | Text displayed as plain text (not editable); styled differently (gray background or muted color) | Read access but no write access |
| **HIDDEN_FIELD** | Field completely absent from the form/layout | No access to this field |
| **MASKED** | Partially obscured: "john**@email.com" or "****-**-1234" | Limited read access (privacy-preserving) |

### 3.3 Password Fields

Password fields follow a strict protocol regardless of role:

| Action | Who Can Do It | UI Behavior |
|--------|--------------|-------------|
| View password hash | NO ONE EVER | Hashes are never displayed, never returned in API responses, never part of any form definition |
| Reset password (self) | Self (SCR-ID-004) | Current password entry (masked) + new password entry (masked with strength indicator) + confirm new password |
| Force reset password (admin) | Admin, superadmin (SCR-ID-002) | No password field shown; admin enters NEW password directly (temporary password communicated out-of-band to user) |
| Password strength check | All users setting/changing passwords | Real-time strength indicator below the password field (visual bar + text: weak/medium/strong) |

### 3.4 Sensitive Field Handling

Certain fields are treated as sensitive and follow special masking protocols:

| Field | Sensitivity Level | Masking Rule |
|-------|------------------|-------------|
| password_hash (credentials table) | CRITICAL | Never exposed to any UI layer |
| refreshToken hash (sessions table) | CRITICAL | Only hash stored; never displayed; full token exists only in client memory briefly during auth |
| ipAddress (audit entries) | SENSITIVE | Masked to last octet for non-admin: "192.168.1.***" |
| email (when combined with password reset) | MODERATE | Shown normally but not editable by self (admin can change) |
| phone (user profile) | MODERATE | Shown if user has group-based access; otherwise hidden |

---

## SECTION 4: DESTRUCTIVE ACTION GUARDING

### 4.1 Confirmation Rules for Destructive Operations

All destructive actions (DELETE, status transition to archived/trashed, organization suspend/merge) require confirmation before execution. The confirmation level depends on the user's role:

| Action | superadmin | admin | treasurer | pastor | staff | Other roles |
|--------|-----------|-------|-----------|--------|-------|-------------|
| **Delete entity** (transactions, members, events) | Single confirmation (ConfirmationDialog) | Single confirmation | Single confirmation | Not available (can't delete) | Not available (read-only) | N/A |
| **Archive resource** (LifecycleAggregate) | Single confirmation | Single confirmation | Not available | Not available | Not available | N/A |
| **Trash resource** | Single confirmation | Single confirmation | Not available | Not available | Not available | N/A |
| **Purge resource** | N/A (system-only) | N/A (system-only) | N/A | N/A | N/A | N/A |
| **Suspend organization** | Single confirmation | Not available | Not available | Not available | Not available | N/A |
| **Merge organizations** | Single confirmation | Not available | Not available | Not available | Not available | N/A |
| **Delete user** | Single confirmation | Single confirmation | Not available | Not available | Not available | N/A |
| **Revoke all sessions** | Single confirmation | Not available (can only revoke own) | Not available | Not available | Not available | N/A |

### 4.2 Double Confirmation Rule

For all users EXCEPT superadmin, destructive actions require TWO separate confirmations:

1. **First confirmation**: Standard ConfirmationDialog — "Are you sure?"
2. **Second confirmation**: Same dialog appears again with different wording — "This is your final warning. This action cannot be undone."
3. The second confirmation includes a checkbox: "I understand this is irreversible" that must be checked before the Confirm button becomes enabled

For superadmin, only ONE confirmation is required (single-step confirmation). The rationale: superadmin is the highest privilege role and is expected to act decisively; however, ALL superadmin destructive actions are fully audited (AuditAggregate.LogAction is invoked with actor = superadmin identity).

### 4.3 Irreversible Actions

Some actions are so destructive they warrant EXTRA warnings beyond double confirmation:

| Action | Extra Warning |
|--------|-------------|
| **Purge resource** (system-only, not user-callable) | System-enforced: only runs after purge_date (LIF-005); logged in AuditAggregate before execution |
| **Deprecate vocabulary value** | VOC-001: deprecation is irreversible. Dialog: "Deprecating this value will make it unavailable for new entries. Existing references will continue to work but the value will appear grayed out. This cannot be reversed." |
| **Archive organization** | Transition to archived status makes org read-only. Dialog: "Archiving this organization will lock all writes. Users can still read data but cannot create, update, or delete anything." |
| **Reset all settings to defaults** | CFG-004 reset. Dialog: "This will reset ALL organization settings to their template defaults. Custom configurations including currency, timezone, language, and accent color will be lost." |

### 4.4 Confirmation Dialog Content

Every ConfirmationDialog follows this content pattern sourced from vocabulary:

| Dialog Zone | Source | Example |
|------------|--------|---------|
| Title | `confirmation.{action}.title` (vocab namespace) | "Confirm Deletion" / "Confirmer la suppression" |
| Body message | `confirmation.{action}.body` | "Are you sure you want to delete {entity_name}? This action will permanently remove {entity_type} from the organization." |
| Irreversible warning | `confirmation.{action}.irreversible_warning` (only for truly irreversible actions) | "This action CANNOT be undone." |
| Checkbox label (double confirmation only) | `confirmation.double_confirm.checkbox` | "I understand this is irreversible" |
| Cancel button | `confirmation.cancel` | "Cancel" / "Annuler" |
| Confirm button | `confirmation.confirm` | "Confirm" / "Confirmer" |

---

## SECTION 5: VISIBILITY CALCULATION ALGORITHM

The following algorithm determines exactly what a user sees on any given screen. It is executed in this order on every screen load and on every navigation event.

### Step 1: Load User's Role from Session

```
Input: User's authentication context (from IdentityAggregate, persisted in session)
Process: Extract the user's primary role (superadmin/admin/treasurer/pastor/staff) and any additional role contexts (auditor, assigned_approver)
Output: Set<RBACRole> — the collection of roles the user holds in the current org context
Example: {"admin", "auditor"} — user is both admin and auditor in the current org
```

Constraints:
- org_id is resolved from the authenticated session (INV-004) — NEVER from user input
- A user belongs to exactly one org (one org_id) at a time
- superadmin role spans ALL organizations; admin role is scoped to ONE organization

### Step 2: Apply RBAC Matrix to Get Allowed Screens

```
Input: Set<RBACRole>, list of all 37 canonical screens (from UI-SPEC-003 Section 17)
Process: For each screen, check if ANY of the user's roles grant access:
  - If user.role == "superadmin": ALL screens accessible (wildcard *)
  - If user.role == "admin": screens where admin permission appears in API-CONTRACT-004
  - If user.role == "treasurer": financial screens + member/event read + workflow queue only if assigned
  - ... (continues for each role per API-CONTRACT-004 authorization mapping)
Output: Set<ScreenID> — the subset of screens the user can navigate to
Example: {"SCR-ORG-001", "SCR-RES-001", "SCR-MEM-001", "SCR-EVT-001", "SCR-NOT-001"}
```

### Step 3: Apply org_id Filter from Tenant Context

```
Input: Set<ScreenID>, session.org_id
Process: Every screen that accesses data includes an implicit org_id filter:
  - All repository queries include WHERE org_id = session.org_id (INV-004)
  - Superadmin can switch org context → set of visible rows changes per org
  - All other roles are locked to their single org
Output: Screen data scoped to the current org
Example: User accesses SCR-RES-001 → Query returns transactions WHERE org_id = 'abc-123'
```

### Step 4: Apply Row-Level Scoping from User's Position in Hierarchy

```
Input: Screen data from Step 3, user's membership relationships (RelationshipAggregate)
Process: For each screen's DataTable:
  - Users see rows matching their group memberships (relationship data from REL-004)
  - Admin sees ALL rows in the org (no row filtering)
  - Non-admin users see only rows in groups they belong to
  - Pastors and staff see only groups they're members of
  - Notification recipients are auto-scoped to self
Output: Filtered data set — rows the user is authorized to see individually
Example: User is member of "chorale soprano" group → sees only transactions/events scoped to that group
```

### Step 5: Apply Field-Level Visibility from Column Permissions

```
Input: Screen data from Step 4, field-level permission matrix (Section 3.1)
Process: For each visible row in the DataTable and each field/column:
  - Superadmin: all fields visible and editable where permitted
  - Admin: most fields visible; credential fields masked/hidden
  - Treasurer: financial fields visible; configuration fields hidden
  - Pastor: read-only access to basic fields; role management hidden
  - Staff: basic read-only fields only
  - Auditor: audit-specific fields; general business fields hidden
Output: Final field rendering configuration per row
Example: TransactionDetail screen — pastor sees amount, category, date but NOT compensates_for field
```

### Algorithm Result

The output of this 5-step algorithm is the complete, deterministic UI state for any user at any point in time. Given the same user roles, same org_id, and same data, the algorithm ALWAYS produces the same result. This determinism is intentional — it allows precise testing and auditing of permission effects.

---

## SECTION 6: VISIBILITY MATRIX — ACTIONS PER SCREEN

In addition to screen-level visibility, specific actions ON each screen are permission-gated. The following tables detail which actions are available to which roles on each screen type.

### 6.1 List Screen Actions

| Screen Type | Action | SuperAdmin | Admin | Treasurer | Pastor | Staff |
|------------|--------|-----------|-------|-----------|--------|-------|
| Any list | Create (CTA button) | YES | YES | YES (transactions) | NO | NO |
| Any list | Edit (row action) | YES | YES | YES (transactions) | NO | NO |
| Any list | Delete (row action) | YES | YES | NO | NO | NO |
| Transaction list | Approve (inline) | YES | YES | YES | NO | NO |
| Transaction list | Reject (inline) | YES | YES | NO | NO | NO |
| Transaction list | Compensate (inline) | YES | YES | YES | NO | NO |
| Member list | Activate/Deactivate | YES | YES | NO | NO | NO |
| Member list | Transition to deceased | YES | YES | NO | NO | NO |
| Member list | Transition to transferred | YES | YES | NO | NO | NO |
| Event list | Publish (draft→published) | YES | YES | NO | NO | NO |
| Event list | Cancel event | YES | YES | NO | NO | NO |
| User list | Change role | YES only | NO | NO | NO | NO |
| User list | Reset password | YES | YES | NO | NO | NO |
| User list | Revoke session | YES | NO | NO | NO | NO |
| Workflow queue | Approve step | YES | YES | NO | NO | NO |
| Workflow queue | Reject step | YES | YES | NO | YES (if assigned) | NO |
| Workflow queue | Cancel workflow | YES | YES | NO | NO | NO |
| Archive browser | Archive resource | YES | YES | NO | NO | NO |
| Archive browser | Trash archive | YES | YES | NO | NO | NO |
| Archive browser | Restore from trash | YES | YES | NO | NO | NO |
| Category list | Add term value | YES | YES | NO | NO | NO |
| Category list | Deprecate value | YES | YES | NO | NO | NO |
| Report dashboard | Generate report | YES | YES | YES | NO | NO |
| Report dashboard | Calculate balance | YES | YES | YES | NO | NO |
| Audit log viewer | Export audit trail | YES | YES | NO | NO | NO |
| Settings screens | Update setting | YES | YES | NO | NO | NO |
| Settings screens | Reset to defaults | YES | YES | NO | NO | NO |
| Notification prefs | Update own prefs | YES | YES | YES | YES | YES |
| Notification prefs | Update anyone's prefs | YES | YES | NO | NO | NO |

### 6.2 Detail Screen Actions

Detail screen actions mirror list screen actions for the corresponding entity type. The key difference is that detail screens present ALL fields of an entity rather than a summary, and provide action buttons in the action bar rather than inline row actions.

### 6.3 Create/Edit Screen Actions

| Screen | Action | SuperAdmin | Admin | Treasurer | Pastor | Staff |
|--------|--------|-----------|-------|-----------|--------|-------|
| TransactionCreate | Save | YES | YES | YES | NO | NO |
| TransactionCreate | Submit for approval | YES | YES | YES | NO | NO |
| TransactionEdit | Save draft | YES | YES | YES | NO | NO |
| TransactionEdit | Resubmit for approval | YES | YES | YES | NO | NO |
| MemberCreate | Save | YES | YES | NO | NO | NO |
| EventCreate | Save | YES | YES | NO | NO | NO |
| UserCreate | Save | YES | YES | NO | NO | NO |
| FormBuilder | Save | YES | YES | NO | NO | NO |
| FormBuilder | Validate | YES | YES | YES | YES | YES |
| FormBuilder | Preview | YES | YES | YES | YES | YES |

---

## SECTION 7: PERMISSION CHANGE PROPAGATION

When a user's role or permissions change (e.g., superadmin demotes a user from admin to treasurer):

1. **Immediate effect**: The next screen load reflects the new permissions (Step 1 of the algorithm uses the updated role)
2. **Active screen effect**: If the user is on a screen that was previously accessible under the old role, the screen re-renders with the new visibility state:
   - Hidden fields are removed
   - Hidden action buttons are disabled/removed
   - Navigation rail items are added/removed
   - Breadcrumbs remain unchanged (they reflect navigation path, not permissions)
3. **Session effect**: The permission change is detected on the next HTTP/API request via AuthorizationPort.resolvePermissions(). The UI automatically re-evaluates visibility without requiring a page refresh.
4. **Lost access effect**: If a user loses access to a screen they are currently viewing, they are redirected to the default screen for their new role (typically SCR-ORG-001 DashboardOrg) with a toast notification: "Your permissions have been updated. Some features may no longer be available."

---

## SECTION 8: COMPILANCE STATEMENT

This permission visibility specification covers all 37 canonical screens listed in UI-SPEC-003 (Section 17) against all 9 effective role instances defined in API-CONTRACT-004.

Every visibility decision traces back to API-CONTRACT-004 authorization mappings. Every field-level permission maps to a specific field in the schema defined in DOC-021. Every destructive action guard maps to a DELETE or state-transition command defined in API-CONTRACT-001.

No visibility rule was invented beyond those derivable from the RBAC hierarchy. The 5-step algorithm produces deterministic, auditable results for any user/context combination. The visibility matrix is exhaustive: every screen-role combination has a defined visibility outcome.

---

*End of UI-SPEC-005 — Permission Visibility Rules*
*Document ID: UI-SPEC-005 | Version: v1.0 | Compliance Status: COMPLIANT*
