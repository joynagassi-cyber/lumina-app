/**
 * RemoteApiPort — interface for communicating with the remote server API.
 *
 * @traceability DOC-012 Aggregate13, OFFLINE-FIRST sync communication contract
 */

import { ConflictStrategy } from '../value-objects/conflict-strategy.vo';

export type ConflictRecord = {
  localPayload: Record<string, unknown>;
  remotePayload: Record<string, unknown>;
  strategy: ConflictStrategy;
  resourceType: string;
  resourceId: string;
  orgId: string;
};

export type ResolvedConflict = {
  winningPayload: Record<string, unknown>;
  resolution: 'local_wins' | 'remote_wins' | 'merged' | 'both_kept';
  resourceType: string;
  resourceId: string;
};

export type PushBatchResponse = {
  pushed: number;
  conflicts: ConflictRecord[];
  errors: string[];
};

export type DeltaPullResponse = {
  changes: Array<{
    resourceType: string;
    resourceId: string;
    action: 'create' | 'update' | 'delete';
    payload: Record<string, unknown>;
    timestamp: Date;
  }>;
  since: Date;
};

export interface IRemoteApiPort {
  pushBatch(
    orgId: string,
    operations: Array<{
      resource_id: string;
      resource_type: string;
      action: string;
      payload: Record<string, unknown>;
    }>,
  ): Promise<PushBatchResponse>;
  pullDelta(
    orgId: string,
    sinceTimestamp: Date,
  ): Promise<DeltaPullResponse>;
}
