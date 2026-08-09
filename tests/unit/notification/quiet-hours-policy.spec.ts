/**
 * QuietHoursPolicy Tests
 *
 * Tests quiet hours enforcement for notifications.
 * @traceability DOC-012 BR-NOT-005, QuietHoursPolicy
 */

import { QuietHoursPolicy } from '@/domains/notification/domain/policies/quiet-hours-policy';
import { SeverityLevel, isCritical } from '@/domains/notification/domain/value-objects/severity-level.vo';

describe('QuietHoursPolicy', () => {
  const policy = new QuietHoursPolicy();

  describe('isWithinAllowedWindow', () => {
    it('should allow critical severity notifications even during quiet hours (BR-NOT-005)', () => {
      // Arrange - Mock message with critical severity
      const message = { severity: SeverityLevel.CRITICAL } as any;
      const preference = { quietHours: { start: '22:00', end: '07:00' }, mode: 'quiet_hours' };

      // Act - Critical should bypass quiet hours
      const result = policy.isWithinAllowedWindow(message, preference);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow notification when no quiet hours configured', () => {
      // Arrange
      const message = { severity: SeverityLevel.INFO } as any;
      const preference = null; // No preference

      // Act
      const result = policy.isWithinAllowedWindow(message, preference);

      // Assert
      expect(result).toBe(true);
    });

    it('should allow notification when quiet hours mode is not active', () => {
      // Arrange
      const message = { severity: SeverityLevel.INFO } as any;
      const preference = { quietHours: { start: '22:00', end: '07:00' }, mode: 'normal' };

      // Act
      const result = policy.isWithinAllowedWindow(message, preference);

      // Assert
      expect(result).toBe(true);
    });

    it('should suppress non-critical during quiet_hours mode within time window', () => {
      // Arrange - Simulate time within quiet hours (23:00 local)
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T23:00:00').getTime());

      const message = { severity: SeverityLevel.INFO } as any;
      const preference = { quietHours: { start: '22:00', end: '07:00' }, mode: 'quiet_hours' };

      // Act
      const result = policy.isWithinAllowedWindow(message, preference);

      // Assert
      expect(result).toBe(false);

      // Restore
      jest.restoreAllMocks();
    });

    it('should deliver non-critical outside quiet hours', () => {
      // Arrange - Time outside quiet hours (14:00 local)
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T14:00:00').getTime());

      const message = { severity: SeverityLevel.INFO } as any;
      const preference = { quietHours: { start: '22:00', end: '07:00' }, mode: 'quiet_hours' };

      // Act
      const result = policy.isWithinAllowedWindow(message, preference);

      // Assert
      expect(result).toBe(true);

      // Restore
      jest.restoreAllMocks();
    });

    it('should handle wraparound midnight correctly (22:00 to 07:00)', () => {
      // Arrange - Test during mid-night quiet period (01:00 local)
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T01:00:00').getTime());

      const message = { severity: SeverityLevel.INFO } as any;
      const preference = { quietHours: { start: '22:00', end: '07:00' }, mode: 'quiet_hours' };

      // Act
      const result = policy.isWithinAllowedWindow(message, preference);

      // Assert - Should be suppressed during 01:00
      expect(result).toBe(false);

      // Restore
      jest.restoreAllMocks();
    });
  });

  describe('assessStatus', () => {
    it('should return delivered for allowed window', () => {
      const message = { severity: SeverityLevel.INFO } as any;
      const preference = { quietHours: { start: '22:00', end: '07:00' }, mode: 'normal' }; // Normal mode means always deliver

      const status = policy.assessStatus(message, preference);
      expect(status).toBe('delivered');
    });

    it('should return suppressed for quiet hours during window', () => {
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T23:00:00').getTime());

      const message = { severity: SeverityLevel.INFO } as any;
      const preference = { quietHours: { start: '22:00', end: '07:00' }, mode: 'quiet_hours' };

      const status = policy.assessStatus(message, preference);
      expect(status).toBe('suppressed');

      jest.restoreAllMocks();
    });

    it('should return delivered for critical regardless of quiet hours', () => {
      const message = { severity: SeverityLevel.CRITICAL } as any;
      const preference = { quietHours: { start: '22:00', end: '07:00' }, mode: 'quiet_hours' };

      const status = policy.assessStatus(message, preference);
      expect(status).toBe('delivered');
    });
  });
});
