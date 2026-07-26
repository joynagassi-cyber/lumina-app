/**
 * Form Definition Entity
 *
 * Aggregate root for the FormAggregate. Represents a complete form definition
 * composed of sections and fields stored as configuration (YAML/JSON), never JSX.
 *
 * @traceability DOC-012 Aggregate6 §Entity-FormDefinition
 *   → POSTGRESQL-SCHEMA-PACK-v1 forms (id, org_id, cle_formulaire, reference_modele, version_semantique, est_publie, ...)
 *   → DOC-023 §4 Immutable versions
 */

import { SectionDef } from '../value-objects/section-def.vo';
import { FormVersion } from '../value-objects/form-version.vo';

export interface FormDefinitionProps {
  readonly id: string;                    // uuid PK
  readonly orgId: string;                 // FK organizations
  readonly key: string;                   // cle_formulaire unique within org
  readonly modelRef: string;              // reference_modeble — domain entity type
  readonly version: FormVersion;
  readonly isPublished: boolean;          // est_publie
  readonly publishedBy?: string;          // uuid FK users
  readonly publishedAt?: Date;            // date_premiere_publication / date_derniere_publication
  readonly createdAt: Date;
  readonly updatedAt: Date;
  sections: SectionDef[];                 // mutable until published
}

export class FormDefinition {
  private _props: FormDefinitionProps;

  constructor(props: FormDefinitionProps) {
    this._props = { ...props, sections: [...props.sections] };
  }

  get id(): string { return this._props.id; }
  get orgId(): string { return this._props.orgId; }
  get key(): string { return this._props.key; }
  get modelRef(): string { return this._props.modelRef; }
  get version(): FormVersion { return this._props.version; }
  get isPublished(): boolean { return this._props.isPublished; }
  get publishedBy(): string | undefined { return this._props.publishedBy; }
  get publishedAt(): Date | undefined { return this._props.publishedAt; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._props.updatedAt; }
  get sections(): ReadonlyArray<SectionDef> {
    return Object.freeze([...this._props.sections]);
  }

  /**
   * Add a section to this form definition.
   * Not allowed if the form is already published (BR-FRM-004).
   */
  addSection(section: SectionDef, clock: { now(): Date }): void {
    if (this._props.isPublished) {
      throw new PublishedFormModificationError(
        'Cannot modify sections of a published form. Create a new version instead.',
      );
    }
    this._props.sections.push(section);
    this._props.updatedAt = clock.now();
  }

  /** Remove all sections (reset form structure). */
  clearSections(clock: { now(): Date }): void {
    if (this._props.isPublished) {
      throw new PublishedFormModificationError(
        'Cannot modify sections of a published form. Create a new version instead.',
      );
    }
    this._props.sections = [];
    this._props.updatedAt = clock.now();
  }

  /**
   * Publish this form definition.
   * Sets est_publie to true and records the publisher.
   */
  publish(publisherId: string, clock: { now(): Date }): void {
    this._props.isPublished = true;
    this._props.publishedBy = publisherId;
    this._props.publishedAt = clock.now();
    this._props.updatedAt = clock.now();
  }

  /**
   * Unpublish a form. Allows further modifications.
   * Only the original publisher or an admin may unpublish.
   */
  unpublish(clock: { now(): Date }): void {
    this._props.isPublished = false;
    this._props.updatedAt = clock.now();
  }

  equals(other: FormDefinition): boolean {
    return this._props.id === other._props.id &&
           this._props.orgId === other._props.orgId &&
           this._props.key === other._props.key;
  }
}

export class PublishedFormModificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishedFormModificationError';
  }
}
