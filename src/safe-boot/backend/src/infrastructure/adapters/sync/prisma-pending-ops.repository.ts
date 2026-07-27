/**
 * PrismaPendingOperationsRepository — concrete adapter for IPendingOperationsPort.
 *
 * @traceability DOC-023 §Table 31 (pending_operations)
 */

import { Injectable } from '@nestjs/common';
import { PrismaPersistenceAdapter } from '@infrastructure/persistence/prisma';
import {
  IPendingOperationsPort,
  PendingOperationRecord,
} from '@domains/sync/ports/pending-operations-port.interface';
import { SyncStatus } from '../value-objects/sync-status.vo';

@Injectable()
export class PrismaPendingOperationsRepository implements IPendingOperationsPort {
  constructor(private readonly prisma: PrismaPersistenceAdapter) {}

  async create(record: Omit<PendingOperationRecord, 'id' | 'created_at'>): Promise<string> {
    const op = await this.prisma.pendingOperation.create({
      data: {
        org_id: record.org_id,
        resource_type: record.resource_type,
        resource_id: record.resource_id,
        action: record.action,
        payload: record.payload,
        statut_sync: record.statut_sync,
        tentative_num: record.tentative_num,
        prochaine_retry: record.prochaine_retry ?? undefined,
      },
      select: { id: true },
    });
    return op.id;
  }

  async findById(id: string): Promise<PendingOperationRecord | null> {
    const op = await this.prisma.pendingOperation.findUnique({
      where: { id },
    });
    if (!op) return null;
    return this.toRecord(op);
  }

  async findByOrgAndStatus(
    orgId: string,
    status: SyncStatus,
    limit: number,
  ): Promise<PendingOperationRecord[]> {
    const ops = await this.prisma.pendingOperation.findMany({
      where: { org_id: orgId, statut_sync: status },
      take: limit,
      orderBy: { created_at: 'asc' },
    });
    return ops.map((op) => this.toRecord(op));
  }

  async updateStatus(id: string, status: SyncStatus): Promise<void> {
    await this.prisma.pendingOperation.update({
      where: { id },
      data: { statut_sync: status },
    });
  }

  async updateStatusAndAttempt(
    id: string,
    status: SyncStatus,
    attempt: number,
  ): Promise<void> {
    await this.prisma.pendingOperation.update({
      where: { id },
      data: { statut_sync: status, tentative_num: attempt },
    });
  }

  async markConfirmed(id: string): Promise<void> {
    await this.prisma.pendingOperation.update({
      where: { id },
      data: { statut_sync: SyncStatus.CONFIRMED },
    });
  }

  async markFailed(id: string, errorReason: string): Promise<void> {
    await this.prisma.pendingOperation.update({
      where: { id },
      data: {
        statut_sync: SyncStatus.FAILED,
        error_msg: errorReason,
      },
    });
  }

  async findByResourceTypeAndId(
    resourceType: string,
    resourceId: string,
  ): Promise<PendingOperationRecord[]> {
    const ops = await this.prisma.pendingOperation.findMany({
      where: { resource_type: resourceType, resource_id: resourceId },
      orderBy: { created_at: 'desc' },
    });
    return ops.map((op) => this.toRecord(op));
  }

  private toRecord(
    op: {
      id: string;
      org_id: string;
      resource_type: string;
      resource_id: string;
      action: string;
      payload: unknown;
      statut_sync: string;
      tentative_num: number;
      created_at: Date;
      prochaine_retry: Date | null;
      error_msg?: string | null;
    },
  ): PendingOperationRecord {
    return {
      id: op.id,
      org_id: op.org_id,
      resource_type: op.resource_type,
      resource_id: op.resource_id,
      action: op.action,
      payload: typeof op.payload === 'string' ? JSON.parse(op.payload) : (op.payload as Record<string, unknown>),
      statut_sync: op.statut_sync as SyncStatus,
      tentative_num: op.tentative_num,
      created_at: op.created_at,
      prochaine_retry: op.prochaine_retry,
    };
  }
}
