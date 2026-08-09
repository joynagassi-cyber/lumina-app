/**
 * PrismaSyncStatusRepository — concrete adapter for ISyncStatusRepositoryPort.
 *
 * @traceability DOC-023 §Table 32 (sync_statuses)
 */

import { Injectable } from '@nestjs/common';
import { PrismaPersistenceAdapter } from '@infrastructure/persistence/prisma';
import {
  ISyncStatusRepositoryPort,
  SyncStatusRecord,
  ConnectionState,
} from '@domains/sync/ports/sync-status-repository-port.interface';

@Injectable()
export class PrismaSyncStatusRepository implements ISyncStatusRepositoryPort {
  constructor(private readonly prisma: PrismaPersistenceAdapter) {}

  async findByOrgAndTable(
    orgId: string,
    tableRef: string,
  ): Promise<SyncStatusRecord | null> {
    const record = await this.prisma.syncStatus.findFirst({
      where: { org_id: orgId, table_reference: tableRef },
    });
    if (!record) return null;
    return this.toRecord(record);
  }

  async upsert(record: Omit<SyncStatusRecord, 'id'>): Promise<void> {
    await this.prisma.syncStatus.upsert({
      where: {
        table_reference_org_id: {
          table_reference: record.tableRef,
          org_id: record.orgId,
        },
      },
      create: {
        org_id: record.orgId,
        table_reference: record.tableRef,
        derniere_synchro_timestamp: record.lastSyncTimestamp ?? new Date(),
        etat_connection: record.connectionState,
        derniere_operation_push: record.lastPushTimestamp,
        derniere_operation_pull: record.lastPullTimestamp,
      },
      update: {
        derniere_synchro_timestamp: record.lastSyncTimestamp ?? undefined,
        etat_connection: record.connectionState,
        derniere_operation_push: record.lastPushTimestamp ?? undefined,
        derniere_operation_pull: record.lastPullTimestamp ?? undefined,
      },
    });
  }

  async updateConnectionState(
    orgId: string,
    state: ConnectionState,
  ): Promise<void> {
    await this.prisma.syncStatus.updateMany({
      where: { org_id: orgId },
      data: { etat_connection: state },
    });
  }

  async getAllForOrg(orgId: string): Promise<SyncStatusRecord[]> {
    const records = await this.prisma.syncStatus.findMany({
      where: { org_id: orgId },
    });
    return records.map((r) => this.toRecord(r));
  }

  async updateLastPushTimestamp(
    orgId: string,
    tableRef: string,
    ts: Date,
  ): Promise<void> {
    await this.prisma.syncStatus.updateMany({
      where: { org_id: orgId, table_reference: tableRef },
      data: { derniere_operation_push: ts },
    });
  }

  async updateLastPullTimestamp(
    orgId: string,
    tableRef: string,
    ts: Date,
  ): Promise<void> {
    await this.prisma.syncStatus.updateMany({
      where: { org_id: orgId, table_reference: tableRef },
      data: { derniere_operation_pull: ts },
    });
  }

  async updateLastSyncTimestamp(
    orgId: string,
    tableRef: string,
    ts: Date,
  ): Promise<void> {
    await this.prisma.syncStatus.updateMany({
      where: { org_id: orgId, table_reference: tableRef },
      data: { derniere_synchro_timestamp: ts },
    });
  }

  private toRecord(raw: {
    id: string;
    org_id: string;
    table_reference: string;
    derniere_synchro_timestamp: Date | null;
    etat_connection: string;
    derniere_operation_push: Date | null;
    derniere_operation_pull: Date | null;
  }): SyncStatusRecord {
    return {
      id: raw.id,
      orgId: raw.org_id,
      tableRef: raw.table_reference,
      lastSyncTimestamp: raw.derniere_synchro_timestamp,
      connectionState: raw.etat_connection as ConnectionState,
      lastPushTimestamp: raw.derniere_operation_push,
      lastPullTimestamp: raw.derniere_operation_pull,
    };
  }
}
