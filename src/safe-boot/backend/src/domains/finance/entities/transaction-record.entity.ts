/**
 * TransactionRecord — financial transaction entity within ResourceAggregate.
 *
 * @traceability DOC-012 Aggregate3 Entity TransactionRecord, BR-RES-001..BR-RES-008
 * @invariant Approved transactions are IMMUTABLE; corrections via compensates_for only
 */

import { ResourceId } from '../value-objects/resource-id.vo';
import { ResourceVersion } from '../value-objects/resource-version.vo';
import { AmountInCents } from '../value-objects/amount-in-cents.vo';
import { TransactionState } from '../value-objects/transaction-state.vo';
import { TransactionReference } from '../value-objects/transaction-reference.vo';
import { ResourceMetadata } from '../value-objects/resource-metadata.vo';
import { ResourceScope } from '../value-objects/resource-scope.vo';

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
}

export interface TransactionRecordProps {
  id: ResourceId;
  orgId: string;
  createdBy: string;
  amount: AmountInCents;
  type: TransactionType;
  state: TransactionState;
  categoryRef: string; // vocab_values.id UUID
  scope: ResourceScope;
  date: Date;
  description: string | null;
  compensatesFor: TransactionReference | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  version: ResourceVersion;
  synced: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: ResourceMetadata;
}

export class TransactionRecord {
  private constructor(private readonly props: TransactionRecordProps) {}

  static create(props: Omit<TransactionRecordProps, 'version' | 'synced' | 'createdAt' | 'updatedAt'>): TransactionRecord {
    const now = new Date();
    return new TransactionRecord({
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
  get amount(): AmountInCents { return this.props.amount; }
  get type(): TransactionType { return this.props.type; }
  get state(): TransactionState { return this.props.state; }
  get categoryRef(): string { return this.props.categoryRef; }
  get scope(): ResourceScope { return this.props.scope; }
  get date(): Date { return this.props.date; }
  get description(): string | null { return this.props.description; }
  get compensatesFor(): TransactionReference | null { return this.props.compensatesFor; }
  get approvedBy(): string | null { return this.props.approvedBy; }
  get approvedAt(): Date | null { return this.props.approvedAt; }
  get version(): ResourceVersion { return this.props.version; }
  get synced(): boolean { return this.props.synced; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get metadata(): ResourceMetadata { return this.props.metadata; }

  /** Increment version and update timestamp. INV-010. */
  bumpVersion(): void {
    this.props.version = this.props.version.next();
    this.props.updatedAt = new Date();
  }

  /** Change state with validation. Throws if transition invalid. */
  changeState(newState: TransactionState): void {
    this.validateStateTransition(this.props.state, newState);
    this.props.state = newState;
    this.bumpVersion();
  }

  approve(approverUserId: string): void {
    if (this.props.state !== TransactionState.PENDING) {
      throw new Error(`TransactionRecord: can only approve PENDING transactions`);
    }
    this.props.approvedBy = approverUserId;
    this.props.approvedAt = new Date();
    this.changeState(TransactionState.APPROVED);
  }

  reject(): void {
    if (this.props.state !== TransactionState.PENDING) {
      throw new Error(`TransactionRecord: can only reject PENDING transactions`);
    }
    this.changeState(TransactionState.REJECTED);
  }

  markSynced(): void {
    this.props.synced = true;
    this.bumpVersion();
  }

  /** Update mutable fields — rejected ONLY (draft/pending). */
  updateFields(fields: {
    amount?: AmountInCents;
    description?: string | null;
    date?: Date;
    categoryRef?: string;
    scope?: ResourceScope;
    metadata?: ResourceMetadata;
  }): void {
    if (this.props.state === TransactionState.APPROVED) {
      throw new Error('TransactionRecord: approved transactions are immutable (INV-001)');
    }
    if (fields.amount) this.props.amount = fields.amount;
    if (fields.description !== undefined) this.props.description = fields.description;
    if (fields.date) this.props.date = fields.date;
    if (fields.categoryRef) this.props.categoryRef = fields.categoryRef;
    if (fields.scope) this.props.scope = fields.scope;
    if (fields.metadata) this.props.metadata = fields.metadata;
    this.bumpVersion();
  }

  private validateStateTransition(from: TransactionState, to: TransactionState): void {
    const validTargets = [TransactionState.DRAFT, TransactionState.PENDING, TransactionState.APPROVED, TransactionState.REJECTED];
    if (!validTargets.includes(to)) {
      throw new Error(`TransactionRecord: invalid state "${to}"`);
    }
    const allowedTransitions = {
      [TransactionState.DRAFT]: [TransactionState.PENDING],
      [TransactionState.PENDING]: [TransactionState.APPROVED, TransactionState.REJECTED],
      [TransactionState.APPROVED]: [],
      [TransactionState.REJECTED]: [TransactionState.DRAFT],
    };
    const allowed = allowedTransitions[from];
    if (!allowed || !allowed.includes(to)) {
      throw new Error(`TransactionRecord: invalid state transition ${from} -> ${to}`);
    }
  }
}
