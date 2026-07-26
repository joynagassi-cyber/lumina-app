/**
 * Form Field Entity
 *
 * Represents a single field within a form section. Contains all metadata
 * needed for rendering and validation at both client and server side.
 *
 * @traceability DOC-012 Aggregate6 §Entity-FormField
 *   → POSTGRESQL-SCHEMA-PACK-v1 form_fields (id, section_id, nom_champ, label_fr/en, type_champ, requier, ...)
 */

import { FieldDef } from '../value-objects/field-def.vo';

export interface FormFieldProps {
  readonly id: string;               // uuid PK
  readonly sectionId: string;        // FK form_sections
  readonly orgId: string;            // Multi-tenant isolation
  readonly def: FieldDef;
  readonly createdAt: Date;
  updatedAt: Date;
}

export class FormField {
  private _props: FormFieldProps;

  constructor(props: FormFieldProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get sectionId(): string { return this._props.sectionId; }
  get orgId(): string { return this._props.orgId; }
  get definition(): FieldDef { return this._props.def; }
  get name(): string { return this._props.def.name; }
  get labelFr(): string { return this._props.def.labelFr; }
  get labelEn(): string { return this._props.def.labelEn; }
  get fieldType(): string { return this._props.def.type; }
  get required(): boolean { return this._props.def.required; }
  get pattern(): string | null { return this._props.def.pattern; }
  get minLength(): number | null { return this._props.def.min; }
  get maxLength(): number | null { return this._props.def.max; }
  get defaultValue(): string | null { return this._props.def.defaultValue; }
  get sourceVocabulary(): string | null { return this._props.def.sourceVocabulary; }
  get visibleIf(): string | null { return this._props.def.visibleIf; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._props.updatedAt; }
  set updatedAt(v: Date) { this._props.updatedAt = v; }

  /**
   * Validate the given input value against this field's rules.
   * Client-side and server-side validation must produce identical results (BR-FRM-002).
   */
  validateInput(value: unknown): FormValidationResult {
    return FormField.validateFieldValue(this._props.def, value);
  }

  static validateFieldValue(
    fieldDef: FieldDef,
    value: unknown,
  ): FormValidationResult {
    if (fieldDef.required && (value === undefined || value === null || value === '')) {
      return { valid: false, errors: [{ field: fieldDef.name, message: `${fieldDef.labelFr} is required.` }], value: null };
    }

    if (value === undefined || value === null || value === '') {
      return { valid: true, errors: [], value: fieldDef.defaultValue ?? null };
    }

    switch (fieldDef.type) {
      case 'text':
      case 'textarea':
        return FormField._validateText(fieldDef, String(value));
      case 'number':
        return FormField._validateNumber(fieldDef, value);
      case 'date':
        return FormField._validateDate(fieldDef, String(value));
      case 'select':
        return FormField._validateSelect(fieldDef, String(value));
      case 'multiselect':
        return FormField._validateMultiselect(fieldDef, value);
      case 'file_upload':
      case 'signature':
        return { valid: true, errors: [], value };
      default:
        return { valid: true, errors: [], value };
    }
  }

  private static _validateText(
    fieldDef: FieldDef,
    val: string,
  ): FormValidationResult {
    const errors: Array<{ field: string; message: string }> = [];

    if (fieldDef.pattern && !new RegExp(fieldDef.pattern).test(val)) {
      errors.push({ field: fieldDef.name, message: `Value does not match pattern ${fieldDef.pattern}.` });
    }

    if (fieldDef.min !== null && val.length < fieldDef.min) {
      errors.push({ field: fieldDef.name, message: `Minimum length is ${fieldDef.min}.` });
    }

    if (fieldDef.max !== null && val.length > fieldDef.max) {
      errors.push({ field: fieldDef.name, message: `Maximum length is ${fieldDef.max}.` });
    }

    return { valid: errors.length === 0, errors, value: val };
  }

  private static _validateNumber(
    fieldDef: FieldDef,
    val: unknown,
  ): FormValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const num = Number(val);

    if (isNaN(num)) {
      errors.push({ field: fieldDef.name, message: 'Must be a valid number.' });
      return { valid: false, errors, value: null };
    }

    if (fieldDef.min !== null && num < fieldDef.min) {
      errors.push({ field: fieldDef.name, message: `Minimum value is ${fieldDef.min}.` });
    }

    if (fieldDef.max !== null && num > fieldDef.max) {
      errors.push({ field: fieldDef.name, message: `Maximum value is ${fieldDef.max}.` });
    }

    return { valid: errors.length === 0, errors, value: num };
  }

  private static _validateDate(
    _fieldDef: FieldDef,
    val: string,
  ): FormValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const parsed = new Date(val);
    if (isNaN(parsed.getTime())) {
      errors.push({ field: _fieldDef.name, message: 'Must be a valid date.' });
    }
    return { valid: errors.length === 0, errors, value: val };
  }

  private static _validateSelect(
    fieldDef: FieldDef,
    val: string,
  ): FormValidationResult {
    // Select values are validated against vocabulary at persistence layer
    // Domain layer just ensures it is a non-empty string
    const errors: Array<{ field: string; message: string }> = [];
    if (!val) {
      errors.push({ field: fieldDef.name, message: 'Selection required.' });
    }
    return { valid: errors.length === 0, errors, value: val };
  }

  private static _validateMultiselect(
    fieldDef: FieldDef,
    val: unknown,
  ): FormValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    if (!Array.isArray(val)) {
      errors.push({ field: fieldDef.name, message: 'Must be an array.' });
      return { valid: false, errors, value: null };
    }
    for (let i = 0; i < val.length; i++) {
      if (typeof val[i] !== 'string') {
        errors.push({ field: fieldDef.name, message: `Item at index ${i} must be a string.` });
      }
    }
    return { valid: errors.length === 0, errors, value: val };
  }
}

export interface FormValidationResult {
  readonly valid: boolean;
  readonly errors: Array<{ field: string; message: string }>;
  readonly value: unknown;
}
