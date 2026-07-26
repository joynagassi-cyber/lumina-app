/**
 * INotificationChannelPort — abstraction over delivery channels.
 *
 * Each channel type (in_app, push, email, sms) is an independent adapter implementing
 * this port. Channels may fail gracefully (BR-NOT-004): push/email/sms are optional,
 * in-app is always delivered (BR-NOT-003).
 *
 * @traceability DOC-012 Aggregate7 (NotificationRouter domain service)
 *   → PG-Schema-v1 Table 19 (notifications.canal enum)
 */

export interface ChannelDeliveryResult {
  /** Whether the delivery attempt succeeded. */
  success: boolean;
  /** Internal transport identifier (e.g. Expo push id, email message id). */
  transportId?: string | null;
  /** Error description when success is false. */
  error?: string | null;
}

export interface ChannelPort {
  /** Unique identifier for the channel (e.g. 'in_app', 'push'). */
  readonly channelType: string;

  /**
   * Deliver a notification through this channel.
   * May throw on unrecoverable errors (invalid recipient address).
   * Returns success status with optional transport identifier.
   */
  deliver(params: {
    orgId: string;
    recipientId: string;
    subjectFr: string;
    subjectEn: string;
    bodyFr: string;
    bodyEn: string;
    severity: string;
    contextualData?: Record<string, unknown> | null;
    languagePreference?: string;
  }): Promise<ChannelDeliveryResult>;

  /**
   * Check whether this channel is available (e.g. email credentials configured).
   * Returns true by default for optional channels so graceful degradation applies.
   */
  isAvailable(): boolean;
}

export const I_CHANNEL_PORT = 'I_CHANNEL_PORT';
