/**
 * NotificationService Unit Tests — Positive Cases
 *
 * Tests notification operations: queueNotification, sendNotification, markAsRead,
 * updatePreferences, suppressUntil, setRateLimit.
 * @traceability DOC-012 Aggregate7 NotificationService
 */

import { NotificationService, NotificationApplicationError } from '@/domains/notification/application/notification.service';
import { ChannelType } from '@/domains/notification/domain/value-objects/channel-type.vo';
import { SeverityLevel } from '@/domains/notification/domain/value-objects/severity-level.vo';

/** Assert that fn() rejects with a NotificationApplicationError carrying the given code. */
async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected NotificationApplicationError with code ${code}`);
  } catch (e) {
    expect(e).toBeInstanceOf(NotificationApplicationError);
    expect((e as NotificationApplicationError).code).toBe(code);
  }
}

// Mock implementations
class MockNotificationRepository {
  findPreferenceByUserId = jest.fn().mockResolvedValue(null);
  findPreferenceByOrg = jest.fn().mockResolvedValue(null);
  save = jest.fn().mockResolvedValue('notif-id-1');
  findById = jest.fn().mockResolvedValue(null);
  markRead = jest.fn().mockResolvedValue(undefined);
  upsertPreference = jest.fn().mockResolvedValue(undefined);
  updateStatus = jest.fn().mockResolvedValue(undefined);
}

class MockNotificationRouter {
  resolveChannels = jest.fn().mockReturnValue([ChannelType.IN_APP]);
  deliver = jest.fn().mockResolvedValue({ success: true });
}

class MockRateLimiter {
  enforce = jest.fn().mockResolvedValue(true);
}

class MockQuietHoursPolicy {
  isWithinAllowedWindow = jest.fn().mockReturnValue(true);
}

describe('NotificationService', () => {
  let service: NotificationService;
  let repoMock: MockNotificationRepository;
  let routerMock: MockNotificationRouter;
  let limiterMock: MockRateLimiter;
  let quietHoursMock: MockQuietHoursPolicy;

  beforeEach(() => {
    repoMock = new MockNotificationRepository();
    routerMock = new MockNotificationRouter();
    limiterMock = new MockRateLimiter();
    quietHoursMock = new MockQuietHoursPolicy();

    service = new NotificationService(
      repoMock as any,
      routerMock as any,
      limiterMock as any,
      quietHoursMock as any,
    );
  });

  describe('queueNotification', () => {
    const validCmd = {
      orgId: 'org-1',
      recipientUserId: 'user-1',
      subjectFr: 'Subject',
      subjectEn: 'Subject',
      bodyFr: 'Body',
      bodyEn: 'Body',
      channel: ChannelType.IN_APP,
      severity: SeverityLevel.INFO,
      triggeredBy: 'admin-1',
    };

    it('should queue notification successfully (positive)', async () => {
      // Act
      const result = await service.queueNotification(validCmd);

      // Assert
      expect(result).toBe('notif-id-1');
      expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({
        org_id: 'org-1',
        recipient_user_id: 'user-1',
        channel: ChannelType.IN_APP,
        severity: SeverityLevel.INFO,
        status: 'queued',
        triggered_by: 'admin-1',
      }));
    });

    it('should reject when triggeredBy is missing (BR-NOT-001)', async () => {
      await expectErrorCode(
        service.queueNotification({ ...validCmd, triggeredBy: '' }),
        'MISSING_TRIGGER',
      );
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('should reject when channel is not allowed by preference', async () => {
      routerMock.resolveChannels.mockReturnValue([ChannelType.IN_APP]); // Only in_app allowed

      await expectErrorCode(
        service.queueNotification({ ...validCmd, channel: ChannelType.EMAIL }),
        'CHANNEL_SUPPRESSED',
      );
      expect(repoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('sendNotification', () => {
    it('should send queued notification successfully (positive)', async () => {
      // Arrange
      repoMock.findById.mockResolvedValue({
        id: 'notif-id-1',
        org_id: 'org-1',
        recipient_user_id: 'user-1',
        status: 'queued',
        channel: ChannelType.IN_APP,
        severity: SeverityLevel.INFO,
      } as any);
      repoMock.findPreferenceByUserId.mockResolvedValue({ channels: [], rate_limit_max: 100, severity_min: SeverityLevel.INFO, quiet_hours_start: null, quiet_hours_end: null } as any);
      limiterMock.enforce.mockResolvedValue(true);
      routerMock.deliver.mockResolvedValue({ success: true });

      // Act
      const result = await service.sendNotification('notif-id-1');

      // Assert
      expect(result).toBe(true);
      expect(repoMock.updateStatus).toHaveBeenCalledWith('notif-id-1', 'sent', expect.objectContaining({ sent_at: expect.any(Date) }));
    });

    it('should fail when notification not found', async () => {
      repoMock.findById.mockResolvedValue(null);

      await expectErrorCode(service.sendNotification('non-existent'), 'NOT_FOUND');
    });

    it('should fail when notification not in queued state', async () => {
      repoMock.findById.mockResolvedValue({ id: 'notif-id-1', status: 'sent' } as any);

      await expectErrorCode(service.sendNotification('notif-id-1'), 'INVALID_STATE');
    });

    it('should fail when rate limit enforcement rejects', async () => {
      // Arrange
      repoMock.findById.mockResolvedValue({ id: 'notif-id-1', status: 'queued', recipient_user_id: 'user-1', org_id: 'org-1' } as any);
      repoMock.findPreferenceByUserId.mockResolvedValue({ channels: [], rate_limit_max: 1, severity_min: SeverityLevel.INFO, quiet_hours_start: null, quiet_hours_end: null } as any);
      limiterMock.enforce.mockResolvedValue(false);

      // Act
      const result = await service.sendNotification('notif-id-1');

      // Assert
      expect(result).toBe(false);
      expect(repoMock.updateStatus).toHaveBeenCalledWith('notif-id-1', 'failed', expect.any(Object));
    });
  });

  describe('markAsRead', () => {
    it('should mark sent notification as read (positive)', async () => {
      repoMock.findById.mockResolvedValue({ id: 'notif-1', status: 'sent' } as any);

      await service.markAsRead({ notificationId: 'notif-1', userId: 'user-1', orgId: 'org-1' });

      expect(repoMock.markRead).toHaveBeenCalledWith('notif-1');
    });

    it('should fail when notification not found', async () => {
      repoMock.findById.mockResolvedValue(null);

      await expectErrorCode(
        service.markAsRead({ notificationId: 'non-existent', userId: 'user-1', orgId: 'org-1' }),
        'NOT_FOUND',
      );
    });

    it('should fail when notification not in sent state', async () => {
      repoMock.findById.mockResolvedValue({ id: 'notif-1', status: 'queued' } as any);

      await expectErrorCode(
        service.markAsRead({ notificationId: 'notif-1', userId: 'user-1', orgId: 'org-1' }),
        'INVALID_STATE',
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update existing preference (positive)', async () => {
      const existing = { user_id: 'user-1', org_id: 'org-1' } as any;
      repoMock.findPreferenceByUserId.mockResolvedValue(existing);

      await service.updatePreferences({ userId: 'user-1', orgId: 'org-1', channels: [ChannelType.IN_APP] });

      expect(repoMock.upsertPreference).toHaveBeenCalledWith(
        expect.objectContaining({ channels: [ChannelType.IN_APP] }),
      );
    });

    it('should create new preference if none exists (positive)', async () => {
      repoMock.findPreferenceByUserId.mockResolvedValue(null);

      await service.updatePreferences({ userId: 'user-1', orgId: 'org-1', channels: [ChannelType.IN_APP] });

      expect(repoMock.upsertPreference).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          channels: [ChannelType.IN_APP],
          severity_min: SeverityLevel.INFO,
          rate_limit_max: 100,
          org_id: 'org-1',
        }),
      );
    });
  });

  describe('suppressUntil', () => {
    it('should suppress notifications until given time (positive)', async () => {
      const existing = { user_id: 'user-1', quiet_hours_start: null } as any;
      repoMock.findPreferenceByUserId.mockResolvedValue(existing);

      await service.suppressUntil({ userId: 'user-1', orgId: 'org-1', until: new Date('2026-01-02T08:00:00') });

      expect(repoMock.upsertPreference).toHaveBeenCalledWith(
        expect.objectContaining({
          quiet_hours_start: expect.stringMatching(/^\d{2}:\d{2}$/),
          quiet_hours_end: expect.stringMatching(/^\d{2}:\d{2}$/),
        }),
      );
    });

    it('should throw when preference not found', async () => {
      repoMock.findPreferenceByUserId.mockResolvedValue(null);

      await expectErrorCode(
        service.suppressUntil({ userId: 'user-1', orgId: 'org-1', until: new Date() }),
        'NOT_FOUND',
      );
    });
  });

  describe('setRateLimit', () => {
    it('should create a preference with the custom rate limit (positive)', async () => {
      repoMock.findPreferenceByUserId.mockResolvedValue(null);

      await service.setRateLimit({ userId: 'user-1', orgId: 'org-1', maxPerHour: 50 });

      expect(repoMock.upsertPreference).toHaveBeenCalledWith(
        expect.objectContaining({ rate_limit_max: 50, user_id: 'user-1', org_id: 'org-1' }),
      );
    });
  });
});
