/**
 * HttpRemoteApiClient — concrete adapter for IRemoteApiPort.
 * Sends push batches and fetches deltas from the remote server via HTTP.
 *
 * @traceability DOC-012 Aggregate13 (sync communication), OFFLINE-FIRST
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IRemoteApiPort,
  PushBatchResponse,
  DeltaPullResponse,
} from '@domains/sync/ports/remote-api-port.interface';

@Injectable()
export class HttpRemoteApiClient implements IRemoteApiPort {
  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return this.configService.get<string>('API_BASE_URL', 'http://localhost:3000');
  }

  async pushBatch(
    orgId: string,
    operations: Array<{
      resource_id: string;
      resource_type: string;
      action: string;
      payload: Record<string, unknown>;
    }>,
  ): Promise<PushBatchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify({ operations }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;

      return {
        pushed: (data.pushed as number) ?? operations.length,
        conflicts: (data.conflicts as unknown[]) as Array<unknown>,
        errors: (data.errors as string[]) ?? [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        pushed: 0,
        conflicts: [],
        errors: [`Push failed: ${message}`],
      };
    }
  }

  async pullDelta(
    orgId: string,
    sinceTimestamp: Date,
  ): Promise<DeltaPullResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/sync/delta?since=${encodeURIComponent(sinceTimestamp.toISOString())}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-org-id': orgId,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;

      return {
        changes: (data.changes as unknown[]) as Array<unknown>,
        since: new Date(data.since as string) ?? sinceTimestamp,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Pull delta failed: ${message}`);
    }
  }
}
