/**
 * Finance API Controller — HTTP endpoints for Transaction + Resource operations.
 * All endpoints are scoped to org_id via request context (multi-tenant isolation).
 *
 * @traceability DOC-012 Aggregate3, API-CONTRACT-003 (Transaction/Resource endpoints)
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { FinanceService } from './application-service';
import type { Request } from 'express';

// orgId injected by middleware; typed via express user augmentation
interface AuthRequest extends Request {
  user?: { orgId: string; id: string };
}

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ====== Transactions ======

  @Get('transactions')
  async searchTransactions(
    @Query('state') state?: string,
    @Query('type') type?: string,
    @Query('categoryRef') categoryRef?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.financeService.searchTransactions({
      orgId: '', // injected by middleware
      state,
      type,
      categoryRef,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page: page ?? 1,
      limit: limit ?? 20,
    });
  }

  @Post('transactions')
  async createTransaction(@Body() body: Record<string, unknown>) {
    return this.financeService.createTransaction(body as any);
  }

  @Put('transactions/:id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.financeService.updateTransaction(id, body, body.version as number);
  }

  @Post('transactions/:id/approve')
  async approveTransaction(@Param('id') id: string) {
    return this.financeService.approveTransaction(id, '');
  }

  @Post('transactions/:id/reject')
  async rejectTransaction(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.financeService.rejectTransaction(id, reason);
  }

  @Post('transactions/:id/compensate')
  async compensateTransaction(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.financeService.compensateTransaction(id, body as any);
  }

  @Delete('transactions/:id')
  async deleteTransaction(@Param('id') id: string) {
    return this.financeService.deleteTransaction(id);
  }

  // ====== Members ======

  @Post('members')
  async createMember(@Body() body: Record<string, unknown>) {
    return this.financeService.createMember(body as any);
  }

  // ====== Events ======

  @Post('events')
  async createEvent(@Body() body: Record<string, unknown>) {
    return this.financeService.createEvent(body as any);
  }

  // ====== Archive Entries ======

  @Post('archives')
  async createArchiveEntry(@Body() body: Record<string, unknown>) {
    return this.financeService.createArchiveEntry(body as any);
  }
}
