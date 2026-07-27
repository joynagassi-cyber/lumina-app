/**
 * AuthSession entity — represents a user login session within IdentityAggregate
 *
 * Maps to sessions table (PG-Schema Table 5). Tracks session lifecycle:
 * active → expired → revoked.
 *
 * @traceability DOC-012 Entity SessionContext → PG-Schema Table 5 (sessions)
 */

import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '@shared/events';
import {
  SessionExpired,
  SessionRevokedEvent as ExternalSessionRevoked,
} from '../events';

export interface AuthSessionProps {
  id: string;
  userId: string;
  orgId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  deviceInfo: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  revokedAt?: Date | null;
}

export class AuthSession {
  private readonly _props: AuthSessionProps;
  private readonly _emittedEvents: DomainEvent[] = [];

  constructor(props: AuthSessionProps) {
    this._props = props;
  }

  get id(): string { return this._props.id; }
  get userId(): string { return this._props.userId; }
  get orgId(): string { return this._props.orgId; }
  get refreshTokenHash(): string { return this._props.refreshTokenHash; }
  get expiresAt(): Date { return this._props.expiresAt; }
  get deviceInfo(): Record<string, unknown> { return this._props.deviceInfo; }
  get isActive(): boolean { return this._props.isActive; }
  get createdAt(): Date { return this._props.createdAt; }
  get revokedAt(): Date | null | undefined { return this._props.revokedAt; }

  /** Check if session has reached its expiration date. */
  isExpired(): boolean {
    return this._props.expiresAt <= new Date();
  }

  /** Full session health check: not revoked and not expired. */
  isActiveSession(): boolean {
    return this._props.isActive && !this.isExpired() && !this._props.revokedAt;
  }

  /**
   * Revoke this session. Guards against double-revocation.
   * Emits SessionRevoked event.
   */
  revoke(revokedBy: string): void {
    if (!this._props.isActive || !!this._props.revokedAt) {
      throw new Error('Session is already revoked');
    }
    this._props.isActive = false;
    this._props.revokedAt = new Date();

    this.emit(
      new ExternalSessionRevoked(
        this._props.id,
        this._props.userId,
        revokedBy,
        this._props.orgId,
      ),
    );
  }

  /** Internal mark for scheduled cleanup when expiration passes. */
  markExpired(): void {
    this._props.isActive = false;
    this.emit(
      new SessionExpired(this._props.id, this._props.userId),
    );
  }

  private emit(event: DomainEvent): void {
    this._emittedEvents.push(event);
  }

  getAndClearEvents(): DomainEvent[] {
    const events = [...this._emittedEvents];
    this._emittedEvents.length = 0;
    return events;
  }

  /** Flatten to persistence row shape matching PG-Schema Table 5 columns. */
  toPersistenceRow(): Record<string, unknown> {
    return {
      id: this._props.id,
      user_id: this._props.userId,
      org_id: this._props.orgId,
      hachage_refresh_token: this._props.refreshTokenHash,
      date_expiration: this._props.expiresAt.toISOString(),
      est_active: this._props.isActive,
      informations_appareil: JSON.stringify(this._props.deviceInfo),
      date_creation: this._props.createdAt.toISOString(),
      date_revocation: this._props.revokedAt?.toISOString() ?? null,
    };
  }

  static fromPersistenceRow(row: {
    id: string;
    user_id: string;
    org_id: string;
    hachage_refresh_token: string;
    date_expiration: Date | string;
    est_active: boolean;
    informations_appareil: string;
    date_creation: Date | string;
    date_revocation: Date | string | null;
  }): AuthSession {
    return new AuthSession({
      id: row.id,
      userId: row.user_id,
      orgId: row.org_id,
      refreshTokenHash: row.hachage_refresh_token,
      expiresAt: new Date(row.date_expiration),
      deviceInfo: JSON.parse(row.informations_appareil),
      isActive: row.est_active,
      createdAt: new Date(row.date_creation),
      revokedAt: row.date_revocation ? new Date(row.date_revocation) : null,
    });
  }

  static create(params: {
    userId: string;
    orgId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    deviceInfo: Record<string, unknown>;
  }): AuthSession {
    return new AuthSession({
      id: uuidv4(),
      ...params,
      isActive: true,
      createdAt: new Date(),
      revokedAt: null,
    });
  }
}
