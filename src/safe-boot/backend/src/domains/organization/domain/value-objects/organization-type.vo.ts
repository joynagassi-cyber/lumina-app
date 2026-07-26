/**
 * OrganizationType Value Object
 *
 * Enumerates the valid organization types as defined in DOC-012.
 * Mapped to organizations.type_org CHECK constraint.
 *
 * @traceability DOC-012 Aggregate1 §VO-OrganizationType
 *   → POSTGRESQL-SCHEMA-PACK-v1 organizations.type_org CHECK IN ('church','school','ngo','company','custom')
 */

export enum OrganizationType {
  Church = 'church',
  School = 'school',
  Ngo = 'ngo',
  Company = 'company',
  Custom = 'custom',
}

const VALID_TYPES: readonly OrganizationType[] = Object.values(OrganizationType);

export class InvalidOrganizationTypeError extends Error {
  constructor(value: string) {
    super(`Invalid organization type: "${value}". Must be one of: ${VALID_TYPES.join(', ')}`);
    this.name = 'InvalidOrganizationTypeError';
  }
}

export function assertValidOrganizationType(value: string): OrganizationType {
  const typed = value as OrganizationType;
  if (!VALID_TYPES.includes(typed)) {
    throw new InvalidOrganizationTypeError(value);
  }
  return typed;
}
