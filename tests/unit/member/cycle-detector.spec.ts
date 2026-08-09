/**
 * CycleDetector Tests
 *
 * Tests cycle detection algorithms for the member hierarchy DAG.
 * @traceability DOC-012 BR-REL-001, CycleDetector
 */

import { CycleDetector } from '@/domains/member/domain/services/cycle-detector.service';
import { OrgUnitLink } from '@/domains/member/domain/entities/org-unit-link.entity';

describe('CycleDetector', () => {
  describe('wouldCreateCycle', () => {
    it('should detect self-cycle (child = parent)', () => {
      const links: OrgUnitLink[] = [];
      const result = CycleDetector.wouldCreateCycle(links, 'unit-1', 'unit-1', 'org-1');
      expect(result).toBe(true);
    });

    it('should return false when adding link creates no cycle (positive)', () => {
      const links: OrgUnitLink[] = [
        { childOrgUnitUuid: 'child-1', parentOrgUnitUuid: 'parent-1', depthLevel: 1 } as any,
      ];

      const result = CycleDetector.wouldCreateCycle(links, 'grandchild-1', 'child-1', 'org-1');
      expect(result).toBe(false);
    });

    it('should detect cycle when parent is ancestor of child', () => {
      // Links: A <- B <- C (C is child of B, B is child of A)
      const links: OrgUnitLink[] = [
        { childOrgUnitUuid: 'B', parentOrgUnitUuid: 'A', depthLevel: 1 } as any,
        { childOrgUnitUuid: 'C', parentOrgUnitUuid: 'B', depthLevel: 2 } as any,
      ];

      // Trying to set A as parent of C would create cycle (C <- B <- A and now C <- A would make cycle)
      const result = CycleDetector.wouldCreateCycle(links, 'C', 'A', 'org-1');
      expect(result).toBe(true);
    });

    it('should not detect cycle for valid new link', () => {
      const links: OrgUnitLink[] = [
        { childOrgUnitUuid: 'B', parentOrgUnitUuid: 'A', depthLevel: 1 } as any,
      ];

      // Adding C as child of B is valid
      const result = CycleDetector.wouldCreateCycle(links, 'C', 'B', 'org-1');
      expect(result).toBe(false);
    });
  });

  describe('validateDag (Kahn\'s algorithm)', () => {
    it('should detect empty graph as acyclic', () => {
      const edges: { from: string; to: string }[] = [];
      const result = CycleDetector.validateDag(edges);
      expect(result).toBe(true);
    });

    it('should validate linear chain as acyclic', () => {
      // A <- B <- C (in graph terms: edge B->A, edge C->B)
      const edges = [
        { from: 'B', to: 'A' },
        { from: 'C', to: 'B' },
      ];
      const result = CycleDetector.validateDag(edges);
      expect(result).toBe(true);
    });

    it('should detect cycle in bidirectional link', () => {
      // A <- B and B <- A creates a cycle
      const edges = [
        { from: 'B', to: 'A' },
        { from: 'A', to: 'B' },
      ];
      const result = CycleDetector.validateDag(edges);
      expect(result).toBe(false);
    });

    it('should detect cycle in larger graph', () => {
      // A <- B <- C <- A (cycle of 3)
      const edges = [
        { from: 'B', to: 'A' },
        { from: 'C', to: 'B' },
        { from: 'A', to: 'C' },
      ];
      const result = CycleDetector.validateDag(edges);
      expect(result).toBe(false);
    });

    it('should validate tree structure as acyclic', () => {
      // Root A with children B, C; B has child D
      const edges = [
        { from: 'B', to: 'A' },
        { from: 'C', to: 'A' },
        { from: 'D', to: 'B' },
      ];
      const result = CycleDetector.validateDag(edges);
      expect(result).toBe(true);
    });
  });

  describe('_wouldReach (DFS behavior via wouldCreateCycle)', () => {
    it('should detect that a new parent is a transitive ancestor of the child', () => {
      // Links: B -> A (A is parent of B), C -> B (B is parent of C)
      const links: OrgUnitLink[] = [
        { childOrgUnitUuid: 'B', parentOrgUnitUuid: 'A', depthLevel: 1 } as any,
        { childOrgUnitUuid: 'C', parentOrgUnitUuid: 'B', depthLevel: 2 } as any,
      ];

      // Assigning A as parent of C would create the cycle C -> A -> ... -> C
      const result = CycleDetector.wouldCreateCycle(links, 'C', 'A', 'org-1');
      expect(result).toBe(true);
    });

    it('should not detect reachability when no path exists', () => {
      // Disconnected nodes: only B -> A exists
      const links: OrgUnitLink[] = [
        { childOrgUnitUuid: 'B', parentOrgUnitUuid: 'A', depthLevel: 1 } as any,
      ];

      // No path from D up to B, so D can safely become a child of B
      const result = CycleDetector.wouldCreateCycle(links, 'D', 'B', 'org-1');
      expect(result).toBe(false);
    });
  });
});
