/**
 * PrismaEventRepository — IEventRepository implementation backed by Prisma ORM.
 * Maps EventRecord aggregate to/from the 'events' PostgreSQL table.
 *
 * Persistence strategy: LWW (last-writer-wins) per DOC-019, PG-Schema-v1 Table 9.
 * Optimistic concurrency via version column.
 *
 * @traceability DOC-012 Aggregate3 (EventRecord persistence), PAS-v1 PA-NB-002
 *              PG-Schema-v1 Table 9 (events), DOC-019 (LWW conflict strategy)
 */

import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  type IEventRepository,
  type EventQueryFilters,
} from '../ports/event-port.interface';
import { EventRecord } from '../domain/entities/event-record.entity';
import { ResourceId } from '../../finance/value-objects/resource-id.vo';
import { ResourceVersion } from '../../finance/value-objects/resource-version.vo';
import { EventState } from '../domain/value-objects/event-state.vo';
import { ResourceMetadata } from '../../finance/value-objects/resource-metadata.vo';
import type { PaginatedResult } from '../../../shared/types';

@Injectable()
export class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: ResourceId): Promise<EventRecord | null> {
    const row = await this.prisma.event.findUnique({
      where: { id: id.toString() },
    });
    if (!row) return null;
    return this._toEntity(row);
  }

  async findByOrg(orgId: string, page = 1, limit = 20): Promise<PaginatedResult<EventRecord>> {
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where: { org_id: orgId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.event.count({ where: { org_id: orgId } }),
    ]);
    return {
      data: rows.map(this._toEntity),
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  async findByOrgAndState(
    orgId: string,
    state: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<EventRecord>> {
    const skip = (page - 1) * limit;
    const where = { org_id: orgId, statut: state };
    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({ where, orderBy: { created_at: 'desc' }, skip, take: limit }),
      this.prisma.event.count({ where }),
    ]);
    return {
      data: rows.map(this._toEntity),
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  async create(record: EventRecord): Promise<EventRecord> {
    const now = new Date();
    const created = await this.prisma.event.create({
      data: this._toCreateInput(record, now),
    });
    return this._toEntity(created);
  }

  async update(id: ResourceId, record: EventRecord, expectedVersion: number): Promise<EventRecord> {
    const existing = await this.prisma.event.findUnique({ where: { id: id.toString() } });
    if (!existing) {
      throw new Error(`Event ${id} not found for update`);
    }
    if (existing.version !== expectedVersion) {
      throw new Error(
        `Version conflict: expected ${expectedVersion}, got ${existing.version}`,
      );
    }
    const updated = await this.prisma.event.update({
      where: { id: id.toString() },
      data: this._toUpdateInput(record),
    });
    return this._toEntity(updated);
  }

  async transitionState(id: ResourceId, fromState: string, toState: string): Promise<EventRecord> {
    const existing = await this.prisma.event.findUnique({ where: { id: id.toString() } });
    if (!existing) {
      throw new Error(`Event ${id} not found for state transition`);
    }
    if (existing.statut !== fromState) {
      throw new Error(
        `State mismatch: expected ${fromState}, got ${existing.statut}`,
      );
    }
    const updated = await this.prisma.event.update({
      where: { id: id.toString() },
      data: { statut: toState },
    });
    return this._toEntity(updated);
  }

  async delete(id: ResourceId): Promise<boolean> {
    try {
      await this.prisma.event.delete({ where: { id: id.toString() } });
      return true;
    } catch {
      // Entity may not exist or soft-delete triggered instead
      return false;
    }
  }

  // ====================================================================
  // Mapping Helpers
  // ====================================================================

  private _toEntity(row: Record<string, unknown>): EventRecord {
    return EventRecord.create({
      id: new ResourceId(row.id as string),
      orgId: row.org_id as string,
      createdBy: row.created_by as string,
      title: row.titre as string,
      eventType: row.type_evenement as string,
      startAt: new Date(row.date_debut as string),
      endAt: new Date(row.date_fin as string),
      location: row.lieu as string | null,
      responsibleUserId: (row.responsable as string) ?? null,
      description: row.description as string | null,
      state: row.statut as EventState,
      metadata: new ResourceMetadata(
        (row.metadata as Record<string, unknown>) ?? {},
      ),
    });
  }

  private _toCreateInput(
    record: EventRecord,
    createdAt: Date,
  ): Record<string, unknown> {
    return {
      id: record.id.toString(),
      org_id: record.orgId,
      created_by: record.createdBy,
      titre: record.title,
      type_evenement: record.eventType,
      date_debut: record.startAt,
      date_fin: record.endAt,
      lieu: record.location,
      responsable: record.responsibleUserId,
      description: record.description,
      statut: record.state,
      version: record.version.value,
      synced_at: null,
      local_updated_at: null,
      conflict_strategy: 'LWW',
      is_deleted: false,
      created_at: createdAt,
      updated_at: createdAt,
    };
  }

  private _toUpdateInput(record: EventRecord): Record<string, unknown> {
    return {
      titre: record.title,
      type_evenement: record.eventType,
      date_debut: record.startAt,
      date_fin: record.endAt,
      lieu: record.location,
      responsable: record.responsibleUserId,
      description: record.description,
      statut: record.state,
      version: record.version.value,
      updated_at: new Date(),
    };
  }
}
