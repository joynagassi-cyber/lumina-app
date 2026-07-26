/**
 * GroupMembership Entity — N:N junction between Member and OrgUnit.
 * Owns metadata (membership_role, joined_at), qualifies as its own aggregate per DOC-023 §3.3.
 * @traceability DOC-012 §Aggregate 4, POSTGRESQL-SCHEMA-PACK-v1.md Table 11, DOC-023 §3.3
 */

import { JoinTimestamp } from '../value-objects/join-timestamp.vo';
import type { MembershipRole } from '../value-objects/membership-role.vo';
import { RelationshipType } from '../value-objects/relationship-type.vo';
import { RelationshipKey } from '../value-objects/relationship-key.vo';

export interface GroupMembershipData {
  id: string;
  orgId: string;
  memberUuid: string;
  groupOrgUnitUuid: string;
  joinTimestamp: JoinTimestamp;
  membershipRole: MembershipRole | null;
  departureDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_DEPTH = 5;

export class GroupMembership {
  private _data: GroupMembershipData;

  constructor(data: GroupMembershipData) {
    this._data = data;
  }

  get id(): string { return this._data.id; }
  get orgId(): string { return this._data.orgId; }
  get memberUuid(): string { return this._data.memberUuid; }
  get groupOrgUnitUuid(): string { return this._data.groupOrgUnitUuid; }
  get joinTimestamp(): JoinTimestamp { return this._data.joinTimestamp; }
  get membershipRole(): MembershipRole | null { return this._data.membershipRole; }
  get departureDate(): Date | null { return this._data.departureDate; }
  get createdAt(): Date { return this._data.createdAt; }
  get updatedAt(): Date { return this._data.updatedAt; }

  /**
   * The composite key for this membership.
   * (NB-ID-004: member_id first, then groupe_id — fixed order).
   */
  toRelationshipKey(): RelationshipKey {
    return new RelationshipKey(
      this._data.memberUuid,
      this._data.groupOrgUnitUuid,
      RelationshipType.BELONGS_TO,
    );
  }

  /**
   * Returns true if this membership is still active (no departure date set).
   */
  isActive(): boolean {
    return this._data.departureDate === null;
  }

  /**
   * Updates the membership role. Creates a new VO internally (VO immutability).
   */
  withRole(role: MembershipRole | null): GroupMembership {
    return new GroupMembership({
      ...this._data,
      membershipRole: role,
      updatedAt: new Date(),
    });
  }

  /**
   * Marks membership as departed.
   */
  leave(): GroupMembership {
    return new GroupMembership({
      ...this._data,
      departureDate: new Date(),
      updatedAt: new Date(),
    });
  }

  toData(): GroupMembershipData {
    return { ...this._data };
  }
}
