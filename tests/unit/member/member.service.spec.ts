/**
 * MemberService Unit Tests — Positive Cases
 *
 * Tests member relationship operations: addMemberToGroup, removeMemberFromGroup,
 * changeOrgUnitParent, transferChildOrg, mergeChildOrg, enumerateDescendants.
 * @traceability DOC-012 ASS-001 Service 4, BR-REL-001 through BR-REL-004
 */

import { MemberService, type MemberCommandResult } from '@/domains/member/application/member.service';
import { GroupMembership } from '@/domains/member/domain/entities/group-membership.entity';
import { OrgUnitLink } from '@/domains/member/domain/entities/org-unit-link.entity';
import { DescendantEnumerator, type DescendantNode } from '@/domains/member/domain/services/descendant-enumerator.service';
import { CycleDetector } from '@/domains/member/domain/services/cycle-detector.service';
import { DagPolicy, DagCycleError } from '@/domains/member/domain/policies/dag-policy';
import { MaxDepthPolicy } from '@/domains/member/domain/policies/max-depth-policy';
import { MultiMembershipPolicy } from '@/domains/member/domain/policies/multi-membership-policy';

// Mock repositories
class MockGroupMembershipRepo {
  findByMemberId = jest.fn().mockResolvedValue([]);
  exists = jest.fn().mockResolvedValue(false);
  create = jest.fn().mockResolvedValue({ id: 'gm-1' } as any);
  listByGroup = jest.fn().mockResolvedValue([]);
  findById = jest.fn().mockResolvedValue(null);
  update = jest.fn().mockResolvedValue(undefined);
}

class MockOrgUnitLinkRepo {
  listByOrg = jest.fn().mockResolvedValue([]);
  findParent = jest.fn().mockResolvedValue(null);
  updateParent = jest.fn().mockResolvedValue({ id: 'link-1' } as any);
}

describe('MemberService', () => {
  let service: MemberService;
  let groupRepoMock: MockGroupMembershipRepo;
  let orgLinkRepoMock: MockOrgUnitLinkRepo;

  beforeEach(() => {
    groupRepoMock = new MockGroupMembershipRepo();
    orgLinkRepoMock = new MockOrgUnitLinkRepo();

    service = new MemberService(
      groupRepoMock as any,
      orgLinkRepoMock as any,
      [],
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ======================================================================
  // addMemberToGroup
  // ======================================================================
  describe('addMemberToGroup', () => {
    it('should add member to group successfully (positive)', async () => {
      // Arrange
      groupRepoMock.findByMemberId.mockResolvedValue([]); // No existing memberships
      groupRepoMock.exists.mockResolvedValue(false); // No duplicate

      // Act
      const result = await service.addMemberToGroup('member-1', 'group-1', 'org-1');

      // Assert
      expect(result).toBeTruthy();
      expect(groupRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          memberUuid: 'member-1',
          groupOrgUnitUuid: 'group-1',
          orgId: 'org-1',
        }),
      );
    });

    it('should reject when member already belongs to group', async () => {
      // Arrange
      groupRepoMock.exists.mockResolvedValue(true);

      // Act & Assert
      await expect(
        service.addMemberToGroup('member-1', 'group-1', 'org-1'),
      ).rejects.toThrow(/member-1 already belongs to group group-1/);
    });

    it('should enforce multi-membership limit', async () => {
      // Arrange
      groupRepoMock.findByMemberId.mockResolvedValue([{ id: 'gm-1' } as any]); // Already has 1 membership
      jest.spyOn(MultiMembershipPolicy, 'assertCanJoin').mockImplementation(() => {
        throw new Error('Multi-membership limit exceeded');
      });

      // Act & Assert
      await expect(
        service.addMemberToGroup('member-1', 'group-1', 'org-1'),
      ).rejects.toThrow('Multi-membership limit exceeded');
    });
  });

  // ======================================================================
  // removeMemberFromGroup
  // ======================================================================
  describe('removeMemberFromGroup', () => {
    it('should remove member from group successfully (positive)', async () => {
      // Arrange
      const mockMembership = {
        id: 'gm-1',
        groupOrgUnitUuid: 'group-1',
        isActive: () => true,
        leave: jest.fn().mockReturnValue({ departureDate: new Date(), updatedAt: new Date(), orgId: 'org-1' }),
      };

      groupRepoMock.findByMemberId.mockResolvedValue([mockMembership]);
      groupRepoMock.update.mockResolvedValue(undefined);

      // Act
      const result = await service.removeMemberFromGroup('member-1', 'group-1');

      // Assert
      expect(result.success).toBe(true);
      expect(groupRepoMock.update).toHaveBeenCalledWith(mockMembership.id, expect.objectContaining({ departureDate: expect.any(Date) }));
    });

    it('should return failure when no active membership found', async () => {
      // Arrange
      const mockMembership = {
        id: 'gm-1',
        groupOrgUnitUuid: 'different-group',
        isActive: () => true,
      };

      groupRepoMock.findByMemberId.mockResolvedValue([mockMembership]);

      // Act
      const result = await service.removeMemberFromGroup('member-1', 'group-1');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('No active membership found');
    });

    it('should skip removal when membership is inactive', async () => {
      // Arrange
      const mockMembership = {
        id: 'gm-1',
        groupOrgUnitUuid: 'group-1',
        isActive: () => false, // Already inactive
      };

      groupRepoMock.findByMemberId.mockResolvedValue([mockMembership]);

      // Act
      const result = await service.removeMemberFromGroup('member-1', 'group-1');

      // Assert
      expect(result.success).toBe(false);
    });
  });

  // ======================================================================
  // changeOrgUnitParent
  // ======================================================================
  describe('changeOrgUnitParent', () => {
    it('should change org unit parent successfully (positive)', async () => {
      // Arrange
      orgLinkRepoMock.listByOrg.mockResolvedValue([]); // No existing links
      jest.spyOn(DagPolicy, 'assertNoCycle').mockImplementation(() => {});
      jest.spyOn(MaxDepthPolicy, 'computeChildDepth').mockReturnValue(2);
      jest.spyOn(MaxDepthPolicy, 'assertValidDepth').mockImplementation(() => {});
      orgLinkRepoMock.findParent.mockResolvedValue({ parentOrgUnitUuid: 'old-parent', depthLevel: 1 } as any);
      orgLinkRepoMock.updateParent.mockResolvedValue({ id: 'link-1' } as any);

      // Act
      const result = await service.changeOrgUnitParent('child-1', 'new-parent-1', 'org-1');

      // Assert
      expect(result).toBeTruthy();
      expect(orgLinkRepoMock.updateParent).toHaveBeenCalledWith('child-1', 'new-parent-1');
    });

    it('should set parent to null (top level) successfully', async () => {
      // Arrange
      orgLinkRepoMock.listByOrg.mockResolvedValue([]);
      jest.spyOn(DagPolicy, 'assertNoCycle').mockImplementation(() => {});
      jest.spyOn(MaxDepthPolicy, 'assertValidDepth').mockImplementation(() => {});
      orgLinkRepoMock.findParent.mockResolvedValue({ parentOrgUnitUuid: 'old-parent', depthLevel: 1 } as any);
      orgLinkRepoMock.updateParent.mockResolvedValue({ id: 'link-1' } as any);

      // Act
      const result = await service.changeOrgUnitParent('child-1', null, 'org-1');

      // Assert
      expect(result).toBeTruthy();
    });

    it('should throw when cycle detection fails', async () => {
      // Arrange
      orgLinkRepoMock.listByOrg.mockResolvedValue([]);
      jest.spyOn(DagPolicy, 'assertNoCycle').mockImplementation(() => {
        throw new DagCycleError('child', 'parent', 0);
      });

      // Act & Assert
      await expect(
        service.changeOrgUnitParent('child-1', 'parent-1', 'org-1'),
      ).rejects.toThrow(DagCycleError);
    });
  });

  // ======================================================================
  // transferChildOrg
  // ======================================================================
  describe('transferChildOrg', () => {
    it('should transfer child org while preserving memberships (positive)', async () => {
      // Arrange
      orgLinkRepoMock.listByOrg.mockResolvedValue([]);
      jest.spyOn(DagPolicy, 'assertNoCycle').mockImplementation(() => {});
      orgLinkRepoMock.findParent.mockResolvedValue({ parentOrgUnitUuid: 'sibling-parent', depthLevel: 1 } as any);
      orgLinkRepoMock.updateParent.mockResolvedValue({ id: 'link-1' } as any);
      jest.spyOn(DescendantEnumerator, 'enumerate').mockReturnValue([]);
      groupRepoMock.listByGroup.mockResolvedValue([]);

      // Act
      const result = await service.transferChildOrg('child-1', 'sibling-1', 'org-1');

      expect(result).toBeTruthy();
      expect(orgLinkRepoMock.updateParent).toHaveBeenCalledWith('child-1', 'sibling-parent');
    });
  });

  // ======================================================================
  // mergeChildOrg
  // ======================================================================
  describe('mergeChildOrg', () => {
    it('should merge child org successfully (positive)', async () => {
      // Arrange
      orgLinkRepoMock.listByOrg.mockResolvedValue([]);
      jest.spyOn(DagPolicy, 'assertNoCycle').mockImplementation(() => {});
      groupRepoMock.listByGroup.mockResolvedValue([]);
      orgLinkRepoMock.updateParent.mockResolvedValue({ id: 'link-1' } as any);

      // Act
      const result = await service.mergeChildOrg('source-1', 'target-1', 'org-1');

      expect(result).toBeTruthy();
      expect(orgLinkRepoMock.updateParent).toHaveBeenCalledWith('source-1', 'target-1');
    });
  });

  // ======================================================================
  // enumerateDescendants
  // ======================================================================
  describe('enumerateDescendants', () => {
    it('should enumerate descendants successfully (positive)', async () => {
      // Arrange
      orgLinkRepoMock.listByOrg.mockResolvedValue([]);
      jest.spyOn(DescendantEnumerator, 'enumerate').mockReturnValue([
        { id: 'descendant-1', depthLevel: 2 } as DescendantNode,
      ]);

      // Act
      const result = await service.enumerateDescendants('ancestor-1', 'user-1', 'org-1');

      expect(result).toHaveLength(1);
    });
  });
});
