/**
 * RuntimeAuditService — CRT-014 (ADR-018).
 *
 * Écriture des entrées d'audit dans le modèle Prisma `AuditEntry`.
 * NON-BLOQUANT (AUD-001) : un échec d'écriture d'audit ne fait jamais
 * échouer l'opération métier — l'erreur est loggée et ignorée.
 *
 * OLDNEW-002 : valeurs avant/après systématiques.
 * NB-PERSIST-007 : pas d'auto-audit — seul l'AuditInterceptor (annotations
 * @Audit explicites) déclenche une écriture.
 *
 * @traceability ADR-018 §3.1 (CRT-014), AUD-001, OLDNEW-002, NB-PERSIST-007
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TenantContextProvider } from './tenant-context.provider';

export interface AuditEntryInput {
  /** Action métier (ex. 'transaction_created'). */
  action: string;
  /** Type d'entité affectée (ex. 'Transaction'). */
  entityType: string;
  entityId?: string;
  userId?: string;
  /** État avant (OLDNEW-002). */
  before?: unknown;
  /** État après (OLDNEW-002). */
  after?: unknown;
  ipAddress?: string;
}

/** Uuid nul utilisé quand l'org/utilisateur n'est pas résolu (champs requis Prisma). */
const NULL_UUID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class RuntimeAuditService {
  private readonly logger = new Logger(RuntimeAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextProvider,
  ) {}

  /**
   * Enregistre une entrée d'audit. Ne lève JAMAIS : les erreurs d'écriture
   * sont absorbées (AUD-001 — audit non-bloquant).
   */
  async log(input: AuditEntryInput): Promise<void> {
    try {
      const orgId = this.tenant.getOrgId() ?? NULL_UUID;
      await this.prisma.auditEntry.create({
        data: {
          org_id: orgId,
          sequence_log: BigInt(Date.now()),
          action_effectuee: input.action.slice(0, 50),
          entite_type: input.entityType.slice(0, 255),
          entite_id: input.entityId ?? NULL_UUID,
          utilisateur_id: input.userId ?? NULL_UUID,
          valeur_avant: (input.before ?? {}) as Prisma.InputJsonValue,
          valeur_apres: (input.after ?? {}) as Prisma.InputJsonValue,
          adresse_ip: input.ipAddress ?? null,
        },
      });
    } catch (error) {
      // AUD-001 : non-bloquant — jamais d'impact sur l'opération métier.
      this.logger.warn(
        `Écriture d'audit ignorée (non-bloquant) : ${(error as Error).message}`,
      );
    }
  }
}
