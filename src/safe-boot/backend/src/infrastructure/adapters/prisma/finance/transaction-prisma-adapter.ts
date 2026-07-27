/**
 * TransactionPrismaAdapter — Prisma implementation of ITransactionPort.
 * Maps between domain entities and the PostgreSQL transactions table.
 *
 * @traceability DOC-012 Aggregate3, PG-Schema-v1 Table 7, PG-Schema-v1 §3.1 FK rules
 */

import { Injectable } from '@nestjs/common';
import type { ITransactionPort, CreateTransactionInput, UpdateTransactionInput, TransactionQueryFilters } from '../../domains/finance/ports/finance-ports';
import { ResourceId } from '../../domains/finance/value-objects/resource-id.vo';
import { AmountInCents } from '../../domains/finance/value-objects/amount-in-cents.vo';
import { TransactionState } from '../../domains/finance/value-objects/transaction-state.vo';
import { ResourceScope } from '../../domains/finance/value-objects/resource-scope.vo';
import { ResourceMetadata } from '../../domains/finance/value-objects/resource-metadata.vo';
import { TransactionReference } from '../../domains/finance/value-objects/transaction-reference.vo';
import { ResourceVersion } from '../../domains/finance/value-objects/resource-version.vo';
import type { PaginatedResult } from '../../../shared/types';

// Prisma-generated types (stub for compile-time)
declare const prisma: any;

@Injectable()
export class TransactionPrismaAdapter implements ITransactionPort {
  async findById(id: ResourceId): Promise<any | null> {
    const row = await prisma.transaction.findUnique({ where: { id: id.toString() } });
    return row ? this.deserialize(row) : null;
  }

  async findByOrgAndPage(filters: TransactionQueryFilters): Promise<PaginatedResult<any>> {
    const where: Record<string, unknown> = { org_id: filters.orgId };
    if (filters.state) where.statut = filters.state;
    if (filters.type) where.type_transaction = filters.type;
    if (filters.categoryRef) where.categorie_ref = filters.categoryRef;
    if (filters.dateFrom) where.date_transaction = { gte: filters.dateFrom };
    if (filters.dateTo) where.date_transaction = { lte: filters.dateTo };
    if (filters.scopeTargetId) where.portee_cible_id = filters.scopeTargetId;

    const skip = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);
    const take = filters.limit ?? 20;

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { date_transaction: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => this.deserialize(r)),
      total,
      page: filters.page ?? 1,
      limit: take,
      hasMore: skip + take < total,
    };
  }

  async create(input: CreateTransactionInput): Promise<any> {
    const id = ResourceId.generate().toString();
    const row = await prisma.transaction.create({
      data: {
        id,
        org_id: input.orgId,
        created_by: input.createdBy,
        montant: Number(input.amount.value),
        type_transaction: input.type,
        statut: TransactionState.DRAFT,
        categorie_ref: input.categoryRef,
        portee_type: input.scope.scopeType,
        portee_cible_id: input.scope.scopeTargetId,
        date_transaction: input.date,
        description: input.description ?? null,
        compense_pour: input.compensatesFor?.value ?? null,
        version: 1,
        est_synchronise: false,
      },
    });
    return this.deserialize(row);
  }

  async update(id: ResourceId, input: UpdateTransactionInput, _expectedVersion: ResourceVersion): Promise<any> {
    const data = this.mapUpdateInput(input);
    const row = await prisma.transaction.update({
      where: { id: id.toString() },
      data: { ...data, version: { increment: 1 } },
    });
    return this.deserialize(row);
  }

  async transitionState(id: ResourceId, _fromState: string, toState: string): Promise<any> {
    const row = await prisma.transaction.update({
      where: { id: id.toString() },
      data: { statut: toState, version: { increment: 1 } },
    });
    return this.deserialize(row);
  }

  async approve(id: ResourceId, approverUserId: string): Promise<any> {
    const row = await prisma.transaction.update({
      where: { id: id.toString() },
      data: {
        statut: 'approved',
        approuve_par: approverUserId,
        date_approbation: new Date(),
        est_synchronise: true,
        version: { increment: 1 },
      },
    });
    return this.deserialize(row);
  }

  async reject(id: ResourceId): Promise<any> {
    const row = await prisma.transaction.update({
      where: { id: id.toString() },
      data: { statut: 'rejected', version: { increment: 1 } },
    });
    return this.deserialize(row);
  }

  async compensate(
    originalId: ResourceId,
    compensationData: CreateTransactionInput & { createdBy: string },
  ): Promise<{ original: any; compensation: any }> {
    const original = await this.findById(originalId);
    const newId = ResourceId.generate().toString();
    const row = await prisma.transaction.create({
      data: {
        id: newId,
        org_id: compensationData.orgId,
        created_by: compensationData.createdBy,
        montant: Number(compensationData.amount.value),
        type_transaction: compensationData.type,
        statut: TransactionState.DRAFT,
        categorie_ref: compensationData.categoryRef,
        portee_type: compensationData.scope.scopeType,
        portee_cible_id: compensationData.scope.scopeTargetId,
        date_transaction: compensationData.date,
        description: compensationData.description ?? null,
        compense_pour: originalId.toString(),
        version: 1,
        est_synchronise: false,
      },
    });
    return {
      original,
      compensation: this.deserialize(row),
    };
  }

  async delete(id: ResourceId): Promise<boolean> {
    await prisma.transaction.update({
      where: { id: id.toString() },
      data: { is_deleted: true, version: { increment: 1 } },
    });
    return true;
  }

  // ====== Private Helpers ======

  private mapUpdateInput(input: UpdateTransactionInput): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    if (input.amount) data.montant = Number(input.amount.value);
    if (input.description !== undefined) data.description = input.description;
    if (input.date) data.date_transaction = input.date;
    if (input.categoryRef) data.categorie_ref = input.categoryRef;
    if (input.scope) {
      data.portee_type = input.scope.scopeType;
      data.portee_cible_id = input.scope.scopeTargetId;
    }
    return data;
  }

  private deserialize(row: any): any {
    return {
      id: new ResourceId(row.id),
      orgId: row.org_id,
      createdBy: row.created_by,
      amount: new AmountInCents(Number(row.montant)),
      type: row.type_transaction,
      state: row.statut as TransactionState,
      categoryRef: row.categorie_ref,
      scope: new ResourceScope(
        row.portee_type as 'org' | 'group',
        row.portee_cible_id,
      ),
      date: row.date_transaction ? new Date(row.date_transaction) : null,
      description: row.description,
      compensatesFor: row.compense_pour ? new TransactionReference(row.compense_pour) : null,
      approvedBy: row.approuve_par,
      approvedAt: row.date_approbation ? new Date(row.date_approbation) : null,
      version: new ResourceVersion(row.version),
      synced: row.est_synchronise,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      metadata: new ResourceMetadata(),
    };
  }
}
