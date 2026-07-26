/**
 * NotificationRecord — immutable notification entity within ResourceAggregate.
 * Once sent, never modified.
 *
 * @traceability DOC-012 Aggregate3 Entity NotificationRecord
 */

import { ResourceId } from '../value-objects/resource-id.vo';
import { ResourceVersion } from '../value-objects/resource-version.vo';
import { ResourceMetadata } from '../value-objects/resource-metadata.vo';

export enum NotificationChannel {
  IN_APP = 'in_app',
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
}

export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum NotificationDeliveryStatus {
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read',
}

export interface NotificationRecordProps {
  id: ResourceId;
  orgId: string;
  createdBy: string;
  recipientUserId: string;
  subjectFr: string;
  subjectEn: string;
  bodyFr: string;
  bodyEn: string;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  status: NotificationDeliveryStatus;
  contextualData: ResourceMetadata;
  triggeredBy: string | null; // workflow_id or manual admin action
  sentAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  version: ResourceVersion;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationRecord {
  private constructor(private readonly props: NotificationRecordProps) {}

  static create(props: Omit<NotificationRecordProps, 'version' | 'createdAt' | 'updatedAt'>): NotificationRecord {
    const now = new Date();
    return new NotificationRecord({
      ...props,
      version: new ResourceVersion(1),
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): ResourceId { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get createdBy(): string { return this.props.createdBy; }
  get recipientUserId(): string { return this.props.recipientUserId; }
  get subjectFr(): string { return this.props.subjectFr; }
  get subjectEn(): string { return this.props.subjectEn; }
  get bodyFr(): string { return this.props.bodyFr; }
  get bodyEn(): string { return this.props.bodyEn; }
  get channel(): NotificationChannel { return this.props.channel; }
  get severity(): NotificationSeverity { return this.props.severity; }
  get status(): NotificationDeliveryStatus { return this.props.status; }
  get contextualData(): ResourceMetadata { return this.props.contextualData; }
  get triggeredBy(): string | null { return this.props.triggeredBy; }
  get sentAt(): Date | null { return this.props.sentAt; }
  get readAt(): Date | null { return this.props.readAt; }
  get failedAt(): Date | null { return this.props.failedAt; }
  get version(): ResourceVersion { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  bumpVersion(): void {
    this.props.version = this.props.version.next();
    this.props.updatedAt = new Date();
  }

  markSending(): void {
    if (this.props.status !== NotificationDeliveryStatus.QUEUED) {
      throw new Error('NotificationRecord: can only transition from QUEUED to SENDING');
    }
    this.props.status = NotificationDeliveryStatus.SENDING;
    this.bumpVersion();
  }

  markSent(): void {
    this.props.status = NotificationDeliveryStatus.SENT;
    this.props.sentAt = new Date();
    this.bumpVersion();
  }

  markFailed(): void {
    this.props.status = NotificationDeliveryStatus.FAILED;
    this.props.failedAt = new Date();
    this.bumpVersion();
  }

  markRead(): void {
    if (this.props.status !== NotificationDeliveryStatus.SENT) {
      throw new Error('NotificationRecord: can only mark SENT notifications as read');
    }
    this.props.status = NotificationDeliveryStatus.READ;
    this.props.readAt = new Date();
    this.bumpVersion();
  }

  /** Mark for retry — resets to QUEUED. */
  markRetry(): void {
    this.props.status = NotificationDeliveryStatus.QUEUED;
    this.bumpVersion();
  }
}
