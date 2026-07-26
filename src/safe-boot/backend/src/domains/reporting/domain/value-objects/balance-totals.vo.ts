/**
 * BalanceTotals — value object representing income, expense, and net result.
 *
 * @traceability DOC-012 Aggregate9 §VO-BalanceTotals
 *   → BR-RPT-001: Balance must balance (Actif = Passif + Resultat)
 *   → BR-RPT-005: Only synced=1 (approved) transactions participate
 */

import { CategoryBreakdown } from '../ports/reporting.port';

export interface BalanceTotalsProps {
  readonly totalIncome: number;
  readonly totalExpense: number;
  readonly netResult: number;
  readonly transactionCount: number;
}

/**
 * Immutable value object holding the balance totals for a report.
 * Enforces BR-RPT-001: netResult = totalIncome - totalExpense.
 */
export class BalanceTotals {
  private constructor(private readonly props: BalanceTotalsProps) {}

  static create(props: Omit<BalanceTotalsProps, 'netResult'>): BalanceTotals {
    const netResult = props.totalIncome - props.totalExpense;
    return new BalanceTotals({ ...props, netResult });
  }

  static fromProps(props: BalanceTotalsProps): BalanceTotals {
    // Validate the balance invariant
    const expectedNet = props.totalIncome - props.totalExpense;
    if (props.netResult !== expectedNet) {
      throw new BalanceInvariantViolationError(
        `Balance check failed: netResult=${props.netResult} but expected ${expectedNet} (income=${props.totalIncome} - expense=${props.totalExpense}).`,
      );
    }
    return new BalanceTotals(props);
  }

  get totalIncome(): number { return this.props.totalIncome; }
  get totalExpense(): number { return this.props.totalExpense; }
  get netResult(): number { return this.props.netResult; }
  get transactionCount(): number { return this.props.transactionCount; }

  /**
   * Validate BR-RPT-001: Balance must balance.
   */
  validateBalance(): void {
    const expected = this.props.totalIncome - this.props.totalExpense;
    if (this.props.netResult !== expected) {
      throw new BalanceInvariantViolationError(
        `Balance invariant violated: netResult=${this.props.netResult}, expected=${expected}.`,
      );
    }
  }
}

/**
 * Error thrown when the balance invariant (netResult = income - expense) is violated.
 */
export class BalanceInvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BalanceInvariantViolationError';
  }
}
