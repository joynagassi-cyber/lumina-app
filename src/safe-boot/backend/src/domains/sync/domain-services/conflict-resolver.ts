/**
 * ConflictResolver — applies deterministic conflict resolution strategies.
 *
 * @traceability DOC-012 Aggregate13 (ConflictResolver), BR-SYNC-002 to BR-SYNC-005
 */

import { ConflictStrategy } from '../value-objects/conflict-strategy.vo';
import {
  ConflictResolutionPolicy,
} from '../policies/conflict-resolution-policy';

export type ConflictInput = {
  resourceType: string;
  resourceId: string;
  localPayload: Record<string, unknown>;
  remotePayload: Record<string, unknown>;
};

export type ConflictOutput = {
  winningPayload: Record<string, unknown> | null;
  resolution: 'local_wins' | 'remote_wins' | 'merged' | 'both_kept' | 'blocked';
};

export class ConflictResolver {
  /**
   * Resolve a conflict deterministically based on the entity type's strategy.
   * Same input always produces same output.
   */
  static resolve(input: ConflictInput): ConflictOutput {
    const strategy = ConflictResolutionPolicy.getStrategy(
      input.resourceType,
      this.extractState(input.localPayload),
    );

    switch (strategy) {
      case ConflictStrategy.IMMUTABLE:
        return this.resolveImmutable(input);
      case ConflictStrategy.LAST_WRITE_WINS:
        return this.resolveLWW(input);
      case ConflictStrategy.SERVER_WINS:
        return this.resolveServerWins(input);
      case ConflictStrategy.UUID_DEDUP:
        return this.resolveUuidDedup(input);
      default:
        return this.resolveServerWins(input);
    }
  }

  private static extractState(payload: Record<string, unknown>): string | undefined {
    return payload.statut as string | undefined ?? payload.state as string | undefined;
  }

  private static resolveImmutable(
    input: ConflictInput,
  ): ConflictOutput {
    const remoteState = this.extractState(input.remotePayload);
    const isImmutableState =
      remoteState && remoteState !== 'draft' && remoteState !== 'pending';

    if (isImmutableState) {
      return {
        winningPayload: null,
        resolution: 'blocked',
      };
    }

    return {
      winningPayload: input.localPayload,
      resolution: 'local_wins',
    };
  }

  private static resolveLWW(input: ConflictInput): ConflictOutput {
    const localTs = this.extractTimestamp(input.localPayload);
    const remoteTs = this.extractTimestamp(input.remotePayload);

    if (remoteTs >= localTs) {
      return {
        winningPayload: { ...input.localPayload, ...input.remotePayload },
        resolution: 'remote_wins',
      };
    }

    return {
      winningPayload: input.localPayload,
      resolution: 'local_wins',
    };
  }

  private static resolveServerWins(
    input: ConflictInput,
  ): ConflictOutput {
    return {
      winningPayload: { ...input.localPayload, ...input.remotePayload },
      resolution: 'remote_wins',
    };
  }

  private static resolveUuidDedup(
    input: ConflictInput,
  ): ConflictOutput {
    const localId = input.localPayload.id as string | undefined;
    const remoteId = input.remotePayload.id as string | undefined;

    if (localId && remoteId && localId !== remoteId) {
      return {
        winningPayload: {
          ...input.localPayload,
          _conflict_mode: 'side_by_side',
          _remote_copy: input.remotePayload,
        },
        resolution: 'both_kept',
      };
    }

    return {
      winningPayload: input.localPayload,
      resolution: 'local_wins',
    };
  }

  private static extractTimestamp(obj: Record<string, unknown>): number {
    const candidates = ['updated_at', 'synced_at', 'timestamp'];
    for (const key of candidates) {
      const val = obj[key];
      if (val && typeof val === 'string') {
        const ts = new Date(val).getTime();
        if (!Number.isNaN(ts)) return ts;
      }
    }
    return 0;
  }
}
