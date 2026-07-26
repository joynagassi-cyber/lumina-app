/**
 * Event Domain — skeleton per ITS-V1
 */

export interface IEventPort {
  findById(id: string): Promise<unknown>;
  listByOrg(orgId: string): Promise<unknown[]>;
  create(data: unknown): Promise<unknown>;
}

export class EventModule {}
