/**
 * Form Repository Port
 *
 * Defines the contracts for persisting and querying FormDefinition, FormSection,
 * and FormField entities. All operations are scoped to org_id per NB-MT-002.
 *
 * @traceability DOC-012 Aggregate6 §FormAggregate -> POSTGRESQL-SCHEMA-PACK-v1 tables: forms, form_sections, form_fields
 *   -> DOC-023 Section 8 Multi-tenant isolation (org_id on ALL methods)
 *   -> PAS-005 PA-NB-007 (RepositoryAbstraction -- persistence metadata stripped at boundary)
 */

export interface FormDefinitionWithSections {
  definition: FormDefinition;
  sections: FormSectionRow[];
  fields: FormFieldRow[];
}

export interface FormSectionRow {
  id: string;
  definitionId: string;
  ordre: number;
  titreFr: string;
  titreEn: string;
  orgId: string;
}

export interface FormFieldRow {
  id: string;
  sectionId: string;
  nomChamp: string;
  labelFr: string;
  labelEn: string;
  typeChamp: string;
  required: boolean;
  sourceVocabulaire: string | null;
  conditionVisibilite: string | null;
  valeurDefaut: string | null;
  patternValidation: string | null;
  min: number | null;
  max: number | null;
  orgId: string;
}

export interface FindFormDefinitionByIdResult {
  data: FormDefinitionWithSections;
}

/**
 * Repository for the Form aggregate root.
 * All operations are scoped to a specific org via requestOrgId.
 */
export interface IFormRepository {
  findById(
    definitionId: string,
    requestOrgId: string,
  ): Promise<FormDefinitionWithSections | null>;

  findByKeyAndVersion(
    key: string,
    version: string,
    requestOrgId: string,
  ): Promise<FormDefinitionWithSections | null>;

  listByOrg(requestOrgId: string): Promise<Array<{
    id: string;
    cleFormulaire: string;
    referenceModele: string;
    versionSemantique: string;
    estPublie: boolean;
    orgId: string;
  }>>;

  saveDefinition(definition: FormDefinition): Promise<void>;
  updateDefinition(definition: FormDefinition): Promise<void>;
  saveSections(sections: FormSectionRow[]): Promise<void>;
  saveFields(fields: FormFieldRow[]): Promise<void>;
  deleteByDefinitionId(definitionId: string, requestOrgId: string): Promise<void>;
}
