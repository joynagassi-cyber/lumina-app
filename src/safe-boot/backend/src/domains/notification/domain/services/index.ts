/**
 * Domain services barrel exports for NotificationAggregate.
 */

export {
  NotificationRouter,
  type INotificationRouter,
  type DeliveryOutcome,
} from './notification-router.service';

export { RateLimitEnforcer, RateLimitExceededError, type INotificationRateLimiter } from './rate-limit-enforcer.service';
