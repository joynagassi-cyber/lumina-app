/**
 * PurgeScheduler — domain service that identifies purge-eligible entries.
 *
 * @traceability DOC-012 Aggregate11 §PurgeScheduler
 *   → BR-LIF-005: Purge date configurable per archivable type
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 29 (purge_schedules)
 */

import { LifecycleState } from '../value-objects/lifecycle-state.vo';
import { RetentionPeriod } from '../value-objects/retention-period.vo';

export interface PurgeCandidate {
  readonly entryId: string;
  readonly orgId: string;
  readonly currentRetention: RetentionPeriod;
  readonly eligibilityDate: Date;
}

/**
 * Service responsible for computing which archived/trashed entries are eligible for purge.
 */
export class PurgeScheduler {
  /**
   * Calculate purge eligibility date given a retention period and the archive/trash date.
   */
  static computeEligibilityDate(
    referenceDate: Date,
    retention: RetentionPeriod,
  ): Date {
    return retention.computePurgeDate(referenceDate);
  }

  /**
   * Determine if a candidate is currently eligible for purge.
   */
  static isEligible(candidate: PurgeCandidate, asOfDate?: Date): boolean {
    const now = asOfDate ?? new Date();
    return now >= candidate.eligibilityDate;
  }

  /**
   * Filter a list of candidates to only those eligible for purge at the given time.
   */
  static filterEligible(
    candidates: PurgeCandidate[],
    asOfDate?: Date,
  ): PurgeCandidate[] {
    const now = asOfDate ?? new Date();
    return candidates.filter((c) => now >= c.eligibilityDate);
  }

  /**
   * Check if a lifecycle state qualifies for purge scheduling.
   */
  static stateQualifiesForPurge(state: LifecycleState): boolean {
    return state === LifecycleState.TRASHED || state === LifecycleState.ARCHIVED;
  }
}
