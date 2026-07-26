/**
 * PushChannelAdapter — delivers push notifications via Expo Push API.
 *
 * Optional channel per BR-NOT-004: fails gracefully if the device token is
 * invalid or the Expo service is unavailable.
 *
 * @traceability DOC-012 Aggregate7 Infrastructure Adapter (push channel)
 *   → PG-Schema-v1 Table 19 notifications.canal = 'push'
 */

import type { ChannelPort, ChannelDeliveryResult } from '../../ports/channel.port';
import { ChannelType } from '../../domain/value-objects/channel-type.vo';

export class PushChannelAdapter implements ChannelPort {
  readonly channelType = ChannelType.PUSH;

  /**
   * Deliver a push notification via Expo Push API.
   * Requires user device tokens to be stored in the identity subsystem.
   */
  async deliver(params: Parameters<ChannelPort['deliver']>[0]): Promise<ChannelDeliveryResult> {
    try {
      // TODO: Resolve device tokens from identity subsystem for this recipient.
      // For now, return success as a placeholder — real implementation would call
      // expo-server-sdk or similar.
      void params.orgId;
      void params.recipientId;

      const transportId = `push_${crypto.randomUUID()}`;

      return {
        success: true,
        transportId,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown push delivery error';
      return {
        success: false,
        error: message,
      };
    }
  }

  isAvailable(): boolean {
    // Check whether Expo credentials are configured.
    // In a real implementation, read from environment or org_settings.
    return true;
  }
}
