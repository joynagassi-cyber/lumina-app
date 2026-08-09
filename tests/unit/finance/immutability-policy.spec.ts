/**
 * ImmutabilityPolicy Tests
 *
 * Tests that approved transactions cannot be modified directly.
 * @traceability DOC-012 BR-RES-002, INV-001, ImmutabilityPolicy
 */

import { ImmutabilityPolicy, ImmutabilityPolicyViolationError } from '@/domains/finance/domain-policies/immutability-policy';
import { TransactionState } from '@/domains/finance/value-objects/transaction-state.vo';

describe('ImmutabilityPolicy', () => {
  describe('assertMutable', () => {
    it('should allow mutation for draft transactions', () => {
      // Arrange
      const transaction = {
        id: { toString: () => 'txn-1' },
        state: TransactionState.DRAFT,
      };

      // Act - Should not throw
      expect(() => ImmutabilityPolicy.assertMutable(transaction)).not.toThrow();
    });

    it('should allow mutation for pending transactions', () => {
      // Arrange
      const transaction = {
        id: { toString: () => 'txn-1' },
        state: TransactionState.PENDING,
      };

      // Act - Should not throw
      expect(() => ImmutabilityPolicy.assertMutable(transaction)).not.toThrow();
    });

    it('should allow mutation for rejected transactions', () => {
      // Arrange
      const transaction = {
        id: { toString: () => 'txn-1' },
        state: TransactionState.REJECTED,
      };

      // Act - Should not throw
      expect(() => ImmutabilityPolicy.assertMutable(transaction)).not.toThrow();
    });

    it('should throw error for approved transactions (cannot modify)', () => {
      // Arrange
      const transaction = {
        id: { toString: () => 'txn-1' },
        state: TransactionState.APPROVED,
      };

      // Act & Assert - Should throw ImmutabilityPolicyViolationError
      expect(() => ImmutabilityPolicy.assertMutable(transaction)).toThrow(ImmutabilityPolicyViolationError);
      expect(() => ImmutabilityPolicy.assertMutable(transaction)).toThrowError(
        'cannot modify approved transaction txn-1 — use compensation instead (INV-001)',
      );
    });

    it('should include transaction id in error message', () => {
      // Arrange
      const transaction = {
        id: { toString: () => 'special-txn-123' },
        state: TransactionState.APPROVED,
      };

      // Act & Assert
      expect(() => ImmutabilityPolicy.assertMutable(transaction)).toThrowError(
        /special-txn-123/,
      );
    });
  });

  describe('requiresCompensation', () => {
    it('should return true for approved state', () => {
      const result = ImmutabilityPolicy.requiresCompensation(TransactionState.APPROVED);
      expect(result).toBe(true);
    });

    it('should return false for draft state', () => {
      const result = ImmutabilityPolicy.requiresCompensation(TransactionState.DRAFT);
      expect(result).toBe(false);
    });

    it('should return false for pending state', () => {
      const result = ImmutabilityPolicy.requiresCompensation(TransactionState.PENDING);
      expect(result).toBe(false);
    });

    it('should return false for rejected state', () => {
      const result = ImmutabilityPolicy.requiresCompensation(TransactionState.REJECTED);
      expect(result).toBe(false);
    });
  });
});
