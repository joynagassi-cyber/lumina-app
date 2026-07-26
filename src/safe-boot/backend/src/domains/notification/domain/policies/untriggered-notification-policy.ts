/**
 * NoUntriggeredNotificationPolicy — enforces BR-NOT-001.
 *
 * Every notification MUST have a trigger source. Spontaneous / unprovoked
 * notifications are impossible. A trigger comes from:
 * - A Workflow step completion
 * - A policy event (e.g. new member application)
 * - A manual admin action
 *
 * @traceability DOC-012 Aggregate7 Policies (NoUntriggeredNotificationPolicy)
 *   → BR-NOT-001: Every notification has a trigger (never spontaneous)
 */

export class UntriggeredNotificationError extends Error {
  constructor(public readonly context: string) {
    super(
      `NoUntriggeredNotificationPolicy: ${context}. Every notification must be triggered by something.`,
    );
    this.name = 'UntriggeredNotificationError';
  }
}

export class NoUntriggeredNotificationPolicy {
  /**
   * Validate that a notification creation request includes a valid trigger.
   * Throws UntriggeredNotificationError if triggeredBy is null or empty.
   */
  static validateTrigger(triggeredBy: string | null): void {
    if (!triggeredBy || triggeredBy.length === 0) {
      throw new UntriggeredNotificationError(
        'Notification attempted without a trigger source',
      );
    }
  }

  /**
   * Validate that a trigger source type is recognized.
   * Accepted types: 'workflow', 'policy_event', 'admin_manual'.
   */
  static validateTriggerType(triggerType: string): void {
    const acceptedTypes = ['workflow', 'policy_event', 'admin_manual'];
    if (!acceptedTypes.includes(triggerType)) {
      throw new UntriggeredNotificationError(
        `Unknown trigger type '${triggerType}'. Must be one of: ${acceptedTypes.join(', ')}`,
      );
    }
  }
}
