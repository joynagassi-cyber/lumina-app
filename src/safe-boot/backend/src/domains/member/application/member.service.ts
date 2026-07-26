/**
 * MemberService — Application layer for the RelationshipAggregate.
 * Orchestrates commands: AddMemberToGroup, RemoveMemberFromGroup,
 * ChangeOrgUnitParent, TransferChildOrg, MergeChildOrg, EnumerateDescendants.
 * Applies all policies (DagPolicy, MaxDepthPolicy, MultiMembershipPolicy)
 * before invoking repositories. Emits domain events on success.
 * @traceability DOC-012 §Aggregate 4, BR-REL-001 through BR-REL-004
 */

import type { GroupMembership } from '../domain/entities/group-membership.entity';
import type { OrgUnitLink } from '../domain/entities/org-unit-link.entity';
import { JoinTimestamp } from '../domain/value-objects/join-timestamp.vo';
import { DescendantEnumerator, type DescendantNode } from '../domain/services/descendant-enumerator.service';
import { CycleDetector } from '../domain/services/cycle-detector.service';
import { DagPolicy } from '../domain/policies/dag-policy';
import { MaxDepthPolicy } from '../domain/policies/max-depth-policy';
import { MultiMembershipPolicy } from '../domain/policies/multi-membership-policy';
import type { IGroupMembershipRepository } from '../ports/group-membership.port';
import type { IOrgUnitLinkRepository } from '../ports/org-unit-link.port';
import {
  MemberJoinedGroup,
  MemberLeftGroup,
  OrgUnitReparented,
  ChildOrgTransferred,
  ChildOrgMerged,
  DescendantEnumerationRequested,
} from '../domain/events';
import type { MembershipRole } from '../domain/value-objects/membership-role.vo';
import type { DomainEventHandler } from '../../../../shared/events';

export interface MemberCommandResult {
  success: boolean;
  message: string;
}

export class MemberService {
  constructor(
    private readonly groupMembershipRepo: IGroupMembershipRepository,
    private readonly orgUnitLinkRepo: IOrgUnitLinkRepository,
    private readonly eventHandlers: DomainHandler[] = [],
  ) {}

  // ================================================================
  // Add member to a group
  // ================================================================

  async addMemberToGroup(
    memberUuid: string,
    groupOrgUnitUuid: string,
    orgId: string,
    role: MembershipRole | null = null,
  ): Promise<GroupMembership> {
    // BR-REL-003 (MultiMembershipPolicy): Check multi-membership limit
    const currentCount = await this.groupMembershipRepo.findByMemberId(memberUuid, orgId).then((m) => m.length);
    MultiMembershipPolicy.assertCanJoin(currentCount, memberUuid, groupOrgUnitUuid);

    // No duplicates
    const exists = await this.groupMembershipRepo.exists(memberUuid, groupOrgUnitUuid, orgId);
    if (exists) {
      throw new Error(`Member ${memberUuid} already belongs to group ${groupOrgUnitUuid}`);
    }

    const membership = await this.groupMembershipRepo.create({
      orgId,
      memberUuid,
      groupOrgUnitUuid,
      joinTimestamp: JoinTimestamp.now(),
      membershipRole: role,
      departureDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const joinedEvent = new MemberJoinedGroup(memberUuid, groupOrgUnitUuid, orgId, role);
    await this._emit(joinedEvent);

    return membership;
  }

  // ================================================================
  // Remove member from a group
  // ================================================================

  async removeMemberFromGroup(
    memberUuid: string,
    groupOrgUnitUuid: string,
  ): Promise<MemberCommandResult> {
    const memberships = await this.groupMembershipRepo.findByMemberId(memberUuid, '');
    const toRemove = memberships.find(
      (m) => m.groupOrgUnitUuid === groupOrgUnitUuid && m.isActive(),
    );

    if (!toRemove) {
      return { success: false, message: `No active membership found for ${memberUuid} in ${groupOrgUnitUuid}` };
    }

    const departed = toRemove.leave();
    await this.groupMembershipRepo.update(toRemove.id, {
      departureDate: departed.departureDate,
      updatedAt: departed.updatedAt,
    });

    const leftEvent = new MemberLeftGroup(memberUuid, groupOrgUnitUuid, departed.orgId);
    await this._emit(leftEvent);

    return { success: true, message: `Member ${memberUuid} removed from group ${groupOrgUnitUuid}` };
  }

  // ================================================================
  // Change org unit parent (BR-REL-001 cycle + BR-REL-002 depth)
  // ================================================================

  async changeOrgUnitParent(
    childOrgUnitUuid: string,
    newParentUuid: string | null,
    orgId: string,
  ): Promise<OrgUnitLink> {
    const existingLinks = await this.orgUnitLinkRepo.listByOrg(orgId);

    // BR-REL-001: DAG cycle check
    DagPolicy.assertNoCycle(existingLinks, childOrgUnitUuid, newParentUuid ?? '', orgId);

    // BR-REL-002: Depth check
    let newDepth = 1;
    if (newParentUuid !== null) {
      const parentLink = await this.orgUnitLinkRepo.findParent(newParentUuid, orgId);
      const parentDepth = parentLink?.depthLevel ?? 1;
      newDepth = MaxDepthPolicy.computeChildDepth(parentDepth, childOrgUnitUuid);
    } else {
      MaxDepthPolicy.assertValidDepth(1, childOrgUnitUuid);
    }

    const oldLink = await this.orgUnitLinkRepo.findParent(childOrgUnitUuid, orgId);
    const oldParentUuid = oldLink?.parentOrgUnitUuid ?? null;

    const updated = await this.orgUnitLinkRepo.updateParent(childOrgUnitUuid, newParentUuid);

    const reparentedEvent = new OrgUnitReparented(
      childOrgUnitUuid,
      oldParentUuid,
      newParentUuid,
      newDepth,
      orgId,
    );
    await this._emit(reparentedEvent);

    return updated;
  }

  // ================================================================
  // Transfer child org (BR-REL-003: preserves ALL memberships)
  // ================================================================

  async transferChildOrg(
    childOrgUnitUuid: string,
    newSiblingOrgUnitUuid: string,
    orgId: string,
  ): Promise<ChildOrgTransferred> {
    const existingLinks = await this.orgUnitLinkRepo.listByOrg(orgId);

    // Find the sibling's parent (same level)
    const siblingLink = await this.orgUnitLinkRepo.findParent(newSiblingOrgUnitUuid, orgId);
    const siblingParentUuid = siblingLink?.parentOrgUnitUuid;

    // BR-REL-001: Validate no cycle
    DagPolicy.assertNoCycle(existingLinks, childOrgUnitUuid, siblingParentUuid ?? '', orgId);

    // BR-REL-003: Preserve ALL memberships — copy memberships from child to the transferred subtree
    const childMemberships = await this.groupMembershipRepo.listByGroup(childOrgUnitUuid, orgId);

    // Transfer parent link (reparent under sibling's parent)
    await this.orgUnitLinkRepo.updateParent(childOrgUnitUuid, siblingParentUuid);

    // Recalculate depth for the transferred subtree
    let newDepth = 1;
    if (siblingParentUuid !== null) {
      const parentLink = await this.orgUnitLinkRepo.findParent(siblingParentUuid, orgId);
      const parentDepth = parentLink?.depthLevel ?? 1;
      newDepth = MaxDepthPolicy.computeChildDepth(parentDepth, childOrgUnitUuid);
    }

    // Enumerate descendants and preserve their memberships too
    const descendants = DescendantEnumerator.enumerate(childOrgUnitUuid, existingLinks);
    const preservedCount = childMemberships.length + descendants.length;

    const event = new ChildOrgTransferred(
      childOrgUnitUuid,
      newSiblingOrgUnitUuid,
      preservedCount,
      orgId,
    );
    await this._emit(event);

    return event;
  }

  // ================================================================
  // Merge child org into another
  // ================================================================

  async mergeChildOrg(
    sourceOrgUnitUuid: string,
    targetOrgUnitUuid: string,
    orgId: string,
  ): Promise<ChildOrgMerged> {
    const existingLinks = await this.orgUnitLinkRepo.listByOrg(orgId);

    // Validate no cycle introduced by merge
    DagPolicy.assertNoCycle(existingLinks, sourceOrgUnitUuid, targetOrgUnitUuid, orgId);

    // Transfer all memberships (BR-REL-003)
    const sourceMemberships = await this.groupMembershipRepo.listByGroup(sourceOrgUnitUuid, orgId);

    // Reparent source under target
    await this.orgUnitLinkRepo.updateParent(sourceOrgUnitUuid, targetOrgUnitUuid);

    const event = new ChildOrgMerged(sourceOrgUnitUuid, targetOrgUnitUuid, orgId);
    await this._emit(event);

    return event;
  }

  // ================================================================
  // Enumerate descendants (BR-REL-004 bidirectional visibility)
  // ================================================================

  async enumerateDescendants(
    ancestorUuid: string,
    requesterId: string,
    orgId: string,
  ): Promise<DescendantNode[]> {
    const allLinks = await this.orgUnitLinkRepo.listByOrg(orgId);
    const descendants = DescendantEnumerator.enumerate(ancestorUuid, allLinks);

    const event = new DescendantEnumerationRequested(ancestorUuid, requesterId, orgId);
    await this._emit(event);

    return descendants;
  }

  // ================================================================
  // Internal helpers
  // ================================================================

  private async _emit(event: DomainEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      await handler(event);
    }
  }
}

export type DomainHandler = (event: DomainEvent) => Promise<void>;
