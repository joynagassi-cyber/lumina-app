/**
 * VersioningPolicy Tests
 *
 * Tests optimistic locking and version increment logic.
 * @traceability DOC-012 INV-010, BR-RES-003, VersioningPolicy
 */

import { VersioningPolicy, VersionConflictError } from '@/domains/finance/domain-policies/versioning-policy';

describe('VersioningPolicy', () => {
  describe('validate', () => {
    it('should allow when expected version matches actual version', () => {
      // Arrange & Act - Should not throw
      expect(() => VersioningPolicy.validate(5, 5)).not.toThrow();
    });

    it('should throw when expected version differs from actual version (conflict)', () => {
      // Arrange & Assert - Should throw VersionConflictError
      expect(() => VersioningPolicy.validate(5, 6)).toThrow(VersionConflictError);
      expect(() => VersioningPolicy.validate(5, 6)).toThrowError(
        'VersioningPolicy: optimistic lock conflict — expected v5, got v6',
      );
    });

    it('should throw error with correct expected and actual values', () => {
      expect(() => VersioningPolicy.validate(10, 3)).toThrowError(
        'VersioningPolicy: optimistic lock conflict — expected v10, got v3',
      );
    });
  });

  describe('nextVersion', () => {
    it('should increment version by 1', () => {
      const next = VersioningPolicy.nextVersion(1);
      expect(next).toBe(2);
    });

    it('should handle multiple increments', () => {
      let version = 1;
      version = VersioningPolicy.nextVersion(version); // 2
      version = VersioningPolicy.nextVersion(version); // 3
      version = VersioningPolicy.nextVersion(version); // 4
      expect(version).toBe(4);
    });

    it('should work with zero start version', () => {
      const next = VersioningPolicy.nextVersion(0);
      expect(next).toBe(1);
    });

    it('should handle large version numbers', () => {
      const next = VersioningPolicy.nextVersion(999999);
      expect(next).toBe(1000000);
    });
  });
});
