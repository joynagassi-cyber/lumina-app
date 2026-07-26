/**
 * OrgUnit Domain — skeleton per ITS-V1
 */

export interface IOrgUnitPort {
  findById(id: string): Promise<unknown>;
  findHierarchy(orgId: string): Promise<unknown[]>;
  create(data: unknown): Promise<unknown>;
}

export class OrgUnitModule {}
