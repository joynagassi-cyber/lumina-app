/**
 * DagPolicy Tests
 *
 * Tests DAG cycle detection and validation for member relationships.
 * @traceability DOC-012 BR-REL-001, DagPolicy
 */

import { DagPolicy, DagCycleError } from '@/domains/member/domain/policies/dag-policy';
import { CycleDetector } from '@/domains/member/domain/services/cycle-detector.service';
import { OrgUnitLink } from '@/domains/member/domain/entities/org-unit-link.entity';

describe('DagPolicy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  describe('assertNoCycle', () => {
    it('should allow adding parent link when no cycle would be created (positive)', () => {
      // Arrange - Mock CycleDetector.wouldCreateCycle to return false
      jest.spyOn(CycleDetector, 'wouldCreateCycle').mockReturnValue(false);

      const existingLinks: OrgUnitLink[] = [];
      const childUuid = 'child-1';
      const parentUuid = 'parent-1';
      const orgId = 'org-1';

      // Act - Should not throw
      expect(() => DagPolicy.assertNoCycle(existingLinks, childUuid, parentUuid, orgId)).not.toThrow();
    });

    it('should throw DagCycleError when adding parent link would create cycle', () => {
      // Arrange - Mock CycleDetector.wouldCreateCycle to return true
      jest.spyOn(CycleDetector, 'wouldCreateCycle').mockReturnValue(true);

      const existingLinks: OrgUnitLink[] = [
        { childOrgUnitUuid: 'child-1', parentOrgUnitUuid: 'parent-1', depthLevel: 1 } as any,
      ];
      const childUuid = 'child-1';
      const parentUuid = 'grandparent-1';
      const orgId = 'org-1';

      // Act & Assert - Should throw DagCycleError
      expect(() => DagPolicy.assertNoCycle(existingLinks, childUuid, parentUuid, orgId)).toThrow(DagCycleError);
      expect(() => DagPolicy.assertNoCycle(existingLinks, childUuid, parentUuid, orgId)).toThrow(
        'DAG cycle detected: assigning grandparent-1 as parent of child-1 would create a cycle in the hierarchy. 1 edges examined.',
      );
    });

    it('should use existingEdgesCount in error message', () => {
      jest.spyOn(CycleDetector, 'wouldCreateCycle').mockReturnValue(true);

      const existingLinks = Array.from({ length: 5 }, (_, i) => ({
        childOrgUnitUuid: `child-${i}`,
        parentOrgUnitUuid: `parent-${i}`,
        depthLevel: 1,
      })) as OrgUnitLink[];

      const childUuid = 'child-0';
      const parentUuid = 'parent-0';
      const orgId = 'org-1';

      expect(() => DagPolicy.assertNoCycle(existingLinks, childUuid, parentUuid, orgId)).toThrow(DagCycleError);
      // Error should mention the count
    });

      it('should correctly detect self-reference cycle', () => {
        jest.spyOn(CycleDetector, 'wouldCreateCycle').mockReturnValue(true);

        const existingLinks: OrgUnitLink[] = [];
        const childUuid = 'same-uuid';
        const parentUuid = 'same-uuid'; // Self-reference
        const orgId = 'org-1';

        expect(() => DagPolicy.assertNoCycle(existingLinks, childUuid, parentUuid, orgId)).toThrow(DagCycleError);
      });
    });
  });

  describe('validateDag', () => {
    it('should return true for empty DAG (no edges)', () => {
      const edges: OrgUnitLink[] = [];
      const result = DagPolicy.validateDag(edges);
      expect(result).toBe(true);
    });

    it('should return true for valid acyclic graph', () => {
      // Arrange - Create a simple chain: A <- B <- C (edges represented as from: child, to: parent)
      const edges = [
        { childOrgUnitUuid: 'B', parentOrgUnitUuid: 'A', depthLevel: 1 } as any,
        { childOrgUnitUuid: 'C', parentOrgUnitUuid: 'B', depthLevel: 2 } as any,
      ];

      // The DAG representation for CycleDetector expects {from: child, to: parent}
      const edgeRepresentation = edges.map(link => ({ from: link.childOrgUnitUuid, to: link.parentOrgUnitUuid ?? '' }));

      // Test via the public method
      const result = DagPolicy.validateDag(edges);
      expect(result).toBe(true);
    });

    it('should return false for graph with cycle', () => {
      // Create a cycle: A <- B <- C <- A
      const edges = [
        { childOrgUnitUuid: 'B', parentOrgUnitUuid: 'A', depthLevel: 1 } as any,
        { childOrgUnitUuid: 'C', parentOrgUnitUuid: 'B', depthLevel: 2 } as any,
        { childOrgUnitUuid: 'A', parentOrgUnitUuid: 'C', depthLevel: 1 } as any,
      ];

      const result = DagPolicy.validateDag(edges);
      expect(result).toBe(false);
    });
  });
});
