/**
 * QuietHoursPolicy — optional per-org quiet hours enforcement.
 *
 * Respects the user's configured quiet hours window (PG-Schema Table 20:
 * heures_silencieuses_debut / heures_silencieuses_fin) while ensuring that
 * critical-severity notifications always get through (BR-NOT-005).
 *
 * @traceability DOC-012 Aggregate7 Policies (QuietHoursPolicy)
 *   → PG-Schema-v1 Table 20 quiet hours columns
 *   → BR-NOT-005: Critical severity bypasses quiet hours
 */

import { SeverityLevel, isCritical } from '../value-objects/severity-level.vo';
import type { NotificationMessage } from '../entities/notification-message.entity';
import type { QuietHoursRange } from '../entities/notification-preference.entity';

export interface IQuietHoursPolicy {
  /**
   * Check whether a notification can be delivered right now.
   * Always returns true for critical severity (BR-NOT-005).
   */
  isWithinAllowedWindow(
    message: NotificationMessage,
    preference: unknown,
  ): boolean;
}

export class QuietHoursPolicy implements IQuietHoursPolicy {
  isWithinAllowedWindow(
    message: NotificationMessage,
    preference: { quietHours: QuietHoursRange; mode: string } | null,
  ): boolean {
    // BR-NOT-005: Critical severity ALWAYS bypasses quiet hours.
    if (isCritical(message.severity)) {
      return true;
    }

    // If no preference or no quiet hours configured, deliver normally.
    if (!preference?.quietHours) {
      return true;
    }

    // If the preference is in quiet_hours mode AND the message is not critical, suppress it.
    if (preference.mode === 'quiet_hours') {
      return false;
    }

    const range = preference.quietHours;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMinute] = range.start.split(':').map(Number);
    const [endHour, endMinute] = range.end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Handle wraparound midnight: e.g., 22:00 to 07:00 means start > end.
    if (startMinutes <= endMinutes) {
      // Normal range: e.g., 09:00 to 07:00 doesn't happen here.
      return !(currentMinutes >= startMinutes && currentMinutes < endMinutes);
    }

    // Wraparound: e.g., 22:00 to 07:00 — suppressed between 22:00–23:59 or 00:00–07:00.
    return !(currentMinutes >= startMinutes || currentMinutes < endMinutes);
  }

  /**
   * Determine a notification's status during quiet hours.
   * Returns 'suppressed' for non-critical during quiet hours, 'deliverable' otherwise.
   */
  assessStatus(
    message: NotificationMessage,
    preference: { quietHours: QuietHoursRange; mode: string } | null,
  ): 'delivered' | 'suppressed' {
    return this.isWithinAllowedWindow(message, preference) ? 'delivered' : 'suppressed';
  }
}
