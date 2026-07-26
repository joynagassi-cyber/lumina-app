# Canonical UI Model — Lumina v1

**Doc ID:** UI-SPEC-001
**Version:** v1.0
**Statut:** SPECIFICATION UI DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "ASS-001", "PAS-001"]
**Transformation_rule :** "ui-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **canonical universal interface model** for every screen in the Lumina application. It describes how users interact with the system through presentation-layer abstractions derived exclusively from the 13 Aggregates defined in DOC-012, the 83 operations defined in API-CONTRACT-001, and the cross-aggregate coordination defined in ASS-004.

This is a PRESENTATION LAYER specification. It contains NO business logic, NO framework references, NO component implementations, NO styling rules, and NO platform-specific constructs. Every screen described herein is a conceptual representation of user interaction with one or more Aggregate boundaries.

---

## SECTION 1: UI FUNDAMENTAL PRINCIPLES

### Principle 1: Data-Driven UI Rendering

All screens are rendered from FormDefinitions stored in the FormAggregate (DOC-012, FormAggregate). No screen layout, field order, or form structure is ever hardcoded in the presentation layer. When the system needs to render a form for creating a Transaction, creating a Member, or collecting any other domain data, it:

1. Loads the appropriate FormDefinition via `FormService.LoadFormDefinition(formId, version)` (UI-SPEC-001 § Screen SCR-FRM-001)
2. Retrieves field definitions including labels, types, validation rules, conditional visibility expressions, and required flags
3. Resolves display labels for each field via `VocabularyService.ResolveLabel(namespace, termKey, lang)` for bilingual FR/EN rendering
4. Evaluates `visible_if` conditions against the current form context to determine which fields are visible
5. Renders the form structure according to the section ordering defined in `form_sections.definition_id`

A screen that shows hardcoded field layouts is a violation of this principle. If a form changes (admin updates a FormDefinition), the screen must reflect the change automatically without any code modification.

### Principle 2: Vocabulary-Driven Labels

Every textual label displayed on every screen originates from the VocabularyAggregate. This includes:

- Screen titles and subtitles (resolved via `ResolveLabel` calls using appropriate namespaces)
- Field labels (each FormField carries `label_fr` and `label_en` resolved from vocab_terms)
- Button labels (e.g., "Create", "Approve", "Save" — all vocab-driven)
- Error messages (validation error text resolved from vocabulary)
- Empty state descriptions (text shown when no data exists for a view)
- Breadcrumb labels
- Section headings within multi-section forms

The language used for display is determined by the user's language preference, with fallback to French then English if a translation is missing. Under no circumstances should any label be hardcoded in the presentation code.

### Principle 3: Permission-Driven Visibility

No UI element appears on any screen unless the currently authenticated user holds the RBAC permission required to access it. Permission checks follow the matrix defined in API-CONTRACT-004:

- **Navigation items** in the global navigation rail are hidden if the user lacks the minimum role to see the owning Aggregate's primary operation
- **Action buttons** on screens are hidden if the user lacks the specific permission for that action (e.g., "Delete" button only visible to admin/superadmin)
- **Data rows** in list views may be filtered based on row-level scoping rules (created_by, portee_cible_id, group membership)
- **Form fields** may be hidden or read-only based on field-level permissions (e.g., password fields never visible, credentials.hidden for non-admin roles)

Permission evaluation occurs at three levels:
1. **Screen level** — which screens appear in navigation and can be reached
2. **Action level** — which buttons/operations are available on a given screen
3. **Data level** — which rows and fields are visible within a screen

### Principle 4: Offline-First Design

Every screen must function in offline mode with appropriate visual feedback. The OfflineSyncAggregate (DOC-012, Aggregate 13) governs this behavior:

- **Online state**: All CRUD operations proceed normally; data reflects the latest server state
- **Offline state**: Data from last sync is displayed; local modifications are queued as PendingOperations
- **Transitioning to online**: A brief status indicator shows pending operations being pushed
- **Sync conflicts**: When detected, the user sees a conflict resolution dialog with the server-wins strategy explanation

Each screen displays a sync status indicator (Section 2, Block Type 4) showing:
- Green dot: All data synchronized (`est_synchronise = true`, `synced_at` timestamp current)
- Yellow dot: Sync pending (local changes waiting to be pushed)
- Red dot: Sync failed (push attempt failed, retry scheduled)
- Gray dot: Fully offline (no connectivity, all changes queued locally)

The offline-first design means that reading data, filling out forms, and viewing details must work without network connectivity. Write operations (create, update, delete) queue locally when offline and propagate when connectivity is restored.

### Principle 5: Accessibility First

Minimum WCAG AA compliance is required for all screens. The accessibility baseline includes:

- **Keyboard navigation**: All interactive elements accessible via keyboard tab order
- **Screen reader support**: All form fields have associated label elements; status indicators convey meaning through both color and text
- **Color contrast**: Accent colors from ConfigurationAggregate (CFG-003 invariant: hex validated plus WCAG contrast ratio check) must meet AA minimum ratios against background
- **VoiceOver/TalkBack**: Touch targets have descriptive labels; form error states are announced to assistive technology
- **Focus management**: After submitting a form, focus returns to a meaningful location; after navigation, focus moves to the page title
- **Respect user OS settings**: Reduced motion preferences honored; text scaling supported up to 200%

### Principle 6: Multi-Language by Default

Every screen supports French and English simultaneously. A visible toggle allows users to switch between languages:

- All labels, messages, and instructional text come from the VocabularyAggregate in both FR and EN
- The toggle is positioned consistently across all screens (top-right corner of the viewport)
- Language preference persists in the user's session (ConfigurationAggregate settings)
- When a term lacks an EN translation, the FR label displays as fallback (TRANSLATION-002 invariant guarantees minimum FR+EN coverage)

### Principle 7: Responsive Across Breakpoints

All screens must render correctly at four breakpoint ranges:

| Breakpoint | Target | Layout Adaptations |
|-----------|--------|-------------------|
| **Mobile** (320px - 767px) | Phone devices | Bottom navigation bar (replaces left rail); single-column DataTable; full-width CRUDForm; collapsible sections |
| **Tablet** (768px - 1023px) | Tablet devices | Bottom or top navigation bar; two-column where data-dense; DataTable with optional horizontal scroll for overflow columns |
| **Desktop** (1024px - 1439px) | Standard desktop | Left-side NavigationRail; multi-column data layouts; DataTable uses maximum visible columns; CRUDForm splits into logical side-by-side sections |
| **Large Desktop** (1440px+) | Wide monitors | Max content width constrained for readability; additional columns visible in DataTables; expanded sidebar panels for detail views |

Responsive behavior affects: navigation placement, column count in lists, form layout direction, and the visibility/hiding of secondary information panels. The core content model is identical across breakpoints — only the spatial arrangement changes.

---

## SECTION 2: CORE UI BUILDING BLOCKS

Every screen in Lumina is composed EXCLUSIVELY from the following eight building blocks. No other structural element exists in the canonical UI model.

---

### Block Type 1: ScreenContainer

The ScreenContainer is the outermost structural element that wraps all content on every screen. It provides the consistent frame within which all other blocks operate.

| Property | Description |
|----------|-------------|
| **Structure** | A full-screen wrapper container holding the screen's title area, breadcrumbs, action bar, and main content area |
| **Props** | `title` (fr/en from vocabulary, resolved per current language), `subtitle` (optional, fr/en from vocabulary), `breadcrumbs` (array of label objects with path to current screen), `actionBar` (array of action buttons derived from permitted commands on this aggregate) |
| **Variants** | `default` — full header with title, subtitle, breadcrumbs, and action bar; `compact` — title only, no breadcrumbs, no subtitle; `expanded` — title, subtitle, breadcrumbs, and an expanded action bar supporting multiple simultaneous actions |
| **Constraints** | Title and subtitle must NEVER be hardcoded; always loaded from vocabulary via ResolveLabel; breadcrumbs derive from the navigation model (UI-SPEC-002) |
| **Responsiveness** | On mobile: compact variant by default; expanded breadcrumb trail collapses to a single-tap menu icon |

**Visual composition (conceptual):**
```
+--------------------------------------------------+
| [App Logo]                                    [Lang Toggle] |
+--------------------------------------------------+
| < Back / Home > Breadcrumb 1 > Breadcrumb 2      |
|                                                  |
| [Title: fr/en from vocabulary]                   |
| [Subtitle: fr/en from vocabulary (optional)]     |
|                                                  |
| [Action Buttons Row — derived from permitted commands] |
+--------------------------------------------------+
|                                                  |
|              Main Content Area                   |
|        (DataTable, CRUDForm, StatusPanel, ...)   |
|                                                  |
+--------------------------------------------------+
```

---

### Block Type 2: DataTable

The DataTable is the canonical list-view component. It displays paginated collections of entities from any Aggregate.

| Property | Description |
|----------|-------------|
| **Structure** | Paginated list of data rows with configurable columns sourced from form definitions and entity schemas |
| **Props** | `columns` (defined by the FormDefinition/form_fields for the entity type being displayed; each column has a label from vocabulary, a sort indication, and optional filter), `data` (result set from the API query matching the screen's Primary Operation), `pagination` (cursor-based pagination — not offset/limit), `filters` (key-value pairs applied before data fetch) |
| **Actions** | Sort by clicking column header; Filter via frozen sidebar (left); Paginate via cursor navigation (first, previous, next, last); Export if permission granted (reporting:read) |
| **Constraints** | Maximum 100 rows per page; every row always scoped to the current org_id (INV-004 enforced at query level); sorting and filtering are server-side (client-side only applies to already-loaded page) |
| **Empty State** | When no data matches, the DataTable delegates to the EmptyState block (Block Type 6) |
| **Row Actions** | Available actions per row depend on RBAC (API-CONTRACT-004): View Detail, Edit (if permission), Delete (if permission, triggers ConfirmationDialog) |
| **Accessibility** | Each row is a focusable element; column headers announce sort direction to screen readers; empty cells marked as such |

**Data flow:**
1. User navigates to a list screen (e.g., SCR-RES-001 TransactionList)
2. Screen loads the applicable command/query (SearchResources or GetOrganizationProfile pattern)
3. DataTable receives the result set and renders one row per entity
4. Each column displays one attribute; long values are truncated with expand-on-tap
5. Clicking a row opens the Detail screen for that entity

---

### Block Type 3: CRUDForm

The CRUDForm is the canonical form-rendering component. It is dynamically generated from a FormDefinition stored in the FormAggregate — never coded into the presentation layer.

| Property | Description |
|----------|-------------|
| **Structure** | Dynamically assembled form whose layout, fields, sections, and validation rules are all loaded from FormDefinition at runtime |
| **Props** | `formKey` (string identifier mapped to a vocabulary form namespace), `fields` (loaded from the form_fields table via FormService.LoadFormDefinition), `submitAction` (maps to a specific Command on the owning Aggregate's Application Service), `formData` (pre-populated values for edit mode; empty for create mode) |
| **Validation** | Client-side validation mirrors server-side CHECK constraints exactly (DUAL-008 invariant). Fields that map to NOT NULL columns show a required indicator. Pattern validation expressions are rendered inline below each field. Min/max numeric bounds display as helper text. |
| **States** | `idle` — form ready for input; `submitting` — submit button disabled, spinner shown, form locked against further edits; `success` — toast notification displayed, screen navigates away or resets; `error` — inline field-level error messages shown below each invalid field, form remains editable |
| **Multi-language** | Every label in the form carries fr/en variants from the vocabulary. The active language determines which variant renders. |
| **Conditional visibility** | Fields with `condition_visibilite` expressions hide/show dynamically based on values in other fields. Evaluation happens on every relevant field change. |
| **Sections** | Multi-section forms use the form_sections.definition_id ordering to split the form into distinct panels/tabs. On mobile, sections become a scrollable section picker. On desktop, sections may appear as side-by-side panels. |
| **Accessibility** | Required fields visually marked with asterisk; form errors announced to screen readers; every input has an associated label element; touch target minimum size respected |

**Form rendering pipeline:**
1. `FormService.RenderForm(formDef, data)` is called (UI-SPEC-001 § SCR-FRM-001)
2. FormDefinition is fetched with its current version (FRM-004 versioning invariant)
3. FormField entries are iterated; each field maps to a UI block type (see UI-SPEC-004)
4. For select/multiselect fields, options are resolved from VocabularyAggregate (VOCAB-002 invariant)
5. `GetVisibleFields` evaluates visible_if conditions to produce the final field set
6. The CRUDForm assembles the fields in section order and renders

---

### Block Type 4: StatusIndicator

The StatusIndicator is a lightweight badge component conveying the current status of an entity or system condition.

| Property | Description |
|----------|-------------|
| **Structure** | Small badge containing a colored dot and optionally a label text, displayed inline with other content |
| **Sources** | The status value comes from the entity's status field enum values (e.g., transaction status: draft/pending/approved/rejected), the sync flag `est_synchronise` boolean, or the `synced_at` timestamp for offline/online determination |
| **Visual encoding** | Green dot = synced / active / completed; Yellow dot = sync_pending / in_progress / pending; Red dot = sync_failed / rejected / suspended; Gray dot = offline / archived / inactive |
| **Text labels** | Both dot color AND accompanying text label convey meaning (accessibility: color alone is insufficient). Text label resolved from vocabulary namespace `common.status.*` |
| **Placement** | Always displayed next to entity names in list views; shown prominently on detail screens; shown in the header of the OfflineSyncAggregate's own screen |
| **Accessibility** | Status conveyed via both color and text; screen readers announce the full status label; keyboard-focusable |

---

### Block Type 5: NavigationRail

The NavigationRail is the primary navigation component providing access to all Aggregate-scoped sections of the application.

| Property | Description |
|----------|-------------|
| **Structure** | Persistent navigation element that provides direct access to each Aggregate's primary screen(s). On desktop: left-side vertical rail. On mobile: bottom horizontal tab bar |
| **Items** | One item per Aggregate boundary exposed through API-CONTRACT-001. The 13 Aggregates map to these navigation items (exact names from vocabulary): |

| # | Aggregate | Navigation Label (example) | Maps To |
|---|-----------|---------------------------|---------|
| 1 | OrganizationAggregate | "Organization" | SCR-ORG-001 DashboardOrg |
| 2 | IdentityAggregate | "Users" | SCR-ID-001 UserList |
| 3 | ResourceAggregate (Financial) | "Transactions" | SCR-RES-001 TransactionList |
| 4 | ResourceAggregate (Members) | "Members" | SCR-MEM-001 MemberList |
| 5 | ResourceAggregate (Events) | "Events" | SCR-EVT-001 EventList |
| 6 | RelationshipAggregate | "Groups" | SCR-REL-001 GroupMembershipList |
| 7 | WorkflowAggregate | "Workflows" | SCR-WF-001 WorkflowQueue |
| 8 | FormAggregate | "Forms" | SCR-FRM-001 FormBuilder |
| 9 | NotificationAggregate | "Notifications" | SCR-NOT-001 Inbox |
| 10 | VocabularyAggregate | "Vocabulary" | SCR-VOC-001 CategoryList |
| 11 | ReportingAggregate | "Reports" | SCR-RPT-001 ReportDashboard |
| 12 | AuditAggregate | "Audit Log" | SCR-AUD-001 AuditLogViewer |
| 13 | LifecycleAggregate | "Archives" | SCR-LIF-001 ArchiveBrowser |

- **Access control**: Each navigation item is guarded by RBAC permissions from API-CONTRACT-004. A user without `transaction:read` does not see "Transactions" in the rail. A superadmin sees all items. A staff user sees only read-accessible items.
- **Active state**: The current screen's source Aggregate is highlighted. Deep links that land on a detail screen still highlight the parent Aggregate's nav item.
- **Badges**: Navigation items may show a count badge for unread notifications (NotificationAggregate), pending approvals (WorkflowAggregate), or pending sync operations (OfflineSyncAggregate).
- **Accessibility**: Keyboard-navigable via arrow keys; current selection announced to screen readers; minimum touch target 44x44px on mobile

---

### Block Type 6: EmptyState

The EmptyState placeholder displays when no data exists for a given view or when a query returns zero results.

| Property | Description |
|----------|-------------|
| **Structure** | Centered content block with three zones: illustration placeholder, descriptive text, call-to-action button |
| **Content** | Illustration zone: generic placeholder icon representing the entity type (e.g., a person icon for Members, a document icon for Transactions). Descriptive text: loaded from vocabulary (fr/en) describing why the list is empty (e.g., "No transactions yet" / "Aucune transaction"). CTA button: text from vocabulary, linked to the Create command for that aggregate (e.g., clicking "Add Transaction" navigates to the TransactionCreate form) |
| **Behavior** | Disappears as soon as data arrives (real-time via data binding); the CTA navigates to the corresponding Create/Add screen |
| **Use cases** | First-time user with no data; cleared list after purge; filtered query returning zero results |
| **Accessibility** | Descriptive text has role="status"; CTA button is keyboard-focusable and full-width on mobile |

---

### Block Type 7: ConfirmationDialog

The ConfirmationDialog is a modal overlay that requires explicit user consent before executing destructive operations.

| Property | Description |
|----------|-------------|
| **Structure** | Centered modal dialog with a title, body text, and two action buttons |
| **Trigger** | Fires for any DELETE operation, any lifecycle state transition to archived/trashed/purged, any organization suspend or merge action |
| **Content** | Confirm message loaded from vocabulary (fr/en): e.g., "Are you sure you want to delete this member? This action cannot be undone." Body text includes the entity name and a brief description of consequences. Action buttons: Cancel (primary) and Confirm (secondary, styled differently to signal danger) |
| **Cancel behavior** | Close modal; return to previous screen state unchanged. No data modified. |
| **Confirm behavior** | Execute the associated command (e.g., DeleteMember); show ToastNotification with success/failure result; close modal; refresh the parent list |
| **Double confirmation rule** | Destructive actions require double confirmation for all users except superadmin. Superadmin sees single confirmation. Regular users who confirm once see the same dialog again with a distinct message ("This is your final warning") |
| **Keyboard** | Escape key closes (cancel); Tab cycles between Cancel and Confirm buttons |

---

### Block Type 8: ToastNotification

The ToastNotification is a non-blocking, transient notification that provides real-time feedback to the user without interrupting their workflow.

| Property | Description |
|----------|-------------|
| **Structure** | Inline notification banner appearing at the bottom (mobile) or top-right (desktop) of the viewport |
| **Sources** | Populated from NotificationAggregate messages and system event notifications generated during command execution |
| **Types** | Three severity levels mapped from notification severities: `info` (blue/cyan tone — e.g., "Form submitted successfully"), `warning` (amber tone — e.g., "Some fields need attention"), `critical` (red tone — e.g., "Sync conflict detected, manual resolution required") |
| **Auto-dismiss** | 5 seconds for info type, 10 seconds for warning/critical. Toasts do NOT auto-dismiss if they contain actionable links (e.g., "Resolve conflict" button). User can dismiss early via close icon |
| **Stacking** | Multiple toasts stack vertically; a maximum of 3 are visible simultaneously; oldest disappears when a fourth arrives |
| **Offline toasts** | When offline, toasts communicate local state: "Changes saved locally, will sync when online" (info); "Network unavailable, operations queued" (warning) |
| **Accessibility** | Role="alert" for critical; role="status" for info/warning; announced by screen readers; not hidden from assistive technology |

---

## SECTION 3: SCREEN CATEGORIES DERIVED FROM AGGREGATES

Each Aggregate maps to one or more canonical screens. These screens are the ONLY valid screens in Lumina v1 — no new screens may be invented beyond this mapping. Every screen derives directly from the responsibilities and operations of its owning Aggregate as defined in DOC-012.

### 3.1 Screen Mapping Table

| # | Screen ID | Screen Name | Aggregate Source | Screen Type | Primary Operations (from API-CONTRACT-001) | Required RBAC Roles (from API-CONTRACT-004) |
|---|-----------|-------------|-----------------|-------------|--------------------------------------------|---------------------------------------------|
| 1 | SCR-ORG-001 | DashboardOrg | OrganizationAggregate | dashboard | GetOrganizationProfile, GetDescendantUnits | admin, treasurer, pastor, staff |
| 2 | SCR-ORG-002 | SettingsOrg | OrganizationAggregate | settings | UpdateOrganizationSettings | admin |
| 3 | SCR-ID-001 | UserList | IdentityAggregate | list | QueryUsers (via SearchResources pattern) | admin, superadmin |
| 4 | SCR-ID-002 | UserDetail | IdentityAggregate | detail | Query user by ID | admin, superadmin |
| 5 | SCR-ID-003 | Login | IdentityAggregate | action | LoginUser | N/A (public) |
| 6 | SCR-ID-004 | Profile | IdentityAggregate | detail | UpdateUserProfile, ResetPassword | self |
| 7 | SCR-RES-001 | TransactionList | ResourceAggregate | list | SearchResources, ExportResources | admin, treasurer, pastor, staff |
| 8 | SCR-RES-002 | TransactionDetail | ResourceAggregate | detail | Query by ID (SearchResources with filter) | admin, treasurer, pastor, staff |
| 9 | SCR-RES-003 | TransactionCreate | ResourceAggregate | create | CreateTransaction | admin, treasurer |
| 10 | SCR-RES-004 | TransactionEdit | ResourceAggregate | edit | UpdateDraftTransaction | admin, creator (of draft) |
| 11 | SCR-MEM-001 | MemberList | ResourceAggregate | list | SearchResources (member type) | admin, treasurer, pastor, staff |
| 12 | SCR-MEM-002 | MemberDetail | ResourceAggregate | detail | Query member by ID | admin, treasurer, pastor, staff |
| 13 | SCR-MEM-003 | MemberCreate | ResourceAggregate | create | CreateMember | admin |
| 14 | SCR-EVT-001 | EventList | ResourceAggregate | list | SearchResources (event type) | admin, treasurer, pastor, staff |
| 15 | SCR-EVT-002 | EventDetail | ResourceAggregate | detail | Query event by ID | admin, treasurer, pastor, staff |
| 16 | SCR-EVT-003 | EventCreate | ResourceAggregate | create | CreateEvent | admin |
| 17 | SCR-REL-001 | GroupMembershipList | RelationshipAggregate | list | GetAllGroupsForMember | admin, treasurer, pastor, staff |
| 18 | SCR-REL-002 | OrgHierarchy | RelationshipAggregate | tree | GetDescendants, GetAllMembersOfGroup | admin |
| 19 | SCR-WF-001 | WorkflowQueue | WorkflowAggregate | list | GetPendingApprovals | admin, assigned approver |
| 20 | SCR-WF-002 | WorkflowInstance | WorkflowAggregate | detail | Query workflow by instance ID | admin, any assigned approver |
| 21 | SCR-FRM-001 | FormBuilder | FormAggregate | settings | LoadFormDefinition, RenderForm, GetVisibleFields | admin |
| 22 | SCR-FRM-002 | FormPreview | FormAggregate | detail | RenderForm (preview mode) | admin |
| 23 | SCR-NOT-001 | Inbox | NotificationAggregate | list | Query notifications (user-scoped) | self |
| 24 | SCR-NOT-002 | NotificationPreferences | NotificationAggregate | settings | UpdatePreferences, SetRateLimit, SuppressUntil | self, admin |
| 25 | SCR-VOC-001 | CategoryList | VocabularyAggregate | list | GetTerms, GetAllNamespaces | any authenticated |
| 26 | SCR-VOC-002 | NamespaceManage | VocabularyAggregate | settings | AddTermValue, DeprecateTermValue | admin |
| 27 | SCR-RPT-001 | ReportDashboard | ReportingAggregate | dashboard | GenerateReport, CalculateBalance | admin, treasurer |
| 28 | SCR-RPT-002 | ReportSnapshot | ReportingAggregate | detail | ExportReport | admin, treasurer |
| 29 | SCR-AUD-001 | AuditLogViewer | AuditAggregate | list | QueryAuditLogs, ExportAuditTrail | admin, auditor |
| 30 | SCR-LIF-001 | ArchiveBrowser | LifecycleAggregate | list | ListArchiveEntries, SearchArchives | admin |
| 31 | SCR-LIF-002 | PurgeScheduler | LifecycleAggregate | settings | SchedulePurge, ApplyTags | admin |
| 32 | SCR-CFG-001 | SettingsConfig | ConfigurationAggregate | settings | GetAllSettings, UpdateSetting | admin |
| 33 | SCR-CFG-002 | SettingManage | ConfigurationAggregate | edit | UpdateSetting, ResetToDefaults | admin |
| 34 | SCR-SYNC-001 | SyncStatusPanel | OfflineSyncAggregate | dashboard | CheckConnectivity, GetSyncStatus | any authenticated |
| 35 | SCR-SYNC-002 | PendingOpsViewer | OfflineSyncAggregate | list | Query pending operations (system-derived) | admin |

### 3.2 Screen Classification Summary

| Classification | Count | Examples |
|---------------|-------|---------|
| **List screens** | 12 | TransactionList, MemberList, UserList, EventList, GroupMembershipList, WorkflowQueue, CategoryList, AuditLogViewer, ArchiveBrowser, PendingOpsViewer, Inbox |
| **Detail screens** | 9 | TransactionDetail, MemberDetail, EventDetail, UserDetail, OrgHierarchy, WorkflowInstance, FormPreview, ReportSnapshot, SettingsConfig |
| **Create screens** | 4 | TransactionCreate, MemberCreate, EventCreate |
| **Edit screens** | 4 | TransactionEdit, SettingManage, NamespaceManage |
| **Dashboard screens** | 4 | DashboardOrg, ReportDashboard, SyncStatusPanel |
| **Settings screens** | 3 | SettingsOrg, NotificationPreferences, PurgeScheduler |
| **Auth screens** | 1 | Login |
| **Self-service screens** | 1 | Profile |
| **Form builder screens** | 2 | FormBuilder, FormPreview |

### 3.3 Derived Screens from Cross-Aggregate Coordination (ASS-004)

The following screens exist solely to present the results of cross-aggregate coordination. They do not correspond to standalone aggregates but display orchestrated data:

| Screen ID | Screen Name | Coordinating Aggregates | Purpose |
|-----------|-------------|----------------------|---------|
| SCR-CRD-001 | ApprovalDetail | WorkflowAggregate + ResourceAggregate | Display approval step with the resource being approved (approval step reads from WorkflowAggregate, the underlying transaction from ResourceAggregate) |
| SCR-CRD-002 | ArchiveDetailView | LifecycleAggregate + ResourceAggregate | Show archive entry alongside the original resource reference (archive entry from LifecycleAggregate, referenced data from ResourceAggregate via lazy load) |

These cross-aggregate screens appear as transitions when navigating from a list to a detail, combining data from two owning Aggregates into a single unified view. They inherit permissions from the MOST RESTRICTIVE of the two source Aggregates.

---

## SECTION 4: SCREEN-TO-OPERATION TRACEABILITY

Every screen in Section 3 maps to at least one operation defined in API-CONTRACT-001. The following table provides the complete traceability chain.

| Screen ID | Primary Query Op | Primary Write Op | Primary Action Op |
|-----------|-----------------|------------------|-------------------|
| SCR-ORG-001 | GetOrganizationProfile (§9) | — | — |
| SCR-ORG-002 | UpdateOrganizationSettings (§2) (read settings first) | UpdateOrganizationSettings (§2) | — |
| SCR-ID-001 | (Query pattern via Identity) | CreateUser (§1) | ChangeUserRole (§3) |
| SCR-ID-002 | (Query by ID) | UpdateUserProfile (§2) | — |
| SCR-ID-003 | — | LoginUser (§5) | — |
| SCR-ID-004 | (Self-query) | UpdateUserProfile (§2), ResetPassword (§4) | LogoutUser (§6), RefreshAccessToken (§7) |
| SCR-RES-001 | SearchResources (§10) | — | ExportResources (§11) |
| SCR-RES-002 | (Filter SearchResources) | — | ApproveTransaction (§4), RejectTransaction (§5), CompensateTransaction (§6) |
| SCR-RES-003 | — | CreateTransaction (§1) | SubmitForApproval (§3) |
| SCR-RES-004 | (By ID search) | UpdateDraftTransaction (§2) | SubmitForApproval (§3) |
| SCR-MEM-001 | SearchResources (§10) | — | TransitionMemberStatus (§9) |
| SCR-MEM-002 | (By ID search) | UpdateMember (§8) | TransitionMemberStatus (§9) |
| SCR-MEM-003 | — | CreateMember (§7) | — |
| SCR-EVT-001 | SearchResources (§10) | — | TransitionEventStatus (boundary) |
| SCR-EVT-002 | (By ID search) | UpdateEvent (boundary) | TransitionEventStatus (boundary) |
| SCR-EVT-003 | — | CreateEvent (boundary) | — |
| SCR-REL-001 | GetAllGroupsForMember (§5) | AddMemberToGroup (§1) | RemoveMemberFromGroup (§2) |
| SCR-REL-002 | GetDescendants (§4), GetAllMembersOfGroup (§6) | SetOrgUnitParent (§3) | DetectCycles (§7) |
| SCR-WF-001 | GetPendingApprovals (§query) | ApproveStep (§2), RejectStep (§3), CancelWorkflow (§4), ResubmitForApproval (§5) | — |
| SCR-WF-002 | (By instance ID) | ApproveStep (§2) | CancelWorkflow (§4) |
| SCR-FRM-001 | LoadFormDefinition (§1), RenderForm (§3), GetVisibleFields (§4) | ValidateFormData (§2) | — |
| SCR-FRM-002 | RenderForm (§3) (read-only preview) | — | — |
| SCR-NOT-001 | (User-scoped query pattern) | MarkAsRead (§2) | — |
| SCR-NOT-002 | (Preferences query) | UpdatePreferences (§3), SetRateLimit (§4), SuppressUntil (§5) | — |
| SCR-VOC-001 | GetTerms (§4), GetAllNamespaces (§7) | — | — |
| SCR-VOC-002 | GetTermValues (§5), SearchTerms (§6) | AddTermValue (§1), DeprecateTermValue (§2) | — |
| SCR-RPT-001 | CalculateBalance (§2), GetReportTypes (§query) | GenerateReport (§1) | — |
| SCR-RPT-002 | (Generated report by ID) | ExportReport (§3) | — |
| SCR-AUD-001 | QueryAuditLogs (§2) | — | ExportAuditTrail (§3) |
| SCR-LIF-001 | ListArchiveEntries (§query) | ArchiveResource (§1), TrashResource (§2), ApplyTags (§tag) | SearchArchives (§query2) |
| SCR-LIF-002 | (Purge schedule query) | SchedulePurge (§schedule), RestoreFromTrash (§restore) | PurgeResource (§purge, system-only) |
| SCR-CFG-001 | GetAllSettings (§4) | — | — |
| SCR-CFG-002 | GetSetting (§3) (reads individual) | UpdateSetting (§1), ResetToDefaults (§2) | — |
| SCR-SYNC-001 | CheckConnectivity (§5), GetSyncStatus (§6) | — | — |
| SCR-SYNC-002 | (System-derived pending ops list) | ResolveConflict (§3), MarkOperationConfirmed (§4) | PushPendingOperations (§1, system-auto) |

Total screens: **35 canonical screens** + **2 cross-aggregate screens** = **37 total**.

---

## SECTION 5: REUSABLE BLOCK COMPOSITION MATRIX

Each screen type maps to a predefined composition of building blocks from Section 2. This ensures consistency across the application.

| Screen Type | Block Composition |
|------------|-----------------|
| **List screens** | ScreenContainer (title + breadcrumbs + "Create" action button) + DataTable (main content) + EmptyState (if data empty) + StatusIndicator (row-level sync badges) |
| **Detail screens** | ScreenContainer (title + breadcrumbs) + DataTable (single-row summary OR structured detail panel) + StatusIndicator (entity status) + ConfirmationDialog (triggered by Delete/Archive action) |
| **Create screens** | ScreenContainer (title + breadcrumbs + "Cancel" action) + CRUDForm (main content) + ToastNotification (on submit) + ConfirmationDialog (triggered only if unsaved data and user attempts to leave) |
| **Edit screens** | ScreenContainer (title + breadcrumbs + "Cancel" action) + CRUDForm (pre-populated with existing data) + StatusIndicator (edit-lock indicator if resource is approved) + ToastNotification (on save) |
| **Dashboard screens** | ScreenContainer (title, no breadcrumbs) + multiple DataTable summaries (KPI cards conceptually) + StatusIndicator (sync status of org) + EmptyState (if no dashboard data) |
| **Settings screens** | ScreenContainer (title + breadcrumbs) + CRUDForm (configuration form) + ToastNotification (on save) |
| **Auth screens** | ScreenContainer (compact, no breadcrumbs) + CRUDForm (login form) + StatusIndicator (connection status below form) |
| **Self-service screens** | ScreenContainer (title + breadcrumbs) + CRUDForm (profile edit) + StatusIndicator (session count indicator) |
| **Form builder screens** | ScreenContainer (title + breadcrumbs + "Preview" action) + CRUDForm (form definition editor) + StatusIndicator (version indicator from FRM-004) |
| **Cross-aggregate screens** | ScreenContainer (merged breadcrumbs from both Aggregates) + composite detail (data from both sources) + StatusIndicator (status from primary source) |

---

## SECTION 6: STATE MANAGEMENT PRINCIPLES

### 6.1 Client-Side State

Each screen manages the following client-side states:
- **Loading** — Data fetching in progress; show skeleton placeholder or spinner
- **Error** — Data fetch failed; show error message from vocabulary (fr/en); provide retry action
- **Success** — Data loaded; render the normal screen content
- **Submitting** — Form submission in progress; disable form inputs; show inline spinner
- **Offline** — Connectivity lost; show sync status indicator in yellow/red; queue all writes locally

### 6.2 Server-Driven State

No screen state machine is defined in the presentation layer. All state transitions flow from the Application Service responses:
- A successful CreateTransaction response triggers a navigation back to TransactionList with a success toast
- A failed submission displays inline field errors from the ValidationResult
- A permission-denied response redirects to Login (SCR-ID-003)

### 6.3 Offline State Resolution

When the device is offline:
1. The OfflineSyncAggregate's CheckConnectivity returns connection state = offline
2. All screens display the gray StatusIndicator at the top
3. Data is served from the local cache (SQLite store, per DOC-017 Persistence Model)
4. Write operations are queued as PendingOperation records (SYNC-001: local precedes remote)
5. No screen throws a fatal error — every screen gracefully degrades to cached-data + offline-indicator mode
6. The SyncStatusPanel (SCR-SYNC-001) is the only screen that focuses specifically on the offline state

---

## SECTION 7: ACCESSIBILITY REQUIREMENTS

All screens must comply with the following accessibility requirements derived from Principle 5 above:

| Requirement | Implementation Directive |
|------------|-------------------------|
| **WCAG AA minimum** | All text meets 4.5:1 contrast ratio (or 3:1 for large text); all non-text elements have text alternatives |
| **Keyboard navigation** | Full tab-order traversal of every screen; Escape closes modals; Enter submits forms; Arrow keys navigate in DataTabs when focused |
| **Screen reader labels** | Every input has an associated visible or programmatic label; status indicators include sr-only text alternative |
| **Error announcement** | Form validation errors are announced immediately to screen readers via aria-live region; errors are grouped under a heading |
| **Focus management** | After form submission (success or error), focus moves to the result toast or the first invalid field |
| **Touch target size** | Minimum 44x44px tap targets on mobile; buttons and link areas sized accordingly |
| **Reduced motion** | Animations and transitions respect the OS-level prefers-reduced-motion setting |
| **Text scaling** | All layouts accommodate text scaled up to 200% without content loss or overlap |

---

## SECTION 8: COMPILANCE STATEMENT

This document covers all 13 Aggregates defined in DOC-012 and all 83 operations defined in API-CONTRACT-001.

Every screen listed in Section 3 maps to at least one operation from API-CONTRACT-001. Every navigation item in Block Type 5 maps to one of the 13 Aggregates. Every form field type in Block Type 3 maps to a field type defined in DOC-021 §6.3 (form_fields.type_champ). Every permission check maps to API-CONTRACT-004 authorization rules.

No screen was invented beyond what is derivable from the 13 Aggregates and the 2 cross-aggregate coordination patterns defined in ASS-004. Total canonical screens: 37 (35 aggregate-derived + 2 cross-aggregate).

This specification is framework-agnostic, language-agnostic, and technology-agnostic. It describes WHAT the user sees and interacts with, not HOW the pixels are drawn or which framework renders them.

---

*End of UI-SPEC-001 — Canonical UI Model*
*Document ID: UI-SPEC-001 | Version: v1.0 | Compliance Status: COMPLIANT*
