/**
 * MemberRecord — member entity within ResourceAggregate.
 *
 * @traceability DOC-012 Aggregate3 Entity MemberRecord, PG-Schema-v1 Table 8
 */

import { ResourceId } from '../value-objects/resource-id.vo';
import { ResourceVersion } from '../value-objects/resource-version.vo';
import { MemberState } from '../value-objects/member-state.vo';
import { ResourceMetadata } from '../value-objects/resource-metadata.vo';

export interface MemberRecordProps {
  id: ResourceId;
  orgId: string;
  createdBy: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  gender: string | null;
  state: MemberState;
  memberNumber: string;
  joinDate: Date;
  leaveDate: Date | null;
  transferCertificate: Record<string, unknown> | null;
  version: ResourceVersion;
  synced: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: ResourceMetadata;
}

export class MemberRecord {
  private constructor(private readonly props: MemberRecordProps) {}

  static create(props: Omit<MemberRecordProps, 'version' | 'synced' | 'createdAt' | 'updatedAt'>): MemberRecord {
    const now = new Date();
    return new MemberRecord({
      ...props,
      version: new ResourceVersion(1),
      synced: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): ResourceId { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get createdBy(): string { return this.props.createdBy; }
  get firstName(): string { return this.props.firstName; }
  get lastName(): string { return this.props.lastName; }
  get email(): string | null { return this.props.email; }
  get phone(): string | null { return this.props.phone; }
  get birthDate(): Date | null { return this.props.birthDate; }
  get gender(): string | null { return this.props.gender; }
  get state(): MemberState { return this.props.state; }
  get memberNumber(): string { return this.props.memberNumber; }
  get joinDate(): Date { return this.props.joinDate; }
  get leaveDate(): Date | null { return this.props.leaveDate; }
  get transferCertificate(): Record<string, unknown> | null { return this.props.transferCertificate; }
  get version(): ResourceVersion { return this.props.version; }
  get synced(): boolean { return this.props.synced; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get metadata(): ResourceMetadata { return this.props.metadata; }
  get fullName(): string { return `${this.props.firstName} ${this.props.lastName}`.trim(); }

  bumpVersion(): void {
    this.props.version = this.props.version.next();
    this.props.updatedAt = new Date();
  }

  changeState(newState: MemberState): void {
    this.validateTransition(this.props.state, newState);
    this.props.state = newState;
    if (newState === MemberState.INACTIVE || newState === MemberState.DECEASED || newState === MemberState.TRANSFERRED) {
      this.props.leaveDate = new Date();
    }
    this.bumpVersion();
  }

  updateProfile(fields: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    birthDate?: Date | null;
    gender?: string | null;
    metadata?: ResourceMetadata;
  }): void {
    if (fields.firstName) this.props.firstName = fields.firstName;
    if (fields.lastName) this.props.lastName = fields.lastName;
    if (fields.email !== undefined) this.props.email = fields.email ?? null;
    if (fields.phone !== undefined) this.props.phone = fields.phone ?? null;
    if (fields.birthDate) this.props.birthDate = fields.birthDate;
    if (fields.gender) this.props.gender = fields.gender;
    if (fields.metadata) this.props.metadata = fields.metadata;
    this.bumpVersion();
  }

  markSynced(): void {
    this.props.synced = true;
    this.bumpVersion();
  }

  private validateTransition(from: MemberState, to: MemberState): void {
    const allowed: Record<MemberState, readonly MemberState[]> = {
      [MemberState.ACTIVE]: [MemberState.INACTIVE, MemberState.DECEASED, MemberState.TRANSFERRED],
      [MemberState.INACTIVE]: [MemberState.ACTIVE],
      [MemberState.DECEASED]: [],
      [MemberState.TRANSFERRED]: [],
    };
    const targets = allowed[from];
    if (!targets || !targets.includes(to)) {
      throw new Error(`MemberRecord: invalid transition ${from} -> ${to}`);
    }
  }
}
