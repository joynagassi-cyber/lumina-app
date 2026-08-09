/**
 * User domain entity — Aggregate Root of IdentityAggregate
 *
 * Central entity managing user profile, role, and state within an org.
 * Contains domain logic for role changes, profile updates, and event production.
 * Does NOT contain persistence logic or credential management details.
 *
 * @traceability DOC-012 Entity User → PG-Schema Table 4 (users)
 */

import { v4 as uuidv4 } from 'uuid';
import type { EmailAddress } from '../value-objects/email-address';
import type { UserRole } from '../value-objects/user-role';
import type { PhoneNumber } from '../value-objects/phone-number';
import { UserCreated, UserUpdated, UserRoleChanged } from '../events';

export class User {
  private readonly _id: string;
  private readonly _orgId: string;
  private _firstName: string;
  private _lastName: string;
  private readonly _email: EmailAddress;
  private _phone?: PhoneNumber | null;
  private _role: UserRole;
  private readonly _status: 'active' | 'inactive';
  private _version: number;
  private _createdAt: Date;
  private _updatedAt: Date;
  private readonly _emittedEvents: unknown[] = [];

  constructor(params: {
    id?: string;
    orgId: string;
    firstName: string;
    lastName: string;
    email: EmailAddress;
    phone?: PhoneNumber | null;
    role: UserRole;
    status?: 'active' | 'inactive';
    version?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._id = params.id ?? uuidv4();
    this._orgId = params.orgId;
    this._firstName = params.firstName.trim();
    this._lastName = params.lastName.trim();
    this._email = params.email;
    this._phone = params.phone;
    this._role = params.role;
    this._status = params.status ?? 'active';
    this._version = params.version ?? 1;
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();

    this.emit(
      new UserCreated(this._id, this._orgId, this._email.value, this._role.toString()),
    );
  }

  get id(): string { return this._id; }
  get orgId(): string { return this._orgId; }
  get firstName(): string { return this._firstName; }
  get lastName(): string { return this._lastName; }
  get email(): EmailAddress { return this._email; }
  get phone(): PhoneNumber | undefined { return this._phone ?? undefined; }
  get role(): UserRole { return this._role; }
  get status(): 'active' | 'inactive' { return this._status; }
  get version(): number { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  get displayName(): string {
    return `${this._firstName} ${this._lastName}`.trim();
  }

  private emit(event: unknown): void {
    this._emittedEvents.push(event);
  }

  getAndClearEvents(): unknown[] {
    const events = [...this._emittedEvents];
    this._emittedEvents.length = 0;
    return events;
  }

  /**
   * Update user profile fields. Emits UserUpdated event.
   * BR-ID-003: email is immutable after creation.
   */
  updateProfile(params: {
    firstName?: string;
    lastName?: string;
    phone?: PhoneNumber | null;
  }): void {
    const changes: Record<string, unknown> = {};
    const oldState = {
      firstName: this._firstName,
      lastName: this._lastName,
      phone: this._phone?.value ?? null,
    };

    if (params.firstName !== undefined) {
      if (!params.firstName.trim()) {
        throw new Error('First name cannot be empty');
      }
      this._firstName = params.firstName.trim();
      changes.firstName = { before: oldState.firstName, after: this._firstName };
    }

    if (params.lastName !== undefined) {
      if (!params.lastName.trim()) {
        throw new Error('Last name cannot be empty');
      }
      this._lastName = params.lastName.trim();
      changes.lastName = { before: oldState.lastName, after: this._lastName };
    }

    if (params.phone !== undefined) {
      this._phone = params.phone;
      changes.phone = { before: oldState.phone, after: this._phone?.value ?? null };
    }

    if (Object.keys(changes).length > 0) {
      this._updatedAt = new Date();
      this._version++;
      this.emit(new UserUpdated(this._id, changes));
    }
  }

  /**
   * Change user role. RBAC gates enforced by Application layer.
   * Emits UserRoleChanged event.
   */
  changeRole(newRole: UserRole): void {
    const oldRole = this._role.toString();
    const newRoleStr = newRole.toString();
    if (newRoleStr === oldRole) return;

    this._role = newRole;
    this._updatedAt = new Date();
    this._version++;
    this.emit(new UserRoleChanged(this._id, oldRole, newRoleStr));
  }

  /** Flatten to column-compatible shape for persistence layer. */
  toPersistenceColumnMap(): Record<string, unknown> {
    return {
      id: this._id,
      org_id: this._orgId,
      prenom: this._firstName,
      nom_famille: this._lastName,
      adresse_email: this._email.value,
      telephone: this._phone?.value ?? null,
      role_utilisateur: this._role.toString(),
      statut: this._status,
      version: this._version,
      created_at: this._createdAt.toISOString(),
      updated_at: this._updatedAt.toISOString(),
    };
  }
}
