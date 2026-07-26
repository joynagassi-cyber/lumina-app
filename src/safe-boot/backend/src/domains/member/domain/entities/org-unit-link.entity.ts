/**
 * OrgUnitLink Entity — self-referencing parent link for org_units DAG.
 * Each link connects a child org_unit to its immediate parent, forming the hierarchy.
 * @traceability DOC-012 §Aggregate 4, POSTGRESQL-SCHEMA-PACK-v1.md Table 12, DOC-023 §3.4
 */

export interface OrgUnitLinkData {
  id: string;
  orgId: string;
  childOrgUnitUuid: string;
  parentOrgUnitUuid: string | null;
  depthLevel: number;
  updatedAt: Date;
}

const MAX_DEPTH = 5;

export class OrgUnitLink {
  private readonly _data: OrgUnitLinkData;

  constructor(data: OrgUnitLinkData) {
    this._data = data;
  }

  get id(): string { return this._data.id; }
  get orgId(): string { return this._data.orgId; }
  get childOrgUnitUuid(): string { return this._data.childOrgUnitUuid; }
  get parentOrgUnitUuid(): string | null { return this._data.parentOrgUnitUuid; }
  get depthLevel(): number { return this._data.depthLevel; }
  get updatedAt(): Date { return this._data.updatedAt; }

  /**
   * Returns true if this org unit is a root node (no parent).
   */
  isRoot(): boolean {
    return this._data.parentOrgUnitUuid === null;
  }

  /**
   * Returns true if the given depth is within the allowed maximum.
   * Enforced at domain layer BEFORE reaching DB (BR-REL-002).
   */
  static isValidDepth(depth: number): boolean {
    return depth >= 1 && depth <= MAX_DEPTH;
  }

  /**
   * Creates an updated OrgUnitLink with a new parent, recalculating depth.
   */
  withParent(
    parentId: string | null,
    currentDepth: number,
  ): OrgUnitLink {
    const newDepth = parentId !== null ? currentDepth : 1;

    if (!OrgUnitLink.isValidDepth(newDepth)) {
      throw new RangeError(
        `Depth ${newDepth} exceeds maximum allowed depth of ${MAX_DEPTH}. ` +
        'Ensure no ancestors exceed the limit before reparenting.',
      );
    }

    return new OrgUnitLink({
      ...this._data,
      parentOrgUnitUuid: parentId,
      depthLevel: newDepth,
      updatedAt: new Date(),
    });
  }

  toData(): OrgUnitLinkData {
    return { ...this._data };
  }
}
