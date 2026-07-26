/**
 * OrgUnit Entity
 *
 * Represents a node in the organizational hierarchy DAG.
 * Each unit has a parent (self-reference forming a tree), depth level, and path.
 *
 * @traceability DOC-012 Aggregate1 §Entity-OrgUnit
 *   → POSTGRESQL-SCHEMA-PACK-v1 org_units (id, org_id, parent_id, nom, type_unite, niveau_profondeur, statut, chemin_hierarchique)
 *   → CONSTRAINTS-INDEX-SPECIFICATION-v1 CHECK (niveau_profondeur BETWEEN 1 AND 5)
 */

import { OrgUnitHierarchy } from './value-objects/org-unit-hierarchy.vo';

export enum OrgUnitType {
  Organization = 'organization',
  Department = 'department',
  Group = 'group',
  Chorale = 'chorale',
  Cellule = 'cellule',
  Comite = 'comite',
  Commission = 'commission',
  Custom = 'custom',
}

export enum OrgUnitStatus {
  Active = 'active',
  Archived = 'archived',
}

const VALID_TYPES: readonly OrgUnitType[] = Object.values(OrgUnitType);
const VALID_STATUSES: readonly OrgUnitStatus[] = Object.values(OrgUnitStatus);

export interface OrgUnitProps {
  readonly id: string;            // uuid PK
  readonly orgId: string;         // FK to organizations(id) CASCADE
  parentId: string | null;        // self-referencing FK — mutable for reparenting
  readonly name: string;          // nom varchar(255)
  readonly type: OrgUnitType;     // type_unite
  depthLevel: number;             // niveau_profondeur 1..5 — mutable for reparenting
  readonly status: OrgUnitStatus; // statut
  hierarchyPath: OrgUnitHierarchy; // chemin_hierarchique — mutable for reparenting
  readonly createdAt: Date;
  updatedAt: Date;                // mutable
  version: number;                // mutable for optimistic concurrency
}

export class OrgUnit {
  private _props: OrgUnitProps;

  constructor(props: OrgUnitProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get orgId(): string { return this._props.orgId; }
  get parentId(): string | null { return this._props.parentId; }
  get name(): string { return this._props.name; }
  get type(): OrgUnitType { return this._props.type; }
  get depthLevel(): number { return this._props.depthLevel; }
  get status(): OrgUnitStatus { return this._props.status; }
  get hierarchyPath(): OrgUnitHierarchy { return this._props.hierarchyPath; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._props.updatedAt; }
  get version(): number { return this._props.version; }

  /** Returns the path string for constructing child hierarchies. */
  pathForChild(name: string): string {
    const basePath = this._props.hierarchyPath.toString();
    if (!basePath) return name;
    return `${basePath}/${name}`;
  }

  /** Maximum allowed depth for any org unit per BR-ORG-002. */
  static readonly MAX_DEPTH = 5;

  equals(other: OrgUnit): boolean {
    return this._props.id === other._props.id &&
           this._props.orgId === other._props.orgId;
  }
}

export function assertValidOrgUnitType(value: string): OrgUnitType {
  const typed = value as OrgUnitType;
  if (!VALID_TYPES.includes(typed)) {
    throw new Error(`Invalid org unit type: "${value}". Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  return typed;
}

export function assertValidOrgUnitStatus(value: string): OrgUnitStatus {
  const typed = value as OrgUnitStatus;
  if (!VALID_STATUSES.includes(typed)) {
    throw new Error(`Invalid org unit status: "${value}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  return typed;
}
