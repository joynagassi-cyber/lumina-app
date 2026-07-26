/**
 * SectionDef Value Object
 *
 * Represents a group of fields within a form definition, with bilingual titles
 * and an ordered position among sibling sections.
 *
 * @traceability DOC-012 Aggregate6 §VO-SectionDef → POSTGRESQL-SCHEMA-PACK-v1 form_sections
 */

import { InvalidFieldDefError } from './field-def.vo';

export interface SectionDefProps {
  readonly id: string;           // uuid PK for this section
  readonly titleFr: string;
  readonly titleEn: string;
  readonly order: number;
}

export class InvalidSectionDefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSectionDefError';
  }
}

/**
 * Validates that a SectionDef has required properties.
 */
export function validateSectionDef(props: SectionDefProps): void {
  if (!props.id || typeof props.id !== 'string') {
    throw new InvalidSectionDefError('SectionDef requires a valid id.');
  }

  if (props.titleFr.trim().length === 0) {
    throw new InvalidSectionDefError(
      'SectionDef title_fr must be a non-empty string.',
    );
  }

  if (props.titleEn.trim().length === 0) {
    throw new InvalidSectionDefError(
      'SectionDef title_en must be a non-empty string.',
    );
  }

  if (props.titleFr.length > 255 || props.titleEn.length > 255) {
    throw new InvalidSectionDefError('Section labels must not exceed 255 characters.');
  }

  if (typeof props.order !== 'number' || props.order < 0) {
    throw new InvalidSectionDefError('SectionDef order must be >= 0.');
  }
}

export class SectionDef {
  private readonly _props: Required<Pick<SectionDefProps, 'titleFr' | 'titleEn' | 'order'>> & {
    readonly id: string;
  };

  constructor(props: SectionDefProps) {
    validateSectionDef(props);
    this._props = {
      ...props,
    };
  }

  get id(): string { return this._props.id; }
  get titleFr(): string { return this._props.titleFr; }
  get titleEn(): string { return this._props.titleEn; }
  get order(): number { return this._props.order; }

  getLabel(lang: 'fr' | 'en'): string {
    return lang === 'fr' ? this._props.titleFr : this._props.titleEn;
  }

  equals(other: SectionDef): boolean {
    return this._props.id === other._props.id &&
           this._props.order === other._props.order;
  }

  /** Create a new SectionDef with an updated order. */
  withOrder(newOrder: number): SectionDef {
    validateSectionDef({ ...this._props, order: newOrder });
    return new SectionDef({ ...this._props, order: newOrder });
  }

  /** Build an object suitable for JSON persistence. */
  toPersistable(): Omit<SectionDefProps, 'id'> {
    return {
      titleFr: this._props.titleFr,
      titleEn: this._props.titleEn,
      order: this._props.order,
    };
  }
}
