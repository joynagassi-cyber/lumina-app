# Navigation Model — Lumina v1

**Doc ID:** UI-SPEC-002
**Version:** v1.0
**Statut:** SPECIFICATION UI DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "API-CONTRACT-004", "ASS-001", "PAS-001"]
**Transformation_rule :** "ui-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **canonical navigation model** for the Lumina application. Navigation is derived exclusively from the 13 Aggregate boundaries defined in DOC-012 and the RBAC permissions defined in API-CONTRACT-004. There are no arbitrary routes or invented navigation paths — every navigable unit maps to an Aggregate's responsibility surface as exposed through its Application Service boundary.

Navigation structure uses conceptual paths of the form `{aggregate}/{entity}/{action}` without referencing any specific HTTP, URL scheme, or protocol. The routing mechanism is implementation-agnostic; this document describes WHAT is navigable and UNDER WHAT CONDITIONS, not HOW navigation is implemented technically.

---

## SECTION 1: NAVIGATION HIERARCHY

### 1.1 Global Navigation Structure

The global navigation consists of a single persistent rail (see Block Type 5 in UI-SPEC-001) that exposes one item per Aggregate. Items are ordered by domain importance and dependency relationship:

| Position | Aggregate | Conceptual Path Prefix | Screen Entry Point | Visibility Rule |
|----------|-----------|----------------------|-------------------|----------------|
| 1 | OrganizationAggregate | `organization` | SCR-ORG-001 (DashboardOrg) | Visible to admin+ (org admin); superadmin sees all orgs |
| 2 | IdentityAggregate | `identity/users` | SCR-ID-001 (UserList) | Visible to admin, superadmin only |
| 3 | ResourceAggregate | `resources/financial` | SCR-RES-001 (TransactionList) | Visible based on permission grant (resource:read) |
| 4 | ResourceAggregate | `resources/members` | SCR-MEM-001 (MemberList) | Visible to admin, treasurer, pastor, staff |
| 5 | ResourceAggregate | `resources/events` | SCR-EVT-001 (EventList) | Visible to admin, treasurer, pastor, staff |
| 6 | RelationshipAggregate | `relationships/groups` | SCR-REL-001 (GroupMembershipList) | Visible to admin |
| 7 | WorkflowAggregate | `workflows/pending` | SCR-WF-001 (WorkflowQueue) | Visible to admin, assigned approvers |
| 8 | FormAggregate | `forms` | SCR-FRM-001 (FormBuilder) | Visible to admin only |
| 9 | NotificationAggregate | `notifications` | SCR-NOT-001 (Inbox) | Visible to self (own notifications) |
| 10 | VocabularyAggregate | `vocabulary` | SCR-VOC-001 (CategoryList) | Visible to any authenticated user |
| 11 | ReportingAggregate | `reports` | SCR-RPT-001 (ReportDashboard) | Visible to admin, treasurer |
| 12 | AuditAggregate | `audit` | SCR-AUD-001 (AuditLogViewer) | Visible to admin, auditor only |
| 13 | LifecycleAggregate | `lifecycle/archives` | SCR-LIF-001 (ArchiveBrowser) | Visible to admin only |

Each Aggregate's entry point screen (the list/dashboard/screen most users land on) is the **primary route target** for that navigation item. Sub-routes drill into detail, create, edit, and action screens.

### 1.2 Desktop vs. Mobile Layout Differences

| Dimension | Desktop (1024px+) | Mobile (320px - 767px) |
|-----------|------------------|----------------------|
| **Navigation position** | Left-side vertical rail, always visible (collapsible to icon-only at narrow desktop widths ~1024px) | Bottom horizontal tab bar, always visible |
| **Active indicator** | Highlighted left border + background color on the active item | Highlighted top border + icon color change on the active item |
| **Badge display** | Small circular count badge in top-right corner of each nav icon | Small circular count badge overlapping the nav icon |
| **Sub-navigation** | Drill-down sub-items shown as expandable accordion within the rail | Sub-items require tapping the nav item to reveal a bottom sheet or separate screen |
| **Breadcrumb trail** | Always visible in the ScreenContainer header | Collapsed into a single-tap menu; full trail available via tap |
| **Action bar** | Full-width horizontal row below breadcrumbs | Stacked vertically; primary actions prominent, secondary actions in overflow menu |
| **Multi-column layouts** | Enabled when screen width > 1024px | Single column always; horizontal scroll only for data tables with excessive columns |
| **Deep link handling** | Opens directly in the current view | May trigger a full-screen modal overlay for quick detail views, with back gesture to dismiss |

### 1.3 Navigation Hierarchy Tree

```
OrganizationAggregate
├── SCR-ORG-001: DashboardOrg (default landing)
│   ├── [detail] SCR-ORG-002: SettingsOrg
│   └── [tree] SCR-REL-002: OrgHierarchy (via RelationshipAggregate linkage)
└── [settings] SCR-CFG-001: SettingsConfig
    └── [edit] SCR-CFG-002: SettingManage

IdentityAggregate
├── SCR-ID-003: Login (entry point — public, no auth required)
├── SCR-ID-001: UserList
│   ├── [create] SCR-ID-004: Profile (self-service — different context)
│   └── [detail] SCR-ID-002: UserDetail
└── SCR-ID-004: Profile (self-update, reset password, manage sessions)

ResourceAggregate
├── SCR-RES-001: TransactionList
│   ├── [create] SCR-RES-003: TransactionCreate
│   ├── [detail] SCR-RES-002: TransactionDetail
│   │   ├── [edit] SCR-RES-004: TransactionEdit (draft only)
│   │   └── [actions] Approve/Reject/Compensate (inline buttons, trigger state transitions)
│   └── [export] Export flow triggered from action bar
├── SCR-MEM-001: MemberList
│   ├── [create] SCR-MEM-003: MemberCreate
│   └── [detail] SCR-MEM-002: MemberDetail
│       └── [actions] UpdateMember, TransitionMemberStatus (inline)
└── SCR-EVT-001: EventList
    ├── [create] SCR-EVT-003: EventCreate
    └── [detail] SCR-EVT-002: EventDetail
        └── [actions] UpdateEvent, TransitionEventStatus (inline)

RelationshipAggregate
├── SCR-REL-001: GroupMembershipList
│   └── [actions] AddMemberToGroup, RemoveMemberFromGroup (inline)
└── SCR-REL-002: OrgHierarchy (tree view)
    └── [action] SetOrgUnitParent (contextual)

WorkflowAggregate
├── SCR-WF-001: WorkflowQueue
│   └── [action] ApproveStep, RejectStep (inline approval buttons)
└── SCR-WF-002: WorkflowInstance
    └── [actions] CancelWorkflow, ResubmitForApproval (contextual)

FormAggregate
├── SCR-FRM-001: FormBuilder
│   └── [action] ValidateFormData (on submit), Save (version bump)
└── SCR-FRM-002: FormPreview (read-only preview of form definition)

NotificationAggregate
├── SCR-NOT-001: Inbox
│   └── [action] MarkAsRead (per-item action, inline)
└── SCR-NOT-002: NotificationPreferences
    └── [actions] UpdatePreferences, SetRateLimit, SuppressUntil (form fields)

VocabularyAggregate
├── SCR-VOC-001: CategoryList
│   └── [detail] View term details (read-only — terms not editable from this screen)
└── SCR-VOC-002: NamespaceManage
    └── [actions] AddTermValue, DeprecateTermValue (admin operations)

ReportingAggregate
├── SCR-RPT-001: ReportDashboard
│   └── [action] GenerateReport, CalculateBalance (inline buttons)
└── SCR-RPT-002: ReportSnapshot
    └── [action] ExportReport (download button)

AuditAggregate
├── SCR-AUD-001: AuditLogViewer
│   └── [action] ExportAuditTrail (from action bar)
└── No write screens — AuditAggregate is append-only (user-facing screens are read-only)

LifecycleAggregate
├── SCR-LIF-001: ArchiveBrowser
│   ├── [action] ArchiveResource (from entity detail screens)
│   ├── [action] TrashResource (inline if admin)
│   └── [detail] ArchiveDetailView (SCR-CRD-002, cross-aggregate)
└── SCR-LIF-002: PurgeScheduler
    └── [actions] SchedulePurge, RestoreFromTrash (admin operations)

OfflineSyncAggregate
├── SCR-SYNC-001: SyncStatusPanel
│   └── [display only] Shows connectivity status and last sync timestamps
└── SCR-SYNC-002: PendingOpsViewer
    └── [action] ResolveConflict (inline if admin)
```

---

## SECTION 2: DEEP LINKING RULES

### 2.1 Deep Linking Principle

Every screen can be reached via a deep link that encodes the following contextual parameters:

| Parameter | Description | Scope | Required |
|-----------|-------------|-------|----------|
| `aggregate` | The owning Aggregate name | Global | Yes |
| `screen` | The specific screen ID | Within aggregate | Yes |
| `entity_id` | The UUID of the specific entity being viewed | Detail/Edit screens | Context-dependent |
| `org_id` | The organization context | All screens | Implicit (resolved from session) |
| `tab` or `section` | Which section/tab to show first within a multi-section screen | Form and List screens | Optional |
| `filter` | Pre-applied filter criteria | List screens | Optional |

### 2.2 Deep Link Path Pattern

```
{aggregate}/{screen}/{optional-entity-id}
```

Examples:
- `resources/transactions` — TransactionList (SCR-RES-001)
- `resources/transactions/{transaction_uuid}` — TransactionDetail (SCR-RES-002)
- `members` — MemberList (SCR-MEM-001)
- `members/{member_uuid}` — MemberDetail (SCR-MEM-002)
- `workflow/pending` — WorkflowQueue (SCR-WF-001)
- `workflow/{instance_uuid}` — WorkflowInstance (SCR-WF-002)
- `notification/inbox` — Inbox (SCR-NOT-001)

### 2.3 Org-Scoped Deep Links

Because all data is scoped to exactly one organization (INV-004), deep links always operate within the org_id resolved from the authenticated session. If a user attempts to deep-link into an entity from a different organization (e.g., sharing a URL with a different org context), the authorization layer rejects the request and redirects to the Login screen (SCR-ID-003).

The `org_id` is NEVER passed as a URL parameter or deep-link argument. It is ALWAYS resolved from the authenticated session or token. This prevents org-scoping manipulation.

### 2.4 Cross-Aggregate Deep Links

Deep links into cross-aggregate screens use both source aggregate identifiers:

- `workflow/approval/{instance_uuid}?resource={resource_uuid}` — ApprovalDetail (SCR-CRD-001): workflow instance from WorkflowAggregate, resource reference from ResourceAggregate
- `lifecycle/archive/{archive_uuid}?original={resource_type}:{resource_uuid}` — ArchiveDetailView (SCR-CRD-002): archive from LifecycleAggregate, referenced resource from ResourceAggregate

These deep links resolve both data sources simultaneously, and the resulting screen presents a unified view. Permissions are checked against the MOST RESTRICTIVE of the two source aggregates.

---

## SECTION 3: BREADCRUMB PATTERNS

Breadcrumbs provide the user with an always-visible path from the current screen back to higher-level aggregation screens. Each Aggregate has a defined breadcrumb pattern.

### 3.1 Breadcrumb Rules

1. Every breadcrumb label is resolved from vocabulary (never hardcoded)
2. The breadcrumb trail never exceeds 3 levels deep (Organization > Aggregate > Entity)
3. Clickable items navigate to the parent screen; non-clickable current item indicates the active screen
4. On mobile, the breadcrumb trail collapses to a single-tap menu showing the full path

### 3.2 Per-Aggregate Breadcrumb Patterns

| Aggregate | Pattern | Example |
|-----------|---------|---------|
| **OrganizationAggregate** | Home > Organization | No deeper nesting; the Organization screen IS the root |
| **IdentityAggregate** | Home > Users > {User Name} | List → Detail |
| **ResourceAggregate** | Home > Transactions > {Transaction Reference} | List → Detail → Edit (optional fourth level) |
| **ResourceAggregate (Members)** | Home > Members > {Member Name} | List → Detail |
| **ResourceAggregate (Events)** | Home > Events > {Event Title} | List → Detail |
| **RelationshipAggregate** | Home > Groups > {Group Name} | List → Detail (tree view alternative) |
| **WorkflowAggregate** | Home > Workflows > {Instance ID} | Queue → Instance |
| **FormAggregate** | Home > Forms > {Form Key} | Builder → Preview (or vice versa) |
| **NotificationAggregate** | Home > Notifications | Inbox is the terminal screen (no sub-pages) |
| **VocabularyAggregate** | Home > Vocabulary > {Namespace} | CategoryList → Namespace detail |
| **ReportingAggregate** | Home > Reports > {Report Period} | Dashboard → Snapshot |
| **AuditAggregate** | Home > Audit Log | Terminal list view (no drilling deeper than individual log entry expansion) |
| **LifecycleAggregate** | Home > Archives > {Archive Reference} | Browser → Detail → Purge Scheduler (optional) |
| **ConfigurationAggregate** | Home > Settings > {Setting Category} | Config list → Individual setting management |
| **OfflineSyncAggregate** | Home > Sync Status | Status panel → Pending ops viewer (optional) |

### 3.3 Breadcrumb Composition by Screen Type

| Screen Type | Breadcrumb Depth | Content |
|------------|-----------------|---------|
| **List screens** | 1 level | Home > [Aggregate Label] — e.g., "Home > Transactions" |
| **Detail screens** | 2 levels | Home > [Aggregate Label] > [Entity Name or Reference] — e.g., "Home > Transactions > TXN-2026-0042" |
| **Create/Edit screens** | 2-3 levels | Home > [Aggregate Label] > [Entity Name or "New"] — e.g., "Home > Transactions > New Transaction" or "Home > Transactions > TXN-2026-0042 > Edit" |
| **Settings screens** | 2 levels | Home > Settings > [Setting Category] — e.g., "Home > Settings > Organization" |
| **Dashboard screens** | 1 level | Home > [Dashboard Label] — e.g., "Home > Reports" |

---

## SECTION 4: ROUTE GUARDS

Route guards determine which routes are accessible to which roles. Every route maps to the RBAC permissions defined in API-CONTRACT-004. A route guard check occurs BEFORE any screen content is rendered. If the check fails, the user is redirected to the appropriate error or login screen.

### 4.1 Route Guard Table

| Conceptual Path | Screens Served | Minimum Role(s) | Permission Required | Redirect on Denial |
|----------------|---------------|----------------|---------------------|-------------------|
| `identity/login` | SCR-ID-003 | N/A (public) | None | N/A — always accessible |
| `identity/profile` | SCR-ID-004 | self | user:update:self | Own profile only (cannot access other users') |
| `organization` | SCR-ORG-001, SCR-ORG-002 | admin | organization:read:org / config:update:org | 403 equivalent (in-app message) |
| `identity/users` | SCR-ID-001, SCR-ID-002 | admin | user:create / user:update:any | 403 equivalent |
| `resources/financial` | SCR-RES-001, SCR-RES-002, SCR-RES-003, SCR-RES-004 | treasurer+ | transaction:read / transaction:create / transaction:approve / transaction:reject | 403 equivalent |
| `resources/members` | SCR-MEM-001, SCR-MEM-002, SCR-MEM-003 | staff+ | member:read / member:create / member:status:transition | 403 equivalent |
| `resources/events` | SCR-EVT-001, SCR-EVT-002, SCR-EVT-003 | staff+ | event:read / event:create | 403 equivalent |
| `relationships/groups` | SCR-REL-001, SCR-REL-002 | admin | membership:manage / organization_unit:read | 403 equivalent |
| `workflows/pending` | SCR-WF-001, SCR-WF-002 | admin or assigned approver | workflow:read / workflow:approve / workflow:reject / workflow:cancel | 403 equivalent |
| `forms` | SCR-FRM-001, SCR-FRM-002 | admin | form:read / form:validate | Any authenticated can read; admin to edit |
| `notifications` | SCR-NOT-001, SCR-NOT-002 | self | notification:read:self / notification:pref:self | Own notifications only |
| `vocabulary` | SCR-VOC-001, SCR-VOC-002 | any authenticated | vocabulary:read (open) / vocabulary:manage (admin) | 403 equivalent for admin operations |
| `reports` | SCR-RPT-001, SCR-RPT-002 | treasurer+ | reporting:read / reporting:generate / reporting:export | 403 equivalent |
| `audit` | SCR-AUD-001 | admin or auditor | audit:read | 403 equivalent |
| `lifecycle/archives` | SCR-LIF-001, SCR-LIF-002 | admin | lifecycle:read / lifecycle:archive / lifecycle:trash / lifecycle:schedule | 403 equivalent |
| `settings/config` | SCR-CFG-001, SCR-CFG-002 | admin | config:read / config:update | 403 equivalent |
| `sync/status` | SCR-SYNC-001, SCR-SYNC-002 | any authenticated | sync:status | Self only |

### 4.2 Superadmin Behavior

The superadmin role (`*:*:*` wildcard permission) bypasses ALL route guards. A superadmin can access every screen, every aggregate, and execute every command. However, superadmin actions are fully audited (AuditAggregate.LogAction is invoked for every operation, including superadmin privilege usage).

### 4.3 Authentication Gate

The `identity/login` screen (SCR-ID-003) is the ONLY publicly accessible screen. All other screens require an active authenticated session. If a user attempts to access any route without authentication:

1. The route guard detects the missing/invalid session
2. The user is redirected to SCR-ID-003 (Login)
3. Upon successful login, the user is returned to the originally requested screen (if the route is within their authorized scope)
4. If the route is outside their authorized scope, they are redirected to the default screen for their role (typically SCR-ORG-001 DashboardOrg)

### 4.4 Session Expiration Guard

If a user's session expires while on a protected screen:

1. All subsequent route guards detect the expired session
2. The user is redirected to SCR-ID-003 (Login) with a session-expired message
3. After re-authentication, the user returns to the dashboard (SCR-ORG-001) rather than the previous screen (to prevent stale data access)
4. An optional auto-refresh mechanism attempts Silent Token Refresh via RefreshAccessToken before redirecting to login

---

## SECTION 5: OFFLINE NAVIGATION BEHAVIOR

Navigation behavior changes when the device is disconnected from the remote server. The OfflineSyncAggregate governs offline mode behavior as defined in DOC-012 (Aggregate 13) and DOC-017 (§2.13).

### 5.1 What Navigation Is Available Offline

| Component | Online Behavior | Offline Behavior |
|-----------|----------------|-----------------|
| **NavigationRail items** | All items visible per RBAC | All items visible per RBAC (unchanged — navigation structure does not change) |
| **Screen loading** | Data fetched from remote server | Data loaded from local cache (SQLite per DOC-017 §2) |
| **List screens** | Live data from SearchResources query | Cached data from last successful sync, marked with StatusIndicator yellow/green |
| **Detail screens** | Live entity data | Cached entity data (may be stale) |
| **Create forms** | Submit creates remotely | Submit queues locally as PendingOperation |
| **Edit forms** | Save updates remotely | Save updates locally; queued for sync |
| **Delete actions** | Removes remotely | Soft-delete locally; queued for sync |
| **Approve/Reject** | State transition applied on server | Queued; will apply when online |
| **Generate report** | Computed from live data | Computed from cached data (with disclaimer that data may be stale) |
| **Export report** | Downloaded from server | Generated from cached data |
| **Audit log viewer** | Live audit entries | Only cached audit entries (if any were synced previously — audit data is typically server-only per DOC-017 §2.10) |
| **Login screen** | Authenticates against server | NOT AVAILABLE — authentication requires network connectivity. Existing sessions continue to work. |
| **Form builder** | Loads FormDefinition from server | Last-cached FormDefinition (admin cannot update forms offline) |
| **Vocabulary management** | Read-only for non-admin | Last-cached vocabulary terms (non-admin); admin management unavailable |
| **Settings screens** | Reads/writes from server | Last-cached settings (read-only); cannot update configuration offline |
| **Sync status panel** | Shows live connection state | Shows "offline" status prominently; shows pending operation counts from local queue |

### 5.2 Offline Disclaimers

When screens render stale cached data, they display a small disclaimer banner:
- Text from vocabulary: "You are viewing cached data. Changes made while offline will sync automatically when connectivity is restored."
- Language: FR/EN per current language preference
- Position: Below the breadcrumb, above the main content area
- Auto-dismiss: Gone when connectivity is restored and data re-syncs

### 5.3 Write Queue Visibility

All screens that perform writes (Create, Edit, Delete, Approve, etc.) display a subtle visual cue when operating offline:
- A small "queued" badge appears next to the submit/save button
- On submit, the toast confirms: "Saved locally, will sync when online" (from vocabulary)
- The SyncStatusPanel (SCR-SYNC-001) provides the definitive count of queued operations

### 5.4 Conflict Resolution Navigation

When a sync conflict is detected (conflict between local offline changes and server state):
1. The user is notified via ToastNotification (critical type, red)
2. If the conflict affects a screen currently in view, the screen displays an inline conflict resolution panel
3. The panel shows both the local value and the server value side-by-side (derived from PendingOperation payload and latest synced entity)
4. The user chooses: keep local, accept server, or resolve manually (via the ResolveConflict command)
5. Resolution is confirmed via success toast and navigation resumes normally

---

## SECTION 6: NAVIGATION STATE PRESERVATION

### 6.1 Navigation Stack

The application maintains a linear navigation stack:

| Operation | Stack Change |
|-----------|-------------|
| Navigate to new screen | Push screen onto stack |
| Tap Back / Swipe right (mobile) | Pop screen from stack |
| Navigate to Login | Clear stack except Login; after login, push target screen |
| Session expires | Pop all screens except Login; after re-auth, push role-default screen |

### 6.2 Screen State Preservation

When navigating away from a screen and returning:
- **Data**: Re-fetched from cache (if online) or served from local cache (if offline)
- **Form state**: Unsaved form data is preserved across navigation switches within the same session; if the user navigates away from an unsaved form and returns, the previously entered data is restored
- **Scroll position**: Preserved when navigating back to a previously scrolled list screen
- **Filter/sort state**: Persisted on the screen so the user returns to the exact same filtered view

### 6.3 App Startup Navigation

On fresh app launch (or re-open after killing the process):

| Condition | Destination Screen |
|-----------|-------------------|
| No active session | SCR-ID-003 (Login) |
| Valid active session, no org selected | SCR-ORG-001 (DashboardOrg — default for current org from session) |
| Valid active session, org selected | SCR-ORG-001 (DashboardOrg for selected org) |
| Session exists but org_id expired | SCR-ID-003 (Login — session refresh fails, re-authenticate) |

---

## SECTION 7: CROSS-AGGREGATE NAVIGATION FLOWS

Certain user journeys span multiple Aggregates. These flows define how the navigation model handles transitions between Aggregate boundaries.

### 7.1 Approval Flow (ResourceAggregate → WorkflowAggregate)

```
SCR-RES-002 (TransactionDetail) --[click "Submit for Approval"]--> 
SCR-WF-001 (WorkflowQueue) --[click "View Details"]-->
SCR-WF-002 (WorkflowInstance) --[click "Approve"]-->
SCR-CRD-001 (ApprovalDetail: cross-aggregate) -->
ToastNotification "Transaction approved" -->
Back to SCR-RES-002 (TransactionDetail, now showing "approved" status)
```

Each step in this flow respects RBAC: only users with `transaction:submit` permission see the Submit button; only assigned approvers with `workflow:approve` permission see the Approve button.

### 7.2 Archive Flow (ResourceAggregate → LifecycleAggregate)

```
SCR-RES-002 (TransactionDetail) --[click "Archive"]-->
ConfirmationDialog (destructive action) -->
If confirmed: Transition SCR-RES-002 shows "archived" status
Then: SCR-LIF-001 (ArchiveBrowser) reflects the new archive entry
```

### 7.3 Conflict Resolution Flow (OfflineSyncAggregate → ResourceAggregate)

```
SCR-SYNC-001 (SyncStatusPanel) detects conflict -->
Inline Conflict Panel (shows old value vs. new value) -->
User selects resolution -->
SCR-RES-002 (TransactionDetail) refreshes with resolved data -->
ToastNotification confirms resolution
```

### 7.4 Form-to-Resource Flow (FormAggregate → ResourceAggregate)

```
SCR-FRM-001 (FormBuilder) renders a transaction creation form -->
User fills out form and submits -->
Validation occurs (ValidateFormData via FormAggregate) -->
On valid submission: CreateTransaction command sent to ResourceAggregate -->
Navigation to SCR-RES-002 (TransactionDetail for the newly created transaction) -->
ToastNotification "Transaction created successfully"
```

This flow is the canonical example of how FormAggregate feeds data into ResourceAggregate through the RenderForm pipeline defined in ASS-004 (§3, Form→Vocabulary coordination and §8, FormAggregate→VocabularyAggregate select options).

---

## SECTION 8: COMPILANCE STATEMENT

This navigation model covers all 13 Aggregates defined in DOC-012 and all 83 operations defined in API-CONTRACT-001.

Every route defined herein maps to at least one screen listed in UI-SPEC-001 (Section 3). Every route guard derives from the RBAC permissions in API-CONTRACT-004. Every cross-aggregate navigation flow corresponds to a coordination pattern defined in ASS-004.

No navigation path was invented beyond what is derivable from the Aggregate boundaries and their documented cross-coordination relationships. The navigation model is complete and closed — there are no hidden routes, undocumented screens, or implicit navigation paths.

---

*End of UI-SPEC-002 — Navigation Model*
*Document ID: UI-SPEC-002 | Version: v1.0 | Compliance Status: COMPLIANT*
