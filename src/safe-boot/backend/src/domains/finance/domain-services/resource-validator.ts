/**
 * ResourceValidator — type-specific business rules validation.
 * Validates that all BR-RES-XXX rules are satisfied before entity creation/modification.
 *
 * @traceability DOC-012 Aggregate3 (ResourceValidator domain service), BR-RES-001..BR-RES-008
 */

import { AmountInCents } from '../value-objects/amount-in-cents.vo';
import { TransactionState, TransactionType } from '../value-objects/transaction-state.vo';
import { ResourceScopeType } from '../value-objects/resource-scope.vo';
import { ImmutabilityPolicy } from '../domain-policies/immutability-policy';
import { ScopePolicy } from '../domain-policies/scope-policy';

export class ValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ResourceValidator {
  /** Validate a transaction record's preconditions before persistence. */
  static validateTransaction(input: {
    amount: AmountInCents;
    type: TransactionType;
    state: TransactionState;
    scopeType: ResourceScopeType;
    scopeTargetId: string | null;
    date: Date;
    categoryRef: string;
    createdBy: string;
  }): void {
    // BR-RES-001: amount always positive (enforced by AmountInCents constructor)
    // BR-RES-004: date not in the future
    if (input.date > new Date()) {
      throw new ValidationError('DATE_FUTURE', 'Transaction date cannot be in the future');
    }

    // BR-RES-005: scope_type must be 'org' or 'group'
    ScopePolicy.validateScopeType(input.scopeType);
    if (input.scopeType === ResourceScopeType.GROUP && !input.scopeTargetId) {
      ScopePolicy.assertGroupTargetPresent(input.scopeTargetId);
    }

    // BR-RES-007: created_by always set
    if (!input.createdBy) {
      throw new ValidationError('MISSING_CREATED_BY', 'createdBy is mandatory for all transactions');
    }

    // INV-006: category_ref must reference a vocabulary value (validated at DB FK level)
    if (!input.categoryRef) {
      throw new ValidationError('MISSING_CATEGORY', 'categoryRef is mandatory and must reference vocab_values');
    }
  }

  /** Validate state transition for transaction. */
  static validateTransactionTransition(
    currentState: TransactionState,
    newState: TransactionState,
  ): void {
    const allowedTransitions: Record<TransactionState, readonly TransactionState[]> = {
      draft: ['pending'],
      pending: ['approved', 'rejected'],
      approved: [],
      rejected: ['draft'],
    };
    const allowed = allowedTransitions[currentState];
    if (!allowed?.includes(newState)) {
      throw new ValidationError(
        'INVALID_TRANSITION',
        `Invalid state transition: ${currentState} -> ${newState}`,
      );
    }
  }

  /** Assert immutability for approved transactions. */
  static assertNotApproved(entity: { id: { toString(): string }; state: TransactionState }): void {
    ImmutabilityPolicy.assertMutable(entity);
  }

  /** Validate that a compensation reference points to an existing transaction. */
  static validateCompensationReference(
    compensatesForId: string | null,
    originalState: TransactionState,
  ): void {
    if (compensatesForId && originalState !== TransactionState.APPROVED) {
      throw new ValidationError(
        'COMPENSATION_STATE',
        'compensates_for can only reference approved transactions',
      );
    }
  }
}
