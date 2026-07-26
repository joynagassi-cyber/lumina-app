/**
 * PendingOperation — entity representing a local change awaiting sync.
 *
 * @traceability DOC-012 Aggregate13 (PendingOperation entity)
 */

import { ResourceId } from '@domains/finance/value-objects/resource-id.vo';
import { SyncAction } from '../value-objects/sync-action.vo';
import { SyncStatus } from '../value-objects/sync-status.vo';
import { OperationPayload } from '../value-objects/operation-payload.vo';

export type PendingOperationData = {
  id?: string;
  orgId: string;
  resourceType: string;
  resourceId: ResourceId;
  action: SyncAction;
  payload: OperationPayload;
  status: SyncStatus;
  attemptNumber: number;
  createdAt?: Date;
  nextRetryAt?: Date | null;
};

export class PendingOperation {
  readonly id: string;
  readonly orgId: string;
  readonly resourceType: string;
  readonly resourceId: ResourceId;
  readonly action: SyncAction;
  readonly payload: OperationPayload;
  status: SyncStatus;
  attemptNumber: number;
  readonly createdAt: Date;
  nextRetryAt: Date | null;

  private static readonly MAX_ATTEMPTS = 5;

  constructor(data: PendingOperationData) {
    this.id = data.id ?? crypto.randomUUID();
    this.orgId = data.orgId;
    this.resourceType = data.resourceType;
    this.resourceId = data.resourceId;
    this.action = data.action;
    this.payload = data.payload;
    this.status = data.status;
    this.attemptNumber = data.attemptNumber;
    this.createdAt = data.createdAt ?? new Date();
    this.nextRetryAt = data.nextRetryAt ?? null;
  }

  /** Transition to sent — local write is confirmed, waiting for remote ack. */
  markSent(): void {
    if (this.status === SyncStatus.PENDING) {
      this.status = SyncStatus.SENT;
    } else {
      throw new Error(
        `PendingOperation: cannot transition from ${this.status} to sent`,
      );
    }
  }

  /** Mark as successfully synced to remote. */
  markConfirmed(): void {
    this.status = SyncStatus.CONFIRMED;
  }

  /** Attempt retry with next attempt number and compute backoff delay. */
  scheduleRetry(): { attemptNumber: number; nextRetryAt: Date } {
    if (this.status !== SyncStatus.FAILED) {
      throw new Error(
        `PendingOperation: can only retry failed operations, current: ${this.status}`,
      );
    }
    if (this.attemptNumber >= PendingOperation.MAX_ATTEMPTS) {
      throw new Error(
        `PendingOperation: max attempts (${PendingOperation.MAX_ATTEMPTS}) exceeded`,
      );
    }
    this.attemptNumber += 1;
    const delayMs = 1_000 * 2 ** (this.attemptNumber - 1);
    this.nextRetryAt = new Date(Date.now() + delayMs);
    return { attemptNumber: this.attemptNumber, nextRetryAt: this.nextRetryAt! };
  }

  resetToPending(): void {
    this.status = SyncStatus.PENDING;
    this.attemptNumber = 1;
    this.nextRetryAt = null;
  }

  isExceedingMaxAttempts(): boolean {
    return this.attemptNumber >= PendingOperation.MAX_ATTEMPTS;
  }

  shouldRetryNow(): boolean {
    if (this.nextRetryAt === null) return false;
    return new Date().getTime() >= this.nextRetryAt.getTime();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      org_id: this.orgId,
      resource_type: this.resourceType,
      resource_id: this.resourceId.toString(),
      action: this.action,
      payload: this.payload.toString(),
      statut_sync: this.status,
      tentative_num: this.attemptNumber,
      created_at: this.createdAt.toISOString(),
      prochaine_retry: this.nextRetryAt?.toISOString() ?? null,
    };
  }
}
