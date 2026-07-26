/**
 * IEventRepository — Port interface for EventAggregate persistence.
 * Infrastructure adapters implement this interface; application services depend on it (DIP).
 *
 * @traceability DOC-012 Aggregate3 (EventRecord), PG-Schema-v1 Table 9 (events)
 *              PAS-v1 DR-004 (AdapterLooseCoupling)
 */

import { EventRecord } from '../domain/entities/event-record.entity';
import { ResourceId } from '../../finance/value-objects/resource-id.vo';
import type { PaginatedResult } from '../../../shared/types';

export type EventQueryFilters = {
  orgId: string;
  state?: string;
  eventType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
};

export interface IEventRepository {
  findById(id: ResourceId): Promise<EventRecord | null>;
  findByOrg(orgId: string, page?: number, limit?: number): Promise<PaginatedResult<EventRecord>>;
  findByOrgAndState(orgId: string, state: string, page?: number, limit?: number): Promise<PaginatedResult<EventRecord>>;
  create(record: EventRecord): Promise<EventRecord>;
  update(id: ResourceId, record: EventRecord, expectedVersion: number): Promise<EventRecord>;
  transitionState(id: ResourceId, fromState: string, toState: string): Promise<EventRecord>;
  delete(id: ResourceId): Promise<boolean>;
}
