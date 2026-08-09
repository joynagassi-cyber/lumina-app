/**
 * MaxDepthPolicy Tests (Member Aggregate)
 *
 * Tests depth validation for org unit hierarchy in member aggregate.
 * @traceability DOC-012 BR-REL-002, MaxDepthPolicy
 */

import { MaxDepthPolicy, MaxDepthExceededError } from '@/domains/member/domain/policies/max-depth-policy';

describe('MaxDepthPolicy (Member)', () => {
  it('should define MAX_DEPTH as 5', () => {
    expect(MaxDepthPolicy.MAX_DEPTH).toBe(5);
  });

  describe('assertValidDepth', () => {
    it('should accept valid depths (1-5)', () => {
      expect(() => MaxDepthPolicy.assertValidDepth(1, 'unit-1')).not.toThrow();
      expect(() => MaxDepthPolicy.assertValidDepth(3, 'unit-1')).not.toThrow();
      expect(() => MaxDepthPolicy.assertValidDepth(5, 'unit-1')).not.toThrow();
    });

    it('should reject depth less than 1', () => {
      expect(() => MaxDepthPolicy.assertValidDepth(0, 'unit-1')).toThrow(MaxDepthExceededError);
      expect(() => MaxDepthPolicy.assertValidDepth(-1, 'unit-1')).toThrow(MaxDepthExceededError);
    });

    it('should reject depth greater than MAX_DEPTH', () => {
      expect(() => MaxDepthPolicy.assertValidDepth(6, 'unit-1')).toThrow(MaxDepthExceededError);
      expect(() => MaxDepthPolicy.assertValidDepth(10, 'unit-1')).toThrow(MaxDepthExceededError);
    });

    it('should include org unit uuid and depth in error message', () => {
      try {
        MaxDepthPolicy.assertValidDepth(6, 'my-unit-123');
      } catch (err) {
        expect(err).toBeInstanceOf(MaxDepthExceededError);
        const maxDepthErr = err as MaxDepthExceededError;
        expect(maxDepthErr.orgUnitUuid).toBe('my-unit-123');
        expect(maxDepthErr.attemptedDepth).toBe(6);
        expect(maxDepthErr.maxDepth).toBe(5);
      }
    });
  });

  describe('computeChildDepth', () => {
    it('should compute child depth correctly when parent is within limits', () => {
      const result = MaxDepthPolicy.computeChildDepth(3, 'child-1');
      expect(result).toBe(4);
    });

    it('should throw when child would exceed max depth', () => {
      expect(() => MaxDepthPolicy.computeChildDepth(5, 'child-1')).toThrow(MaxDepthExceededError);
    });

    it('should allow child of root (parentDepth 0)', () => {
      // Parent depth 0 means top-level, so child depth = 1
      const result = MaxDepthPolicy.computeChildDepth(0, 'child-1');
      expect(result).toBe(1);
    });
  });

  describe('canHaveChildren', () => {
    it('should return true if parent can have children (depth < MAX_DEPTH)', () => {
      expect(MaxDepthPolicy.canHaveChildren(1)).toBe(true);
      expect(MaxDepthPolicy.canHaveChildren(4)).toBe(true);
      expect(MaxDepthPolicy.canHaveChildren(0)).toBe(true);
    });

    it('should return false if parent is at max depth', () => {
      expect(MaxDepthPolicy.canHaveChildren(5)).toBe(false);
      expect(MaxDepthPolicy.canHaveChildren(6)).toBe(false);
    });
  });

  describe('remainingDepth', () => {
    it('should calculate remaining depth correctly', () => {
      expect(MaxDepthPolicy.remainingDepth(1)).toBe(4);
      expect(MaxDepthPolicy.remainingDepth(3)).toBe(2);
      expect(MaxDepthPolicy.remainingDepth(5)).toBe(0);
      expect(MaxDepthPolicy.remainingDepth(0)).toBe(5);
    });

    it('should clamp negative depth back to the full budget', () => {
      expect(MaxDepthPolicy.remainingDepth(-1)).toBe(5);
    });
  });
});
