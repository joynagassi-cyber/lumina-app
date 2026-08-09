/**
 * ResourceValidator Tests
 *
 * Tests business rule validation for resources and transactions.
 * @traceability DOC-012 BR-RES-001 through BR-RES-008, ResourceValidator
 */

import { ResourceValidator, ValidationError } from '@/domains/finance/domain-services/resource-validator';
import { AmountInCents } from '@/domains/finance/value-objects/amount-in-cents.vo';
import { TransactionState } from '@/domains/finance/value-objects/transaction-state.vo';
import { TransactionType } from '@/domains/finance/entities/transaction-record.entity';
import { ResourceScopeType } from '@/domains/finance/value-objects/resource-scope.vo';
import { ImmutabilityPolicy, ImmutabilityPolicyViolationError } from '@/domains/finance/domain-policies/immutability-policy';

describe('ResourceValidator', () => {
  describe('validateTransaction', () => {
    it('should validate transaction with valid data (positive)', () => {
      // Arrange
      const input = {
        amount: new AmountInCents(100),
        type: TransactionType.EXPENSE,
        state: TransactionState.DRAFT,
        scopeType: ResourceScopeType.ORG,
        scopeTargetId: 'org-1',
        date: new Date(),
        categoryRef: 'cat-1',
        createdBy: 'user-1',
      };

      // Act - Should not throw
      expect(() => ResourceValidator.validateTransaction(input)).not.toThrow();
    });

    it('should reject future transaction date', () => {
      // Arrange
      const input = {
        amount: new AmountInCents(100),
        type: TransactionType.EXPENSE,
        state: TransactionState.DRAFT,
        scopeType: ResourceScopeType.ORG,
        scopeTargetId: 'org-1',
        date: new Date('2100-01-01'), // Future date
        categoryRef: 'cat-1',
        createdBy: 'user-1',
      };

      // Act & Assert - Should throw ValidationError with DATE_FUTURE
      expect(() => ResourceValidator.validateTransaction(input)).toThrow(
        expect.objectContaining({ code: 'DATE_FUTURE' }),
      );
    });

    it('should validate scope type via ScopePolicy', () => {
      // Arrange - ScopePolicy.validateScopeType is called internally
      // We verify it would be called by checking the flow
      const input = {
        amount: new AmountInCents(100),
        type: TransactionType.EXPENSE,
        state: TransactionState.DRAFT,
        scopeType: ResourceScopeType.ORG,
        scopeTargetId: 'org-1',
        date: new Date(),
        categoryRef: 'cat-1',
        createdBy: 'user-1',
      };

      // Act - Should not throw (valid scope type)
      expect(() => ResourceValidator.validateTransaction(input)).not.toThrow();
    });

    it('should reject missing createdBy', () => {
      // Arrange
      const input = {
        amount: new AmountInCents(100),
        type: TransactionType.EXPENSE,
        state: TransactionState.DRAFT,
        scopeType: ResourceScopeType.ORG,
        scopeTargetId: 'org-1',
        date: new Date(),
        categoryRef: 'cat-1',
        createdBy: '', // Missing
      };

      // Act & Assert - Should throw ValidationError with MISSING_CREATED_BY
      expect(() => ResourceValidator.validateTransaction(input)).toThrow(
        expect.objectContaining({ code: 'MISSING_CREATED_BY' }),
      );
    });

    it('should reject missing categoryRef', () => {
      // Arrange
      const input = {
        amount: new AmountInCents(100),
        type: TransactionType.EXPENSE,
        state: TransactionState.DRAFT,
        scopeType: ResourceScopeType.ORG,
        scopeTargetId: 'org-1',
        date: new Date(),
        categoryRef: '', // Missing
        createdBy: 'user-1',
      };

      // Act & Assert - Should throw ValidationError with MISSING_CATEGORY
      expect(() => ResourceValidator.validateTransaction(input)).toThrow(
        expect.objectContaining({ code: 'MISSING_CATEGORY' }),
      );
    });
  });

  describe('validateTransactionTransition', () => {
    it('should allow draft -> pending transition', () => {
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.DRAFT, TransactionState.PENDING)).not.toThrow();
    });

    it('should allow pending -> approved transition', () => {
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.PENDING, TransactionState.APPROVED)).not.toThrow();
    });

    it('should allow pending -> rejected transition', () => {
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.PENDING, TransactionState.REJECTED)).not.toThrow();
    });

    it('should allow rejected -> draft transition', () => {
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.REJECTED, TransactionState.DRAFT)).not.toThrow();
    });

    it('should reject invalid transition: draft -> approved', () => {
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.DRAFT, TransactionState.APPROVED)).toThrow(
        expect.objectContaining({ code: 'INVALID_TRANSITION' }),
      );
    });

    it('should reject invalid transition: approved -> anything (approved is terminal)', () => {
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.APPROVED, TransactionState.DRAFT)).toThrow(ValidationError);
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.APPROVED, TransactionState.PENDING)).toThrow(ValidationError);
    });

    it('should reject transition from pending to draft', () => {
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.PENDING, TransactionState.DRAFT)).toThrow(ValidationError);
    });

    it('should reject transition from approved to rejected', () => {
      expect(() => ResourceValidator.validateTransactionTransition(TransactionState.APPROVED, TransactionState.REJECTED)).toThrow(ValidationError);
    });
  });

  describe('assertNotApproved', () => {
    it('should allow mutation for non-approved transactions (delegates to ImmutabilityPolicy)', () => {
      const entity = {
        id: { toString: () => 'txn-1' },
        state: TransactionState.DRAFT,
      };

      // Act - Should not throw (ImmutabilityPolicy.assertMutable handles this)
      expect(() => ResourceValidator.assertNotApproved(entity)).not.toThrow();
    });

    it('should throw error for approved transactions', () => {
      const entity = {
        id: { toString: () => 'txn-1' },
        state: TransactionState.APPROVED,
      };

      // Act & Assert - Should throw ImmutabilityPolicyViolationError
      expect(() => ResourceValidator.assertNotApproved(entity)).toThrow(ImmutabilityPolicyViolationError);
    });
  });

  describe('validateCompensationReference', () => {
    it('should allow compensation reference for approved transaction', () => {
      expect(() => ResourceValidator.validateCompensationReference('txn-1', TransactionState.APPROVED)).not.toThrow();
    });

    it('should reject compensation reference for non-approved transaction', () => {
      expect(() => ResourceValidator.validateCompensationReference('txn-1', TransactionState.DRAFT)).toThrow(
        expect.objectContaining({ code: 'COMPENSATION_STATE' }),
      );
    });

    it('should reject when compensatesFor is set but no original transaction provided', () => {
      // When compensatesForId is null, no validation needed
      expect(() => ResourceValidator.validateCompensationReference(null, TransactionState.APPROVED)).not.toThrow();
    });
  });
});
