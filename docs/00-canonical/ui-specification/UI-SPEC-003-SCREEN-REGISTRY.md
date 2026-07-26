# Screen Registry — Lumina v1

**Doc ID:** UI-SPEC-003
**Version:** v1.0
**Statut:** SPECIFICATION UI DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "ASS-001", "ASS-004", "PAS-001"]
**Transformation_rule :** "ui-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document provides the **complete registry of every canonical screen** in the Lumina application. Each screen entry is a self-contained specification derived exclusively from one or more Aggregates defined in DOC-012, their operations defined in API-CONTRACT-001, and their cross-aggregate coordination patterns defined in ASS-004.

Every screen listed here must appear in the Screen Registry — no screen exists outside this document. If a screen is not listed here, it does not exist in Lumina v1. This is an exhaustive and closed registry.

Each screen entry specifies:
- The owning Aggregate(s)
- The primary operations (commands/queries) that the screen invokes
- The RBAC roles permitted to see the screen
- The data dependencies (which API queries are needed)
- The reusable building blocks (from UI-SPEC-001 §2) used by the screen

---

## SECTION 1: ORGANIZATION AGGREGATE SCREENS

### SCR-ORG-001: DashboardOrg

**Source Aggregate**: OrganizationAggregate (DOC-012, Aggregate 1)
**Primary Operations**: GetOrganizationProfile (API-CONTRACT-001 §9), GetDescendantUnits (§10)
**RBAC Roles**: admin, treasurer, pastor, staff
**Screen Type**: dashboard
**Required Data**: Organization profile (name, type, status, settings); descendant OrgUnit tree; pending approval count from WorkflowAggregate (via ASS-004 Event-driven coordination); pending sync count from OfflineSyncAggregate (via ASS-004 Fan-out monitoring)
**Reusable Components**: ScreenContainer (expanded variant, no action bar), StatusIndicator (org sync status in header), DataTable summaries (transaction counts, member counts, event counts — all read-only aggregates from ResourceAggregate via SearchResources scoped by org_id), EmptyState (if first-time organization with zero data)

**Description**: The organizational landing screen. Displays the organization's current profile, membership summary, financial summary (approved transactions only — SYNCED-001 invariant), and active workflow items requiring attention. All data is read-only on this screen; editing org settings navigates to SCR-ORG-002.

---

### SCR-ORG-002: SettingsOrg

**Source Aggregate**: OrganizationAggregate (DOC-012, Aggregate 1)
**Primary Operations**: UpdateOrganizationSettings (API-CONTRACT-001 §2; reads settings via GetSetting pattern first)
**RBAC Roles**: admin
**Screen Type**: settings
**Required Data**: Current organization settings from ConfigurationAggregate (via API-CONTRACT-001 §2 coordination with ConfigurationService); currency, timezone, language preference, accent color
**Reusable Components**: ScreenContainer (default variant with breadcrumbs), CRUDForm (dynamically rendered from organization settings FormDefinition), ToastNotification (on save success/error), StatusIndicator (sync status of settings changes)

**Description**: Organization-level configuration screen. Allows admin to update the organization's name, type, timezone, currency, language preference, and accent color. Settings updates trigger SettingUpdated event and are audited by AuditAggregate (ASS-004, ALL Aggregates → AuditAggregate).

---

## SECTION 2: IDENTITY AGGREGATE SCREENS

### SCR-ID-001: UserList

**Source Aggregate**: IdentityAggregate (DOC-012, Aggregate 2)
**Primary Operations**: QueryUsers via SearchResources pattern (read all users within org); CreateUser (API-CONTRACT-001 §1); ChangeUserRole (§3)
**RBAC Roles**: admin, superadmin
**Screen Type**: list
**Required Data**: List of users within the current org; each user entry shows: name (prenom + nom_famille), email, role, status (active/inactive/deactivated), last login timestamp
**Reusable Components**: ScreenContainer (with "Add User" action button), DataTable (columns: Name, Email, Role, Status, Last Login, Actions), EmptyState (if no users besides creator), ConfirmationDialog (triggered by Delete user or ChangeRole actions)

**Description**: Admin-managed user roster for the organization. Shows all users with their roles. Non-admin users cannot access this screen. The "Add User" button navigates to SCR-ID-004 (self-create context) when triggered by superadmin, or to the CreateUser form directly.

---

### SCR-ID-002: UserDetail

**Source Aggregate**: IdentityAggregate (DOC-012, Aggregate 2)
**Primary Operations**: Query specific user by ID; UpdateUserProfile (API-CONTRACT-001 §2); ChangeUserRole (§3, superadmin only)
**RBAC Roles**: admin, superadmin
**Screen Type**: detail
**Required Data**: Full user profile: name, email, phone (if provided), role, status, permission grants, session list (active sessions), creation timestamp
**Reusable Components**: ScreenContainer (default variant), DataTable (single-row detail view), StatusIndicator (user active/inactive), ConfirmationDialog (session revocation), ToastNotification (on update)

**Description**: Individual user profile view. Admins can update user profile fields, change roles (superadmin only), reset passwords, and manage sessions. Self-service users access their own profile via SCR-ID-004.

---

### SCR-ID-003: Login

**Source Aggregate**: IdentityAggregate (DOC-012, Aggregate 2)
**Primary Operations**: LoginUser (API-CONTRACT-001 §5)
**RBAC Roles**: N/A (public — no authentication required to access)
**Screen Type**: action (authentication gate)
**Required Data**: None (this is an authentication screen; no entity data required)
**Reusable Components**: ScreenContainer (compact variant — no breadcrumbs, minimal header), CRUDForm (email + password fields; remember-me toggle), StatusIndicator (network connectivity status below form), ToastNotification (login failure/success messages)

**Description**: The authentication entry point. Users enter credentials (email + password); the system validates against IdentityAggregate and issues ephemeral tokens. This is the only publicly accessible screen. On failure, an error message displayed (without revealing whether the email or password was incorrect, per IdentityProviderPort constraint).

---

### SCR-ID-004: Profile

**Source Aggregate**: IdentityAggregate (DOC-012, Aggregate 2)
**Primary Operations**: UpdateUserProfile (API-CONTRACT-001 §2); ResetPassword (§4); LogoutUser (§6); RefreshAccessToken (§7); RevokeSession (§8)
**RBAC Roles**: self (each user manages their own profile)
**Screen Type**: detail (self-service)
**Required Data**: Current user's own profile data; active session list
**Reusable Components**: ScreenContainer (default variant with breadcrumbs), CRUDForm (profile fields: firstName, lastName, email, phone; password fields hidden from display — only shown during reset), ToastNotification (update success/failure), ConfirmationDialog (logout confirmation, revoke all sessions)

**Description**: Self-service profile management screen. Each user can update their own profile information, request a password reset, view active sessions, and log out. Admin-managed users are edited via SCR-ID-002 (UserDetail).

---

## SECTION 3: RESOURCE AGGREGATE — FINANCIAL SCREENS

### SCR-RES-001: TransactionList

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Financial sub-domain)
**Primary Operations**: SearchResources (API-CONTRACT-001 §10); ExportResources (§11)
**RBAC Roles**: admin, treasurer, pastor, staff (all have at least read access; write depends on specific role)
**Screen Type**: list
**Required Data**: List of transactions filtered by org_id; each entry shows: reference, amount, category (from VocabularyAggregate), date, status, created_by name
**Reusable Components**: ScreenContainer (with "Add Transaction" action button), DataTable (columns: Reference, Amount, Category, Date, Status, Created By, Actions), StatusIndicator (per-row sync status badge), EmptyState (no transactions yet), ConfirmationDialog (delete/reject if permitted), ToastNotification (export progress, delete confirmation result)

**Description**: Financial transaction listing screen. Default filter is "all approved" for reporting accuracy (SYNCED-001). Users with appropriate permissions can filter by status (draft, pending, approved, rejected). The "Add Transaction" button navigates to SCR-RES-003 (TransactionCreate).

---

### SCR-RES-002: TransactionDetail

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Financial sub-domain)
**Primary Operations**: SearchResources with entity_id filter (§10); ApproveTransaction (§4); RejectTransaction (§5); CompensateTransaction (§6)
**RBAC Roles**: admin, treasurer, pastor, staff
**Screen Type**: detail
**Required Data**: Full transaction record: reference, amount (BIGINT cents), category (resolved label from VocabularyAggregate), date, description, scope (type + target), compensates_for (if applicable), approval chain (who submitted, who approved/rejected, timestamps), version number, sync status, audit trail link
**Reusable Components**: ScreenContainer (default variant), DataTable (single-row detail view structured as labeled field pairs: Label — Value), StatusIndicator (transaction status badge), ConfirmationDialog (reject transaction, compensate transaction — destructive actions), ToastNotification (approval/rejection confirmation), EmptyState (none expected — this is a detail screen for an existing entity)

**Description**: Individual transaction detail view. Shows all transaction fields in a structured layout. Available actions depend on the transaction's current status: if pending, approvers see "Approve" and "Reject" buttons; anyone can see "Compensate" if the transaction is approved and they have create permission. If draft, "Edit" links to SCR-RES-004.

---

### SCR-RES-003: TransactionCreate

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Financial sub-domain)
**Primary Operations**: CreateTransaction (API-CONTRACT-001 §1); SubmitForApproval (§3)
**RBAC Roles**: admin, treasurer
**Screen Type**: create
**Required Data**: None (new entity); the CRUDForm is populated dynamically from the transaction FormDefinition (loaded via FormAggregate.LoadFormDefinition)
**Reusable Components**: ScreenContainer (with "Cancel" action), CRUDForm (fields from FormDefinition: amount, category, date, description, scope_type, scope_target; select options loaded from VocabularyAggregate per VOCAB-002), StatusIndicator (connection status if offline), ToastNotification (success/creation confirmation), ConfirmationDialog (unsaved changes warning if user attempts to navigate away)

**Description**: Form-based transaction creation screen. The CRUDForm is rendered from the transaction FormDefinition stored in FormAggregate. Categories are sourced from VocabularyAggregate terms. After submission, the user can optionally submit for approval (status transitions to pending), which triggers WorkflowAggregate if applicable.

---

### SCR-RES-004: TransactionEdit

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Financial sub-domain)
**Primary Operations**: UpdateDraftTransaction (API-CONTRACT-001 §2); SubmitForApproval (§3)
**RBAC Roles**: admin, creator (of the draft transaction)
**Screen Type**: edit
**Required Data**: Existing transaction data pre-loaded into the CRUDForm via SearchResources filter by entity_id
**Reusable Components**: ScreenContainer (with "Cancel" action), CRUDForm (pre-populated with existing values; fields matching the transaction FormDefinition), StatusIndicator (edit-lock indicator if transaction is NOT in draft status — approved transactions are immutable; only draft/pending transactions can be edited), ToastNotification (save success/error), ConfirmationDialog (approve changes via SubmitForApproval)

**Description**: Draft transaction editing screen. Only transactions in "draft" status can be edited (FIN-001 invariant: approved transactions are immutable). The form pre-populates existing values; changing category triggers a re-validation check against VocabularyAggregate. Submitting edits transitions the transaction back to pending if it was previously approved (resubmission flow).

---

## SECTION 4: RESOURCE AGGREGATE — MEMBERS SCREENS

### SCR-MEM-001: MemberList

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Members sub-domain)
**Primary Operations**: SearchResources (member type) (§10); ExportResources (§11)
**RBAC Roles**: admin, treasurer, pastor, staff
**Screen Type**: list
**Required Data**: List of members within the current org; each entry shows: member name, member number, status (active/inactive/deceased/transferred), date of entry, group memberships
**Reusable Components**: ScreenContainer (with "Add Member" action button), DataTable (columns: Member Number, Name, Status, Join Date, Groups, Actions), StatusIndicator (per-row sync status), EmptyState (no members yet), ConfirmationDialog (deactivate member if permitted)

**Description**: Member roster listing screen. Members are displayed with their current status and group memberships. Filtering by status is available; filtering by group requires navigating to SCR-REL-001 (GroupMembershipList) for group-centric views.

---

### SCR-MEM-002: MemberDetail

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Members sub-domain)
**Primary Operations**: SearchResources with entity_id filter; UpdateMember (API-CONTRACT-001 §8); TransitionMemberStatus (§9)
**RBAC Roles**: admin, treasurer, pastor, staff
**Screen Type**: detail
**Required Data**: Full member record: member number, first name, last name, email (if provided), phone (if provided), status, join date, transfer date (if transferred), deceased date (if deceased), linked groups
**Reusable Components**: ScreenContainer (default variant), DataTable (detail fields as labeled rows), StatusIndicator (member status), ConfirmationDialog (change to deceased or transferred — status transitions that are harder to reverse), ToastNotification (update confirmation)

**Description**: Individual member detail view. Shows complete member information and their group memberships. Actions available depend on the member's current status and the user's permissions. Transitions to deceased or transferred require confirmation dialogs.

---

### SCR-MEM-003: MemberCreate

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Members sub-domain)
**Primary Operations**: CreateMember (API-CONTRACT-001 §7)
**RBAC Roles**: admin
**Screen Type**: create
**Required Data**: None (new entity); form populated from member FormDefinition
**Reusable Components**: ScreenContainer (with "Cancel" action), CRUDForm (from member FormDefinition: firstName, lastName [required], email [optional], phone [optional], memberNumber [auto-generated]), StatusIndicator (offline queue indicator if applicable), ToastNotification (creation success), ConfirmationDialog (unsaved changes warning)

**Description**: Form-based member creation screen. First and last name are mandatory (MEM-001 invariant). Email must be unique within the org (EMAIL-001). The member number is auto-generated by the system. Upon creation, the user can optionally add the member to groups via a relationship selector (linking to RelationshipAggregate).

---

## SECTION 5: RESOURCE AGGREGATE — EVENTS SCREENS

### SCR-EVT-001: EventList

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Events sub-domain)
**Primary Operations**: SearchResources (event type) (§10); ExportResources (§11)
**RBAC Roles**: admin, treasurer, pastor, staff
**Screen Type**: list
**Required Data**: List of events within the current org; each entry shows: title, type, start date, end date, status (draft/published/cancelled/completed), responsible person
**Reusable Components**: ScreenContainer (with "Add Event" action button), DataTable (columns: Title, Type, Start Date, End Date, Status, Responsible, Actions), StatusIndicator (per-row status + sync), EmptyState (no events scheduled), ConfirmationDialog (cancel event)

**Description**: Event listing screen. Events can be viewed in a list or calendar view (calendar view is a presentation detail not specified in this canonical spec — the data model supports both). Filtering by status, date range, and type is supported.

---

### SCR-EVT-002: EventDetail

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Events sub-domain)
**Primary Operations**: SearchResources with entity_id filter; UpdateEvent; TransitionEventStatus
**RBAC Roles**: admin, treasurer, pastor, staff
**Screen Type**: detail
**Required Data**: Full event record: title, type, description, start date/time, end date/time, responsible person, location (if any), status, linked members/participants
**Reusable Components**: ScreenContainer (default variant), DataTable (detail fields), StatusIndicator (event status), ConfirmationDialog (cancel event status transition), ToastNotification (status transition confirmation)

**Description**: Individual event detail view. Shows complete event information including participating members (linked via RelationshipAggregate membership). Status transitions follow the event state machine: draft→published, any→cancelled, published→completed.

---

### SCR-EVT-003: EventCreate

**Source Aggregate**: ResourceAggregate (DOC-012, Aggregate 3 — Events sub-domain)
**Primary Operations**: CreateEvent
**RBAC Roles**: admin
**Screen Type**: create
**Required Data**: None (new entity); form from event FormDefinition
**Reusable Components**: ScreenContainer (with "Cancel"), CRUDForm (event fields from FormDefinition), StatusIndicator (offline indicator), ToastNotification (creation success), ConfirmationDialog (unsaved changes warning)

**Description**: Form-based event creation screen. Date and time fields enforce CHECK constraint that end date > start date (CONSTRAINTS-INDEX-SPECIFICATION-v1.md, events table). Responsible person is selected from the user list (IdentityAggregate).

---

## SECTION 6: RELATIONSHIP AGGREGATE SCREENS

### SCR-REL-001: GroupMembershipList

**Source Aggregate**: RelationshipAggregate (DOC-012, Aggregate 4)
**Primary Operations**: GetAllGroupsForMember (API-CONTRACT-001 §5); GetAllMembersOfGroup (§6); AddMemberToGroup (§1); RemoveMemberFromGroup (§2)
**RBAC Roles**: admin, treasurer, pastor, staff (query); admin (add/remove)
**Screen Type**: list
**Required Data**: Two-view data: (a) groups for a selected member, (b) members of a selected group. Cross-references IdentityAggregate (members) and OrganizationAggregate (org_units as groups)
**Reusable Components**: ScreenContainer (with "Add Member to Group" action button), DataTable (group-membership pairs), StatusIndicator (membership status), EmptyState (no group memberships), ConfirmationDialog (remove member from group)

**Description**: Many-to-many membership management between members and org units/groups. The screen has two modes: "Show groups for member X" and "Show members of group Y." Switching between modes toggles the DataTable's data source. Add/Remove operations are guarded by MULTI-020 (no duplicate PK) and HISTORY-022 (audit trail preserved).

---

### SCR-REL-002: OrgHierarchy

**Source Aggregate**: RelationshipAggregate (DOC-012, Aggregate 4) + OrganizationAggregate (parent data)
**Primary Operations**: GetDescendants (API-CONTRACT-001 §4); SetOrgUnitParent (§3)
**RBAC Roles**: admin
**Screen Type**: tree (specialized list)
**Required Data**: Full OrgUnit hierarchy tree up to 5 levels deep (REL-002); parent-child relationships via OrgUnitParentLink
**Reusable Components**: ScreenContainer (default variant), tree-rendered view (DataTable with indentation showing hierarchy depth), StatusIndicator (org unit status: active/archived), ConfirmationDialog (reparent org unit — requires cycle detection)

**Description**: Hierarchical visualization of the organization unit structure. Displays as a collapsible tree (desktop) or accordion list (mobile). Depth is limited to 5 levels (REL-002 invariant). Reparenting a node uses Kahn's algorithm for cycle detection before committing.

---

## SECTION 7: WORKFLOW AGGREGATE SCREENS

### SCR-WF-001: WorkflowQueue

**Source Aggregate**: WorkflowAggregate (DOC-012, Aggregate 5)
**Primary Operations**: GetPendingApprovals (API-CONTRACT-001 query); ApproveStep (§2); RejectStep (§3); CancelWorkflow (§4); ResubmitForApproval (§5)
**RBAC Roles**: admin, assigned approver
**Screen Type**: list
**Required Data**: List of workflow steps awaiting approval by the current user; each entry shows: instance ID, resource type (transaction/member/event), step type (approval), assignee (current user), timeout countdown, current step status
**Reusable Components**: ScreenContainer (with badge count of pending approvals), DataTable (columns: Resource, Step Type, Assignee, Timeout, Status, Actions), StatusIndicator (timeout urgency — yellow approaching deadline, red past deadline), ConfirmationDialog (reject step — reason required; cancel workflow)

**Description**: Approval queue for the current user. Shows only workflow steps where the current user is the assigned approver. CHAINS-003 invariant enforces maximum 5 approval levels. WF-005 invariant ensures workflows never modify approved transactions directly. Approving a step emits StepApproved event which may advance to the next step or complete the workflow.

---

### SCR-WF-002: WorkflowInstance

**Source Aggregate**: WorkflowAggregate (DOC-012, Aggregate 5)
**Primary Operations**: GetPendingApprovals with instance filter; ApproveStep; CancelWorkflow; ResubmitForApproval
**RBAC Roles**: admin, any assigned approver for this instance
**Screen Type**: detail
**Required Data**: Full workflow instance details: current step index, total steps, status (running/completed/failed/cancelled), step-by-step execution trace, associated resource reference
**Reusable Components**: ScreenContainer (default variant), DataTable (step-by-step trace as a sequential list), StatusIndicator (workflow overall status), ConfirmationDialog (cancel running workflow)

**Description**: Detailed view of a single workflow execution. Shows the step-by-step progression of the workflow, with each step's type, assignee, status, completion timestamp, and timeout information. If the current user is an assigned approver, inline action buttons appear on pending steps.

---

## SECTION 8: FORM AGGREGATE SCREENS

### SCR-FRM-001: FormBuilder

**Source Aggregate**: FormAggregate (DOC-012, Aggregate 6)
**Primary Operations**: LoadFormDefinition (API-CONTRACT-001 §1); ValidateFormData (§2); RenderForm (§3); GetVisibleFields (§4)
**RBAC Roles**: admin (edit); any authenticated (read-only load)
**Screen Type**: settings
**Required Data**: FormDefinition (id, model ref, semantic version, sections array, fields array); vocabulary options for select fields (from VocabularyAggregate per VOCAB-002); current saved version for comparison
**Reusable Components**: ScreenContainer (with "Preview" and "Save" action buttons), CRUDForm (form definition editor — this is a meta-form: a form for building forms), StatusIndicator (version indicator — FRM-004: old versions are immutable), ToastNotification (save success, validation errors)

**Description**: Admin interface for creating and editing form definitions. The FormBuilder screen IS itself a CRUDForm whose fields define other CRUDForms. Select/multiselect field options are always sourced from VocabularyAggregate (never hardcoded — VOCAB-002 + FRM-001 invariants). Saving a new version locks the previous version (FRM-004).

---

### SCR-FRM-002: FormPreview

**Source Aggregate**: FormAggregate (DOC-012, Aggregate 6)
**Primary Operations**: RenderForm (API-CONTRACT-001 §3 — preview mode); GetVisibleFields (§4)
**RBAC Roles**: any authenticated
**Screen Type**: detail
**Required Data**: FormDefinition rendered in preview mode (not editable); visible fields evaluated against sample/test data
**Reusable Components**: ScreenContainer (default variant with "Back to Editor" button), CRUDForm (preview rendering of the form definition — read-only; all input fields disabled), StatusIndicator (form version being previewed)

**Description**: Read-only preview of a form definition as it would appear to end users. Useful for validating that form layouts, field order, section grouping, conditional visibility rules, and vocabulary-backed select options render correctly before publishing the form definition.

---

## SECTION 9: NOTIFICATION AGGREGATE SCREENS

### SCR-NOT-001: Inbox

**Source Aggregate**: NotificationAggregate (DOC-012, Aggregate 7)
**Primary Operations**: MarkAsRead (API-CONTRACT-001 §2); (Read: user-scoped query pattern — notifications for the current user)
**RBAC Roles**: self (each user sees only their own notifications)
**Screen Type**: list
**Required Data**: Notifications filtered by user_id; each entry shows: subject (fr/en), body preview, channel type, severity level, read/unread status, timestamp, trigger source
**Reusable Components**: ScreenContainer (with unread count badge), DataTable (columns: Subject, Severity, Channel, Time, Status, Actions), StatusIndicator (unread dot: blue for unread, gray for read), ToastNotification (mark as read confirmation — optional, can be silent bulk operation)

**Description**: Personal notification inbox. Each user sees only their own notifications (NOT-001: every notification has a documented trigger source). In-app notifications are delivered even when offline (BR-NOT-003: in-app notifications always delivered). Critical severity notifications bypass quiet hours (QUIET-004). Tapping a notification marks it as read.

---

### SCR-NOT-002: NotificationPreferences

**Source Aggregate**: NotificationAggregate (DOC-012, Aggregate 7)
**Primary Operations**: UpdatePreferences (API-CONTRACT-001 §3); SetRateLimit (§4); SuppressUntil (§5)
**RBAC Roles**: self (own preferences); admin (any user's preferences)
**Screen Type**: settings
**Required Data**: Current notification preferences (channels enabled, minimum severity, rate limit configuration, quiet hours schedule)
**Reusable Components**: ScreenContainer (default variant), CRUDForm (notification preference fields), StatusIndicator (quiet hours active indicator), ToastNotification (preferences updated confirmation)

**Description**: User-configurable notification preferences. Controls which channels receive notifications (in_app, push, email, sms), minimum severity threshold for delivery, rate limiting (max notifications per hour), and quiet hours schedule. CHANNEL-003 invariant ensures user preferences are respected going forward.

---

## SECTION 10: VOCABULARY AGGREGATE SCREENS

### SCR-VOC-001: CategoryList

**Source Aggregate**: VocabularyAggregate (DOC-012, Aggregate 8)
**Primary Operations**: GetTerms (API-CONTRACT-001 §4); GetAllNamespaces (§7); SearchTerms (§6)
**RBAC Roles**: any authenticated
**Screen Type**: list
**Required Data**: Vocabulary namespaces and their terms with FR/EN labels; deprecated flag per term value; associated colors for reporting breakdowns
**Reusable Components**: ScreenContainer (default variant), DataTable (columns: Namespace, Term Key, Label FR, Label EN, Values Count, Deprecated), StatusIndicator (deprecation status — visual difference between active and deprecated values), EmptyState (no terms in namespace)

**Description**: Read-only browsing view of vocabulary terms organized by namespace. Used primarily to understand available categories for transaction categorization, form select options, and reporting breakdowns. Admins can also navigate to SCR-VOC-002 (NamespaceManage) for adding/deprecating values. TRANSLATION-002 guarantees minimum FR+EN coverage for every term.

---

### SCR-VOC-002: NamespaceManage

**Source Aggregate**: VocabularyAggregate (DOC-012, Aggregate 8)
**Primary Operations**: AddTermValue (API-CONTRACT-001 §1); DeprecateTermValue (§2)
**RBAC Roles**: admin
**Screen Type**: settings
**Required Data**: Existing terms and values within a selected namespace; deprecated values still listed but visually distinguished
**Reusable Components**: ScreenContainer (default variant with "Add Term Value" button), CRUDForm (term value entry: key [stable, immutable], label_fr, label_en, color hex [validated per CFG-003]), StatusIndicator (deprecation warning on deprecated values), ConfirmationDialog (deprecate value — irreversible per VOC-001 invariant), ToastNotification (value added / deprecated)

**Description**: Admin interface for managing vocabulary terms and values within namespaces. Values are never deleted — only deprecated (VOC-001: deprecation is irreversible). Adding a value requires both FR and EN labels (TRANSLATION-002). Keys are stable forever and cannot be changed (STABLE-003).

---

## SECTION 11: REPORTING AGGREGATE SCREENS

### SCR-RPT-001: ReportDashboard

**Source Aggregate**: ReportingAggregate (DOC-012, Aggregate 9)
**Primary Operations**: GenerateReport (API-CONTRACT-001 §1); CalculateBalance (§2); GetReportTypes (query)
**RBAC Roles**: admin, treasurer
**Screen Type**: dashboard
**Required Data**: Report type definitions (GetReportTypes); balance totals (CalculateBalance over a selectable period); category breakdown from approved transactions only (SYNCED-001)
**Reusable Components**: ScreenContainer (default variant), DataTable (report results with income/expense/net result rows grouped by category), StatusIndicator (sync status of underlying data), EmptyState (no report data available for selected period), ToastNotification (generation progress)

**Description**: Financial reporting dashboard. Users select a report type (balance sheet, monthly income statement, annual summary), a period (month/quarter/year/custom), and a scope (org/group/all). BAL-001 invariant ensures balance integrity (Actif = Passif + Resultat). Only synced/approved transactions participate in calculations (SYNCED-001). MONTH-001 ensures monthly reports cover full calendar months.

---

### SCR-RPT-002: ReportSnapshot

**Source Aggregate**: ReportingAggregate (DOC-012, Aggregate 9)
**Primary Operations**: ExportReport (API-CONTRACT-001 §3)
**RBAC Roles**: admin, treasurer
**Screen Type**: detail
**Required Data**: Previously generated report data; export format options (pdf/csv/json)
**Reusable Components**: ScreenContainer (default variant), DataTable (full report data with category breakdown), StatusIndicator (export timestamp — EXPORT-001 invariant), ConfirmationDialog (none — export is not destructive; may use ToastNotification for download initiated)

**Description**: View and export individual report snapshots. Reports are ephemeral by default (generated on-demand, not persisted unless explicitly saved). When saved, they become subject to LifecycleAggregate archiving rules. EXPORT-001 invariant ensures exports include a timestamp and digital signature.

---

## SECTION 12: AUDIT AGGREGATE SCREENS

### SCR-AUD-001: AuditLogViewer

**Source Aggregate**: AuditAggregate (DOC-012, Aggregate 10)
**Primary Operations**: QueryAuditLogs (API-CONTRACT-001 §2); ExportAuditTrail (§3)
**RBAC Roles**: admin, auditor
**Screen Type**: list
**Required Data**: Audit log entries filtered by entity type, date range, actor user, and action type; each entry shows: timestamp, action type, entity type, entity reference, old values snapshot, new values snapshot, actor identity, IP address
**Reusable Components**: ScreenContainer (default variant), DataTable (audit entries — potentially dense data, so columns are selectively visible), StatusIndicator (action type icon/code: create/update/delete/approve/reject), EmptyState (no audit entries match filters)

**Description**: Read-only audit log viewer. AUD-001 invariant ensures audit entries are immutable and never modifiable/deletable. AUD-002 ensures both old_values and new_values are always present. RETENTION-031 enforces minimum 7-year retention. ACCESS-033 restricts access to admin/auditor roles only. This is a server-only aggregate (per DOC-017 §2.10): audit data is NOT synced to clients, so offline mode shows cached entries only (possibly none).

---

## SECTION 13: LIFECYCLE AGGREGATE SCREENS

### SCR-LIF-001: ArchiveBrowser

**Source Aggregate**: LifecycleAggregate (DOC-012, Aggregate 11)
**Primary Operations**: ListArchiveEntries (API-CONTRACT-001 §query1); SearchArchives (§query2); ArchiveResource (§1); TrashResource (§2); ApplyTags (§tag)
**RBAC Roles**: admin
**Screen Type**: list
**Required Data**: Archive entries filtered by type, tag, state; each entry shows: resource type (transaction/member/event), original resource reference, archive date, lifecycle state (archived/trashed), purge date (if scheduled), tags
**Reusable Components**: ScreenContainer (default variant), DataTable (archive entries), StatusIndicator (lifecycle state — archived=blue, trashed=amber, purged=gray [excluded from normal view per LIF-006]), EmptyState (no archives), ConfirmationDialog (trash resource, apply tags)

**Description**: Browse and manage archive entries. Archives are entries created when resources are archived via the LifecycleAggregate. Trashed entries are excluded from normal queries (LIF-006: trashed not visible in normal queries) but appear when specifically querying the trash state. Purged entries are permanently removed and invisible. The ArchiveDetailView (SCR-CRD-002, cross-aggregate) can be accessed from this screen to view the original resource alongside its archive entry.

---

### SCR-LIF-002: PurgeScheduler

**Source Aggregate**: LifecycleAggregate (DOC-012, Aggregate 11)
**Primary Operations**: SchedulePurge (§schedule); RestoreFromTrash (§restore); PurgeResource (§purge, system-only)
**RBAC Roles**: admin
**Screen Type**: settings
**Required Data**: Archive entries eligible for purging (trashed entries whose purge_date has been reached or is approaching); configured retention periods per archivable type (manifest-configured per LIF-001)
**Reusable Components**: ScreenContainer (default variant), DataTable (entries scheduled for purge), StatusIndicator (urgency — green: far from purge date, amber: approaching, red: past date), ConfirmationDialog (restore from trash — reversible; purge itself is system-only, not user-triggerable from UI)

**Description**: Scheduling interface for purge operations. Admins set future purge dates for trashed archive entries (SchedulePurge). PurgeResource itself is SYSTEM-ONLY (never user-callable per API-CONTRACT-004 authorization mapping) — it runs on a cron scheduler. The screen exists to configure WHEN purges happen, not to trigger them manually. LIF-003 invariant ensures purge is irreversible once executed.

---

## SECTION 14: CONFIGURATION AGGREGATE SCREENS

### SCR-CFG-001: SettingsConfig

**Source Aggregate**: ConfigurationAggregate (DOC-012, Aggregate 12)
**Primary Operations**: GetAllSettings (API-CONTRACT-001 §4); GetSetting (§3)
**RBAC Roles**: admin
**Screen Type**: settings (read-only overview)
**Required Data**: All current setting key-value pairs for the organization; default fallback values (CFG-004)
**Reusable Components**: ScreenContainer (default variant), DataTable (settings key, current value, default value, last updated), StatusIndicator (sync status of settings), EmptyState (no settings configured — fallback to defaults)

**Description**: Overview of all organization configuration settings. Read-only view showing current values alongside their defaults. Editing individual settings navigates to SCR-CFG-002 (SettingManage). CFG-001 (currency ISO 4217), CFG-002 (timezone IANA), CFG-003 (hex color + WCAG contrast), and CFG-004 (default fallback always available) invariants govern these settings.

---

### SCR-CFG-002: SettingManage

**Source Aggregate**: ConfigurationAggregate (DOC-012, Aggregate 12)
**Primary Operations**: UpdateSetting (API-CONTRACT-001 §1); ResetToDefaults (§2)
**RBAC Roles**: admin
**Screen Type**: edit
**Required Data**: Individual setting to edit (key + current value); format validation rules per setting type
**Reusable Components**: ScreenContainer (default variant with "Reset All to Defaults" action), CRUDForm (single-setting or multi-setting edit form), StatusIndicator (validation error indicators — CFG-001/002/003 format checks), ToastNotification (update success / validation failure), ConfirmationDialog (reset all to defaults — bulk destructive action)

**Description**: Fine-grained setting management. Admins can update individual settings or reset all settings back to template defaults. Format validation runs client-side and mirrors server-side checks exactly (same principle as DUAL-008 for forms). Currency must be valid ISO 4217 (e.g., CDF, USD, EUR). Timezone must be valid IANA (e.g., Africa/Lubumbashi). Accent color must match `^#[0-9a-fA-F]{6}$` and meet WCAG contrast requirements.

---

## SECTION 15: OFFLINE SYNC AGGREGATE SCREENS

### SCR-SYNC-001: SyncStatusPanel

**Source Aggregate**: OfflineSyncAggregate (DOC-012, Aggregate 13)
**Primary Operations**: CheckConnectivity (API-CONTRACT-001 §5); GetSyncStatus (§6)
**RBAC Roles**: any authenticated
**Screen Type**: dashboard
**Required Data**: Current connectivity state (online/offline); last sync timestamp per table; pending operation count; connection state history
**Reusable Components**: ScreenContainer (compact variant — simplified header), StatusIndicator (prominent connectivity indicator: green online, gray offline), DataTable (per-table sync status: table name, last sync timestamp, row count synced, sync status), EmptyState (no sync history — first-time setup)

**Description**: System-level sync monitoring dashboard. Displays the current network connectivity state and the last synchronization timestamp for each entity type. Pending operations from all other aggregates are queued here and pushed automatically (system-owned — never user-initiated per API-CONTRACT-004). ConnectionLost and ConnectionRestored events update the indicator in real time.

---

### SCR-SYNC-002: PendingOpsViewer

**Source Aggregate**: OfflineSyncAggregate (DOC-012, Aggregate 13)
**Primary Operations**: ResolveConflict (API-CONTRACT-001 §3); MarkOperationConfirmed (§4)
**RBAC Roles**: admin
**Screen Type**: list
**Required Data**: Pending operations queue: resource type, resource ID, action (create/update/delete), payload summary, sync status (pending/sent/confirmed/failed), retry count, error message (if failed)
**Reusable Components**: ScreenContainer (default variant), DataTable (pending operations), StatusIndicator (per-operation sync status), ConfirmationDialog (manual conflict resolution), ToastNotification (conflict resolved / operation confirmed)

**Description**: Admin view of the pending operations queue. Lists all operations waiting to be pushed to the remote server. Failed operations show error details and retry counts (maximum 5 retries per SYNC-003 invariant, exponential backoff: 1000→2000→4000→8000→16000ms). Conflicts detected during pull operations are flagged here for admin resolution.

---

## SECTION 16: CROSS-AGGREGATE COORDINATION SCREENS (from ASS-004)

### SCR-CRD-001: ApprovalDetail

**Source Aggregates**: WorkflowAggregate (DOC-012, Aggregate 5) + ResourceAggregate (DOC-012, Aggregate 3)
**Primary Operations**: ApproveStep (WorkflowAggregate, API-CONTRACT-001 §2); ApproveTransaction (ResourceAggregate, §4); GetPendingApprovals (WorkflowAggregate query)
**RBAC Roles**: admin, assigned approver (for WorkflowAggregate scope); transaction:approve (for ResourceAggregate scope)
**Screen Type**: detail (cross-aggregate composite)
**Required Data**: Workflow step details (instance, step type, assignee, timeout) + referenced transaction data (reference, amount, category, current status)
**Reusable Components**: ScreenContainer (breadcrumbs from both Aggregates: Home > Workflows > Instance > Approval), DataTable (dual-panel: left shows workflow step details, right shows referenced resource data), StatusIndicator (both workflow step status AND transaction status), ConfirmationDialog (approve/reject — requires action on ResourceAggregate)

**Description**: Composite detail screen showing both the workflow approval step and the underlying resource being approved. The approve/reject action affects BOTH Aggregates simultaneously: it advances the workflow step (StepApproved event) and transitions the transaction status (ApprovalGranted event). Coordination follows ASS-004 §WorkflowAggregate → ResourceAggregate (approval flows).

---

### SCR-CRD-002: ArchiveDetailView

**Source Aggregates**: LifecycleAggregate (DOC-012, Aggregate 11) + ResourceAggregate (DOC-012, Aggregate 3)
**Primary Operations**: ArchiveResource (LifecycleAggregate, §1); ListArchiveEntries (query); SearchResources (ResourceAggregate, §10 — for original resource lookup)
**RBAC Roles**: admin
**Screen Type**: detail (cross-aggregate composite)
**Required Data**: Archive entry details (archive date, lifecycle state, purge date, tags) + original resource data (loaded by resource_type + resource_id from LifecycleAggregate's foreign reference)
**Reusable Components**: ScreenContainer (breadcrumbs: Home > Archives > Archive Entry), DataTable (left: archive metadata; right: original resource snapshot), StatusIndicator (archive lifecycle state + original resource status), ConfirmationDialog (trash from archive, restore from trash)

**Description**: Composite detail screen for archive entries, showing the archived resource alongside its archive metadata. The LifecycleAggregate stores only references (resource_type + resource_id) to the original ResourceAggregate entity (ASS-004 § LifecycleAggregate → ResourceAggregate reference validation). When viewing an ArchiveDetailView, the original resource data is lazily loaded from ResourceAggregate for display purposes only — the archive entry itself is the authoritative source for archived data.

---

## SECTION 17: COMPLETE SCREEN TABLE

| # | Screen ID | Screen Name | Aggregate(s) | Type | Primary Op Count | RBAC Scope |
|---|-----------|-------------|-------------|------|-----------------|------------|
| 1 | SCR-ORG-001 | DashboardOrg | OrganizationAggregate | dashboard | 2 queries | admin+ |
| 2 | SCR-ORG-002 | SettingsOrg | OrganizationAggregate | settings | 1 command, 1 read | admin |
| 3 | SCR-ID-001 | UserList | IdentityAggregate | list | 1 command, 1 read | admin, superadmin |
| 4 | SCR-ID-002 | UserDetail | IdentityAggregate | detail | 2 commands, 1 read | admin, superadmin |
| 5 | SCR-ID-003 | Login | IdentityAggregate | action | 1 command | public |
| 6 | SCR-ID-004 | Profile | IdentityAggregate | detail | 5 commands | self |
| 7 | SCR-RES-001 | TransactionList | ResourceAggregate | list | 2 queries | admin, treasurer, pastor, staff |
| 8 | SCR-RES-002 | TransactionDetail | ResourceAggregate | detail | 3 commands, 1 read | admin, treasurer, pastor, staff |
| 9 | SCR-RES-003 | TransactionCreate | ResourceAggregate | create | 2 commands | admin, treasurer |
| 10 | SCR-RES-004 | TransactionEdit | ResourceAggregate | edit | 2 commands | admin, creator |
| 11 | SCR-MEM-001 | MemberList | ResourceAggregate | list | 2 queries | admin, treasurer, pastor, staff |
| 12 | SCR-MEM-002 | MemberDetail | ResourceAggregate | detail | 3 commands, 1 read | admin, treasurer, pastor, staff |
| 13 | SCR-MEM-003 | MemberCreate | ResourceAggregate | create | 1 command | admin |
| 14 | SCR-EVT-001 | EventList | ResourceAggregate | list | 2 queries | admin, treasurer, pastor, staff |
| 15 | SCR-EVT-002 | EventDetail | ResourceAggregate | detail | 3 commands, 1 read | admin, treasurer, pastor, staff |
| 16 | SCR-EVT-003 | EventCreate | ResourceAggregate | create | 1 command | admin |
| 17 | SCR-REL-001 | GroupMembershipList | RelationshipAggregate | list | 4 ops | admin, treasurer, pastor, staff |
| 18 | SCR-REL-002 | OrgHierarchy | RelationshipAggregate | tree | 3 ops | admin |
| 19 | SCR-WF-001 | WorkflowQueue | WorkflowAggregate | list | 5 ops | admin, assigned approver |
| 20 | SCR-WF-002 | WorkflowInstance | WorkflowAggregate | detail | 3 commands, 1 read | admin, assigned approver |
| 21 | SCR-FRM-001 | FormBuilder | FormAggregate | settings | 1 command, 3 queries | admin |
| 22 | SCR-FRM-002 | FormPreview | FormAggregate | detail | 2 queries | any authenticated |
| 23 | SCR-NOT-001 | Inbox | NotificationAggregate | list | 1 command, 1 read | self |
| 24 | SCR-NOT-002 | NotificationPreferences | NotificationAggregate | settings | 3 commands, 1 read | self, admin |
| 25 | SCR-VOC-001 | CategoryList | VocabularyAggregate | list | 3 queries | any authenticated |
| 26 | SCR-VOC-002 | NamespaceManage | VocabularyAggregate | settings | 2 commands, 1 read | admin |
| 27 | SCR-RPT-001 | ReportDashboard | ReportingAggregate | dashboard | 2 commands, 1 query | admin, treasurer |
| 28 | SCR-RPT-002 | ReportSnapshot | ReportingAggregate | detail | 1 command, 1 read | admin, treasurer |
| 29 | SCR-AUD-001 | AuditLogViewer | AuditAggregate | list | 1 command, 2 queries | admin, auditor |
| 30 | SCR-LIF-001 | ArchiveBrowser | LifecycleAggregate | list | 3 commands, 2 queries | admin |
| 31 | SCR-LIF-002 | PurgeScheduler | LifecycleAggregate | settings | 3 commands | admin |
| 32 | SCR-CFG-001 | SettingsConfig | ConfigurationAggregate | settings | 1 query | admin |
| 33 | SCR-CFG-002 | SettingManage | ConfigurationAggregate | edit | 2 commands, 1 read | admin |
| 34 | SCR-SYNC-001 | SyncStatusPanel | OfflineSyncAggregate | dashboard | 2 queries | any authenticated |
| 35 | SCR-SYNC-002 | PendingOpsViewer | OfflineSyncAggregate | list | 2 commands, 1 query | admin |
| 36 | SCR-CRD-001 | ApprovalDetail | WorkflowAggregate + ResourceAggregate | detail | 2 commands | admin, assigned approver |
| 37 | SCR-CRD-002 | ArchiveDetailView | LifecycleAggregate + ResourceAggregate | detail | 2 commands, 2 queries | admin |

**Total: 37 canonical screens across 13 Aggregates plus 2 cross-aggregate screens.**

No additional screens exist in Lumina v1 beyond those listed above. Every screen maps to at least one operation from API-CONTRACT-001. Every screen is reachable through the Navigation Model defined in UI-SPEC-002.

---

*End of UI-SPEC-003 — Screen Registry*
*Document ID: UI-SPEC-003 | Version: v1.0 | Compliance Status: COMPLIANT*
