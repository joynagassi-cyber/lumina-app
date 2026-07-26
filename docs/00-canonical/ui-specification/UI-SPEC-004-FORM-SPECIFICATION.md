# Form Specification — Lumina v1

**Doc ID:** UI-SPEC-004
**Version:** v1.0
**Statut:** SPECIFICATION UI DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "ASS-001", "DOC-017", "CONSTRAINTS-INDEX-SPECIFICATION-v1.md"]
**Transformation_rule :** "ui-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPLE

This document defines the **canonical form specification** for all user-facing data entry forms in Lumina. It describes how forms are generated, rendered, validated, and composed from the FormAggregate's FormDefinition — NEVER hardcoded into presentation code. Every form field maps to a `form_fields` row defined in DOC-021, and every validation rule derives from CHECK constraints documented in CONSTRAINTS-INDEX-SPECIFICATION-v1.md.

This is a PRESENTATION SPECIFICATION. It does not prescribe implementation technology (no React, no HTML, no CSS). It defines the behavioral contract that ANY presentation framework must satisfy when rendering Lumina forms.

---

## SECTION 1: FORM GENERATION PRINCIPLES

### Principle 1: Forms Are Always Rendered from FormDefinitions

Every form in Lumina — whether creating a transaction, updating a user profile, editing an organization setting, or managing notification preferences — is rendered exclusively from a FormDefinition stored in the FormAggregate. The form definition is a structured document containing:

- `id`: Unique identifier for the form definition
- `model_ref`: References the Domain Entity type this form targets (e.g., "TransactionRecord", "MemberRecord")
- `version`: Semantic version string (e.g., "1.0", "2.1")
- `sections[]`: Ordered array of form sections, each with `definition_id`, `title_fr`, `title_en`, and ordered list of field references
- `fields[]`: Array of FormField definitions, each specifying name, label, type, required status, options, pattern, min/max bounds, default value, and `visible_if` condition

The rendering pipeline is:

```
User navigates to a create/edit screen
    ↓
Screen requests FormDefinition via FormService.LoadFormDefinition(formId, version)
    ↓
FormAggregate returns the FormDefinition with its sections, fields, and rules
    ↓
For each section: render a panel/tab with the section title (from vocab fr/en)
    ↓
For each field in the section (ordered by field.order within section):
    1. Evaluate visible_if condition against current form context
    2. If visible: render the appropriate input block based on field.type
    3. Load label from field.label_fr / field.label_en (active language)
    4. Apply validation rules (required, pattern, min, max) from field definition
    5. For select/multiselect: resolve option values from VocabularyAggregate (VOCAB-002)
    ↓
Collect all visible fields into the final form layout
```

### Principle 2: No Hardcoded Forms

FRM-009 invariant is absolute: NO form is ever hardcoded in JSX or any equivalent presentation template. This means:

- A new entity type cannot be added to the system without first defining its FormDefinition in the FormAggregate
- Admins can re-order sections, add/remove fields, change types, and modify labels without any code deployment
- When a FormDefinition is updated (new version published), all forms using that definition automatically reflect the changes
- The previous version remains immutable and queryable (FRM-004 versioning invariant)

### Principle 3: Client and Server Validation Must Match Exactly

DUAL-008 invariant mandates that the client-side validation logic and server-side validation logic produce IDENTICAL results for every field. This means:

- The same CHECK constraint expressions from CONSTRAINTS-INDEX-SPECIFICATION-v1.md that the server uses are also sent to the client as validation rules
- If a field has `CHECK (amount > 0)` on the server, the client must also reject values where amount <= 0 with the same error message format
- The FormService.ValidateFormData(formDef, data) command exists specifically to ensure client and server validation equivalence
- If invalid, FormValidationFailed event is emitted; if valid, no event is emitted (silent success)

### Principle 4: Select Options Always Come from Vocabulary

VOCAB-002 invariant: All select and multiselect form fields source their options from the VocabularyAggregate. This ensures:

- Categories for transactions come from vocab namespaces (finance categories)
- Status options for members come from vocab (active/inactive/deceased/transferred)
- Timezone options come from vocab (IANA timezone values)
- Currency options come from vocab (ISO 4217 codes)
- Custom picklists defined by the org admin via SCR-VOC-002

Hardcoded dropdown lists are prohibited. Even internal system enums rendered as user-facing selects must have vocabulary-backed display labels.

---

## SECTION 2: FIELD TYPE MAPPING

Each `form_fields.type_champ` value maps to exactly one canonical UI input block. The following table defines the complete mapping between database field types and UI representations.

| type_champ (DB) | UI Input Block | Description | Validation | Example Fields Using This Type |
|----------------|---------------|-------------|------------|-------------------------------|
| `text` | TextInput | Single-line text input | pattern regex, min/max length from field definition | firstName, lastName, email, phone, memberNumber |
| `number` | NumberInput | Numeric input with optional step/precision | min >= 0, max bound from field definition; BIGINT cents validated as integer | amount (cents) |
| `date` | DatePicker | Date picker component (calendar UI) | date not in future (DATE-001: CHECK date <= CURRENT_DATE); date range constraints | transactionDate, eventStartDate, eventEndDate, purgeDate |
| `select` | Dropdown | Single-select dropdown (populated from vocabulary) | Value must exist in vocab_values for the referenced term; deprecation flagged | categoryRef, scopeType, unitType, currency |
| `multiselect` | MultiSelectDropdown | Multi-select dropdown (values checked from vocabulary) | All selected values must be active (non-deprecated) in vocab_values | groupMemberships (add multiple groups at once) |
| `file_upload` | FileUploader | File selection with MIME type and size validation | Max file size per org settings (CFG-001/CFG-004); virus scan acceptance; MIME type check | url_pieces_jointes (archive attachments), form file fields |
| `signature` | SignaturePad | Touch/canvas-based signature capture area | Required; non-empty area detected | Signature confirmation fields |
| `textarea` | TextArea | Multi-line text input with configurable row count | Max length from field definition | descriptions, comments, rejection reasons |

---

## SECTION 3: DETAILED FIELD TYPE BEHAVIORS

### 3.1 TextInput (type_champ = `text`)

**Structure**: Single-line text input field with an associated label and optional helper text.

**Behavior**:
- Renders a standard text entry field accepting alphanumeric characters, spaces, hyphens, underscores, and common punctuation
- Accepts any Unicode character set to support bilingual (FR/EN) names and descriptions
- On focus: label floats above the field or becomes placeholder text (depending on design system choice)
- On blur: runs immediate client-side validation (pattern check, length bounds)

**Validation**:
- Required fields show an asterisk (*) next to the label — color from ConfigurationAggregate accent_hex (CFG-003 checked against WCAG contrast)
- Pattern validation: if the field definition includes a pattern (regex), it is shown inline below the field as a hint (e.g., "Format: username@domain.tld" for email fields) and enforced on blur
- Length bounds: min_length and max_length shown as helper text ("3-200 characters") and enforced on blur

**Error State**:
- Inline error message below the field: "This field is required" or "Invalid format" — text from vocabulary (fr/en)
- Field border highlighted in error color (red — distinct from accent color)
- Screen reader announcement: field name + error message

**Accessibility**:
- Associated label element via htmlFor/id pair
- aria-describedby referencing the error message element
- Keyboard: Tab to enter, Enter to accept, Escape to clear
- Touch target minimum 44px height on mobile

**Example**: Transaction description field
```
Label: "Description" / "Description" (FR/EN)
Placeholder: "Enter a brief description..."
Pattern: optional, e.g., maxlength(500)
Required: true (NOT NULL in domain model)
Helper text: "Maximum 500 characters"
Error state: "Description is required" or "Description must not exceed 500 characters"
```

---

### 3.2 NumberInput (type_champ = `number`)

**Structure**: Numeric input field with increment/decrement controls and optional step precision.

**Behavior**:
- Renders a numeric input accepting only digits, optional decimal point, and optional sign prefix
- Supports BIGINT representation for financial amounts (cents) — no decimal places for amounts
- For non-amount numbers (dates, counts, ratings): supports the configured step value
- Min and max bounds displayed as helper text
- Negative values rejected unless explicitly permitted by field definition

**Validation**:
- Required indicator (asterisk) for NOT NULL fields
- Min/max bounds from field definition (min, max columns in form_fields)
- Integer enforcement for BIGINT fields (amount in cents) — rejects decimal input
- Pattern validation if specified (e.g., must be a multiple of 100 for cent values)

**Error State**:
- "Must be a positive number" (for amount fields with FIN-002: amount > 0)
- "Value too low — minimum is X" / "Value too high — maximum is X"
- Error text from vocabulary (fr/en)
- Field border highlighted in error color

**Accessibility**:
- aria-valuemin and aria-valuemax set to defined bounds
- aria-valuenow reflects current value
- Screen reader announces bounds on field focus
- Keyboard: Up/Down arrows to increment/decrement

**Examples**:
- Transaction amount: "Amount (in cents)" — requires positive integer, min=1, no decimal allowed (FIN-002, FIN-008)
- OrgUnit depth level: auto-calculated, read-only display (not user-editable)
- Workflow timeout days: integer 1-30 (WF-001: max 30 days)

---

### 3.3 DatePicker (type_champ = `date`)

**Structure**: Date picker component presenting a calendar grid or text entry mode for date input.

**Behavior**:
- Renders a calendar popup on focus with month/year navigation
- Accepts standard date formats parsed per org locale settings (date_format from CFG-002)
- Shows previously selected dates with visual distinction (colored dots on calendar days)
- For paired dates (start/end): selecting a start date disables past dates in the end date picker
- Keyboard accessible: arrow keys navigate day-by-day, Home/End jump to week start/end

**Validation**:
- DATE-001: Transaction/event dates cannot be in the future — `CHECK (date_transaction <= CURRENT_DATE)` is mirrored client-side as "Date cannot be in the future"
- Event date pairs: end date must be after start date (CONSTRAINTS-INDEX-SPECIFICATION-v1.md, events table: `CHECK (date_fin > date_debut)`)
- Required: fields mapped to NOT NULL columns show the required indicator
- Format enforcement: displays expected format as placeholder (e.g., "YYYY-MM-DD" or "DD/MM/YYYY" per cfg.date_format setting)

**Error State**:
- "Date cannot be in the future" / "End date must be after start date"
- "Please select a date" for empty required fields
- Error text from vocabulary

**Accessibility**:
- aria-label includes field name and format instruction
- Selected date announced by screen reader as "January 15, 2026"
- Calendar grid is fully keyboard-navigable

**Examples**:
- Transaction date: today or earlier only, required, YYYY-MM-DD or DD/MM/YYYY per org preference
- Event start date: required, before end date, no future restriction applies (events can be scheduled ahead)
- Event end date: required, after start date, no future restriction applies
- Purge date: required for SchedulePurge screen, must be after today

---

### 3.4 Dropdown (type_champ = `select`)

**Structure**: Single-selection dropdown (combobox) populated dynamically from VocabularyAggregate term values.

**Behavior**:
- On render: loads options by calling VocabularyAccessPort.getValues(termId) for the field's referenced term
- Each option displays the FR or EN label based on current language (TRANSLATION-002 guarantee: both available)
- Deprecated values appear in the list but are visually distinguished (grayed out, strikethrough text, or "deprecated" suffix) — they can still be selected for backward compatibility with existing data
- Search/filter within dropdown: typing filters options by label (FR and EN) — searchable combobox behavior
- Keyboard: up/down arrow keys cycle options, Enter selects, Escape closes

**Validation**:
- Required: dropdown cannot be empty if the underlying column is NOT NULL
- Selection must be from the loaded vocabulary values — no free-text entry
- Deprecated values: user is warned (info toast) that deprecated values should not be used for new entries
- Option list is never empty — if VocabularyAggregate returns zero values for a term, the form blocks submission with "No categories available" error

**Error State**:
- "Please select a value" for empty required dropdowns
- "Category not found" if the vocabulary reference is broken (BR-VOC-004: explicit error, not silent failure)

**Accessibility**:
- role="combobox" on the dropdown container
- aria-expanded indicates open/closed state
- aria-selected on the chosen option
- Screen reader announces: field name + selected value

**Examples**:
- Transaction category: dropdown populated from finance namespace terms in VocabularyAggregate
- Scope type: dropdown with "org" and "group" options (SCOPE-001: always defined, enum validated)
- Unit type: dropdown populated from membership namespace (church/school/ngo/company/custom)
- Currency: dropdown populated from common namespace ISO 4217 codes (CFG-001: ISO 4217 enforced)

---

### 3.5 MultiSelectDropdown (type_champ = `multiselect`)

**Structure**: Multi-selection dropdown allowing multiple vocabulary values to be selected simultaneously.

**Behavior**:
- Renders as an expandable checklist within a dropdown container
- Selected values displayed as chip-style tags below the input area (showing label + remove button)
- Same vocabulary sourcing as single select (VOCAB-002)
- Deprecated values shown but can be deselected individually
- "Select All" / "Clear All" convenience buttons
- Max selections configurable via field definition's metadata

**Validation**:
- Required: at least one value must be selected
- Minimum/maximum selection count from field metadata (e.g., "Select 1 to 5 groups")
- Individual selections validated against vocabulary (same as dropdown)

**Error State**:
- "At least one value is required" for empty required multi-selects
- "Maximum X values can be selected" when exceeding max selections

**Accessibility**:
- role="listbox" with aria-multiselectable="true"
- Each selected chip is a removable tag with its own label
- Selection count announced: "X of Y items selected"

**Examples**:
- Adding multiple groups to a member at once (GroupMembershipList bulk operations)
- Selecting multiple notification channels (in_app, push, email)

---

### 3.6 FileUploader (type_champ = `file_upload`)

**Structure**: File upload control accepting binary files with MIME type and size validation.

**Behavior**:
- Renders as a drag-and-drop zone (desktop) or "Choose File" button (mobile)
- Accepts files of types specified in field metadata (default: all common image and document types)
- Progress indicator during upload (FileStoragePort.upload called asynchronously)
- Uploaded file preview: thumbnail for images, filename and icon for documents
- Remove button to deselect/upload a different file

**Validation**:
- Max file size from ConfigurationAggregate settings (default 10MB, configurable per org)
- MIME type validation: actual content type checked, not just the provided header (FileStoragePort constraint)
- Virus scan result accepted before file is finalized (scan passes before upload completes)
- Maximum number of files configurable via field metadata
- Required: at least one file must be uploaded if field is marked required

**Error State**:
- "File size exceeds maximum of X MB"
- "Unsupported file type" with acceptable types listed
- "Virus scan failed — file rejected"
- Error text from vocabulary (fr/en)

**Accessibility**:
- Label associated with the upload control
- Upload progress announced by screen reader
- Error messages linked via aria-describedby

**Examples**:
- Archive attachment URLs (archives.url_pieces_jointes TEXT[] — stored via FileStoragePort)
- Member documentation uploads
- Event flyer/image attachments

---

### 3.7 SignaturePad (type_champ = `signature`)

**Structure**: Canvas-based signature capture area where users draw their signature using touch or mouse.

**Behavior**:
- Renders as a rectangular drawing area with a guide line ("Sign here")
- Draws in black ink by default, stroke width configurable (read from CFG-003 accent color)
- Clear button to erase and restart the signature
- Capture produces a base64-encoded SVG/PNG representation stored via FileStoragePort
- Requires explicit acknowledgment that the signature confirms the submitted data

**Validation**:
- Required: cannot submit if signature area is empty
- Empty canvas detected: no valid strokes recorded
- Signature data is stored immutably (cannot be changed after form submission)

**Error State**:
- "Signature is required to proceed"
- Warning: "Signature cannot be changed after submission"

**Accessibility**:
- Canvas has role="img" with descriptive label
- Alternative text entry option: "Type your full name instead" for users who cannot provide a signature
- Screen reader announces signature status: "Signature captured" or "Signature area empty"

**Examples**:
- Confirmation signatures on financial approvals
- Contract sign-offs for membership agreements

---

### 3.8 TextArea (type_champ = `textarea`)

**Structure**: Multi-line text input field supporting longer-form text.

**Behavior**:
- Renders as a resizable text area with configurable initial row count (default 3 rows)
- Auto-expands up to a maximum height defined in field metadata
- Character counter displayed below the field ("X / Y characters used")
- Preserves whitespace (unlike TextInput which may trim)
- Word wrapping enabled by default

**Validation**:
- Maximum length from field definition's metadata
- Required indicator for NOT NULL columns
- Min length optionally configurable
- No pattern validation typically applied to textarea fields

**Error State**:
- "This field is required" for empty required textareas
- "Maximum X characters" with the counter turning red when exceeded
- Error text from vocabulary

**Accessibility**:
- Label associated via htmlFor/id
- aria-describedby linking to character counter and error message
- Resize handled gracefully on mobile (full-screen overlay editor)

**Examples**:
- Transaction description/reason field
- Rejection reason (required when rejecting a transaction)
- Comment/note fields on workflow approval steps
- Event description

---

## SECTION 4: VALIDATION RULES

### 4.1 Validation Source

All form field validation rules derive from two sources:

| Source | What It Provides | Where Defined |
|--------|-----------------|---------------|
| **CHECK constraints** (CONSTRAINTS-INDEX-SPECIFICATION-v1.md) | Column-level constraints (NOT NULL, range checks, enum validation, pattern matching, date constraints) | Physical data model layer |
| **Domain invariants** (DOC-015) | Business-level rules that cross-column validation (e.g., end date > start date, approved transactions immutable) | Domain Model layer |

### 4.2 Constraint-to-UI Mapping

Each CHECK constraint in the physical schema maps to a specific UI validation behavior:

| CHECK Constraint | UI Validation Behavior | Screen Affected |
|-----------------|----------------------|----------------|
| `CHECK (montant > 0)` (transactions) | Amount must be positive integer; reject 0 and negatives; FIN-002 invariant | TransactionCreate, TransactionEdit |
| `CHECK (date_transaction <= CURRENT_DATE)` | Date picker blocks future dates; date input rejects future dates; DATE-001 | TransactionCreate, TransactionEdit |
| `CHECK (statut IN ('draft','pending','approved','rejected'))` | Status field is a dropdown with only these 4 options | All transaction screens |
| `CHECK (portee_type IN ('org','group'))` | Scope type dropdown limited to 'org' and 'group' | TransactionCreate, TransactionEdit |
| `CHECK (niveau_profondeur BETWEEN 1 AND 5)` | Depth level auto-calculated; manual entry restricted to 1-5 | OrgUnit screens |
| `CHECK (role_utilisateur IN (...))` | Role dropdown limited to 5 valid roles; BR-ID-005 hierarchy enforced | UserCreate, UserDetail |
| `CHECK (timeout_jours > 0 AND timeout_jours <= 30)` | Timeout input restricted to 1-30 days; WF-001 | Workflow form fields |
| `CHECK (type_champ IN (...))` | Field type dropdown restricted to 8 valid types | FormBuilder |
| `CHECK (canal IN ('in_app','push','email','sms'))` | Channel checkboxes limited to 4 valid channels | NotificationPreferences |
| `CHECK (severite IN ('info','warning','critical'))` | Severity dropdown limited to 3 valid levels | Notification screens |
| `CHECK (etat_lifecycle IN ('active','archived','trashed','purged'))` | Lifecycle state dropdown with 4 valid states | Archive screens |
| `CHECK (resource_type_original IN (...))` | Archiveable resource type limited to 4 types | ArchiveBrowser |
| `CHECK (tentative_num <= 5)` | Retry count capped at 5 | Sync screens |
| `CHECK (date_fin > date_debut)` (events) | End date must be after start date; calendar enforces this | EventCreate, EventEdit |
| `CHECK (couleur IS NULL OR couleur ~ '^#[0-9a-fA-F]{6}$')` | Color hex field validates 6-digit hex pattern; CFG-003 | NamespaceManage, SettingsOrg |
| `CHECK (statut IN ('active','suspended','archived'))` | Organization status limited to 3 states; archived irreversible | Organization screens |
| `CHECK (type_org IN ('church','school','ngo','company','custom'))` | Organization type dropdown with 5 valid values | CreateOrganization |

### 4.3 NOT NULL to Required Indicator

Every column defined as NOT NULL in the persistence model automatically renders as a required field in the corresponding form:

| Table | NOT NULL Columns | Form Field Requirement |
|-------|-----------------|----------------------|
| transactions | montant, type_transaction, statut, categorie_ref, portee_type, date_transaction | Amount, Category, Type, Scope, Date are all required |
| members | prenom, nom_famille, statut_membre, numero_membre, date_entree | First name, Last name, Status, Member number, Join date required |
| events | titre, type_evenement, date_debut, date_fin, statut | Title, Type, Start date, End date, Status required |
| users | prenom, nom_famille, adresse_email, role_utilisateur, statut | First name, Last name, Email, Role, Status required |
| organizations | nom, statut, devise_iso4217, fuseau_horaire, langue_privee, accent_hex | Name, Status, Currency, Timezone, Language, Accent required |

Fields that are nullable in the schema may still be marked required in the form definition (admin-configurable via the form_fields.requiere column).

### 4.4 Pattern Validation

Fields with pattern constraints display the pattern as inline guidance text:

| Pattern | Display Hint | Enforced On |
|---------|-------------|-------------|
| `^#[0-9a-fA-F]{6}$` (accent_hex) | "Format: #RRGGBB (e.g., #1A73E8)" | SettingsOrg, NamespaceManage |
| Email pattern (implicit) | "Format: name@domain.tld" | CreateUser, UpdateUserProfile |
| BIGINT (no decimals for amounts) | "Enter whole numbers only (amount in cents)" | TransactionCreate, TransactionEdit |

---

## SECTION 5: CONDITIONAL VISIBILITY

### 5.1 Mechanism

Fields can be conditionally shown or hidden based on the values of other fields in the same form. The visibility expression is stored in the `condition_visibilite` column of the form_fields table and evaluated at runtime.

### 5.2 Evaluation Rules

1. **Expression format**: Simple comparison expressions (field_name operator value)
   - `scope_type == 'group'` — show scope_target_group field only when scope_type equals 'group'
   - `status != 'draft'` — hide edit fields when status is not draft
   - `category contains 'expense'` — show additional expense-type fields

2. **Evaluation trigger**: The expression is re-evaluated whenever any field it references changes value

3. **Initial state**: On form load, all conditions are evaluated against the initial form data (or empty state for create forms)

4. **Persistence**: Conditional visibility state is part of the FormDefinition — it does not affect data integrity, only UI rendering

### 5.3 Common Conditional Visibility Patterns

| Pattern | Expression | Example |
|---------|-----------|---------|
| Show detail fields when a type is selected | `type == 'custom'` | Additional customization fields appear when org type is 'custom' |
| Hide compensation link for non-approved transactions | `status != 'approved'` | compensates_for field only visible when the original transaction status is 'approved' |
| Show rejection reason when rejected | `action == 'reject'` | Reason textarea appears only when the user clicks Reject |
| Show file upload only for certain archivable types | `archive_type in ['document', 'photo']` | FileUploader visible only for specific archive types |
| Show password reset fields when changing password | `password_change == true` | Password fields appear only when the toggle is activated |

### 5.4 Accessibility for Conditional Fields

When a field is hidden via conditional visibility:
- The element is completely removed from the DOM (not just CSS-hidden), so screen readers do not announce it
- When a hidden field becomes visible, focus moves to it or a nearby accessible element
- The showing/hiding is announced: "New field appeared: [field name]" via aria-live region

---

## SECTION 6: MULTI-LANGUAGE LABELS

Every form label has both French and English versions. The vocabulary resolution follows this priority order:

1. **Current user language preference** (from session, persisted in ConfigurationAggregate settings):
   - If FR selected: display `label_fr`
   - If EN selected: display `label_en`

2. **Fallback chain** (if the preferred language is missing for a term):
   - Try the user's preferred language first
   - Fall back to French (the system default)
   - Fall back to English if French is also unavailable
   - Never return an empty string (TRANSLATION-002 guarantees at minimum FR+EN coverage)

3. **Dynamic label resolution**:
   - Form section titles: resolved via `VocabularyService.ResolveLabel(namespace, section_termKey, lang)`
   - Field labels: loaded directly from `form_fields.label_fr` and `form_fields.label_en` columns
   - Button labels: resolved from common vocabulary namespace (e.g., `common.actions.save`, `common.actions.cancel`)
   - Error messages: resolved from validation vocabulary namespace

4. **Language toggle**: Visible in the ScreenContainer header (top-right corner); switching language re-renders ALL labels across the entire form without refreshing the page or losing entered data

---

## SECTION 7: FORM SECTIONS LAYOUT

### 7.1 Section Ordering

Multi-section forms use the `form_sections.definition_id` ordering to arrange panels/tabs within the CRUDForm:

1. Sections are sorted by their `ordre` (ordinal position) value within the form definition
2. On desktop, sections may be displayed as side-by-side tabs or accordion panels
3. On mobile, sections are stacked vertically with a scrollable section picker at the top

### 7.2 Section Rendering

Each section renders as:
- A labeled header (title from `section.title_fr` / `section.title_en`)
- A contained area for all fields belonging to that section
- Optional divider lines between sections for visual separation

### 7.3 Section-Level Accessibility

- Each section is a landmark region with an accessible name (the section title)
- Screen readers can navigate between sections using heading landmarks
- On mobile, section headings are sticky at the top while scrolling through fields

---

## SECTION 8: EXAMPLE FORM RENDERINGS

### Example 1: TransactionCreate Form (SCR-RES-003)

```
[ScreenContainer]
  Title: "New Transaction" / "Nouvelle transaction" (from vocabulary)
  Breadcrumbs: Home > Transactions > New
  
[CRUDForm — sourced from FormDefinition "finance_transaction_form" v1.0]
  
  [Section 1: Basic Information]
    Date (DatePicker, required)          — CHECK (date_transaction <= CURRENT_DATE)
    Amount (NumberInput, required)       — CHECK (montant > 0), BIGINT cents only
    Category (Dropdown, required)        — VOCAB-002: from vocabulary finance namespace
    Description (TextArea, optional)     — maxlength(500)
    
  [Section 2: Scope]
    Scope Type (Dropdown, required)      — CHECK (portee_type IN ('org','group'))
    Scope Target (Dropdown, required IF scope_type == 'group') — conditional: visible_if expression
    
  [Section 3: Actions]
    [Submit for Approval] (button, only visible if user has transaction:submit permission)
    [Save as Draft] (button)
    [Cancel] (button)
    
[StatusIndicator: offline — yellow dot, queued saves note]
```

### Example 2: MemberCreate Form (SCR-MEM-003)

```
[ScreenContainer]
  Title: "Add Member" / "Ajouter un membre"
  Breadcrumbs: Home > Members > Add

[CRUDForm — sourced from FormDefinition "membership_create_form" v2.1]
  
  [Section 1: Personal Information]
    First Name (TextInput, required)     — MEM-001: firstName mandatory
    Last Name (TextInput, required)      — MEM-001: lastName mandatory
    Email (TextInput, optional)          — EMAIL-001: unique within org if provided
    Phone (TextInput, optional)
    
  [Section 2: Membership Details]
    Status (Dropdown, required)          — STATUS-010: active/inactive/deceased/transferred
    Member Number (TextInput, read-only) — auto-generated, displayed but not editable
    Join Date (DatePicker, required)     — defaults to today

  [Section 3: Group Assignments]
    Groups (MultiSelectDropdown, optional) — from relationship data; deprecated groups grayed out
    
  [Section 4: Attachments]
    Documents (FileUploader, optional)   — maxSize from config; virus scan required
    Signature (SignaturePad, required)   — confirming accuracy of entered data
    
[ToastNotification: "Member created successfully" on save]
```

---

## SECTION 9: FORM ERROR HANDLING

### 9.1 Error Display Hierarchy

Errors are displayed in the following priority order:
1. **Inline field errors** (highest priority) — shown immediately below the offending field
2. **Form-level summary** (secondary) — at the top of the form, listing all invalid fields with links to jump to each error
3. **Toast notification** (tertiary) — for non-field-specific errors (e.g., "Submission failed — server unavailable")

### 9.2 Error Message Sourcing

All error messages originate from vocabulary (never hardcoded):
- Required field errors: `validation.required.{field_namespace}`
- Pattern mismatch errors: `validation.pattern.{field_type}`
- Range errors: `validation.range.min` / `validation.range.max`
- Duplicate/errors: `validation.uniqueViolation` (for EMAIL-001, etc.)
- Server-side errors (mismatched client/server validation): `validation.serverMismatch`

### 9.3 Validation Summary Behavior

On form submission failure:
1. Scroll to the top of the form automatically
2. Display a collapsible error summary banner
3. Each error in the summary is a link that scrolls to and focuses the relevant field
4. The first invalid field receives programmatic focus
5. Duplicated error messages (summary + inline) are not redundant — screen readers need both context locations

---

## SECTION 10: COMPILANCE STATEMENT

This form specification covers all 8 field types defined in form_fields.type_champ CHECK constraints (DOC-021 §6.3): text, number, date, select, multiselect, file_upload, signature, textarea.

Every field type maps to exactly one canonical UI input block. Every CHECK constraint from CONSTRAINTS-INDEX-SPECIFICATION-v1.md is represented in Section 4.2's mapping table. All validation derives from domain invariants (DOC-015) and CHECK constraints — no validation rules were invented beyond those defined in the canonical specs.

Form generation follows the FormDefinition pipeline exclusively (FRM-009: no hardcoded forms). Labels are vocabulary-driven (VOCAB-002). Client and server validation match exactly (DUAL-008). Conditional visibility uses visible_if expressions stored in the form definition.

This specification is framework-agnostic. It describes WHAT forms look like and HOW they behave — not WHAT technology renders them.

---

*End of UI-SPEC-004 — Form Specification*
*Document ID: UI-SPEC-004 | Version: v1.0 | Compliance Status: COMPLIANT*
