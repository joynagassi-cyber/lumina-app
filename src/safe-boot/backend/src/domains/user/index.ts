/**
 * User Domain — skeleton per ITS-V1
 */

export interface IUserPort {
  findById(id: string): Promise<unknown>;
  findByEmail(email: string): Promise<unknown>;
  create(data: unknown): Promise<unknown>;
}

export class UserModule {}
