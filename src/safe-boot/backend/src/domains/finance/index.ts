/**
 * Finance Domain — ResourceAggregate complete implementation.
 *
 * @traceability DOC-012 Aggregate 3 (ResourceAggregate)
 *              PG-Schema-v1 Tables 7-10 (transactions, members, events, categories)
 *              CONSTRAINTS-INDEX-SPECIFICATION-v1 (CHECK constraints for transactions)
 */

// Value Objects
export * from './value-objects';

// Domain Entities
export * from './entities';

// Domain Services
export * from './domain-services';

// Domain Policies
export * from './domain-policies';

// Domain Events
export {
  ResourceCreated,
  ResourceUpdated,
  ResourceStateChanged,
  ResourceDeleted,
  TransactionCompensated,
  ApprovalRequested,
  ApprovalGranted,
  ApprovalRejected,
} from './domain-events';

// Application Service
export { FinanceService } from './application-service';

// NestJS Module
export { FinanceModule } from './finance.module';

// Ports
export type {
  ITransactionPort,
  IMemberPort,
  IEventPort,
  IArchiveEntryPort,
  INotificationPort,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQueryFilters,
  CreateMemberInput,
  UpdateMemberInput,
  CreateEventInput,
  CreateArchiveEntryInput,
} from './ports/finance-ports';
