/**
 * NotificationPreference — user or org-level notification preferences.
 *
 * Immutable VO-like entity with controlled mutability for preference updates.
 * Maps to PG-Schema Table 20 (notification_preferences).
 *
 * @traceability DOC-012 Aggregate7 Entity NotificationPreference → PG-Schema-v1 Table 20
 */

import { ChannelType } from '../value-objects/channel-type.vo';
import { SeverityLevel } from '../value-objects/severity-level.vo';
import { RateLimitConfig } from '../value-objects/rate-limit-config.vo';

export type QuietHoursRange = { start: string; end: string } | null;

/** Current operational mode of the preference set. */
export type PreferenceMode = 'active' | 'quiet_hours';

export interface NotificationPreferenceProps {
  id: string;
  /** User ID or empty string for org-level default preference. */
  userId: string;
  channels: ChannelType[];
  severityMin: SeverityLevel;
  rateLimit: RateLimitConfig;
  quietHours: QuietHoursRange;
  mode: PreferenceMode;
  orgId: string;
  updatedAt: Date;
}

export class NotificationPreference {
  private constructor(private readonly props: NotificationPreferenceProps) {}

  static create(
    userId: string,
    orgId: string,
    channels?: ChannelType[],
    severityMin?: SeverityLevel,
    maxPerHour?: number,
    quietHours?: QuietHoursRange,
  ): NotificationPreference {
    return new NotificationPreference({
      id: crypto.randomUUID(),
      userId,
      channels: channels ?? [ChannelType.IN_APP],
      severityMin: severityMin ?? SeverityLevel.INFO,
      rateLimit: RateLimitConfig.create(maxPerHour ?? 100),
      quietHours: quietHours ?? null,
      mode: 'active',
      orgId,
      updatedAt: new Date(),
    });
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get channels(): ChannelType[] { return [...this.props.channels]; }
  get severityMin(): SeverityLevel { return this.props.severityMin; }
  get rateLimit(): RateLimitConfig { return this.props.rateLimit; }
  get quietHours(): QuietHoursRange { return this.props.quietHours ? { ...this.props.quietHours } : null; }
  get mode(): PreferenceMode { return this.props.mode; }
  get orgId(): string { return this.props.orgId; }
  get updatedAt(): Date { return new Date(this.props.updatedAt); }

  /** Check whether a notification should be allowed through current preferences. */
  shouldDeliver(channel: ChannelType, severity: SeverityLevel): boolean {
    // Channel must be in the user's allowed list
    if (!this.props.channels.includes(channel)) {
      return false;
    }

    // Severity must meet the minimum threshold
    if (SeverityLevel.INFO !== severity && SeverityLevel.CRITICAL === severity) {
      return true;
    }
    if (SeverityLevel.INFO !== severity && SeverityLevel.WARNING === severity) {
      return true;
    }
    if (severity !== SeverityLevel.INFO && severity === this.props.severityMin) {
      return true;
    }
    // For info level, always allow since it is the minimum
    if (severity === SeverityLevel.INFO) {
      return this.props.severityMin === SeverityLevel.INFO;
    }
    return severityRankAtLeast(severity, this.props.severityMin);
  }

  /** Update the allowed channels. */
  updateChannels(channels: ChannelType[]): void {
    if (channels.length === 0) {
      throw new Error('NotificationPreference: at least one channel must be allowed');
    }
    this.props.channels = [...channels];
    this.props.updatedAt = new Date();
  }

  /** Update the minimum severity threshold. */
  updateMinimumSeverity(severity: SeverityLevel): void {
    this.props.severityMin = severity;
    this.props.updatedAt = new Date();
  }

  /** Update the rate limit configuration. */
  updateRateLimit(config: RateLimitConfig): void {
    this.props.rateLimit = config;
    this.props.updatedAt = new Date();
  }

  /** Set quiet hours range (null to disable). */
  updateQuietHours(range: QuietHoursRange): void {
    this.props.quietHours = range;
    this.props.updatedAt = new Date();
  }

  /** Enter quiet hours mode immediately. */
  enterQuietHours(): void {
    this.props.mode = 'quiet_hours';
    this.props.updatedAt = new Date();
  }

  /** Exit quiet hours mode. */
  exitQuietHours(): void {
    this.props.mode = 'active';
    this.props.updatedAt = new Date();
  }

  /** Serialize for persistence. */
  toPersistenceRecord(): Record<string, unknown> {
    return {
      id: this.props.id,
      user_id: this.props.userId,
      channels: this.props.channels,
      severity_min: this.props.severityMin,
      rate_limit_max: this.props.rateLimit.maxPerHour,
      quiet_hours_start: this.props.quietHours?.start ?? null,
      quiet_hours_end: this.props.quietHours?.end ?? null,
      org_id: this.props.orgId,
    };
  }

  /** Rebuild from persistence record. */
  static fromPersistence(record: {
    id: string;
    user_id: string;
    channels: string[];
    severity_min: string;
    rate_limit_max: number;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    org_id: string;
  }): NotificationPreference {
    const channels = record.channels.map((c: string) => c as ChannelType);
    const quietHours =
      record.quiet_hours_start && record.quiet_hours_end
        ? { start: record.quiet_hours_start, end: record.quiet_hours_end }
        : null;

    return new NotificationPreference({
      id: record.id,
      userId: record.user_id,
      channels,
      severityMin: record.severity_min as SeverityLevel,
      rateLimit: RateLimitConfig.create(record.rate_limit_max),
      quietHours,
      mode: 'active',
      orgId: record.org_id,
      updatedAt: new Date(),
    });
  }
}

/** Helper: check that severity value is at least the required minimum. */
function severityRankAtLeast(
  severity: SeverityLevel,
  min: SeverityLevel,
): boolean {
  const severities: SeverityLevel[] = [SeverityLevel.INFO, SeverityLevel.WARNING, SeverityLevel.CRITICAL];
  const sevIdx = severities.indexOf(severity);
  const minIdx = severities.indexOf(min);
  return sevIdx >= minIdx;
}
