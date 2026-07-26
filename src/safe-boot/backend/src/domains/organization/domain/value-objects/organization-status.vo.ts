/**
 * OrganizationStatus Value Object
 *
 * Represents the lifecycle status of an organization.
 * State transitions: inactive → active → suspended → archived
 * Once archived, the transition is IRREVERSIBLE.
 *
 * @traceability DOC-012 Aggregate1 §VO-OrganizationStatus
 *   → POSTGRESQL-SCHEMA-PACK-v1 organizations.statut CHECK IN ('active','suspended','archived')
 */

export enum OrganizationStatus {
  Active = 'active',
  Suspended = 'suspended',
  Archived = 'archived',
}

const VALID_STATUSES: readonly OrganizationStatus[] = Object.values(OrganizationStatus);

export class InvalidOrganizationStatusError extends Error {
  constructor(value: string) {
    super(`Invalid organization status: "${value}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    this.name = 'InvalidOrganizationStatusError';
  }
}

export function assertValidOrganizationStatus(value: string): OrganizationStatus {
  const typed = value as OrganizationStatus;
  if (!VALID_STATUSES.includes(typed)) {
    throw new InvalidOrganizationStatusError(value);
  }
  return typed;
}

export function isValidStatusTransition(from: OrganizationStatus, to: OrganizationStatus): boolean {
  switch (from) {
    case OrganizationStatus.Active:
      return to === OrganizationStatus.Suspended || to === OrganizationStatus.Archived;
    case OrganizationStatus.Suspended:
      return to === OrganizationStatus.Archived;
    case OrganizationStatus.Archived:
      return false; // Irreversible per CC-ORG-003 / POSTGRESQL-SCHEMA-PACK-v1
    default:
      return false;
  }
}
