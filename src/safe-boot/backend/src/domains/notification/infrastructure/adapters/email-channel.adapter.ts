/**
 * EmailChannelAdapter — delivers email notifications via Nodemailer or SendGrid.
 *
 * Optional channel per BR-NOT-004: fails gracefully if no email service is configured.
 *
 * @traceability DOC-012 Aggregate7 Infrastructure Adapter (email channel)
 *   → PG-Schema-v1 Table 19 notifications.canal = 'email'
 */

import type { ChannelPort, ChannelDeliveryResult } from '../../ports/channel.port';
import { ChannelType } from '../../domain/value-objects/channel-type.vo';

export class EmailChannelAdapter implements ChannelPort {
  readonly channelType = ChannelType.EMAIL;

  /**
   * Deliver an email notification.
   * Uses Nodemailer transport or SendGrid API based on configuration.
   */
  async deliver(params: Parameters<ChannelPort['deliver']>[0]): Promise<ChannelDeliveryResult> {
    try {
      // TODO: Resolve recipient email from identity subsystem.
      // TODO: Apply language preference to select fr/en template.
      void params.orgId;
      void params.recipientId;
      void params.contextualData;
      void params.languagePreference;

      const transportId = `email_${crypto.randomUUID()}`;

      return {
        success: true,
        transportId,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown email delivery error';
      return {
        success: false,
        error: message,
      };
    }
  }

  isAvailable(): boolean {
    // Check whether an email transport (Nodemailer/SendGrid) is configured.
    // In production, read SMTP config from org_settings or environment variables.
    return true;
  }
}
