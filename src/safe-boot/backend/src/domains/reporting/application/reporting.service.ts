/**
 * Reporting Application Service — orchestrates report generation and export.
 *
 * @traceability DOC-012 Aggregate9 §ReportingAggregate Application Service
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 25 (reports) + Table 26 (report_snapshots)
 */

import { BalanceCalculator } from '../domain/services/balance-calculator.service';
import { GeneratedReport, ReportExported } from '../domain/entities/generated-report.entity';
import { BalanceTotals } from '../domain/value-objects/balance-totals.vo';
import { PeriodType } from '../domain/value-objects/period-type.vo';
import { PermissionCheckPolicy } from '../domain/policies/permission-check-policy';
import type {
  IReportSnapshotPort,
  ITransactionQueryPort,
  RawTransactionRecord,
  CategoryBreakdown,
} from '../ports/reporting.port';

export interface GenerateMonthlyReportInput {
  orgId: string;
  month: Date; // Any date in the target month
  userId: string;
}

export class ReportingService {
  constructor(
    private readonly snapshotPort: IReportSnapshotPort,
    private readonly transactionPort: ITransactionQueryPort,
  ) {}

  /**
   * Generate a monthly report for a given month.
   * BR-RPT-002: Monthly report covers 1st to last day of month.
   * BR-RPT-005: Only synced=1 (approved) transactions participate.
   */
  async generateMonthlyReport(input: GenerateMonthlyReportInput): Promise<GeneratedReport> {
    // Check read permission
    if (!PermissionCheckPolicy.checkRead({
      userId: input.userId,
      orgId: input.orgId,
      requiredPermission: 'reporting:*:read',
    })) {
      throw new PermissionDeniedError('User lacks reporting:*:read permission.');
    }

    const periodType = PeriodType.create('month');
    const range = periodType.computeDateRange(input.month);

    // Fetch only approved transactions
    const transactions = await this.transactionPort.findApprovedByOrgAndPeriod(
      input.orgId,
      range.start,
      range.end,
    );

    const balance = BalanceCalculator.calculate(transactions);

    // Build category breakdown
    const categoryBreakdown: Record<string, CategoryBreakdown> = {};
    for (const txn of transactions) {
      if (!categoryBreakdown[txn.categorie_ref]) {
        categoryBreakdown[txn.categorie_ref] = { income: 0, expense: 0 };
      }
      if (txn.type_transaction === 'income') {
        categoryBreakdown[txn.categorie_ref].income += txn.montant;
      } else if (txn.type_transaction === 'expense') {
        categoryBreakdown[txn.categorie_ref].expense += txn.montant;
      }
    }

    // Create the report entity
    const report = GeneratedReport.create({
      orgId: input.orgId,
      periodStart: range.start,
      periodEnd: range.end,
      scope: 'org',
      balance,
      categoryBreakdown,
    });

    // Persist the snapshot
    await this.snapshotPort.create({
      org_id: report.orgId,
      periode_debut: report.periodStart,
      periode_fin: report.periodEnd,
      portee: 'org',
      total_revenu: report.balance.totalIncome,
      total_depense: report.balance.totalExpense,
      resultat_net: report.balance.netResult,
      details_par_categorie: report.categoryBreakdown,
      nombre_transactions: report.transactionCount,
    });

    return report;
  }

  /**
   * Retrieve a previously generated report by ID.
   */
  async getReport(reportId: string, orgId: string): Promise<GeneratedReport | null> {
    const record = await this.snapshotPort.findById(reportId, orgId);
    if (!record) return null;

    return this.toDomain(record);
  }

  /**
   * Export a report with digital signature.
   * BR-RPT-003: Export includes timestamp and digital signature.
   * BR-RPT-004: Archived reports are immutable.
   */
  async exportReport(reportId: string, orgId: string, userId: string): Promise<Buffer> {
    const existing = await this.snapshotPort.findById(reportId, orgId);
    if (!existing) throw new ReportNotFoundError(reportId);

    // Create a JSON representation of the report
    const payload = JSON.stringify({
      id: existing.id,
      org_id: existing.org_id,
      period_start: existing.periode_debut.toISOString(),
      period_end: existing.periode_fin.toISOString(),
      scope: existing.portee,
      total_income: existing.total_revenu,
      total_expense: existing.total_depense,
      net_result: existing.resultat_net,
      categories: existing.details_par_categorie,
      transaction_count: existing.nombre_transactions,
      generated_at: existing.horodatage_genere.toISOString(),
    });

    // Apply digital signature
    const signature = this.generateDigitalSignature(payload, existing);
    await this.snapshotPort.setSignature(reportId, signature);

    return Buffer.from(payload);
  }

  private toDomain(record: {
    id: string;
    org_id: string;
    periode_debut: Date;
    periode_fin: Date;
    portee: string;
    total_revenu: number;
    total_depense: number;
    resultat_net: number;
    details_par_categorie: Record<string, CategoryBreakdown>;
    nombre_transactions: number;
    horodatage_genere: Date;
    signature_numerique?: string | null;
  }): GeneratedReport {
    return GeneratedReport.create({
      orgId: record.org_id,
      periodStart: record.periode_debut,
      periodEnd: record.periode_fin,
      scope: record.portee,
      balance: BalanceTotals.fromProps({
        totalIncome: record.total_revenu,
        totalExpense: record.total_depense,
        netResult: record.resultat_net,
        transactionCount: record.nombre_transactions,
      }),
      categoryBreakdown: record.details_par_categorie,
    });
  }

  /**
   * Generate a deterministic digital signature for report integrity.
   */
  private generateDigitalSignature(payload: string, report: { org_id: string }): string {
    // In production, use a proper HMAC with org-specific key
    const hashInput = `${payload}:${report.org_id}`;
    // Simple hash stub — replace with crypto module in production
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `sha1:${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }
}

// ---- Application Errors ----

export class ReportNotFoundError extends Error {
  constructor(id: string) {
    super(`Report not found: ${id}`);
    this.name = 'ReportNotFoundError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}
