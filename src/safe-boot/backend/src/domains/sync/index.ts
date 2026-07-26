/**
 * Sync Domain — skeleton per ITS-V1 / RTS-v1
 */

export interface ISyncPort {
  pendingOperations(orgId: string): Promise<unknown[]>;
  applyOperation(op: unknown): Promise<unknown>;
  syncTimestamp(orgId: string): Promise<Date>;
}

export class SyncModule {}
