/**
 * Finance API Controller — HTTP endpoints for Transaction operations.
 * Périmètre MVP Jour 1 (MVP-JOUR1-SPEC B2) : grand livre + bilan + transitions.
 * Tous les endpoints sont scopés à l'org (multi-tenant INV-004).
 *
 * @traceability DOC-012 Aggregate3, MVP-JOUR1-SPEC §3 (B2)
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FinanceService, type BalanceSummary } from './application-service';
import { TransactionType } from './entities/transaction-record.entity';

// orgId injecté par le middleware auth ; typé via l'augmentation express
interface AuthRequestUser {
  user?: { orgId: string; id: string };
}

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ====== Grand livre ======

  /** GET /finance/transactions — liste chronologique avec filtres (état, type, catégorie, groupe, période). */
  @Get('transactions')
  async searchTransactions(
    @Query('state') state?: string,
    @Query('type') type?: string,
    @Query('categoryRef') categoryRef?: string,
    @Query('scopeTargetId') scopeTargetId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financeService.searchTransactions({
      orgId: '', // injecté par le middleware
      state,
      type: (type as TransactionType) || undefined,
      categoryRef,
      scopeTargetId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  /** GET /finance/transactions/balance — bilan (approuvées uniquement, BR-RPT-005). */
  @Get('transactions/balance')
  async getBalance(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('scopeTargetId') scopeTargetId?: string,
    @Query('categoryRef') categoryRef?: string,
  ): Promise<BalanceSummary> {
    return this.financeService.getBalance({
      orgId: '',
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      scopeTargetId,
      categoryRef,
    });
  }

  /** GET /finance/transactions/export — export CSV du grand livre filtré. */
  @Get('transactions/export')
  async exportTransactions(@Query() query: Record<string, string>, @Res() res: Response) {
    const result = await this.financeService.searchTransactions({
      orgId: '',
      state: query.state,
      type: (query.type as TransactionType) || undefined,
      categoryRef: query.categoryRef,
      scopeTargetId: query.scopeTargetId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page: 1,
      limit: 100_000,
    });
    const rows = result.data.map((t) => [
      t.id.toString(),
      t.date.toISOString(),
      t.type,
      t.state,
      t.categoryRef,
      t.description ?? '',
      String(t.amount.value),
    ]);
    const csv = ['id,date,type,state,categoryRef,description,amountCents', ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="grand-livre.csv"');
    return res.send(csv);
  }

  /** GET /finance/transactions/:id — détail d'une transaction (écran E4). */
  @Get('transactions/:id')
  async getTransaction(@Param('id') id: string) {
    return this.financeService.getTransaction(id);
  }

  // ====== Écritures ======

  /** POST /finance/transactions — création (état draft). */
  @Post('transactions')
  async createTransaction(@Body() body: Record<string, unknown>) {
    return this.financeService.createTransaction(body as never);
  }

  /** PATCH /finance/transactions/:id/transition — draft→pending→approved|rejected (mono-acteur J1). */
  @Patch('transactions/:id/transition')
  async transition(
    @Param('id') id: string,
    @Body('fromState') fromState: string,
    @Body('toState') toState: string,
  ) {
    return this.financeService.transitionTransaction(id, fromState, toState);
  }

  /** POST /finance/transactions/:id/approve — rétrocompatibilité circuit multi-acteurs. */
  @Post('transactions/:id/approve')
  async approveTransaction(@Param('id') id: string) {
    return this.financeService.approveTransaction(id, '');
  }

  /** POST /finance/transactions/:id/reject */
  @Post('transactions/:id/reject')
  async rejectTransaction(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.financeService.rejectTransaction(id, reason);
  }

  /** POST /finance/transactions/:id/compensate — correction d'une approuvée (INV-001). */
  @Post('transactions/:id/compensate')
  async compensateTransaction(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.financeService.compensateTransaction(id, body as never);
  }

  /** DELETE /finance/transactions/:id — draft/pending uniquement (ImmutabilityPolicy). */
  @Delete('transactions/:id')
  async deleteTransaction(@Param('id') id: string) {
    return this.financeService.deleteTransaction(id);
  }

  // ====== Members / Events / Archives (rétrocompatibilité ResourceAggregate) ======

  @Post('members')
  async createMember(@Body() body: Record<string, unknown>) {
    return this.financeService.createMember(body as never);
  }

  @Post('events')
  async createEvent(@Body() body: Record<string, unknown>) {
    return this.financeService.createEvent(body as never);
  }

  @Post('archives')
  async createArchiveEntry(@Body() body: Record<string, unknown>) {
    return this.financeService.createArchiveEntry(body as never);
  }
}

// Référence AuthRequestUser conservée pour la doc du middleware org
export type { AuthRequestUser };
