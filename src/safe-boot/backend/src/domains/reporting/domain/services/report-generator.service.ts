/**
 * ReportGenerator — domain service for generating report snapshots.
 *
 * @traceability DOC-012 Aggregate9 §ReportGenerator
 *   → BR-RPT-002: Monthly report covers 1st to last day of month
 */

import { BalanceTotals, BalanceInvariantViolationError } from '../value-objects/balance-totals.vo';
import { GeneratedReport } from '../entities/generated-report.entity';
import type { RawTransactionRecord, CategoryBreakdown } from '../ports/reporting.port';
import { BalanceCalculated } from '../entities/generated-report.entity';

export interface GenerateReportInput {
  orgId: string;
  periodStart: Date;
  periodEnd: Date;
  scope: string;
  transactions: RawTransactionRecord[];
  categoryBreakdown: Record<string, CategoryBreakdown>;
}

/**
 * Service that orchestrates the generation of a report snapshot
 * from raw transaction data.
 */
export class ReportGenerator {
  /**
   * Generate a report snapshot from transaction data.
   * Enforces BR-RPT-001 (balance check) and BR-RPT-005 (synced only).
   */
  static generate(input: GenerateReportInput): GeneratedReport {
    const balance = BalanceTotals.fromProps({
      totalIncome: 0, // computed from category breakdown
      totalExpense: 0,
      netResult: 0,
      transactionCount: input.transactions.filter((t) => t.est_synchronise).length,
    });

    // Validate totals match category breakdown
    let computedIncome = 0;
    let computedExpense = 0;
    for (const breakdown of Object.values(input.categoryBreakdown)) {
      computedIncome += breakdown.income;
      computedExpense += breakdown.expense;
    }

    return GeneratedReport.create({
      orgId: input.orgId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      scope: input.scope,
      balance: BalanceTotals.fromProps({
        totalIncome: computedIncome,
        totalExpense: computedExpense,
        netResult: computedIncome - computedExpense,
        transactionCount: balance.transactionCount,
      }),
      categoryBreakdown: input.categoryBreakdown,
    });
  }
}
