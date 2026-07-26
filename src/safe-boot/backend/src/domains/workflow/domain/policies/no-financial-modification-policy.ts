/**
 * NoFinancialModificationPolicy
 *
 * Enforces BR-WF-005: financial workflows do NOT modify approved transactions directly.
 * Workflows can request state transitions (e.g. draft → pending → approved) through
 * dedicated channels but cannot perform direct writes on approved financial records.
 *
 * @traceability DOC-012 Aggregate5 §Policies-NoFinancialModificationPolicy
 *   → POSTGRESQL-SCHEMA-PACK-v1 transactions.statut CHECK IN ('draft','pending','approved','rejected')
 *   → BR-WF-005 (Financial workflows do NOT modify approved tx directly)
 */

export class FinancialModificationForbiddenError extends Error {
  constructor(transactionId: string, attemptedAction: string) {
    super(
      `Workflow is not allowed to ${attemptedAction} on approved transaction '${transactionId}'. ` +
        `Per BR-WF-005, financial workflows cannot modify approved transactions directly.`,
    );
    this.name = 'FinancialModificationForbiddenError';
  }
}

/** Resource types that are considered "financial" for the purpose of this policy. */
const FINANCIAL_RESOURCE_TYPES = new Set(['transaction', 'expense', 'payment']);

export class NoFinancialModificationPolicy {
  /**
   * Check whether the given workflow is attempting to modify a financial resource
   * in a forbidden way.
   *
   * @param resourceType — the type of resource being modified
   * @param resourceStatus — current status of the resource (e.g. 'approved')
   * @param attemptedAction — description of what the workflow is trying to do
   * @throws FinancialModificationForbiddenError if the modification is disallowed
   */
  static validate(
    resourceType: string,
    resourceStatus: string,
    attemptedAction: string,
  ): void {
    if (!FINANCIAL_RESOURCE_TYPES.has(resourceType)) {
      return; // Not a financial resource — no restriction applies
    }

    // Approved financial transactions are immutable except via compensation
    if (resourceStatus === 'approved') {
      throw new FinancialModificationForbiddenError(
        'unknown',
        attemptedAction,
      );
    }
  }

  /**
   * Quick check: is the resource type considered financial?
   */
  static isFinancialResource(resourceType: string): boolean {
    return FINANCIAL_RESOURCE_TYPES.has(resourceType);
  }

  /**
   * Check if a given status represents an immutable/locked financial state.
   */
  static isImmutableFinancialStatus(status: string): boolean {
    return status === 'approved';
  }
}
