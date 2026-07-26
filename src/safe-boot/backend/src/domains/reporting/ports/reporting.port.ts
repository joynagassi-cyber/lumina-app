/**
 * Reporting Ports — interface contracts for the ReportingAggregate.
 *
 * @traceability DOC-012 Aggregate9 (ReportingAggregate), PG-Schema-v1 Table 25/26
 *   → POSTGRESQL-SCHEMA-PACK-v1 reports + report_snapshots
 */

export type PeriodType = 'month' | 'quarter' | 'year' | 'custom';
export type ReportScope = 'org' | 'group' | 'all' | 'partial_consolidation';
export type ExportFormat = 'pdf' | 'csv' | 'json';

export interface ReportSnapshotRecord {
  id: string;
  org_id: string;
  definition_id?: string | null;
  periode_debut: Date;
  periode_fin: Date;
  portee: ReportScope;
  total_revenu: number;
  total_depense: number;
  resultat_net: number;
  details_par_categorie: Record<string, CategoryBreakdown>;
  nombre_transactions: number;
  horodatage_genere: Date;
  signature_numerique?: string | null;
  date_generation?: Date;
}

export interface CategoryBreakdown {
  readonly income: number;
  readonly expense: number;
}

export interface BalanceTotals {
  readonly totalIncome: number;
  readonly totalExpense: number;
  readonly netResult: number;
  readonly transactionCount: number;
}

export interface RawTransactionRecord {
  id: string;
  montant: number;
  type_transaction: string;
  categorie_ref: string;
  est_synchronise: boolean;
  date_transaction: Date;
}

/**
 * Port for querying approved (synced) transactions for reporting calculations.
 */
export interface ITransactionQueryPort {
  findApprovedByOrgAndPeriod(
    orgId: string,
    periodStart: Date,
    periodEnd: Date,
    scope?: ReportScope,
  ): Promise<RawTransactionRecord[]>;
}

/**
 * Repository port for report snapshots (GeneratedReport).
 */
export interface IReportSnapshotPort {
  create(record: Omit<ReportSnapshotRecord, 'id' | 'horodatage_genere' | 'date_generation'>): Promise<string>;
  findById(id: string, requestOrgId: string): Promise<ReportSnapshotRecord | null>;
  findByOrgAndPeriod(
    orgId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ReportSnapshotRecord | null>;
  findAllByOrg(orgId: string): Promise<ReportSnapshotRecord[]>;
  setSignature(id: string, signature: string): Promise<void>;
}

/**
 * Repository port for report definitions.
 */
export interface IReportDefinitionPort {
  findById(id: string, requestOrgId: string): Promise<ReportDefinitionRecord | null>;
  findAllByOrg(orgId: string): Promise<ReportDefinitionRecord[]>;
  create(
    record: Omit<ReportDefinitionRecord, 'id' | 'created_at' | 'date_derniere_generation'>,
  ): Promise<string>;
}

export interface ReportDefinitionRecord {
  id: string;
  org_id: string;
  cle_rapport: string;
  titre_fr: string;
  titre_en: string;
  periode_type: PeriodType;
  format_export: ExportFormat[];
  created_at: Date;
  date_derniere_generation?: Date | null;
}
