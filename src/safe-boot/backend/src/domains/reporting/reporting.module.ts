/**
 * ReportingModule — NestJS module wiring for ReportingAggregate.
 *
 * @traceability DOC-012 Aggregate9, PAS-005 DR-004 (Runtime Assembly Responsibility)
 */

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { ReportingService } from '../application/reporting.service';
import { PrismaReportingRepository } from './infrastructure/adapters/prisma-reporting.repository';
import type { IReportSnapshotPort, ITransactionQueryPort } from '../ports/reporting.port';

const SnapshotPortToken = 'IReportSnapshotPort' as const;
const TransactionQueryPortToken = 'ITransactionQueryPort' as const;

@Module({})
export class ReportingModule {
  static forRoot(
    prismaClient: unknown,
  ): DynamicModule {
    return {
      module: ReportingModule,
      providers: [
        { provide: SnapshotPortToken, useClass: PrismaReportingRepository },
        {
          provide: TransactionQueryPortToken,
          useFactory: (repo: PrismaReportingRepository): ITransactionQueryPort => repo,
          inject: [SnapshotPortToken],
        },
        {
          provide: ReportingService,
          useFactory: (
            snapshotPort: IReportSnapshotPort,
            txnQueryPort: ITransactionQueryPort,
          ) => new ReportingService(snapshotPort, txnQueryPort),
          inject: [SnapshotPortToken, TransactionQueryPortToken],
        },
      ],
      exports: [ReportingService],
    };
  }
}
