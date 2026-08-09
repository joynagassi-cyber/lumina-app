/**
 * MaxDepthPolicy Tests
 *
 * Tests validation of organizational unit depth constraints.
 * @traceability DOC-012 BR-ORG-002, REL-002
 */

import { MaxDepthPolicy, MaxDepthExceededError } from '@/domains/organization/domain/policies/max-depth-policy';
import { OrgUnit } from '@/domains/organization/domain/org-unit.entity';

// Mock OrgUnit with MAX_DEPTH constant
jest.mock('@/domains/organization/domain/org-unit.entity', () => ({
  OrgUnit: {
    MAX_DEPTH: 5,
  },
  OrgUnitType: {
    Organization: 'organization',
    Department: 'department',
    Group: 'group',
    Chorale: 'chorale',
    Cellule: 'cellule',
    Comite: 'comite',
    Commission: 'commission',
    Custom: 'custom',
  },
  OrgUnitStatus: {
    Active: 'active',
    Archived: 'archived',
  },
}));

describe('MaxDepthPolicy', () => {
  describe('validateDepth', () => {
    it('should accept depth within bounds (1-5)', () => {
      // Arrange
      const unit = {
        id: 'unit-1',
        depthLevel: 3,
      } as unknown as OrgUnit;

      // Act - Should not throw
      expect(() => MaxDepthPolicy.validateDepth(unit)).not.toThrow();
    });

    it('should reject depth below minimum (0)', () => {
      // Arrange
      const unit = {
        id: 'unit-1',
        depthLevel: 0,
      } as unknown as OrgUnit;

      // Act & Assert
      expect(() => MaxDepthPolicy.validateDepth(unit)).toThrow(MaxDepthExceededError);
      expect(() => MaxDepthPolicy.validateDepth(unit)).toThrow('Organization unit \'unit-1\' at depth 0 exceeds maximum allowed depth of 5.');
    });

    it('should reject depth below minimum (-1)', () => {
      // Arrange
      const unit = {
        id: 'unit-1',
        depthLevel: -1,
      } as unknown as OrgUnit;

      // Act & Assert
      expect(() => MaxDepthPolicy.validateDepth(unit)).toThrow(MaxDepthExceededError);
    });

    it('should reject depth above maximum (6)', () => {
      // Arrange
      const unit = {
        id: 'unit-1',
        depthLevel: 6,
      } as unknown as OrgUnit;

      // Act & Assert
      expect(() => MaxDepthPolicy.validateDepth(unit)).toThrow(MaxDepthExceededError);
      expect(() => MaxDepthPolicy.validateDepth(unit)).toThrow('Organization unit \'unit-1\' at depth 6 exceeds maximum allowed depth of 5.');
    });

    it('should reject depth exactly at maximum (5)', () => {
      // Arrange - MAX_DEPTH is 5, so depth 5 should be valid
      const unit = {
        id: 'unit-1',
        depthLevel: 5,
      } as unknown as OrgUnit;

      // Act - Should not throw
      expect(() => MaxDepthPolicy.validateDepth(unit)).not.toThrow();
    });

    it('should accept depth exactly at minimum (1)', () => {
      // Arrange
      const unit = {
        id: 'unit-1',
        depthLevel: 1,
      } as unknown as OrgUnit;

      // Act - Should not throw
      expect(() => MaxDepthPolicy.validateDepth(unit)).not.toThrow();
    });
  });

  describe('isChildDepthValid', () => {
    it('should allow child when parentDepth + 1 <= MAX_DEPTH', () => {
      // Arrange
      const parentDepth = 4; // MAX_DEPTH = 5, so 4+1=5 is valid

      // Act
      const result = MaxDepthPolicy.isChildDepthValid(parentDepth);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject child when parentDepth + 1 > MAX_DEPTH', () => {
      // Arrange
      const parentDepth = 5; // MAX_DEPTH = 5, so 5+1=6 exceeds

      // Act
      const result = MaxDepthPolicy.isChildDepthValid(parentDepth);

      // Assert
      expect(result).toBe(false);
    });

    it('should allow child at depth 1 (top level)', () => {
      // Arrange
      const parentDepth = 0; // For top-level creation (parentId = null)

      // Act
      const result = MaxDepthPolicy.isChildDepthValid(parentDepth);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject child when parent is at max depth', () => {
      // Arrange
      const parentDepth = 5;

      // Act
      const result = MaxDepthPolicy.isChildDepthValid(parentDepth);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when parentDepth is negative', () => {
      // Arrange
      const parentDepth = -1;

      // Act
      const result = MaxDepthPolicy.isChildDepthValid(parentDepth);

      // Assert
      expect(result).toBe(false);
    });
  });
});
