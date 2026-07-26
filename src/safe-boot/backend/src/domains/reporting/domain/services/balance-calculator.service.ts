/**
 * BalanceCalculator — domain service for computing report balances.
 *
 * @traceability DOC-012 Aggregate9 §BalanceCalculator
 *   → BR-RPT-001: Balance must balance (Actif = Passif + Resultat)
 *   → BR-RPT-005: Only synced=1 (approved) transactions participate
 */

import { BalanceTotals } from '../value-objects/balance-totals.vo';
import { RawTransactionRecord, CategoryBreakdown } from '../ports/reporting.port';

export class BalanceCalculator {
  /**
   * Calculate balance totals from approved transactions within a period.
   * BR-RPT-005: Only est_synchronise=true transactions are included.
   */
  static calculate(transactions: RawTransactionRecord[]): BalanceTotals {
    const approved = transactions.filter((t) => t.est_synchronise);

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown: Record<string, CategoryBreakdown> = {};

    for (const txn of approved) {
      if (txn.type_transaction === 'income') {
        totalIncome += txn.montant;
      } else if (txn.type_transaction === 'expense') {
        totalExpense += txn.montant;
      }
      // 'transfer' and 'adjustment' types are excluded from direct balance

      // Category breakdown
      const catKey = txn.categorie_ref;
      if (!categoryBreakdown[catKey]) {
        categoryBreakdown[catKey] = { income: 0, expense: 0 };
      }
      if (txn.type_transaction === 'income') {
        categoryBreakdown[catKey].income += txn.montant;
      } else if (txn.type_transaction === 'expense') {
        categoryBreakdown[catKey].expense += txn.montant;
      }
    }

    return BalanceTotals.fromProps({
      totalIncome,
      totalExpense,
      netResult: totalIncome - totalExpense,
      transactionCount: approved.length,
    });
  }

  /**
   * Validate that the balance is internally consistent.
   */
  static validate(balance: BalanceTotals): void {
    balance.validateBalance();
  }

  /**
   * Check if the net result is positive (surplus).
   */
  static hasSurplus(balance: BalanceTotals): boolean {
    return balance.netResult > 0;
  }

  /**
   * Check if the net result is negative (deficit).
   */
  static hasDeficit(balance: BalanceTotals): boolean {
    return balance.netResult < 0;
  }
}
