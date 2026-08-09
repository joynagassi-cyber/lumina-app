/**
 * Organization Domain — Barrel exports (ITS-V1 compliance)
 *
 * All domain types, application service, ports, and infrastructure adapters
 * are re-exported from this single index for clean consumer imports.
 *
 * @traceability DOC-012 Aggregate1 → all canonical sources
 */

// ---- Value Objects ----
export { OrganizationName, InvalidOrganizationNameError } from './domain/value-objects/organization-name.vo';
export { OrganizationType, assertValidOrganizationType, InvalidOrganizationTypeError } from './domain/value-objects/organization-type.vo';
export {
  OrganizationStatus,
  isValidStatusTransition,
  assertValidOrganizationStatus,
  InvalidOrganizationStatusError,
} from './domain/value-objects/organization-status.vo';
export { OrgUnitHierarchy, InvalidOrgUnitHierarchyError } from './domain/value-objects/org-unit-hierarchy.vo';
export {
  OrganizationSettings,
  InvalidOrganizationSettingsError,
} from './domain/value-objects/organization-settings.vo';
export type { OrganizationSettingEntry } from './domain/value-objects/organization-settings.vo';

// ---- Entities ----
export { Organization } from './domain/organization.entity';
export {
  OrgUnit,
  OrgUnitType,
  OrgUnitStatus,
  assertValidOrgUnitType,
  assertValidOrgUnitStatus,
} from './domain/org-unit.entity';

// ---- Domain Services ----
export {
  OrgUnitHierarchyResolver,
  CycleDetectedError,
  DepthExceededError,
  OrgUnitAlreadyOwnChildError,
} from './domain/services/org-hierarchy-resolver.service';
export {
  OrgTemplateInheritor,
  TemplateNotFoundError,
  type TemplateManifest,
} from './domain/services/org-template-inheritor.service';

// ---- Policies ----
export { VisibilityPolicy, TenantIsolationError } from './domain/policies/visibility-policy';
export { HierarchyPolicy, HierarchyValidationError } from './domain/policies/hierarchy-policy';
export { MaxDepthPolicy, MaxDepthExceededError } from './domain/policies/max-depth-policy';

// ---- Domain Events ----
export {
  type DomainEvent,
  OrganizationCreated,
  OrganizationSuspended,
  OrganizationArchived,
  OrgUnitCreated,
  OrgUnitParentChanged,
  OrganizationMerged,
} from './domain/events';

// ---- Ports ----
export type {
  IOrganizationRepository,
  IOrgUnitRepository,
  FindOrganizationByIdResult,
} from './ports/repository.port';
export type { IEventPublicationPort } from './ports/event-pub.port';
export type { IAuthorizationPort, RoleType } from './ports/auth.port';
export type { IClockPort } from './ports/clock.port';
export type { IUuidPort } from './ports/uuid.port';
export type { IConfigurationPort } from './ports/config.port';
export type { IAuditPort, AuditPayload } from './ports/audit.port';
export type { ICachePort } from './ports/cache.port';
export type { ILoggerPort } from './ports/logging.port';

// ---- Application Service ----
export {
  OrganizationService,
  OrganizationSuspendedError,
  OrganizationNotFoundError,
  OrgUnitNotFoundError,
  type CreateOrganizationInput,
  type UpdateSettingsInput,
  type CreateOrgUnitInput,
  type UpdateOrgUnitParentInput,
  type MergeOrganizationsInput,
  type ArchiveOrganizationInput,
  type SuspendOrganizationInput,
  type OrganizationProfileDto,
  type DescendantUnitDto,
} from './application/organization.service';
