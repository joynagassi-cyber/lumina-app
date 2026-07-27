/**
 * Sync Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 13 (OfflineSyncAggregate)
 * @traceability OFFLINE-FIRST-SPEC: Conflict resolution matrix + sync cycle
 * @traceability ADR-003: WatermelonDB sync protocol constraints
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Operation action enum per OFFLINE-FIRST spec Section 4 (Push/Pull).
 * Source: CANONICAL-DOMAIN-MODEL.md SyncAction VO.
 */
export type SyncAction = 'create' | 'update' | 'delete';

/**
 * Sync status lifecycle per BR-SYNC transitions.
 * pending -> sent -> confirmed / failed -> pending (retry)
 */
export type SyncStatus = 'pending' | 'sent' | 'confirmed' | 'failed';

/**
 * Conflict resolution strategy per conflict matrix in OFFLINE-FIRST spec.
 * Source: CANONICAL-DOMAIN-MODEL.md ConflictStrategy VO.
 */
export type ConflictStrategy =
  | 'LWW' // Last-Writer-Wins for members, events
  | 'server_wins' // Categories (lookup table)
  | 'immutable' // Approved transactions
  | 'uuid_dedup' // Draft transactions (BR-SYNC-003)
  | 'side_by_side'; // Draft transactions with merge prompt

/**
 * Entity-specific conflict strategy mapping.
 * Keyed by entity type for strategy lookup.
 */
export interface ConflictStrategyMap {
  readonly transaction: ConflictStrategy;
  readonly member: ConflictStrategy;
  readonly event: ConflictStrategy;
  readonly category: ConflictStrategy;
  readonly group: ConflictStrategy;
  readonly org_unit: ConflictStrategy;
}

/**
 * Default conflict strategy map per OFFLINE-FIRST spec section 3.
 * Transactions: uuid_dedup for draft, immutable for approved.
 * Members/Events: LWW standard.
 * Categories: server_wins (lookup table).
 */
export const DEFAULT_CONFLICT_STRATEGIES: ConflictStrategyMap = {
  transaction: 'uuid_dedup',
  member: 'LWW',
  event: 'LWW',
  category: 'server_wins',
  group: 'LWW',
  org_unit: 'LWW',
};

/**
 * Push batch size constant — max 50 ops per batch per BR-SYNC-006.
 */
export const PUSH_BATCH_SIZE = 50 as const;

/**
 * Maximum retry attempts per BR-SYNC-006 (max 5).
 */
export const MAX_RETRY_ATTEMPTS = 5 as const;

/**
 * Base retry delay in milliseconds for exponential backoff per BR-SYNC-006.
 * Sequence: 1000 → 2000 → 4000 → 8000 → 16000
 */
export const BASE_RETRY_DELAY_MS = 1000;

/**
 * Connection state enum.
 */
export type ConnectionState = 'online' | 'offline' | 'unreachable';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * PendingOperation entity from OfflineSyncAggregate.
 * Maps to physical concept of `.pending_operations` queue per OFFLINE-FIRST spec.
 */
export interface PendingOperation {
  /** Local unique ID for this operation (generated at push time). */
  readonly id: string;

  /** Resource type being operated on (transaction, member, etc.). */
  readonly resourceType: string;

  /** Resource UUID being affected. */
  readonly resourceId: string;

  /** Action to perform on the server: create, update, delete. */
  readonly action: SyncAction;

  /** Full JSON snapshot of the resource payload at operation time. */
  readonly payload: string;

  /** Current sync status in the pipeline. */
  readonly syncStatus: SyncStatus;

  /** Number of retry attempts already made. */
  readonly retryCount: number;

  /** Error message from the last failed attempt (nullable). */
  readonly errorMessage: string | null;

  /** Client-side timestamp when this operation was queued. */
  readonly clientTimestamp: string;

  /** Server-side confirmation timestamp (nullable until confirmed). */
  readonly serverTimestamp: string | null;

  /** Organization ID for multi-tenant scoping. */
  readonly organizationId: string;
}

/**
 * SyncStatusTracker entity from OfflineSyncAggregate.
 * Tracks last successful sync point per entity table for delta pulls.
 */
export interface SyncStatusTracker {
  /** Table/entity name this tracker applies to. */
  readonly tableName: string;

  /** UTC ISO 8601 timestamp of last successful sync. */
  readonly lastSyncTimestamp: string | null;

  /** Current connection state. */
  readonly connectionState: ConnectionState;

  /** Total operations pushed since last reset. */
  readonly totalPushed: number;

  /** Total operations confirmed received by server. */
  readonly totalConfirmed: number;

  /** Total conflicts detected during sync. */
  readonly conflictsDetected: number;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for PushPendingOps command.
 * Batches pending operations up to PUSH_BATCH_SIZE.
 * Maps to ASS-001 PushPendingOps operation.
 */
export interface PushPendingOpsInput {
  readonly organizationId: string;
  readonly operations: ReadonlyArray<{
    readonly resourceType: string;
    readonly resourceId: string;
    readonly action: SyncAction;
    readonly payload: Record<string, unknown>;
  }>;
}

/**
 * Input for PullDelta command.
 * Fetches remote changes since last sync timestamp.
 */
export interface PullDeltaInput {
  readonly organizationId: string;
  readonly sinceTimestamp: string | null;
}

/**
 * Input for ResolveConflict command.
 * User resolves conflicts presented by the UI.
 */
export interface ResolveConflictInput {
  operationId: string;
  strategy: ConflictStrategy;
  localPayload: Record<string, unknown>;
  remotePayload: Record<string, unknown>;
}
