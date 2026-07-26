/**
 * AuditLogAdapter — Infrastructure Adapter for IAuditPort
 *
 * Writes audit entries to the AuditAggregate (audit_entries table).
 * Per DOC-023 §6: old_values AND new_values always present, append-only.
 *
 * @traceability DOC-012 AuditAggregate → DOC-023 §6
 *   → PAS-001 Port-009 (AuditPort)
 */

import type { IAuditPort } from '../../ports/audit.port';

export class AuditLogAdapter implements IAuditPort {
  constructor(
    private readonly prisma: unknown, // PrismaClient injected at composition root
  ) {}

  async log(payload: import('../../ports/audit.port').AuditPayload): Promise<void> {
    // Write audit entry per DOC-023 §6.2: before/after snapshots always present
    const entry = {
      entite_type: payload.entityType,
      entite_id: payload.entityId,
      action_effectuee: payload.action,
      utilisateur_id: payload.userId,
      valeur_avant: JSON.stringify(payload.before ?? {}),
      valeur_apres: JSON.stringify(payload.after ?? {}),
    };

    await this.prismaExecute('insert', entry);
  }

  private async prismaExecute(action: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('AuditLogAdapter requires a PrismaClient instance at composition root.');
  }
}
