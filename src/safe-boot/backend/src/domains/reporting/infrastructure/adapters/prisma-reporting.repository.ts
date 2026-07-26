/**
 * PrismaAdapter for ReportingAggregate — implements IReportSnapshotPort.
 *
 * @traceability DOC-012 Aggregate9
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 26 (report_snapshots)
 */

import type {
  IReportSnapshotPort,
  ReportSnapshotRecord,
  ITransactionQueryPort,
  RawTransactionRecord,
} from '../ports/reporting.port';

export class PrismaReportingRepository implements IReportSnapshotPort, ITransactionQueryPort {
  constructor(private readonly prisma: unknown) {}

  // ---- IReportSnapshotPort ----

  async create(record: Omit<ReportSnapshotRecord, 'id' | 'horodatage_genere' | 'date_generation'>): Promise<string> {
    const data = { ...record };
    await this.prismaExecute('create', 'report_snapshots', data);
    return String(data.id ?? '');
  }

  async findById(id: string, requestOrgId: string): Promise<ReportSnapshotRecord | null> {
    const raw = await this.prismaFindOne('report_snapshots', { id, org_id: requestOrgId });
    if (!raw) return null;
    return this.toPortRecord(raw);
  }

  async findByOrgAndPeriod(
    orgId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ReportSnapshotRecord | null> {
    const raw = await this.prismaFindOne('report_snapshots', {
      org_id: orgId,
      periode_debut: periodStart.toISOString(),
      periode_fin: periodEnd.toISOString(),
    });
    if (!raw) return null;
    return this.toPortRecord(raw);
  }

  async findAllByOrg(orgId: string): Promise<ReportSnapshotRecord[]> {
    const rows = await this.prismaFindMany('report_snapshots', { org_id: orgId });
    return rows.map(this.toPortRecord.bind(this));
  }

  async setSignature(id: string, signature: string): Promise<void> {
    await this.prismaUpdate('report_snapshots', { id }, { signature_numerique: signature });
  }

  // ---- ITransactionQueryPort ----

  async findApprovedByOrgAndPeriod(
    orgId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RawTransactionRecord[]> {
    const rows = await this.prismaFindMany('transactions', {
      org_id: orgId,
      date_transaction_gte: periodStart.toISOString(),
      date_transaction_lte: periodEnd.toISOString(),
      est_synchronise: true,
    });
    return rows.map(this.toRawTransaction.bind(this));
  }

  // ---- Conversion helpers ----

  private toPortRecord(row: Record<string, unknown>): ReportSnapshotRecord {
    return {
      id: String(row.id),
      org_id: String(row.org_id),
      definition_id: row.definition_id ? String(row.definition_id) : null,
      periode_debut: new Date(String(row.periode_debut)),
      periode_fin: new Date(String(row.periode_fin)),
      portee: String(row.portee) as ReportSnapshotRecord['portee'],
      total_revenu: Number(row.total_revenu),
      total_depense: Number(row.total_depense),
      resultat_net: Number(row.resultat_net),
      details_par_categorie: this.parseJson(row.details_par_categorie, {}),
      nombre_transactions: Number(row.nombre_transactions),
      horodatage_genere: new Date(String(row.horodatage_genere)),
      signature_numerique: row.signature_numerique ? String(row.signature_numerique) : null,
      date_generation: row.date_generation ? new Date(String(row.date_generation)) : new Date(),
    };
  }

  private toRawTransaction(row: Record<string, unknown>): RawTransactionRecord {
    return {
      id: String(row.id),
      montant: Number(row.montant),
      type_transaction: String(row.type_transaction),
      categorie_ref: String(row.categorie_ref),
      est_synchronise: Boolean(row.est_synchronise),
      date_transaction: new Date(String(row.date_transaction)),
    };
  }

  private parseJson(value: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return fallback; }
    }
    if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
    return fallback;
  }

  // ---- Prisma delegation stubs ----
  private async prismaFindOne(table: string, where: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    throw new Error('PrismaReportingRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaFindMany(table: string, where: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    throw new Error('PrismaReportingRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaUpdate(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaReportingRepository requires a PrismaClient instance at composition root.');
  }
  private async prismaExecute(action: string, table: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaReportingRepository requires a PrismaClient instance at composition root.');
  }
}
