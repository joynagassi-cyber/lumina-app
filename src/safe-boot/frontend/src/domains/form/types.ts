/**
 * Form Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 6 (FormAggregate)
 * @traceability DOC-006: Form concept
 * @traceability DOC-021: Physical Data Model form tables
 * @traceability ASS-001: Application Services for form operations
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Form field type.
 */
export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'date' | 'datetime' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'file';

/**
 * Form validation rule.
 */
export type ValidationRule = 'required' | 'min_length' | 'max_length' | 'email' | 'pattern' | 'min_value' | 'max_value';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * FormAggregate form definition.
 * Maps to physical table `forms` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface FormDefinition {
  /** Universally unique identifier for this form definition. */
  readonly id: string;

  /** Organization this form belongs to. */
  readonly organizationId: string;

  /** Form title. */
  readonly title: string;

  /** Form description. */
  readonly description: string;

  /** Unique form code/key. */
  readonly code: string;

  /** Version of the form schema. */
  readonly version: number;

  /** Whether this form is active/visible. */
  readonly isActive: boolean;

  /** Creator user ID. */
  readonly createdBy: string;

  /** Version for optimistic locking. */
  readonly versionNumber: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;

  /** Form fields definition. */
  readonly fields: ReadonlyArray<FormField>;
}

/**
 * Individual form field.
 */
export interface FormField {
  /** Field identifier (unique within form). */
  readonly name: string;

  /** Field label/display name. */
  readonly label: string;

  /** Field type. */
  readonly type: FieldType;

  /** Whether the field is required. */
  readonly required: boolean;

  /** Field placeholder text. */
  readonly placeholder?: string;

  /** Field default value. */
  readonly defaultValue?: unknown;

  /** Options for select/multiselect/radio fields. */
  readonly options?: Array<{ readonly value: unknown; readonly label: string }>;

  /** Validation rules. */
  readonly validation?: Record<ValidationRule, unknown>;

  /** Order in which the field appears. */
  readonly order: number;

  /** Whether the field is hidden. */
  readonly hidden?: boolean;
}

/**
 * Form submission record.
 */
export interface FormSubmission {
  /** Universally unique identifier for this submission. */
  readonly id: string;

  /** Form definition ID this submission belongs to. */
  readonly formDefinitionId: string;

  /** Organization this submission belongs to. */
  readonly organizationId: string;

  /** Member/user who submitted the form. */
  readonly submittedBy: string;

  /** Submission data (field name → value). */
  readonly data: Record<string, unknown>;

  /** Submission status. */
  readonly status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;

  /** Metadata attached to the submission. */
  readonly metadata: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for CreateForm command.
 */
export interface CreateFormInput {
  /** Organization ID (injected from context). */
  readonly organizationId: string;

  /** Form title (required). */
  readonly title: string;

  /** Form description (optional). */
  readonly description?: string;

  /** Form code (auto-generated if not provided). */
  readonly code?: string;

  /** Form fields array (required). */
  readonly fields: Array<Omit<FormField, 'order'>>;

  /** Whether the form is initially active (default: true). */
  readonly isActive?: boolean;
}

/**
 * Input for UpdateForm command.
 */
export interface UpdateFormInput {
  /** Form ID to update. */
  readonly formId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Form title (optional update). */
  readonly title?: string;

  /** Form description (optional update). */
  readonly description?: string;

  /** Form fields (optional update). */
  readonly fields?: Array<Omit<FormField, 'order'>>;

  /** Active state (optional update). */
  readonly isActive?: boolean;
}

/**
 * Input for SubmitForm command.
 */
export interface SubmitFormInput {
  /** Form ID to submit against. */
  readonly formId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Submission data (field name → value). */
  readonly data: Record<string, unknown>;

  /** Member/user submitting the form. */
  readonly submittedBy: string;
}

/**
 * Input for ListForms query.
 */
export interface ListFormsInput {
  /** Organization ID. */
  readonly organizationId: string;

  /** Filter by status (optional). */
  readonly status?: 'active' | 'inactive';

  /** Pagination: page number (default: 1). */
  readonly page?: number;

  /** Pagination: items per page (default: 20, max: 100). */
  readonly limit?: number;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Generic pagination response.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly hasNextPage: boolean;
}

/**
 * Aggregated structure returned by useForms().
 */
export interface FormDomainModel {
  /** List of form definitions. */
  readonly forms: ReadonlyArray<FormDefinition>;

  /** Total count matching filters. */
  readonly totalCount: number;

  /** Currently selected form (if any). */
  readonly selectedForm: FormDefinition | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 * Aggregated structure returned by useFormDefinition().
 */
export interface FormDefinitionDomainModel {
  /** The form definition. */
  readonly form: FormDefinition | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 * Aggregated structure returned by useFormSubmission().
 */
export interface SubmissionDomainModel {
  /** The submission record. */
  readonly submission: FormSubmission | null;

  /** Submission data resolved with field labels. */
  readonly dataResolved: Record<string, string>;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/*  WatermelonDB Attributes                                            */
/* ------------------------------------------------------------------ */

/**
 * Attributes for the Form WatermelonDB model.
 */
export interface FormAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  title: string;
  description: string | null;
  code: string;
  version: number;
  isActive: boolean;
  createdBy: string;
  versionNumber: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
  fields: string; // JSON serialized
}

/**
 * Attributes for the FormSubmission WatermelonDB model.
 */
export interface SubmissionAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  formDefinitionId: string;
  submittedBy: string;
  data: string; // JSON serialized
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: string; // JSON serialized
}