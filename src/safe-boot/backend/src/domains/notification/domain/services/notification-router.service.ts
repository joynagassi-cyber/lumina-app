/**
 * NotificationRouter — routes notifications to the correct channel adapter.
 *
 * Determines which channel(s) to deliver through based on user preferences,
 * respects policy constraints (QuietHoursPolicy, ChannelPreferencePolicy),
 * and orchestrates graceful degradation for optional channels.
 *
 * BR-NOT-001: Always triggered (enforced at entity creation).
 * BR-NOT-003: In-app always delivered (offline first).
 * BR-NOT-004: Push/email/sms optional — fail gracefully.
 *
 * @traceability DOC-012 Aggregate7 DomainService NotificationRouter → PG-Schema-v1 Table 19
 */

import { INotificationChannelPort } from '../../ports/channel.port';
import { ChannelType } from '../value-objects/channel-type.vo';
import { SeverityLevel } from '../value-objects/severity-level.vo';
import type { NotificationMessage } from '../entities/notification-message.entity';
import type { NotificationPreference } from '../entities/notification-preference.entity';
import type { QuietHoursPolicy } from '../policies/quiet-hours-policy';
import type { ChannelPreferencePolicy } from '../policies/channel-preference-policy';

export type DeliveryOutcome = {
  success: boolean;
  channel: ChannelType;
  transportId?: string | null;
  error?: string | null;
};

export interface INotificationRouter {
  /**
   * Route a single notification through its preferred channel.
   * Returns the outcome of the delivery attempt.
   */
  deliver(
    message: NotificationMessage,
    preference: NotificationPreference,
  ): Promise<DeliveryOutcome>;

  /** Determine which channels should be used based on preferences. */
  resolveChannels(preference: NotificationPreference): ChannelType[];
}

export class NotificationRouter implements INotificationRouter {
  private readonly channels: ReadonlyMap<ChannelType, INotificationChannelPort>;
  private readonly quietHoursPolicy: QuietHoursPolicy;
  private readonly channelPreferencePolicy: ChannelPreferencePolicy;

  constructor(
    channels: ReadonlyMap<ChannelType, INotificationChannelPort>,
    quietHoursPolicy: QuietHoursPolicy,
    channelPreferencePolicy: ChannelPreferencePolicy,
  ) {
    this.channels = channels;
    this.quietHoursPolicy = quietHoursPolicy;
    this.channelPreferencePolicy = channelPreferencePolicy;
  }

  resolveChannels(preference: NotificationPreference): ChannelType[] {
    return this.channelPreferencePolicy.resolveAllowedChannels(
      preference,
    );
  }

  async deliver(
    message: NotificationMessage,
    preference: NotificationPreference,
  ): Promise<DeliveryOutcome> {
    // BR-NOT-005: Critical severity bypasses quiet hours
    if (
      message.severity !== SeverityLevel.CRITICAL
      && !this.quietHoursPolicy.isWithinAllowedWindow(message, preference)
    ) {
      return {
        success: false,
        channel: message.channel,
        error: 'Notification suppressed during quiet hours',
      };
    }

    const port = this.channels.get(message.channel);
    if (!port) {
      return {
        success: false,
        channel: message.channel,
        error: `No channel port registered for type '${message.channel}'`,
      };
    }

    if (!port.isAvailable()) {
      // BR-NOT-004: Graceful degradation for optional channels
      return {
        success: false,
        channel: message.channel,
        error: `Channel '${message.channel}' is not available`,
      };
    }

    const result = await port.deliver({
      orgId: message.orgId,
      recipientId: message.recipientUserId,
      subjectFr: message.subjectFr,
      subjectEn: message.subjectEn,
      bodyFr: message.bodyFr,
      bodyEn: message.bodyEn,
      severity: message.severity,
      contextualData: message.contextualData,
    });

    return {
      success: result.success,
      channel: message.channel,
      transportId: result.transportId,
      error: result.error,
    };
  }
}
