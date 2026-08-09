/**
 * OrganizationStatus Value Object Tests
 *
 * Tests the state machine transitions for OrganizationStatus VO.
 * @traceability DOC-012 BR-ORG-006, CANONICAL-DOMAIN-MODEL §VO-OrganizationStatus
 */

import {
  OrganizationStatus,
  assertValidOrganizationStatus,
  InvalidOrganizationStatusError,
  isValidStatusTransition,
} from '@/domains/organization/domain/value-objects/organization-status.vo';

describe('OrganizationStatus', () => {
  it('should define valid status values', () => {
    // Arrange & Act
    const validStatuses: OrganizationStatus[] = ['active', 'suspended', 'archived'];

    // Assert
    expect(Object.values(OrganizationStatus)).toEqual(expect.arrayContaining(validStatuses));
  });

  it('should assert valid status "active"', () => {
    // Arrange
    const status = 'active';

    // Act
    const result = assertValidOrganizationStatus(status);

    // Assert
    expect(result).toBe(OrganizationStatus.Active);
  });

  it('should assert valid status "suspended"', () => {
    // Arrange
    const status = 'suspended';

    // Act
    const result = assertValidOrganizationStatus(status);

    // Assert
    expect(result).toBe(OrganizationStatus.Suspended);
  });

  it('should assert valid status "archived"', () => {
    // Arrange
    const status = 'archived';

    // Act
    const result = assertValidOrganizationStatus(status);

    // Assert
    expect(result).toBe(OrganizationStatus.Archived);
  });

  it('should throw error for invalid status', () => {
    // Arrange
    const invalidStatus = 'deleted';

    // Act & Assert
    expect(() => assertValidOrganizationStatus(invalidStatus)).toThrow(InvalidOrganizationStatusError);
    expect(() => assertValidOrganizationStatus(invalidStatus)).toThrow(
      `Invalid organization status: "${invalidStatus}". Must be one of: active, suspended, archived`,
    );
  });

  it('should map enum members to their string values', () => {
    expect(OrganizationStatus.Active).toBe('active');
    expect(OrganizationStatus.Suspended).toBe('suspended');
    expect(OrganizationStatus.Archived).toBe('archived');
  });

  describe('State Machine Transitions (isValidStatusTransition)', () => {
    it('should allow transition from Active to Suspended', () => {
      const result = isValidStatusTransition(OrganizationStatus.Active, OrganizationStatus.Suspended);
      expect(result).toBe(true);
    });

    it('should allow transition from Active to Archived', () => {
      const result = isValidStatusTransition(OrganizationStatus.Active, OrganizationStatus.Archived);
      expect(result).toBe(true);
    });

    it('should NOT allow transition from Active to Active (no change)', () => {
      const result = isValidStatusTransition(OrganizationStatus.Active, OrganizationStatus.Active);
      expect(result).toBe(false);
    });

    it('should allow transition from Suspended to Archived', () => {
      const result = isValidStatusTransition(OrganizationStatus.Suspended, OrganizationStatus.Archived);
      expect(result).toBe(true);
    });

    it('should NOT allow transition from Suspended to Active (reversal)', () => {
      const result = isValidStatusTransition(OrganizationStatus.Suspended, OrganizationStatus.Active);
      expect(result).toBe(false);
    });

    it('should NOT allow transition from Suspended to Suspended (no change)', () => {
      const result = isValidStatusTransition(OrganizationStatus.Suspended, OrganizationStatus.Suspended);
      expect(result).toBe(false);
    });

    it('should NOT allow transition from Archived to any state (irreversible)', () => {
      const toActive = isValidStatusTransition(OrganizationStatus.Archived, OrganizationStatus.Active);
      const toSuspended = isValidStatusTransition(OrganizationStatus.Archived, OrganizationStatus.Suspended);
      const toArchived = isValidStatusTransition(OrganizationStatus.Archived, OrganizationStatus.Archived);

      expect(toActive).toBe(false);
      expect(toSuspended).toBe(false);
      expect(toArchived).toBe(false);
    });

    it('should NOT allow transition from any state to Suspended except from Active', () => {
      const fromActive = isValidStatusTransition(OrganizationStatus.Active, OrganizationStatus.Suspended);
      const fromSuspended = isValidStatusTransition(OrganizationStatus.Suspended, OrganizationStatus.Suspended);
      const fromArchived = isValidStatusTransition(OrganizationStatus.Archived, OrganizationStatus.Suspended);

      expect(fromActive).toBe(true);
      expect(fromSuspended).toBe(false);
      expect(fromArchived).toBe(false);
    });

    it('should NOT allow transition from any state to Archived except from Active or Suspended', () => {
      const fromActive = isValidStatusTransition(OrganizationStatus.Active, OrganizationStatus.Archived);
      const fromSuspended = isValidStatusTransition(OrganizationStatus.Suspended, OrganizationStatus.Archived);
      const fromArchived = isValidStatusTransition(OrganizationStatus.Archived, OrganizationStatus.Archived);

      expect(fromActive).toBe(true);
      expect(fromSuspended).toBe(true);
      expect(fromArchived).toBe(false);
    });
  });
});
