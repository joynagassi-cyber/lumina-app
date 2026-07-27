/**
 * CategoryPrismaAdapter — CRUD for categories (vocab_values FKs).
 *
 * @traceability PG-Schema-v1 Table 10, BR-RES-006 (categories always from vocabulary)
 */

import { Injectable } from '@nestjs/common';

declare const prisma: any;

@Injectable()
export class CategoryPrismaAdapter {
  /** List active category values for a given org and namespace. */
  async listActiveByNamespace(orgId: string, namespaceId: string): Promise<Array<{ id: string; key: string; labelFr: string; labelEn: string; colorHex: string | null }>> {
    return prisma.vocab_value.findMany({
      where: {
        term: { namespace_id: namespaceId },
        est_deprecie: false,
        org_id: orgId,
      },
      select: { id: true, cle_valeur: true, libelle_fr: true, libelle_en: true, couleur_hex: true },
    });
  }

  /** Resolve a category_ref to its display labels. */
  async resolveCategoryRef(categoryRef: string): Promise<{ key: string; labelFr: string; labelEn: string; colorHex: string | null } | null> {
    const row = await prisma.vocab_value.findUnique({
      where: { id: categoryRef },
      select: { cle_valeur: true, libelle_fr: true, libelle_en: true, couleur_hex: true },
    });
    return row ?? null;
  }

  /** Create a finance-specific category in the vocabulary. */
  async createCategory(orgId: string, namespaceKey: string, valueKey: string, labelFr: string, labelEn: string, colorHex?: string | null): Promise<string> {
    // Categories stored as vocab_values per PG-Schema-v1 Table 24
    const term = await prisma.vocab_term.findFirst({
      where: { cle_term: namespaceKey, namespace: { org_id: orgId } },
      select: { id: true },
    });
    if (!term) throw new Error(`Vocabulary term "${namespaceKey}" not found for org ${orgId}`);

    const value = await prisma.vocab_value.create({
      data: {
        term_id: term.id,
        cle_valeur: valueKey,
        libelle_fr: labelFr,
        libelle_en: labelEn,
        couleur_hex: colorHex,
        org_id: orgId,
      },
    });
    return value.id;
  }
}
