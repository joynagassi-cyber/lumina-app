/**
 * NotificationMessage — the notification entity (NOT the ResourceAggregate notification record).
 *
 * This is the NotificationAggregate root entity per DOC-012 Aggregate7.
 * It owns the lifecycle state machine and delegates delivery to NotificationRouter.
 *
 * State Machine: queued → sending → sent / failed
 *               sending → sent | failed
 * sent → read
 *
 * BR-NOT-001: Every notification has a trigger (never spontaneous).
 * BR-NOT-003: In-app always delivered (offline first) — enforced by router, not entity.
 *
 * @traceability DOC-012 Aggregate7 Entity NotificationMessage → PG-Schema-v1 Table 19
 */

import { ChannelType } from '../value-objects/channel-type.vo';
import { SeverityLevel } from '../value-objects/severity-level.vo';

export type NotificationMessageState = 'queued' | 'sending' | 'sent' | 'failed' | 'read';

export interface NotificationMessageProps {
  id: string;
  orgId: string;
  recipientUserId: string;
  subjectFr: string;
  subjectEn: string;
  bodyFr: string;
  bodyEn: string;
  channel: ChannelType;
  severity: SeverityLevel;
  contextualData: Record<string, unknown> | null;
  /** Workflow ID or admin user ID that triggered this notification. */
  triggeredBy: string;
  sentAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationMessage {
  private constructor(private readonly props: NotificationMessageProps) {}

  static create(
    orgId: string,
    recipientUserId: string,
    subjectFr: string,
    subjectEn: string,
    bodyFr: string,
    bodyEn: string,
    channel: ChannelType,
    severity: SeverityLevel,
    triggeredBy: string,
    contextualData?: Record<string, unknown> | null,
  ): NotificationMessage {
    if (!triggeredBy || triggeredBy.length === 0) {
      throw new Error('NotificationMessage: triggeredBy is required per BR-NOT-001');
    }
    const now = new Date();
    return new NotificationMessage({
      id: crypto.randomUUID(),
      orgId,
      recipientUserId,
      subjectFr,
      subjectEn,
      bodyFr,
      bodyEn,
      channel,
      severity,
      triggeredBy,
      contextualData: contextualData ?? null,
      sentAt: null,
      readAt: null,
      failedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): string { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get recipientUserId(): string { return this.props.recipientUserId; }
  get subjectFr(): string { return this.props.subjectFr; }
  get subjectEn(): string { return this.props.subjectEn; }
  get bodyFr(): string { return this.props.bodyFr; }
  get bodyEn(): string { return this.props.bodyEn; }
  get channel(): ChannelType { return this.props.channel; }
  get severity(): SeverityLevel { return this.props.severity; }
  get contextualData(): Record<string, unknown> | null { return this.props.contextualData; }
  get triggeredBy(): string { return this.props.triggeredBy; }
  get sentAt(): Date | null { return this.props.sentAt; }
  get readAt(): Date | null { return this.props.readAt; }
  get failedAt(): Date | null { return this.props.failedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get currentState(): NotificationMessageState {
    if (this.props.readAt) return 'read';
    if (this.props.sentAt) return 'sent';
    if (this.props.failedAt) return 'failed';
    return 'queued';
  }

  /** Transition from queued to sending. Guarded per state machine. */
  startSending(): void {
    this.assertTransition(['queued'], 'sending');
    this._setSending();
  }

  /** Mark as successfully sent with timestamp. */
  markSent(): void {
    this.assertTransition(['queued', 'sending'], 'sent');
    this.props.sentAt = new Date();
    this._commit('sent');
  }

  /** Mark as failed with error reason stored in contextual data. */
  markFailed(reason: string): void {
    this.assertTransition(['queued', 'sending'], 'failed');
    this.props.failedAt = new Date();
    if (this.props.contextualData) {
      this.props.contextualData.failureReason = reason;
    }
    this._commit('failed');
  }

  /** Mark as read (transition from sent → read). */
  markRead(): void {
    this.assertTransition(['sent'], 'read');
    this.props.readAt = new Date();
    this._commit('read');
  }

  /** Serialize to plain object for persistence layer. */
  toPersistenceRecord(): Record<string, unknown> {
    return {
      id: this.props.id,
      org_id: this.props.orgId,
      recipient_user_id: this.props.recipientUserId,
      subject_fr: this.props.subjectFr,
      subject_en: this.props.subjectEn,
      corps_fr: this.props.bodyFr,
      corps_en: this.props.bodyEn,
      canal: this.props.channel,
      severite: this.props.severity,
      statut_notification: this.currentState,
      donnees_contextuelles: this.props.contextualData,
      triggered_by: this.props.triggeredBy,
      sent_at: this.props.sentAt,
      read_at: this.props.readAt,
      failed_at: this.props.failedAt,
    };
  }

  /** Rebuild from persistence record (factory from DB read). */
  static fromPersistence(record: {
    id: string;
    org_id: string;
    recipient_user_id: string;
    subject_fr: string;
    subject_en: string;
    corps_fr: string;
    corps_en: string;
    canal: ChannelType;
    severite: SeverityLevel;
    statut_notification: NotificationMessageState;
    donnees_contextuelles: Record<string, unknown> | null;
    triggered_by: string;
    sent_at: Date | null;
    read_at: Date | null;
    failed_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): NotificationMessage {
    const now = new Date();
    return new NotificationMessage({
      id: record.id,
      orgId: record.org_id,
      recipientUserId: record.recipient_user_id,
      subjectFr: record.subject_fr,
      subjectEn: record.subject_en,
      bodyFr: record.corps_fr,
      bodyEn: record.corps_en,
      channel: record.canal,
      severity: record.severite,
      contextualData: record.donnees_contextuelles,
      triggeredBy: record.triggered_by,
      sentAt: record.sent_at,
      readAt: record.read_at,
      failedAt: record.failed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    });
  }

  // --- Private helpers ---

  private assertTransition(allowedStates: string[], targetState: string): void {
    const current = this.currentState;
    if (!allowedStates.includes(current)) {
      throw new Error(
        `NotificationMessage: invalid transition from '${current}' to '${targetState}'. Allowed: [${allowedStates.join(', ')}]`,
      );
    }
  }

  private _setSending(): void {
    this.props.updatedAt = new Date();
  }

  private _commit(state: 'sent' | 'failed' | 'read'): void {
    this.props.updatedAt = new Date();
  }
}
