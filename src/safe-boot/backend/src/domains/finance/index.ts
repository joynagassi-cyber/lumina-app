/**
 * Finance Domain — skeleton per ITS-V1
 */

export interface IFinancePort {
  getTransactions(orgId: string): Promise<unknown>;
  createTransaction(data: unknown): Promise<unknown>;
  reconcile(orgId: string): Promise<unknown>;
}

export class FinanceModule {}
