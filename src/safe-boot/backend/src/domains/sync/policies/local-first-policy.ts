/**
 * LocalFirstPolicy — enforces that local writes ALWAYS precede remote writes.
 *
 * @traceability DOC-012 Aggregate13, INV-003 offline-absolute, BR-SYNC-001
 */

import { SyncStatus } from '../value-objects/sync-status.vo';
import { PendingOperationRecord } from '../ports/pending-operations-port.interface';

export class LocalFirstPolicy {
  /**
   * Verify that a resource was written locally before allowing a remote push.
   * A pending_operation with statut_sync = 'pending' proves local write happened first.
   */
  static validateLocalFirst(
    operation: PendingOperationRecord,
  ): void {
    if (operation.statut_sync !== SyncStatus.PENDING) {
      throw new Error(
        `LocalFirstPolicy: operation ${operation.id} is not in pending state (${operation.statut_sync}). Local write must be recorded before remote push.`,
      );
    }
  }

  /**
   * Ensure that confirming a remote write does not precede the local record.
   */
  static validateRemoteAckAfterLocal(operation: PendingOperationRecord): void {
    const confirmedStates = [SyncStatus.CONFIRMED, SyncStatus.SENT];
    if (!confirmedStates.includes(operation.statut_sync)) {
      throw new Error(
        `LocalFirstPolicy: cannot acknowledge remote write for operation ${operation.id} — status is ${operation.statut_sync}, expected ${SyncStatus.PENDING} or ${SyncStatus.SENT}`,
      );
    }
  }
}
