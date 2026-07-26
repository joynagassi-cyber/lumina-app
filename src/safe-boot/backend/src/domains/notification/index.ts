/**
 * NotificationAggregate — full domain export barrel.
 *
 * Re-exports all public-facing types, classes, and ports for consumption by
 * other modules (controllers, workflows, etc.).
 *
 * @traceability DOC-012 Aggregate7 (complete domain model implementation)
 *   → PG-Schema-v1 Table 19, 20, 21
 */

// --- Ports (Domain-layer contracts) ---
export type {
  ChannelDeliveryResult,
  ChannelPort as INotificationChannelPort,
} from './ports/channel.port';
export type {
  NotificationMessageRecord,
  NotificationPreferenceRecord,
  INotificationRepository,
} from './ports/notification-repository.port';

// --- Domain Value Objects ---
export {
  ChannelType,
  isAlwaysDelivered,
  OPTIONAL_CHANNELS,
} from './domain/value-objects/channel-type.vo';
export {
  SeverityLevel,
  SEVERITY_PRIORITY,
  isCritical,
  severityRank,
} from './domain/value-objects/severity-level.vo';
export { MessageTemplate } from './domain/value-objects/message-template.vo';
export { RateLimitConfig } from './domain/value-objects/rate-limit-config.vo';

// --- Domain Entities ---
export {
  NotificationMessage,
  type NotificationMessageState,
} from './domain/entities/notification-message.entity';
export {
  NotificationPreference,
  type QuietHoursRange,
  type PreferenceMode,
} from './domain/entities/notification-preference.entity';

// --- Domain Events ---
export {
  NotificationQueued,
  NotificationSent,
  NotificationFailed,
  NotificationMarkedRead,
  PreferencesUpdated,
} from './domain/events';

// --- Domain Services ---
export {
  NotificationRouter,
  type INotificationRouter,
  type DeliveryOutcome,
} from './domain/services/notification-router.service';
export {
  RateLimitEnforcer,
  RateLimitExceededError,
  type INotificationRateLimiter,
} from './domain/services/rate-limit-enforcer.service';

// --- Domain Policies ---
export {
  NoUntriggeredNotificationPolicy,
  UntriggeredNotificationError,
} from './domain/policies/untriggered-notification-policy';
export {
  ChannelPreferencePolicy,
  type IChannelPreferencePolicy,
} from './domain/policies/channel-preference-policy';
export {
  QuietHoursPolicy,
  type IQuietHoursPolicy,
} from './domain/policies/quiet-hours-policy';

// --- Application Layer ---
export {
  NotificationService,
  NotificationApplicationError,
  SendNotificationCommand,
  MarkAsReadCommand,
  UpdatePreferencesCommand,
  SuppressUntilCommand,
  SetRateLimitCommand,
} from './application/notification.service';

// --- Infrastructure Adapters ---
export { InAppChannelAdapter } from './infrastructure/adapters/in-app-channel.adapter';
export { PushChannelAdapter } from './infrastructure/adapters/push-channel.adapter';
export { EmailChannelAdapter } from './infrastructure/adapters/email-channel.adapter';
export { NotificationRepository } from './infrastructure/adapters/notification.repository';

// --- Module ---
export { NotificationModule } from './notification.module';

// --- Port Tokens ---
export { INOTIFICATION_REPOSITORY } from './ports/notification-repository.port';
