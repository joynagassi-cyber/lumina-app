/**
 * AuditLoggerAdapter — Implements IAuditLogger using the existing AuditEntry table.
 *
 * Logs all delegation actions to the audit trail per BR-DEL-006.
 *
 * @traceability BR-DEL-006 — Every action audited
 */

import { Injectable, Inject } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { IAuditLogger } from '../../ports/delegation.ports';

const PRISMA_CLIENT = 'PRISMA_CLIENT';

@Injectable()
export class AuditLoggerAdapter implements IAuditLogger {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: any) {}

  async logAction(
    userId: string,
    orgId: string,
    action: string,
    entity: string,
    entityId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditEntries.create({
        data: {
          org_id: orgId,
          sequence_log: await this.getNextSequence(orgId),
          action_effectuee: action,
          entite_type: entity,
          entite_id: entityId,
          utilisateur_id: userId,
          valeur_avant: JSON.stringify({ before: action }),
          valeur_apres: details ? JSON.stringify({ after: details }) : JSON.stringify({}),
          date_heure_utc: new Date(),
        },
      });
    } catch (error) {
      console.error('Error logging audit entry:', error);
      // Don't fail the operation if audit logging fails
    }
  }

  /** Get the next sequence number for an organization. */
  private async getNextSequence(orgId: string): Promise<bigint> {
    try {
      const result = await this.prisma.auditEntries.aggregate({
        where: { org_id: orgId },
        _max: { sequence_log: true },
      });
      return (result._max?.sequence_log || 0) + 1n;
    } catch (error) {
      return 1n;
    }
  }
}