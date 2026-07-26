/**
 * ArchiveRetentionPolicy — enforces configurable retention per archivable type.
 *
 * @traceability DOC-012 Aggregate11 §ArchiveRetentionPolicy
 *   → BR-LIF-005: Purge date configurable per archivable type
 *   → manifest.lifecycle.types[] with retention configuration
 */

import { RetentionPeriod } from '../value-objects/retention-period.vo';
import { LifecycleState } from '../value-objects/lifecycle-state.vo';

export interface ArchivableTypeConfig {
  readonly resourceType: string;
  readonly retentionPeriod: RetentionPeriod;
  readonly autoPurgeEnabled: boolean;
}

/**
 * Policy that governs retention periods per archivable resource type.
 * Default 6-month retention is applied when no org-specific override exists.
 */
export class ArchiveRetentionPolicy {
  private static readonly DEFAULT_RETENTION_MONTHS = 6;

  /**
   * Resolve the retention period for a given resource type.
   * Falls back to default if no config is found.
   */
  static resolveRetention(
    resourceType: string,
    configs: ArchivableTypeConfig[] | null,
  ): RetentionPeriod {
    const config = configs?.find((c) => c.resourceType === resourceType);
    if (config) {
      return config.retentionPeriod;
    }
    return RetentionPeriod.create(ArchiveRetentionPolicy.DEFAULT_RETENTION_MONTHS);
  }

  /**
   * Check whether auto-purge is enabled for a given resource type.
   */
  static isAutoPurgeEnabled(
    resourceType: string,
    configs: ArchivableTypeConfig[] | null,
  ): boolean {
    return configs?.some((c) => c.resourceType === resourceType && c.autoPurgeEnabled) ?? false;
  }

  /**
   * Determine the appropriate state for a purge candidate based on its current lifecycle state.
   * Only trashed or archived entries qualify.
   */
  static getEligibleStates(configs: ArchivableTypeConfig[] | null): LifecycleState[] {
    return [LifecycleState.TRASHED, LifecycleState.ARCHIVED];
  }
}
