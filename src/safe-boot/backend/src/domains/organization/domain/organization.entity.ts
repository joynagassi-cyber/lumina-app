/**
 * Organization Entity
 *
 * Core aggregate root representing an autonomous organization.
 * Contains identity, type, status, and configuration settings.
 * State transitions are enforced by the domain model (DOC-012).
 *
 * @traceability DOC-012 Aggregate1 §Entity-Organization
 *   → POSTGRESQL-SCHEMA-PACK-v1 organizations (id, org_id, nom, nom_court, type_org, statut, ...)
 *   → DOC-023 §8 Multi-tenant isolation
 */

import { OrganizationName } from './value-objects/organization-name.vo';
import { OrganizationType } from './value-objects/organization-type.vo';
import { OrganizationStatus, isValidStatusTransition } from './value-objects/organization-status.vo';
import { InvalidOrganizationStatusError } from './value-objects/organization-status.vo';

export interface OrganizationProps {
  readonly id: string;          // uuid PK
  readonly orgId: string;       // uuid FK self-reference
  readonly name: OrganizationName;
  readonly shortName?: string;  // nom_court — optional
  readonly type: OrganizationType;
  status: OrganizationStatus;
  readonly currencyCode: string;  // devise_iso4217
  readonly timezone: string;      // fuseau_horaire
  readonly language: string;      // langue_privee
  readonly accentColor: string;   // accent_hex
  readonly createdAt: Date;
  updatedAt: Date;                 // mutable for state transitions
  version: number;                 // mutable for optimistic concurrency
}

export class Organization {
  private _props: OrganizationProps;

  constructor(props: OrganizationProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get orgId(): string { return this._props.orgId; }
  get name(): OrganizationName { return this._props.name; }
  get shortName(): string | undefined { return this._props.shortName; }
  get type(): OrganizationType { return this._props.type; }
  get status(): OrganizationStatus { return this._props.status; }
  get currencyCode(): string { return this._props.currencyCode; }
  get timezone(): string { return this._props.timezone; }
  get language(): string { return this._props.language; }
  get accentColor(): string { return this._props.accentColor; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._props.updatedAt; }
  get version(): number { return this._props.version; }

  /**
   * Transition the organization to a new status.
   * Enforces state machine: active → suspended/archived, suspended → archived.
   * Archived is IRREVERSIBLE per CC-ORG-003 / POSTGRESQL-SCHEMA-PACK-v1.
   */
  transitionToStatus(newStatus: OrganizationStatus): void {
    if (!isValidStatusTransition(this._props.status, newStatus)) {
      throw new InvalidOrganizationStatusError(
        `Cannot transition from '${this._props.status}' to '${newStatus}'.`,
      );
    }
    this._props.status = newStatus;
    this._props.updatedAt = new Date();
    this._props.version += 1;
  }

  /** Returns true if the organization is in a write-locked state. */
  isWriteLocked(): boolean {
    return this._props.status === OrganizationStatus.Suspended ||
           this._props.status === OrganizationStatus.Archived;
  }

  /** Returns true if the organization is suspended (read-only, no writes allowed). */
  isSuspended(): boolean {
    return this._props.status === OrganizationStatus.Suspended;
  }

  equals(other: Organization): boolean {
    return this._props.id === other._props.id &&
           this._props.orgId === other._props.orgId;
  }
}
