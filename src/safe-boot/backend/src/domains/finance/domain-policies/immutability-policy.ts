/**
 * ImmutabilityPolicy — enforces INV-001: approved transactions cannot be modified.
 * Corrections must use compensating transactions (BR-RES-002).
 *
 * @traceability DOC-012 Aggregate3 (ImmutabilityPolicy), INV-001, BR-RES-002
 */

import { TransactionState } from '../value-objects/transaction-state.vo';

export class ImmutabilityPolicyViolationError extends Error {
  constructor(transactionId: string, attemptedOperation: string) {
    super(`ImmutabilityPolicy: cannot ${attemptedOperation} approved transaction ${transactionId} — use compensation instead (INV-001)`);
    this.name = 'ImmutabilityPolicyViolationError';
  }
}

export class ImmutabilityPolicy {
  /** Assert that a transaction may be mutated. Throws if immutable. */
  static assertMutable(entity: { id: { toString(): string }; state: TransactionState }): void {
    if (entity.state === TransactionState.APPROVED) {
      throw new ImmutabilityPolicyViolationError(
        entity.id.toString(),
        'modify',
      );
    }
  }

  /** Determine whether a compensating transaction is required for the given state. */
  static requiresCompensation(state: TransactionState): boolean {
    return state === TransactionState.APPROVED;
  }
}
