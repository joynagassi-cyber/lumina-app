/**
 * NotificationAdapter — Sends invitation notifications via email/push/SMS
 *
 * Optional adapter for sending invitations to targets. Can be implemented
 * with email service, push notification service, or SMS gateway.
 *
 * @traceability ORG-008 NotificationAdapter — INV-Notification v1
 */

import { Injectable } from '@nestjs/common';
import { Invite } from '../../domain/entities/invite.entity';

export type NotificationChannel = 'email' | 'push' | 'sms';

export interface NotificationOptions {
  subject: string;
  body: string;
  template?: string;
  variables?: Record<string, unknown>;
}

@Injectable()
class NotificationAdapter {
  /**
   * Send an invitation notification via the specified channel.
 */
  async send(invite: Invite, channel: NotificationChannel, options?: NotificationOptions): Promise<void> {
    // Implementation delegated to specific transport (email, push, etc.)
    // This is a placeholder — in production, integrate with actual notification services
    console.log(`[Notification] Sending invitation ${invite.id.value} via ${channel}`);
  }

  /**
   * Send email notification.
 */
  async sendEmail(invite: Invite, options?: NotificationOptions): Promise<void> {
    await this.send(invite, 'email', options);
  }

  /**
   * Send push notification.
 */
  async sendPush(invite: Invite, options?: NotificationOptions): Promise<void> {
    await this.send(invite, 'push', options);
  }

  /**
   * Send SMS notification.
 */
  async sendSms(invite: Invite, options?: NotificationOptions): Promise<void> {
    await this.send(invite, 'sms', options);
  }
}

export default NotificationAdapter;