/**
 * GrantEntry — Aggregate Root for the Delegation domain.
 *
 * Represents a single delegation grant from a delegator to a delegatee within an
 * organization. The grant defines what capabilities (permissions) are delegated,
 * for how long, and under what approval requirements.
 *
 * State machine:
 *   Created ──(approval required)──> Pending ──(approved)──> Active
 *   Active ──(revoke)──> Revoked
 *   Active ──(expires)──> Expired
 *
 * @traceability DOC-012 GrantEntry Aggregate → GrantEntry entity
 */

import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '@shared/events';
import { GrantId } from '../value-objects/grant-id.vo';
import { GrantScope, type GrantScopeValue } from '../value-objects/grant-scope.vo';
import { GrantPermission } from '../value-objects/grant-permission.vo';
import { GrantStatus } from '../value-objects/grant-status.enum';
import {
  GrantCreated,
  GrantApproved,
  GrantExpired,
  GrantRevoked,
} from '../events/grant-events';

export interface GrantEntryProps {
  grantId: GrantId;
  delegatorUserId: string;
  delegateeUserId: string;
  orgId: string;
  grantScope: GrantScope;
  grantPermissions: GrantPermission[];
  durationDays: number;
  expiresAt: Date;
  requiresApproval: boolean;
  approvalStatus: GrantStatus;
  active: boolean;
  createdAt: Date;
  revokedAt?: Date | null;
}

export class GrantEntry {
  private readonly _grantId: GrantId;
  private readonly _delegatorUserId: string;
  private readonly _delegateeUserId: string;
  private readonly _orgId: string;
  private readonly _grantScope: GrantScope;
  private readonly _grantPermissions: GrantPermission[];
  private _durationDays: number;
  private _expiresAt: Date;
  private _requiresApproval: boolean;
  private _approvalStatus: GrantStatus;
  private _active: boolean;
  private _createdAt: Date;
  private _revokedAt?: Date | null;

  private readonly _emittedEvents: DomainEvent[] = [];

  constructor(props: GrantEntryProps) {
    this._grantId = props.grantId;
    this._delegatorUserId = props.delegatorUserId;
    this._delegateeUserId = props.delegateeUserId;
    this._orgId = props.orgId;
    this._grantScope = props.grantScope;
    this._grantPermissions = [...props.grantPermissions];
    this._durationDays = props.durationDays;
    this._expiresAt = new Date(props.expiresAt);
    this._requiresApproval = props.requiresApproval;
    this._approvalStatus = props.approvalStatus;
    this._active = props.active;
    this._createdAt = new Date(props.createdAt);
    this._revokedAt = props.revokedAt ? new Date(props.revokedAt) : null;
  }

  /** Static factory method for creating a new grant. */
  static create(params: {
    delegatorUserId: string;
    delegateeUserId: string;
    orgId: string;
    grantScope: GrantScope;
    grantPermissions: GrantPermission[];
    durationDays: number;
    expiresAt: Date;
    requiresApproval: boolean;
  }): GrantEntry {
    const grantId = GrantId.create();
    const approvalStatus = params.requiresApproval ? GrantStatus.Pending : GrantStatus.Approved;

    const grant = new GrantEntry({
      grantId,
      delegatorUserId: params.delegatorUserId,
      delegateeUserId: params.delegateeUserId,
      orgId: params.orgId,
      grantScope: params.grantScope,
      grantPermissions: params.grantPermissions,
      durationDays: params.durationDays,
      expiresAt: params.expiresAt,
      requiresApproval: params.requiresApproval,
      approvalStatus: approvalStatus,
      active: true,
      createdAt: new Date(),
      revokedAt: null,
    });

    // Emit GrantCreated event (emitted after creation, before returning)
    grant.emit(
      new GrantCreated(
        grant._grantId.toString(),
        grant._delegatorUserId,
        grant._delegateeUserId,
        grant._orgId,
        grant._approvalStatus,
        grant._grantPermissions.map((p) => p.toString()),
        grant._durationDays,
        grant._grantScope.toString(),
      ),
    );

    return grant;
  }

  /** Static factory method for loading from persistence. */
  static fromPersistenceRow(row: {
    id: string;
    delegatorId: string;
    delegateeId: string;
    orgId: string;
    grantScope: string;
    grantPermissions: string[];
    durationDays: number;
    expiresAt: string | Date;
    requiresApproval: boolean;
    approvalStatus: string;
    active: boolean;
    createdAt: string | Date;
    revokedAt: string | null | Date;
  }): GrantEntry {
    const grantId = new GrantId(row.id);
    const grantScope = GrantScope.create(row.grantScope as GrantScopeValue);
    const permissions = row.grantPermissions.map((p) => GrantPermission.create(p));

    const expiresAt = typeof row.expiresAt === 'string' ? new Date(row.expiresAt) : row.expiresAt;
    const createdAt = typeof row.createdAt === 'string' ? new Date(row.createdAt) : row.createdAt;
    const revokedAt = row.revokedAt ? (typeof row.revokedAt === 'string' ? new Date(row.revokedAt) : row.revokedAt) : null;

    const grant = new GrantEntry({
      grantId,
      delegatorUserId: row.delegatorId,
      delegateeUserId: row.delegateeId,
      orgId: row.orgId,
      grantScope,
      grantPermissions: permissions,
      durationDays: row.durationDays,
      expiresAt,
      requiresApproval: row.requiresApproval,
      approvalStatus: row.approvalStatus as GrantStatus,
      active: row.active,
      createdAt,
      revokedAt,
    });

    return grant;
  }

  get grantId(): GrantId { return this._grantId; }
  get delegatorUserId(): string { return this._delegatorUserId; }
  get delegateeUserId(): string { return this._delegateeUserId; }
  get orgId(): string { return this._orgId; }
  get grantScope(): GrantScope { return this._grantScope; }
  get grantPermissions(): GrantPermission[] { return [...this._grantPermissions]; }
  get durationDays(): number { return this._durationDays; }
  get expiresAt(): Date { return new Date(this._expiresAt); }
  get requiresApproval(): boolean { return this._requiresApproval; }
  get approvalStatus(): GrantStatus { return this._approvalStatus; }
  get active(): boolean { return this._active; }
  get createdAt(): Date { return new Date(this._createdAt); }
  get revokedAt(): Date | null | undefined { return this._revokedAt; }

  /** Check if grant is currently active (not expired, not revoked, approval satisfied). */
  isActive(): boolean {
    const isApprovalSatisfied = this._approvalStatus === GrantStatus.Approved || this._approvalStatus === GrantStatus.Active;
    return (
      this._active &&
      this._expiresAt > new Date() &&
      !this._revokedAt &&
      isApprovalSatisfied
    );
  }

  /** Check if grant has expired. */
  isExpired(): boolean {
    return this._expiresAt <= new Date() || (this._active && this._approvalStatus === GrantStatus.Expired);
  }

  /**
   * Approve the grant if it requires approval.
   * Emits GrantApproved event.
   * Throws if grant is already approved/revoked/expired.
   */
  approve(approvedBy: string): void {
    if (this._approvalStatus !== GrantStatus.Pending) {
      throw new Error('Grant is not in pending state and cannot be approved');
    }
    if (!this._active) {
      throw new Error('Grant cannot be approved: it is already inactive');
    }

    this._approvalStatus = GrantStatus.Active;
    this._active = true;

    this.emit(
      new GrantApproved(
        this._grantId.toString(),
        this._delegateeUserId,
        this._orgId,
        approvedBy,
      ),
    );
  }

  /**
   * Revoke the grant immediately.
   * Emits GrantRevoked event.
   * Per BR-DEL-004: Immediate revocation effect.
   */
  revoke(revokedBy: string): void {
    if (!this._active) {
      throw new Error('Grant is already inactive or revoked');
    }

    this._active = false;
    this._revokedAt = new Date();
    this._approvalStatus = GrantStatus.Revoked;

    this.emit(
      new GrantRevoked(
        this._grantId.toString(),
        this._delegateeUserId,
        this._orgId,
        revokedBy,
      ),
    );
  }

  /**
   * Mark the grant as expired (for background job processing).
   * Emits GrantExpired event.
   */
  expire(): void {
    if (!this._active) {
      return; // Already expired or revoked
    }

    this._active = false;
    this._approvalStatus = GrantStatus.Expired;

    this.emit(
      new GrantExpired(
        this._grantId.toString(),
        this._delegateeUserId,
        this._orgId,
      ),
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

  /** Convert to persistence row format matching Prisma schema. */
  toPersistenceRow(): Record<string, unknown> {
    return {
      id: this._grantId.value,
      delegator_user_id: this._delegatorUserId,
      delegatee_user_id: this._delegateeUserId,
      org_id: this._orgId,
      grant_scope: this._grantScope.value,
      grant_permissions: this._grantPermissions.map((p) => p.toString()),
      duration_days: this._durationDays,
      expires_at: this._expiresAt.toISOString(),
      requires_approval: this._requiresApproval,
      approval_status: this._approvalStatus,
      active: this._active,
      created_at: this._createdAt.toISOString(),
      revoked_at: this._revokedAt ? this._revokedAt.toISOString() : null,
    };
  }
}