/**
 * Finance Domain Module — NestJS module wiring for ResourceAggregate.
 * Registers ports, application service, domain services, and controllers.
 *
 * @traceability DOC-012 Aggregate3, ITS-V1 module registration rules
 */

import { Module, DynamicModule } from '@nestjs/common';
import { FinanceService } from './application-service';
import { FinanceController } from './finance.controller';
import type {
  ITransactionPort,
  IMemberPort,
  IEventPort,
  IArchiveEntryPort,
  INotificationPort,
} from './ports/finance-ports';
import type { DomainEventPublisher } from './shared/events/event-publisher.interface';

const TransactionPortToken = 'ITransactionPort' as const;
const MemberPortToken = 'IMemberPort' as const;
const EventPortToken = 'IEventPort' as const;
const ArchiveEntryPortToken = 'IArchiveEntryPort' as const;
const NotificationPortToken = 'INotificationPort' as const;
const DomainEventPublisherToken = 'IDomainEventPublisher' as const;

@Module({})
export class FinanceModule {
  /**
   * Dynamic module factory -- infrastructure adapters register their port implementations here.
   * Called once in AppModule with resolved adapter instances.
   */
  static forRoot(
    transactionPort: ITransactionPort,
    memberPort: IMemberPort,
    eventPort: IEventPort,
    archiveEntryPort: IArchiveEntryPort,
    notificationPort: INotificationPort,
    eventPublisher: DomainEventPublisher,
  ): DynamicModule {
    return {
      module: FinanceModule,
      controllers: [FinanceController],
      providers: [
        FinanceService,
        { provide: TransactionPortToken, useValue: transactionPort },
        { provide: MemberPortToken, useValue: memberPort },
        { provide: EventPortToken, useValue: eventPort },
        { provide: ArchiveEntryPortToken, useValue: archiveEntryPort },
        { provide: NotificationPortToken, useValue: notificationPort },
        { provide: DomainEventPublisherToken, useValue: eventPublisher },
      ],
      exports: [FinanceService],
    };
  }
}
