/**
 * FieldDef Value Object
 *
 * Represents the definition of a single form field: its name, bilingual labels,
 * type enum, validation rules, and vocabulary reference.
 *
 * @traceability DOC-012 Aggregate6 §VO-FieldDef → POSTGRESQL-SCHEMA-PACK-v1 form_fields
 *   → BR-FRM-001 (select/multiselect MUST reference Vocabulary)
 */

export const VALID_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'multiselect',
  'file_upload',
  'signature',
  'textarea',
] as const;

export type FieldType = typeof VALID_FIELD_TYPES[number];

export class InvalidFieldTypeError extends Error {
  constructor(value: string) {
    super(`Invalid field type: "${value}". Must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
    this.name = 'InvalidFieldTypeError';
  }
}

export function assertValidFieldType(value: string): FieldType {
  if (!VALID_FIELD_TYPES.includes(value as FieldType)) {
    throw new InvalidFieldTypeError(value);
  }
  return value as FieldType;
}

export interface FieldDefProps {
  readonly name: string;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly type: FieldType;
  readonly required?: boolean;
  readonly pattern?: string;
  readonly min?: number | null;
  readonly max?: number | null;
  readonly defaultValue?: string | null;
  readonly sourceVocabulary?: string | null;
  readonly visibleIf?: string | null;
}

export class InvalidFieldDefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFieldDefError';
  }
}

/**
 * Validates BR-FRM-001: select/multiselect fields must reference vocabulary.
 */
export function validateFieldDef(props: FieldDefProps): void {
  if (!props.name || typeof props.name !== 'string' || props.name.trim().length === 0) {
    throw new InvalidFieldDefError('Field name must be a non-empty string.');
  }

  if (props.name.length > 255) {
    throw new InvalidFieldDefError('Field name must not exceed 255 characters.');
  }

  if (!props.labelFr || props.labelFr.trim().length === 0) {
    throw new InvalidFieldDefError('Field label_fr must be non-empty.');
  }

  if (!props.labelEn || props.labelEn.trim().length === 0) {
    throw new InvalidFieldDefError('Field label_en must be non-empty.');
  }

  if (props.labelFr.length > 255 || props.labelEn.length > 255) {
    throw new InvalidFieldDefError('Labels must not exceed 255 characters.');
  }

  assertValidFieldType(props.type);

  // BR-FRM-001: select/multiselect fields MUST reference Vocabulary
  if ((props.type === 'select' || props.type === 'multiselect') && !props.sourceVocabulary) {
    throw new InvalidFieldDefError(
      `BR-FRM-001: Field "${props.name}" of type "${props.type}" must reference a vocabulary via sourceVocabulary.`,
    );
  }

  // Validate pattern if provided
  if (props.pattern && typeof props.pattern === 'string') {
    try {
      // eslint-disable-next-line no-new
      new RegExp(props.pattern);
    } catch {
      throw new InvalidFieldDefError(
        `BR-FRM-002: Field "${props.name}" has an invalid regex pattern: "${props.pattern}".`,
      );
    }
  }

  // min/max must be positive integers
  if (props.min !== undefined && props.min !== null && props.min < 0) {
    throw new InvalidFieldDefError(
      `BR-FRM-002: Field "${props.name}" min must be >= 0.`,
    );
  }

  if (props.max !== undefined && props.max !== null && props.max < 0) {
    throw new InvalidFieldDefError(
      `BR-FRM-002: Field "${props.name}" max must be >= 0.`,
    );
  }

  // visible_if must be a valid expression string
  if (props.visibleIf && typeof props.visibleIf !== 'string') {
    throw new InvalidFieldDefError(
      `Field "${props.name}" visibleIf must be a string expression.`,
    );
  }
}

export class FieldDef {
  private readonly _props: Required<FieldDefProps>;

  constructor(props: FieldDefProps) {
    validateFieldDef(props);
    this._props = {
      ...props,
      required: props.required ?? false,
      pattern: props.pattern ?? null,
      min: props.min ?? null,
      max: props.max ?? null,
      defaultValue: props.defaultValue ?? null,
      sourceVocabulary: props.sourceVocabulary ?? null,
      visibleIf: props.visibleIf ?? null,
    };
  }

  get name(): string { return this._props.name; }
  get labelFr(): string { return this._props.labelFr; }
  get labelEn(): string { return this._props.labelEn; }
  get type(): FieldType { return this._props.type; }
  get required(): boolean { return this._props.required; }
  get pattern(): string | null { return this._props.pattern; }
  get min(): number | null { return this._props.min; }
  get max(): number | null { return this._props.max; }
  get defaultValue(): string | null { return this._props.defaultValue; }
  get sourceVocabulary(): string | null { return this._props.sourceVocabulary; }
  get visibleIf(): string | null { return this._props.visibleIf; }

  /** Determine if this field should render for the current language. */
  getLabel(lang: 'fr' | 'en'): string {
    return lang === 'fr' ? this._props.labelFr : this._props.labelEn;
  }

  equals(other: FieldDef): boolean {
    return this._props.name === other._props.name &&
           this._props.type === other._props.type;
  }
}
