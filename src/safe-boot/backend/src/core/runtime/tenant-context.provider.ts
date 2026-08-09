/**
 * TenantContextProvider — CRT-015 (ADR-018).
 *
 * Résolution du tenant (`org_id`) depuis la session JWT (INV-004, DR-009) —
 * JAMAIS depuis un paramètre HTTP (body/query). Propagation du contexte par
 * AsyncLocalStorage (une valeur par requête, sans pollution entre requêtes).
 *
 * Règles applicables :
 * - RN-008 / INV-004 : `org_id` injecté dans tous les services de données.
 * - 401 si le tenant n'est pas résolu lors d'un accès qui l'exige.
 *
 * Aucune logique métier (RN-001/RN-002) : uniquement la résolution + portage.
 *
 * @traceability ADR-018 §3.1 (CRT-015), INV-004, DR-009, RN-008
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Forme minimale du payload JWT requise pour la résolution du tenant. */
export interface JwtTenantClaims {
  user?: {
    org_id?: string;
    orgId?: string;
    org?: string;
    sub?: string;
  };
}

@Injectable()
export class TenantContextProvider {
  private readonly storage = new AsyncLocalStorage<string>();

  /** Exécute fn dans un contexte tenant (orgId) — portée de requête. */
  runWithOrg<T>(orgId: string, fn: () => T): T {
    return this.storage.run(orgId, fn);
  }

  /** org_id du contexte courant, ou undefined si aucun tenant actif. */
  getOrgId(): string | undefined {
    return this.storage.getStore();
  }

  /**
   * Résout l'org_id depuis les claims JWT. Ne lit JAMAIS body/query.
   * Accepte org_id / orgId / org (formats de claim possibles).
   */
  resolveFromJwt(claims: JwtTenantClaims | undefined): string | null {
    return claims?.user?.org_id ?? claims?.user?.orgId ?? claims?.user?.org ?? null;
  }

  /**
   * Résout l'org_id depuis le contexte (ou les claims JWT) et lève un
   * 401 si absent — conforme RN-008 / INV-004.
   */
  requireOrgId(claims?: JwtTenantClaims): string {
    const orgId = claims ? this.resolveFromJwt(claims) : this.getOrgId();
    if (!orgId) {
      throw new UnauthorizedException(
        'Tenant non résolu : org_id absent de la session JWT',
      );
    }
    return orgId;
  }
}
