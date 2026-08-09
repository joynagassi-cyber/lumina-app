/**
 * ReportsController — endpoints bilan (MVP Jour 1, B3).
 *
 * POST /reports/generate → ReportingService.generateMonthlyReport
 * (totaux + par catégorie + par groupe, transactions approuvées uniquement —
 * BR-RPT-005). Les guards RBAC seront branchés avec le CapabilityEngine
 * (ADR-018, AuthorizationPort).
 *
 * @traceability MVP-JOUR1-SPEC §3 (B3), DOC-012 Aggregate9 (Reporting)
 */
import { Controller, Post, Body } from '@nestjs/common';
import { ReportingService } from '../application/reporting.service';
import type { GenerateMonthlyReportInput } from '../application/reporting.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportingService: ReportingService) {}

  /** POST /reports/generate — génère le bilan mensuel. */
  @Post('generate')
  async generate(@Body() input: GenerateMonthlyReportInput) {
    return this.reportingService.generateMonthlyReport(input);
  }
}
