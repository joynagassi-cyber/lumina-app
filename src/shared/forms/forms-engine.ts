/**
 * Forms Engine — core (framework-agnostic). Generates form behavior from JSON
 * definitions declared in the Org Manifest.
 *
 * Canonical source: INV-009 (a form is JSON → UI, never hardcoded JSX).
 * Field types, validation rules and labels come from FormDefinitionRef; the
 * React Native rendering lives in ./react (thin, driven by this engine).
 */
import type { FormDefinitionRef, FormFieldDef } from '../manifest/types';
import type { VocabularyEngine } from '../vocabulary/vocabulary-engine';

export interface ValidationMessages {
  required?: string;
  min?: string;
  max?: string;
  pattern?: string;
  number?: string;
  date?: string;
}

export const DEFAULT_MESSAGES: Required<ValidationMessages> = {
  required: 'Champ requis',
  min: 'Valeur minimale non atteinte',
  max: 'Valeur maximale dépassée',
  pattern: 'Format invalide',
  number: 'Valeur numérique requise',
  date: 'Date invalide (format ISO attendu)',
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

export class FormModel {
  readonly form: FormDefinitionRef;
  readonly messages: Required<ValidationMessages>;

  constructor(form: FormDefinitionRef, messages?: ValidationMessages) {
    this.form = form;
    this.messages = { ...DEFAULT_MESSAGES, ...messages };
  }

  field(key: string): FormFieldDef | undefined {
    return this.form.fields.find((f) => f.key === key);
  }

  /** Typed default value for one field (no validation at this stage). */
  defaultValue(field: FormFieldDef): unknown {
    switch (field.type) {
      case 'boolean':
        return false;
      case 'number':
      case 'currency':
        return field.min !== undefined ? field.min : 0;
      case 'multiselect':
        return [];
      default:
        return '';
    }
  }

  /** Default values record for the whole form. */
  defaultValues(): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of this.form.fields) {
      values[field.key] = this.defaultValue(field);
    }
    return values;
  }

  /** Coerce a raw input value into the field's expected type. */
  coerce(field: FormFieldDef, raw: unknown): unknown {
    switch (field.type) {
      case 'number':
      case 'currency': {
        if (raw === undefined || raw === null || raw === '') return undefined;
        // Accepte '12 500' (espace milliers) et '12,5' (virgule décimale FR)
        const cleaned = String(raw).trim().replace(/\s/g, '').replace(',', '.');
        const n = typeof raw === 'number' ? raw : Number(cleaned);
        return Number.isNaN(n) ? undefined : n;
      }
      case 'boolean':
        return raw === true || raw === 'true' || raw === 1 || raw === '1';
      case 'multiselect':
        return Array.isArray(raw) ? raw : [];
      case 'date':
        return typeof raw === 'string' ? raw : '';
      default:
        return raw === undefined || raw === null ? '' : String(raw);
    }
  }

  /** Validate one field value. Returns an error message or null when valid. */
  validateField(field: FormFieldDef, value: unknown): string | null {
    const v = this.coerce(field, value);
    if (field.required && isEmpty(v)) return this.messages.required;
    if (isEmpty(v)) return null;

    switch (field.type) {
      case 'number':
      case 'currency': {
        const n = typeof v === 'number' ? v : Number(v);
        if (Number.isNaN(n)) return this.messages.number;
        if (field.min !== undefined && n < field.min) return this.messages.min;
        if (field.max !== undefined && n > field.max) return this.messages.max;
        return null;
      }
      case 'date': {
        if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return this.messages.date;
        return null;
      }
      case 'text': {
        const s = String(v);
        if (field.max !== undefined && s.length > field.max) return this.messages.max;
        if (field.validationPattern && !new RegExp(field.validationPattern).test(s)) {
          return this.messages.pattern;
        }
        return null;
      }
      default:
        return null;
    }
  }

  /** Validate all values. Returns fieldKey → error message (empty when valid). */
  validate(values: Record<string, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of this.form.fields) {
      const error = this.validateField(field, values[field.key]);
      if (error) errors[field.key] = error;
    }
    return errors;
  }

  isValid(values: Record<string, unknown>): boolean {
    return Object.keys(this.validate(values)).length === 0;
  }

  /** All values coerced to their declared types (for submission). */
  normalize(values: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of this.form.fields) {
      if (values[field.key] !== undefined) out[field.key] = this.coerce(field, values[field.key]);
    }
    return out;
  }

  /** Select options from a vocabulary namespace (field.optionsVocab). */
  selectOptions(field: FormFieldDef, vocab: VocabularyEngine, locale?: string): { key: string; label: string }[] {
    if (!field.optionsVocab) return [];
    return vocab.labels(field.optionsVocab, locale);
  }
}
