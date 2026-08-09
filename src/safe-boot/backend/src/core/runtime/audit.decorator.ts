/**
 * @Audit — décorateur de méthode marquant une action à auditer.
 *
 * NB-PERSIST-007 : jamais d'auto-audit — seul un handler annoté @Audit est
 * intercepté (l'AuditInterceptor global ignore tout le reste).
 *
 * @traceability ADR-018 §3.1 (CRT-014), NB-PERSIST-007
 */

import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'lumina:audit';

export interface AuditMetadata {
  /** Action métier enregistrée dans AuditEntry.action_effectuee. */
  action: string;
  /** Type d'entité affectée (AuditEntry.entite_type). */
  entityType: string;
}

export const Audit = (metadata: AuditMetadata) => SetMetadata(AUDIT_METADATA_KEY, metadata);
