/**
 * HierarchyPolicy Tests
 *
 * Tests validation of organizational hierarchy constraints (no cycles, no self-parent, max depth).
 * @traceability DOC-012 BR-ORG-003, REL-001, REL-002
 */

import { HierarchyPolicy, HierarchyValidationError } from '@/domains/organization/domain/policies/hierarchy-policy';
import {
  CycleDetectedError,
  DepthExceededError,
  OrgUnitAlreadyOwnChildError,
  OrgUnitHierarchyResolver,
  type OrgHierarchyEdge,
} from '@/domains/organization/domain/services/org-hierarchy-resolver.service';

jest.mock('@/domains/organization/domain/services/org-hierarchy-resolver.service', () => ({
  OrgUnitHierarchyResolver: {
    validateNoCycles: jest.fn(),
    computeDepth: jest.fn(),
    isDescendantOrSelf: jest.fn(),
    MAX_DEPTH: 5,
  },
  CycleDetectedError: class extends Error {},
  DepthExceededError: class extends Error {},
  OrgUnitAlreadyOwnChildError: class extends Error {},
}));

describe('HierarchyPolicy', () => {
  describe('validate', () => {
    it('should allow valid hierarchy edge (child under parent, no cycle)', () => {
      // Arrange
      const existingEdges: OrgHierarchyEdge[] = [];
      const proposedEdges: OrgHierarchyEdge[] = [{ childId: 'child-1', parentId: 'parent-1' }];
      const lookupFn = jest.fn((id) => {
        if (id === 'child-1') return 'parent-1';
        if (id === 'parent-1') return null;
        return null;
      });

      // Mock dependencies
      (OrgUnitHierarchyResolver as any).isDescendantOrSelf.mockReturnValue(false);
      (OrgUnitHierarchyResolver as any).validateNoCycles.mockImplementation(() => {});
      (OrgUnitHierarchyResolver as any).computeDepth.mockImplementation(() => 1);

      // Act - Should not throw
      expect(() => HierarchyPolicy.validate(existingEdges, proposedEdges, lookupFn)).not.toThrow();
    });

    it('should reject when child is own parent (self-loop)', () => {
      // Arrange
      const existingEdges: OrgHierarchyEdge[] = [];
      const proposedEdges: OrgHierarchyEdge[] = [{ childId: 'unit-1', parentId: 'unit-1' }];
      const lookupFn = jest.fn(() => null);

      // Act & Assert - Should throw OrgUnitAlreadyOwnChildError
      expect(() => HierarchyPolicy.validate(existingEdges, proposedEdges, lookupFn)).toThrow(OrgUnitAlreadyOwnChildError);
    });

    it('should detect cycle when proposed edge creates circular reference', () => {
      // Arrange
      const existingEdges: OrgHierarchyEdge[] = [{ childId: 'b', parentId: 'a' }];
      const proposedEdges: OrgHierarchyEdge[] = [{ childId: 'a', parentId: 'b' }];
      const lookupFn = jest.fn((id) => {
        if (id === 'a') return 'b';
        if (id === 'b') return 'a';
        return null;
      });

      // Mock isDescendantOrSelf to allow (no self-ancestor), and validateNoCycles to detect the cycle
      (OrgUnitHierarchyResolver as any).isDescendantOrSelf.mockReturnValue(false);
      (OrgUnitHierarchyResolver as any).validateNoCycles.mockImplementation(() => {
        throw new CycleDetectedError(['a', 'b']);
      });

      // Act & Assert - Should throw HierarchyValidationError wrapping CycleDetectedError
      expect(() => HierarchyPolicy.validate(existingEdges, proposedEdges, lookupFn)).toThrow(HierarchyValidationError);
    });

    it('should throw when proposed edge creates self-reference via ancestor', () => {
      // Arrange
      const existingEdges: OrgHierarchyEdge[] = [{ childId: 'c', parentId: 'b' }, { childId: 'b', parentId: 'a' }];
      const proposedEdges: OrgHierarchyEdge[] = [{ childId: 'a', parentId: 'c' }];
      const lookupFn = jest.fn((id) => {
        if (id === 'a') return 'c';
        if (id === 'c') return 'b';
        if (id === 'b') return 'a';
        return null;
      });

      // Mock isDescendantOrSelf to detect self-reference
      (OrgUnitHierarchyResolver as any).isDescendantOrSelf.mockReturnValue(true);
      (OrgUnitHierarchyResolver as any).validateNoCycles.mockImplementation(() => {});

      // Act & Assert - Should throw OrgUnitAlreadyOwnChildError
      expect(() => HierarchyPolicy.validate(existingEdges, proposedEdges, lookupFn)).toThrow(OrgUnitAlreadyOwnChildError);
    });

    it('should detect depth exceeded when creating child at max depth', () => {
      // Arrange
      const existingEdges: OrgHierarchyEdge[] = [
        { childId: 'l1', parentId: null },
        { childId: 'l2', parentId: 'l1' },
        { childId: 'l3', parentId: 'l2' },
        { childId: 'l4', parentId: 'l3' },
        { childId: 'l5', parentId: 'l4' },
      ];
      const proposedEdges: OrgHierarchyEdge[] = [{ childId: 'l6', parentId: 'l5' }];
      const lookupFn = jest.fn((id) => {
        if (id === 'l6') return 'l5';
        if (id === 'l5') return 'l4';
        if (id === 'l4') return 'l3';
        if (id === 'l3') return 'l2';
        if (id === 'l2') return 'l1';
        if (id === 'l1') return null;
        return null;
      });

      // Mock computeDepth to throw DepthExceededError
      (OrgUnitHierarchyResolver as any).computeDepth.mockImplementation(() => {
        throw new DepthExceededError('l6', 6);
      });
      (OrgUnitHierarchyResolver as any).isDescendantOrSelf.mockReturnValue(false);
      (OrgUnitHierarchyResolver as any).validateNoCycles.mockImplementation(() => {});

      // Act & Assert - Should throw HierarchyValidationError wrapping DepthExceededError
      expect(() => HierarchyPolicy.validate(existingEdges, proposedEdges, lookupFn)).toThrow(HierarchyValidationError);
    });

    it('should throw HierarchyValidationError when validateNoCycles throws CycleDetectedError', () => {
      // Arrange
      const existingEdges: OrgHierarchyEdge[] = [];
      const proposedEdges: OrgHierarchyEdge[] = [{ childId: 'a', parentId: 'b' }];
      const lookupFn = jest.fn(() => null);

      const cycleError = new CycleDetectedError(['a', 'b']);
      (OrgUnitHierarchyResolver as any).validateNoCycles.mockImplementation(() => {
        throw cycleError;
      });
      (OrgUnitHierarchyResolver as any).isDescendantOrSelf.mockReturnValue(false);
      (OrgUnitHierarchyResolver as any).computeDepth.mockImplementation(() => 1);

      // Act & Assert - Should throw HierarchyValidationError
      expect(() => HierarchyPolicy.validate(existingEdges, proposedEdges, lookupFn)).toThrow(HierarchyValidationError);
    });
  });
});
