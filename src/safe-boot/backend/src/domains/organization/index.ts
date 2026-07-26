/**
 * Organization Domain — skeleton per ITS-V1
 */

export interface IOrganizationPort {
  findById(id: string): Promise<unknown>;
  create(data: unknown): Promise<unknown>;
  update(id: string, data: unknown): Promise<unknown>;
  delete(id: string): Promise<boolean>;
}

export class OrganizationModule {}
