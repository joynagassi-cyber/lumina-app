/**
 * ChannelPreferencePolicy — enforces BR-NOT-004 and user channel preferences.
 *
 * When a notification is queued, this policy checks the recipient's preferences
 * to determine which channels are actually eligible for delivery. If the requested
 * channel is disabled in the user's preference, the policy filters it out.
 *
 * @traceability DOC-012 Aggregate7 Policies (ChannelPreferencePolicy)
 *   → PG-Schema-v1 Table 20 notification_preferences.canaux_autorises text[]
 */

import { ChannelType, OPTIONAL_CHANNELS, isAlwaysDelivered } from '../value-objects/channel-type.vo';
import type { NotificationPreference } from '../entities/notification-preference.entity';

export interface IChannelPreferencePolicy {
  /**
   * Determine whether the given channel is allowed by the user's preferences.
   * Returns true if the channel is permitted, false if filtered out.
   */
  isChannelAllowed(channel: ChannelType, preference: NotificationPreference): boolean;

  /**
   * Resolve the effective list of channels for a notification.
   * If the user has no preference record, returns the requested channel as-is.
   */
  resolveEffectiveChannels(
    requestedChannel: ChannelType,
    preference: NotificationPreference | null,
  ): ChannelType[];
}

export class ChannelPreferencePolicy implements IChannelPreferencePolicy {
  isChannelAllowed(channel: ChannelType, preference: NotificationPreference): boolean {
    // In-app is always allowed per BR-NOT-003 (offline first, never suppressed).
    if (isAlwaysDelivered(channel)) {
      return true;
    }

    // Check against user's allowed channels list.
    return preference.channels.includes(channel);
  }

  resolveEffectiveChannels(
    requestedChannel: ChannelType,
    preference: NotificationPreference | null,
  ): ChannelType[] {
    // No preference record: deliver on the requested channel.
    if (!preference) {
      return [requestedChannel];
    }

    // Always include in-app regardless of preference.
    const allowed: ChannelType[] = [ChannelType.IN_APP];

    if (this.isChannelAllowed(requestedChannel, preference)) {
      allowed.push(requestedChannel);
    }

    return allowed;
  }
}
