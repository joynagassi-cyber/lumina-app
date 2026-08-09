/**
 * SyncScheduler — NestJS @Cron-based scheduler for automatic sync operations.
 *
 * Push runs every 60 seconds when online.
 * Pull runs every 120 seconds.
 * Connectivity state is monitored and events are published.
 *
 * @traceability DOC-012 Aggregate13, ASS-001 §SERVICE 13
 * @invariant SYNC-004: user ops never depend on sync synchronously
 */

import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OfflineSyncService } from './application-service';
import type { EventBus } from './application-service';

const DEFAULT_SYNC_ORG_IDS = ['placeholder-org'];

@Injectable()
export class SyncScheduler implements OnModuleInit {
  private initializedOrgs: string[];
  private previousConnectionState: 'online' | 'offline' | null = null;

  constructor(
    private readonly syncService: OfflineSyncService,
    @Inject('EventBus') private readonly eventBus: EventBus,
  ) {
    this.initializedOrgs = [];
  }

  onModuleInit(): void {
    this.eventBus.publish({
      type: 'SyncSchedulerInitialized',
      occurredAt: new Date(),
    });
  }

  /**
   * Push pending operations every 60 seconds.
   * Non-blocking: user operations are NOT waiting for this.
   */
  @Cron('*/60 * * * * *')
  async handlePushCron(): Promise<void> {
    if (this.initializedOrgs.length === 0) return;

    for (const orgId of this.initializedOrgs) {
      try {
        await this.syncService.pushPendingOperations(orgId);
      } catch {
        // Push failures are handled by the Retrier with exponential backoff.
        // This cron job is fire-and-forget per SYNC-004.
      }
    }
  }

  /**
   * Pull remote changes every 120 seconds.
   * Non-blocking: user operations are NOT waiting for this.
   */
  @Cron('*/120 * * * * *')
  async handlePullCron(): Promise<void> {
    if (this.initializedOrgs.length === 0) return;

    for (const orgId of this.initializedOrgs) {
      try {
        await this.syncService.pullRemoteChanges(orgId, 'pending_operations');
        await this.syncService.pullRemoteChanges(orgId, 'transactions');
        await this.syncService.pullRemoteChanges(orgId, 'members');
        await this.syncService.pullRemoteChanges(orgId, 'events');
      } catch {
        // Pull failures retried on next cycle.
      }
    }
  }

  /**
   * Schedule failed operations for retry every 5 minutes.
   */
  @Cron('*/300 * * * * *')
  async handleRetryCron(): Promise<void> {
    if (this.initializedOrgs.length === 0) return;

    for (const orgId of this.initializedOrgs) {
      try {
        await this.syncService.scheduleRetry(orgId);
      } catch {
        // Retry scheduling failures are non-critical.
      }
    }
  }

  /**
   * Register an organization for automatic sync monitoring.
   * Called from the Auth module after successful login.
   */
  registerOrg(orgId: string): void {
    if (!this.initializedOrgs.includes(orgId)) {
      this.initializedOrgs.push(orgId);
    }
  }

  /**
   * Unregister an organization from auto-sync monitoring.
   */
  unregisterOrg(orgId: string): void {
    this.initializedOrgs = this.initializedOrgs.filter((id) => id !== orgId);
  }

  /**
   * Get the list of registered organizations.
   */
  getRegisteredOrgs(): string[] {
    return [...this.initializedOrgs];
  }

  /**
   * Check connectivity and update connection state in the tracker.
   */
  async checkAndSyncConnectivity(orgId: string): Promise<void> {
    const result = await this.syncService.checkConnectivity(orgId);

    if (this.previousConnectionState !== null && result.connectionState !== this.previousConnectionState) {
      this.eventBus.publish({
        type: 'ConnectionStateTransition',
        orgId,
        from: this.previousConnectionState,
        to: result.connectionState,
        occurredAt: new Date(),
      });
    }

    this.previousConnectionState = result.connectionState;
  }
}
