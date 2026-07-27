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
        org_id_table_reference: {
          org_id: record.org_id,
          table_reference: record.table_reference,
        },
      },
      create: {
        org_id: record.org_id,
        table_reference: record.table_reference,
        derniere_synchro_timestamp: record.derniere_synchro_timestamp ?? new Date(),
        etat_connection: record.etat_connection,
        derniere_operation_push: record.derniere_operation_push,
        derniere_operation_pull: record.derniere_operation_pull,
      },
      update: {
        derniere_synchro_timestamp: record.derniere_synchro_timestamp ?? undefined,
        etat_connection: record.etat_connection,
        derniere_operation_push: record.derniere_operation_push ?? undefined,
        derniere_operation_pull: record.derniere_operation_pull ?? undefined,
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
      org_id: raw.org_id,
      table_reference: raw.table_reference,
      dernier_synchro_timestamp: raw.derniere_synchro_timestamp,
      etat_connection: raw.etat_connection as ConnectionState,
      derniere_operation_push: raw.derniere_operation_push,
      derniere_operation_pull: raw.derniere_operation_pull,
    };
  }
}
