/**
 * Domain Value Objects barrel exports for NotificationAggregate.
 */

export { ChannelType, isAlwaysDelivered, OPTIONAL_CHANNELS } from './channel-type.vo';
export type { ChannelType as ChannelTypeEnum } from './channel-type.vo';

export {
  SeverityLevel,
  SEVERITY_PRIORITY,
  isCritical,
  severityRank,
} from './severity-level.vo';
export type { SeverityLevel as SeverityLevelEnum } from './severity-level.vo';

export { MessageTemplate } from './message-template.vo';

export { RateLimitConfig } from './rate-limit-config.vo';
