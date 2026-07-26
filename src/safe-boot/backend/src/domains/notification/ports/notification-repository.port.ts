/**
 * INotificationRepository — port interface for NotificationAggregate persistence.
 *
 * Infrastructure adapters implement this interface. Domain and application layers
 * depend only on this contract (Dependency Inversion Principle).
 *
 * @traceability DOC-012 Aggregate7 (NotificationAggregate Entities)
 *   → PG-Schema-v1 Table 19 (notifications), Table 20 (notification_preferences)
 */

import type { ChannelType } from '../domain/value-objects/channel-type.vo';
import type { SeverityLevel } from '../domain/value-objects/severity-level.vo';

export type NotificationMessageRecord = {
  id: string;
  org_id: string;
  recipient_user_id: string;
  subject_fr: string;
  subject_en: string;
  body_fr: string;
  body_en: string;
  channel: string;
  severity: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'read';
  contextual_data: Record<string, unknown> | null;
  triggered_by: string | null;
  sent_at: Date | null;
  read_at: Date | null;
  failed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type NotificationPreferenceRecord = {
  id: string;
  user_id: string;
  channels: string[];
  severity_min: string;
  rate_limit_max: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  org_id: string;
};

export interface INotificationRepository {
  findById(id: string): Promise<NotificationMessageRecord | null>;
  findByOrgAndRecipient(
    orgId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ data: NotificationMessageRecord[]; total: number }>;
  save(record: Omit<NotificationMessageRecord, 'id' | 'created_at' | 'updated_at'>): Promise<string>;
  updateStatus(
    id: string,
    status: 'sending' | 'sent' | 'failed',
    extras?: Partial<Pick<NotificationMessageRecord, 'sent_at' | 'failed_at'>>,
  ): Promise<void>;
  markRead(id: string): Promise<void>;
  upsertPreference(record: Omit<NotificationPreferenceRecord, 'id'>): Promise<void>;
  findPreferenceByUserId(userId: string): Promise<NotificationPreferenceRecord | null>;
  findPreferenceByOrg(orgId: string): Promise<NotificationPreferenceRecord | null>;
}

export const INOTIFICATION_REPOSITORY = 'INOTIFICATION_REPOSITORY';
