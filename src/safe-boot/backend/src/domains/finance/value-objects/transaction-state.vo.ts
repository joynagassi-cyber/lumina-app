/**
 * TransactionState — state machine for transaction resources.
 * Transitions: draft -> pending -> approved | rejected
 *
 * @traceability DOC-012 Aggregate3 (TransactionRecord states), DOC-023 §5.3
 * @invariant State transitions follow the defined FSM; no reverse transitions
 */

export enum TransactionState {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Valid next states per current state.
 */
export const TRANSACTION_STATE_TRANSITIONS: Record<TransactionState, readonly TransactionState[]> = {
  [TransactionState.DRAFT]: [TransactionState.PENDING],
  [TransactionState.PENDING]: [TransactionState.APPROVED, TransactionState.REJECTED],
  [TransactionState.APPROVED]: [],
  [TransactionState.REJECTED]: [TransactionState.DRAFT],
};

export function canTransitionFrom(current: TransactionState): readonly TransactionState[] {
  return TRANSACTION_STATE_TRANSITIONS[current] ?? [];
}
