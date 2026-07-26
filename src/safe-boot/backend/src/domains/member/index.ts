/**
 * Member Domain — Full RelationshipAggregate implementation per LIP-v1.
 * Aggregate 4 from DOC-012: GroupMembership, OrgUnitParentLink, and all supporting
 * value objects, services, policies, and application commands.
 *
 * @traceability DOC-012 §Aggregate 4 (RelationshipAggregate)
 * @traceability POSTGRESQL-SCHEMA-PACK-v1.md Tables 11-12
 * @traceability DOC-023 §3.3 (N:N junction), §3.4 (Auto-referenced DAG)
 * @traceability BR-REL-001 through BR-REL-004
 */

// ---- Value Objects ----
export {
  RelationshipType,
  isRelationshipType,
  assertRelationshipType,
} from './domain/value-objects/relationship-type.vo';
export type { MembershipRole } from './domain/value-objects/membership-role.vo';
export { tryCreateMembershipRole, assertMembershipRole } from './domain/value-objects/membership-role.vo';
export { JoinTimestamp } from './domain/value-objects/join-timestamp.vo';
export { RelationshipKey } from './domain/value-objects/relationship-key.vo';

// ---- Entities ----
export { GroupMembership, type GroupMembershipData } from './domain/entities/group-membership.entity';
export { OrgUnitLink, type OrgUnitLinkData } from './domain/entities/org-unit-link.entity';

// ---- Domain Services ----
export { CycleDetector } from './domain/services/cycle-detector.service';
export { DescendantEnumerator, type DescendantNode } from './domain/services/descendant-enumerator.service';

// ---- Policies ----
export { DagPolicy, type DagCycleError } from './domain/policies/dag-policy';
export { MaxDepthPolicy, type MaxDepthExceededError } from './domain/policies/max-depth-policy';
export { MultiMembershipPolicy, type MultiMembershipError } from './domain/policies/multi-membership-policy';

// ---- Port Interfaces ----
export { type IGroupMembershipRepository } from './ports/group-membership.port';
export { type IOrgUnitLinkRepository } from './ports/org-unit-link.port';

// ---- Domain Events ----
export {
  MemberJoinedGroup,
  MemberLeftGroup,
  OrgUnitReparented,
  ChildOrgTransferred,
  ChildOrgMerged,
  DescendantEnumerationRequested,
} from './domain/events';

// ---- Application Layer ----
export { MemberService, type MemberCommandResult } from './application/member.service';

// ---- Infrastructure Adapters ----
export { PrismaGroupMembershipRepository } from './infrastructure/adapters/prisma-group-membership.repository';
export { PrismaOrgUnitLinkRepository } from './infrastructure/adapters/prisma-org-unit-link.repository';

// ---- NestJS Module ----
export { MemberModule } from './member.module';
