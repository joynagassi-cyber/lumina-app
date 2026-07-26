/**
 * ReportingAggregate — barrel export.
 *
 * @traceability DOC-012 Aggregate9
 */

export { ReportingService } from './application/reporting.service';
export type { GenerateMonthlyReportInput } from './application/reporting.service';
export { ReportNotFoundError, PermissionDeniedError } from './application/reporting.service';

export { GeneratedReport, ReportGenerated, ReportExported, BalanceCalculated, ReportSigned } from './domain/entities/generated-report.entity';
export type { CategoryBreakdown, GeneratedReportProps } from './domain/entities/generated-report.entity';
export { ReportDefinition } from './domain/entities/report-definition.entity';
export type { ReportDefinitionProps } from './domain/entities/report-definition.entity';

export { ReportScope, InvalidReportScopeError } from './domain/value-objects/report-scope.vo';
export type { ReportScopeValue } from './domain/value-objects/report-scope.vo';
export { PeriodType, InvalidPeriodTypeError } from './domain/value-objects/period-type.vo';
export type { PeriodTypeValue } from './domain/value-objects/period-type.vo';
export { ReportFormat, ReportFormatCollection, InvalidReportFormatError } from './domain/value-objects/report-format.vo';
export type { ExportFormatValue } from './domain/value-objects/report-format.vo';
export { BalanceTotals, BalanceInvariantViolationError } from './domain/value-objects/balance-totals.vo';
export type { BalanceTotalsProps } from './domain/value-objects/balance-totals.vo';

export { BalanceCalculator } from './domain/services/balance-calculator.service';
export { ReportGenerator } from './domain/services/report-generator.service';
export type { GenerateReportInput } from './domain/services/report-generator.service';

export { PermissionCheckPolicy } from './domain/policies/permission-check-policy';
export type { PermissionCheckInput } from './domain/policies/permission-check-policy';
export { DataScopePolicy } from './domain/policies/data-scope-policy';
export { NetInternalTransfersPolicy } from './domain/policies/net-internal-transfers-policy';
export type { InternalTransferConfig } from './domain/policies/net-internal-transfers-policy';

export { PrismaReportingRepository } from './infrastructure/adapters/prisma-reporting.repository';

export type {
  IReportSnapshotPort,
  ITransactionQueryPort,
  ReportSnapshotRecord,
  RawTransactionRecord,
  CategoryBreakdown as PortCategoryBreakdown,
} from './ports/reporting.port';

export { ReportingModule } from './reporting.module';
