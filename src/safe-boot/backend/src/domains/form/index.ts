/**
 * Form Domain — Barrel Export (ITS-V1)
 *
 * Re-exports all public APIs for the FormAggregate.
 * Consumers should import from this file, never from internal paths.
 *
 * @traceability DOC-012 Aggregate6 §FormAggregate
 *   → POSTGRESQL-SCHEMA-PACK-v1 tables: forms, form_sections, form_fields
 */

// ---- Ports ----
export type {
  IFormRepository,
  FindFormDefinitionByIdResult,
  FormSectionRow,
  FormFieldRow,
} from './ports/form.port';
export type { DomainEvent as FormDomainEvent, IEventPublicationPort } from './ports/event-pub.port';

// ---- Entities ----
export { FormDefinition, PublishedFormModificationError } from './domain/entities/form-definition.entity';
export { FormField } from './domain/entities/form-field.entity';
export type { FormValidationResult } from './domain/entities/form-field.entity';

// ---- Value Objects ----
export { FormId, InvalidFormIdError } from './domain/value-objects/form-id.vo';
export { ModelRef, InvalidModelRefError } from './domain/value-objects/model-ref.vo';
export {
  FieldDef,
  VALID_FIELD_TYPES,
  assertValidFieldType,
  InvalidFieldDefError,
  InvalidFieldTypeError,
} from './domain/value-objects/field-def.vo';
export type { FieldDefProps, FieldType } from './domain/value-objects/field-def.vo';
export { SectionDef, InvalidSectionDefError } from './domain/value-objects/section-def.vo';
export type { SectionDefProps } from './domain/value-objects/section-def.vo';
export { FormVersion, InvalidFormVersionError } from './domain/value-objects/form-version.vo';

// ---- Services ----
export { FormRenderer, FormRenderingError } from './domain/services/form-renderer.service';
export type { ComponentNode, RenderedSection, RenderedForm } from './domain/services/form-renderer.service';
export type { ValidationResult, FieldError } from './domain/services/form-validator.service';

// ---- Policies ----
export { NoHardcodedFormPolicy, HardcodedFormViolationError } from './domain/policies/no-hardcoded-form.policy';
export { ClientServerValidationMatchPolicy, ValidationMismatchError } from './domain/policies/client-server-validation-match.policy';
export type { ValidationComparisonResult } from './domain/policies/client-server-validation-match.policy';
export { SensitiveFormLockPolicy, FormLockedError } from './domain/policies/sensitive-form-lock.policy';
export { VisibilityPolicy, TenantIsolationError } from './domain/policies/visibility-policy';

// ---- Events ----
export {
  FormSubmitted,
  FormValidationFailed,
  FormSubmittedForApproval,
  FormDefinitionCreated,
  FormPublished,
} from './domain/events';

// ---- Application ----
export {
  FormService,
  FormNotFoundError,
  FormDuplicateKeyError,
  FormVersionConflictError,
} from './application/form.service';
export type {
  CreateFormInput,
  SubmitFormDataInput,
  FormProfileDto,
  FormValidationOutput,
} from './application/form.service';

// ---- Module ----
export { FormModule } from './form.module';
