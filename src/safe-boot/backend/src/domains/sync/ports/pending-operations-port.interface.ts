/**
 * PendingOperationsPort — interface for persisting sync operations.
 *
 * @traceability DOC-012 Aggregate13 (PendingOperation), DOC-023 §Table 31
 */

import { SyncStatus } from '../value-objects/sync-status.vo';

export type PendingOperationRecord = {
  id: string;
  org_id: string;
  resource_type: string;
  resource_id: string;
  action: string;
  payload: Record<string, unknown>;
  statut_sync: SyncStatus;
  tentative_num: number;
  created_at: Date;
  prochaine_retry?: Date | null;
};

export interface IPendingOperationsPort {
  create(record: Omit<PendingOperationRecord, 'id' | 'created_at'>): Promise<string>;
  findById(id: string): Promise<PendingOperationRecord | null>;
  findByOrgAndStatus(
    orgId: string,
    status: SyncStatus,
    limit: number,
  ): Promise<PendingOperationRecord[]>;
  updateStatus(id: string, status: SyncStatus): Promise<void>;
  updateStatusAndAttempt(
    id: string,
    status: SyncStatus,
    attempt: number,
  ): Promise<void>;
  markConfirmed(id: string): Promise<void>;
  markFailed(id: string, errorReason: string): Promise<void>;
  findByResourceTypeAndId(
    resourceType: string,
    resourceId: string,
  ): Promise<PendingOperationRecord[]>;
}
