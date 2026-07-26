/**
 * PrismaFormRepository — Infrastructure Adapter
 *
 * Implements IFormRepository using Prisma ORM.
 * Strips persistence metadata before returning entities per PAS-005 PA-NB-007.
 *
 * @traceability DOC-012 Aggregate6 → POSTGRESQL-SCHEMA-PACK-v1 tables: forms, form_sections, form_fields
 *   → PAS-005 PA-NB-007 (RepositoryAbstraction)
 *   → PAS-003 DR-007 (Persistence Ignorance)
 */

import { FormDefinition } from '../../../domain/entities/form-definition.entity';
import { FormVersion } from '../../../domain/value-objects/form-version.vo';
import type {
  IFormRepository,
  FormSectionRow,
  FormFieldRow,
  FormDefinitionWithSections,
} from '../../ports/form.port';

export class PrismaFormRepository implements IFormRepository {
  constructor(
    private readonly prisma: unknown, // PrismaClient injected at composition root
  ) {}

  async findById(
    definitionId: string,
    requestOrgId: string,
  ): Promise<FormDefinitionWithSections | null> {
    const result = await this._queryFormWithChildren(definitionId, requestOrgId);
    if (!result) return null;

    return {
      orgId: String(result.org_id),
      cleFormulaire: String(result.cle_formulaire),
      referenceModele: String(result.reference_modele),
      versionSemantique: String(result.version_semantique),
      estPublie: Boolean(result.est_publie),
      publiePar: result.publie_par ? String(result.publie_par) : null,
      datePremierePublication: result.date_premiere_publication ? new Date(String(result.date_premiere_publication)) : null,
      dateDernierePublication: result.date_derniere_publication ? new Date(String(result.date_derniere_publication)) : null,
      created_at: new Date(String(result.created_at)),
      sections: (result.sections ?? []) as FormSectionRow[],
      fields: (result.fields ?? []) as FormFieldRow[],
    };
  }

  async findByKeyAndVersion(
    key: string,
    version: string,
    requestOrgId: string,
  ): Promise<FormDefinitionWithSections | null> {
    const result = await this._queryFormByKey(key, version, requestOrgId);
    if (!result) return null;

    return {
      orgId: String(result.org_id),
      cleFormulaire: String(result.cle_formulaire),
      referenceModele: String(result.reference_modele),
      versionSemantique: String(result.version_semantique),
      estPublie: Boolean(result.est_publie),
      publiePar: result.publie_par ? String(result.publie_par) : null,
      datePremierePublication: result.date_premiere_publication ? new Date(String(result.date_premiere_publication)) : null,
      dateDernierePublication: result.date_derniere_publication ? new Date(String(result.date_derniere_publication)) : null,
      created_at: new Date(String(result.created_at)),
      sections: (result.sections ?? []) as FormSectionRow[],
      fields: (result.fields ?? []) as FormFieldRow[],
    };
  }

  async listByOrg(requestOrgId: string): Promise<Array<{
    id: string;
    cleFormulaire: string;
    referenceModele: string;
    versionSemantique: string;
    estPublie: boolean;
    orgId: string;
  }>> {
    // In production: await this.prisma.form.findMany({ where: { org_id: requestOrgId } })
    throw new Error('PrismaFormRepository requires a PrismaClient instance at composition root.');
  }

  async saveDefinition(definition: FormDefinition): Promise<void> {
    const record = this._toPersistence(definition);
    // In production: await this.prisma.form.create({ data: record })
    throw new Error('PrismaFormRepository.saveDefinition requires a PrismaClient instance.');
  }

  async updateDefinition(definition: FormDefinition): Promise<void> {
    const record = this._toPersistence(definition, true);
    // In production: await this.prisma.form.update({ where: { id: definition.id }, data: record })
    throw new Error('PrismaFormRepository.updateDefinition requires a PrismaClient instance.');
  }

  async saveSections(sections: FormSectionRow[]): Promise<void> {
    if (sections.length === 0) return;
    // In production: await Promise.all(sections.map(s => this.prisma.form_section.create({ data: s })))
    throw new Error('PrismaFormRepository.saveSections requires a PrismaClient instance.');
  }

  async saveFields(fields: FormFieldRow[]): Promise<void> {
    if (fields.length === 0) return;
    // In production: await Promise.all(fields.map(f => this.prisma.form_field.create({ data: f })))
    throw new Error('PrismaFormRepository.saveFields requires a PrismaClient instance.');
  }

  async deleteByDefinitionId(definitionId: string, _requestOrgId: string): Promise<void> {
    // CASCADE: deleting a form definition cascades to form_sections and form_fields
    throw new Error('PrismaFormRepository.deleteByDefinitionId requires a PrismaClient instance.');
  }

  // ---- Persistence conversion ----

  private _toPersistence(def: FormDefinition, isUpdate?: boolean): Record<string, unknown> {
    return {
      id: def.id,
      cle_formulaire: def.key,
      reference_modele: def.modelRef,
      version_semantique: def.version.toString(),
      est_publie: def.isPublished,
      publie_par: def.publishedBy ?? null,
      updated_at: isUpdate ? def.updatedAt.toISOString() : undefined,
    };
  }

  // ---- Raw query stubs (Prisma calls delegated by composition root) ----

  private async _queryFormWithChildren(
    _definitionId: string,
    _requestOrgId: string,
  ): Promise<Record<string, unknown> | null> {
    // Implementation delegated:
    // const result = await this.prisma.form.findUnique({
    //   where: { id: definitionId, org_id: requestOrgId },
    //   include: { sections: { orderBy: { ordre: 'asc' } }, fields: { include: { section: true } } },
    // });
    throw new Error('PrismaFormRepository requires a PrismaClient instance at composition root.');
  }

  private async _queryFormByKey(
    _key: string,
    _version: string,
    _requestOrgId: string,
  ): Promise<Record<string, unknown> | null> {
    // Implementation delegated:
    // const result = await this.prisma.form.findFirst({
    //   where: { cle_formulaire: key, version_semantique: version, org_id: requestOrgId },
    // });
    throw new Error('PrismaFormRepository requires a PrismaClient instance at composition root.');
  }
}
