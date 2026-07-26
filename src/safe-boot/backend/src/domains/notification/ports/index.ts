/**
 * Notification domain ports barrel exports.
 */

export type {
  ChannelDeliveryResult,
  ChannelPort,
} from './channel.port';

export { I_CHANNEL_PORT } from './channel.port';

export type {
  NotificationMessageRecord,
  NotificationPreferenceRecord,
  INotificationRepository,
} from './notification-repository.port';

export { INOTIFICATION_REPOSITORY } from './notification-repository.port';
