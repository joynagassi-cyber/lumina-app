/**
 * NotificationRepository — INotificationRepository implementation using Prisma.
 *
 * Maps database records to domain shapes, enforces org-scoped queries.
 * Implements the persistence port for both notifications and preferences.
 *
 * @traceability DOC-012 Aggregate7 Infrastructure Adapter (notification repository)
 *   → PG-Schema-v1 Table 19 (notifications), Table 20 (notification_preferences),
 *     Table 21 (notification_logs)
 */

import type {
  INotificationRepository,
  NotificationMessageRecord,
  NotificationPreferenceRecord,
} from '../../ports/notification-repository.port';

export class NotificationRepository implements INotificationRepository {
  constructor(
    private readonly prisma: unknown,
    private readonly userOrgResolver: (userId: string) => Promise<string>,
  ) {}

  async findById(id: string): Promise<NotificationMessageRecord | null> {
    // TODO: Implement with Prisma query on notifications table.
    void id;
    return null;
  }

  async findByOrgAndRecipient(
    orgId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ data: NotificationMessageRecord[]; total: number }> {
    // TODO: Implement paginated query scoped to org_id + recipient_user_id.
    void orgId;
    void userId;
    void page;
    void limit;
    return { data: [], total: 0 };
  }

  async save(
    record: Omit<NotificationMessageRecord, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<string> {
    // TODO: INSERT into notifications table, return generated UUID.
    void record;
    return crypto.randomUUID();
  }

  async updateStatus(
    id: string,
    status: 'sending' | 'sent' | 'failed',
    extras?: Partial<Pick<NotificationMessageRecord, 'sent_at' | 'failed_at'>>,
  ): Promise<void> {
    // TODO: UPDATE notifications SET statut_notification = ? WHERE id = ?
    void id;
    void status;
    void extras;
  }

  async markRead(id: string): Promise<void> {
    // TODO: UPDATE notifications SET statut_notification = 'read', date_lecture = NOW() WHERE id = ?
    void id;
  }

  async upsertPreference(
    record: Omit<NotificationPreferenceRecord, 'id'>,
  ): Promise<void> {
    // TODO: UPSERT into notification_preferences using user_id as unique key.
    void record;
  }

  async findPreferenceByUserId(userId: string): Promise<NotificationPreferenceRecord | null> {
    // TODO: SELECT FROM notification_preferences WHERE user_id = ?
    void userId;
    return null;
  }

  async findPreferenceByOrg(orgId: string): Promise<NotificationPreferenceRecord | null> {
    // TODO: SELECT FROM notification_preferences WHERE org_id = ? AND user_id IS NULL
    void orgId;
    return null;
  }
}
