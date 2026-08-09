/**
 * NotificationService — application layer commands for NotificationAggregate.
 *
 * Orchestrates domain entities, policies, and infrastructure ports to execute
 * user-facing commands: SendNotification, QueueNotification, MarkAsRead,
 * UpdatePreferences, SuppressUntil, SetRateLimit.
 *
 * @traceability DOC-012 Aggregate7 Commands autorisées
 */

import { INotificationRepository } from '../ports/notification-repository.port';
import { ChannelType } from '../domain/value-objects/channel-type.vo';
import { SeverityLevel } from '../domain/value-objects/severity-level.vo';
import { NotificationMessage } from '../domain/entities/notification-message.entity';
import { NotificationPreference } from '../domain/entities/notification-preference.entity';
import type { INotificationRouter } from '../domain/services/notification-router.service';
import { RateLimitConfig } from '../domain/value-objects/rate-limit-config.vo';
import type { INotificationRateLimiter } from '../domain/services/rate-limit-enforcer.service';
import type { QuietHoursPolicy } from '../domain/policies/quiet-hours-policy';
import type { NoUntriggeredNotificationPolicy } from '../domain/policies/untriggered-notification-policy';
import type { ChannelPreferencePolicy } from '../domain/policies/channel-preference-policy';

export class NotificationApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NotificationApplicationError';
  }
}

export class SendNotificationCommand {
  constructor(
    public readonly orgId: string,
    public readonly recipientUserId: string,
    public readonly subjectFr: string,
    public readonly subjectEn: string,
    public readonly bodyFr: string,
    public readonly bodyEn: string,
    public readonly channel: ChannelType,
    public readonly severity: SeverityLevel,
    /** Workflow ID or admin user ID that triggered this notification (BR-NOT-001). */
    public readonly triggeredBy: string,
    public readonly contextualData?: Record<string, unknown> | null,
  ) {}
}

export class MarkAsReadCommand {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly orgId: string,
  ) {}
}

export class UpdatePreferencesCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string,
    public readonly channels?: ChannelType[],
    public readonly severityMin?: SeverityLevel,
    public readonly maxPerHour?: number,
    public readonly quietHoursStart?: string | null,
    public readonly quietHoursEnd?: string | null,
  ) {}
}

export class SuppressUntilCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string,
    public readonly until: Date,
  ) {}
}

export class SetRateLimitCommand {
  constructor(
    public readonly userId: string,
    public readonly orgId: string,
    public readonly maxPerHour: number,
  ) {}
}

/**
 * Application service for all NotificationAggregate commands.
 */
export class NotificationService {
  private readonly repository: INotificationRepository;
  private readonly router: INotificationRouter;
  private readonly rateLimiter: INotificationRateLimiter;
  private readonly quietHoursPolicy: QuietHoursPolicy;

  constructor(
    repository: INotificationRepository,
    router: INotificationRouter,
    rateLimiter: INotificationRateLimiter,
    quietHoursPolicy: QuietHoursPolicy,
  ) {
    this.repository = repository;
    this.router = router;
    this.rateLimiter = rateLimiter;
    this.quietHoursPolicy = quietHoursPolicy;
  }

  /**
   * Queue a notification for delivery.
   * Applies BR-NOT-001 trigger check, rate limiting, and policy gates.
   * Returns the persisted notification ID.
   */
  async queueNotification(cmd: SendNotificationCommand): Promise<string> {
    // BR-NOT-001: Validate trigger is present (enforced by entity, but also here as guard).
    if (!cmd.triggeredBy || cmd.triggeredBy.length === 0) {
      throw new NotificationApplicationError(
        'MISSING_TRIGGER',
        'Every notification must have a trigger source per BR-NOT-001',
      );
    }

    // Create the domain entity with lifecycle state management.
    const message = NotificationMessage.create(
      cmd.orgId,
      cmd.recipientUserId,
      cmd.subjectFr,
      cmd.subjectEn,
      cmd.bodyFr,
      cmd.bodyEn,
      cmd.channel,
      cmd.severity,
      cmd.triggeredBy,
      cmd.contextualData,
    );

    // Fetch preferences to check rate limits and channel eligibility.
    const preference = await this.repository.findPreferenceByUserId(cmd.recipientUserId)
      ?? await this.repository.findPreferenceByOrg(cmd.orgId);

    // Check channel preference policy.
    const allowedChannels = this.router.resolveChannels(
      preference
        ? NotificationPreference.fromPersistence(preference)
        : NotificationPreference.create(cmd.recipientUserId, cmd.orgId),
    );

    if (!allowedChannels.includes(cmd.channel)) {
      throw new NotificationApplicationError(
        'CHANNEL_SUPPRESSED',
        `Channel '${cmd.channel}' is not allowed for this recipient`,
      );
    }

    // Save to persistence (queued state).
    const notificationId = await this.repository.save({
      org_id: cmd.orgId,
      recipient_user_id: cmd.recipientUserId,
      subject_fr: cmd.subjectFr,
      subject_en: cmd.subjectEn,
      body_fr: cmd.bodyFr,
      body_en: cmd.bodyEn,
      channel: cmd.channel,
      severity: cmd.severity,
      status: 'queued',
      contextual_data: cmd.contextualData ?? null,
      triggered_by: cmd.triggeredBy,
      sent_at: null,
      read_at: null,
      failed_at: null,
    });

    return notificationId;
  }

  /**
   * Send a queued notification through its designated channel.
   * This is called after queueing, typically by a background job or workflow step.
   */
  async sendNotification(notificationId: string): Promise<boolean> {
    const record = await this.repository.findById(notificationId);
    if (!record) {
      throw new NotificationApplicationError('NOT_FOUND', `Notification ${notificationId} not found`);
    }

    if (record.status !== 'queued') {
      throw new NotificationApplicationError(
        'INVALID_STATE',
        `Cannot send notification in state '${record.status}'`,
      );
    }

    const preference = await this.repository.findPreferenceByUserId(record.recipient_user_id)
      ?? await this.repository.findPreferenceByOrg(record.org_id);

    const message = NotificationMessage.fromPersistence(record as never);
    const pref = preference ? NotificationPreference.fromPersistence(preference) : null;

    // Rate limit check before sending.
    if (pref) {
      const allowed = await this.rateLimiter.enforce(
        record.recipient_user_id,
        record.org_id,
        pref,
      );
      if (!allowed) {
        await this.repository.updateStatus(notificationId, 'failed', {
          failed_at: new Date(),
        });
        return false;
      }
    }

    // Transition entity to sending.
    message.startSending();

    await this.repository.updateStatus(notificationId, 'sending');

    // Attempt delivery via router.
    const outcome = await this.router.deliver(message, pref ?? NotificationPreference.create('', record.org_id));

    if (outcome.success) {
      message.markSent();
      await this.repository.updateStatus(notificationId, 'sent', { sent_at: new Date() });
      return true;
    }

    message.markFailed(outcome.error ?? 'Unknown delivery error');
    await this.repository.updateStatus(notificationId, 'failed', {
      failed_at: new Date(),
    });
    return false;
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(cmd: MarkAsReadCommand): Promise<void> {
    const record = await this.repository.findById(cmd.notificationId);
    if (!record) {
      throw new NotificationApplicationError('NOT_FOUND', 'Notification not found');
    }
    if (record.status !== 'sent') {
      throw new NotificationApplicationError(
        'INVALID_STATE',
        'Can only mark sent notifications as read',
      );
    }

    await this.repository.markRead(cmd.notificationId);
  }

  /**
   * Update notification preferences for a user.
   */
  async updatePreferences(cmd: UpdatePreferencesCommand): Promise<void> {
    let preference = await this.repository.findPreferenceByUserId(cmd.userId);

    if (preference) {
      // Update existing.
      const updated = { ...preference };
      if (cmd.channels) updated.channels = cmd.channels;
      if (cmd.severityMin) updated.severity_min = cmd.severityMin;
      if (cmd.maxPerHour !== undefined) updated.rate_limit_max = cmd.maxPerHour;
      if (cmd.quietHoursStart !== undefined) {
        updated.quiet_hours_start = cmd.quietHoursStart;
        updated.quiet_hours_end = cmd.quietHoursEnd ?? null;
      }
      await this.repository.upsertPreference(updated);
    } else {
      // Create new preference record.
      await this.repository.upsertPreference({
        user_id: cmd.userId,
        channels: cmd.channels ?? [ChannelType.IN_APP],
        severity_min: cmd.severityMin ?? SeverityLevel.INFO,
        rate_limit_max: cmd.maxPerHour ?? 100,
        quiet_hours_start: cmd.quietHoursStart ?? null,
        quiet_hours_end: cmd.quietHoursEnd ?? null,
        org_id: cmd.orgId,
      });
    }
  }

  /**
   * Suppress notifications until a given time (enters quiet_hours mode).
   */
  async suppressUntil(cmd: SuppressUntilCommand): Promise<void> {
    const preference = await this.repository.findPreferenceByUserId(cmd.userId);
    if (!preference) {
      throw new NotificationApplicationError('NOT_FOUND', 'Preference record not found');
    }

    // Update to include suppression window.
    preference.quiet_hours_start = new Date().toTimeString().slice(0, 5);
    preference.quiet_hours_end = cmd.until.toTimeString().slice(0, 5);

    await this.repository.upsertPreference(preference);
  }

  /**
   * Set custom rate limit for a user.
   */
  async setRateLimit(cmd: SetRateLimitCommand): Promise<void> {
    const config = RateLimitConfig.create(cmd.maxPerHour);

    const preference = await this.repository.findPreferenceByUserId(cmd.userId);
    if (!preference) {
      await this.repository.upsertPreference({
        user_id: cmd.userId,
        channels: [ChannelType.IN_APP],
        severity_min: SeverityLevel.INFO,
        rate_limit_max: config.maxPerHour,
        quiet_hours_start: null,
        quiet_hours_end: null,
        org_id: cmd.orgId,
      });
      return;
    }

    preference.rate_limit_max = config.maxPerHour;
    await this.repository.upsertPreference(preference);
  }
}
