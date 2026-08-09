/**
 * NotificationModule — NestJS module wiring the NotificationAggregate.
 *
 * Registers domain services, policies, infrastructure adapters, and application
 * layer services using dependency injection. Adheres to Ports & Adapters architecture.
 *
 * @traceability DOC-012 Aggregate7 (full implementation wiring)
 *   → PAS-v1 (Dependency Inversion: Domain Port ← Infrastructure Adapter)
 */

import { Module } from '@nestjs/common';
import { I_CHANNEL_PORT } from './ports/channel.port';
import type { ChannelPort } from './ports/channel.port';
import type { INotificationRepository } from './ports/notification-repository.port';
import { INOTIFICATION_REPOSITORY } from './ports/notification-repository.port';
import { NotificationService } from './application/notification.service';
import { NotificationRouter, type INotificationRouter } from './domain/services/notification-router.service';
import { RateLimitEnforcer, type INotificationRateLimiter } from './domain/services/rate-limit-enforcer.service';
import { QuietHoursPolicy } from './domain/policies/quiet-hours-policy';
import { ChannelPreferencePolicy } from './domain/policies/channel-preference-policy';
import { NoUntriggeredNotificationPolicy } from './domain/policies/untriggered-notification-policy';
import { InAppChannelAdapter } from './infrastructure/adapters/in-app-channel.adapter';
import { PushChannelAdapter } from './infrastructure/adapters/push-channel.adapter';
import { EmailChannelAdapter } from './infrastructure/adapters/email-channel.adapter';
import { NotificationRepository } from './infrastructure/adapters/notification.repository';

// Token for the user/org org-resolver needed by the repository.
const USER_ORG_RESOLVER = 'USER_ORG_RESOLVER';

export const INOTIFICATION_RATE_LIMITER = 'INOTIFICATION_RATE_LIMITER';

@Module({
  providers: [
    // --- Policies (singleton stateless) ---
    QuietHoursPolicy,
    ChannelPreferencePolicy,
    NoUntriggeredNotificationPolicy,

    // --- Infrastructure Ports (repositories) ---
    {
      provide: INOTIFICATION_REPOSITORY,
      useFactory: (prisma: unknown, userOrgResolver: unknown) =>
        new NotificationRepository(prisma, userOrgResolver as (uid: string) => Promise<string>),
      inject: ['PRISMA_CLIENT', USER_ORG_RESOLVER],
    },

    // --- Channel Ports ---
    {
      provide: I_CHANNEL_PORT + ':in_app',
      useClass: InAppChannelAdapter,
    },
    {
      provide: I_CHANNEL_PORT + ':push',
      useClass: PushChannelAdapter,
    },
    {
      provide: I_CHANNEL_PORT + ':email',
      useClass: EmailChannelAdapter,
    },

    // --- Domain Services ---
    {
      provide: 'CHANNEL_PORT_MAP',
      useFactory: (inApp: InAppChannelAdapter, push: PushChannelAdapter, email: EmailChannelAdapter) =>
        new Map<string, ChannelPort>([
          ['in_app', inApp],
          ['push', push],
          ['email', email],
        ]),
      inject: [I_CHANNEL_PORT + ':in_app', I_CHANNEL_PORT + ':push', I_CHANNEL_PORT + ':email'],
    },
    {
      provide: INOTIFICATION_RATE_LIMITER,
      useFactory: (repo: INotificationRepository) => new RateLimitEnforcer(repo),
      inject: [INOTIFICATION_REPOSITORY],
    },
    {
      provide: 'NOTIFICATION_ROUTER',
      useFactory: (
        channelPortMap: Map<string, unknown>,
        quietHoursPolicy: QuietHoursPolicy,
        channelPrefPolicy: ChannelPreferencePolicy,
      ) => new NotificationRouter(channelPortMap as never, quietHoursPolicy, channelPrefPolicy),
      inject: [
        'CHANNEL_PORT_MAP',
        QuietHoursPolicy,
        ChannelPreferencePolicy,
      ],
    },

    // --- Application Service ---
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
